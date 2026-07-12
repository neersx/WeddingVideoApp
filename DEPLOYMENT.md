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
  chromium-browser \
  libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2 libpango-1.0-0 libcairo2
```

Firewall (allow SSH + HTTP + HTTPS only; DB and internal ports stay closed):
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### 2.2 Install Python 3.11, Node 20, Yarn

```bash
sudo apt install -y python3.11 python3.11-venv python3-pip
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g yarn
```

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
sudo useradd -m -s /bin/bash dreamwedds
sudo mkdir -p /opt/dreamwedds
sudo chown dreamwedds:dreamwedds /opt/dreamwedds
sudo -iu dreamwedds
```

### 2.5 Deploy code

As `dreamwedds`:
```bash
cd /opt/dreamwedds
git clone <YOUR_REPO_URL> app
cd app
```

### 2.6 Backend (production)

```bash
cd /opt/dreamwedds/app/backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn uvicorn[standard]
```

Create `/opt/dreamwedds/app/backend/.env`:
```bash
STORAGE_BACKEND="mongodb"
MONGO_URL="mongodb://dreamwedds_app:CHANGE_ME_STRONG_APP_PW@127.0.0.1:27017/dreamwedds?authSource=dreamwedds"
DB_NAME="dreamwedds"
CORS_ORIGINS="https://dreamwedds.example.com"
RENDER_SERVICE_URL="http://127.0.0.1:4001"
INTERNAL_BASE_URL="http://127.0.0.1:8001"
```

Persist uploads/renders on a dedicated data volume (optional but recommended):
```bash
sudo mkdir -p /var/lib/dreamwedds/{uploads,renders}
sudo chown -R dreamwedds:dreamwedds /var/lib/dreamwedds
# symlink so code paths keep working
ln -sfn /var/lib/dreamwedds/uploads /opt/dreamwedds/app/backend/uploads
ln -sfn /var/lib/dreamwedds/renders /opt/dreamwedds/app/backend/renders
```

### 2.7 Render-service (production)

```bash
cd /opt/dreamwedds/app/render-service
yarn install --frozen-lockfile
# Pre-warm Remotion's browser
npx remotion browser ensure
```

Environment file `/opt/dreamwedds/app/render-service/.env` (optional):
```bash
PORT=4001
# Uncomment to use system chromium instead of the Remotion-managed one:
# BROWSER_EXECUTABLE=/usr/bin/chromium-browser
```

### 2.8 Frontend build

```bash
cd /opt/dreamwedds/app/frontend
yarn install --frozen-lockfile
# .env for the build
cat > .env <<'EOF'
REACT_APP_BACKEND_URL=https://dreamwedds.example.com
EOF
yarn build   # outputs to ./build
```

The `build/` folder is what Nginx serves.

### 2.9 systemd services

**Backend** — `/etc/systemd/system/dreamwedds-backend.service`:
```ini
[Unit]
Description=DreamWedds FastAPI backend
After=network.target mongod.service
Requires=mongod.service

[Service]
Type=simple
User=dreamwedds
WorkingDirectory=/opt/dreamwedds/app/backend
EnvironmentFile=/opt/dreamwedds/app/backend/.env
ExecStart=/opt/dreamwedds/app/backend/.venv/bin/uvicorn server:app \
  --host 127.0.0.1 --port 8001 --workers 2 --proxy-headers
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

**Render-service** — `/etc/systemd/system/dreamwedds-render.service`:
```ini
[Unit]
Description=DreamWedds Remotion render service
After=network.target

[Service]
Type=simple
User=dreamwedds
WorkingDirectory=/opt/dreamwedds/app/render-service
EnvironmentFile=-/opt/dreamwedds/app/render-service/.env
Environment=NODE_ENV=production
ExecStart=/opt/dreamwedds/app/render-service/node_modules/.bin/tsx src/index.ts
Restart=always
RestartSec=5
# Chromium needs a decent memory ceiling
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

