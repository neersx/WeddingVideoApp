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

1. the first banner for the opening invitation folio;
2. up to three banners (or the uploaded photo order) for the floating gallery;
3. the primary bride and groom portraits for their individual screens;
4. the primary event image for the dimensional event card.

The closing screen uses the bundled DreamWedds logo.

Supplying `images` in the wrapper overrides the automatic photo ordering while
the couple, event, date, venue and culture still come from the wedding payload.

Emerald Nikah uses the same normalized wedding data and photo ordering as Royal
Blush. Select it with `weddingCulture: "Muslim"` and
`template: "emerald-nikah"`. The original `Emrald Nikash` spelling is accepted
as a compatibility alias. Its core cut is 30 seconds for one image; each
additional uploaded image receives a dedicated four-second portrait screen, up
to 58 seconds for eight images.

## Royal Blush 3D invitation

`dreamwedds-royal-blush` / `DreamWeddsRoyalBlush` now uses the motion design from
DreamWeddsManager's `output/video/charlotte-liam-3d-30s` sample: opening invitation doors, floating photo frames, rotating arched
portraits, a dimensional event card and the DreamWedds closing. It uses CSS 3D
planes and perspective, as in the sample.

The 30-second sequence is: folio (0–5s), photo gallery (5–10s), bride (10–14s),
groom (14–18s), event (18–24s), invitation (24–28s), branding (28–30s). Motion
is time-based at either 24 or 30 fps. The template ID and render API are unchanged.
Existing completed MP4s are unchanged; create or recreate a video to use this design.

Names, portraits, photos, date, event title, venue and music come from the existing
flat or normalized DreamWedds payload. Optional string fields `socialImageUrl`,
`eventTime` and `websiteUrl` add the invitation-card image, explicit event time and
wedding website address. If omitted, the folio uses the banner and the optional
text is hidden. DreamWedds' current flat request does not send these optional fields.
The sample couple's photos, names, time and URL are not bundled into the template.
The serif font and DreamWedds logo are bundled under `public/dreamwedds/` so this
composition does not need to download its font at render time.

## Culture and tradition style presets

Royal Blush shares one 3D composition with reusable presets defined in
`render-service/src/templates/dreamwedds/styles.ts`. `StyleOrnaments.tsx` draws
animated vector scenery without external image downloads. Presets control the
palette, scenery, decorative motifs, portrait shape, typography and invitation copy.

| Metadata | Preset | Appearance |
| --- | --- | --- |
| Indian / Hindu | `indian-royal` | Garnet, gold, palace arches and marigold garlands |
| English / Christian | `english-garden` | Ivory, sage, garden vines and soft flowers |
| Muslim / Islamic | `emerald-arches` | Emerald, gold, pointed arches and lanterns |
| Buddhist | `lotus-serenity` | Plum, warm ivory and lotus ornaments |
| Unknown, missing, civil or interfaith | `neutral-romance` | Blush, ivory and floral ornaments |
| Explicit override | `forest-gold` | Original sample's forest green and gold |

Selection priority: valid `videoStyle` override → recognized tradition → culture
→ neutral fallback. An Indian Christian wedding therefore gets English Garden;
an Indian Muslim wedding gets Emerald Arches. Matching ignores case and outer
whitespace and supports aliases such as British, Catholic, Islamic and Tamil Hindu.
Invalid overrides fall back to metadata. No scripture or religious vows are inserted.

For `POST /api/renders`, send the metadata in the existing fields bag:

```json
{
  "template": "dreamwedds-royal-blush",
  "category": "DreamWedds",
  "fields": {
    "partnerOne": "Charlotte",
    "partnerTwo": "Liam",
    "weddingCulture": "English",
    "weddingTradition": "Christian"
  }
}
```

Include photos/date/venue as usual. An optional `fields.videoStyle` explicitly
selects a preset, for example `forest-gold` to keep the original sample look.
The normalized integration endpoint also preserves culture, tradition (falling
back to the wedding's `weddingStyle`) and an optional wrapper `videoStyle`.
Royal Blush is available for all cultures. The separate Emerald Nikah composition
retains its existing Muslim default routing; explicitly choose `royal-blush` to
use these shared presets through the normalized endpoint.

DreamWedds already sends culture and tradition. Its complimentary-video culture
restriction has been removed, and missing culture is now forwarded as empty so
the renderer can choose the neutral fallback. Deploy both the DreamWedds backend
and WeddingVideoApp backend/render service for the complete flow.

Run preset selection tests with `npm run test:styles` in `render-service`, and
normalization tests with `python -m unittest discover -s tests -p test_dreamwedds.py`
in `backend`.

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
