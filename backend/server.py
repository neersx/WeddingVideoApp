from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks, Header, Depends, Request
from fastapi.responses import FileResponse, Response, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
from billing import catalog, pricing, wallet
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
import os
import logging
import httpx
import uuid
import asyncio
import re
import ipaddress
import socket
from urllib.parse import urlparse
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone

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

# How long a rendered .mp4 stays downloadable before the background cleanup
# loop deletes it (the render's database record and history are kept).
RENDER_FILE_RETENTION_DAYS = 10
RENDER_CLEANUP_INTERVAL_SECONDS = 3600

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

# Pseudo-track: not a file, a passthrough for a user-supplied public audio URL.
# Selecting it sends musicId="my-music" + customMusicUrl; resolution happens in
# create_render (falls back to the template's admin-set URL, then the bundled
# default, if the user's link is missing or unreachable).
MY_MUSIC_TRACK_ID = "my-music"
MY_MUSIC_TRACK = {
    "id": MY_MUSIC_TRACK_ID,
    "title": "My Music",
    "mood": "Paste a link to your own song",
    "duration": 0,
    "credit": "",
    "categories": [],
    "isCustomUrl": True,
}


async def list_music_tracks():
    """Return bundled tracks plus admin-uploaded tracks persisted in MongoDB."""
    dynamic = await db.music.find().to_list(500)
    overrides = {track.get("id"): track for track in dynamic}
    bundled = [{**track, **overrides[track["id"]]} if track["id"] in overrides else track for track in MUSIC_LIBRARY]
    return [MY_MUSIC_TRACK] + bundled + [track for track in dynamic if track.get("id") not in MUSIC_BY_ID]


