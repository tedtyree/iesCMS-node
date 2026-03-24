// cmsCommon/cmd/admin/listEndpoints.js
// Returns all registered cmd handlers for this site — useful for debugging and discovery.
// Test: POST /runcmd  { "cmd": "admin/listEndpoints" }               → id + auth only
// Test: POST /runcmd  { "cmd": "admin/listEndpoints", "showParams": "true" }  → includes params
module.exports = {
    id: 'admin/listEndpoints',
    auth: 'admin',
    params: [
        { name: 'showParams', optional: true, description: 'Include parameter definitions for each endpoint — "true" or "1" to enable, default false' }
    ],
    handler: async (cms) => {
        // Truthy check: accept "true" or "1" (case-insensitive) — standard for form/URL string params
        const showParams = ['true', '1'].includes(cms.FormOrUrlParam('showParams', '').trim().toLowerCase());

        const authLabel = (n) => n === 0 ? 'public' : n === 1 ? 'user' : n === 3 ? 'admin' : `level-${n}`;

        const registry = cms.cmdRegistry || {};
        const endpoints = Object.keys(registry).sort().map(key => {
            const entry = registry[key];
            const ep = { id: key, auth: entry.auth, authLabel: authLabel(entry.auth) };
            if (showParams) { ep.params = entry.params || []; }
            return ep;
        });

        cms.ReturnJson = {
            success: true,
            site: cms.siteId,
            count: endpoints.length,
            endpoints
        };
    }
};
