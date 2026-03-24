// cmdRegistry.js — Auto-discovery and registry for cmd API handlers [#REQ-API-06]
// Called once at startup from app.js after siteList is built.
//
// Handler files export an object (or array of objects) with shape:
//   { id: 'category/name', auth: 'public'|'user'|'admin'|<number>, handler: async (cms) => {},
//     params: [{ name: 'paramName', optional: true, description: 'string' }, ...] }
// params is optional — defaults to [] if omitted. Used for help/documentation only.

const { readdirSync, statSync, existsSync } = require('fs');
const path = require('path');

// Recursively collect all .js files under dirPath
function scanDir(dirPath, results = []) {
    if (!existsSync(dirPath)) return results;
    try {
        readdirSync(dirPath).forEach(file => {
            const full = path.join(dirPath, file);
            try {
                if (statSync(full).isDirectory()) {
                    scanDir(full, results);
                } else if (file.endsWith('.js')) {
                    results.push(full);
                }
            } catch (e) {
                console.log(`[CMD] Error scanning entry: ${full} — ${e.message}`);
            }
        });
    } catch (e) {
        console.log(`[CMD] Error reading dir: ${dirPath} — ${e.message}`);
    }
    return results;
}

// Normalize auth aliases to numeric levels [#REQ-API-08]
function normalizeAuth(raw) {
    if (raw === 'public') return 0;
    if (raw === 'user')   return 1;
    if (raw === 'admin')  return 3;
    if (typeof raw === 'number') return raw;
    return 3; // fail-safe default — missing auth → admin [#REQ-API-08-04]
}

// Load handlers from a file into registry (mutates registry) [#REQ-API-06-05]
function loadHandlers(filePath, registry) {
    try {
        const mod = require(path.resolve(filePath));
        const handlers = Array.isArray(mod) ? mod : [mod]; // supports array export [#REQ-API-05-04]
        handlers.forEach(h => {
            if (!h || !h.id || typeof h.handler !== 'function') {
                console.log(`[CMD] Skipping invalid handler export in: ${filePath}`);
                return;
            }
            const key = h.id.trim().toLowerCase();
            registry[key] = { auth: normalizeAuth(h.auth), handler: h.handler, params: h.params || [] };
            console.log(`[CMD]   + ${key} (auth:${registry[key].auth}) ← ${filePath}`);
        });
    } catch (e) {
        // Bad handler files never crash startup [#REQ-API-06-05]
        console.log(`[CMD] Failed to load: ${filePath} — ${e.message}`);
    }
}

// Build per-site registry at startup [#REQ-API-06]
// Returns: { siteId: { 'cmd/key': { auth: Number, handler: fn }, ... }, ... }
function buildCmdRegistry(siteList) {
    const registry = {};

    // 1. Scan common handlers once [#REQ-API-06-01]
    console.log('[CMD] Loading common handlers from cmsCommon/cmd/');
    const commonHandlers = {};
    scanDir('./cmsCommon/cmd').forEach(f => loadHandlers(f, commonHandlers));
    console.log(`[CMD] Common handlers loaded: ${Object.keys(commonHandlers).length}`);

    // 2. For each site, clone common + merge site-specific (site wins) [#REQ-API-06-02..04]
    siteList.forEach(siteId => {
        const siteReg = Object.assign({}, commonHandlers);
        const siteDir = `./websites/${siteId}/cmd`;
        if (existsSync(siteDir)) {
            console.log(`[CMD] Loading site handlers for ${siteId} from ${siteDir}/`);
            scanDir(siteDir).forEach(f => loadHandlers(f, siteReg));
        }
        registry[siteId] = siteReg;
        console.log(`[CMD] ${siteId}: ${Object.keys(siteReg).length} handlers registered`);
    });

    return registry;
}

module.exports = { buildCmdRegistry };
