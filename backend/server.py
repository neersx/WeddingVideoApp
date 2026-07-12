from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
import uuid
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'dreamwedds')
storage_backend = os.environ.get('STORAGE_BACKEND', 'memory').strip().lower()
if storage_backend not in {'memory', 'mongodb'}:
    raise RuntimeError("STORAGE_BACKEND must be either 'memory' or 'mongodb'")
RENDER_SERVICE_URL = os.environ.get('RENDER_SERVICE_URL', 'http://localhost:4001')
INTERNAL_BASE_URL = os.environ.get('INTERNAL_BASE_URL', 'http://localhost:8001')
UPLOADS_DIR = ROOT_DIR / 'uploads'
RENDERS_DIR = ROOT_DIR / 'renders'
MUSIC_DIR = ROOT_DIR / 'music'
UPLOADS_DIR.mkdir(exist_ok=True)
RENDERS_DIR.mkdir(exist_ok=True)

ALLOWED_IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}

# Bundled royalty-free music library. Files live in /app/backend/music/.
MUSIC_LIBRARY = [
    {
        "id": "tere-sang",
        "title": "Tere Sang (With You)",
        "mood": "Hindi · Romantic ballad",
        "filename": "tere-sang.mp3",
        "duration": 120,
        "credit": "Selectric Music & Lyrics",
    },
    {
        "id": "wedding-romantic",
        "title": "Wedding Romantic",
        "mood": "Cinematic · Ceremony",
        "filename": "wedding-romantic.mp3",
        "duration": 86,
        "credit": "Leberch",
    },
    {
        "id": "romantic-adventure",
        "title": "Romantic Adventure",
        "mood": "Uplifting · Cinematic",
        "filename": "romantic-adventure.mp3",
        "duration": 140,
        "credit": "Paul Yudin",
    },
    {
        "id": "romantic",
        "title": "Romantic",
        "mood": "Soft · Intimate",
        "filename": "romantic.mp3",
        "duration": 35,
        "credit": "PrettyJohn1",
    },
    {
        "id": "hindi-love-rap",
        "title": "Hindi Love Rap",
        "mood": "Trap · Hip-hop duet",
        "filename": "hindi-love-rap.mp3",
        "duration": 210,
        "credit": "Rahul Sapkal",
    },
]
MUSIC_BY_ID = {t["id"]: t for t in MUSIC_LIBRARY}

app = FastAPI(title="DreamWedds Render API")
api_router = APIRouter(prefix="/api")


class _InMemoryInsertResult:
    def __init__(self, inserted_id: str):
        self.inserted_id = inserted_id


class _InMemoryUpdateResult:
    def __init__(self, matched_count: int):
        self.matched_count = matched_count


class _InMemoryCursor:
    def __init__(self, documents):
        self._documents = list(documents)

    def sort(self, key: str, direction: int):
        reverse = direction < 0
        self._documents.sort(key=lambda doc: doc.get(key), reverse=reverse)
        return self

    async def to_list(self, length: int):
        return self._documents[:length]


class _InMemoryCollection:
    def __init__(self):
        self._documents = {}

    async def insert_one(self, document):
        self._documents[document["_id"]] = dict(document)
        return _InMemoryInsertResult(document["_id"])

    async def update_one(self, filter_query, update):
        document = self._documents.get(filter_query.get("_id"))
        if not document:
            return _InMemoryUpdateResult(0)
        if "$set" in update:
            document.update(update["$set"])
        self._documents[document["_id"]] = document
        return _InMemoryUpdateResult(1)

    async def find_one(self, filter_query):
        document = self._documents.get(filter_query.get("_id"))
        return dict(document) if document else None

    def find(self):
        return _InMemoryCursor(self._documents.values())


class _InMemoryDB:
    def __init__(self):
        self.renders = _InMemoryCollection()


client = None
db = _InMemoryDB()


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
    displayMessage: str = ""
    photos: List[str] = Field(default_factory=list)
    musicUrl: Optional[str] = None
    musicId: Optional[str] = None
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
    return {"api": "ok", "storage_backend": storage_backend, "render_service": render_status}


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


@api_router.get("/music")
async def list_music():
    return [
        {
            "id": t["id"],
            "title": t["title"],
            "mood": t["mood"],
            "duration": t["duration"],
            "credit": t["credit"],
            "url": f"/api/music/{t['id']}",
        }
        for t in MUSIC_LIBRARY
    ]


