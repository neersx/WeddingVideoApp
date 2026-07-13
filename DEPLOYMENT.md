# DreamWedds — Deployment & Database Setup

This document covers setting up DreamWedds (FastAPI backend + React frontend + Node/Remotion render-service + MongoDB) on:

1. **Local machine** (macOS / Linux dev workstation)
2. **Ubuntu VPS** (production, single-server, Nginx reverse-proxy, systemd)

---

## Architecture Overview

```
┌──────────┐     ┌────────────┐     ┌──────────────────┐
│ Browser  │───► │  Nginx     │───► │ React (frontend) │  :3000  (dev)
│          │     │ (VPS only) │───► │ FastAPI (backend)│  :8001
└──────────┘     └────────────┘     ├──────────────────┤
                                    │ render-service   │  :4001 (internal only)
                                    │  Node + Remotion │
                                    └──────────────────┘
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │ MongoDB          │  :27017
                                    └──────────────────┘

Filesystem (on backend host):
  ./backend/uploads/   — user-uploaded photos
  ./backend/renders/   — generated mp4 files
  ./backend/music/     — bundled royalty-free tracks
```

Key facts:
- All backend APIs are prefixed with `/api`.
- Frontend talks to backend using `REACT_APP_BACKEND_URL`.
- Backend talks to render-service internally using `RENDER_SERVICE_URL` (never exposed publicly).
- Render-service needs a headless Chromium — either the Remotion-managed shell or system chromium (Ubuntu).

---

## 1. Local Machine Setup

Works on Linux and macOS. Steps assume you cloned the repo to `~/dreamwedds`.

### 1.1 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.11+ | Backend |
| Node.js | 20.x LTS | Frontend + render-service |
| Yarn | 1.22+ | Node package manager |
| MongoDB | 6.x or 7.x | Database |
| ffmpeg | any recent | Optional — for track re-encoding |
| Google Chrome / Chromium | any recent | Only needed if you skip Remotion's managed shell |

#### Install prerequisites

**macOS (Homebrew):**
```bash
brew install python@3.11 node@20 yarn mongodb-community ffmpeg
brew services start mongodb-community
```

**Ubuntu / Debian dev machine:**
```bash
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3-pip ffmpeg chromium-browser
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g yarn
# MongoDB — see section 1.2
```

### 1.2 Install MongoDB locally

**macOS:** already installed above with brew. Verify:
```bash
mongosh --eval "db.runCommand({ ping: 1 })"
```

**Ubuntu (via official repo):**
```bash
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] \
  https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
```

### 1.3 Backend

```bash
cd ~/dreamwedds/backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `.env`:
```bash
cat > .env <<'EOF'
STORAGE_BACKEND="memory" # Use "mongodb" when MongoDB is configured
MONGO_URL="mongodb://localhost:27017"
DB_NAME="dreamwedds"
CORS_ORIGINS="http://localhost:3000"
RENDER_SERVICE_URL="http://localhost:4001"
INTERNAL_BASE_URL="http://localhost:8001"
EOF
```

Start:
```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Verify: `curl http://localhost:8001/api/health` → `{"api":"ok","render_service":{"status":"unreachable"}}` (render-service not up yet — that's expected).

### 1.4 Render-service

```bash
cd ~/dreamwedds/render-service
yarn install
# First run downloads Remotion's chrome-headless-shell (~150MB)
```

Environment (optional — defaults fine locally):
```bash
export PORT=4001
# Optional: point at system Chromium instead of Remotion-managed
# export BROWSER_EXECUTABLE=$(which chromium || which google-chrome)
```

Start:
```bash
yarn start
# First launch takes 20-40s to bundle Remotion. Watch for: [bundle] ready at ...
```

Verify: `curl http://localhost:4001/health` → `{"status":"ok","bundled":true,"jobs":0}`.

### 1.5 Frontend

```bash
cd ~/dreamwedds/frontend
yarn install
```

Create `.env`:
```bash
cat > .env <<'EOF'
REACT_APP_BACKEND_URL=http://localhost:8001
EOF
```

Start:
```bash
yarn start   # opens http://localhost:3000
```

### 1.6 Smoke test the full stack

```bash
curl -s http://localhost:8001/api/music | jq
curl -s -X POST http://localhost:8001/api/renders \
  -H "Content-Type: application/json" \
  -d '{
    "template":"heartbeat",
    "couple":{"partnerOne":"Aisha","partnerTwo":"Rohan"},
    "eventDate":"November 21, 2026",
    "venue":{"name":"Leela Palace","city":"Udaipur"},
    "musicId":"tere-sang",
    "durationInSeconds":8,
    "schedule":[{"name":"Wedding","time":"11:30 AM"}]
  }' | jq
# poll GET /api/renders/{jobId} until status=done
```

### 1.7 Run tests
```bash
cd ~/dreamwedds/backend && source .venv/bin/activate && pytest -q
```

---

## 2. Ubuntu VPS Deployment (Production)

Target: Ubuntu 22.04 LTS or 24.04 LTS, minimum **2 vCPU / 4 GB RAM / 20 GB SSD**. Rendering is CPU-bound; upgrade to 4 vCPU for anything beyond ~5 concurrent renders. Domain (e.g. `dreamwedds.example.com`) recommended.

### 2.1 Server preparation

Log in as a non-root sudo user:
```bash
sudo apt update && sudo apt -y upgrade
sudo apt install -y build-essential git curl ufw ca-certificates gnupg lsb-release \
  ffmpeg fonts-noto-color-emoji \
  libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libx11-xcb1 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libxss1 libxshmfence1 libgbm1 libasound2 libpango-1.0-0 libcairo2 libgtk-3-0
```

Firewall (allow SSH + HTTP + HTTPS only; DB and internal ports stay closed):
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### 2.2 Install Python 3.11 and Node 20

```bash
sudo apt install -y python3.11 python3.11-venv python3-pip
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

Do not install Ubuntu's separate `npm` package after installing NodeSource Node.js. The NodeSource `nodejs` package already includes npm; installing Ubuntu `npm` can cause `nodejs : Conflicts: npm`.

### 2.3 Install MongoDB (production settings)

```bash
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] \
  https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
