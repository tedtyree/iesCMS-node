// cmsCommon/cmd/otp/send_pub.js
// API Endpoint: /pubcmd { cmd: 'otp/send', phone, countryCode, channel }
// Sends a Telnyx Verify OTP code via SMS or WhatsApp. Public — this has to be callable before a
// user has an account (e.g. during registration) or a session (nothing here is tied to cms.user).
//
// Global to every site by default (cmdRegistry.js merges all of cmsCommon/cmd into every site's
// registry), but this is a paid-per-send API billed on one shared platform-wide Telnyx account
// (see require/telnyxVerify.js + secrets/server.cfg's Telnyx block) — a site must opt in with
// OtpEnabled:true in its own site.cfg/site.jfx, otherwise this refuses to run up charges for a
// site that never asked for it.
//
// Rate limiting is deliberately a small, in-file, non-reusable limiter (a plain module-level Map,
// reset on process restart) rather than a shared require/rateLimit.js module — see outer
// CLAUDE.md's OTP section / websites/chatbot/CLAUDE.md's rateLimit.js incident note for why a
// generic reusable limiter was explicitly avoided here. Limits: 10 sends per phone number per
// hour, 40 sends per IP per hour — generous enough that a user retrying a mistyped code or a slow
// WhatsApp delivery never gets stuck, while still capping worst-case cost per phone/IP per hour.
//
// Test: POST /pubcmd { "cmd": "otp/send", "phone": "5550100", "countryCode": "1", "channel": "sms" }

'use strict';

const path = require('path');
const { toE164, sendVerification } = require(path.resolve('./require/telnyxVerify.js'));

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_PHONE = 10;
const MAX_PER_IP = 40;

const hits = new Map(); // key -> array of timestamps (ms) within the current window

function withinLimit(key, max) {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter(ts => now - ts < WINDOW_MS);
    if (arr.length >= max) {
        hits.set(key, arr);
        return false;
    }
    arr.push(now);
    hits.set(key, arr);
    return true;
}

module.exports = {
    id:   'otp/send',
    auth: 'public',
    handler: async (cms) => {
        if (!cms.SITE.getBool('OtpEnabled', false)) {
            cms.ReturnJson = { success: false, error: 'Phone verification is not available on this site.' };
            return;
        }

        const channel = (cms.body.channel || 'sms').trim().toLowerCase();
        if (channel !== 'sms' && channel !== 'whatsapp') {
            cms.ReturnJson = { success: false, error: 'Invalid channel.' };
            return;
        }

        const phoneE164 = toE164(cms.body.countryCode, cms.body.phone);
        if (!phoneE164) {
            cms.ReturnJson = { success: false, error: 'Please enter a valid phone number.' };
            return;
        }

        if (!withinLimit(`${cms.siteId}:${phoneE164}`, MAX_PER_PHONE) ||
            !withinLimit(`${cms.siteId}:${cms.clientIp || ''}`, MAX_PER_IP)) {
            cms.ReturnJson = { success: false, error: 'Too many attempts. Please try again later.' };
            return;
        }

        const result = await sendVerification(cms, phoneE164, channel);
        cms.ReturnJson = result.success
            ? { success: true }
            : { success: false, error: result.error || 'Could not send verification code.' };
    }
};
