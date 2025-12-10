/* listSites.js
List all sites in the websites/ folder with their domains.
usage: node listSites.js
*/
const fs = require('fs');
const path = require('path');
const FlexJson = require('../require/FlexJson/FlexJsonClass.js');

const websitesDir = path.join(__dirname, '..', 'websites');

// Get all first-level subdirectories in websites/
const subdirs = fs.readdirSync(websitesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

for (const subdir of subdirs) {
    const siteCfgPath = path.join(websitesDir, subdir, 'site.cfg');
    
    if (!fs.existsSync(siteCfgPath)) {
        continue;
    }
    
    const json = new FlexJson();
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
    
    // Format output: first domain marked with ***
    const formattedDomains = domainList.map((domain, idx) => {
        return idx === 0 ? `${domain} ***` : domain;
    }).join(' ');
    
    console.log(`${siteID}: ${formattedDomains}`);
}
