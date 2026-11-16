#!/usr/bin/env bash
set -euo pipefail

# Setup script for Tulusy FastAPI Backend on Ubuntu (Hetzner + ServerAvatar)
# Usage:
#   cd /path/to/repo && sudo bash deploy/setup-backend.sh
#   (Auto-detects the repo directory when run from inside the repo; optionally pass APP_ROOT and SERVICE_USER.)
# Example:
#   sudo bash deploy/setup-backend.sh /home/tulusy/apps/tulusy-cc

APP_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKEND_DIR="$APP_ROOT/backend"
SERVICE_USER="${2:-$(stat -c '%U' "$APP_ROOT")}"

if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "ERROR: Backend directory not found at $BACKEND_DIR"
  exit 1
fi

echo "==> Installing system dependencies for Pillow, HEIF, PyMuPDF, and rlPyCairo..."
apt-get update -y
apt-get install -y \
  python3 python3-venv python3-dev build-essential pkg-config \
  libcairo2 libcairo2-dev libjpeg-dev zlib1g-dev libfreetype6-dev \
  libheif-dev libffi-dev fonts-dejavu-core fonts-liberation

echo "==> Creating Python virtual environment in $BACKEND_DIR/.venv..."
sudo -u "$SERVICE_USER" python3 -m venv "$BACKEND_DIR/.venv"
sudo -u "$SERVICE_USER" "$BACKEND_DIR/.venv/bin/pip" install --upgrade pip wheel
sudo -u "$SERVICE_USER" "$BACKEND_DIR/.venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt"

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  echo "==> Creating $BACKEND_DIR/.env from .env.example (fill in R2 & relay secrets!)..."
  sudo -u "$SERVICE_USER" cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  chmod 600 "$BACKEND_DIR/.env"
fi

echo "==> Ensuring runtime directories and ownership for $SERVICE_USER..."
mkdir -p "$BACKEND_DIR/data/hosted_files" "$BACKEND_DIR/temp/uploads" "$BACKEND_DIR/temp/outputs"
chown -R "$SERVICE_USER:$SERVICE_USER" "$BACKEND_DIR/data" "$BACKEND_DIR/temp" "$BACKEND_DIR/.env"

echo "==> Installing systemd service /etc/systemd/system/tulusy-backend.service..."
sed \
  -e "s|__APP_USER__|$SERVICE_USER|g" \
  -e "s|__BACKEND_DIR__|$BACKEND_DIR|g" \
  "$APP_ROOT/deploy/tulusy-backend.service" > /etc/systemd/system/tulusy-backend.service

systemctl daemon-reload
systemctl enable tulusy-backend
systemctl restart tulusy-backend
systemctl status tulusy-backend --no-pager

echo ""
echo "==> Backend setup complete!"
echo "    1. Edit $BACKEND_DIR/.env with your Cloudflare R2 credentials & CF_WORKER_RELAY_URL"
echo "    2. Run: sudo systemctl restart tulusy-backend"
echo "    3. Verify: curl -s http://127.0.0.1:8480/api/health"
