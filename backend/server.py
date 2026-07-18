from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks, Header, Depends, Request
from fastapi.responses import FileResponse, Response, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
import os
import logging
import httpx
import uuid
import asyncio
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent

# Select the backend configuration before reading any application settings.
# Values supplied by the host environment keep priority over dotenv files.
APP_ENV = os.environ.get('APP_ENV', 'development').strip().lower()
if APP_ENV not in {'development', 'production'}:
    raise RuntimeError("APP_ENV must be either 'development' or 'production'")

load_dotenv(ROOT_DIR / f'.env.{APP_ENV}')

# Preserve the original local .env as a development-only fallback while the
# project transitions to environment-specific files. It is never loaded in
# production, which prevents local settings from leaking into a production run.
if APP_ENV == 'development':
    load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'invitavideodb')
storage_backend = os.environ.get('STORAGE_BACKEND', 'memory').strip().lower()
if storage_backend not in {'memory', 'mongodb'}:
    raise RuntimeError("STORAGE_BACKEND must be either 'memory' or 'mongodb'")
RENDER_SERVICE_URL = os.environ.get('RENDER_SERVICE_URL', 'http://localhost:4001')
INTERNAL_BASE_URL = os.environ.get('INTERNAL_BASE_URL', 'http://localhost:8001')
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '').strip()
GOOGLE_CLIENT_IDS = [client_id.strip() for client_id in GOOGLE_CLIENT_ID.split(',') if client_id.strip()]
DISABLE_GOOGLE_AUTH = os.environ.get('DISABLE_GOOGLE_AUTH', 'false').strip().lower() in {'1', 'true', 'yes', 'on'}
CONFIGURED_ADMIN_EMAILS = {
    email.strip().lower()
    for email in os.environ.get('ADMIN_EMAILS', '').split(',')
    if email.strip()
}
ADMIN_EMAILS = CONFIGURED_ADMIN_EMAILS or {'neer19ultimate@gmail.com'}
# Native app sign-ins carry the iOS/Android OAuth client ID in the token's azp
# claim; those clients can't produce a reCAPTCHA v3 web token, so they bypass it.
MOBILE_GOOGLE_CLIENT_IDS = {
    client_id.strip()
    for client_id in os.environ.get('MOBILE_GOOGLE_CLIENT_IDS', '').split(',')
    if client_id.strip()
}
RECAPTCHA_SECRET_KEY = os.environ.get('RECAPTCHA_SECRET_KEY', '').strip()
RECAPTCHA_EXPECTED_ACTION = os.environ.get('RECAPTCHA_EXPECTED_ACTION', 'render_video').strip()
try:
    RECAPTCHA_SCORE_THRESHOLD = float(os.environ.get('RECAPTCHA_SCORE_THRESHOLD', '0.5') or '0.5')
except ValueError:
    RECAPTCHA_SCORE_THRESHOLD = 0.5
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
        "categories": ["Wedding", "Engagement"],
    },
    {
        "id": "wedding-romantic",
        "title": "Wedding Romantic",
        "mood": "Cinematic · Ceremony",
        "filename": "wedding-romantic.mp3",
        "duration": 86,
        "credit": "Leberch",
        "categories": ["Wedding"],
    },
    {
        "id": "romantic-adventure",
        "title": "Romantic Adventure",
        "mood": "Uplifting · Cinematic",
        "filename": "romantic-adventure.mp3",
        "duration": 140,
        "credit": "Paul Yudin",
        "categories": ["Wedding", "Engagement"],
    },
    {
        "id": "romantic",
        "title": "Romantic",
        "mood": "Soft · Intimate",
        "filename": "romantic.mp3",
        "duration": 35,
        "credit": "PrettyJohn1",
        "categories": ["Wedding", "Engagement", "Birthday"],
    },
    {
        "id": "hindi-love-rap",
        "title": "Hindi Love Rap",
        "mood": "Trap · Hip-hop duet",
        "filename": "hindi-love-rap.mp3",
        "duration": 210,
        "credit": "Rahul Sapkal",
        "categories": ["Birthday"],
    },
]
MUSIC_BY_ID = {t["id"]: t for t in MUSIC_LIBRARY}


async def list_music_tracks():
    """Return bundled tracks plus admin-uploaded tracks persisted in MongoDB."""
    dynamic = await db.music.find().to_list(500)
    overrides = {track.get("id"): track for track in dynamic}
    bundled = [{**track, **overrides[track["id"]]} if track["id"] in overrides else track for track in MUSIC_LIBRARY]
    return bundled + [track for track in dynamic if track.get("id") not in MUSIC_BY_ID]


async def find_music_track(music_id: str):
    override = await db.music.find_one({"id": music_id})
    if override:
        return override
    track = MUSIC_BY_ID.get(music_id)
    if track:
        return track
    return None

