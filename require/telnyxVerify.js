// require/telnyxVerify.js
// Platform-level OTP phone verification via Telnyx's Verify API (SMS or WhatsApp). Generic and
// reusable by any site — see cmsCommon/cmd/otp/send_pub.js / verify_pub.js for the pubcmd
// handlers built on top of this, and outer CLAUDE.md's "OTP Phone Verification" section.
//
// Telnyx's Verify API is the system of record for code generation/expiry/attempt-limiting —
// there is deliberately no local OTP-code store here (unlike websites/chatbot's
// require/passwordReset.js token store, which exists because a password-reset link has no
// equivalent managed service). We only mint a short-lived JWT "receipt" once Telnyx confirms a
// code was correct, proving a phone number was verified without needing our own storage.
//
// Credentials come from cms.SERVER (secrets/server.cfg's Telnyx block) — a single shared,
// server-wide Telnyx account/Verify Profile used by every opted-in site, same as email_login/
// email_smtp_server for SMTP.

'use strict';

const axios = require('axios');
const jwt   = require('jsonwebtoken');

const TELNYX_API_BASE  = 'https://api.telnyx.com/v2';
const RECEIPT_TTL_SECS = 600; // 10 minutes

// toE164(countryCode, rawPhone)
// countryCode: calling code digits only, e.g. "1" for US/Canada (no leading +).
// rawPhone: whatever the user typed — may already include a leading "+<country><number>",
// in which case that's used as-is (overriding countryCode) rather than double-prefixing.
// Returns a validated E.164 string, or null if it doesn't look like a real phone number.
function toE164(countryCode, rawPhone) {
    const raw = String(rawPhone || '').trim();
    if (!raw) return null;

    let e164;
    if (raw.startsWith('+')) {
        e164 = '+' + raw.slice(1).replace(/[^0-9]/g, '');
    } else {
        const cc = String(countryCode || '1').replace(/[^0-9]/g, '') || '1';
        const digits = raw.replace(/[^0-9]/g, '');
        e164 = '+' + cc + digits;
    }

    return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : null;
}

function isConfigured(cms) {
    const apiKey = cms.SERVER.getStr('Telnyx.apiKey', '');
    const profileId = cms.SERVER.getStr('Telnyx.verifyProfileId', '');
    return !!apiKey && !apiKey.startsWith('<<') && !!profileId && !profileId.startsWith('<<');
}

// async sendVerification(cms, phoneE164, channel) -> { success, error }
// channel is 'sms' or 'whatsapp'.
async function sendVerification(cms, phoneE164, channel) {
    if (!isConfigured(cms)) {
        cms.logError('telnyxVerify.sendVerification: Telnyx.apiKey/verifyProfileId not configured in server.cfg');
        return { success: false, error: 'Phone verification is not available right now.' };
    }
    try {
        await axios.post(
            `${TELNYX_API_BASE}/verifications/${channel}`,
            {
                phone_number: phoneE164,
                verify_profile_id: cms.SERVER.getStr('Telnyx.verifyProfileId', '')
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cms.SERVER.getStr('Telnyx.apiKey', '')}`
                },
                timeout: 10000
            }
        );
        return { success: true };
    } catch (err) {
        cms.logError('telnyxVerify.sendVerification: ' + (err.response ? JSON.stringify(err.response.data) : err.message));
        return { success: false, error: 'Could not send verification code. Please try again.' };
    }
}

// async checkVerification(cms, phoneE164, code) -> { success }
async function checkVerification(cms, phoneE164, code) {
    if (!isConfigured(cms)) {
        cms.logError('telnyxVerify.checkVerification: Telnyx.apiKey/verifyProfileId not configured in server.cfg');
        return { success: false };
    }
    try {
        const res = await axios.post(
            `${TELNYX_API_BASE}/verifications/by_phone_number/${encodeURIComponent(phoneE164)}/actions/verify`,
            {
                code,
                verify_profile_id: cms.SERVER.getStr('Telnyx.verifyProfileId', '')
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cms.SERVER.getStr('Telnyx.apiKey', '')}`
                },
                timeout: 10000
            }
        );
        const responseCode = res.data && res.data.data ? res.data.data.response_code : '';
        return { success: responseCode === 'accepted' };
    } catch (err) {
        cms.logError('telnyxVerify.checkVerification: ' + (err.response ? JSON.stringify(err.response.data) : err.message));
        return { success: false };
    }
}

// issueVerifiedReceipt(cms, phoneE164, channel) -> signed JWT string
// Proof that phoneE164 passed Telnyx verification within the last RECEIPT_TTL_SECS. Consumers
// (e.g. chatbot's auth/register_pub.js, account/updateProfile_user.js) validate it with
// checkVerifiedReceipt() before trusting it.
function issueVerifiedReceipt(cms, phoneE164, channel) {
    return jwt.sign(
        { purpose: 'phone_verify', phone: phoneE164, channel, siteId: cms.siteId },
        cms.JWT_SECRET,
        { expiresIn: RECEIPT_TTL_SECS }
    );
}

// checkVerifiedReceipt(cms, token, phoneE164) -> { channel } | null
function checkVerifiedReceipt(cms, token, phoneE164) {
    if (!token) return null;
    let decoded;
    try {
        decoded = jwt.verify(token, cms.JWT_SECRET);
    } catch (e) {
        return null;
    }
    if (decoded.purpose !== 'phone_verify') return null;
    if (decoded.phone !== phoneE164) return null;
    if (decoded.siteId !== cms.siteId) return null;
    return { channel: decoded.channel || '' };
}

module.exports = { toE164, sendVerification, checkVerification, issueVerifiedReceipt, checkVerifiedReceipt };
