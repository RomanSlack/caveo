#!/usr/bin/env bash
# Sync code to the VM and restart. Usage: deploy/push.sh <ip>
set -euo pipefail
IP=$1; cd "$(dirname "$0")/.."
rsync -az --delete -e "ssh -i ~/.ssh/caveo_vultr" --exclude .git --exclude research --exclude 'data/runs' --exclude 'data/jobs' \
  --exclude 'data/uploads' --exclude 'data/caveo.db' --exclude __pycache__ --exclude 'video/node_modules' --exclude 'video/out' --exclude .venv ./ root@$IP:/opt/caveo/
ssh -i ~/.ssh/caveo_vultr root@$IP "chown -R caveo:caveo /opt/caveo && chmod 600 /opt/caveo/.env && (docker build -q -t caveo-sandbox:latest /opt/caveo/sandbox >/dev/null) && systemctl restart caveo"
