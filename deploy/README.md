# Ubuntu Deployment

The deployment script is designed to run beside the existing Nginx applications. It uses local ports `8001` and `4001` for this app. The ready-made Nginx and systemd files target `invitavideos.com`.

By default, the repository is installed at `/var/www/invitawedds/WeddingVideoApp`, and the built frontend is copied to and served from `/var/www/invitawedds/web/build`.

## Before running

1. Point the DNS `A` records for `invitavideos.com` and `www.invitavideos.com` to the VPS.
2. Keep `invitawedds.com` and `www.invitawedds.com` pointed to the same VPS if you want old-domain HTTP traffic redirected to `invitavideos.com`.
3. Copy this repository to the VPS, or provide `REPO_URL` and `BRANCH`.
4. Confirm ports `8001` and `4001` are not used by another service.

Note: HTTPS redirects from `invitawedds.com` require a certificate that also covers `invitawedds.com`. The bundled `invitavideos.com` certificate covers `invitavideos.com` and `www.invitavideos.com`.

## Deploy from a copied repository

```bash
cd /path/to/WeddingVideoApp
sudo DOMAIN=invitavideos.com CERTBOT_EMAIL=admin@example.com \
  STORAGE_BACKEND=memory bash deploy/ubuntu-deploy.sh
```

If `www.invitavideos.com` also points to the same VPS, include it in the certificate request:

```bash
sudo DOMAIN=invitavideos.com CERTBOT_EMAIL=admin@example.com \
  CERTBOT_DOMAINS="invitavideos.com www.invitavideos.com" \
  STORAGE_BACKEND=memory bash deploy/ubuntu-deploy.sh
```

The script always writes an HTTP-only Nginx config first so Nginx can start before the Let's Encrypt certificate exists. When `CERTBOT_EMAIL` is supplied and `ENABLE_TLS=true`, Certbot upgrades that HTTP config to HTTPS.

Useful deployment variables:

- `DOMAIN`: primary public domain, default `invitavideos.com`.
- `LEGACY_DOMAIN`: old public domain redirected to `DOMAIN`, default `invitawedds.com`.
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
CORS_ORIGINS=https://invitavideos.com,http://invitavideos.com
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

The Nginx file expects the manually installed certificate at `/var/www/invitawedds/web/ssl/fullchain.pem` and key at `/var/www/invitawedds/web/ssl/privkey.pem`. The main deployment script can also bootstrap Nginx and obtain a Let's Encrypt certificate automatically when `CERTBOT_EMAIL` is supplied. For manual installation, create or install the certificate before copying the HTTPS Nginx file, or temporarily use an HTTP-only server block:

```bash
sudo certbot certonly --standalone -d invitavideos.com -d www.invitavideos.com
```

If Nginx fails with `cannot load certificate "/var/www/invitawedds/web/ssl/fullchain.pem"`, replace the HTTPS config with the HTTP-only bootstrap config, start Nginx, then issue or install the certificate:

```bash
sudo cp deploy/nginx/invitawedds.com.http.conf /etc/nginx/conf.d/invitawedds.com.conf
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d invitavideos.com -d www.invitavideos.com --agree-tos -m admin@example.com --redirect
sudo nginx -t && sudo systemctl reload nginx
```

## Manual Namecheap SSL certificate

If you purchased SSL from Namecheap, create the Nginx full chain by putting the domain certificate first and the CA bundle second:

```bash
cd /var/www/invitawedds/WeddingVideoApp
mkdir -p deploy/ssl/generated
awk 'NF {print} /^-----END CERTIFICATE-----$/ {print ""}' \
  deploy/ssl/invitavideos_com.crt \
  deploy/ssl/invitavideos_com.ca-bundle \
  > deploy/ssl/generated/fullchain.pem
cp deploy/ssl/privatekey deploy/ssl/generated/privkey.pem
openssl x509 -in deploy/ssl/generated/fullchain.pem -noout -subject -issuer -dates
```

Install the files in `/var/www/invitawedds/web/ssl` and lock down the private key:

```bash
sudo mkdir -p /var/www/invitawedds/web/ssl
sudo cp deploy/ssl/generated/fullchain.pem /var/www/invitawedds/web/ssl/fullchain.pem
sudo cp deploy/ssl/generated/privkey.pem /var/www/invitawedds/web/ssl/privkey.pem
sudo chown root:root /var/www/invitawedds/web/ssl/fullchain.pem /var/www/invitawedds/web/ssl/privkey.pem
sudo chmod 644 /var/www/invitawedds/web/ssl/fullchain.pem
sudo chmod 600 /var/www/invitawedds/web/ssl/privkey.pem
```

The HTTPS Nginx config uses:

```nginx
ssl_certificate /var/www/invitawedds/web/ssl/fullchain.pem;
ssl_certificate_key /var/www/invitawedds/web/ssl/privkey.pem;
```

The Nginx config blocks public access to `/ssl/`, so the key folder is not served as static content.

## Deploy by cloning a Git repository

```bash
sudo REPO_URL="https://github.com/your-org/WeddingVideoApp.git" \
  BRANCH=main DOMAIN=invitavideos.com \
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
REACT_APP_BACKEND_URL=https://invitavideos.com npm run build
```