DEFAULT_TEMPLATE_DOCUMENTS = [
    {
        "_id": "marigold",
        "id": "marigold",
        "name": "Marigold",
        "desc": "Rustic-luxe traditional. Burnt orange, gold, floating petals.",
        "category": "Wedding",
        "swatch": ["#C55A36", "#D4AF37", "#F8AB5B", "#FFF8F0"],
        "bg": "#FFF8F0",
        "text": "#4A2545",
        "font": "'Playfair Display', serif",
        "isActive": True,
        "sortOrder": 10,
    },
    {
        "_id": "midnight",
        "id": "midnight",
        "name": "Midnight",
        "desc": "Dark romance. Cinematic black, gold typography, starfield.",
        "category": "Wedding",
        "swatch": ["#0B0B0F", "#2B1B3D", "#D4AF37", "#7A5C9E"],
        "bg": "#0B0B0F",
        "text": "#E7D9F2",
        "font": "'Cormorant Garamond', serif",
        "isActive": True,
        "sortOrder": 20,
    },
    {
        "_id": "heartbeat",
        "id": "heartbeat",
        "name": "Heartbeat",
        "desc": "Beating heart intro, blush photobook with floating date bar, romantic invitation.",
        "category": "Wedding",
        "swatch": ["#B4405F", "#F5D0D8", "#C7A365", "#FFF7F0"],
        "bg": "#FFF7F0",
        "text": "#7A1E3A",
        "font": "'Dancing Script', cursive",
        "isActive": True,
        "sortOrder": 30,
    },
    {
        "_id": "story",
        "id": "story",
        "name": "Story",
        "desc": "Editorial full-bleed photos, huge bold date reveal, chapter-by-chapter invitation.",
        "category": "Wedding",
        "swatch": ["#7A9B76", "#F4EFE6", "#A67B39", "#1F1F1F"],
        "bg": "#1F1F1F",
        "text": "#F4EFE6",
        "font": "'Cormorant Garamond', serif",
        "isActive": True,
        "sortOrder": 40,
    },
    {
        "_id": "poster",
        "id": "poster",
        "name": "Poster",
        "desc": "Bauhaus-modern. Bold monogram, geometric mosaic, red/yellow accents, editorial punch.",
        "category": "Wedding",
        "swatch": ["#E63946", "#F4C542", "#264653", "#F2EEE5"],
        "bg": "#F2EEE5",
        "text": "#0A0A0A",
        "font": "'Archivo Black', sans-serif",
        "isActive": True,
        "sortOrder": 50,
    },
    {
        "_id": "showcase",
        "id": "showcase",
        "name": "Showcase",
        "desc": "Premium promo. Three animated wedding-website heroes with cinematic camera moves, live RSVP & countdown, Invita Videos logo outro.",
        "category": "Wedding",
        "swatch": ["#0E0D0B", "#B08D57", "#7A9B76", "#F5EFE2"],
        "bg": "#0E0D0B",
        "text": "#B08D57",
        "font": "'Playfair Display', serif",
        "isActive": True,
        "sortOrder": 60,
    },
    {
        "_id": "engagement-glow",
        "id": "engagement-glow",
        "name": "Engagement Glow",
        "desc": "Moody purple-rose engagement invite with soft bokeh background, champagne typography and cinematic reveal.",
        "category": "Engagement",
        "swatch": ["#150D1F", "#6D3B63", "#C58B7D", "#E7C694"],
        "bg": "#150D1F",
        "text": "#FFF7F3",
        "font": "'Cormorant Garamond', serif",
        "isActive": True,
        "sortOrder": 10,
    },
    {
        "_id": "royal-palace",
        "id": "royal-palace",
        "name": "Royal Palace",
        "desc": "Regal emerald and antique-gold wedding invitation with palace arches, a couple crest and ceremonial details.",
        "category": "Wedding",
        "swatch": ["#0D3028", "#741E35", "#D6B56D", "#FFF4D6"],
        "bg": "#0D3028",
        "text": "#FFF4D6",
        "font": "'Cormorant Garamond', serif",
        "isActive": True,
        "sortOrder": 70,
    },
    {
        "_id": "ring-reveal",
        "id": "ring-reveal",
        "name": "Ring Reveal",
        "desc": "Luxury engagement announcement with interlocking gold rings, diamond light and an elegant portrait reveal.",
        "category": "Engagement",
        "swatch": ["#111111", "#D5B36A", "#F7E9DC", "#FFFFFF"],
        "bg": "#111111",
        "text": "#F7E9DC",
        "font": "'Cormorant Garamond', serif",
        "isActive": True,
        "sortOrder": 20,
    },
    {
        "_id": "confetti-pop",
        "id": "confetti-pop",
        "name": "Confetti Pop",
        "desc": "Bright birthday invitation with balloons, falling confetti, bold party typography and a playful photo stack.",
        "category": "Birthday",
        "swatch": ["#FF5A7A", "#FFD447", "#42C6D7", "#7454D8"],
        "bg": "#FFF6D8",
        "text": "#24213A",
        "font": "'Outfit', sans-serif",
        "isActive": True,
        "sortOrder": 10,
    },
    {
        "_id": "birthday-era-v1",
        "id": "birthday-era-v1",
        "name": "Birthday Era",
        "desc": "Emotional cinematic birthday reel with warm film tones, four-photo storytelling, gentle motion and a branded InvitaVideos outro.",
        "category": "Birthday",
        "style": "Trendy Beat Sync",
        "duration": 30,
        "maxImages": 4,
        "swatch": ["#9C6249", "#4B302A", "#F1B56B", "#FFF7EA"],
        "bg": "#4B302A",
        "text": "#FFF7EA",
        "font": "'Cormorant Garamond', serif",
        "isActive": True,
        "sortOrder": 5,
    },
    {
        "_id": "golden-hour",
        "id": "golden-hour",
        "name": "Golden Hour",
        "desc": "Luxury cinematic birthday short film with warm sunset light, editorial typography, moving golden reflections and a branded InvitaVideos outro.",
        "category": "Birthday",
        "style": "Cinematic Editorial",
        "duration": 30,
        "maxImages": 4,
        "swatch": ["#0D0A09", "#2C1A15", "#D9AE65", "#FFF7EA"],
        "bg": "#2C1A15",
        "text": "#FFF7EA",
        "font": "'Cormorant Garamond', serif",
        "isActive": True,
        "sortOrder": 15,
    },
    {
        "_id": "from-my-heart-cinematic",
        "id": "from-my-heart-cinematic",
        "name": "From My Heart",
        "desc": "A heartfelt, relationship-aware birthday reel with warm cinematic tones, per-photo messages and a personal sign-off.",
        "category": "From My Heart",
        "style": "Emotional Cinematic",
        "duration": 30,
        "maxImages": 5,
        "swatch": ["#7A1E3A", "#D98774", "#F1B56B", "#FFF7EA"],
        "bg": "#2A0E1B",
        "text": "#FFF7EA",
        "font": "'Cormorant Garamond', serif",
        # Capabilities describe what THIS video can render. The client shows a
        # capability-gated field only when the selected template supports it.
        "capabilities": {
            "minImages": 3,
            "maxImages": 5,
            "introMessage": {"supported": True, "maxLength": 140},
            "perImageMessage": {"supported": True, "maxLength": 70},
            "finalMessage": {"supported": True, "maxLength": 120},
            "eventDate": {"supported": True},
            "relationship": {"supported": True},
        },
        "isActive": True,
        "sortOrder": 5,
    },
]

