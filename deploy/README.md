# Ubuntu Deployment

The deployment script is designed to run beside the existing Nginx applications. It uses local ports `8001` and `4001` for this app. The ready-made Nginx and systemd files target `invitawedds.com`.

By default, the repository is installed at `/var/www/invitawedds/WeddingVideoApp`, and the built frontend is copied to and served from `/var/www/invitawedds/web/build`.

## Before running

1. Point the DNS `A` records for `invitawedds.com` and `www.invitawedds.com` to the VPS.
2. Copy this repository to the VPS, or provide `REPO_URL` and `BRANCH`.
3. Confirm ports `8001` and `4001` are not used by another service.

## Deploy from a copied repository

```bash
cd /path/to/WeddingVideoApp
sudo DOMAIN=invitawedds.com CERTBOT_EMAIL=admin@example.com \
  STORAGE_BACKEND=memory bash deploy/ubuntu-deploy.sh
```

If `www.invitawedds.com` also points to the same VPS, include it in the certificate request:

```bash
sudo DOMAIN=invitawedds.com CERTBOT_EMAIL=admin@example.com \
  CERTBOT_DOMAINS="invitawedds.com www.invitawedds.com" \
  STORAGE_BACKEND=memory bash deploy/ubuntu-deploy.sh
```

The script always writes an HTTP-only Nginx config first so Nginx can start before the Let's Encrypt certificate exists. When `CERTBOT_EMAIL` is supplied and `ENABLE_TLS=true`, Certbot upgrades that HTTP config to HTTPS.

Useful deployment variables:

- `DOMAIN`: primary public domain, default `invitawedds.com`.
- `CERTBOT_EMAIL`: Let's Encrypt account/renewal email. Leave empty for HTTP-only bootstrap.
- `CERTBOT_DOMAINS`: space-separated cert domains, default same as `DOMAIN`.
- `FRONTEND_BACKEND_URL`: build-time API origin for React, default `https://$DOMAIN` when TLS is enabled, otherwise `http://$DOMAIN`.
- `CORS_ORIGINS`: comma-separated browser origins allowed by FastAPI, default `https://$DOMAIN,http://$DOMAIN`.
- `ENABLE_TLS`: set `false` to skip Certbot and stay HTTP-only.

## Manual Nginx and systemd installation

If the application files and dependencies are already installed, copy the provided service and Nginx files:

```bash
sudo mkdir -p /etc/invitawedds
sudo tee /etc/invitawedds/backend.env >/dev/null <<'EOF'
STORAGE_BACKEND=memory
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=dreamwedds
RENDER_SERVICE_URL=http://127.0.0.1:4001
INTERNAL_BASE_URL=http://127.0.0.1:8001
CORS_ORIGINS=https://invitawedds.com,http://invitawedds.com
EOF
sudo tee /etc/invitawedds/render.env >/dev/null <<'EOF'
PORT=4001
EOF
sudo chown root:invitawedds /etc/invitawedds/*.env
sudo chmod 640 /etc/invitawedds/*.env
sudo cp deploy/systemd/instawedds-backend.service /etc/systemd/system/
sudo cp deploy/systemd/instawedds-render.service /etc/systemd/system/
sudo cp deploy/nginx/invitawedds.com.conf /etc/nginx/conf.d/
sudo systemctl daemon-reload
sudo systemctl enable --now instawedds-render instawedds-backend
sudo nginx -t && sudo systemctl reload nginx
```

The Nginx file expects a Let's Encrypt certificate at `/etc/letsencrypt/live/invitawedds.com/`. The main deployment script bootstraps Nginx and obtains this certificate automatically when `CERTBOT_EMAIL` is supplied. For manual installation, create the certificate before copying the HTTPS Nginx file, or temporarily use an HTTP-only server block:

```bash
sudo certbot certonly --standalone -d invitawedds.com -d www.invitawedds.com
```

If Nginx fails with `cannot load certificate "/etc/letsencrypt/live/invitawedds.com/fullchain.pem"`, replace the HTTPS config with the HTTP-only bootstrap config, start Nginx, then issue the certificate:

```bash
sudo cp deploy/nginx/invitawedds.com.http.conf /etc/nginx/conf.d/invitawedds.com.conf
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d invitawedds.com -d www.invitawedds.com --agree-tos -m admin@example.com --redirect
sudo nginx -t && sudo systemctl reload nginx
```

## Deploy by cloning a Git repository

```bash
sudo REPO_URL="https://github.com/your-org/WeddingVideoApp.git" \
  BRANCH=main DOMAIN=invitawedds.com \
  CERTBOT_EMAIL=admin@example.com STORAGE_BACKEND=memory \
  bash /tmp/WeddingVideoApp/deploy/ubuntu-deploy.sh
```

For MongoDB storage, set `STORAGE_BACKEND=mongodb` and provide a reachable `MONGO_URL`:

```bash
sudo STORAGE_BACKEND=mongodb \
  MONGO_URL='mongodb://user:password@127.0.0.1:27017/dreamwedds?authSource=dreamwedds' \
  DB_NAME=dreamwedds bash deploy/ubuntu-deploy.sh
```

The script writes:

- `/etc/invitawedds/backend.env`
- `/etc/invitawedds/render.env`
- `/etc/systemd/system/instawedds-backend.service`
- `/etc/systemd/system/instawedds-render.service`
- `/etc/nginx/conf.d/invitawedds.conf`

Useful commands:

```bash
sudo systemctl status instawedds-backend instawedds-render
sudo journalctl -u instawedds-backend -u instawedds-render -f
sudo nginx -t && sudo systemctl reload nginx
```

If frontend installation fails with a `react-day-picker` / `date-fns` peer dependency error, run the frontend install with:

```bash
cd /var/www/invitawedds/WeddingVideoApp/frontend
npm install --legacy-peer-deps
REACT_APP_BACKEND_URL=https://invitawedds.com npm run build
```
