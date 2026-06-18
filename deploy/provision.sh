#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Zapdos — provision GCP infrastructure
#
# Creates:
#   - Static external IP for the web VM
#   - Web VM (e2-medium, 4GB, Ubuntu 22.04) — app + workers + DB + nginx
#   - Judge0 VM (e2-standard-2, 8GB, Ubuntu 22.04) — Judge0 sandbox
#   - Firewall rules (HTTP/SSH to web, :2358 web→judge0, SSH to judge0)
#
# Idempotent — safe to re-run. Prints IPs at the end.
# ============================================================

REGION=$(gcloud config get-value compute/region)
ZONE=$(gcloud config get-value compute/zone)

if [ -z "$ZONE" ]; then
  echo "✗ No zone configured. Run setup-gcloud.sh first."
  exit 1
fi

# ── Static IP for web VM ──────────────────────────────────────
echo "▶ Ensuring static IP for web VM..."
WEB_IP_NAME="zapdos-web-ip"
WEB_ADDRESS=$(gcloud compute addresses describe "$WEB_IP_NAME" --region="$REGION" --format='value(address)' 2>/dev/null || true)
if [ -z "$WEB_ADDRESS" ]; then
  gcloud compute addresses create "$WEB_IP_NAME" --region="$REGION"
  WEB_ADDRESS=$(gcloud compute addresses describe "$WEB_IP_NAME" --region="$REGION" --format='value(address)')
fi
echo "  Web public IP: $WEB_ADDRESS"

# ── Firewall rules ────────────────────────────────────────────
echo "▶ Ensuring firewall rules..."

gcloud compute firewall-rules describe zapdos-allow-http-ssh >/dev/null 2>&1 || \
  gcloud compute firewall-rules create zapdos-allow-http-ssh \
    --allow tcp:80,tcp:22 \
    --source-ranges 0.0.0.0/0 \
    --target-tags zapdos-web \
    --description "Allow HTTP and SSH to web VM"

gcloud compute firewall-rules describe zapdos-allow-judge0-internal >/dev/null 2>&1 || \
  gcloud compute firewall-rules create zapdos-allow-judge0-internal \
    --allow tcp:2358 \
    --source-tags zapdos-web \
    --target-tags zapdos-judge0 \
    --description "Allow web VM to reach Judge0 on :2358"

gcloud compute firewall-rules describe zapdos-allow-ssh-judge0 >/dev/null 2>&1 || \
  gcloud compute firewall-rules create zapdos-allow-ssh-judge0 \
    --allow tcp:22 \
    --source-ranges 0.0.0.0/0 \
    --target-tags zapdos-judge0 \
    --description "Allow SSH to judge0 VM"

# ── Web VM ────────────────────────────────────────────────────
echo "▶ Ensuring web VM (e2-medium)..."
gcloud compute instances describe zapdos-web --zone="$ZONE" >/dev/null 2>&1 || \
  gcloud compute instances create zapdos-web \
    --machine-type e2-medium \
    --zone="$ZONE" \
    --image-family ubuntu-2204-lts \
    --image-project ubuntu-os-cloud \
    --tags zapdos-web \
    --address="$WEB_ADDRESS" \
    --boot-disk-size 30GB \
    --boot-disk-type pd-standard

# ── Judge0 VM ─────────────────────────────────────────────────
echo "▶ Ensuring Judge0 VM (e2-standard-2)..."
gcloud compute instances describe zapdos-judge0 --zone="$ZONE" >/dev/null 2>&1 || \
  gcloud compute instances create zapdos-judge0 \
    --machine-type e2-standard-2 \
    --zone="$ZONE" \
    --image-family ubuntu-2204-lts \
    --image-project ubuntu-os-cloud \
    --tags zapdos-judge0 \
    --boot-disk-size 30GB \
    --boot-disk-type pd-standard

JUDGE0_INTERNAL_IP=$(gcloud compute instances describe zapdos-judge0 --zone="$ZONE" --format='value(networkInterfaces[0].networkIP)')

echo ""
echo "✓ Provisioning complete."
echo "  Web VM public IP:      $WEB_ADDRESS"
echo "  Judge0 VM internal IP: $JUDGE0_INTERNAL_IP"
echo ""
echo "Next: ./deploy/deploy.sh"
