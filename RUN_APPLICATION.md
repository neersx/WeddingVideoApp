# Run InvitaWedds Application

This document covers the everyday commands to run, stop, restart, test, and redeploy the InvitaWedds app.

The application has three parts:

- Backend API: FastAPI on `127.0.0.1:8001`
- Render service: Remotion service on `127.0.0.1:4001`
- Frontend: React app on `localhost:3000` locally, static nginx files on the VPS

## Local Development

Open three terminals from the project root.

### 1. Run Backend

```bash
cd backend
source .venv/bin/activate
uvicorn server:app --host 127.0.0.1 --port 8001
```

With Google Login enabled:

```bash
cd backend
source .venv/bin/activate
GOOGLE_CLIENT_ID="95024189124-gbdnijjj522h2vsgaacippj1ggoakbqv.apps.googleusercontent.com" \
uvicorn server:app --host 127.0.0.1 --port 8001
```

### 2. Run Render Service

```bash
cd render-service
npm run start
```

### 3. Run Frontend

```bash
cd frontend
REACT_APP_BACKEND_URL=http://localhost:8001 npm run start
```

With Google Login enabled:

```bash
cd frontend
REACT_APP_BACKEND_URL=http://localhost:8001 \
REACT_APP_GOOGLE_CLIENT_ID="95024189124-gbdnijjj522h2vsgaacippj1ggoakbqv.apps.googleusercontent.com" \
npm run start
```

Open:

```text
http://localhost:3000
```

Create Video page:

```text
http://localhost:3000/create-video
```

## Local Health Checks

```bash
curl -fsS http://127.0.0.1:8001/api/health
curl -fsS http://127.0.0.1:4001/health
curl -I http://127.0.0.1:3000/create-video
```

## Stop Local Services

Press `Ctrl+C` in each terminal where backend, render service, and frontend are running.

## Production VPS

Production paths:

```text
Repository: /var/www/invitawedds/WeddingVideoApp
Frontend build: /var/www/invitawedds/web/build
Backend env: /etc/invitawedds/backend.env
Render env: /etc/invitawedds/render.env
Nginx config: /etc/nginx/conf.d/invitawedds.com.conf
SSL certs: /var/www/invitawedds/web/ssl
```

Production services:

```text
instawedds-backend.service
instawedds-render.service
nginx
```

## Start Production Services

```bash
sudo systemctl start instawedds-backend.service
sudo systemctl start instawedds-render.service
sudo systemctl start nginx
```

## Stop Production Services

```bash
sudo systemctl stop instawedds-backend.service
sudo systemctl stop instawedds-render.service
sudo systemctl stop nginx
```

## Restart Production Services

```bash
sudo systemctl restart instawedds-backend.service
sudo systemctl restart instawedds-render.service
sudo systemctl reload nginx
```

Use `reload nginx` when only nginx config/static routing changed. Use `restart nginx` only when reload fails or nginx is stopped.

## Check Production Status

```bash
sudo systemctl status instawedds-backend.service
sudo systemctl status instawedds-render.service
sudo systemctl status nginx
```

Follow backend/render logs:

```bash
sudo journalctl -u instawedds-backend.service -u instawedds-render.service -f
```

Follow nginx errors:

```bash
sudo tail -f /var/log/nginx/error.log
```

## Production Health Checks

```bash
curl -fsS http://127.0.0.1:8001/api/health
curl -fsS http://127.0.0.1:4001/health
curl -I https://invitavideos.com
curl -I https://invitavideos.com/api/health
```

## Safe Redeploy

Use this after code changes. It does not overwrite nginx or SSL files.

```bash
cd /var/www/invitawedds/WeddingVideoApp
sudo bash deploy/redeploy-app.sh
```

With Google Login enabled:

```bash
cd /var/www/invitawedds/WeddingVideoApp
sudo GOOGLE_CLIENT_ID="YOUR_GOOGLE_WEB_CLIENT_ID" bash deploy/redeploy-app.sh
```

With MongoDB env updates:

```bash
cd /var/www/invitawedds/WeddingVideoApp
sudo STORAGE_BACKEND=mongodb \
  MONGO_URL='mongodb://invitavideo_app:YOUR_ENCODED_PASSWORD@127.0.0.1:27017/invitavideodb?authSource=invitavideodb' \
  DB_NAME=invitavideodb \
  bash deploy/redeploy-app.sh
```