# Relationship catalog for relationship-driven templates ("From My Heart").
# One row per sender->recipient pairing; drives select options AND copy tokens
# so template text personalizes without any hardcoded "wife"/"mother".
RELATIONSHIPS = {
    "husband-wife":    {"label": "To my Wife",     "recipientTerm": "wife",     "senderTerm": "husband",  "recipientPronoun": "her"},
    "wife-husband":    {"label": "To my Husband",  "recipientTerm": "husband",  "senderTerm": "wife",     "recipientPronoun": "his"},
    "brother-sister":  {"label": "To my Sister",   "recipientTerm": "sister",   "senderTerm": "brother",  "recipientPronoun": "her"},
    "sister-brother":  {"label": "To my Brother",  "recipientTerm": "brother",  "senderTerm": "sister",   "recipientPronoun": "his"},
    "son-mother":      {"label": "To my Mother",   "recipientTerm": "mother",   "senderTerm": "son",      "recipientPronoun": "her"},
    "daughter-father": {"label": "To my Father",   "recipientTerm": "father",   "senderTerm": "daughter", "recipientPronoun": "his"},
    "friend-friend":   {"label": "To my Friend",   "recipientTerm": "friend",   "senderTerm": "friend",   "recipientPronoun": "their"},
}


def _relationship_options():
    return [{"value": key, "label": value["label"]} for key, value in RELATIONSHIPS.items()]


# First-class category documents. A category owns the IDENTITY fields (who the
# video is about); capability-gated fields (marked with "capability") appear only
# when the chosen template supports that capability. Categories without a doc
# here (Wedding/Engagement/Birthday) fall back to the client's legacy form.
DEFAULT_CATEGORY_DOCUMENTS = [
    {
        "_id": "from-my-heart",
        "id": "from-my-heart",
        "name": "From My Heart",
        "description": "Emotional, relationship-driven birthday reels for the people you love.",
        "icon": "❤️",
        "sharedSteps": ["photos", "music"],
        "form": {
            "fields": [
                {"key": "celebrantName", "type": "text", "label": "Whose birthday is it?",
                 "placeholder": "Nisha", "required": True},
                {"key": "senderName", "type": "text", "label": "Your name",
                 "placeholder": "Neeraj", "required": False},
                {"key": "relationshipType", "type": "select", "label": "Your relationship",
                 "optionsRef": "relationships", "required": True},
                {"key": "eventDate", "type": "date", "label": "Birthday",
                 "required": False, "capability": "eventDate"},
                {"key": "introMessage", "type": "textarea", "label": "Opening message",
                 "placeholder": "Happy birthday to someone truly special…",
                 "maxLength": 140, "capability": "introMessage"},
                {"key": "finalMessage", "type": "textarea", "label": "Closing message",
                 "placeholder": "Here's to you, today and always ❤️",
                 "maxLength": 120, "capability": "finalMessage"},
            ]
        },
        "isActive": True,
        "sortOrder": 5,
    },
]

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
        document = await self.find_one(filter_query)
        if not document:
            return _InMemoryUpdateResult(0)
        if "$set" in update:
            document.update(update["$set"])
        self._documents[document["_id"]] = document
        return _InMemoryUpdateResult(1)

    async def find_one(self, filter_query):
        document = next(
            (
                doc
                for doc in self._documents.values()
                if all(doc.get(key) == value for key, value in filter_query.items())
            ),
            None,
        )
        return dict(document) if document else None

    async def count_documents(self, filter_query):
        return sum(
            1 for document in self._documents.values()
            if all(document.get(key) == value for key, value in filter_query.items())
        )

    def find(self, filter_query=None):
        filter_query = filter_query or {}
        documents = [
            doc
            for doc in self._documents.values()
            if all(doc.get(key) == value for key, value in filter_query.items())
        ]
        return _InMemoryCursor(documents)


