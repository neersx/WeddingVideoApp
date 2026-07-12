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
sudo DOMAIN=video.dreamwedds.com CERTBOT_EMAIL=admin@example.com \
  STORAGE_BACKEND=memory bash deploy/ubuntu-deploy.sh
```

The deployment script can also be run with the new domain:

```bash
sudo DOMAIN=invitawedds.com CERTBOT_EMAIL=admin@example.com \
  STORAGE_BACKEND=memory bash deploy/ubuntu-deploy.sh
```

## Manual Nginx and systemd installation

If the application files and dependencies are already installed, copy the provided service and Nginx files:

```bash
sudo cp deploy/systemd/dreamwedds-video-backend.service /etc/systemd/system/
sudo cp deploy/systemd/dreamwedds-video-render.service /etc/systemd/system/
sudo cp deploy/nginx/invitawedds.com.conf /etc/nginx/conf.d/
sudo systemctl daemon-reload
sudo systemctl enable --now dreamwedds-video-render dreamwedds-video-backend
sudo nginx -t && sudo systemctl reload nginx
```

The Nginx file expects a Let's Encrypt certificate at `/etc/letsencrypt/live/invitawedds.com/`. The main deployment script bootstraps Nginx and obtains this certificate automatically when `CERTBOT_EMAIL` is supplied. For manual installation, create the certificate before copying the HTTPS Nginx file, or temporarily use an HTTP-only server block:

```bash
sudo certbot certonly --standalone -d invitawedds.com -d www.invitawedds.com
```

## Deploy by cloning a Git repository

```bash
sudo REPO_URL="https://github.com/your-org/WeddingVideoApp.git" \
  BRANCH=main DOMAIN=video.dreamwedds.com \
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
- `/etc/systemd/system/invitawedds-backend.service`
- `/etc/systemd/system/invitawedds-render.service`
- `/etc/nginx/conf.d/invitawedds.conf`

Useful commands:

```bash
sudo systemctl status dreamwedds-video-backend dreamwedds-video-render
sudo journalctl -u dreamwedds-video-backend -u dreamwedds-video-render -f
sudo nginx -t && sudo systemctl reload nginx
```
