#!/bin/bash
# iesCMS Per-Site Redeploy Script
# Pulls the latest changes for one site (each site under websites/ is its own
# git repo, per the main README's "Install each website") and then does a
# full iescms restart via restart_iescms.sh.
#
# Usage: redeploy_iescms_site.sh <siteId> [branch]
#   <siteId> is a folder name under /var/www/iescms/websites
#   [branch] optional -- switch to and pull this branch. Omit to just pull
#            whatever branch the site repo currently has checked out.
#
# Must be invoked as APP_USER below, with a login shell, same as
# deploy_iescms.sh / restart_iescms.sh:
#   sudo -iu s6app /var/www/scripts/redeploy_iescms_site.sh <siteId> [branch]
# Assumes s6app is already set up (SSH key / credential helper) to run
# `git pull` against the site's repo -- this script does not handle git auth.
#
# NOTE: this restarts the *entire* iescms app (all sites), not just the one
# being redeployed -- restart_iescms.sh has no per-site restart. Known
# limitation, acceptable for now since it still guarantees a full, consistent
# redeploy.

set -e

APP_USER="s6app"
WEBSITES_DIR="/var/www/iescms/websites"
RESTART_SCRIPT="/var/www/scripts/restart_iescms.sh"

CURRENT_USER="$(whoami)"
if [ "$CURRENT_USER" != "$APP_USER" ]; then
    echo "ERROR: This script must be run as '$APP_USER' (currently running as '$CURRENT_USER')."
    echo "Run: sudo -iu $APP_USER $0 $*"
    exit 1
fi

SITE_ID="$1"
BRANCH="$2"
if [ -z "$SITE_ID" ]; then
    echo "Usage: $0 <siteId> [branch]"
    echo "  <siteId> is a folder name under $WEBSITES_DIR"
    echo "  [branch] optional -- defaults to the site repo's current branch"
    exit 1
fi

# SITE_ID must be a bare folder name, not a path -- reject anything that could
# escape $WEBSITES_DIR.
case "$SITE_ID" in
    */*|.|..)
        echo "ERROR: '$SITE_ID' is not a valid site folder name."
        exit 1
        ;;
esac

SITE_DIR="$WEBSITES_DIR/$SITE_ID"

if [ ! -d "$SITE_DIR" ]; then
    echo "ERROR: $SITE_DIR does not exist."
    exit 1
fi

SITE_OWNER="$(stat -c '%U' "$SITE_DIR")"
if [ "$SITE_OWNER" != "$APP_USER" ]; then
    echo "ERROR: $SITE_DIR is owned by '$SITE_OWNER', not '$APP_USER'."
    echo "Ask a system admin to run: chown -R $APP_USER:$APP_USER $SITE_DIR"
    exit 1
fi

if [ ! -d "$SITE_DIR/.git" ]; then
    echo "ERROR: $SITE_DIR is not a git repository (no .git found)."
    exit 1
fi

echo "=== Redeploying site: $SITE_ID ==="
echo "Path: $SITE_DIR"
[ -n "$BRANCH" ] && echo "Branch: $BRANCH"
echo ""

cd "$SITE_DIR"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "WARNING: $SITE_ID has uncommitted changes to tracked files -- pull may fail or merge them:"
    git status --porcelain --untracked-files=no
fi

if [ -n "$BRANCH" ]; then
    echo "Fetching and switching to branch: $BRANCH"
    git fetch origin
    git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
fi

echo "Pulling latest changes..."
git pull --ff-only

echo ""
echo "Restarting iescms (full app restart -- required until per-site restart is supported)..."
"$RESTART_SCRIPT"