With Google reCAPTCHA v3 enabled for video rendering:

```bash
cd /var/www/invitawedds/WeddingVideoApp
sudo RECAPTCHA_SITE_KEY="YOUR_RECAPTCHA_V3_SITE_KEY" \
  RECAPTCHA_SECRET_KEY="YOUR_RECAPTCHA_V3_SECRET_KEY" \
  RECAPTCHA_SCORE_THRESHOLD=0.5 \
  RECAPTCHA_EXPECTED_ACTION=render_video \
  ADMIN_EMAILS="you@example.com" \
  bash deploy/redeploy-app.sh
```

The safe redeploy script:

- pulls latest code when the repo is a Git checkout
- repairs frontend file ownership
- installs frontend dependencies
- builds React with `REACT_APP_BACKEND_URL`
- copies the build to `/var/www/invitawedds/web/build`
- reuses the existing `GOOGLE_CLIENT_ID` from `/etc/invitawedds/backend.env` when you do not pass one
- updates supplied backend env values such as `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS`, `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`, `RECAPTCHA_SCORE_THRESHOLD`, `RECAPTCHA_EXPECTED_ACTION`, `STORAGE_BACKEND`, `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `RENDER_SERVICE_URL`, and `INTERNAL_BASE_URL`
- restarts backend and render services
- does not change nginx or SSL

## Full Ubuntu Install

Use this only for first-time installation or when you intentionally want the script to write services and nginx config:

```bash
cd /var/www/invitawedds/WeddingVideoApp
sudo DOMAIN=invitavideos.com \
  GOOGLE_CLIENT_ID="YOUR_GOOGLE_WEB_CLIENT_ID" \
  bash deploy/ubuntu-deploy.sh
```

For this project, prefer `deploy/redeploy-app.sh` after the site is already working with manual SSL.

## Apply Nginx Config Changes

Only run this when you intentionally changed `deploy/nginx/invitawedds.com.conf`.

```bash
cd /var/www/invitawedds/WeddingVideoApp
sudo cp deploy/nginx/invitawedds.com.conf /etc/nginx/conf.d/invitawedds.com.conf
sudo nginx -t
sudo systemctl reload nginx
```

## Common Fixes

### Frontend npm permission error

If npm fails with `EACCES` inside `frontend/node_modules`:

```bash
sudo mkdir -p /var/lib/invitawedds/.npm
sudo chown -R invitawedds:invitawedds \
  /var/www/invitawedds/WeddingVideoApp/frontend \
  /var/lib/invitawedds/.npm
```

Then rerun:

```bash
sudo bash deploy/redeploy-app.sh
```

### Uploaded images return 404

Make sure nginx routes all `/api/` URLs to FastAPI before the static asset cache rule:

```nginx
location ^~ /api/ {
    proxy_pass http://invitawedds_backend;
}
```

Then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Google Login not visible

Confirm the frontend was built with:

```bash
REACT_APP_GOOGLE_CLIENT_ID="YOUR_GOOGLE_WEB_CLIENT_ID"
REACT_APP_ADMIN_EMAILS="you@example.com"
REACT_APP_RECAPTCHA_SITE_KEY="YOUR_RECAPTCHA_V3_SITE_KEY"
```

Confirm backend env has:

```bash
sudo grep GOOGLE_CLIENT_ID /etc/invitawedds/backend.env
sudo grep ADMIN_EMAILS /etc/invitawedds/backend.env
sudo grep RECAPTCHA /etc/invitawedds/backend.env
```

Then restart backend:

```bash
sudo systemctl restart instawedds-backend.service
```

## Expo mobile app

The mobile client lives in [`mobile/`](mobile/README.md) and uses the same API and render queue as the web app:

```bash
cd mobile
npm install
cp .env.example .env
npm start
```

Set the API URL for the device being used:

```env
# iOS Simulator
EXPO_PUBLIC_API_URL=http://127.0.0.1:8001/api

# Android Emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:8001/api

# Physical iPhone or Android phone (replace with the Mac's LAN IP)
EXPO_PUBLIC_API_URL=http://YOUR-LAN-IP:8001/api
```

For a physical phone, start Uvicorn with `--host 0.0.0.0` and keep the phone and Mac on the same network. Restart Metro with `npx expo start --clear` after changing any `EXPO_PUBLIC_*` value. Configure the Expo Google client IDs in `.env` before using the Google sign-in button.
