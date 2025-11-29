#!/bin/bash
# Usage: deploy_s3_site.sh <siteid>

# Exit on error
set -e

# Configuration
WEB_DIR="/var/www/iescms"
GITHUB_DIR="/var/www/github-sites/iesCMS-node"

echo "=== Deploy one website to S3: ${1} ==="

cd "$GITHUB_DIR/websites/${1}/"
git pull
rsync -avqr --delete ./ "$WEB_DIR/websites/${1}/"
if [ -f "require/website_${1}.js" ]; then
  cp "require/website_${1}.js" "$WEB_DIR/require/website_${1}.js"
fi

# 3) Restart the iesCMS app running on PM2
echo "3/8 - Restarting PM2 process..."
pm2 restart iesCMS

echo "=== Deployment successful: ${1} ==="
echo "Website ${1} should now be live"
echo "Completed $(date)"


