from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

RENDER_SERVICE_URL = os.environ['RENDER_SERVICE_URL']
UPLOADS_DIR = ROOT_DIR / 'uploads'
RENDERS_DIR = ROOT_DIR / 'renders'
UPLOADS_DIR.mkdir(exist_ok=True)
RENDERS_DIR.mkdir(exist_ok=True)

ALLOWED_IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}

app = FastAPI(title="DreamWedds Render API")
api_router = APIRouter(prefix="/api")


class Couple(BaseModel):
    partnerOne: str
    partnerTwo: str


class Venue(BaseModel):
    name: str = ""
    city: str = ""


class ScheduleItem(BaseModel):
    name: str
    time: str


class RenderRequest(BaseModel):
    template: str = "marigold"
    couple: Couple
    eventDate: str = ""
    venue: Venue = Field(default_factory=Venue)
    message: str = ""
    photos: List[str] = Field(default_factory=list)
    musicUrl: Optional[str] = None
    schedule: List[ScheduleItem] = Field(default_factory=list)
    durationInSeconds: int = 30


@api_router.get("/")
async def root():
    return {"message": "DreamWedds Render API"}


@api_router.get("/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=5) as hc:
            r = await hc.get(f"{RENDER_SERVICE_URL}/health")
            render_status = r.json()
    except Exception:
        render_status = {"status": "unreachable"}
    return {"api": "ok", "render_service": render_status}


@api_router.post("/upload")
async def upload_photo(file: UploadFile = File(...)):
    ext = Path(file.filename or '').suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
    name = f"{uuid.uuid4().hex}{ext}"
    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 15MB)")
    (UPLOADS_DIR / name).write_bytes(data)
    return {"url": f"/api/uploads/{name}"}


@api_router.get("/uploads/{filename}")
async def get_upload(filename: str):
    path = UPLOADS_DIR / Path(filename).name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path)


@api_router.post("/renders")
async def create_render(req: RenderRequest):
    payload = req.model_dump()
    payload['photos'] = [
        f"http://localhost:8001{p}" if p.startswith('/api/uploads/') else p
        for p in payload['photos']
    ]
    render_id = uuid.uuid4().hex
    out_path = RENDERS_DIR / f"{render_id}.mp4"

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(900, connect=10)) as hc:
            resp = await hc.post(f"{RENDER_SERVICE_URL}/render", json=payload)
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Render service is unavailable")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Render timed out")

    if resp.status_code != 200:
        detail = "Render failed"
        try:
            detail = resp.json().get('error', detail)
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=detail)

    out_path.write_bytes(resp.content)

    doc = {
        "_id": render_id,
        "template": req.template,
        "couple": req.couple.model_dump(),
        "eventDate": req.eventDate,
        "venue": req.venue.model_dump(),
        "durationInSeconds": req.durationInSeconds,
        "size_bytes": len(resp.content),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.renders.insert_one(doc)

    return {"id": render_id, "video_url": f"/api/renders/{render_id}/video", "size_bytes": len(resp.content)}


@api_router.get("/renders")
async def list_renders():
    docs = await db.renders.find().sort("created_at", -1).to_list(50)
    return [
        {
            "id": d["_id"],
            "template": d.get("template"),
            "couple": d.get("couple"),
            "eventDate": d.get("eventDate"),
            "created_at": d.get("created_at"),
            "video_url": f"/api/renders/{d['_id']}/video",
        }
        for d in docs
    ]


@api_router.get("/renders/{render_id}/video")
async def get_render_video(render_id: str):
    path = RENDERS_DIR / f"{Path(render_id).name}.mp4"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Video not found")
    return FileResponse(path, media_type="video/mp4", filename=f"dreamwedds-{render_id[:8]}.mp4")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
