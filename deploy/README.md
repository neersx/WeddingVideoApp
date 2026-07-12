# Ubuntu Deployment

The deployment script is designed to run beside the existing `dreamwedds.com` and `quizlo.ai` Nginx applications. It creates a separate hostname, by default `video.dreamwedds.com`, and uses local ports `8001` and `4001` for this app.

## Before running

1. Point the DNS `A` record for `video.dreamwedds.com` to the VPS.
2. Copy this repository to the VPS, or provide `REPO_URL` and `BRANCH`.
3. Confirm ports `8001` and `4001` are not used by another service.

## Deploy from a copied repository

```bash
cd /path/to/WeddingVideoApp
sudo DOMAIN=video.dreamwedds.com CERTBOT_EMAIL=admin@example.com \
  STORAGE_BACKEND=memory bash deploy/ubuntu-deploy.sh
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

- `/etc/dreamwedds-video/backend.env`
- `/etc/dreamwedds-video/render.env`
- `/etc/systemd/system/dreamwedds-video-backend.service`
- `/etc/systemd/system/dreamwedds-video-render.service`
- `/etc/nginx/conf.d/dreamwedds-video.conf`

Useful commands:

```bash
sudo systemctl status dreamwedds-video-backend dreamwedds-video-render
sudo journalctl -u dreamwedds-video-backend -u dreamwedds-video-render -f
sudo nginx -t && sudo systemctl reload nginx
```
