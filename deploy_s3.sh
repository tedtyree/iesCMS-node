#!/bin/bash

# Exit on error
set -e

# Configuration
WEB_DIR="/var/www/iescms"
GITHUB_DIR="/var/www/github-sites/iesCMS-node"

echo "=== Starting iesCMS deployment ==="


# 3) Stop the iesCMS app running on PM2
echo "3/8 - Stopping PM2 process..."
pm2 stop iesCMS || echo "No running iesCMS process found, continuing..."
pm2 delete iesCMS || echo "No iesCMS process to delete, continuing..."


# 5) Copy built files to server
echo "5/8 - Copying app files to server..."
# Use rsync to copy only the built files from dist
cd "$GITHUB_DIR"
rsync -avqr --delete ./ "$WEB_DIR/"
# Copy server.cfg
cp "/var/www/secrets/iescms-server.cfg" "$WEB_DIR/server.cfg"

echo "0/8 - Installing dependencies..."
cd "$WEB_DIR/"
npm i

# 8) Deploy hostsite
echo "8/8 - Deploying hostsite..."
cd "$GITHUB_DIR/websites/"
rsync -avqr --delete ./hostsite/ "$WEB_DIR/websites/hostsite/"
cp "$GITHUB_DIR/require/website_hostsite.js" "$WEB_DIR/require/website_hostsite.js"

# 7) Start the app with PM2 and save config
echo "7/8 - Starting application with PM2..."
cd "$WEB_DIR/"
pm2 start "app.js" --name iesCMS
pm2 save

echo "=== Deployment completed successfully! ==="
echo "The iesCMS application should now be live at http://s3.wplot.net"
echo "Deployment completed at $(date)"


