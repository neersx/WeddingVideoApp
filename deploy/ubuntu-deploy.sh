#!/usr/bin/env bash
set -Eeuo pipefail

# DreamWedds Wedding Video App deployment for Ubuntu 22.04/24.04.
# Run as root on the VPS. Override the variables below through the environment.

APP_NAME="${APP_NAME:-invitawedds}"
APP_USER="${APP_USER:-invitawedds}"
APP_DIR="${APP_DIR:-/var/www/invitawedds/WeddingVideoApp}"
DOMAIN="${DOMAIN:-invitawedds.com}"
SOURCE_DIR="${SOURCE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-main}"
STORAGE_BACKEND="${STORAGE_BACKEND:-memory}"
MONGO_URL="${MONGO_URL:-mongodb://127.0.0.1:27017}"
DB_NAME="${DB_NAME:-dreamwedds}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
ENABLE_TLS="${ENABLE_TLS:-true}"

BACKEND_PORT="${BACKEND_PORT:-8001}"
RENDER_PORT="${RENDER_PORT:-4001}"
WEB_ROOT="${WEB_ROOT:-/var/www/invitawedds/web/build}"
ENV_FILE="/etc/${APP_NAME}/backend.env"
RENDER_ENV_FILE="/etc/${APP_NAME}/render.env"

log() { printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || fail "Run this script as root: sudo bash deploy/ubuntu-deploy.sh"
[[ "$STORAGE_BACKEND" == "memory" || "$STORAGE_BACKEND" == "mongodb" ]] || fail "STORAGE_BACKEND must be memory or mongodb"
[[ -d "$SOURCE_DIR" ]] || fail "SOURCE_DIR does not exist: $SOURCE_DIR"

export DEBIAN_FRONTEND=noninteractive

log "Installing OS packages"
apt-get update
apt-get install -y git nginx python3 python3-venv python3-pip nodejs npm rsync curl

if [[ -n "$REPO_URL" ]]; then
  log "Syncing source from $REPO_URL"
  mkdir -p "$(dirname "$APP_DIR")"
  if [[ -d "$APP_DIR/.git" ]]; then
    git -C "$APP_DIR" fetch origin "$BRANCH"
    git -C "$APP_DIR" checkout "$BRANCH"
    git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
  else
    if [[ -e "$APP_DIR" ]] && [[ -n "$(find "$APP_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
      fail "APP_DIR exists and is not an empty Git checkout: $APP_DIR"
    fi
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
else
  if [[ "$(realpath -m "$SOURCE_DIR")" == "$(realpath -m "$APP_DIR")" ]]; then
    log "Using application source already present at $APP_DIR"
  else
    log "Syncing source from $SOURCE_DIR"
    mkdir -p "$APP_DIR"
    rsync -a --exclude '.git' --exclude 'backend/.venv' --exclude 'frontend/node_modules' --exclude 'render-service/node_modules' "$SOURCE_DIR/" "$APP_DIR/"
  fi
fi

log "Creating service account and directories"
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "/var/lib/${APP_NAME}" --create-home --shell /usr/sbin/nologin "$APP_USER"
fi
mkdir -p "/etc/${APP_NAME}" "$WEB_ROOT" "$APP_DIR/backend/uploads" "$APP_DIR/backend/renders"
chown -R "$APP_USER:$APP_USER" "/var/lib/${APP_NAME}" "$APP_DIR" "/etc/${APP_NAME}"

log "Installing backend dependencies"
runuser -u "$APP_USER" -- bash -lc "cd '$APP_DIR/backend' && python3 -m venv .venv && .venv/bin/pip install --upgrade pip && .venv/bin/pip install -r requirements.txt"

log "Installing renderer dependencies"
runuser -u "$APP_USER" -- bash -lc "cd '$APP_DIR/render-service' && npm install --omit=dev"

log "Building frontend"
runuser -u "$APP_USER" -- bash -lc "cd '$APP_DIR/frontend' && npm install --omit=dev && REACT_APP_BACKEND_URL='https://${DOMAIN}' npm run build"
rm -rf "$WEB_ROOT"
mkdir -p "$WEB_ROOT"
cp -a "$APP_DIR/frontend/build/." "$WEB_ROOT/"
chown -R "$APP_USER:$APP_USER" "$(dirname "$WEB_ROOT")"

log "Writing backend configuration"
cat > "$ENV_FILE" <<EOF
STORAGE_BACKEND=$STORAGE_BACKEND
MONGO_URL=$MONGO_URL
DB_NAME=$DB_NAME
RENDER_SERVICE_URL=http://127.0.0.1:$RENDER_PORT
INTERNAL_BASE_URL=http://127.0.0.1:$BACKEND_PORT
CORS_ORIGINS=https://$DOMAIN
EOF

cat > "$RENDER_ENV_FILE" <<EOF
PORT=$RENDER_PORT
EOF
chown root:"$APP_USER" "$ENV_FILE" "$RENDER_ENV_FILE"
chmod 640 "$ENV_FILE" "$RENDER_ENV_FILE"

log "Writing systemd services"
cat > "/etc/systemd/system/${APP_NAME}-backend.service" <<EOF
[Unit]
Description=DreamWedds Wedding Video API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=$ENV_FILE
ExecStart=$APP_DIR/backend/.venv/bin/uvicorn server:app --host 127.0.0.1 --port $BACKEND_PORT
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

cat > "/etc/systemd/system/${APP_NAME}-render.service" <<EOF
[Unit]
Description=DreamWedds Remotion Render Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR/render-service
EnvironmentFile=$RENDER_ENV_FILE
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=false

[Install]
WantedBy=multi-user.target
EOF

log "Writing isolated Nginx configuration for $DOMAIN"
cat > "/etc/nginx/conf.d/${APP_NAME}.conf" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    client_max_body_size 50M;
    root $WEB_ROOT;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 900s;
        proxy_send_timeout 900s;
    }

    location ~* \.(?:js|css|png|jpg|jpeg|gif|ico|svg|webp|woff2?|ttf|json)$ {
        access_log off;
        expires 7d;
        add_header Cache-Control "public";
        try_files \$uri =404;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

nginx -t
systemctl daemon-reload
systemctl enable --now "${APP_NAME}-render.service" "${APP_NAME}-backend.service"
systemctl restart "${APP_NAME}-render.service" "${APP_NAME}-backend.service"

if [[ "$ENABLE_TLS" == "true" ]]; then
  if [[ -z "$CERTBOT_EMAIL" ]]; then
    log "ENABLE_TLS=true but CERTBOT_EMAIL is empty; install is complete with HTTP only"
    log "Run: certbot --nginx -d $DOMAIN"
  else
    log "Installing HTTPS certificate for $DOMAIN"
    apt-get install -y certbot python3-certbot-nginx
    certbot --nginx --non-interactive --agree-tos --redirect -m "$CERTBOT_EMAIL" -d "$DOMAIN"
  fi
fi

log "Deployment complete"
printf 'Web URL:       https://%s\n' "$DOMAIN"
printf 'Storage mode:  %s\n' "$STORAGE_BACKEND"
printf 'Health check:  curl -fsS http://127.0.0.1:%s/api/health\n' "$BACKEND_PORT"
printf 'Logs:          journalctl -u %s-backend -u %s-render -f\n' "$APP_NAME" "$APP_NAME"
