#!/bin/bash
# iesCMS Per-Site Redeploy Script
# Pulls the latest changes for one site (each site under websites/ is its own
# git repo, per the main README's "Install each website") and then hot-reloads
# just that site -- see below for the fallback-to-full-restart behavior.
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
# After pulling, hot-reloads just this one site via iescms's local-only
# control endpoint (AdminControlPort in secrets/server.cfg -- see
# docs/site-hot-reload.md) instead of restarting the whole app, so other
# sites' live users are unaffected. If AdminControlPort isn't configured on
# this server, or the endpoint can't be reached, falls back to the old
# full-app restart via restart_iescms.sh so a redeploy never silently does
# nothing. If the reload itself fails (e.g. a syntax error in the code just
# pulled), this script exits non-zero WITHOUT falling back to a restart --
# reloadSite() already keeps the site running on its last-known-good code, so
# the right next step is fixing the file, not restarting.

set -e

APP_USER="s6app"
APP_DIR="/var/www/iescms"
WEBSITES_DIR="/var/www/iescms/websites"
RESTART_SCRIPT="/var/www/scripts/restart_iescms.sh"
SERVER_CFG="$APP_DIR/secrets/server.cfg"

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

# Pull AdminControlPort out of server.cfg (FlexJSON, not plain JSON, but this is a
# simple ",AdminControlPort: <port>" line -- a full parse isn't needed here). Skips
# a commented-out line (one whose first non-blank chars are "//"). Empty/"0" means
# not configured.
ADMIN_CONTROL_PORT="$(grep 'AdminControlPort' "$SERVER_CFG" 2>/dev/null | grep -v '^[[:space:]]*//' | grep -oE '[0-9]+' | head -1)"

if [ -z "$ADMIN_CONTROL_PORT" ] || [ "$ADMIN_CONTROL_PORT" = "0" ]; then
    echo "AdminControlPort not set in $SERVER_CFG -- falling back to a full app restart."
    echo "(Set AdminControlPort there to hot-reload just this site next time -- see docs/site-hot-reload.md.)"
    "$RESTART_SCRIPT"
    exit 0
fi

RELOAD_URL="http://127.0.0.1:${ADMIN_CONTROL_PORT}/reload?site=${SITE_ID}"
echo "Hot-reloading site '$SITE_ID' via $RELOAD_URL (no full app restart)..."

if ! RESPONSE="$(curl -sS -w $'\n%{http_code}' "$RELOAD_URL")"; then
    echo "ERROR: Could not reach the hot-reload endpoint at $RELOAD_URL."
    echo "Falling back to a full app restart."
    "$RESTART_SCRIPT"
    exit 0
fi

HTTP_CODE="$(echo "$RESPONSE" | tail -n1)"
BODY="$(echo "$RESPONSE" | sed '$d')"
echo "Response ($HTTP_CODE): $BODY"

if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q '"success":true'; then
    echo ""
    echo "=== Reload Successful ==="
    echo "Site '$SITE_ID' is now running the newly pulled code -- no other site was affected."
else
    echo ""
    echo "ERROR: Hot reload of '$SITE_ID' failed (see response above)."
    echo "The site is still running its PREVIOUS code -- reloadSite() keeps the last-known-good"
    echo "engine/handlers in place on failure. Check for a syntax error in the files just pulled,"
    echo "fix it, and re-run this script (NOT a full restart -- that would hit the same error)."
    exit 1
fi