class _InMemoryDB:
    def __init__(self):
        self.renders = _InMemoryCollection()
        self.users = _InMemoryCollection()
        self.templates = _InMemoryCollection()
        self.music = _InMemoryCollection()
        self.categories = _InMemoryCollection()


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
    category: str = ""
    # couple is optional now: data-driven categories send a generic `fields` bag
    # instead, and the adapter derives couple from it for backward compatibility.
    couple: Optional[Couple] = None
    fields: Dict[str, Any] = Field(default_factory=dict)
    eventDate: str = ""
    venue: Venue = Field(default_factory=Venue)
    message: str = ""
    displayMessage: str = ""
    photos: List[str] = Field(default_factory=list)
    musicUrl: Optional[str] = None
    musicId: Optional[str] = None
    schedule: List[ScheduleItem] = Field(default_factory=list)
    durationInSeconds: int = 30
    tags: List[str] = Field(default_factory=list)
    recaptchaToken: Optional[str] = None


class GoogleLoginRequest(BaseModel):
    credential: str


class GoogleUser(BaseModel):
    sub: str
    email: str
    name: str = ""
    picture: str = ""
    email_verified: bool = False
    azp: str = ""


class TemplateUpdateRequest(BaseModel):
    category: str
    isActive: bool = True
    sortOrder: int = 100
    defaultMusicId: Optional[str] = None


class MusicUpdateRequest(BaseModel):
    categories: List[str] = Field(default_factory=list)


def _user_doc_from_google_user(user: GoogleUser):
    now = datetime.now(timezone.utc).isoformat()
    return {
        "_id": user.sub,
        "provider": "google",
        "googleSub": user.sub,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
        "email_verified": user.email_verified,
        "updated_at": now,
    }


async def _save_google_user(user: GoogleUser):
    user_doc = _user_doc_from_google_user(user)
    existing = await db.users.find_one({"_id": user.sub})
    if existing:
        await db.users.update_one({"_id": user.sub}, {"$set": user_doc})
    else:
        user_doc["created_at"] = user_doc["updated_at"]
        await db.users.insert_one(user_doc)
    return user_doc


def _verify_google_credential(credential: str) -> GoogleUser:
    if not GOOGLE_CLIENT_IDS:
        raise HTTPException(status_code=503, detail="Google login is not configured")

    try:
        payload = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_IDS,
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid Google credential") from exc

    if payload.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise HTTPException(status_code=401, detail="Invalid Google issuer")

    user = GoogleUser(
        sub=str(payload.get("sub", "")),
        email=str(payload.get("email", "")),
        name=str(payload.get("name", "")),
        picture=str(payload.get("picture", "")),
        email_verified=bool(payload.get("email_verified", False)),
        azp=str(payload.get("azp", "")),
    )

    if not user.sub or not user.email:
        raise HTTPException(status_code=401, detail="Google credential missing account details")

    return user