```

**Harden MongoDB** — bind to loopback + enable auth:
```bash
sudo nano /etc/mongod.conf
```
```yaml
net:
  bindIp: 127.0.0.1
security:
  authorization: enabled
```

Create app user (do this **before** enabling `authorization` — first create admin, then app user):
```bash
# temporarily disable authorization, restart, then:
mongosh <<'EOF'
use admin
db.createUser({user:"admin", pwd:"CHANGE_ME_STRONG_ADMIN_PW", roles:["root"]})
use dreamwedds
db.createUser({
  user:"dreamwedds_app",
  pwd:"CHANGE_ME_STRONG_APP_PW",
  roles:[{role:"readWrite", db:"dreamwedds"}]
})
EOF
```
Re-enable `authorization: enabled` in `/etc/mongod.conf`, then:
```bash
sudo systemctl restart mongod
```
Test:
```bash
mongosh "mongodb://dreamwedds_app:CHANGE_ME_STRONG_APP_PW@127.0.0.1:27017/dreamwedds"
```

### 2.4 Create app user + directories

```bash
sudo useradd -m -s /bin/bash invitawedds
sudo mkdir -p /var/www/invitawedds
sudo chown invitawedds:invitawedds /var/www/invitawedds
sudo -iu invitawedds
```

### 2.5 Deploy code

As `invitawedds`:
```bash
cd /var/www/invitawedds
git clone <YOUR_REPO_URL> WeddingVideoApp
cd WeddingVideoApp
```

### 2.6 Backend (production)

Run dependency installation as `invitawedds`:

```bash
cd /var/www/invitawedds/WeddingVideoApp/backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn uvicorn[standard]
```

Create the systemd environment file `/etc/invitawedds/backend.env` as root or a sudoer:
```bash
sudo mkdir -p /etc/invitawedds
sudo tee /etc/invitawedds/backend.env >/dev/null <<'EOF'
STORAGE_BACKEND="mongodb"
MONGO_URL="mongodb://dreamwedds_app:CHANGE_ME_STRONG_APP_PW@127.0.0.1:27017/dreamwedds?authSource=dreamwedds"
DB_NAME="dreamwedds"
CORS_ORIGINS="https://invitavideos.com"
RENDER_SERVICE_URL="http://127.0.0.1:4001"
INTERNAL_BASE_URL="http://127.0.0.1:8001"
EOF
sudo chown root:invitawedds /etc/invitawedds/backend.env
sudo chmod 640 /etc/invitawedds/backend.env
```

Persist uploads/renders on a dedicated data volume (optional but recommended):
```bash
sudo mkdir -p /var/lib/invitawedds/{uploads,renders}
sudo chown -R invitawedds:invitawedds /var/lib/invitawedds
# symlink so code paths keep working
ln -sfn /var/lib/invitawedds/uploads /var/www/invitawedds/WeddingVideoApp/backend/uploads
ln -sfn /var/lib/invitawedds/renders /var/www/invitawedds/WeddingVideoApp/backend/renders
```

### 2.7 Render-service (production)

Run dependency installation as `invitawedds`:

```bash
cd /var/www/invitawedds/WeddingVideoApp/render-service
npm install --legacy-peer-deps
# Pre-warm Remotion's browser
npx remotion browser ensure
```

Create the systemd environment file `/etc/invitawedds/render.env` as root or a sudoer:
```bash
sudo tee /etc/invitawedds/render.env >/dev/null <<'EOF'
PORT=4001
# Uncomment to use system chromium instead of the Remotion-managed one:
# BROWSER_EXECUTABLE=/usr/bin/chromium-browser
EOF
sudo chown root:invitawedds /etc/invitawedds/render.env
sudo chmod 640 /etc/invitawedds/render.env
```

### 2.8 Frontend build

```bash
cd /var/www/invitawedds/WeddingVideoApp/frontend
npm install --legacy-peer-deps
# .env for the build
cat > .env <<'EOF'
REACT_APP_BACKEND_URL=https://invitavideos.com
EOF
npm run build   # outputs to ./build
```

The `build/` folder is what Nginx serves.

### 2.9 systemd services

**Backend** — `/etc/systemd/system/instawedds-backend.service`:
```ini
[Unit]
Description=InvitaWedds Wedding Video API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=invitawedds
Group=invitawedds
WorkingDirectory=/var/www/invitawedds/WeddingVideoApp/backend
EnvironmentFile=/etc/invitawedds/backend.env
ExecStart=/var/www/invitawedds/WeddingVideoApp/backend/.venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

