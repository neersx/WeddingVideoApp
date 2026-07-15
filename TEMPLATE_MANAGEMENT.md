# Template Category Management

Invita Videos stores template-to-category mappings in MongoDB in the `templates` collection.

On backend startup, the current built-in templates are seeded automatically if they do not already exist. All current templates are mapped to the `Wedding` category by default.

The built-in catalog now also includes category-specific templates:

- Wedding: `Royal Palace`
- Engagement: `Engagement Glow`, `Ring Reveal`
- Birthday: `Confetti Pop`
- Birthday: `Birthday Era` (`birthday-era-v1`), an emotional cinematic 30-second reel with a branded InvitaVideos outro.
- Birthday: `Golden Hour` (`golden-hour`), a luxury editorial birthday short film with moving golden reflections and the same InvitaVideos branding treatment.

For Birthday templates, the current shared form uses Partner One as the birthday person's name and Partner Two as the host or family name.

## Category-specific creation forms

The creator adapts its details form to the selected category:

- `Wedding`: shows partner names, date, venue, message, and editable event schedule.
- `Engagement`: shows partner names, date, venue, and message. The schedule editor is hidden and the render always receives one fixed `Engagement` event.
- `Birthday`: shows `First name` and `Last name`, birthday date, venue, and message. The event schedule editor is hidden and no schedule events are sent.

The render API continues to use the existing `couple.partnerOne` and `couple.partnerTwo` fields. For Birthday videos these contain the first and last name values, which keeps older render compositions compatible.

## Default music per template

Admins can choose a bundled soundtrack in the `Default music` column for every template. The selected track is stored as `defaultMusicId`. It is used automatically when a render does not specify a manual music selection; a user's selection in the Music step always takes precedence. Select `No default music` to keep a template silent.

The same Admin page includes a Music library upload form. Upload an `.mp3`, enter its title and optional mood/credit/duration, then optionally choose a template to assign it immediately. Uploaded tracks are stored in MongoDB metadata plus the backend `music/` directory and are returned by `GET /api/music`.

Music tracks also have a `categories` array. Enter multiple categories as comma-separated values, for example `Wedding, Engagement`. The creator only shows tracks linked to the selected video category, and assigning a template default requires the track to include that template's category.

## Video tags

The creation form accepts comma-separated tags such as `wedding`, `showcase`, `premium invitation`, `traditional`, `family celebration`, `engagement`, `birthday`, or `milestone`. Suggested tags change with the selected category. Tags are normalized, deduplicated, limited to 12 values, and stored on each render document in the `tags` array.

The first Engagement template is `engagement-glow`. It uses the Remotion composition `EngagementGlow` and a versioned SVG background asset at `render-service/public/engagement-glow-bg.svg`.

## MongoDB document shape

Example document:

```json
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
  "isActive": true,
  "sortOrder": 10,
  "created_at": "2026-07-14T00:00:00+00:00",
  "updated_at": "2026-07-14T00:00:00+00:00"
}
```

Important fields:

- `category`: controls grouping, e.g. `Wedding`, `Engagement`, `Birthday`, `Anniversary`
- `isActive`: controls whether the template appears in the video creator
- `sortOrder`: controls display order inside category
- `_id` / `id`: stable render template id; do not change unless render-service also supports the new id

## Admin page

Open:

```text
https://invitavideos.com/admin/templates
```

The page lets you:

- view all templates
- update category
- enable/disable templates
- update sort order

Write access uses Google login. The frontend route and backend API are restricted to `neer19ultimate@gmail.com` by default; unauthorized users receive the normal 404 page in the frontend and a 403 response from the API.

To restrict admin access in production, set `ADMIN_EMAILS` in `/etc/invitawedds/backend.env`:

```env
ADMIN_EMAILS=you@example.com,another-admin@example.com
```

Then restart backend:

```bash
sudo systemctl restart instawedds-backend.service
```

## API endpoints

Public:

```bash
curl https://invitavideos.com/api/templates
curl https://invitavideos.com/api/template-categories
```

Admin:

```bash
GET   /api/admin/templates
PATCH /api/admin/templates/{template_id}
```

`PATCH` body:

```json
{
  "category": "Engagement",
  "isActive": true,
  "sortOrder": 20
}
```

## Check records directly in MongoDB

Local:

```bash
mongosh --eval 'db.getSiblingDB("invitavideodb").templates.find({}, { _id: 1, name: 1, category: 1, isActive: 1, sortOrder: 1 }).sort({ category: 1, sortOrder: 1 }).pretty()'
```

Production:

```bash
mongosh 'mongodb://invitavideo_app:YOUR_PASSWORD@127.0.0.1:27017/invitavideodb?authSource=invitavideodb' \
  --eval 'db.templates.find({}, { _id: 1, name: 1, category: 1, isActive: 1, sortOrder: 1 }).sort({ category: 1, sortOrder: 1 }).pretty()'
```

## Add a new category

You do not need a separate category collection. A category exists when at least one template uses that category.

For example, changing `heartbeat` to `Engagement` creates the Engagement category:

```javascript
db.templates.updateOne(
  { _id: "heartbeat" },
  { $set: { category: "Engagement", updated_at: new Date().toISOString() } }
)
```
