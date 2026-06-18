#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Zapdos — deploy app + Judge0 to both VMs
#
# - Generates fresh secrets
# - Installs Docker on both VMs
# - Clones/pulls the repo on each VM
# - Writes .env.production / .env.judge0 with real IPs + secrets
# - Builds the web Docker image on the web VM
# - Starts both docker-compose stacks
#
# Prereqs: provision.sh must have run, and the repo must be pushed
# to a remote that the VMs can clone.
# ============================================================

ZONE=$(gcloud config get-value compute/zone)
REGION=$(gcloud config get-value compute/region)
WEB_ADDRESS=$(gcloud compute addresses describe zapdos-web-ip --region="$REGION" --format='value(address)')
JUDGE0_INTERNAL_IP=$(gcloud compute instances describe zapdos-judge0 --zone="$ZONE" --format='value(networkInterfaces[0].networkIP)')
REPO_URL=$(git remote get-url origin)

echo "▶ Web VM public IP:     $WEB_ADDRESS"
echo "▶ Judge0 internal IP:   $JUDGE0_INTERNAL_IP"
echo "▶ Repo:                 $REPO_URL"

# ── Generate secrets ──────────────────────────────────────────
AUTH_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
JUDGE0_DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
JUDGE0_SECRET_KEY_BASE=$(openssl rand -hex 32)

SSH_OPTS="-o StrictHostKeyChecking=no"

# ── Deploy Judge0 VM ──────────────────────────────────────────
echo ""
echo "═══ Deploying Judge0 VM ═══"

gcloud compute ssh zapdos-judge0 --zone="$ZONE" --command="echo connected" --ssh-flag="$SSH_OPTS"

echo "▶ Installing Docker on Judge0 VM..."
gcloud compute ssh zapdos-judge0 --zone="$ZONE" --ssh-flag="$SSH_OPTS" --command='
  if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
  fi
  sudo systemctl enable docker
  sudo systemctl start docker
'

echo "▶ Cloning repo + starting Judge0 stack..."
gcloud compute ssh zapdos-judge0 --zone="$ZONE" --ssh-flag="$SSH_OPTS" --command="
  set -e
  if [ ! -d zapdos ]; then
    git clone $REPO_URL zapdos
  fi
  cd zapdos
  git pull
  cat > .env.judge0 <<EOF
JUDGE0_DB_PASSWORD=$JUDGE0_DB_PASSWORD
JUDGE0_SECRET_KEY_BASE=$JUDGE0_SECRET_KEY_BASE
EOF
  sudo docker compose --env-file .env.judge0 -f deploy/docker-compose.judge0.yml pull
  sudo docker compose --env-file .env.judge0 -f deploy/docker-compose.judge0.yml up -d
  echo 'Judge0 stack started.'
"

# ── Deploy Web VM ─────────────────────────────────────────────
echo ""
echo "═══ Deploying Web VM ═══"

gcloud compute ssh zapdos-web --zone="$ZONE" --command="echo connected" --ssh-flag="$SSH_OPTS"

echo "▶ Installing Docker on Web VM..."
gcloud compute ssh zapdos-web --zone="$ZONE" --ssh-flag="$SSH_OPTS" --command='
  if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
  fi
  sudo systemctl enable docker
  sudo systemctl start docker
'

echo "▶ Cloning repo + writing env..."
gcloud compute ssh zapdos-web --zone="$ZONE" --ssh-flag="$SSH_OPTS" --command="
  set -e
  if [ ! -d zapdos ]; then
    git clone $REPO_URL zapdos
  fi
  cd zapdos
  git pull
  cat > .env.production <<EOF
APP_URL=http://$WEB_ADDRESS
NODE_ENV=production
AUTH_SECRET=$AUTH_SECRET
NEXTAUTH_URL=http://$WEB_ADDRESS
NEXTAUTH_SECRET=$AUTH_SECRET
POSTGRES_USER=zapdos
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=zapdos
DATABASE_URL=postgresql://zapdos:$POSTGRES_PASSWORD@postgres:5432/zapdos?schema=public
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_URL=redis://:$REDIS_PASSWORD@redis:6379
JUDGE0_URL=http://$JUDGE0_INTERNAL_IP:2358
JUDGE0_API_KEY=
JUDGE_CONCURRENCY=4
MATCH_DURATION_SECONDS=1200
WRONG_SUBMISSION_PENALTY=10
ELO_PROVISIONAL_GAMES=10
ELO_K_PROVISIONAL=40
ELO_K_ESTABLISHED=32
ELO_DEFAULT=1200
REALTIME_CORS_ORIGIN=http://$WEB_ADDRESS
REALTIME_URL=http://realtime:3002
PUBLIC_APP_URL=http://$WEB_ADDRESS
EOF
"

echo "▶ Building web Docker image (this takes ~3-5 min on e2-medium)..."
gcloud compute ssh zapdos-web --zone="$ZONE" --ssh-flag="$SSH_OPTS" --command="
  cd zapdos
  sudo docker build -t zapdos-web:latest .
"

echo "▶ Starting web stack..."
gcloud compute ssh zapdos-web --zone="$ZONE" --ssh-flag="$SSH_OPTS" --command="
  cd zapdos
  sudo docker compose --env-file .env.production -f deploy/docker-compose.web.yml up -d
  echo 'Web stack started.'
"

echo ""
echo "✓ Deploy complete."
echo "  App URL:  http://$WEB_ADDRESS"
echo "  Health:   http://$WEB_ADDRESS/api/health"
echo ""
echo "Next: ./deploy/seed-prod.sh  (migrate DB + seed CSES problems)"
