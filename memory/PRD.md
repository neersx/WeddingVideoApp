# DreamWedds — PRD

## Original Problem Statement
Build a template rendering engine: a small, isolated Node.js Remotion microservice (`render-service/`) in Docker exposing one endpoint — "here's JSON, give me an MP4." Couple names, dates, venue, photos and music are injected as data into designed templates (Marigold, Midnight). Part of the DreamWedds product.

## User Choices
- Data inputs: couple names, event date, venue, photos, music track, custom message/quote, event schedule
- Video: 1080x1920 vertical, ~30s (10/20/30s selectable)
- Sync render flow: POST JSON → wait → MP4
- No AI features for now
- API + demo frontend

## Architecture
- `render-service/` (port 4001): Express + Remotion 4.0.290 + tsx. `POST /render` (JSON → MP4 stream), `GET /health`. Bundles Remotion project at startup; uses Remotion-managed chrome-headless-shell. Dockerfile included for standalone deployment. Runs locally under supervisor (`render-service`).
  - `src/index.ts` — Express server
  - `src/remotion/` — Root compositions (calculateMetadata drives duration 5–60s @30fps)
  - `src/templates/Marigold.tsx` — rustic-luxe Indian theme (petals, Playfair Display, rust/gold)
  - `src/templates/Midnight.tsx` — dark romance theme (starfield, Cormorant Garamond, black/gold)
- FastAPI backend (port 8001): `/api/renders` (proxy → render-service, saves MP4 in `backend/renders/`, metadata in Mongo `renders`), `/api/renders/{id}/video`, `/api/renders` list, `/api/upload` + `/api/uploads/{f}` photo hosting, `/api/health`.
- React frontend: DreamWedds Render Studio dashboard — template picker, couple/event form, schedule builder, photo uploader (max 4), sticky 9:16 preview with render progress + download.

## Render JSON schema
```json
{
  "template": "marigold|midnight",
  "couple": {"partnerOne": "", "partnerTwo": ""},
  "eventDate": "November 21, 2026",
  "venue": {"name": "", "city": ""},
  "message": "",
  "photos": ["url"],
  "musicUrl": null,
  "schedule": [{"name": "Haldi", "time": "10:00 AM"}],
  "durationInSeconds": 30
}
```

## Video structure (proportional sections)
Names reveal (18%) → message/quote (18%) → Ken Burns photo slideshow (30%) → schedule (17%) → save-the-date finale (17%). Optional music with fade in/out.

## Implemented (2026-06)
- Render-service with 2 templates, sync render, Dockerfile — tested, 5s render ≈ 30-40s
- Backend proxy + upload + history, frontend dashboard — testing agent iteration_1: 100% backend + frontend pass

## Backlog
- P0: none
- P1: async job queue (job id + polling) for 30s+ renders behind gateways with short timeouts; render history UI panel (API exists)
- P2: more templates; AI text/captions; AI background images (Emergent LLM key); bundled royalty-free music picker; watermark/branding option; webhook on completion

## Notes
- No auth in app; no credentials required
- Renders stored in /app/backend/renders (no cleanup policy yet — P2)
