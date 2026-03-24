// cmsCommon/cmd/utility/ping_pub.js
// API Endpoint: /pubcmd
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
