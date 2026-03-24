// cmsCommon/cmd/utility/ping.js
// Public liveness check — available to all sites, overridable per-site.
// Test: POST /pubcmd  { "cmd": "utility/ping" }
module.exports = {
    id: 'utility/ping',
    auth: 'public',
    params: [],
    handler: async (cms) => {
        cms.ReturnJson = {
            success: true,
            pong: true,
            site: cms.siteId,
            source: 'cmsCommon'
        };
    }
};
