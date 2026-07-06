#!/usr/bin/env bash
# One-time provisioning of a fresh Ubuntu 24.04 server for QAS.
# Run as root. Usage: bash provision.sh [domain]
# With a domain, Caddy serves HTTPS via Let's Encrypt; without, plain HTTP on 80.
set -euo pipefail

DOMAIN="${1:-}"

echo "==> System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq python3-venv python3-pip postgresql rsync ufw \
  debian-keyring debian-archive-keyring apt-transport-https curl

echo "==> Caddy (official repo)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q && apt-get install -yq caddy
fi

echo "==> App user + directories"
id -u qas &>/dev/null || useradd --system --create-home --shell /usr/sbin/nologin qas
mkdir -p /opt/QAS
chown -R qas:qas /opt/QAS

echo "==> PostgreSQL (localhost only, strong password)"
DB_PASS="$(openssl rand -base64 24 | tr -d '/+=')"
sudo -u postgres psql <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'qas') THEN
    CREATE USER qas WITH PASSWORD '${DB_PASS}';
  ELSE
    ALTER USER qas WITH PASSWORD '${DB_PASS}';
  END IF;
END \$\$;
SQL
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='qas'" | grep -q 1 \
  || sudo -u postgres createdb -O qas qas

echo "==> Backend .env"
SECRET_KEY="$(openssl rand -base64 48 | tr -d '/+=')"
mkdir -p /opt/QAS/backend
install -o qas -g qas -m 600 /dev/null /opt/QAS/backend/.env
cat > /opt/QAS/backend/.env <<ENV
DATABASE_URL=postgresql+psycopg://qas:${DB_PASS}@localhost:5432/qas
SECRET_KEY=${SECRET_KEY}
ACCESS_TOKEN_EXPIRE_MINUTES=720
CORS_ORIGINS=
UPLOAD_DIR=/opt/QAS/backend/uploads
ENV

echo "==> systemd service"
cat > /etc/systemd/system/qas.service <<'UNIT'
[Unit]
Description=QAS — Quality, Security & Environment
After=network.target postgresql.service

[Service]
User=qas
Group=qas
WorkingDirectory=/opt/QAS/backend
ExecStart=/opt/QAS/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=/opt/QAS/backend/uploads

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload

echo "==> Caddy reverse proxy"
if [ -n "$DOMAIN" ]; then
  SITE="$DOMAIN"
else
  SITE=":80"
fi
cat > /etc/caddy/Caddyfile <<CADDY
${SITE} {
    reverse_proxy 127.0.0.1:8000
    encode gzip
}
CADDY
systemctl enable caddy

echo "==> Firewall (SSH, HTTP, HTTPS only)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Nightly database backup (kept 14 days)"
mkdir -p /var/backups/qas && chown postgres:postgres /var/backups/qas
cat > /etc/cron.daily/qas-backup <<'CRON'
#!/bin/sh
sudo -u postgres pg_dump qas | gzip > /var/backups/qas/qas-$(date +%F).sql.gz
find /var/backups/qas -name 'qas-*.sql.gz' -mtime +14 -delete
CRON
chmod +x /etc/cron.daily/qas-backup

echo "==> Done. Now run deploy.sh from the dev machine, then: systemctl start qas caddy"
