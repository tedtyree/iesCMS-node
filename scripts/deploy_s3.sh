#!/bin/bash

# Exit on error
set -e

# Configuration
WEB_DIR="/var/www/iescms"

echo "=== Starting iesCMS deployment ==="

echo "1/8 - Stopping PM2 process..."
pm2 stop iescms || echo "No running iesCMS process found, continuing..."
pm2 delete iescms || echo "No iesCMS process to delete, continuing..."


echo "2/8 - Pull most recent app..."
cd "$WEB_DIR/"
git pull

echo "3/8 - Installing dependencies..."
npm i


# 8) Deploy hostsite
echo "5/8 - Deploying hostsite..."
cd "$WEB_DIR/websites_example/"
rsync -avqr --delete ./hostsite/ "$WEB_DIR/websites/hostsite/"

# 7) Start the app with PM2 and save config
echo "6/8 - Starting application with PM2..."
cd "$WEB_DIR/"
pm2 start "app.js" --name iescms
pm2 save

echo "=== Deployment completed successfully! ==="
echo "The iesCMS application should now be live at http://s3.wplot.net"
echo "Deployment completed at $(date)"


