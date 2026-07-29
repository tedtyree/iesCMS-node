module.exports = {
    id: 'user/changePassword',
    auth: 'user', // level 1 — any logged-in user, operates only on their own account
    handler: async (cms) => {
        const body = cms.body || {};
        const oldPassword = (body.oldPassword || '').trim();
        const newPassword = (body.newPassword || '').trim();
        const userId = cms.user && cms.user.userid;

        if (!userId || userId < 0) {
            cms.ReturnJson = { success: false, error: 'Not logged in', code: 'ERR-PWD-AUTH' };
            return;
        }
        if (!oldPassword || !newPassword) {
            cms.ReturnJson = { success: false, error: 'Both current and new password are required', code: 'ERR-PWD-001' };
            return;
        }
        if (newPassword.length < 6) {
            cms.ReturnJson = { success: false, error: 'New password must be at least 6 characters', code: 'ERR-PWD-002' };
            return;
        }

        try {
            const needToClose = await cms.db.Open();
            const row = await cms.db.GetFirstRow(`SELECT pwd FROM users WHERE userid = ${userId}`);
            const stored = row ? row.getStr('pwd', '') : '';
            const ok = stored && (cms._isHashed(stored)
                ? cms._verifyPassword(oldPassword, stored)
                : stored === oldPassword); // legacy plain-text accounts, same fallback SessionLogin2 uses
            if (!ok) {
                if (needToClose) await cms.db.Close();
                cms.ReturnJson = { success: false, error: 'Current password is incorrect', code: 'ERR-PWD-003' };
                return;
            }
            const newHash = cms._hashPassword(newPassword);
            await cms.db.ExecuteSQL(`UPDATE users SET pwd = ${cms.db.dbStr(newHash)} WHERE userid = ${userId}`);
            if (needToClose) await cms.db.Close();
            cms.ReturnJson = { success: true };
        } catch (err) {
            cms.logError('[user/changePassword] ' + err.message);
            cms.ReturnJson = { success: false, error: 'Database error', code: 'ERR-PWD-DB' };
        }
    }
};
