#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Zapdos — GCP setup: project, APIs, SSH key
#
# Run this AFTER `gcloud auth login`.
# Idempotent — safe to re-run.
#
# Usage:
#   ./deploy/setup-gcloud.sh <PROJECT_ID> [REGION] [ZONE]
# ============================================================

PROJECT_ID="${1:?Usage: setup-gcloud.sh <PROJECT_ID> [REGION] [ZONE]}"
REGION="${2:-us-central1}"
ZONE="${3:-us-central1-a}"

echo "▶ Setting project to $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"

echo "▶ Enabling required APIs (compute, secret manager)..."
gcloud services enable \
  compute.googleapis.com \
  secretmanager.googleapis.com

echo "▶ Setting default region/zone..."
gcloud config set compute/region "$REGION"
gcloud config set compute/zone "$ZONE"

# SSH key for `gcloud compute ssh`
if [ ! -f ~/.ssh/google_compute_engine ]; then
  echo "▶ Generating SSH key for gcloud..."
  ssh-keygen -t rsa -f ~/.ssh/google_compute_engine -C "gcp-zapdos" -N ""
fi

echo ""
echo "✓ GCP setup complete."
echo "  Project: $PROJECT_ID"
echo "  Region:  $REGION"
echo "  Zone:    $ZONE"
echo ""
echo "Next: ./deploy/provision.sh"