@api_router.get("/music/{music_id}")
async def get_music(music_id: str):
    track = MUSIC_BY_ID.get(music_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    path = MUSIC_DIR / track["filename"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Track file missing")
    return FileResponse(path, media_type="audio/mpeg", filename=track["filename"])


async def _run_render_job(job_id: str, payload: dict):
    """Background worker: dispatch to render-service, poll progress, download mp4, update Mongo doc."""
    try:
        current_db = db
        async with httpx.AsyncClient(timeout=httpx.Timeout(30, connect=10)) as hc:
            start = await hc.post(f"{RENDER_SERVICE_URL}/render-async", json=payload)
        if start.status_code != 200:
            detail = start.json().get('error', 'render service rejected job') if start.headers.get('content-type', '').startswith('application/json') else 'render service rejected job'
            await current_db.renders.update_one({"_id": job_id}, {"$set": {"status": "failed", "error": detail}})
            return
        internal_id = start.json()["jobId"]
        await current_db.renders.update_one({"_id": job_id}, {"$set": {"status": "rendering", "internal_id": internal_id}})

        # Poll every 2s, up to 15 min.
        deadline = asyncio.get_event_loop().time() + 15 * 60
        last_progress = -1.0
        async with httpx.AsyncClient(timeout=httpx.Timeout(20, connect=5)) as hc:
            while True:
                if asyncio.get_event_loop().time() > deadline:
                    await current_db.renders.update_one({"_id": job_id}, {"$set": {"status": "failed", "error": "timeout"}})
                    return
                await asyncio.sleep(2)
                try:
                    poll = await hc.get(f"{RENDER_SERVICE_URL}/jobs/{internal_id}")
                except httpx.HTTPError:
                    continue
                if poll.status_code != 200:
                    continue
                data = poll.json()
                progress = float(data.get("progress") or 0)
                status = data.get("status")
                if abs(progress - last_progress) >= 0.02 or status != "rendering":
                    last_progress = progress
                    await current_db.renders.update_one(
                        {"_id": job_id},
                        {"$set": {"status": status, "progress": progress}},
                    )
                if status == "done":
                    # download the mp4
                    dl = await hc.get(f"{RENDER_SERVICE_URL}/jobs/{internal_id}/video", timeout=httpx.Timeout(120, connect=10))
                    if dl.status_code != 200:
                        await current_db.renders.update_one({"_id": job_id}, {"$set": {"status": "failed", "error": "download failed"}})
                        return
                    out_path = RENDERS_DIR / f"{job_id}.mp4"
                    out_path.write_bytes(dl.content)
                    await current_db.renders.update_one(
                        {"_id": job_id},
                        {"$set": {
                            "status": "done",
                            "progress": 1.0,
                            "size_bytes": len(dl.content),
                            "finished_at": datetime.now(timezone.utc).isoformat(),
                        }},
                    )
                    return
                if status == "failed":
                    await current_db.renders.update_one(
                        {"_id": job_id},
                        {"$set": {"status": "failed", "error": data.get("error") or "render failed"}},
                    )
                    return
    except Exception as e:  # noqa: BLE001
        logger.exception("render job crashed")
        await db.renders.update_one({"_id": job_id}, {"$set": {"status": "failed", "error": str(e)}})


@api_router.post("/renders")
async def create_render(req: RenderRequest, background: BackgroundTasks):
    payload = req.model_dump()

    # Resolve bundled music id -> served url (takes precedence over musicUrl).
    if req.musicId:
        track = MUSIC_BY_ID.get(req.musicId)
        if not track:
            raise HTTPException(status_code=400, detail=f"Unknown musicId: {req.musicId}")
        payload["musicUrl"] = f"{INTERNAL_BASE_URL}/api/music/{track['id']}"

    payload['photos'] = [
        f"{INTERNAL_BASE_URL}{p}" if p.startswith('/api/uploads/') else p
        for p in payload['photos']
    ]

    render_id = uuid.uuid4().hex
    doc = {
        "_id": render_id,
        "template": req.template,
        "couple": req.couple.model_dump(),
        "eventDate": req.eventDate,
        "venue": req.venue.model_dump(),
        "displayMessage": req.displayMessage,
        "durationInSeconds": req.durationInSeconds,
        "musicId": req.musicId,
        "status": "queued",
        "progress": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.renders.insert_one(doc)

    background.add_task(_run_render_job, render_id, payload)

    return {
        "jobId": render_id,
        "status": "queued",
        "poll_url": f"/api/renders/{render_id}",
        "video_url": f"/api/renders/{render_id}/video",
    }


@api_router.get("/renders")
async def list_renders():
    docs = await db.renders.find().sort("created_at", -1).to_list(50)
    return [
        {
            "id": d["_id"],
            "template": d.get("template"),
            "couple": d.get("couple"),
            "eventDate": d.get("eventDate"),
            "displayMessage": d.get("displayMessage"),
            "status": d.get("status", "done"),
            "progress": d.get("progress", 0.0),
            "created_at": d.get("created_at"),
            "finished_at": d.get("finished_at"),
            "video_url": f"/api/renders/{d['_id']}/video",
        }
        for d in docs
    ]


@api_router.get("/renders/{render_id}")
async def get_render(render_id: str):
    d = await db.renders.find_one({"_id": render_id})
    if not d:
        raise HTTPException(status_code=404, detail="Render not found")
    return {
        "id": d["_id"],
        "template": d.get("template"),
        "couple": d.get("couple"),
        "eventDate": d.get("eventDate"),
        "venue": d.get("venue"),
        "displayMessage": d.get("displayMessage"),
        "status": d.get("status", "done"),
        "progress": d.get("progress", 0.0),
        "error": d.get("error"),
        "created_at": d.get("created_at"),
        "finished_at": d.get("finished_at"),
        "video_url": f"/api/renders/{d['_id']}/video",
    }


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


@app.on_event("startup")
async def initialize_storage():
    global client, db
    if storage_backend == 'memory':
        db = _InMemoryDB()
        logger.info("Using in-memory storage")
        return

    try:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=1000)
        await client.admin.command("ping")
        db = client[db_name]
        logger.info("Connected to MongoDB at %s", mongo_url)
    except Exception as exc:  # noqa: BLE001
        if client is not None:
            client.close()
            client = None
        raise RuntimeError(f"STORAGE_BACKEND=mongodb but MongoDB is unavailable: {exc}") from exc


@app.on_event("shutdown")
async def shutdown_db_client():
    if client is not None:
        client.close()
