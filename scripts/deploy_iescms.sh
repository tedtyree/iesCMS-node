#!/bin/bash
# iesCMS Deployment Script
# Deploys latest main branch from https://github.com/tedtyree/iesCMS-node
# to /var/www/iescms and restarts via PM2.
#
# Must be invoked as APP_USER below, with a login shell so file ownership and
# PM2's daemon state stay consistent with the process that runs the app:
#   sudo -iu s6app /var/www/scripts/deploy_iescms.sh
# or already running as that user. This script does not escalate privileges
# itself; it fails fast if run as anyone else. Running the whole deploy
# (clone/pull, npm install, restart) as s6app means everything it creates is
# already owned by the right user -- no chown step needed. This does mean
# /var/www/iescms (or /var/www itself, if the app dir doesn't exist yet) must
# already be writable by s6app -- an admin needs to
# `mkdir -p /var/www/iescms && chown s6app:s6app /var/www/iescms` once, up
# front, if it isn't already.

set -e

APP_USER="s6app"
REPO_URL="https://github.com/tedtyree/iesCMS-node.git"
APP_DIR="/var/www/iescms"
RESTART_SCRIPT="/var/www/scripts/restart_iescms.sh"

CURRENT_USER="$(whoami)"
if [ "$CURRENT_USER" != "$APP_USER" ]; then
    echo "ERROR: This script must be run as '$APP_USER' (currently running as '$CURRENT_USER')."
    echo "Run: sudo -iu $APP_USER $0"
    exit 1
fi

echo "=== iesCMS Deployment ==="
echo "Target: $APP_DIR"
echo "User: $APP_USER"
echo ""

# App directory must already exist and be owned by s6app -- created once by an
# admin (mkdir -p "$APP_DIR" && chown s6app:s6app "$APP_DIR"), not by this
# script, since s6app has no write access to /var/www itself.
if [ ! -d "$APP_DIR" ]; then
    echo "ERROR: $APP_DIR does not exist."
    echo "Ask a system admin to run: mkdir -p $APP_DIR && chown $APP_USER:$APP_USER $APP_DIR"
    exit 1
fi

# Clone or pull latest code
if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR"

    # secrets/, websites/, and logs are all gitignored, so `git reset --hard`
    # never touches them -- the only real risk here is a tracked file someone
    # hand-edited directly on the server. Stash those (if any) before
    # resetting so they aren't silently discarded, and restore them after.
    if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
        echo "WARNING: uncommitted changes to tracked files found -- stashing before reset:"
        git status --porcelain --untracked-files=no
        git stash push -m "deploy-stash-$(date +%s)"
        STASHED=1
    else
        STASHED=0
    fi

    echo "Pulling latest changes..."
    git fetch origin
    git checkout -B main origin/main
    git reset --hard origin/main

    if [ "$STASHED" -eq 1 ]; then
        echo "Restoring stashed local changes..."
        if ! git stash pop; then
            echo "WARNING: stash pop conflicted with the new code -- local changes are still in the stash (git stash list) and were NOT reapplied."
        fi
    fi
else
    echo "Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# Ensure required directories exist
if [ ! -d "secrets" ]; then
    echo "Creating secrets/ directory..."
    mkdir -p secrets
fi
if [ ! -f "secrets/server.cfg" ]; then
    echo "WARNING: secrets/server.cfg not found. Copy secrets_SAMPLE/server-PUBLIC-SAMPLE.cfg to secrets/server.cfg and fill it in -- the app will not start without it."
fi
if [ ! -d "websites" ]; then
    echo "Creating websites/ directory..."
    mkdir -p websites
fi

# Install dependencies. `npm ci` (not `npm install`) installs strictly from
# package-lock.json and never rewrites it -- `npm install` frequently touches
# the lockfile even with no real dependency change, which would otherwise show
# up as a tracked-file modification and trigger (and likely conflict) the
# stash/pop above on every subsequent deploy.
echo "Installing npm dependencies..."
npm ci --omit=dev

# Restart the application (already running as s6app, so no further sudo needed)
echo "Restarting application..."
"$RESTART_SCRIPT"
