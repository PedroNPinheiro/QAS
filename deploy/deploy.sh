#!/usr/bin/env bash
# Deploy/update QAS on the server, run FROM the dev machine.
# Usage: bash deploy.sh <server-ip> [--with-data]
#   --with-data  also restore the local dump (deploy/qas-data.sql) and uploads
#                — use on the FIRST deploy only.
set -euo pipefail

[ $# -ge 1 ] || { echo "usage: deploy.sh <server-ip> [--with-data]"; exit 1; }
SERVER="root@$1"
WITH_DATA="${2:-}"
KEY="$HOME/.ssh/qas_deploy"
SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new"
cd "$(dirname "$0")/.."

echo "==> Building frontend"
(cd frontend && npm run build)

echo "==> Syncing code"
rsync -az --delete -e "$SSH" \
  --exclude 'venv' --exclude '__pycache__' --exclude '.env' --exclude 'uploads' \
  backend "$SERVER:/opt/QAS/"
rsync -az --delete -e "$SSH" frontend/dist "$SERVER:/opt/QAS/frontend/"
$SSH "$SERVER" 'mkdir -p /opt/QAS/deploy'
rsync -az -e "$SSH" deploy/qas-data.sql "$SERVER:/opt/QAS/deploy/" 2>/dev/null || true
if [ "$WITH_DATA" = "--with-data" ]; then
  rsync -az -e "$SSH" backend/uploads "$SERVER:/opt/QAS/backend/"
fi

echo "==> Installing dependencies and restarting"
$SSH "$SERVER" WITH_DATA="$WITH_DATA" bash -s <<'REMOTE'
set -euo pipefail
cd /opt/QAS/backend
[ -d venv ] || python3 -m venv venv
./venv/bin/pip install -q -r requirements.txt
mkdir -p uploads

if [ "${WITH_DATA:-}" = "--with-data" ]; then
  echo "==> Restoring database dump"
  DB_PASS=$(grep -oP '(?<=//qas:)[^@]+' .env)
  PGPASSWORD="$DB_PASS" psql -h localhost -U qas -d qas -q -f /opt/QAS/deploy/qas-data.sql
fi

chown -R qas:qas /opt/QAS
systemctl enable --now qas caddy >/dev/null 2>&1 || true
systemctl restart qas
systemctl reload caddy || systemctl restart caddy
sleep 2
curl -sf http://127.0.0.1:8000/api/health >/dev/null && echo "backend health: OK"
REMOTE

echo "==> Deployed."
