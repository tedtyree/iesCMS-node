/* listSites.js
List all sites in the websites/ folder with their domains.
usage: node listSites.js
*/
const fs = require('fs');
const path = require('path');
const FlexJson = require('../require/FlexJson/FlexJsonClass.js');
const { resolveSiteConfigPath } = require('../require/resolveSiteConfig.js');

const websitesDir = path.join(__dirname, '..', 'websites');

// Get all first-level subdirectories in websites/
const subdirs = fs.readdirSync(websitesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

for (const subdir of subdirs) {
    const siteCfgPath = resolveSiteConfigPath(websitesDir, subdir);

    if (!siteCfgPath) {
        continue;
    }
    
    // ThrowOnError=false: a malformed site.cfg reports via Status/statusMsg (exact line/position)
    // instead of throwing — this is a plain top-level loop with no try/catch, so an uncaught
    // exception here would silently drop every remaining site from the listing.
    const json = new FlexJson(undefined, undefined, false);
    json.DeserializeFlexFile(siteCfgPath);
    
    if (json.Status !== 0) {
        console.log(`${subdir}: ERROR - ${json.statusMsg}`);
        continue;
    }
    
    const siteID = json.i('SiteID').v() || subdir;
    const domainsNode = json.i('Domains');
    
    let domainList = [];
    domainsNode.forEach((domainItem) => {
        domainList.push(domainItem.v());
    });
    
    // Format output: each domain on its own line, first marked with ***
    domainList.forEach((domain, idx) => {
        const marker = idx === 0 ? ' ***' : '';
        console.log(`${subdir}: ${siteID}: ${domain}${marker}`);
    });
}