**Render-service** — `/etc/systemd/system/instawedds-render.service`:
```ini
[Unit]
Description=InvitaWedds Remotion Render Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=invitawedds
Group=invitawedds
WorkingDirectory=/var/www/invitawedds/WeddingVideoApp/render-service
EnvironmentFile=/etc/invitawedds/render.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=false

[Install]
WantedBy=multi-user.target
```

Enable + start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now instawedds-render instawedds-backend
sudo systemctl status instawedds-render instawedds-backend
```

### 2.10 Nginx reverse proxy

Install Nginx + certbot:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/dreamwedds`:
```nginx
server {
    listen 80;
    server_name dreamwedds.example.com;

    root /var/www/invitawedds/web/build;
    index index.html;

    # Large uploads/downloads (photos + rendered mp4s)
    client_max_body_size 25M;

    # Long timeouts because /api/renders/{id}/video can stream ~10MB+ files
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    # API -> FastAPI on 127.0.0.1:8001
    location = /api {
        proxy_pass         http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location ^~ /api/ {
        proxy_pass         http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # Everything else → static React build
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable + reload:
```bash
sudo ln -s /etc/nginx/sites-available/dreamwedds /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Attach TLS:
```bash
sudo certbot --nginx -d dreamwedds.example.com --agree-tos -m you@example.com --redirect
# auto-renew runs from a systemd timer already installed
sudo systemctl list-timers | grep certbot
```

### 2.11 First-time end-to-end verification

```bash
curl https://dreamwedds.example.com/api/health
# → {"api":"ok","render_service":{"status":"ok","bundled":true,"jobs":0}}

JOB=$(curl -s -X POST https://dreamwedds.example.com/api/renders \
  -H "Content-Type: application/json" \
  -d '{"template":"story","couple":{"partnerOne":"A","partnerTwo":"B"},"eventDate":"Dec 1, 2026","venue":{"name":"X","city":"Y"},"musicId":"tere-sang","durationInSeconds":8,"schedule":[{"name":"Wedding","time":"5 PM"}]}' \
  | jq -r .jobId)

while true; do
  S=$(curl -s https://dreamwedds.example.com/api/renders/$JOB | jq -r .status)
  echo $S; [ "$S" = "done" ] || [ "$S" = "failed" ] && break
  sleep 3
done
```

---

## 3. Alternative: Docker Compose Deployment (VPS or local)

If you prefer containers, this is the minimal `docker-compose.yml`. The render-service already has a Dockerfile in `render-service/Dockerfile`.

