#!/bin/bash

#NOTE: this script deploy_s1.sh is currently untested

# Exit on error
set -e

# Configuration
WEB_DIR="/var/www/iesCMS-node"

echo "=== Starting iesCMS deployment ==="

echo "1/8 - Stopping PM2 process..."
pm2 stop iescms || echo "No running iescms process found, continuing..."
pm2 delete iescms || echo "No iescms process to delete, continuing..."


echo "2/8 - Pull most recent app..."
cd "$WEB_DIR/"
git pull

echo "3/8 - Installing dependencies..."
npm i

echo "4/8 - Copy server config..."
cp "/var/www/secrets/iescms-server.cfg" "./server.cfg"


# 8) Deploy hostsite
echo "5/8 - Deploying hostsite..."
cd "$WEB_DIR/websites_example/"
rsync -avqr --delete ./hostsite/ "$WEB_DIR/websites/hostsite/"
cp "hostsite/require/website_hostsite.js" "$WEB_DIR/require/website_hostsite.js"

# 7) Start the app with PM2 and save config
echo "6/8 - Starting application with PM2..."
cd "$WEB_DIR/"
pm2 start "ecosystem-s1.config.js" --env production
pm2 save

echo "=== Deployment completed successfully! ==="
echo "The iesCMS application should now be live at http://s3.wplot.net"
echo "Deployment completed at $(date)"