Enable + start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dreamwedds-render dreamwedds-backend
sudo systemctl status dreamwedds-render dreamwedds-backend
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

    root /opt/dreamwedds/app/frontend/build;
    index index.html;

    # Large uploads/downloads (photos + rendered mp4s)
    client_max_body_size 25M;

    # Long timeouts because /api/renders/{id}/video can stream ~10MB+ files
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    # API → FastAPI on 127.0.0.1:8001
    location /api/ {
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
rclone sync /var/lib/dreamwedds/renders  remote:dreamwedds/renders
rclone sync /var/lib/dreamwedds/uploads  remote:dreamwedds/uploads
```

### 5.3 Cleanup policy (recommended)

Renders accumulate. Add a cron to prune files older than 30 days:
```bash
0 3 * * * dreamwedds find /var/lib/dreamwedds/renders -type f -mtime +30 -delete
```
(Mongo docs will still reference them; adjust `list_renders` if you want to hide broken ones.)

---

## 6. Updating / Redeploying

```bash
sudo -iu dreamwedds
cd /opt/dreamwedds/app
git pull

# Backend deps changed?
cd backend && source .venv/bin/activate && pip install -r requirements.txt

# Frontend rebuild
cd ../frontend && yarn install --frozen-lockfile && yarn build

# Render-service deps changed?
cd ../render-service && yarn install --frozen-lockfile
```

Reload services (as sudoer):
```bash
sudo systemctl restart dreamwedds-backend dreamwedds-render
sudo systemctl reload nginx    # only if nginx config changed
```

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `render_service.status: unreachable` in `/api/health` | `systemctl status dreamwedds-render` — the first boot takes 20-40s to bundle. Check `journalctl -u dreamwedds-render -n 200`. |
| Rendering fails with `SIGTRAP` / Chromium crash | Ensure the systemd unit is running under a real user (not root) or set `BROWSER_EXECUTABLE=/usr/bin/chromium-browser`. Remotion internally passes `--no-sandbox`. |
| 413 Request Entity Too Large on photo upload | Increase `client_max_body_size` in Nginx (currently 25M). |
| `MongoServerError: Authentication failed` | Confirm `authSource=dreamwedds` is in `MONGO_URL`. Verify the app user was created inside the `dreamwedds` DB. |
| Long renders time out via Nginx | Increase `proxy_read_timeout` (default here is 300s); or rely on client polling — the current flow doesn't hold connections open, so timeouts shouldn't hit the render call. |
| CORS blocked in browser | `CORS_ORIGINS` in `backend/.env` must exactly match your frontend origin (scheme + host, no trailing slash). Restart backend after change. |
| Out of disk on `/var/lib/dreamwedds` | Enable the retention cron in §5.3 or point renders/uploads at a larger volume. |

### Useful commands
```bash
# Live logs
sudo journalctl -u dreamwedds-backend -f
sudo journalctl -u dreamwedds-render  -f
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
| frontend (static) | — | Yes (Nginx serves `/opt/dreamwedds/app/frontend/build`) | `REACT_APP_BACKEND_URL` (build-time only) |

`STORAGE_BACKEND` defaults to `memory` for local development. Set it to `mongodb` in deployments that require persistent database storage; MongoDB connection failures then stop the backend instead of silently switching modes.

---

## 9. Scaling notes

- Rendering is CPU-heavy (Chromium + ffmpeg). Each concurrent render burns ~1 vCPU + ~1 GB RAM.
- To scale horizontally: put multiple `render-service` instances behind an internal load balancer and point `RENDER_SERVICE_URL` at it — the backend polling and job records already work with any single node responding.
- For heavy volume, move `renders/` to object storage (S3) and return signed URLs instead of streaming from local disk.
- Mongo is tiny (metadata only) — a single instance handles millions of jobs; upgrade to a replica set only when you need HA.

---

**That's it.** After §2 you have a hardened single-server deployment; after §3 you have the same in containers. Report issues in `journalctl -u dreamwedds-*` and Nginx logs first — most problems surface there within 30 seconds.
