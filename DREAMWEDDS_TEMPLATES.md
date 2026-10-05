# DreamWedds video templates

DreamWedds templates are isolated from InvitaVideos' general-purpose catalogue:

```text
render-service/src/templates/dreamwedds/
├── catalog.ts
├── types.ts
├── indian/
│   └── RoyalBlushWedding.tsx
├── christian/
├── buddhist/
└── muslim/
    └── EmeraldNikah.tsx
```

Only implemented culture/template pairs are exposed. The backend allow-list is
in `backend/dreamwedds.py`; the matching Remotion composition is registered in
`render-service/src/remotion/Root.tsx`.

## Create a DreamWedds render

Use a partner key issued by the InvitaVideos admin API. Send either the complete
raw DreamWedds wedding-details response:

```bash
curl -X POST https://invitavideos.com/api/integrations/dreamwedds/renders \
  -H "Authorization: Bearer sk_live_REPLACE_ME" \
  -H "Content-Type: application/json" \
  --data @wedding.json
```

or wrap it to choose the design and culture explicitly:

```json
{
  "weddingCulture": "Indian",
  "template": "royal-blush",
  "wedding": {},
  "images": [
    "https://res.cloudinary.com/example/banner.webp"
  ]
}
```

The response uses the existing asynchronous contract:

```json
{
  "jobId": "...",
  "status": "queued",
  "poll_url": "/api/renders/...",
  "video_url": "/api/renders/.../video.mp4",
  "creditCost": 0
}
```

List the available pairs with
`GET /api/integrations/dreamwedds/templates` using the same partner key.

## Current image mapping

Royal Blush automatically uses, in order:

1. the first banner for the family opening;
2. the primary bride and groom portraits;
3. the primary event image, with the second banner as fallback;
4. timeline and gallery images for the story and closing scenes.

Supplying `images` in the wrapper overrides the automatic photo ordering while
the couple, event, date, venue and culture still come from the wedding payload.

Emerald Nikah uses the same normalized wedding data and photo ordering as Royal
Blush. Select it with `weddingCulture: "Muslim"` and
`template: "emerald-nikah"`. The original `Emrald Nikash` spelling is accepted
as a compatibility alias. Its core cut is 30 seconds for one image; each
additional uploaded image receives a dedicated four-second portrait screen, up
to 58 seconds for eight images.

## Add another culture or design

1. Add the composition under `templates/dreamwedds/<culture>/`.
2. Add its external template ID and composition ID to `catalog.ts`.
3. Register the composition in `Root.tsx`.
4. Add the culture/template pair to `_TEMPLATE_REGISTRY` in
   `backend/dreamwedds.py`.
5. Add a seeded backend template document and normalization tests.

Do not add placeholder registry entries. A pair becomes discoverable only when
its composition is renderable.

## Render diagnostics

Backend and render-service logs are written to stdout/stderr and collected by
whichever process manager runs them (terminal, Docker logs, or systemd journal).
Restart both services after updating the code.

The backend logs `render.dispatch` with the exact outgoing JSON payload and sends
its render ID in `X-Render-Id`. The worker logs `render.received` with the received
payload and `render.input` with the resolved composition and input props. Search
for the same `renderId` across both services; `jobId` identifies the worker job.
Worker events are one JSON object per line with a UTC timestamp.

Failures include worker stage (`bundle`, `input_props`, `select_composition`, or
`render_media`), progress, error message and stack. Backend logs cover rejected
requests, polling connection/HTTP errors, timeouts, downloads, saving the video,
and credit settlement. Existing backend error records and failed-job status
remain available. `render.completed` marks successful completion in each service.

Payload logs include wedding details and media URLs; authorization headers are
not included. These logs do not create a separate log file or retention policy.

Render failures are also saved through the backend's existing `error_logs`
collection and shown under **Admin Portal → Error Logs → Rendering**. Open a row
to inspect render/worker IDs, template, stage, progress and the worker stack trace.
Polling outages create one warning per consecutive outage, followed by a separate
error if the render ultimately fails or times out. These records use the existing
error-log retention and resolve controls. MongoDB persistence requires
`STORAGE_BACKEND=mongodb`; development memory storage is cleared on restart.
Worker diagnostics arrive through the backend's job polling; direct worker calls
outside the backend flow only produce worker logs.
