#!/usr/bin/env bash
# Update QAS from GitHub — run as root ON the server:
#   bash /opt/QAS/deploy/update.sh
set -euo pipefail

cd /opt/QAS
echo "==> Pulling latest from GitHub"
git pull --ff-only

echo "==> Backend dependencies"
backend/venv/bin/pip install -q -r backend/requirements.txt

echo "==> Frontend build"
(cd frontend && npm ci --silent && npm run build)

chown -R qas:qas /opt/QAS

echo "==> Restarting service"
systemctl restart qas
sleep 2
curl -sf http://127.0.0.1:8001/api/health >/dev/null && echo "QAS updated and healthy."