```yaml
version: "3.9"
services:
  mongo:
    image: mongo:7
    restart: always
    volumes:
      - mongo_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: CHANGE_ME

  render:
    build: ./render-service
    restart: always
    environment:
      PORT: 4001
    # no external port — accessed only by backend on the internal network

  backend:
    build: ./backend           # add your own Dockerfile (python:3.11-slim + pip install -r requirements.txt)
    restart: always
    depends_on: [mongo, render]
    environment:
      MONGO_URL: "mongodb://admin:CHANGE_ME@mongo:27017"
      DB_NAME: "dreamwedds"
      RENDER_SERVICE_URL: "http://render:4001"
      INTERNAL_BASE_URL: "http://backend:8001"
      CORS_ORIGINS: "https://dreamwedds.example.com"
    volumes:
      - backend_uploads:/app/uploads
      - backend_renders:/app/renders

  frontend:
    build: ./frontend          # multi-stage build → nginx serving /build
    restart: always
    depends_on: [backend]
    ports: ["80:80"]

volumes:
  mongo_data:
  backend_uploads:
  backend_renders:
```

Put a reverse-proxy (Traefik or Nginx-with-certbot container) in front to handle TLS.

---

## 4. Database schema & seed

The backend creates collections lazily. The single collection used today is:

**`renders`** (job history / status)
```
{
  _id:            <string, uuid hex>,
  template:       "marigold"|"midnight"|"heartbeat"|"story"|"poster",
  couple:         { partnerOne: str, partnerTwo: str },
  eventDate:      str,
  venue:          { name: str, city: str },
  durationInSeconds: int,
  musicId:        str | null,
  status:         "queued"|"rendering"|"done"|"failed",
  progress:       0.0..1.0,
  error:          str | null,
  size_bytes:     int (once done),
  internal_id:    str  (render-service internal job id),
  created_at:     ISO8601 str,
  finished_at:    ISO8601 str | null
}
```

No seed data is required. Music tracks are static files on disk (`backend/music/`), not stored in Mongo.

**Recommended indexes** (optional, tiny dataset — only helpful past 10k rows):
```javascript
mongosh "mongodb://dreamwedds_app:...@127.0.0.1/dreamwedds?authSource=dreamwedds" <<'EOF'
db.renders.createIndex({ created_at: -1 })
db.renders.createIndex({ status: 1, created_at: -1 })
EOF
```

---

## 5. Backups

### 5.1 MongoDB

Nightly `mongodump` cron:
```bash
sudo mkdir -p /var/backups/dreamwedds
sudo tee /etc/cron.d/dreamwedds-mongo-backup <<'EOF'
0 2 * * * root /usr/bin/mongodump \
  --uri="mongodb://dreamwedds_app:CHANGE_ME_STRONG_APP_PW@127.0.0.1:27017/dreamwedds?authSource=dreamwedds" \
  --archive=/var/backups/dreamwedds/dreamwedds-$(date +\%Y\%m\%d).archive.gz --gzip \
  && find /var/backups/dreamwedds -mtime +14 -delete
EOF
```

### 5.2 Rendered videos + uploads

Simple rsync to off-box storage (S3, Backblaze, another VPS):
```bash
# example S3 sync via awscli or rclone
rclone sync /var/lib/invitawedds/renders  remote:invitawedds/renders
rclone sync /var/lib/invitawedds/uploads  remote:invitawedds/uploads
```

### 5.3 Cleanup policy (recommended)

Renders accumulate. Add a cron to prune files older than 30 days:
```bash
0 3 * * * invitawedds find /var/lib/invitawedds/renders -type f -mtime +30 -delete
```
(Mongo docs will still reference them; adjust `list_renders` if you want to hide broken ones.)

---

## 6. Updating / Redeploying

```bash
sudo -iu invitawedds
cd /var/www/invitawedds/WeddingVideoApp
git pull

# Backend deps changed?
cd backend && source .venv/bin/activate && pip install -r requirements.txt

# Frontend rebuild
cd ../frontend && npm install --legacy-peer-deps && npm run build
rm -rf /var/www/invitawedds/web/build
mkdir -p /var/www/invitawedds/web/build
cp -a build/. /var/www/invitawedds/web/build/

# Render-service deps changed?
cd ../render-service && npm install --legacy-peer-deps
```

