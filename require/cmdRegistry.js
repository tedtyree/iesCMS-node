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

// Load handlers from a file into registry (mutates registry) [#REQ-API-06-05]. A bad
// require() (syntax error, throw at module scope, etc.) is caught here and logged so
// ONE broken file never blocks the rest of a cmd/ folder from loading — but the caller
// still needs to know it happened (a live reload must not report success while quietly
// having dropped a handler), so a require() failure is also pushed onto the optional
// `errors` array as `{ file, error }`.
//
// A file that requires fine but doesn't export the {id, handler} shape is a SEPARATE,
// intentional case — e.g. a `_`-prefixed helper module meant to be require()'d by other
// handler files, not to export one itself (see websites/pamoja-or-ke/cmd/blogs/
// _blogUtils.js) — and is only ever logged, never pushed to `errors`: it was never a
// working handler that broke, so treating it as a reload failure would make a reload of
// a site with such a helper file fail forever even though nothing is actually wrong.
function loadHandlers(filePath, registry, errors) {
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
        if (errors) { errors.push({ file: filePath, error: e.message }); }
    }
}

// Scan common handlers once [#REQ-API-06-01]. Split out from buildCmdRegistry() so a
// single-site reload (see docs/site-hot-reload.md) can rebuild just one site's branch
// without rescanning cmsCommon/cmd/ or touching any other site.
// Returns { handlers, errors } — errors is [] when every file loaded cleanly.
function buildCommonHandlers() {
    console.log('[CMD] Loading common handlers from cmsCommon/cmd/');
    const commonHandlers = {};
    const errors = [];
    scanDir('./cmsCommon/cmd').forEach(f => loadHandlers(f, commonHandlers, errors));
    console.log(`[CMD] Common handlers loaded: ${Object.keys(commonHandlers).length}` + (errors.length ? ` (${errors.length} FAILED — see [CMD] lines above)` : ''));
    return { handlers: commonHandlers, errors };
}

// Build ONE site's registry given an already-built commonHandlers [#REQ-API-06-02..04].
// Clone common + merge site-specific (site wins). Safe to call standalone and repeatedly
// (e.g. for a live single-site reload) — never rescans cmsCommon/cmd/, and existsSync-
// guards a site with no cmd/ folder (just returns the common clone, no error).
// Returns { registry, errors } — errors covers only THIS site's own cmd/ folder (common
// handler failures are reported once, by buildCommonHandlers, not repeated per site).
function buildSiteCmdRegistry(siteId, commonHandlers) {
    const siteReg = Object.assign({}, commonHandlers);
    const siteDir = `./websites/${siteId}/cmd`;
    const errors = [];
    if (existsSync(siteDir)) {
        console.log(`[CMD] Loading site handlers for ${siteId} from ${siteDir}/`);
        scanDir(siteDir).forEach(f => loadHandlers(f, siteReg, errors));
    }
    console.log(`[CMD] ${siteId}: ${Object.keys(siteReg).length} handlers registered` + (errors.length ? ` (${errors.length} FAILED — see [CMD] lines above)` : ''));
    return { registry: siteReg, errors };
}

// Build per-site registry at startup [#REQ-API-06]
// Returns: { siteId: { 'cmd/key': { auth: Number, handler: fn }, ... }, ... } — unchanged
// shape for backward compat; per-file load errors are still logged (as always), just not
// surfaced through this particular return value. Use buildCommonHandlers/
// buildSiteCmdRegistry directly (as app.js does) to see them.
function buildCmdRegistry(siteList) {
    const { handlers: commonHandlers } = buildCommonHandlers();
    const registry = {};
    siteList.forEach(siteId => {
        registry[siteId] = buildSiteCmdRegistry(siteId, commonHandlers).registry;
    });
    return registry;
}

module.exports = { buildCmdRegistry, buildCommonHandlers, buildSiteCmdRegistry };
