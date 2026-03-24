// cmsCommon/cmd/admin/serverInfo_admin.js
// API Endpoint: /runcmd
// Returns non-sensitive runtime info — useful for verifying the running server state.
// Test: POST /runcmd  { "cmd": "admin/serverInfo" }  (requires auth level 3)
module.exports = {
    id: 'admin/serverInfo',
    auth: 'admin',
    params: [],
    handler: async (cms) => {
        cms.ReturnJson = {
            success: true,
            site: cms.siteId,
            nodeVersion: process.version,
            platform: process.platform,
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            debugMode: cms.debugMode || 0
        };
    }
};
