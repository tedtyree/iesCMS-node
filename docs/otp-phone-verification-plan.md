# OTP (Phone Verification) via Telnyx — Platform + Chatbot Integration

## Context

`websites/chatbot`'s registration currently collects a phone number but only checks its format
and per-site uniqueness — there is no proof the submitter actually owns the number
(`PRD.md`'s Trust row already flags this as a known, deliberately-deferred gap). The chatbot
product wants to use *real* phone ownership as a lightweight anti-abuse control: on the Free
plan, a workspace should get **zero bots** until its phone number is verified, and the full
free-tier bot allowance (currently 1, from `planLimits.js`) once it is. Phone entry itself stays
optional — verification is "highly recommended," never a blocker to registering or using the
site.

Per direct instruction, the OTP mechanism itself (send/verify via SMS or WhatsApp, using
Telnyx) should live in the **iesCMS platform**, not be chatbot-only code — with the Telnyx
credential in the platform's `secrets/server.cfg` — so any future site can reuse the same
`otp/send` / `otp/verify` pubcmd endpoints. Only the "gate bot creation on a verified phone"
business rule is chatbot-specific.

**Decisions confirmed with the user:**
- Phone entry stays optional everywhere; verification is recommended, not required, to register.
- Free-plan bot quota: **0 bots unverified, normal free-tier limit (1) once verified.** Applies
  uniformly to every account (moot for backfill — no accounts exist yet, still in development).
- Phone format: E.164 required by Telnyx. Default country is US (+1), with a country selector
  for other countries.
- Rate limiting: a small limiter scoped only to the new `otp/send` handler (not a reusable
  platform module) — the platform previously had a rateLimit.js built unprompted and removed
  (see `websites/chatbot/CLAUDE.md` incident note); this stays narrowly scoped to avoid repeating
  that.

## Telnyx setup required (outside this codebase — needed before this ships)

1. A Telnyx account with an **API Key** (Mission Control Portal → API Keys) — Bearer token for
   all Verify API calls.
2. A **Verify Profile** (Portal → Verify → Profiles, or `POST /v2/verify_profiles`) — get its
   `verify_profile_id` (UUID). Recommend `timeout_secs: 300` (5 min).
3. **Enable WhatsApp as a channel** on that Verify Profile. Telnyx handles the WhatsApp Business
   API integration internally for Verify — no separate Meta/WABA setup or template approval is
   needed on our side.
4. Confirm destination-country messaging permissions are enabled in the portal (Telnyx requires
   this per-country for fraud prevention) for wherever real users will be — at minimum the US.
5. Billing/card on file — Telnyx Verify is **$0.03 per successful verification**, plus
   underlying SMS/WhatsApp channel cost.
6. Two values go into `secrets/server.cfg` (git-ignored, not committed): the API key and the
   verify profile ID.

## Architecture

### Platform (`iesCMS-node` root / `cmsCommon`) — new, generic, reusable by any site

- **`secrets_SAMPLE/server-PUBLIC-SAMPLE.cfg`**: add a `Telnyx: { apiKey, verifyProfileId }`
  block (placeholders), same style as the existing `email_*` SMTP block, with a comment.
- **`require/telnyxVerify.js`** (new) — the one place that talks to Telnyx, following the direct
  `axios` REST-call convention already used elsewhere (e.g. `websites/chatbot/require/chatAI.js`,
  the webhook POST in `cmd/chat/sendMessage_pub.js`) rather than adding the `telnyx` npm SDK as a
  new dependency:
  - `toE164(countryCode, rawDigits)` — strips non-digits, prefixes country code, returns
    `+1XXXXXXXXXX`-style string or `null` if invalid.
  - `async sendVerification(cms, phoneE164, channel)` — `POST https://api.telnyx.com/v2/verifications/{channel}`
    (`channel` is `'sms'` or `'whatsapp'`) with `{ phone_number, verify_profile_id }`, `Authorization: Bearer <apiKey>`.
    Reads credentials via `cms.SERVER.getStr('Telnyx.apiKey','')` / `cms.SERVER.getStr('Telnyx.verifyProfileId','')`;
    treats blank/placeholder values as "not configured" (same convention as chatbot's `secrets.jfx` API-key checks)
    and fails loudly via `cms.logError`.
  - `async checkVerification(cms, phoneE164, code)` — `POST /v2/verifications/by_phone_number/{phone}/actions/verify`
    with `{ code, verify_profile_id }`; returns `{ success: response_code === 'accepted' }`.
  - `issueVerifiedReceipt(cms, phoneE164, channel)` — mints a short-lived JWT (`jwt.sign`, reusing
    `cms.JWT_SECRET` exactly like `iesCommon.js`'s `userSignedIn()` does) with claims
    `{ purpose:'phone_verify', phone: phoneE164, channel, siteId: cms.siteId }`, `expiresIn: 600` (10 min).
  - `checkVerifiedReceipt(cms, token, phoneE164)` — `jwt.verify`s the token (try/catch — expired/invalid
    just returns `null`), confirms `purpose==='phone_verify'`, `phone===phoneE164`, `siteId===cms.siteId`.
  - No local OTP-code storage is needed anywhere — Telnyx's Verify API is the system of record for
    code generation/expiry/attempt-limiting (this is exactly what the managed Verify API is for,
    vs. a DIY SMS-plus-homegrown-code-store approach). We only persist the short-lived *receipt*
    proving a phone passed verification.
- **`cmsCommon/cmd/otp/send_pub.js`** (new, id `otp/send`, `auth:'public'` — matches the existing
  `cmsCommon/cmd/utility/ping_pub.js`-style `_pub.js` naming convention already used in `cmsCommon/cmd/`):
  - Body: `{ phone, countryCode, channel }`. Builds E.164 via `toE164()`; validates `channel` is
    `'sms'`/`'whatsapp'`.
  - **Site opt-in gate**: requires `cms.SITE.getBool('OtpEnabled', false)` — since this shared,
    server-wide Telnyx credential is billed centrally and these handlers are auto-global to every
    site (`cmdRegistry.js` merges all of `cmsCommon/cmd` into every site's registry), an explicit
    per-site flag stops an unrelated/test site from silently running up Telnyx charges. Chatbot's
    `site.jfx` gets `OtpEnabled: true` added as part of this work.
  - **In-file rate limiter** (module-level `Map`, not a reusable module — deliberately scoped only
    here per the confirmed decision): keyed by `siteId:phoneE164` and `siteId:cms.clientIp`
    (`cms.clientIp` already exists platform-wide, set in `app.js`), capping sends per phone/IP per
    rolling window (10/phone/hour, 40/IP/hour — generous enough that a user retrying a mistyped
    code or a slow WhatsApp delivery never gets stuck, while still capping worst-case cost per
    phone/IP per hour). Over-limit returns a generic "try again later"
    — no reusable rate-limit module, no cross-request persistence beyond this process's memory
    (same single-PM2-process tradeoff already accepted elsewhere in this codebase).
  - Calls `sendVerification()`, returns `{ success }` only.
- **`cmsCommon/cmd/otp/verify_pub.js`** (new, id `otp/verify`, `auth:'public'`):
  - Body: `{ phone, countryCode, code }`. Calls `checkVerification()`; on success, calls
    `issueVerifiedReceipt()` and returns `{ success:true, receipt }`; otherwise `{ success:false }`.
    No extra rate limiting needed here — Telnyx's own verify-attempt cap already governs this, and
    checking a code costs nothing extra on our Telnyx bill (only *sending* one does).
- **Outer `CLAUDE.md`**: add a short section documenting `cms.SERVER`'s new `Telnyx` block and the
  generic `otp/send` / `otp/verify` endpoints, following this file's existing documentation style.

### Chatbot site (`websites/chatbot`) — the only place with OTP business logic

- **`require/workspace.js`**: refactor the inline "create a new `workspace.jfx`" block inside
  `resolveWorkspace()` into a shared `createWorkspace(siteId, loginid, userName, extra = {})`
  function (writes `name, slug, created, plan, tokenResetDate`, plus whatever's in `extra`, e.g.
  `phoneVerified`/`phoneVerifiedAt`/`phoneVerifiedChannel`). `resolveWorkspace()` calls it
  internally when the file doesn't exist (unchanged behavior). New export
  `setPhoneVerified(cms, verified, meta = {})` — loads `workspace.jfx` for `resolveWorkspace(cms).ws`,
  merges in `phoneVerified`/`phoneVerifiedAt`/`phoneVerifiedChannel`, writes it back (same
  load-modify-save shape `billing.js` already uses for `tokenResetDate` roll-forward).
- **`require/billing.js`**: `getBillingInfo(siteId, ws)` — **no signature change** (it already
  reads `workspace.jfx` via FlexJson for `plan`/`tokenResetDate`; this just reads one more field
  from the same file: `fj.getBool('phoneVerified', false)`). `botLimit` becomes
  `(plan === 'free' && !phoneVerified) ? 0 : limits.bots`; the returned object gains a
  `phoneVerified` field for UI display. Because this read comes straight from the workspace file
  (not a DB query), it stays correct and cheap for every one of `getBillingInfo`'s ~11 existing
  call sites (dashboard, billing, usage, bot create/update, event create, admin views, and the
  public chat runtime) with zero extra plumbing — including the two public, unauthenticated chat
  handlers, which never use `botLimit` anyway so are unaffected either way.
- **`cmd/auth/register_pub.js`**: accepts an optional `phoneVerifyReceipt` field. If phone is
  provided and the receipt is present/valid (`checkVerifiedReceipt`) for that exact phone, the
  **receipt's own `phone` claim** (not the separately-submitted field) is what gets stored as
  `phonenumber` — closes a bait-and-switch gap where someone could verify number A but submit
  number B. After the `users` row insert succeeds, call the new
  `createWorkspace(cms.siteId, loginid, name, { phoneVerified:true, phoneVerifiedAt, phoneVerifiedChannel })`
  directly (registration runs before login, so `cms.user`/`resolveWorkspace(cms)` aren't available
  yet — this is why `createWorkspace` takes raw `siteId`/`loginid` instead). If phone is provided
  without a valid receipt, registration still succeeds (optional, per the confirmed decision) —
  nothing is written to a workspace file; it'll simply auto-create unverified (default `false`)
  on first authenticated visit, same as today.
  - Note on why no extra anti-farming logic is needed for receipt reuse: `phoneNumber` is already
    enforced unique per site at registration (existing check) — a receipt is scoped to one phone
    number, and that number can only ever back one account, so replaying the same receipt for a
    second registration attempt just fails the existing uniqueness check. No single-use tracking
    needed on the receipt itself.
- **`cmd/account/updateProfile_user.js`**: when the submitted phone differs from the stored value
  (change or clear): update `phonenumber` as today, then call `resolveWorkspace(cms)` +
  `setPhoneVerified(cms, false)` — **unless** a valid receipt for the new number is present, in
  which case `setPhoneVerified(cms, true, { phoneVerifiedAt, phoneVerifiedChannel })` instead. No
  receipt is *required* to change your phone (consistent with "optional") — changing without one
  just costs you verified status (and, on Free plan, bot-creation ability) until you re-verify.
  When the phone is unchanged, `phoneVerified` is left untouched.
- **`cmd/bot/create_user.js`**: no logic change (still calls the existing `getBillingInfo()` limit
  check as-is) — `botLimit===0` now naturally rejects unverified Free-plan accounts. Only change:
  branch the existing rejection message to something like *"Verify your phone number to create
  your first free bot"* (linking to Account Settings) when `billing.botLimit === 0 &&
  !billing.phoneVerified`, distinct from the existing "upgrade to X" copy for the paid-tier case.
- **`pages/register.cfg`**: add a country-code `<select>` (default `US +1`, a short common list)
  next to the existing phone `<input>`, plus an inline, skippable "Send Code" → code-entry →
  "Verify" mini-flow with an SMS/WhatsApp channel choice (radio/toggle), calling
  `/pubcmd otp/send` then `/pubcmd otp/verify`. A short helper line: *"Verify now to unlock your
  free bot instantly (optional)."* On success, the returned `receipt` is stored in a hidden field
  and submitted alongside the rest of the form to `auth/register`.
- **`pages/account-settings.cfg`**: same country selector + inline verify mini-flow next to the
  existing phone field, plus a small "Verified ✓" / "Unverified" badge reflecting
  `account/getData`'s (now also returning `phoneVerified`) response. Editing the phone value
  clears the badge client-side until a fresh verify completes, matching the server-side reset.
- **`pages/bot-setup.cfg`** (create step) and **`pages/dashboard.cfg`** (Plan card): when
  `billing.plan === 'free' && billing.botLimit === 0 && !billing.phoneVerified`, show a banner
  *"Verify your phone number to create your first free bot →"* linking to Account Settings,
  reusing each page's existing error-banner / plan-card patterns rather than new components.
- **`site.jfx`**: add `OtpEnabled: true` (see the platform-side opt-in gate above).
- **`websites/chatbot/CLAUDE.md`**: add a section documenting this feature, matching the file's
  existing exhaustive style (this repo relies heavily on that file for context continuity).

## Files touched (summary)

**Platform (needs explicit permission per `websites/chatbot/CLAUDE.md` — already implicit in this
request since the user asked for the OTP core to live here):**
`secrets_SAMPLE/server-PUBLIC-SAMPLE.cfg`, `require/telnyxVerify.js` (new),
`cmsCommon/cmd/otp/send_pub.js` (new), `cmsCommon/cmd/otp/verify_pub.js` (new), `CLAUDE.md`.

**Chatbot site only:**
`require/workspace.js`, `require/billing.js`, `cmd/auth/register_pub.js`,
`cmd/account/updateProfile_user.js`, `cmd/bot/create_user.js`, `pages/register.cfg`,
`pages/account-settings.cfg`, `pages/bot-setup.cfg`, `pages/dashboard.cfg`, `site.jfx`,
`CLAUDE.md`.

## Verification

1. Fill in real `Telnyx.apiKey` / `Telnyx.verifyProfileId` in local `secrets/server.cfg` (copied
   from the sample) and set `OtpEnabled:true` in `websites/chatbot/site.jfx`.
2. `node app.js`, browse `http://localhost:8118/register?mimic=chatbot`.
3. Enter a real phone number you control, pick SMS, click Send — confirm a real text arrives;
   enter the code, confirm the "Verified" state appears before submitting the rest of the form.
4. Repeat choosing WhatsApp instead of SMS.
5. Complete registration with a verified phone → log in → Bot Setup → confirm you can create a
   bot (Free plan, verified).
6. Register a second test account leaving phone blank → log in → Bot Setup → confirm bot creation
   is blocked with the "verify your phone" message, and the same banner shows on Dashboard.
7. From that second account's Account Settings, add + verify a (different, still-unique) phone
   number → confirm the block clears and bot creation now succeeds.
8. In Account Settings, change an already-verified phone to a new number without re-verifying →
   confirm the badge flips to "Unverified" and (if this pushes bot count back over the now-0
   limit) further bot creation is blocked again.
9. Hammer `otp/send` for the same phone number several times quickly → confirm the in-file rate
   limiter kicks in with a generic error rather than triggering unlimited real sends.
