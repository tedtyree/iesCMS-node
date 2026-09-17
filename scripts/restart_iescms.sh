#!/bin/bash
# iesCMS Restart Script
# Restarts (or starts) the iesCMS application via PM2
#
# Must be invoked as APP_USER below, with a login shell so $HOME (and therefore
# PM2's daemon state under ~/.pm2) is actually s6app's:
#   sudo -iu s6app /var/www/scripts/restart_iescms.sh
# or already running as that user — as deploy_iescms.sh does. Plain `sudo -u`
# (no -i) leaves $HOME pointing at the invoking user, which makes pm2 talk to
# the wrong daemon and can spawn a duplicate process. This script does not
# escalate privileges itself; it fails fast if run as anyone else.
#
# Port is NOT configured here — app.js reads `serverPort` from secrets/server.cfg
# at startup. Change it there, then restart.

set -e

APP_USER="s6app"
PM2_NAME="iescms"
APP_DIR="/var/www/iescms"
ECOSYSTEM_FILE="ecosystem-s6.config.js"  # matches APP_DIR above — the s1 server uses a different path/config

CURRENT_USER="$(whoami)"
if [ "$CURRENT_USER" != "$APP_USER" ]; then
    echo "ERROR: This script must be run as '$APP_USER' (currently running as '$CURRENT_USER')."
    echo "Run: sudo -iu $APP_USER $0"
    exit 1
fi

echo "=== iesCMS Restart ==="
echo "App: $APP_DIR"
echo "User: $APP_USER"
echo ""

cd "$APP_DIR"

# startOrRestart starts the app fresh (picking up NODE_ENV/interpreter from the
# ecosystem file) if it's not already running, or restarts it in place if it is
# — always from the same config, so a fresh start and a restart never drift.
pm2 startOrRestart "$ECOSYSTEM_FILE" --update-env
pm2 save

# Poll for the process to come online instead of a fixed sleep — startup can take
# longer than a couple seconds (e.g. iesDbInit checking/creating DBs across sites).
echo "Waiting for $PM2_NAME to come online..."
ONLINE=0
for i in $(seq 1 15); do
    if pm2 describe "$PM2_NAME" | grep -q "online"; then
        ONLINE=1
        break
    fi
    sleep 1
done

if [ "$ONLINE" -eq 1 ]; then
    echo ""
    echo "=== Restart Successful ==="
    echo "PM2 status:"
    pm2 status "$PM2_NAME"
else
    echo ""
    echo "=== WARNING: App may not be running ==="
    echo "Check logs with: pm2 logs $PM2_NAME"
    pm2 status "$PM2_NAME"
    exit 1
fi
