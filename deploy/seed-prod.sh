#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Zapdos — seed the production DB
#
# Runs inside the `web` container on the web VM:
#   1. prisma migrate deploy  (apply schema)
#   2. import Codeforces problems (200 easy problems)
#
# Idempotent — re-running upserts by slug.
# ============================================================

ZONE=$(gcloud config get-value compute/zone)

echo "▶ Running Prisma migrations..."
gcloud compute ssh zapdos-web --zone="$ZONE" --ssh-flag="-o StrictHostKeyChecking=no" --command='
  cd zapdos
  sudo docker compose --env-file .env.production -f deploy/docker-compose.web.yml exec -T web \
    pnpm --filter @zapdos/db migrate:deploy
'

echo "▶ Importing 200 Codeforces problems..."
gcloud compute ssh zapdos-web --zone="$ZONE" --ssh-flag="-o StrictHostKeyChecking=no" --command='
  cd zapdos
  sudo docker compose --env-file .env.production -f deploy/docker-compose.web.yml exec -T web \
    pnpm --filter web import-codeforces
'

echo ""
echo "✓ DB seeded. Your app is ready at:"
WEB_ADDRESS=$(gcloud compute addresses describe zapdos-web-ip --region="$(gcloud config get-value compute/region)" --format='value(address)')
echo "  http://$WEB_ADDRESS"
