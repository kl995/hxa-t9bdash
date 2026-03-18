#!/bin/bash
set -euo pipefail

# HxA Dash deployment script (PM2, no Docker)
# Usage: ./deploy.sh [--tag v1.2.3]
#
# Steps:
#   1. git pull latest from main
#   2. npm install (if package-lock changed)
#   3. Tag the release (auto-increment or explicit)
#   4. pm2 restart hxa-dash
#   5. Health check

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PM2_NAME="hxa-dash"
HEALTH_URL="http://localhost:3479/api/health"
TAG_PREFIX="v"

cd "$PROJECT_DIR"

echo "=== HxA Dash Deployment ==="
echo "Directory: $PROJECT_DIR"
echo "Time: $(date -Iseconds)"
echo ""

# Check we're on main branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
    echo "WARNING: Not on main branch (on $BRANCH). Continue? [y/N]"
    read -r answer
    [ "$answer" = "y" ] || exit 1
fi

# Save current commit for rollback
PREV_COMMIT=$(git rev-parse HEAD)
echo "Current commit: $PREV_COMMIT"

# Pull latest
echo "--- Pulling latest code ---"
git pull origin main

NEW_COMMIT=$(git rev-parse HEAD)
if [ "$PREV_COMMIT" = "$NEW_COMMIT" ]; then
    echo "Already up to date. Force restart? [y/N]"
    read -r answer
    [ "$answer" = "y" ] || { echo "Aborted."; exit 0; }
fi

# Install dependencies if needed
if ! git diff --quiet "$PREV_COMMIT" "$NEW_COMMIT" -- package-lock.json 2>/dev/null; then
    echo "--- Installing dependencies ---"
    npm ci --production
else
    echo "--- Dependencies unchanged, skipping npm install ---"
fi

# Determine version tag
if [ -n "${2:-}" ] && [ "${1:-}" = "--tag" ]; then
    TAG="$2"
else
    # Auto-increment: find latest vX.Y.Z tag, bump patch
    LATEST_TAG=$(git tag -l "${TAG_PREFIX}*" --sort=-v:refname | head -1)
    if [ -z "$LATEST_TAG" ]; then
        TAG="${TAG_PREFIX}0.1.0"
    else
        # Strip prefix, split, increment patch
        VER="${LATEST_TAG#$TAG_PREFIX}"
        MAJOR=$(echo "$VER" | cut -d. -f1)
        MINOR=$(echo "$VER" | cut -d. -f2)
        PATCH=$(echo "$VER" | cut -d. -f3)
        PATCH=$((PATCH + 1))
        TAG="${TAG_PREFIX}${MAJOR}.${MINOR}.${PATCH}"
    fi
fi

echo "--- Tagging release: $TAG ---"
git tag -a "$TAG" -m "Release $TAG ($(date +%Y-%m-%d))"
git push origin "$TAG"

# Restart PM2 service
echo "--- Restarting $PM2_NAME ---"
pm2 restart "$PM2_NAME"

# Health check (wait up to 30s)
echo "--- Health check ---"
for i in $(seq 1 15); do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        echo "Health check passed!"
        echo ""
        echo "=== Deployment complete ==="
        echo "Version: $TAG"
        echo "Commit:  $(git rev-parse --short HEAD)"
        echo "Rollback: ./rollback.sh $PREV_COMMIT"
        exit 0
    fi
    sleep 2
done

echo "ERROR: Health check failed after 30s"
echo "Rolling back to $PREV_COMMIT..."
git checkout "$PREV_COMMIT"
pm2 restart "$PM2_NAME"
echo "Rolled back. Please investigate."
exit 1
