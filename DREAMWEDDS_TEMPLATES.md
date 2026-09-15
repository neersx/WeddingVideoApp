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

## Add another culture or design

1. Add the composition under `templates/dreamwedds/<culture>/`.
2. Add its external template ID and composition ID to `catalog.ts`.
3. Register the composition in `Root.tsx`.
4. Add the culture/template pair to `_TEMPLATE_REGISTRY` in
   `backend/dreamwedds.py`.
5. Add a seeded backend template document and normalization tests.

Do not add placeholder registry entries. A pair becomes discoverable only when
its composition is renderable.
