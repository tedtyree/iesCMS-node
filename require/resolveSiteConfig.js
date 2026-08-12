// resolveSiteConfig.js
// Resolves a site's config file path, allowing either site.cfg (legacy) or
// site.jfx (new). If both exist, site.jfx wins and site.cfg is ignored.

const { existsSync } = require('fs');
const path = require('path');

function resolveSiteConfigPath(websitesDir, siteId) {
    const jfxPath = path.join(websitesDir, siteId, 'site.jfx');
    if (existsSync(jfxPath)) { return jfxPath; }
    const cfgPath = path.join(websitesDir, siteId, 'site.cfg');
    if (existsSync(cfgPath)) { return cfgPath; }
    return null;
}

module.exports = { resolveSiteConfigPath };
