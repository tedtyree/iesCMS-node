#!/bin/bash
# Usage: deploy_s3_site.sh <siteid>

# Exit on error
set -e

# Configuration
WEB_DIR="/var/www/iesCMS-node"

echo "=== Update website on S3 using git pull: ${1} ==="

cd "$WEB_DIR/websites/${1}/"
git pull
if [ -f "require/website_${1}.js" ]; then
  cp "require/website_${1}.js" "$WEB_DIR/require/website_${1}.js"
fi

# 3) Restart the iesCMS app running on PM2
echo "3/8 - Restarting PM2 process..."
pm2 restart iesCMS

echo "=== Deployment successful: ${1} ==="
echo "Website ${1} should now be live"
echo "Completed $(date)"