async def find_music_track(music_id: str):
    if music_id == MY_MUSIC_TRACK_ID:
        return MY_MUSIC_TRACK
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
        "desc": "A heartfelt, relationship-aware message reel with warm cinematic tones, per-photo messages and a personal sign-off.",
        "category": "Heartfelt",
        "style": "Emotional Cinematic",
        "duration": 30,
        "maxImages": 5,
        "swatch": ["#7A1E3A", "#D98774", "#F1B56B", "#FFF7EA"],
        "bg": "#2A0E1B",
        "text": "#FFF7EA",
        "font": "'Cormorant Garamond', serif",
        # Settings describe what THIS video can render and the limits the form
        # must enforce. Capability-gated fields appear only when supported here.
        "settings": {
            "minImages": 3,
            "maxImages": 5,
            "maxSlides": 5,
            "durations": [10, 20, 30],
            # Shorter reels hold fewer photos. Effective max = this map's value for
            # the chosen duration, falling back to maxImages.
            "imagesPerDuration": {"10": 3, "20": 4, "30": 5},
            "captionPerImage": True,
            "introMessage": {"supported": True, "maxLength": 120},
            "perImageMessage": {"supported": True, "maxLength": 120},
            "finalMessage": {"supported": True, "maxLength": 120},
            "eventDate": {"supported": True},
            "relationship": {"supported": True},
        },
        "isActive": True,
        "sortOrder": 5,
    },
    {
        "_id": "forever-special",
        "id": "forever-special",
        "name": "Forever Special",
        "desc": "A message-first reel in soft rose-gold — each photo holds for a breath before its words rise, alternating between a full-screen reveal and a bottom message panel.",
        "category": "Heartfelt",
        "style": "Emotional Cinematic",
        "duration": 30,
        "maxImages": 5,
        "swatch": ["#3B1220", "#D98F7B", "#F3B6B0", "#FFF7F2"],
        "bg": "#2A1016",
        "text": "#FFF7F2",
        "font": "'Cormorant Garamond', serif",
        # Same settings contract as From My Heart — this template is a visual
        # variant within the same Heartfelt category, not a different form.
        "settings": {
            "minImages": 3,
            "maxImages": 5,
            "maxSlides": 5,
            "durations": [10, 20, 30],
            "imagesPerDuration": {"10": 3, "20": 4, "30": 5},
            "captionPerImage": True,
            "introMessage": {"supported": True, "maxLength": 120},
            "perImageMessage": {"supported": True, "maxLength": 120},
            "finalMessage": {"supported": True, "maxLength": 120},
            "eventDate": {"supported": True},
            "relationship": {"supported": True},
        },
        "isActive": True,
        "sortOrder": 6,
    },
    {
        "_id": "journey",
        "id": "journey",
        "name": "Journey",
        "desc": "A chronological photo-timeline: a full-bleed opening, then each moment as its own captioned chapter with date, closing on a look ahead.",
        "category": "Timeline",
        "style": "Cinematic Timeline",
        "swatch": ["#1A1526", "#6D3B8F", "#C58BD8", "#F3E6C4"],
        "bg": "#1A1526",
        "text": "#F5EEFF",
        "font": "'Cormorant Garamond', serif",
        "settings": {
            # Duration is derived from screen count, not user-picked: each screen
            # (opening + every moment + closing + branding) runs secondsPerScreen.
            "durationMode": "perScreen",
            "secondsPerScreen": 3.5,
            "durations": [],
            "timeline": {"minItems": 3, "maxItems": 12, "fixedScreens": 3},
            # Capabilities enabled for THIS template — the Timeline category's
            # capability-gated fields appear only because these are supported here.
            "eventDate": {"supported": True},
            "introBackgroundImage": {"supported": True},
            "introTitle": {"supported": True, "maxLength": 70},
            "introMessage": {"supported": True, "maxLength": 200},
            "timelineItems": {"supported": True},
            "finalBackgroundImage": {"supported": True},
            "finalTitle": {"supported": True, "maxLength": 70},
            "finalMessage": {"supported": True, "maxLength": 200},
            "relationship": {"supported": True},
            "pricing": {"default": 0, "byDuration": {}},
        },
        "isActive": True,
        "sortOrder": 10,
    },
    {
        "_id": "cascade",
        "id": "cascade",
        "name": "Cascade",
        "desc": "The same chronological timeline as Journey, with a vertical slide — each chapter glides down from the top over the last.",
        "category": "Timeline",
        "style": "Vertical Slide Timeline",
        "swatch": ["#1A1526", "#6D3B8F", "#C58BD8", "#F3E6C4"],
        "bg": "#1A1526",
        "text": "#F5EEFF",
        "font": "'Cormorant Garamond', serif",
        # Identical rules/contract to Journey — only the on-screen transition
        # differs (vertical slide vs. cross-fade). Slides hold a second longer
        # than Journey (3.5s vs 2.5s) so the vertical motion reads less rushed.
        "settings": {
            "durationMode": "perScreen",
            "secondsPerScreen": 3.5,
            "durations": [],
            "timeline": {"minItems": 3, "maxItems": 12, "fixedScreens": 3},
            "eventDate": {"supported": True},
            "introBackgroundImage": {"supported": True},
            "introTitle": {"supported": True, "maxLength": 70},
            "introMessage": {"supported": True, "maxLength": 200},
            "timelineItems": {"supported": True},
            "finalBackgroundImage": {"supported": True},
            "finalTitle": {"supported": True, "maxLength": 70},
            "finalMessage": {"supported": True, "maxLength": 200},
            "relationship": {"supported": True},
            "pricing": {"default": 0, "byDuration": {}},
        },
        "isActive": True,
        "sortOrder": 20,
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


# Occasions for the "Heartfelt" category — a personal message reel can mark any
# of these (or none). Labels double as {{occasion}} copy tokens.
OCCASIONS = {
    "birthday": "Birthday",
    "anniversary": "Anniversary",
    "mothers-day": "Mother's Day",
    "fathers-day": "Father's Day",
    "valentines-day": "Valentine's Day",
    "thank-you": "Thank You",
    "congratulations": "Congratulations",
    "miss-you": "Missing You",
    "just-because": "Just Because",
}


def _occasion_options():
    return [{"value": key, "label": label} for key, label in OCCASIONS.items()]


# Occasions for the "Timeline" category — journeys aren't all relationship-driven
# (travel, graduation, childhood), so this list is broader and the relationship
# field is optional for these. Labels double as {{occasion}} copy tokens.
TIMELINE_OCCASIONS = {
    "birthday": "Birthday",
    "anniversary": "Anniversary",
    "love-story": "Love Story",
    "friendship": "Friendship",
    "childhood-journey": "Childhood Journey",
    "family-memories": "Family Memories",
    "travel-memories": "Travel Memories",
    "graduation": "Graduation",
    "custom": "Custom",
}


def _timeline_occasion_options():
    return [{"value": key, "label": label} for key, label in TIMELINE_OCCASIONS.items()]


_MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def _format_month_year(value) -> str:
    """Turn a stored 'YYYY-MM' month value into a display label ('June 2015').
    Falls back to the raw value if it isn't in that shape."""
    text = str(value or "").strip()
    match = re.fullmatch(r"(\d{4})-(\d{2})", text)
    if not match:
        return text
    year, month = int(match.group(1)), int(match.group(2))
    if 1 <= month <= 12:
        return f"{_MONTH_NAMES[month - 1]} {year}"
    return text


# First-class category documents. A category owns the IDENTITY fields (who the
# video is about); capability-gated fields (marked with "capability") appear only
# when the chosen template supports that capability. Categories without a doc
# here (Wedding/Engagement/Birthday) fall back to the client's legacy form.
DEFAULT_CATEGORY_DOCUMENTS = [
    {
        "_id": "wedding",
        "id": "wedding",
        "name": "Wedding",
        "description": "Classic wedding invitation with couple names, venue and an event schedule.",
        "icon": "💍",
        "sharedSteps": ["photos", "music"],
        "form": {
            "fields": [
                {"key": "partnerOne", "type": "text", "label": "Partner 1", "placeholder": "Aarav", "required": True},
                {"key": "partnerTwo", "type": "text", "label": "Partner 2", "placeholder": "Meera", "required": True},
                {"key": "eventDate", "type": "date", "label": "Event date"},
                {"key": "venueName", "type": "text", "label": "Venue", "placeholder": "The Grand Palace"},
                {"key": "city", "type": "text", "label": "City", "placeholder": "Jaipur"},
                {"key": "message", "type": "textarea", "label": "Message to guests",
                 "placeholder": "Join us as we begin our forever…", "maxLength": 120},
                {"key": "schedule", "type": "repeater", "label": "Event schedule", "max": 6,
                 "itemFields": [
                     {"key": "name", "placeholder": "Haldi"},
                     {"key": "time", "placeholder": "10:00 AM"},
                 ],
                 "default": [
                     {"name": "Haldi", "time": "10:00 AM"},
                     {"name": "Sangeet", "time": "7:00 PM"},
                     {"name": "Wedding", "time": "11:30 AM"},
                 ]},
            ]
        },
        "isActive": True,
        "sortOrder": 10,
    },
    {
        "_id": "engagement",
        "id": "engagement",
        "name": "Engagement",
        "description": "Engagement announcement with couple names, date and venue.",
        "icon": "💐",
        "sharedSteps": ["photos", "music"],
        "form": {
            "fields": [
                {"key": "partnerOne", "type": "text", "label": "Partner 1", "placeholder": "Aarav", "required": True},
                {"key": "partnerTwo", "type": "text", "label": "Partner 2", "placeholder": "Meera", "required": True},
                {"key": "eventDate", "type": "date", "label": "Event date"},
                {"key": "venueName", "type": "text", "label": "Venue", "placeholder": "The Grand Palace"},
                {"key": "city", "type": "text", "label": "City", "placeholder": "Jaipur"},
                {"key": "message", "type": "textarea", "label": "Message to guests",
                 "placeholder": "Celebrate our engagement with us…", "maxLength": 120},
            ]
        },
        "isActive": True,
        "sortOrder": 20,
    },
    {
        "_id": "birthday",
        "id": "birthday",
        "name": "Birthday",
        "description": "Birthday invitation with the celebrant's name, date and venue.",
        "icon": "🎂",
        "sharedSteps": ["photos", "music"],
        "form": {
            "fields": [
                {"key": "firstName", "type": "text", "label": "First name", "placeholder": "Ava", "required": True},
                {"key": "lastName", "type": "text", "label": "Last name", "placeholder": "Sharma"},
                {"key": "eventDate", "type": "date", "label": "Event date"},
                {"key": "venueName", "type": "text", "label": "Venue", "placeholder": "The Grand Palace"},
                {"key": "city", "type": "text", "label": "City", "placeholder": "Jaipur"},
                {"key": "message", "type": "textarea", "label": "Message to guests",
                 "placeholder": "Come celebrate with us…", "maxLength": 120},
            ]
        },
        "isActive": True,
        "sortOrder": 30,
    },
    {
        "_id": "heartfelt",
        "id": "heartfelt",
        "name": "Heartfelt",
        "description": "Personal message reels for the people you love — birthdays, Mother's Day, thank-yous, or just because.",
        "icon": "❤️",
        "sharedSteps": ["photos", "music"],
        "form": {
            "fields": [
                {"key": "celebrantName", "type": "text", "label": "Who is this for?",
                 "placeholder": "Richa", "required": True},
                {"key": "senderName", "type": "text", "label": "Your name",
                 "placeholder": "Neeraj", "required": False},
                {"key": "relationshipType", "type": "select", "label": "Your relationship",
                 "optionsRef": "relationships", "required": True},
                {"key": "occasion", "type": "select", "label": "Occasion",
                 "options": _occasion_options(), "required": False},
                {"key": "eventDate", "type": "date", "label": "Special date",
                 "required": False, "capability": "eventDate"},
                {"key": "introMessage", "type": "textarea", "label": "Opening message",
                 "placeholder": "Happy birthday to someone truly special…",
                 "maxLength": 120, "capability": "introMessage"},
                {"key": "finalMessage", "type": "textarea", "label": "Closing message",
                 "placeholder": "Here's to you, today and always ❤️",
                 "maxLength": 120, "capability": "finalMessage"},
            ]
        },
        "isActive": True,
        "sortOrder": 5,
    },
    {
        "_id": "timeline",
        "id": "timeline",
        "name": "Timeline",
        "description": "Tell a story chapter by chapter — a chronological journey of moments, each with its own photo, date and message.",
        "icon": "🕰️",
        # No shared photos step: every image lives inside the form (opening,
        # per-moment, closing). Music is still a shared step.
        "sharedSteps": ["music"],
        "form": {
            "fields": [
                {"key": "celebrantName", "type": "text", "label": "Who is this timeline for?",
                 "placeholder": "Richa", "required": True, "maxLength": 50},
                {"key": "senderName", "type": "text", "label": "Your name",
                 "placeholder": "Neeraj", "required": False, "maxLength": 50},
                # Optional: journeys like travel/graduation aren't relationship-driven.
                {"key": "relationshipType", "type": "select", "label": "Your relationship (optional)",
                 "optionsRef": "relationships", "required": False},
                {"key": "occasion", "type": "select", "label": "Timeline occasion",
                 "options": _timeline_occasion_options(), "required": True},
                {"key": "customOccasion", "type": "text", "label": "Custom occasion name",
                 "placeholder": "Our First Home", "required": False, "maxLength": 40,
                 "description": "Only used when the occasion above is set to Custom."},
                {"key": "eventDate", "type": "date", "label": "Celebration date (optional)",
                 "required": False, "capability": "eventDate"},
                {"key": "introBackgroundImage", "type": "image", "label": "Opening background image",
                 "required": True, "capability": "introBackgroundImage"},
                {"key": "introTitle", "type": "text", "label": "Opening title",
                 "placeholder": "A Journey Through Beautiful Memories",
                 "required": True, "maxLength": 70, "capability": "introTitle"},
                {"key": "introMessage", "type": "textarea", "label": "Opening message",
                 "placeholder": "Every picture holds a memory, and every memory tells a part of your beautiful story.",
                 "required": False, "maxLength": 200, "capability": "introMessage"},
                {"key": "timelineItems", "type": "repeater", "label": "Timeline moments",
                 "description": "Add 3–12 moments — they're arranged in date order automatically.",
                 "required": True, "minItems": 3, "maxItems": 12,
                 "addButtonLabel": "Add timeline moment", "capability": "timelineItems",
                 "itemFields": [
                     {"key": "backgroundImage", "type": "image", "label": "Background image", "required": True},
                     {"key": "title", "type": "text", "label": "Moment title",
                      "placeholder": "The Day We First Met", "required": True, "maxLength": 65},
                     {"key": "monthYear", "type": "month", "label": "Month and year", "required": True},
                     {"key": "message", "type": "textarea", "label": "Moment message",
                      "placeholder": "A simple hello became the beginning of our most beautiful story.",
                      "required": True, "maxLength": 220},
                 ]},
                {"key": "finalBackgroundImage", "type": "image", "label": "Closing background image",
                 "required": True, "capability": "finalBackgroundImage"},
                {"key": "finalTitle", "type": "text", "label": "Closing title",
                 "placeholder": "And the Story Continues…",
                 "required": True, "maxLength": 70, "capability": "finalTitle"},
                {"key": "finalMessage", "type": "textarea", "label": "Closing message",
                 "placeholder": "Here's to every memory we've created and all the beautiful moments still waiting for us.",
                 "required": True, "maxLength": 200, "capability": "finalMessage"},
            ]
        },
        "isActive": True,
        "sortOrder": 40,
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


class _InMemoryDeleteResult:
    def __init__(self, deleted_count: int):
        self.deleted_count = deleted_count


class _InMemoryCursor:
    def __init__(self, documents):
        self._documents = list(documents)

    def sort(self, key: str, direction: int):
        reverse = direction < 0
        self._documents.sort(key=lambda doc: doc.get(key), reverse=reverse)
        return self

    async def to_list(self, length: int):
        return self._documents[:length]


def _op_match(actual, expected, present=True):
    """Supports the small slice of query operators the billing module (and
    migrations) need ($gte/$gt/$lte/$lt/$ne/$in/$exists) alongside plain
    equality. `present` tells $exists whether the key was actually in the
    document, since a missing key and a key set to None both read as None
    via dict.get()."""
    if isinstance(expected, dict) and any(k.startswith("$") for k in expected):
        for op, value in expected.items():
            if op == "$exists" and bool(value) != present:
                return False
            elif op == "$gte" and not (actual is not None and actual >= value):
                return False
            elif op == "$gt" and not (actual is not None and actual > value):
                return False
            elif op == "$lte" and not (actual is not None and actual <= value):
                return False
            elif op == "$lt" and not (actual is not None and actual < value):
                return False
            elif op == "$ne" and actual == value:
                return False
            elif op == "$in" and actual not in value:
                return False
        return True
    return actual == expected


def _matches(doc, filter_query):
    return all(_op_match(doc.get(key), value, key in doc) for key, value in filter_query.items())


def _apply_update(document, update):
    if "$set" in update:
        document.update(update["$set"])
    if "$inc" in update:
        for key, delta in update["$inc"].items():
            document[key] = document.get(key, 0) + delta
    return document


class _InMemoryCollection:
    def __init__(self, unique_fields=None):
        self._documents = {}
        # Each entry is a tuple of field names enforced as jointly unique
        # across documents, emulating a MongoDB unique index for tests/dev.
        self._unique_fields = unique_fields or []

    def _check_unique(self, document, ignore_id=None):
        for fields in self._unique_fields:
            key = tuple(document.get(f) for f in fields)
            if any(v is None for v in key):
                continue  # sparse: unenforced when any part of the key is absent
            for other_id, other in self._documents.items():
                if other_id == ignore_id:
                    continue
                if tuple(other.get(f) for f in fields) == key:
                    raise DuplicateKeyError(f"duplicate key on {fields}")

    async def insert_one(self, document):
        self._check_unique(document)
        self._documents[document["_id"]] = dict(document)
        return _InMemoryInsertResult(document["_id"])

    async def update_one(self, filter_query, update):
        document = await self.find_one(filter_query)
        if not document:
            return _InMemoryUpdateResult(0)
        _apply_update(document, update)
        self._documents[document["_id"]] = document
        return _InMemoryUpdateResult(1)

    async def find_one_and_update(self, filter_query, update, return_document=None):
        document = await self.find_one(filter_query)
        if not document:
            return None
        _apply_update(document, update)
        self._documents[document["_id"]] = document
        return dict(document)

    async def find_one(self, filter_query):
        document = next(
            (doc for doc in self._documents.values() if _matches(doc, filter_query)),
            None,
        )
        return dict(document) if document else None

    async def delete_one(self, filter_query):
        document = next(
            (doc for doc in self._documents.values() if _matches(doc, filter_query)),
            None,
        )
        if document:
            del self._documents[document["_id"]]
            return _InMemoryDeleteResult(1)
        return _InMemoryDeleteResult(0)

    async def count_documents(self, filter_query):
        return sum(1 for document in self._documents.values() if _matches(document, filter_query))

    def find(self, filter_query=None):
        filter_query = filter_query or {}
        documents = [doc for doc in self._documents.values() if _matches(doc, filter_query)]
        return _InMemoryCursor(documents)

    async def create_index(self, *args, **kwargs):
        return None


class _InMemoryDB:
    def __init__(self):
        self.renders = _InMemoryCollection()
        self.users = _InMemoryCollection()
        self.templates = _InMemoryCollection()
        self.music = _InMemoryCollection()
        self.categories = _InMemoryCollection()
        # --- billing ---
        self.wallets = _InMemoryCollection()
        self.wallet_transactions = _InMemoryCollection(unique_fields=[("idempotencyKey",)])
        self.credit_packs = _InMemoryCollection()
        self.payments = _InMemoryCollection(unique_fields=[("razorpayOrderId",)])
        self.coupons = _InMemoryCollection(unique_fields=[("code",)])
        self.coupon_redemptions = _InMemoryCollection(unique_fields=[("couponId", "userId")])
        self.pack_discounts = _InMemoryCollection()


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


class RenderImage(BaseModel):
    imageUrl: str
    text: str = ""


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
    # Preferred image payload: photo + its caption travel together.
    images: List[RenderImage] = Field(default_factory=list)
    musicUrl: Optional[str] = None
    musicId: Optional[str] = None
    # Set alongside musicId="my-music" when the user pastes their own public
    # audio link. Falls back per-template if missing/unreachable — see
    # resolve_music_url().
    customMusicUrl: Optional[str] = None
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


class TemplateSettingsRequest(BaseModel):
    settings: Dict[str, Any] = Field(default_factory=dict)


class CategoryFormRequest(BaseModel):
    name: str
    description: str = ""
    icon: str = "✨"
    form: Dict[str, Any] = Field(default_factory=dict)
    sharedSteps: List[str] = Field(default_factory=lambda: ["photos", "music"])
    isActive: bool = True
    sortOrder: int = 100


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


DEFAULT_TEMPLATE_DURATIONS = [10, 20, 30]


def _normalized_template_settings(document):
    """Return the template's merged settings, deriving them from legacy fields
    (capabilities / top-level maxImages / duration) for docs seeded before the
    settings object existed."""
    settings = dict(document.get("settings") or {})
    legacy_capabilities = document.get("capabilities") or {}
    for key, value in legacy_capabilities.items():
        settings.setdefault(key, value)
    settings.setdefault("minImages", 1)
    settings.setdefault("maxImages", document.get("maxImages") or 6)
    settings.setdefault("maxSlides", settings["maxImages"])
    settings.setdefault("durations", list(DEFAULT_TEMPLATE_DURATIONS))
    # Normalize the per-duration image map to string keys / int values.
    raw_map = settings.get("imagesPerDuration") or {}
    settings["imagesPerDuration"] = {str(k): int(v) for k, v in raw_map.items() if str(v).strip()}
    per_image = settings.get("perImageMessage") or {}
    settings.setdefault("captionPerImage", bool(per_image.get("supported")))
    # Admin-set fallback for "My Music" when the user's own link is missing or
    # unreachable. Empty by default (falls through to the bundled default track).
    settings.setdefault("customMusicFallbackUrl", "")
    # Credit cost per duration (billing/pricing.py). Defaults to free (0) so
    # templates seeded before pricing existed keep rendering without charge.
    pricing = dict(settings.get("pricing") or {})
    pricing.setdefault("default", 0)
    raw_pricing_map = pricing.get("byDuration") or {}
    pricing["byDuration"] = {str(k): int(v) for k, v in raw_pricing_map.items() if str(v).strip()}
    settings["pricing"] = pricing
    return settings


def _max_images_for_duration(settings, duration):
    """Effective image cap for a chosen duration: the per-duration override if
    present, otherwise the template's overall maxImages."""
    overall = int(settings.get("maxImages") or 6)
    per_duration = settings.get("imagesPerDuration") or {}
    value = per_duration.get(str(int(duration))) if duration is not None else None
    return int(value) if value else overall


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
        # settings is the merged object; capabilities kept as an alias so older
        # clients reading template.capabilities keep working.
        "settings": (settings := _normalized_template_settings(document)),
        "capabilities": settings,
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
            # Backfill the merged settings object onto templates seeded before it
            # existed (migrating any legacy capabilities into it).
            if not existing.get("settings"):
                await db.templates.update_one(
                    {"_id": template["_id"]},
                    {"$set": {"settings": _normalized_template_settings({**existing, **({"settings": template.get("settings")} if template.get("settings") else {})}), "updated_at": now}},
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


async def migrate_heartfelt_rename():
    """One-time rename of the category "From My Heart" -> "Heartfelt" (the
    template keeps its display name). Idempotent: carries any admin edits over
    to the new id, adds the occasion field if missing, and retags templates and
    music tracks that referenced the old category name."""
    now = datetime.now(timezone.utc).isoformat()
    old = await db.categories.find_one({"_id": "from-my-heart"})
    if old:
        if not await db.categories.find_one({"_id": "heartfelt"}):
            doc = dict(old)
            doc["_id"] = "heartfelt"
            doc["id"] = "heartfelt"
            doc["name"] = "Heartfelt"
            doc["description"] = "Personal message reels for the people you love — birthdays, Mother's Day, thank-yous, or just because."
            fields = list(((doc.get("form") or {}).get("fields")) or [])
            if not any(f.get("key") == "occasion" for f in fields):
                rel_index = next((i for i, f in enumerate(fields) if f.get("key") == "relationshipType"), len(fields) - 1)
                fields.insert(rel_index + 1, {"key": "occasion", "type": "select", "label": "Occasion",
                                              "options": _occasion_options(), "required": False})
            doc["form"] = {**(doc.get("form") or {}), "fields": fields}
            doc["updated_at"] = now
            await db.categories.insert_one(doc)
        await db.categories.delete_one({"_id": "from-my-heart"})
    for template in await db.templates.find({"category": "From My Heart"}).to_list(200):
        await db.templates.update_one({"_id": template["_id"]}, {"$set": {"category": "Heartfelt", "updated_at": now}})
    # Backfill the per-duration image cap onto the Heartfelt template if it was
    # seeded before this field existed (seeding is insert-only).
    fmh = await db.templates.find_one({"_id": "from-my-heart-cinematic"})
    if fmh:
        settings = fmh.get("settings") or {}
        if not settings.get("imagesPerDuration"):
            settings["imagesPerDuration"] = {"10": 3, "20": 4, "30": 5}
            await db.templates.update_one({"_id": "from-my-heart-cinematic"}, {"$set": {"settings": settings, "updated_at": now}})
    for track in await db.music.find().to_list(500):
        categories = track.get("categories") or []
        if "From My Heart" in categories:
            await db.music.update_one(
                {"_id": track["_id"]},
                {"$set": {"categories": ["Heartfelt" if c == "From My Heart" else c for c in categories]}},
            )


async def migrate_message_maxlength_120():
    """Unify every message-type text box's default max length at 120 chars.
    Seeding is insert-only, so templates/categories already in the database
    need their existing maxLength values updated directly."""
    now = datetime.now(timezone.utc).isoformat()
    for template_id in ("from-my-heart-cinematic", "forever-special"):
        doc = await db.templates.find_one({"_id": template_id})
        if not doc:
            continue
        settings = dict(doc.get("settings") or {})
        changed = False
        for key in ("introMessage", "perImageMessage", "finalMessage"):
            entry = settings.get(key)
            if isinstance(entry, dict) and entry.get("maxLength") != 120:
                settings[key] = {**entry, "maxLength": 120}
                changed = True
        if changed:
            await db.templates.update_one({"_id": template_id}, {"$set": {"settings": settings, "updated_at": now}})

    for category_id in ("wedding", "engagement", "birthday", "heartfelt"):
        doc = await db.categories.find_one({"_id": category_id})
        if not doc:
            continue
        form = dict(doc.get("form") or {})
        fields = list(form.get("fields") or [])
        changed = False
        for field in fields:
            if field.get("type") == "textarea" and field.get("maxLength") != 120:
                field["maxLength"] = 120
                changed = True
        if changed:
            form["fields"] = fields
            await db.categories.update_one({"_id": category_id}, {"$set": {"form": form, "updated_at": now}})


async def migrate_render_visibility_defaults():
    """Backfill isPublic/isPremium onto renders created before these fields
    existed: free renders default public, paid ("premium") renders default
    private — same rule create_render applies to new renders."""
    docs = await db.renders.find({"isPublic": {"$exists": False}}).to_list(10000)
    for doc in docs:
        is_premium = bool(doc.get("paid") or doc.get("creditCost", 0) > 0)
        await db.renders.update_one(
            {"_id": doc["_id"]},
            {"$set": {"isPremium": is_premium, "isPublic": not is_premium}},
        )


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


def resolve_template_form(template_doc, category_doc):
    """Merge a category's form schema with a template's settings into the final,
    ready-to-render form manifest. Single source of truth: served to clients via
    GET /templates/{id}/form AND used by create_render for validation, so the
    form users see and the rules the server enforces can never drift."""
    template_doc = template_doc or {}
    category_doc = category_doc or {}
    settings = _normalized_template_settings(template_doc)

    fields_out = []
    for field in ((category_doc.get("form") or {}).get("fields") or []):
        capability = field.get("capability")
        cap_entry = settings.get(capability) if capability else None
        if capability:
            supported = bool(cap_entry.get("supported")) if isinstance(cap_entry, dict) else bool(cap_entry)
            if not supported:
                continue
        resolved = {k: v for k, v in field.items() if k != "capability"}
        if isinstance(cap_entry, dict) and cap_entry.get("maxLength") and not resolved.get("maxLength"):
            resolved["maxLength"] = int(cap_entry["maxLength"])
        if resolved.get("optionsRef") == "relationships":
            resolved.pop("optionsRef", None)
            resolved["options"] = _relationship_options()
        fields_out.append(resolved)

    per_image = settings.get("perImageMessage") or {}
    shared_steps = category_doc.get("sharedSteps") or ["photos", "music"]
    # Duration is either user-picked (default) or derived from screen count
    # ("perScreen", used by the Timeline/Journey template) — the client reads
    # durationMode to decide whether to show a length picker.
    duration_mode = settings.get("durationMode") or "pick"
    return {
        "templateId": template_doc.get("id") or template_doc.get("_id"),
        "category": category_doc.get("name") or template_doc.get("category", ""),
        "hasForm": bool(category_doc.get("form")),
        "settings": settings,
        "steps": {
            "details": {
                "fields": fields_out,
                "durations": [int(d) for d in (settings.get("durations") or DEFAULT_TEMPLATE_DURATIONS)],
                "durationMode": duration_mode,
                "secondsPerScreen": float(settings.get("secondsPerScreen") or 2.5),
                "timeline": settings.get("timeline") or {},
                # Credit cost per duration (billing/pricing.py) so the client can
                # show a price badge per option without a separate round-trip.
                "pricing": settings.get("pricing") or {"default": 0, "byDuration": {}},
            },
            "photos": {
                "enabled": "photos" in shared_steps,
                "minImages": int(settings.get("minImages") or 1),
                "maxImages": int(settings.get("maxImages") or 6),
                "imagesPerDuration": settings.get("imagesPerDuration") or {},
                "captionPerImage": bool(settings.get("captionPerImage")),
                "captionMaxLength": int(per_image.get("maxLength") or 120) if isinstance(per_image, dict) else 120,
            },
            "music": {"enabled": "music" in shared_steps},
        },
    }


def resolve_render_copy(template: str, category: str, fields: Dict[str, Any]) -> Dict[str, Any]:
    """Resolve relationship terms and substitute {{tokens}} in user copy — done
    once here so every relationship-driven template renders personalized strings
    without reimplementing token logic."""
    fields = fields or {}
    rel = RELATIONSHIPS.get(str(fields.get("relationshipType") or ""), {})
    occasion_key = str(fields.get("occasion") or "")
    # Timeline occasions include a "Custom" free-text choice; everything else
    # resolves via one of the occasion catalogs.
    if occasion_key == "custom":
        occasion_label = str(fields.get("customOccasion") or "").strip()
    else:
        occasion_label = OCCASIONS.get(occasion_key) or TIMELINE_OCCASIONS.get(occasion_key, "")
    ctx = {
        "celebrantName": str(fields.get("celebrantName") or "").strip(),
        "senderName": str(fields.get("senderName") or "").strip(),
        "recipientTerm": rel.get("recipientTerm", ""),
        "senderTerm": rel.get("senderTerm", ""),
        "recipientPronoun": rel.get("recipientPronoun", "their"),
        "occasion": occasion_label,
    }

    def fill(text: str) -> str:
        if not text:
            return ""
        for key, value in ctx.items():
            text = text.replace("{{" + key + "}}", value)
        return text

    photo_messages = [fill(m) for m in (fields.get("photoMessages") or []) if isinstance(m, str)]
    result = {
        **ctx,
        "relationshipLabel": rel.get("label", ""),
        "occasionLabel": occasion_label,
        "introMessage": fill(str(fields.get("introMessage") or "")),
        "finalMessage": fill(str(fields.get("finalMessage") or "")),
        "photoMessages": photo_messages,
    }

    # Timeline: build the ready-to-render, chronologically-sorted payload. The
    # opening always renders first and the closing last; only the moments in
    # between are date-sorted (by the stored YYYY-MM value). Image URLs are
    # already absolute here (rewritten in create_render before this runs).
    if category == "Timeline":
        moments = []
        for item in (fields.get("timelineItems") or []):
            if not isinstance(item, dict):
                continue
            month_year = str(item.get("monthYear") or "")
            moments.append({
                "backgroundImage": str(item.get("backgroundImage") or ""),
                "title": fill(str(item.get("title") or "")),
                "monthYear": _format_month_year(month_year),
                "message": fill(str(item.get("message") or "")),
                "_sort": month_year,
            })
        moments.sort(key=lambda m: m["_sort"])
        for m in moments:
            m.pop("_sort", None)
        result["timeline"] = {
            "opening": {
                "backgroundImage": str(fields.get("introBackgroundImage") or ""),
                "title": fill(str(fields.get("introTitle") or "")),
                "message": fill(str(fields.get("introMessage") or "")),
            },
            "items": moments,
            "closing": {
                "backgroundImage": str(fields.get("finalBackgroundImage") or ""),
                "title": fill(str(fields.get("finalTitle") or "")),
                "message": fill(str(fields.get("finalMessage") or "")),
            },
        }
    return result


def _is_public_https_url(url: str) -> bool:
    """Reject anything that isn't a plain https:// link to a public host —
    the first line of defense before the server fetches a user-supplied URL."""
    try:
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.hostname:
            return False
        for info in socket.getaddrinfo(parsed.hostname, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
        return True
    except Exception:  # noqa: BLE001
        return False


async def _check_music_url_reachable(url: str) -> bool:
    """SSRF-safe reachability check for a user-supplied music URL: public
    https host, then a quick HEAD (falling back to a small ranged GET, since
    some hosts don't support HEAD) with a short timeout so a slow/dead link
    can't stall the render request."""
    if not _is_public_https_url(url):
        return False
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5, connect=3), follow_redirects=True) as hc:
            resp = await hc.head(url)
            if resp.status_code >= 400:
                resp = await hc.get(url, headers={"Range": "bytes=0-2048"})
            return resp.status_code < 400
    except Exception:  # noqa: BLE001
        return False


async def resolve_music_url(template_settings: Dict[str, Any], music_id: Optional[str], custom_url: Optional[str]) -> Dict[str, Any]:
    """Resolve the "My Music" pseudo-track to a playable URL, or say it isn't
    in play at all. Chain: the user's own link (if given and reachable) ->
    the template's admin-set fallback link (if set and reachable) -> signal
    the caller to fall through to the template's normal bundled default."""
    if music_id != MY_MUSIC_TRACK_ID:
        return {"active": False}
    if custom_url and await _check_music_url_reachable(custom_url):
        return {"active": True, "url": custom_url, "source": "custom"}
    fallback_url = (template_settings.get("customMusicFallbackUrl") or "").strip()
    if fallback_url and await _check_music_url_reachable(fallback_url):
        return {"active": True, "url": fallback_url, "source": "template_fallback"}
    return {"active": True, "url": None, "source": "bundled_default"}


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
            # The "My Music" pseudo-track has no bundled file — clients show a
            # URL input instead of a play-preview button when this is set.
            "isCustomUrl": bool(t.get("isCustomUrl")),
            "url": None if t.get("isCustomUrl") else f"/api/music/{t['id']}",
            "categories": t.get("categories", []),
        }
        for t in tracks
    ]


@api_router.get("/music/{music_id}")
async def get_music(music_id: str):
    track = await find_music_track(music_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    if track.get("isCustomUrl"):
        raise HTTPException(status_code=400, detail="This track has no bundled file")
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


@api_router.get("/templates/{template_id}/form")
async def get_template_form(template_id: str):
    """Resolved form manifest for a template: category fields gated and merged
    with the template's settings. Called by clients when a template is selected."""
    template_doc = await db.templates.find_one({"_id": template_id})
    if not template_doc:
        raise HTTPException(status_code=404, detail="Template not found")
    category_doc = await db.categories.find_one({"name": template_doc.get("category", "")})
    return resolve_template_form(template_doc, category_doc)


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


@api_router.patch("/admin/templates/{template_id}/settings")
async def admin_update_template_settings(
    template_id: str,
    req: TemplateSettingsRequest,
    _: GoogleUser = Depends(require_admin_user),
):
    existing = await db.templates.find_one({"_id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    settings = dict(req.settings or {})
    # Basic sanity checks so a typo can't brick the create flow.
    max_images = int(settings.get("maxImages") or 0)
    if max_images < 1 or max_images > 12:
        raise HTTPException(status_code=400, detail="maxImages must be between 1 and 12")
    max_slides = int(settings.get("maxSlides") or 0)
    if max_slides < 1 or max_slides > 24:
        raise HTTPException(status_code=400, detail="maxSlides must be between 1 and 24")
    durations = settings.get("durations") or []
    if not isinstance(durations, list) or not durations or not all(isinstance(d, (int, float)) and 5 <= int(d) <= 60 for d in durations):
        raise HTTPException(status_code=400, detail="durations must be a non-empty list of seconds between 5 and 60")
    settings["durations"] = sorted({int(d) for d in durations})
    settings["captionPerImage"] = bool(settings.get("captionPerImage"))
    # Per-duration image caps: keys must be allowed durations, values 1..maxImages.
    per_duration_raw = settings.get("imagesPerDuration") or {}
    if not isinstance(per_duration_raw, dict):
        raise HTTPException(status_code=400, detail="imagesPerDuration must be a mapping of duration to image count")
    per_duration = {}
    for key, value in per_duration_raw.items():
        if str(value).strip() == "":
            continue
        try:
            d, n = int(key), int(value)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="imagesPerDuration must contain whole numbers")
        if d not in settings["durations"]:
            raise HTTPException(status_code=400, detail=f"imagesPerDuration has a duration ({d}) not in the allowed durations")
        if n < 1 or n > max_images:
            raise HTTPException(status_code=400, detail=f"imagesPerDuration[{d}] must be between 1 and maxImages ({max_images})")
        per_duration[str(d)] = n
    settings["imagesPerDuration"] = per_duration
    # Credit cost per duration: default must be a non-negative int, and every
    # keyed override must reference an allowed duration (same shape/rules as
    # imagesPerDuration above, since pricing is dynamic-duration-aware too).
    pricing_raw = settings.get("pricing") or {}
    if not isinstance(pricing_raw, dict):
        raise HTTPException(status_code=400, detail="pricing must be an object with 'default' and 'byDuration'")
    try:
        pricing_default = int(pricing_raw.get("default", 0))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="pricing.default must be a whole number of credits")
    if pricing_default < 0:
        raise HTTPException(status_code=400, detail="pricing.default must be 0 or more credits")
    by_duration_raw = pricing_raw.get("byDuration") or {}
    if not isinstance(by_duration_raw, dict):
        raise HTTPException(status_code=400, detail="pricing.byDuration must be a mapping of duration to credit cost")
    by_duration = {}
    for key, value in by_duration_raw.items():
        if str(value).strip() == "":
            continue
        try:
            d, cost = int(key), int(value)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="pricing.byDuration must contain whole numbers")
        if d not in settings["durations"]:
            raise HTTPException(status_code=400, detail=f"pricing.byDuration has a duration ({d}) not in the allowed durations")
        if cost < 0:
            raise HTTPException(status_code=400, detail=f"pricing.byDuration[{d}] must be 0 or more credits")
        by_duration[str(d)] = cost
    settings["pricing"] = {"default": pricing_default, "byDuration": by_duration}
    # Fallback URL for "My Music": optional, but if set it must at least look
    # like a fetchable public link — the real reachability check happens at
    # render time (a link that's fine today might go dead later).
    fallback_url = str(settings.get("customMusicFallbackUrl") or "").strip()
    if fallback_url and not fallback_url.startswith("https://"):
        raise HTTPException(status_code=400, detail="customMusicFallbackUrl must start with https://")
    settings["customMusicFallbackUrl"] = fallback_url
    await db.templates.update_one(
        {"_id": template_id},
        {"$set": {"settings": settings, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    updated = await db.templates.find_one({"_id": template_id})
    return (await _attach_template_render_counts([_serialize_template(updated)]))[0]


@api_router.get("/admin/categories")
async def admin_list_categories(_: GoogleUser = Depends(require_admin_user)):
    docs = await db.categories.find().to_list(200)
    categories = [_serialize_category(d) for d in docs]
    categories.sort(key=lambda c: (c["sortOrder"], c["name"].lower()))
    return categories


@api_router.post("/admin/categories")
async def admin_create_category(req: CategoryFormRequest, _: GoogleUser = Depends(require_admin_user)):
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Category name is required")
    category_id = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if not category_id:
        raise HTTPException(status_code=400, detail="Category name must contain letters or numbers")
    if await db.categories.find_one({"_id": category_id}):
        raise HTTPException(status_code=409, detail="A category with this name already exists")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "_id": category_id,
        "id": category_id,
        "name": name,
        "description": req.description.strip(),
        "icon": req.icon or "✨",
        "sharedSteps": req.sharedSteps or ["photos", "music"],
        "form": req.form or {"fields": []},
        "isActive": req.isActive,
        "sortOrder": req.sortOrder,
        "created_at": now,
        "updated_at": now,
    }
    await db.categories.insert_one(doc)
    return _serialize_category(doc)


@api_router.patch("/admin/categories/{category_id}")
async def admin_update_category(category_id: str, req: CategoryFormRequest, _: GoogleUser = Depends(require_admin_user)):
    existing = await db.categories.find_one({"_id": category_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")
    updates = {
        "name": req.name.strip() or existing.get("name"),
        "description": req.description.strip(),
        "icon": req.icon or "✨",
        "sharedSteps": req.sharedSteps or ["photos", "music"],
        "form": req.form or {"fields": []},
        "isActive": req.isActive,
        "sortOrder": req.sortOrder,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.categories.update_one({"_id": category_id}, {"$set": updates})
    updated = await db.categories.find_one({"_id": category_id})
    return _serialize_category(updated)


@api_router.delete("/admin/categories/{category_id}")
async def admin_delete_category(category_id: str, _: GoogleUser = Depends(require_admin_user)):
    existing = await db.categories.find_one({"_id": category_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.categories.delete_one({"_id": category_id})
    return {"deleted": category_id}


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
async def admin_renders(
    page: int = 1,
    pageSize: int = 50,
    status: Optional[str] = None,
    dateFrom: Optional[str] = None,
    dateTo: Optional[str] = None,
    _: GoogleUser = Depends(require_admin_user),
):
    page = max(1, page)
    pageSize = max(1, min(200, pageSize))
    filter_query: Dict[str, Any] = {}
    if status:
        filter_query["status"] = status
    if dateFrom or dateTo:
        # created_at is stored as an ISO 8601 string, which sorts/compares
        # lexicographically the same as chronologically — plain string
        # bounds work without parsing, on both storage backends.
        date_range: Dict[str, Any] = {}
        if dateFrom:
            date_range["$gte"] = dateFrom if len(dateFrom) > 10 else f"{dateFrom}T00:00:00"
        if dateTo:
            date_range["$lte"] = dateTo if len(dateTo) > 10 else f"{dateTo}T23:59:59.999999"
        filter_query["created_at"] = date_range

    total = await db.renders.count_documents(filter_query)
    all_matching = await db.renders.find(filter_query).sort("created_at", -1).to_list(100000)
    start = (page - 1) * pageSize
    docs = all_matching[start:start + pageSize]

    templates_by_id = {t["_id"]: t for t in await db.templates.find().to_list(1000)}
    items = [
        {
            "id": d["_id"],
            "userId": d.get("userId"),
            "userEmail": d.get("userEmail"),
            "template": d.get("template"),
            "templateName": templates_by_id.get(d.get("template"), {}).get("name", d.get("template")),
            "category": d.get("category"),
            "durationInSeconds": d.get("durationInSeconds"),
            "status": d.get("status"),
            "progress": d.get("progress", 0),
            "created_at": d.get("created_at"),
            "finished_at": d.get("finished_at"),
            "error": d.get("error"),
            "video_url": _render_video_url(d),
            "isPublic": bool(d.get("isPublic", False)),
            "isPremium": bool(d.get("isPremium", False)),
        }
        for d in docs
    ]
    return {"items": items, "total": total, "page": page, "pageSize": pageSize}


class AdminRenderUpdateRequest(BaseModel):
    videoUrl: Optional[str] = None
    isPublic: Optional[bool] = None
    isPremium: Optional[bool] = None


@api_router.patch("/admin/renders/{render_id}")
async def admin_update_render(
    render_id: str,
    req: AdminRenderUpdateRequest,
    _: GoogleUser = Depends(require_admin_user),
):
    existing = await db.renders.find_one({"_id": render_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Render not found")
    update: Dict[str, Any] = {}
    if req.videoUrl is not None:
        video_url = req.videoUrl.strip()
        if video_url and not (video_url.startswith("http://") or video_url.startswith("https://") or video_url.startswith("/")):
            raise HTTPException(status_code=400, detail="videoUrl must be an absolute URL or an absolute path")
        # Empty string clears the override, reverting to our own streaming endpoint.
        update["videoUrlOverride"] = video_url or None
    if req.isPublic is not None:
        update["isPublic"] = bool(req.isPublic)
    if req.isPremium is not None:
        update["isPremium"] = bool(req.isPremium)
    if update:
        await db.renders.update_one({"_id": render_id}, {"$set": update})
    updated = await db.renders.find_one({"_id": render_id})
    return {
        "id": updated["_id"],
        "video_url": _render_video_url(updated),
        "isPublic": bool(updated.get("isPublic", False)),
        "isPremium": bool(updated.get("isPremium", False)),
    }


async def _run_render_job(job_id: str, payload: dict, user_id: Optional[str] = None, credit_cost: int = 0):
    """Background worker: dispatch to render-service, poll progress, download mp4, update Mongo doc.

    Any credits reserved for this job (see create_render) are settled exactly
    once in the `finally` block below, based on the render doc's final status
    — capture on "done", release (refund) otherwise — regardless of which of
    the several return points below the job exits through."""
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
                    finished_at = datetime.now(timezone.utc)
                    await current_db.renders.update_one(
                        {"_id": job_id},
                        {"$set": {
                            "status": "done",
                            "progress": 1.0,
                            "size_bytes": len(dl.content),
                            "finished_at": finished_at.isoformat(),
                            # The downloadable file is deleted RENDER_FILE_RETENTION_DAYS
                            # after it becomes available — see _cleanup_expired_renders().
                            "expiresAt": (finished_at + timedelta(days=RENDER_FILE_RETENTION_DAYS)).isoformat(),
                            "fileRemoved": False,
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
    finally:
        if credit_cost > 0 and user_id:
            final_doc = await db.renders.find_one({"_id": job_id})
            final_status = (final_doc or {}).get("status")
            if final_status == "done":
                await wallet.capture(db, user_id, job_id)
            else:
                await wallet.release(db, user_id, job_id)


async def _cleanup_expired_renders():
    """Deletes the on-disk .mp4 for any render whose expiresAt has passed.
    The database record is kept (My Downloads still lists it, marked
    expired) — only the large binary file is removed."""
    now = datetime.now(timezone.utc).isoformat()
    candidates = await db.renders.find({"status": "done", "fileRemoved": {"$ne": True}}).to_list(1000)
    for doc in candidates:
        expires_at = doc.get("expiresAt")
        if not expires_at or expires_at > now:
            continue
        path = RENDERS_DIR / f"{doc['_id']}.mp4"
        try:
            path.unlink(missing_ok=True)
        except OSError:
            logger.exception("failed to delete expired render file for %s", doc["_id"])
            continue
        await db.renders.update_one({"_id": doc["_id"]}, {"$set": {"fileRemoved": True}})


async def _expiry_cleanup_loop():
    while True:
        try:
            await _cleanup_expired_renders()
        except Exception:  # noqa: BLE001
            logger.exception("render expiry cleanup pass failed")
        await asyncio.sleep(RENDER_CLEANUP_INTERVAL_SECONDS)


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
    template_doc = await db.templates.find_one({"_id": req.template})
    category_doc = await db.categories.find_one({"name": (template_doc or {}).get("category", "")})
    # The same manifest the client rendered its form from — form and validation
    # cannot drift because both come from resolve_template_form.
    form_manifest = resolve_template_form(template_doc, category_doc)
    template_settings = form_manifest["settings"]
    photos_step = form_manifest["steps"]["photos"]

    # Preferred payload: images[{imageUrl,text}]. Unpack into photos[] (render
    # service contract) and photoMessages (caption resolution) keeping pairs aligned.
    if req.images:
        req.photos = [image.imageUrl for image in req.images]
        cap_len = photos_step["captionMaxLength"]
        req.fields = {**(req.fields or {}), "photoMessages": [image.text[:cap_len] for image in req.images]}

    # Duration: either derived from screen count ("perScreen", Timeline/Journey)
    # or a user pick validated against the template's allowed durations.
    duration_mode = template_settings.get("durationMode")
    if duration_mode == "perScreen":
        timeline_settings = template_settings.get("timeline") or {}
        min_items = int(timeline_settings.get("minItems") or 1)
        max_items = int(timeline_settings.get("maxItems") or 12)
        fixed_screens = int(timeline_settings.get("fixedScreens") or 3)
        seconds_per_screen = float(template_settings.get("secondsPerScreen") or 2.5)
        items = [it for it in ((req.fields or {}).get("timelineItems") or []) if isinstance(it, dict)]
        if len(items) < min_items:
            raise HTTPException(status_code=400, detail=f"Add at least {min_items} timeline moments")
        if len(items) > max_items:
            raise HTTPException(status_code=400, detail=f"A timeline can have at most {max_items} moments")
        total_screens = len(items) + fixed_screens
        # Server is authoritative: recompute the length so a tampered client
        # value can't stretch/shrink the video off its per-screen budget.
        req.durationInSeconds = int(round(min(60, max(5, total_screens * seconds_per_screen))))
    else:
        allowed_durations = form_manifest["steps"]["details"]["durations"]
        if allowed_durations and req.durationInSeconds not in allowed_durations:
            raise HTTPException(status_code=400, detail=f"Duration must be one of {allowed_durations} seconds for this template")
    max_images = _max_images_for_duration(template_settings, req.durationInSeconds)
    if len(req.photos) > max_images:
        raise HTTPException(status_code=400, detail=f"At {req.durationInSeconds} seconds this template accepts at most {max_images} images")

    # When the template requires a caption per photo, every photo must carry a
    # non-empty message — regardless of whether it arrived via images[] or a
    # fields.photoMessages array, so no client submission path can bypass this.
    if photos_step["captionPerImage"] and req.photos:
        captions = (req.fields or {}).get("photoMessages") or []
        if len(captions) < len(req.photos) or any(not str(c).strip() for c in captions[: len(req.photos)]):
            raise HTTPException(status_code=400, detail="Each photo needs a message for this template")

    # Data-driven submissions (fields/images payload): enforce required fields
    # and maxLength limits from the manifest. Legacy couple-shaped payloads skip
    # this — their category form is not what they submitted against.
    if req.fields or req.images:
        for field in form_manifest["steps"]["details"]["fields"]:
            key = field.get("key")
            if not key:
                continue
            value = req.fields.get(key)
            if field.get("type") == "repeater":
                # Validate each row against the repeater's own required itemFields,
                # and truncate over-long text subfields. (Row count is enforced by
                # the perScreen block above for Timeline.)
                rows = value if isinstance(value, list) else []
                if field.get("required") and not rows:
                    raise HTTPException(status_code=400, detail=f"'{field.get('label') or key}' needs at least one entry")
                for row_index, row in enumerate(rows):
                    if not isinstance(row, dict):
                        continue
                    for item_field in field.get("itemFields") or []:
                        item_key = item_field.get("key")
                        if not item_key:
                            continue
                        item_value = row.get(item_key)
                        if item_field.get("required") and not (isinstance(item_value, str) and item_value.strip()):
                            raise HTTPException(status_code=400, detail=f"{field.get('label') or key} #{row_index + 1}: '{item_field.get('label') or item_key}' is required")
                        item_max = item_field.get("maxLength")
                        if item_max and isinstance(item_value, str) and len(item_value) > int(item_max):
                            row[item_key] = item_value[: int(item_max)]
                continue
            if field.get("required") and (value is None or (isinstance(value, str) and not value.strip())):
                raise HTTPException(status_code=400, detail=f"'{field.get('label') or key}' is required")
            max_length = field.get("maxLength")
            if max_length and isinstance(value, str) and len(value) > int(max_length):
                req.fields[key] = value[: int(max_length)]

    # Make image URLs inside the fields bag absolute for the render service (a
    # separate process). Only the flat photos[] array is rewritten elsewhere;
    # Timeline's images live in fields (opening/closing + per-moment), so rewrite
    # them here — a no-op for categories without these keys.
    if req.fields:
        def _absolutize(url):
            return f"{INTERNAL_BASE_URL}{url}" if isinstance(url, str) and url.startswith("/api/uploads/") else url
        for image_key in ("introBackgroundImage", "finalBackgroundImage"):
            if req.fields.get(image_key):
                req.fields[image_key] = _absolutize(req.fields[image_key])
        timeline_rows = req.fields.get("timelineItems")
        if isinstance(timeline_rows, list):
            for row in timeline_rows:
                if isinstance(row, dict) and row.get("backgroundImage"):
                    row["backgroundImage"] = _absolutize(row["backgroundImage"])

    # Adapter: data-driven categories send a generic `fields` bag instead of the
    # wedding-shaped payload. Map it onto couple/venue/schedule/message/eventDate
    # so the existing Remotion templates keep rendering unchanged.
    f = req.fields or {}
    if req.couple is None:
        # partnerOne/Two (Wedding, Engagement) | firstName/lastName (Birthday) | celebrant/sender (From My Heart)
        p1 = str(f.get("partnerOne") or f.get("firstName") or f.get("celebrantName") or "").strip()
        p2 = str(f.get("partnerTwo") or f.get("lastName") or f.get("senderName") or "").strip()
        req.couple = Couple(partnerOne=p1 or "Someone", partnerTwo=p2 or "Special")
    if not req.eventDate and f.get("eventDate"):
        req.eventDate = str(f.get("eventDate"))
    if (not req.venue or (not req.venue.name and not req.venue.city)) and (f.get("venueName") or f.get("city")):
        req.venue = Venue(name=str(f.get("venueName") or ""), city=str(f.get("city") or ""))
    if not req.message and f.get("message"):
        req.message = str(f.get("message"))
    if not req.schedule and isinstance(f.get("schedule"), list):
        req.schedule = [
            ScheduleItem(name=str(item.get("name", "")), time=str(item.get("time", "")))
            for item in f["schedule"] if isinstance(item, dict) and (item.get("name") or item.get("time"))
        ]

    payload = req.model_dump(exclude={"recaptchaToken"})
    payload["tags"] = list(dict.fromkeys(tag.strip() for tag in req.tags if tag.strip()))[:12]
    payload["resolved"] = resolve_render_copy(req.template, req.category, req.fields)
    payload["settings"] = template_settings

    effective_music_id = req.musicId
    if not effective_music_id:
        if template_doc and "defaultMusicId" in template_doc:
            effective_music_id = template_doc.get("defaultMusicId")
        else:
            effective_music_id = "tere-sang"
        payload["musicId"] = effective_music_id

    music_source = "bundled"
    if effective_music_id == MY_MUSIC_TRACK_ID:
        # User-supplied link -> template's admin-set fallback -> bundled default.
        custom_resolution = await resolve_music_url(template_settings, effective_music_id, req.customMusicUrl)
        if custom_resolution["url"]:
            payload["musicUrl"] = custom_resolution["url"]
            music_source = custom_resolution["source"]
        else:
            music_source = "bundled_default"
            effective_music_id = (template_doc or {}).get("defaultMusicId") or "tere-sang"

    if music_source != "custom" and music_source != "template_fallback":
        track = await find_music_track(effective_music_id)
        if not track:
            raise HTTPException(status_code=400, detail=f"Unknown musicId: {effective_music_id}")
        payload["musicUrl"] = f"{INTERNAL_BASE_URL}/api/music/{track['id']}"

    payload['photos'] = [
        f"{INTERNAL_BASE_URL}{p}" if p.startswith('/api/uploads/') else p
        for p in payload['photos']
    ]
    payload["musicId"] = effective_music_id

    render_id = uuid.uuid4().hex

    # Credit gate: reserved here, last, after every other validation that can
    # raise has already run — so a rejected/failed request never leaves a
    # dangling hold. Settled (captured or released) by _run_render_job once
    # the job finishes.
    credit_cost = pricing.cost_in_credits(template_settings, req.durationInSeconds)
    if credit_cost > 0:
        try:
            await wallet.reserve(db, user.sub, credit_cost, render_id)
        except wallet.InsufficientCreditsError as exc:
            raise HTTPException(
                status_code=402,
                detail={
                    "message": f"This {req.durationInSeconds}s video costs {credit_cost} credits; you have {exc.balance}.",
                    "required": credit_cost,
                    "balance": exc.balance,
                },
            )

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
        "musicSource": music_source,
        "status": "queued",
        "progress": 0.0,
        "creditCost": credit_cost,
        "paid": credit_cost > 0,
        # Free renders are public by default; paid ("premium") renders default
        # private — an admin can flip either independently in Video Renders.
        "isPremium": credit_cost > 0,
        "isPublic": credit_cost == 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if recaptcha_result is not None:
        doc["recaptcha"] = {
            "score": recaptcha_result.get("score"),
            "action": recaptcha_result.get("action"),
            "hostname": recaptcha_result.get("hostname"),
        }
    await db.renders.insert_one(doc)

    background.add_task(_run_render_job, render_id, payload, user.sub, credit_cost)

    return {
        "jobId": render_id,
        "status": "queued",
        "poll_url": f"/api/renders/{render_id}",
        "video_url": f"/api/renders/{render_id}/video.mp4",
        "creditCost": credit_cost,
    }


def _render_video_url(d: dict) -> str:
    """The render's playable URL — an admin-set override (see PATCH
    /admin/renders/{id}) if present, otherwise our own streaming endpoint."""
    override = (d.get("videoUrlOverride") or "").strip()
    return override or f"/api/renders/{d['_id']}/video.mp4"


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
            "video_url": _render_video_url(d),
        }
        for d in docs
    ]


@api_router.get("/renders/mine")
async def list_my_renders(user: GoogleUser = Depends(require_google_user)):
    """Backs the "My Downloads" page. Registered before /renders/{render_id}
    so "mine" is never matched as a render id."""
    docs = await db.renders.find({"userId": user.sub}).sort("created_at", -1).to_list(200)
    return [
        {
            "id": d["_id"],
            "template": d.get("template"),
            "category": d.get("category"),
            "status": d.get("status", "done"),
            "progress": d.get("progress", 0.0),
            "durationInSeconds": d.get("durationInSeconds"),
            "creditCost": d.get("creditCost", 0),
            "created_at": d.get("created_at"),
            "finished_at": d.get("finished_at"),
            "expiresAt": d.get("expiresAt"),
            "expired": bool(d.get("fileRemoved")),
            "video_url": _render_video_url(d),
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
        "category": d.get("category"),
        "couple": d.get("couple"),
        "fields": d.get("fields"),
        "eventDate": d.get("eventDate"),
        "venue": d.get("venue"),
        "displayMessage": d.get("displayMessage"),
        "tags": d.get("tags", []),
        "status": d.get("status", "done"),
        "progress": d.get("progress", 0.0),
        "error": d.get("error"),
        "created_at": d.get("created_at"),
        "finished_at": d.get("finished_at"),
        "isPublic": bool(d.get("isPublic", False)),
        "isPremium": bool(d.get("isPremium", False)),
        "video_url": _render_video_url(d),
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
async def get_render_video(render_id: str, request: Request, download: bool = False):
    path = RENDERS_DIR / f"{Path(render_id).name}.mp4"
    if not path.exists():
        doc = await db.renders.find_one({"_id": Path(render_id).name})
        if doc and doc.get("fileRemoved"):
            raise HTTPException(status_code=410, detail="This video has expired and is no longer available for download")
        raise HTTPException(status_code=404, detail="Video not found")
    size = path.stat().st_size
    disposition = "attachment" if download else "inline"
    common_headers = {
        "Accept-Ranges": "bytes",
        "Content-Disposition": f'{disposition}; filename="invitavideos-{render_id[:8]}.mp4"',
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
        content_disposition_type=disposition,
    )


@api_router.get("/renders/{render_id}/video.mp4")
async def get_render_video_mp4(render_id: str, request: Request, download: bool = False):
    return await get_render_video(render_id, request, download)


app.include_router(api_router)

# Imported here (not at module top) because billing.routes needs
# require_google_user/require_admin_user, which are defined above in this
# file — importing earlier would hit them before they exist.
from billing.routes import router as billing_router  # noqa: E402
import billing.db as billing_db  # noqa: E402

app.include_router(billing_router)

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
        billing_db.set_db(db)
        await migrate_heartfelt_rename()
        await seed_default_templates()
        await seed_default_categories()
        await migrate_message_maxlength_120()
        await migrate_render_visibility_defaults()
        await catalog.seed_default_packs(db)
        asyncio.create_task(_expiry_cleanup_loop())
        logger.info("Using in-memory storage")
        return

    try:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=1000)
        await client.admin.command("ping")
        db = client[db_name]
        billing_db.set_db(db)
        await db.users.create_index("email")
        await db.users.create_index("googleSub", unique=True)
        await db.renders.create_index("userId")
        await db.renders.create_index("created_at")
        await db.templates.create_index("category")
        await db.templates.create_index("sortOrder")
        await db.music.create_index("id", unique=True)
        # --- billing --- (_id is already unique by default; no index needed for it)
        await db.wallet_transactions.create_index("idempotencyKey", unique=True)
        await db.wallet_transactions.create_index("userId")
        await db.payments.create_index("razorpayOrderId", unique=True, sparse=True)
        await db.payments.create_index("userId")
        await db.coupons.create_index("code", unique=True)
        await db.coupon_redemptions.create_index([("couponId", 1), ("userId", 1)], unique=True)
        await db.pack_discounts.create_index("packId")
        await migrate_heartfelt_rename()
        await seed_default_templates()
        await seed_default_categories()
        await migrate_message_maxlength_120()
        await migrate_render_visibility_defaults()
        await catalog.seed_default_packs(db)
        asyncio.create_task(_expiry_cleanup_loop())
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
