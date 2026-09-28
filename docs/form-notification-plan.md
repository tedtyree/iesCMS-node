# Contact-Form Message Log + Notification Throttling

> **This is the original implementation plan, kept as a historical record.** For the current,
> authoritative spec, see `PRD.md`'s "Contact-Form Message Log + Notification Throttling" section
> (`#REQ-FORMNOTIFY-01`). Details here may drift from reality over time; that section is kept up
> to date, this one is not.

## Context

The un0 site's "Contact Us" form — and every other site using the default cmsCommon form-processing
path — used to email the site admin immediately on every submission, with no spam filtering
enabled anywhere by default. Every spam or garbled-junk submission cost an email send.

Two things shaped the fix:

- A regex/heuristic spam filter already existed and was already wired into the form-submission
  path (`require/iesSpamFilter/iesSpamFilterClass.js`) — it just wasn't turned on for every site.
  It's enabled per-site via that site's own `spam/spam.cfg` (`SpamFilterOn:true`), and already
  suppresses the real-time email when a submission scores `SpamLevel > 0`.
- There is no cron/scheduler infrastructure anywhere in this codebase. Rather than add one for a
  traditional "nightly digest," notification throttling was designed to be **event-driven**:
  triggered only by requests that were already happening — a form submission, or an admin
  visiting the messages list — never a background timer.

Along the way, tracing the existing `wlog` table (where submissions were logged) turned up a
separate, pre-existing gap: `wlog` had no schema file and wasn't auto-created by `iesDbInit.js`,
unlike every other common table. It only worked because it happened to already exist in a shared
database — a holdover from the original iesCMS architecture, where one database/table was shared
across every site. Since this platform now gives each site its own database, that shared-table
design (and its site-id column) no longer applies, so the table was replaced outright with a
properly-defined one: `messagelog`.

## Decisions

- Core iesCMS feature, not site-specific — lives in `cmsCommon`/`require`, usable by any site with
  zero code changes.
- Notification throttling is **default on** for every site, with a per-site opt-out
  (`NotifyOnEveryMessage:true` restores immediate per-message email).
- Spam messages never trigger a notification on their own (still logged; their count rides along
  in the next real notification's summary).
- No hybrid path — every non-spam submission goes through the same throttled check.
- `wlog` → `messagelog`: same shape, minus the site-id column. Scope stayed narrow — other common
  tables that still carry a legacy site-id column (e.g. `jobjects`) were intentionally left alone.
- Throttle state lives in a new generic per-site key/value table (`params`), not a single-purpose
  table, so it's reusable for future site-level settings.

## The notification rule

Two values drive it, stored in each site's own `params` table: `FormLastAdminVisit` and
`FormLastNotificationSent`. On every non-spam form submission, after logging it to `messagelog`:

1. Count non-spam `messagelog` rows with `SubmitDate` after `FormLastAdminVisit` (includes the
   message just submitted).
2. If that count is exactly 1 (the first unread message since the admin last looked) → notify now.
3. Else if it's been at least `NotifyAgainDays` (site.cfg, default 7) since
   `FormLastNotificationSent` → notify now, as a reminder.
4. Otherwise → do nothing.

The notification email reports counts since `FormLastAdminVisit` — non-spam and spam — plus a link
to the admin messages list (`/admin-edit?eclass=messagelog`). Visiting that admin page updates
`FormLastAdminVisit` but never sends anything by itself; it only resets the "unread since"
baseline for future counts.

**Known limitation**: because the check only runs on non-spam submissions, a site that receives
only spam and never a single legitimate message will never get a reminder email, even as spam
piles up. This matches the stated intent ("spam doesn't count as a message to notify") but is
worth a second look if it ever surprises someone.

## What changed, file by file

- `cmsCommon/db/table-messagelog.sql` (new), `cmsCommon/db/table-params.sql` (new), both added to
  `cmsCommon/db/all-sites-db.jfx` — auto-created per site the same way as `users`/`jobjects`/
  `jobjhist`/`app_log`.
- `require/iesCommon.js`:
  - `saveFormToLog()` now inserts into `messagelog`, no site-id column.
  - New `getDbParam(id, defaultVal)` / `setDbParam(id, value)` — generic read/write against
    `params`.
  - New `checkAndSendForm(SpamObj)` — the throttle logic described above.
  - `GenerateJsonData()` (the `editlist-json` admin list handler) now updates
    `FormLastAdminVisit` whenever the loaded table is `messagelog`.
- `cmsCommon/require/website_engine.js` — the form-submission path now calls
  `cms.checkAndSendForm(SpamObj)` instead of emailing directly, unless
  `NotifyOnEveryMessage:true` is set on the site.
- `cmsCommon/config/eclass-messagelog.cfg` — points at `messagelog` instead of `wlog`; dropped the
  `WorldID` field (no longer a real column) and added `SpecialFlags:"noworldid"` so the generic
  admin list query stops trying to filter by a site-id column that no longer exists.

## Explicitly out of scope

- No migration of any pre-existing `wlog` data into `messagelog` — this only defines the new table
  going forward. A server with real history in a live `wlog` table would need a separate, one-time
  manual migration if that data is worth keeping.
- No changes to other common tables that still carry a legacy site-id column (e.g. `jobjects`) —
  this cleanup was scoped to the form-message table only.