Reload services (as sudoer):
```bash
sudo systemctl restart instawedds-backend instawedds-render
sudo systemctl reload nginx    # only if nginx config changed
```

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `render_service.status: unreachable` in `/api/health` | `systemctl status instawedds-render` — the first boot takes 20-40s to bundle. Check `journalctl -u instawedds-render -n 200`. |
| `Failed to load environment files: No such file or directory` | Create `/etc/invitawedds/backend.env` and `/etc/invitawedds/render.env`, then run `sudo systemctl daemon-reload && sudo systemctl restart instawedds-backend instawedds-render`. |
| `Failed to run 'start' task: No such file or directory` | Check `command -v npm`. If it is not `/usr/bin/npm`, update `ExecStart` in `/etc/systemd/system/instawedds-render.service` to the real npm path, then run `sudo systemctl daemon-reload`. |
| `ERESOLVE could not resolve` for `react-day-picker` / `date-fns`, followed by `craco: not found` | Run frontend install with `npm install --legacy-peer-deps`, then run the build again. The build failed because npm stopped before installing dev dependency `@craco/craco`. |
| `403 Forbidden nginx/1.18.0` on `invitavideos.com` | Confirm `/var/www/invitawedds/web/build/index.html` exists and Nginx can traverse/read the directory: `sudo namei -l /var/www/invitawedds/web/build/index.html`. Rebuild/copy the frontend and set read permissions if needed. |
| Backend URLs ending in file extensions return `404` through Nginx | Make the API location `location ^~ /api/` so static asset regex rules do not steal `/api/uploads/*.jpg`, `/api/music/*.mp3`, or similar backend routes. |
| Render logs show `EPERM`, `syscall: 'chmod'`, path `@remotion/compositor.../remotion` | `node_modules` is usually root-owned from running `sudo npm install`. Run `sudo chown -R invitawedds:invitawedds /var/www/invitawedds/WeddingVideoApp/render-service`, reinstall as `invitawedds`, then restart `instawedds-render`. |
| Render fails with `chrome-headless-shell: error while loading shared libraries: libatk-1.0.so.0` | Install Remotion/Chromium runtime libraries: `sudo apt install -y libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0 libnss3 libnspr4 libxss1 libxshmfence1 libgbm1 libasound2 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libpango-1.0-0 libcairo2`, then restart `instawedds-render`. |
| Rendering fails with `SIGTRAP` / Chromium crash | Ensure the systemd unit is running under a real user (not root) or set `BROWSER_EXECUTABLE=/usr/bin/chromium-browser`. Remotion internally passes `--no-sandbox`. |
| 413 Request Entity Too Large on photo upload | Increase `client_max_body_size` in Nginx (currently 25M). |
| `MongoServerError: Authentication failed` | Confirm `authSource=dreamwedds` is in `MONGO_URL`. Verify the app user was created inside the `dreamwedds` DB. |
| Long renders time out via Nginx | Increase `proxy_read_timeout` (default here is 300s); or rely on client polling — the current flow doesn't hold connections open, so timeouts shouldn't hit the render call. |
| CORS blocked in browser | `CORS_ORIGINS` in `/etc/invitawedds/backend.env` must exactly match your frontend origin (scheme + host, no trailing slash). Restart backend after change. |
| Out of disk on `/var/lib/invitawedds` | Enable the retention cron in §5.3 or point renders/uploads at a larger volume. |

### Useful commands
```bash
# Live logs
sudo journalctl -u instawedds-backend -f
sudo journalctl -u instawedds-render  -f
sudo tail -f /var/log/nginx/error.log

# Quick health
curl -s https://dreamwedds.example.com/api/health | jq
curl -s http://127.0.0.1:4001/health           # from the VPS itself
```

---

## 8. Ports & Environment Cheat-Sheet

| Component | Internal port | Exposed publicly? | .env keys |
|-----------|---------------|-------------------|-----------|
| MongoDB | 27017 | No (bound to 127.0.0.1) | — |
| render-service | 4001 | No (Nginx does not proxy it) | `PORT`, optional `BROWSER_EXECUTABLE` |
| backend (FastAPI) | 8001 | Only via Nginx `/api/*` | `STORAGE_BACKEND`, `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `RENDER_SERVICE_URL`, `INTERNAL_BASE_URL` |
| frontend (static) | — | Yes (Nginx serves `/var/www/invitawedds/web/build`) | `REACT_APP_BACKEND_URL` (build-time only) |

`STORAGE_BACKEND` defaults to `memory` for local development. Set it to `mongodb` in deployments that require persistent database storage; MongoDB connection failures then stop the backend instead of silently switching modes.

---

## 9. Scaling notes

- Rendering is CPU-heavy (Chromium + ffmpeg). Each concurrent render burns ~1 vCPU + ~1 GB RAM.
- To scale horizontally: put multiple `render-service` instances behind an internal load balancer and point `RENDER_SERVICE_URL` at it — the backend polling and job records already work with any single node responding.
- For heavy volume, move `renders/` to object storage (S3) and return signed URLs instead of streaming from local disk.
- Mongo is tiny (metadata only) — a single instance handles millions of jobs; upgrade to a replica set only when you need HA.

---

**That's it.** After §2 you have a hardened single-server deployment; after §3 you have the same in containers. Report issues in `journalctl -u instawedds-backend -u instawedds-render` and Nginx logs first — most problems surface there within 30 seconds.
