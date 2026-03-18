#!/bin/bash
set -euo pipefail

# HxA Dash rollback script
# Usage: ./rollback.sh <commit-or-tag>
# Example: ./rollback.sh v0.1.5
#          ./rollback.sh abc1234

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PM2_NAME="hxa-dash"
HEALTH_URL="http://localhost:3479/api/health"

cd "$PROJECT_DIR"

if [ -z "${1:-}" ]; then
    echo "Usage: $0 <commit-or-tag>"
    echo ""
    echo "Recent tags:"
    git tag -l "v*" --sort=-v:refname | head -5
    echo ""
    echo "Recent commits:"
    git log --oneline -5
    exit 1
fi

TARGET="$1"
CURRENT=$(git rev-parse --short HEAD)

echo "=== HxA Dash Rollback ==="
echo "Current: $CURRENT"
echo "Target:  $TARGET"
echo "Time:    $(date -Iseconds)"
echo ""

# Verify target exists
if ! git rev-parse "$TARGET" > /dev/null 2>&1; then
    echo "ERROR: Target '$TARGET' not found"
    exit 1
fi

echo "Rolling back to $TARGET. Continue? [y/N]"
read -r answer
[ "$answer" = "y" ] || { echo "Aborted."; exit 0; }

# Checkout target
echo "--- Checking out $TARGET ---"
git checkout "$TARGET"

# Reinstall dependencies
echo "--- Installing dependencies ---"
npm ci --production

# Restart
echo "--- Restarting $PM2_NAME ---"
pm2 restart "$PM2_NAME"

# Health check
echo "--- Health check ---"
for i in $(seq 1 15); do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        echo "Health check passed!"
        echo ""
        echo "=== Rollback complete ==="
        echo "Now at: $(git rev-parse --short HEAD)"
        exit 0
    fi
    sleep 2
done

echo "ERROR: Health check failed after rollback!"
exit 1