async def require_google_user(authorization: str = Header(default="")) -> GoogleUser:
    if DISABLE_GOOGLE_AUTH:
        return GoogleUser(
            sub="local-development-user",
            email=os.environ.get('DEV_USER_EMAIL', 'local-dev@invitavideos.test'),
            name="Local Development User",
            picture="",
            email_verified=True,
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Login is required to render a video")

    user = _verify_google_credential(token)
    await _save_google_user(user)
    return user


async def require_admin_user(user: GoogleUser = Depends(require_google_user)) -> GoogleUser:
    if ADMIN_EMAILS and user.email.lower() not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Admin access is required")
    return user


def _serialize_template(document):
    return {
        "id": document.get("id") or document.get("_id"),
        "name": document.get("name", ""),
        "desc": document.get("desc", ""),
        "category": document.get("category", "Wedding"),
        "swatch": document.get("swatch", []),
        "bg": document.get("bg", "#FFFFFF"),
        "text": document.get("text", "#111111"),
        "font": document.get("font", "'Playfair Display', serif"),
        "style": document.get("style", ""),
        "duration": document.get("duration"),
        "maxImages": document.get("maxImages"),
        "capabilities": document.get("capabilities") or {},
        "defaultMusicId": document["defaultMusicId"] if "defaultMusicId" in document else "tere-sang",
        "renderCount": int(document.get("renderCount", 0)),
        "isActive": bool(document.get("isActive", True)),
        "sortOrder": int(document.get("sortOrder", 100)),
        "updated_at": document.get("updated_at"),
    }


async def _attach_template_render_counts(templates):
    for template in templates:
        template["renderCount"] = await db.renders.count_documents({"template": template["id"]})
    return templates


async def seed_default_templates():
    now = datetime.now(timezone.utc).isoformat()
    for template in DEFAULT_TEMPLATE_DOCUMENTS:
        existing = await db.templates.find_one({"_id": template["_id"]})
        if existing:
            # Backfill capabilities onto templates seeded before this field existed.
            if "capabilities" in template and not existing.get("capabilities"):
                await db.templates.update_one(
                    {"_id": template["_id"]},
                    {"$set": {"capabilities": template["capabilities"], "updated_at": now}},
                )
            continue
        doc = dict(template)
        doc["created_at"] = now
        doc["updated_at"] = now
        await db.templates.insert_one(doc)


async def seed_default_categories():
    now = datetime.now(timezone.utc).isoformat()
    for category in DEFAULT_CATEGORY_DOCUMENTS:
        existing = await db.categories.find_one({"_id": category["_id"]})
        if existing:
            continue
        doc = dict(category)
        doc["created_at"] = now
        doc["updated_at"] = now
        await db.categories.insert_one(doc)


def _serialize_category(document):
    form = document.get("form") or {}
    return {
        "id": document.get("id") or document.get("_id"),
        "name": document.get("name", ""),
        "description": document.get("description", ""),
        "icon": document.get("icon", "✨"),
        "sharedSteps": document.get("sharedSteps", ["photos", "music"]),
        "form": form,
        # Resolve any optionsRef so the client gets ready-to-render select options.
        "relationships": _relationship_options(),
        "isActive": bool(document.get("isActive", True)),
        "sortOrder": int(document.get("sortOrder", 100)),
    }


def resolve_render_copy(template: str, category: str, fields: Dict[str, Any]) -> Dict[str, Any]:
    """Resolve relationship terms and substitute {{tokens}} in user copy — done
    once here so every relationship-driven template renders personalized strings
    without reimplementing token logic."""
    fields = fields or {}
    rel = RELATIONSHIPS.get(str(fields.get("relationshipType") or ""), {})
    ctx = {
        "celebrantName": str(fields.get("celebrantName") or "").strip(),
        "senderName": str(fields.get("senderName") or "").strip(),
        "recipientTerm": rel.get("recipientTerm", ""),
        "senderTerm": rel.get("senderTerm", ""),
        "recipientPronoun": rel.get("recipientPronoun", "their"),
    }

    def fill(text: str) -> str:
        if not text:
            return ""
        for key, value in ctx.items():
            text = text.replace("{{" + key + "}}", value)
        return text

    photo_messages = [fill(m) for m in (fields.get("photoMessages") or []) if isinstance(m, str)]
    return {
        **ctx,
        "relationshipLabel": rel.get("label", ""),
        "introMessage": fill(str(fields.get("introMessage") or "")),
        "finalMessage": fill(str(fields.get("finalMessage") or "")),
        "photoMessages": photo_messages,
    }


async def verify_recaptcha_token(token: Optional[str], remote_ip: Optional[str] = None):
    if not RECAPTCHA_SECRET_KEY:
        return None
    if not token:
        raise HTTPException(status_code=403, detail="reCAPTCHA verification is required")

    try:
        async with httpx.AsyncClient(timeout=10) as hc:
            form = {"secret": RECAPTCHA_SECRET_KEY, "response": token}
            if remote_ip:
                form["remoteip"] = remote_ip
            response = await hc.post(
                "https://www.google.com/recaptcha/api/siteverify",
                data=form,
            )
            result = response.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("reCAPTCHA verification request failed: %s", exc)
        raise HTTPException(status_code=503, detail="Could not verify reCAPTCHA") from exc

    score = float(result.get("score") or 0)
    action = result.get("action")
    if not result.get("success"):
        logger.warning("reCAPTCHA verification failed: %s", result.get("error-codes", []))
        raise HTTPException(status_code=403, detail="reCAPTCHA verification failed")
    if RECAPTCHA_EXPECTED_ACTION and action != RECAPTCHA_EXPECTED_ACTION:
        logger.warning("reCAPTCHA action mismatch: expected=%s actual=%s", RECAPTCHA_EXPECTED_ACTION, action)
        raise HTTPException(status_code=403, detail="Invalid reCAPTCHA action")
    if score < RECAPTCHA_SCORE_THRESHOLD:
        logger.warning("reCAPTCHA score too low: score=%s threshold=%s", score, RECAPTCHA_SCORE_THRESHOLD)
        raise HTTPException(status_code=403, detail="reCAPTCHA score was too low")
    return result


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


@api_router.post("/auth/google")
async def google_login(req: GoogleLoginRequest):
    user = _verify_google_credential(req.credential)
    await _save_google_user(user)
    return {"user": user.model_dump()}


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
    tracks = await list_music_tracks()
    return [
        {
            "id": t["id"],
            "title": t["title"],
            "mood": t["mood"],
            "duration": t["duration"],
            "credit": t["credit"],
            "url": f"/api/music/{t['id']}",
            "categories": t.get("categories", []),
        }
        for t in tracks
    ]


@api_router.get("/music/{music_id}")
async def get_music(music_id: str):
    track = await find_music_track(music_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    path = MUSIC_DIR / track["filename"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Track file missing")
    return FileResponse(path, media_type="audio/mpeg", filename=track["filename"])


@api_router.post("/admin/music")
async def admin_upload_music(
    file: UploadFile = File(...),
    title: str = Form(...),
    mood: str = Form("Uploaded track"),
    credit: str = Form("Uploaded by admin"),
    duration: int = Form(30),
    categories: str = Form(""),
    templateId: str = Form(""),
    _: GoogleUser = Depends(require_admin_user),
):
    filename = file.filename or ""
    if Path(filename).suffix.lower() != ".mp3":
        raise HTTPException(status_code=400, detail="Only MP3 files are supported")
    clean_title = title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Track title is required")
    data = await file.read()
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="MP3 file too large (max 50MB)")
    safe_id = re.sub(r"[^a-z0-9]+", "-", clean_title.lower()).strip("-") or "track"
    track_categories = list(dict.fromkeys(item.strip() for item in categories.split(",") if item.strip()))
    if not track_categories:
        raise HTTPException(status_code=400, detail="Select at least one music category")
    assigned_template = None
    if templateId:
        assigned_template = await db.templates.find_one({"_id": templateId})
        if not assigned_template:
            raise HTTPException(status_code=404, detail="Template not found")
        if assigned_template.get("category") not in track_categories:
            raise HTTPException(status_code=400, detail="Music categories must include the assigned template category")
    music_id = f"{safe_id}-{uuid.uuid4().hex[:8]}"
    stored_filename = f"{music_id}.mp3"
    (MUSIC_DIR / stored_filename).write_bytes(data)
    track = {
        "_id": music_id,
        "id": music_id,
        "title": clean_title,
        "mood": mood.strip() or "Uploaded track",
        "duration": max(1, min(900, int(duration or 30))),
        "credit": credit.strip() or "Uploaded by admin",
        "categories": track_categories,
        "filename": stored_filename,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.music.insert_one(track)
    if templateId:
        await db.templates.update_one(
            {"_id": templateId},
            {"$set": {"defaultMusicId": music_id, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
    return {"track": {**track, "url": f"/api/music/{music_id}"}, "assignedTemplateId": templateId or None}


@api_router.patch("/admin/music/{music_id}")
async def admin_update_music(
    music_id: str,
    req: MusicUpdateRequest,
    _: GoogleUser = Depends(require_admin_user),
):
    current = await find_music_track(music_id)
    if not current:
        raise HTTPException(status_code=404, detail="Track not found")
    categories = list(dict.fromkeys(item.strip() for item in req.categories if item.strip()))
    if not categories:
        raise HTTPException(status_code=400, detail="Select at least one music category")
    existing = await db.music.find_one({"id": music_id})
    if existing:
        await db.music.update_one({"_id": existing["_id"]}, {"$set": {"categories": categories, "updated_at": datetime.now(timezone.utc).isoformat()}})
    else:
        override = dict(current)
        override["_id"] = music_id
        override["id"] = music_id
        override["categories"] = categories
        override["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.music.insert_one(override)
    updated = await find_music_track(music_id)
    return {"id": updated["id"], "title": updated["title"], "mood": updated.get("mood", ""), "duration": updated.get("duration", 0), "credit": updated.get("credit", ""), "categories": updated.get("categories", []), "url": f"/api/music/{music_id}"}


@api_router.get("/templates")
async def list_templates(category: Optional[str] = None):
    filter_query = {"isActive": True}
    if category:
        filter_query["category"] = category
    docs = await db.templates.find(filter_query).to_list(200)
    templates = await _attach_template_render_counts([_serialize_template(d) for d in docs])
    templates.sort(key=lambda t: (t["category"].lower(), t["sortOrder"], t["name"].lower()))
    return templates


@api_router.get("/template-categories")
async def list_template_categories():
    docs = await db.templates.find({"isActive": True}).to_list(200)
    categories = sorted({(d.get("category") or "Wedding") for d in docs})
    return [{"name": category} for category in categories]


@api_router.get("/categories")
async def list_categories():
    """Data-driven category manifest. Categories with a seeded document carry a
    `form` schema (dynamic form); categories that only exist as template tags
    (Wedding/Engagement/Birthday) are returned with `form: null` so the client
    uses its legacy form for them."""
    template_docs = await db.templates.find({"isActive": True}).to_list(200)
    template_category_names = {(d.get("category") or "Wedding") for d in template_docs}

    category_docs = await db.categories.find({"isActive": True}).to_list(200)
    defined = {c["name"]: _serialize_category(c) for c in category_docs}

    legacy_icons = {"Wedding": "💍", "Engagement": "💐", "Birthday": "🎂"}
    result = []
    for name in sorted(template_category_names):
        if name in defined:
            result.append(defined[name])
        else:
            result.append({
                "id": name.lower().replace(" ", "-"),
                "name": name,
                "description": "",
                "icon": legacy_icons.get(name, "✨"),
                "sharedSteps": ["photos", "music"],
                "form": None,
                "relationships": [],
                "isActive": True,
                "sortOrder": 100,
            })
    # Surface any defined category that has no active template yet, so it is not hidden.
    for name, serialized in defined.items():
        if name not in template_category_names:
            result.append(serialized)
    result.sort(key=lambda c: (c["sortOrder"], c["name"].lower()))
    return result


@api_router.get("/admin/templates")
async def admin_list_templates(_: GoogleUser = Depends(require_admin_user)):
    docs = await db.templates.find().to_list(200)
    templates = await _attach_template_render_counts([_serialize_template(d) for d in docs])
    templates.sort(key=lambda t: (t["category"].lower(), t["sortOrder"], t["name"].lower()))
    return templates


@api_router.patch("/admin/templates/{template_id}")
async def admin_update_template(
    template_id: str,
    req: TemplateUpdateRequest,
    _: GoogleUser = Depends(require_admin_user),
):
    existing = await db.templates.find_one({"_id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")

    category = req.category.strip()
    if not category:
        raise HTTPException(status_code=400, detail="Category is required")

    updates = {
        "category": category,
        "isActive": req.isActive,
        "sortOrder": req.sortOrder,
        "defaultMusicId": req.defaultMusicId.strip() if req.defaultMusicId else None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if updates["defaultMusicId"]:
        music_track = await find_music_track(updates["defaultMusicId"])
        if not music_track:
            raise HTTPException(status_code=400, detail="Unknown default music track")
        music_categories = music_track.get("categories", [])
        if music_categories and category not in music_categories:
            raise HTTPException(status_code=400, detail="Default music is not linked to this template category")
    await db.templates.update_one({"_id": template_id}, {"$set": updates})
    updated = await db.templates.find_one({"_id": template_id})
    return (await _attach_template_render_counts([_serialize_template(updated)]))[0]


@api_router.get("/admin/dashboard")
async def admin_dashboard(_: GoogleUser = Depends(require_admin_user)):
    users = await db.users.count_documents({})
    renders = await db.renders.count_documents({})
    queued = await db.renders.count_documents({"status": "queued"})
    rendering = await db.renders.count_documents({"status": "rendering"})
    done = await db.renders.count_documents({"status": "done"})
    failed = await db.renders.count_documents({"status": "failed"})
    active_since = datetime.now(timezone.utc).timestamp() - 15 * 60
    recent_docs = await db.renders.find().sort("created_at", -1).to_list(200)
    live_users = len({d.get("userId") for d in recent_docs if d.get("userId") and d.get("created_at") and datetime.fromisoformat(d["created_at"]).timestamp() >= active_since})
    return {
        "users": users,
        "videos": renders,
        "liveUsers": live_users,
        "renders": {"queued": queued, "rendering": rendering, "done": done, "failed": failed},
        "recent": [
            {"id": d["_id"], "userEmail": d.get("userEmail"), "template": d.get("template"), "status": d.get("status"), "created_at": d.get("created_at")}
            for d in recent_docs[:10]
        ],
    }


@api_router.get("/admin/users")
async def admin_users(_: GoogleUser = Depends(require_admin_user)):
    users = await db.users.find().sort("updated_at", -1).to_list(500)
    result = []
    for user in users:
        user_renders = await db.renders.find({"userId": user["_id"]}).to_list(500)
        result.append({"id": user["_id"], "email": user.get("email"), "name": user.get("name"), "picture": user.get("picture"), "created_at": user.get("created_at"), "updated_at": user.get("updated_at"), "renderCount": len(user_renders), "lastRender": user_renders[-1].get("created_at") if user_renders else None})
    return result


@api_router.get("/admin/renders")
async def admin_renders(_: GoogleUser = Depends(require_admin_user)):
    docs = await db.renders.find().sort("created_at", -1).to_list(500)
    return [{"id": d["_id"], "userId": d.get("userId"), "userEmail": d.get("userEmail"), "template": d.get("template"), "status": d.get("status"), "progress": d.get("progress", 0), "created_at": d.get("created_at"), "finished_at": d.get("finished_at"), "error": d.get("error")} for d in docs]


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
async def create_render(
    req: RenderRequest,
    background: BackgroundTasks,
    request: Request,
    user: GoogleUser = Depends(require_google_user),
):
    if user.azp and user.azp in MOBILE_GOOGLE_CLIENT_IDS:
        recaptcha_result = None
    else:
        recaptcha_result = await verify_recaptcha_token(req.recaptchaToken, request.client.host if request.client else None)
    # Adapter: data-driven categories send a generic `fields` bag and no couple.
    # Derive couple from it (render-service still expects couple) and resolve copy.
    if req.couple is None:
        celebrant = str(req.fields.get("celebrantName") or "").strip()
        sender = str(req.fields.get("senderName") or "").strip()
        req.couple = Couple(partnerOne=celebrant or "Someone", partnerTwo=sender or "Special")
    if not req.eventDate and req.fields.get("eventDate"):
        req.eventDate = str(req.fields.get("eventDate"))

    payload = req.model_dump(exclude={"recaptchaToken"})
    payload["tags"] = list(dict.fromkeys(tag.strip() for tag in req.tags if tag.strip()))[:12]
    payload["resolved"] = resolve_render_copy(req.template, req.category, req.fields)

    effective_music_id = req.musicId
    if not effective_music_id:
        template_doc = await db.templates.find_one({"_id": req.template})
        if template_doc and "defaultMusicId" in template_doc:
            effective_music_id = template_doc.get("defaultMusicId")
        else:
            effective_music_id = "tere-sang"
        payload["musicId"] = effective_music_id

    # Resolve bundled music id -> served url (takes precedence over musicUrl).
    if effective_music_id:
        track = await find_music_track(effective_music_id)
        if not track:
            raise HTTPException(status_code=400, detail=f"Unknown musicId: {effective_music_id}")
        payload["musicUrl"] = f"{INTERNAL_BASE_URL}/api/music/{track['id']}"

    payload['photos'] = [
        f"{INTERNAL_BASE_URL}{p}" if p.startswith('/api/uploads/') else p
        for p in payload['photos']
    ]

    render_id = uuid.uuid4().hex
    doc = {
        "_id": render_id,
        "userId": user.sub,
        "userEmail": user.email,
        "template": req.template,
        "category": req.category,
        "couple": req.couple.model_dump(),
        "fields": req.fields,
        "eventDate": req.eventDate,
        "venue": req.venue.model_dump(),
        "displayMessage": req.displayMessage,
        "durationInSeconds": req.durationInSeconds,
        "tags": payload["tags"],
        "musicId": effective_music_id,
        "status": "queued",
        "progress": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if recaptcha_result is not None:
        doc["recaptcha"] = {
            "score": recaptcha_result.get("score"),
            "action": recaptcha_result.get("action"),
            "hostname": recaptcha_result.get("hostname"),
        }
    await db.renders.insert_one(doc)

    background.add_task(_run_render_job, render_id, payload)

    return {
        "jobId": render_id,
        "status": "queued",
        "poll_url": f"/api/renders/{render_id}",
        "video_url": f"/api/renders/{render_id}/video.mp4",
    }


@api_router.get("/renders")
async def list_renders():
    docs = await db.renders.find().sort("created_at", -1).to_list(50)
    return [
        {
            "id": d["_id"],
            "userId": d.get("userId"),
            "userEmail": d.get("userEmail"),
            "template": d.get("template"),
            "couple": d.get("couple"),
            "eventDate": d.get("eventDate"),
            "displayMessage": d.get("displayMessage"),
            "tags": d.get("tags", []),
            "status": d.get("status", "done"),
            "progress": d.get("progress", 0.0),
            "created_at": d.get("created_at"),
            "finished_at": d.get("finished_at"),
            "video_url": f"/api/renders/{d['_id']}/video.mp4",
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
        "userId": d.get("userId"),
        "userEmail": d.get("userEmail"),
        "template": d.get("template"),
        "couple": d.get("couple"),
        "eventDate": d.get("eventDate"),
        "venue": d.get("venue"),
        "displayMessage": d.get("displayMessage"),
        "tags": d.get("tags", []),
        "status": d.get("status", "done"),
        "progress": d.get("progress", 0.0),
        "error": d.get("error"),
        "created_at": d.get("created_at"),
        "finished_at": d.get("finished_at"),
        "video_url": f"/api/renders/{d['_id']}/video.mp4",
    }


def _stream_file_range(path: Path, start: int, end: int, chunk_size: int = 1024 * 256):
    with path.open("rb") as source:
        source.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            chunk = source.read(min(chunk_size, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@api_router.get("/renders/{render_id}/video")
async def get_render_video(render_id: str, request: Request):
    path = RENDERS_DIR / f"{Path(render_id).name}.mp4"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Video not found")
    size = path.stat().st_size
    common_headers = {
        "Accept-Ranges": "bytes",
        "Content-Disposition": f'inline; filename="invitavideos-{render_id[:8]}.mp4"',
    }
    range_header = request.headers.get("range", "")
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip()) if range_header else None
    if match:
        start_text, end_text = match.groups()
        if not start_text and not end_text:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
        if start_text:
            start = int(start_text)
            end = min(int(end_text), size - 1) if end_text else size - 1
        else:
            suffix_length = min(int(end_text), size)
            start = size - suffix_length
            end = size - 1
        if start >= size or start > end:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
        headers = {
            **common_headers,
            "Content-Range": f"bytes {start}-{end}/{size}",
            "Content-Length": str(end - start + 1),
        }
        return StreamingResponse(
            _stream_file_range(path, start, end),
            status_code=206,
            media_type="video/mp4",
            headers=headers,
        )
    return FileResponse(
        path,
        media_type="video/mp4",
        headers=common_headers,
        content_disposition_type="inline",
    )


@api_router.get("/renders/{render_id}/video.mp4")
async def get_render_video_mp4(render_id: str, request: Request):
    return await get_render_video(render_id, request)


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
        await seed_default_templates()
        await seed_default_categories()
        logger.info("Using in-memory storage")
        return

    try:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=1000)
        await client.admin.command("ping")
        db = client[db_name]
        await db.users.create_index("email")
        await db.users.create_index("googleSub", unique=True)
        await db.renders.create_index("userId")
        await db.renders.create_index("created_at")
        await db.templates.create_index("category")
        await db.templates.create_index("sortOrder")
        await db.music.create_index("id", unique=True)
        await seed_default_templates()
        await seed_default_categories()
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
