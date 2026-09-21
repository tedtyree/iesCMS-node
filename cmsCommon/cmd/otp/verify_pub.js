// cmsCommon/cmd/otp/verify_pub.js
// API Endpoint: /pubcmd { cmd: 'otp/verify', phone, countryCode, code }
// Checks a code the user typed against Telnyx's Verify API. On success, mints a short-lived
// signed "receipt" (require/telnyxVerify.js's issueVerifiedReceipt()) proving that exact phone
// number passed verification — the caller (e.g. chatbot's auth/register_pub.js or
// account/updateProfile_user.js) submits this receipt alongside the phone number and validates
// it server-side with checkVerifiedReceipt() before trusting the phone as verified.
//
// No app-level rate limiting here (unlike otp/send) — Telnyx's own verify-attempt cap already
// governs brute-forcing a code, and checking a code costs nothing extra on the Telnyx bill (only
// sending one does).
//
// Test: POST /pubcmd { "cmd": "otp/verify", "phone": "5550100", "countryCode": "1", "code": "123456" }

'use strict';

const path = require('path');
const { toE164, checkVerification, issueVerifiedReceipt } = require(path.resolve('./require/telnyxVerify.js'));

module.exports = {
    id:   'otp/verify',
    auth: 'public',
    handler: async (cms) => {
        if (!cms.SITE.getBool('OtpEnabled', false)) {
            cms.ReturnJson = { success: false, error: 'Phone verification is not available on this site.' };
            return;
        }

        const code = (cms.body.code || '').trim();
        if (!code) {
            cms.ReturnJson = { success: false, error: 'Please enter the code you received.' };
            return;
        }

        const phoneE164 = toE164(cms.body.countryCode, cms.body.phone);
        if (!phoneE164) {
            cms.ReturnJson = { success: false, error: 'Please enter a valid phone number.' };
            return;
        }

        const result = await checkVerification(cms, phoneE164, code);
        if (!result.success) {
            cms.ReturnJson = { success: false, error: 'That code is incorrect or has expired.' };
            return;
        }

        const receipt = issueVerifiedReceipt(cms, phoneE164, (cms.body.channel || '').trim().toLowerCase());
        cms.ReturnJson = { success: true, receipt };
    }
};
