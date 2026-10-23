// hotReload.js — require.cache-busting helpers for live single-site reload [#REQ-HOTRELOAD].
// See docs/site-hot-reload.md for the full design. No FlexJson parsing here.

const path = require('path');

// require.cache keys preserve on-disk casing. The filesystem itself is case-insensitive
// on win32 (dev) and case-sensitive on Linux (prod, per CLAUDE.md's "Linux / Case
// Sensitivity" section) — match that per-platform instead of assuming either.
const CASE_INSENSITIVE = process.platform === 'win32';
function normalize(p) { return CASE_INSENSITIVE ? p.toLowerCase() : p; }

// Deletes every require.cache entry whose resolved filename is dirPath itself or falls
// under it. Covers a site's website_engine.js (when it lives inside the site's own
// require/ folder) and all of its cmd/**/*.js handler files, plus anything those
// required transitively that also resolves under dirPath. Returns the cleared keys
// (for logging) — does not throw if dirPath has no cache entries.
function clearRequireCacheUnderDir(dirPath) {
    const resolvedDir = path.resolve(dirPath);
    const base = normalize(resolvedDir + path.sep);
    const target = normalize(resolvedDir);
    const cleared = [];
    for (const key of Object.keys(require.cache)) {
        const nk = normalize(key);
        if (nk === target || nk.startsWith(base)) {
            delete require.cache[key];
            cleared.push(key);
        }
    }
    return cleared;
}

// Deletes a single require.cache entry by its already-resolved absolute file path — for
// the legacy fallback engine path (./require/website_<siteId>.js), which lives OUTSIDE
// the site's own folder so clearRequireCacheUnderDir() above won't touch it. Returns
// true if an entry was actually cleared.
function clearRequireCacheForFile(resolvedFilePath) {
    if (require.cache[resolvedFilePath]) {
        delete require.cache[resolvedFilePath];
        return true;
    }
    return false;
}

module.exports = { clearRequireCacheUnderDir, clearRequireCacheForFile };
