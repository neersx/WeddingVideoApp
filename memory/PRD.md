# DreamWedds — PRD

## Original Problem Statement
Build a template rendering engine: a small, isolated Node.js Remotion microservice (`render-service/`) in Docker exposing one endpoint — "here's JSON, give me an MP4." Couple names, dates, venue, photos and music are injected as data into designed templates (Marigold, Midnight). Part of the DreamWedds product.

## User Choices
- Data inputs: couple names, event date, venue, photos, music track, custom message/quote, event schedule
- Video: 1080x1920 vertical, ~30s (10/20/30s selectable)
- Async render flow: POST JSON → jobId → poll → download MP4
- No AI features for now
- API + demo frontend
- Job store: MongoDB (persistent, recoverable)
- Music: 3 bundled royalty-free demo tracks (replace files to ship real audio)

## Architecture
- `render-service/` (port 4001): Express + Remotion 4.0.290 + tsx. Runs locally under supervisor (`render-service`).
  - `POST /render-async` → `{jobId, status:"queued"}` (async, in-memory job map + background render)
  - `GET /jobs/:id` → `{status, progress 0..1, error?}`
  - `GET /jobs/:id/video` → mp4 stream (once done)
  - `POST /render` legacy sync endpoint kept
  - `src/templates/Marigold.tsx`, `src/templates/Midnight.tsx`
- FastAPI backend (port 8001)
  - `POST /api/renders` creates Mongo job doc `{status:"queued", progress:0}`, spawns BackgroundTask worker; returns `{jobId, status, poll_url, video_url}`
  - Background worker calls render-service `/render-async`, polls `/jobs/:id` every 2s, mirrors progress into Mongo, downloads mp4 into `/app/backend/renders/{jobId}.mp4` on completion
  - `GET /api/renders/{jobId}` → single job status doc
  - `GET /api/renders` → history list (all statuses)
  - `GET /api/renders/{jobId}/video` → mp4 file
  - `GET /api/music` → list of 3 bundled tracks
  - `GET /api/music/{id}` → mp3 stream from `/app/backend/music/`
  - `/api/upload`, `/api/uploads/{f}`, `/api/health`
- Bundled music library (`/app/backend/music/`)
  - `tere-sang.mp3` — Tere Sang (With You) · Selectric Music & Lyrics (default)
  - `wedding-romantic.mp3` — Wedding Romantic · Leberch
  - `romantic-adventure.mp3` — Romantic Adventure · Paul Yudin
  - `romantic.mp3` — Romantic · PrettyJohn1
  - `hindi-love-rap.mp3` — Hindi Love Rap · Rahul Sapkal
- React frontend: DreamWedds Render Studio — template picker, couple/event form, schedule builder, photo uploader, MusicPicker with play-preview, sticky 9:16 preview with live progress bar + download.

## Render JSON schema
```json
{
  "template": "marigold|midnight",
  "couple": {"partnerOne": "", "partnerTwo": ""},
  "eventDate": "November 21, 2026",
  "venue": {"name": "", "city": ""},
  "message": "",
  "photos": ["url"],
  "musicId": "serenity|twilight|marigold-bloom|null",
  "musicUrl": null,
  "schedule": [{"name": "Haldi", "time": "10:00 AM"}],
  "durationInSeconds": 30
}
```
Backend resolves `musicId` → internal music URL before dispatching to render-service. `musicUrl` still supported as external override.

## Job doc (Mongo `renders`)
`{ _id, template, couple, eventDate, venue, durationInSeconds, musicId, status: queued|rendering|done|failed, progress: 0..1, error?, size_bytes?, created_at, finished_at?, internal_id? }`

## Video structure (proportional sections)
Names reveal (18%) → message/quote (18%) → Ken Burns photo slideshow (30%) → schedule (17%) → save-the-date finale (17%). Optional music with fade in/out.

## Implemented
- 2026-06 — Render-service with Marigold + Midnight templates, sync render, Dockerfile
- 2026-06 — Backend proxy + upload + history, frontend dashboard (testing iteration_1: 100% pass)
- 2026-02 — **Async job queue** with MongoDB-backed status, live progress polling (2s interval), BackgroundTasks worker (testing iteration_2: 100% pass, 12/12 backend + full frontend e2e)
- 2026-02 — **Bundled music picker** with 5 real royalty-free tracks (Tere Sang default), play-preview in UI, musicId payload field, credit attribution shown per card

## Backlog
- P1: Render history panel in UI (API exists, needs component)
- P2: Real CC0 music files to replace demo tones; AI-written invitation captions (Emergent LLM key); more templates; watermark/branding option; webhook on completion; cleanup policy for old renders

## Notes
- No auth in app; no credentials required
- Renders stored in `/app/backend/renders/`
- Render-service in-memory jobs sweep after 30 min; Mongo docs persist indefinitely
- Sync `POST /render` endpoint retained for backwards compatibility / debugging
