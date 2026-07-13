#!/usr/bin/env bash
set -Eeuo pipefail

# chmod +x /var/www/invitawedds/WeddingVideoApp/deploy/redeploy-app.sh
# sudo bash /var/www/invitawedds/WeddingVideoApp/deploy/redeploy-app.sh
# Safe redeploy for an already-configured InvitaWedds VPS.
# This script keeps the existing nginx and SSL certificate setup untouched.

APP_USER="${APP_USER:-invitawedds}"
APP_DIR="${APP_DIR:-/var/www/invitawedds/WeddingVideoApp}"
BRANCH="${BRANCH:-main}"
FRONTEND_BACKEND_URL="${FRONTEND_BACKEND_URL:-https://invitavideos.com}"
WEB_ROOT="${WEB_ROOT:-/var/www/invitawedds/web/build}"
ENV_FILE="${ENV_FILE:-/etc/invitawedds/backend.env}"
BACKEND_SERVICE="${BACKEND_SERVICE:-instawedds-backend.service}"
RENDER_SERVICE="${RENDER_SERVICE:-instawedds-render.service}"
PULL_LATEST="${PULL_LATEST:-true}"
INSTALL_DEPS="${INSTALL_DEPS:-true}"
RESTART_SERVICES="${RESTART_SERVICES:-true}"
NPM_CACHE_DIR="${NPM_CACHE_DIR:-/var/lib/${APP_USER}/.npm}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
STORAGE_BACKEND="${STORAGE_BACKEND:-}"
MONGO_URL="${MONGO_URL:-}"
DB_NAME="${DB_NAME:-}"
CORS_ORIGINS="${CORS_ORIGINS:-}"
RENDER_SERVICE_URL="${RENDER_SERVICE_URL:-}"
INTERNAL_BASE_URL="${INTERNAL_BASE_URL:-}"

log() { printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

read_env_value() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 0
  sed -n "s|^${key}=||p" "$ENV_FILE" | tail -n 1
}

upsert_env_value() {
  local key="$1"
  local value="$2"
  local tmp
  [[ -n "$value" ]] || return 0
  [[ -f "$ENV_FILE" ]] || return 0

  tmp="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { updated = 0 }
    $0 ~ "^" key "=" {
      print key "=" value
      updated = 1
      next
    }
    { print }
    END {
      if (!updated) print key "=" value
    }
  ' "$ENV_FILE" > "$tmp"
  cat "$tmp" > "$ENV_FILE"
  rm -f "$tmp"
}

[[ "$(id -u)" -eq 0 ]] || fail "Run this script as root: sudo bash deploy/redeploy-app.sh"
[[ -d "$APP_DIR" ]] || fail "APP_DIR does not exist: $APP_DIR"
[[ -d "$APP_DIR/frontend" ]] || fail "Frontend directory not found: $APP_DIR/frontend"

if ! id "$APP_USER" >/dev/null 2>&1; then
  fail "Application user does not exist: $APP_USER"
fi

if [[ -z "$GOOGLE_CLIENT_ID" ]]; then
  GOOGLE_CLIENT_ID="$(read_env_value GOOGLE_CLIENT_ID)"
fi

log "Repairing frontend file ownership"
mkdir -p "$NPM_CACHE_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/frontend" "$NPM_CACHE_DIR"

if [[ "$PULL_LATEST" == "true" && -d "$APP_DIR/.git" ]]; then
  log "Pulling latest source from $BRANCH"
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
fi

if [[ "$INSTALL_DEPS" == "true" ]]; then
  log "Installing frontend dependencies"
  runuser -u "$APP_USER" -- bash -lc "cd '$APP_DIR/frontend' && npm_config_cache='$NPM_CACHE_DIR' npm install --legacy-peer-deps"
fi

log "Building frontend"
runuser -u "$APP_USER" -- bash -lc "cd '$APP_DIR/frontend' && npm_config_cache='$NPM_CACHE_DIR' REACT_APP_BACKEND_URL='$FRONTEND_BACKEND_URL' REACT_APP_GOOGLE_CLIENT_ID='$GOOGLE_CLIENT_ID' npm run build"

log "Publishing frontend build to $WEB_ROOT"
rm -rf "$WEB_ROOT"
mkdir -p "$WEB_ROOT"
cp -a "$APP_DIR/frontend/build/." "$WEB_ROOT/"
chown -R "$APP_USER:$APP_USER" "$WEB_ROOT"

if [[ -f "$ENV_FILE" ]]; then
  log "Updating backend environment values supplied for this redeploy"
  upsert_env_value GOOGLE_CLIENT_ID "$GOOGLE_CLIENT_ID"
  upsert_env_value STORAGE_BACKEND "$STORAGE_BACKEND"
  upsert_env_value MONGO_URL "$MONGO_URL"
  upsert_env_value DB_NAME "$DB_NAME"
  upsert_env_value CORS_ORIGINS "$CORS_ORIGINS"
  upsert_env_value RENDER_SERVICE_URL "$RENDER_SERVICE_URL"
  upsert_env_value INTERNAL_BASE_URL "$INTERNAL_BASE_URL"
fi

if [[ "$RESTART_SERVICES" == "true" ]]; then
  log "Restarting application services"
  systemctl restart "$BACKEND_SERVICE" "$RENDER_SERVICE"
fi

log "Redeploy complete"
printf 'Web root:      %s\n' "$WEB_ROOT"
printf 'Backend URL:   %s\n' "$FRONTEND_BACKEND_URL"
printf 'Services:      %s %s\n' "$BACKEND_SERVICE" "$RENDER_SERVICE"
printf 'Google login:  %s\n' "$([[ -n "$GOOGLE_CLIENT_ID" ]] && printf configured || printf not-configured)"
