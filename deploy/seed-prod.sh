#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Zapdos — seed the production DB
#
# Runs inside the `web` container on the web VM:
#   1. prisma migrate deploy  (apply schema)
#   2. prisma seed            (9 hand-authored problems)
#   3. scrape CSES            (394 real problems)
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

echo "▶ Seeding 9 hand-authored problems..."
gcloud compute ssh zapdos-web --zone="$ZONE" --ssh-flag="-o StrictHostKeyChecking=no" --command='
  cd zapdos
  sudo docker compose --env-file .env.production -f deploy/docker-compose.web.yml exec -T web \
    pnpm --filter @zapdos/db seed
'

echo "▶ Scraping 394 CSES problems (this takes ~2-4 min)..."
gcloud compute ssh zapdos-web --zone="$ZONE" --ssh-flag="-o StrictHostKeyChecking=no" --command='
  cd zapdos
  sudo docker compose --env-file .env.production -f deploy/docker-compose.web.yml exec -T web \
    pnpm --filter web scrape-problems -- --cses
'

echo ""
echo "✓ DB seeded. Your app is ready at:"
WEB_ADDRESS=$(gcloud compute addresses describe zapdos-web-ip --region="$(gcloud config get-value compute/region)" --format='value(address)')
echo "  http://$WEB_ADDRESS"
