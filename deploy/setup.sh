#!/usr/bin/env bash
# One-time VM setup for Caveo on Vultr Cloud Compute (Ubuntu 24.04). Run as root from /opt/caveo.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq docker.io caddy python3-venv curl gnupg ufw

# gVisor: a user-space kernel under each sandbox container (defense in depth on top of runc)
if ! command -v runsc >/dev/null; then
  curl -fsSL https://gvisor.dev/archive.key | gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
  echo "deb [arch=amd64 signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" > /etc/apt/sources.list.d/gvisor.list
  apt-get update -q && apt-get install -yq runsc
  runsc install && systemctl restart docker
fi

id caveo >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin caveo
usermod -aG docker caveo
python3 -m venv /opt/caveo/.venv
/opt/caveo/.venv/bin/pip install -q -r /opt/caveo/requirements.txt
docker build -q -t caveo-sandbox:latest /opt/caveo/sandbox

# pick the runtime: gVisor if Chromium works under it, else runc
mkdir -p /opt/caveo/data/jobs && cp /opt/caveo/data/attachments/SummitOffice_Invoice_88213.html /opt/caveo/data/jobs/t.html
if docker run --rm --runtime runsc --network none -v /opt/caveo/data/jobs:/job:ro caveo-sandbox:latest t.html 2>/dev/null | grep -q network_attempts; then
  RT=runsc; else RT=; fi
rm -f /opt/caveo/data/jobs/t.html
echo "CAVEO_SANDBOX_RUNTIME=$RT" > /etc/caveo-runtime.env
echo "sandbox runtime: ${RT:-runc}"

chown -R caveo:caveo /opt/caveo
chmod 600 /opt/caveo/.env
cp /opt/caveo/deploy/caveo.service /etc/systemd/system/caveo.service
IP=$(curl -s4 https://api.ipify.org)
HOST="caveo-$(echo "$IP" | tr . -).sslip.io"
printf '%s {\n  encode gzip\n  reverse_proxy 127.0.0.1:8088\n}\n' "$HOST" > /etc/caddy/Caddyfile
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
systemctl daemon-reload && systemctl enable --now caveo && systemctl restart caveo caddy
echo "Caveo live at https://$HOST"
