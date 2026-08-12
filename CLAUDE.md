# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Running the Server

```bash
node app.js
# Browse to http://localhost:8118
# Test a specific site: http://localhost:8118/home?mimic=<siteId>
```

**PM2 (production):**
```bash
pm2 start ecosystem-s1.config.js
pm2 restart iescms
pm2 list
```

**No build step, no linting, no tests** — the CMS serves files directly. The React/TSX files in `src/` are optional Vite-based code unrelated to the CMS runtime.

---

## Secrets Setup

Copy `secrets_SAMPLE/server-PUBLIC-SAMPLE.cfg` → `secrets/server.cfg` and fill in:
- `DbConnect`: `{ host, port, user, password }` — shared PostgreSQL credentials
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `email_*` SMTP settings
- `CommonConfigFolder`: `"[[ServerFolder]]/cmsCommon/config"`
- `serverPort` (default: 8118)

`secrets/` is git-ignored. Never commit it.

This is the **server-wide** secrets file (one per server, shared credentials). For **per-site** credentials (a single site's own API keys/tokens), see "Per-Site Secrets (`cms.SECRETS`)" below instead — different file, different folder, different loading mechanism.

---

## Key Architecture

### Request Flow

```
HTTP Request → app.js
  → parse URL, determine siteId (from Domains in site.cfg)
  → static file? → stream directly
  → /orig/* ? → check origMinViewLevel, redirect if needed
  → HTML page → load website engine
      → website_engine.js (site-specific if exists, else cmsCommon)
          → read pages/<pageId>.cfg
          → parse header: [[{ template:main, minViewLevel:0 }]]
          → load templates/layout_<template>.cfg
          → cms.ReplaceTags() → [[tags]] replaced with values
          → return HTML or JSON
```

### Core Files

| File | Role |
|---|---|
| `app.js` | HTTP server entry. Site routing, JWT auth, static files, engine dispatch. Two env configs (`env_development` / `env_production`) — select the right one. `forwardedHost=false` for dev, `true` for prod (Apache proxy). |
| `require/iesCommon.js` | The `cms` object passed to all engines. Tag replacement, form handling, auth, DB queries, API dispatch, logging. |
| `cmsCommon/require/website_engine.js` | Default page engine. Used unless overridden by a site-specific engine. |
| `require/iesDB/iesDbClass.js` | PostgreSQL wrapper. Lazy connection. Key methods: `Open()`, `Close()`, `GetFirstRow(sql)`, `GetDataReader(sql)`, `iExecuteSQL(sql)`. |
| `require/iesDB/iesDbInit.js` | Startup DB auto-creation. Reads `databasename` from each site's `site.cfg`. Creates missing databases and tables. |
| `require/cmdRegistry.js` | Auto-discovers `cmd/**/*.js` handlers at startup (cmsCommon + per-site). |
| `require/FlexJson/FlexJsonClass.js` | Custom JSON parser — see FlexJSON section below. |

---

## Website Structure

Each site lives in `websites/<siteId>/` and is self-contained:

```
websites/<siteId>/
├── site.cfg or site.jfx       # Required (one of the two — see note below). SITEID, Domains, databasename, paths
├── pages/<pageId>.cfg        # One file per web page
├── templates/layout_*.cfg   # HTML layout wrappers
├── require/website_engine.js # Optional custom engine (overrides cmsCommon)
├── cmd/**/*.js               # Optional API handlers (override cmsCommon)
├── db/
│   ├── site-db.jfx           # Optional: lists site-specific tables
│   └── table-*.sql           # Optional: SQL schemas for site tables
├── secrets/secrets.jfx       # Optional: API keys/tokens, loaded into cms.SECRETS — see below
└── orig/                     # Optional: original HTML site for reference
```

`cmsCommon/` provides defaults for everything — pages, templates, cmd handlers, DB schemas. Site-specific files override cmsCommon equivalents.

**TEMPORARY, during migration — `site.cfg` / `site.jfx` dual naming:** each site's config file may currently be named either `site.cfg` (legacy) or `site.jfx` (new). Every place that loads it — `app.js` (startup site discovery and the per-request `cms.SITE` load), `require/iesDB/iesDbInit.js`, and `util/listSites.js` — resolves the filename through the shared helper `require/resolveSiteConfig.js` (`resolveSiteConfigPath(websitesDir, siteId)`), which checks `site.jfx` first and falls back to `site.cfg`. If a site has both files, `site.jfx` wins and `site.cfg` is silently ignored. When adding any new code that needs to locate a site's config file, use this helper rather than hardcoding `site.cfg`. Once all sites have migrated to `site.jfx`, remove the helper and hardcode `site.jfx` directly.

---

## Page & Template Files (`.cfg`)

**Page files** (`pages/<pageId>.cfg`):
- Extension is `.cfg` (not `.html`) — prevents direct HTTP access
- **Line 1 is always the CMS header** — never remove, duplicate, or precede it:
  ```
  [[{ minViewLevel:0, template:main, title:"Page Title" }]]
  ```
- Lines 2+: HTML body content only — no `<html>`, `<head>`, or `<body>` tags
- The template (`layout_<template>.cfg`) wraps the content

**Asset paths** — always root-relative, never `../`:
```html
<img src="images/photo.jpg" />   <!-- correct -->
<img src="../images/photo.jpg" /> <!-- wrong -->
```

**Templates** (`templates/layout_<name>.cfg`):
- Full HTML document with `[[content_area]]` where page body is injected

**Adding new `[[tags]]`:**
- Built-in tags are `case` labels in `AdminTags()` in `require/iesCommon.js` — add new read-only tags there (e.g. `who_am_i`, `my_username`, `my_loginid`, `my_userid`).
- A tag with no matching case falls through to a generic lookup: `cms.HEADER` (page header) → `cms.SITE` (site.cfg) → `cms.SERVER` (server.cfg), by key name — so e.g. `[[DefaultPageID]]` on any page resolves straight from `site.cfg` with zero extra code.

**Escaping `[[` in page/template content:**
The CMS tag processor treats any `[[...]]` sequence as a tag substitution. If page content (e.g. JSX or JavaScript) contains a literal `[[`, the CMS will try to process it as a tag and corrupt the output.
- **Fix:** insert a space — write `[ [` instead of `[[` — so the CMS does not recognize it as a tag.
- Common trigger: JavaScript array-of-arrays literals like `[ ['a','A'], ['b','B'] ]` passed inline to `.map()` inside JSX.

---

## FlexJSON (`.jfx` / `.cfg` files)

FlexJSON is the config format throughout this project (npm: `flex-json`, source: `require/FlexJson/`).

**Syntax:** JSON + `//` and `/* */` comments + unquoted strings + relaxed quoting.

```javascript
const FlexJson = require('./require/FlexJson/FlexJsonClass.js');

let cfg = new FlexJson();
cfg.DeserializeFlexFile('./path/to/file.jfx');
if (cfg.Status != 0) { /* parse error */ }

cfg.getStr('key', 'default')   // string
cfg.getNum('key', 0)            // number
cfg.getBool('key', false)       // boolean
cfg.i('key')                    // nested FlexJson object
cfg.add(value, 'key')
cfg.WriteToFile('./output.jfx')
```

**Important:** `cfg.i('missingKey')` returns a special null-like FlexJson object that is **truthy** in JS — always check `cfg.Status` or use `getStr`/`getNum`/`getBool`.

**By default, a parse error *throws* rather than just setting `.Status`** — `new FlexJson()`'s
3rd constructor param is `ThrowOnError`, default `true`, and `StatusErr()` (called internally on
every parse problem) only skips the `throw` when it's `false`. This means the `if (cfg.Status != 0)`
snippet above only runs if the file parsed cleanly enough to avoid throwing in the first place —
with the default constructor, a malformed file throws a `FlexJsonError` instead of reaching that
check, so relying on it alone without a surrounding `try/catch` is a latent crash for any code
whose input isn't fully trusted (e.g. a config file a user/admin could hand-edit).

**For any parse where the input might be malformed and a crash is unacceptable** (config/secrets
files, user-editable `.jfx`, anything not guaranteed well-formed), construct with `ThrowOnError:false`
instead of wrapping in `try/catch`:
```javascript
let cfg = new FlexJson(undefined, undefined, false); // ThrowOnError = false
cfg.DeserializeFlexFile('./path/to/file.jfx');
if (cfg.Status == 0 && cfg.jsonType == 'object') {
    // success
} else {
    console.log('Parse failed: ' + cfg.statusMsg); // exact line/position of the problem
}
```
`.statusMsg` carries the precise error (e.g. `"Expected : symbol in key:value pair @Line:1 @Position:0"`)
either way — `ThrowOnError:false` just stops it from *also* throwing, so `.Status`/`.statusMsg` become
the single source of truth for both success and failure. This is the pattern `app.js` uses for
`cms.SITE`/`cms.SECRETS` loading (see below) — reach for it instead of a `try/catch` around
`DeserializeFlexFile()`/`DeserializeFile()` as the primary error-handling mechanism.

**`add(value, key)` only accepts a primitive or an existing `FlexJson` node — never a raw
native JS array/object.** `convertType()` can't distinguish a plain object from an array
(both are `typeof "object"`), so passing one in directly mis-detects the type and corrupts
that node (`jsonType` becomes `"error"`), which then fails serialization of the **entire**
file on `WriteToFile()` — not just that one field. Use the FlexJson helper functions to
convert native values first: `FlexJson.FromNativeArray(arr)`, `FlexJson.FromNativeObject(obj)`,
or `FlexJson.FromNative(value)` (dispatches by type; passes an existing `FlexJson` instance
through unchanged). Example: `cfg.add(FlexJson.FromNativeArray(['#tag1', '#tag2']), 'tags')`.
**As of 2026-07-24 this vendored copy (`require/FlexJson/FlexJsonClass.js`) is synced with the
canonical `flex-json` repo (`C:\~Local\github\FlexJson`)** — the fix and helpers are present
and usable. The canonical repo is the source of truth; re-sync this vendored copy (a straight
file copy — confirmed via diff there is no iesCMS-specific customization in this file) whenever
it's updated there.

**Tag replacement** in string values: `[[SERVER_FOLDER]]`, `[[SiteID]]`, etc. — resolved by `getStr()`.

---

## Static Asset Cache-Busting (`[[v]]`)

`[[v]]` is a built-in tag (`require/iesCommon.js`, `AdminTags()`) that expands to the site's
`ScriptVersion` string from `site.cfg`. Append it as a bare query string on `<script src>` /
`<link href>` tags for site-owned JS/CSS so browsers don't serve a stale cached copy after a
deploy:

```html
<script src="/src/myfile.js?[[v]]"></script>
<link rel="stylesheet" href="/src/myfile.css?[[v]]">
```

Note the convention is `?[[v]]` (the tag has no `v=` prefix baked in), not `?v=[[v]]`. This
pattern is already used throughout `cmsCommon/pages` and `cmsCommon/templates` (e.g.
`layout_admin.cfg`, `admin-edit-form.cfg`).

**`ScriptVersion` is a static, manually-maintained value** — it does NOT auto-change on
deploy or server restart. If you fix a bug in a `.js`/`.css` file that's cache-busted this
way, you must also bump `ScriptVersion` in that site's `site.cfg` (e.g. `"1.0.0"` →
`"1.0.1"`) for the fix to actually reach users — otherwise browsers/CDNs may keep serving
the pre-fix file indefinitely even after the server-side file is updated. This is easy to
forget when debugging "I fixed the code but the bug is still happening" reports — always
check whether the affected page's script/link tags are cache-busted at all, and whether
`ScriptVersion` was bumped on the relevant deploy.

---

## runcmd / pubcmd API

All API calls go through `/runcmd` (authenticated) or `/pubcmd` (public).

**Handler file format** (`cmd/category/myhandler.js`):
```javascript
module.exports = {
    id: 'category/myhandler',   // matches POST body: { cmd: 'category/myhandler' }
    auth: 1,                     // 0=public, 1=user, 3=admin (userLevel must be >=)
    handler: async (cms) => {
        cms.ReturnJson = { success: true };
    }
};
```

Handlers auto-discovered from `cmsCommon/cmd/**/*.js` and `websites/<siteId>/cmd/**/*.js`. Site handlers override common ones with the same `id`.

Unknown `runcmd` commands fall back to `cms.RunCmd()` — a large switch/case in `iesCommon.js` (legacy path).

---

## Authentication & User Sessions

- The logged-in user is `cms.user` (an `iesUser`, `require/iesUser.js`), fields: `userid`, `userName` (capital N — not `username`), `loginid`, `userEmail`, `userLevel`, `siteId`. Rebuilt fresh every request from the JWT (`token` cookie or `Authorization: Bearer`) in `app.js`.
- **Never trust a client-submitted user id.** Any "user manages their own record" endpoint (e.g. change-password) should be `auth:'user'` and scope all queries to `cms.user.userid` from the verified session.
- `minViewLevel` in a page header is enforced automatically — a request below the required level redirects to the site's `LOGIN_PAGE` (return URL preserved via a `redirect_after_login` cookie). Add `noRedirect:true` to the header to get a JSON `401` instead (used by API-style pages like `runcmd.cfg`).
- Passwords: `cms._hashPassword(plain)` (scrypt, format `$1$<salt>$<hash>`, both base64) / `cms._verifyPassword(plain, stored)` / `cms._isHashed(stored)` (`require/iesCommon.js`) — always reuse these for anything touching `users.pwd`. Legacy plain-text passwords still in the DB are auto-upgraded to a hash on next successful login.

---

## Database

`databasename` in `site.cfg` is the **single source of truth** for whether a site uses a DB. Its presence triggers both:
1. DB auto-creation at startup (`iesDbInit.js`)
2. `cms.db` being set at request time (`website_engine.js`)

Common tables: defined in `cmsCommon/db/all-sites-db.jfx` + schemas in `cmsCommon/db/table-*.sql`.
Site-specific tables: optional `websites/<siteId>/db/site-db.jfx` + `table-*.sql` overrides.

**PostgreSQL only.** No MySQL. Do not use backtick-quoted identifiers (`` `field` ``) — PostgreSQL uses double quotes or unquoted names.

### Working with DB results

`GetDataReader(sql)` returns an `iesDataReader`. Call `GetAllRecords()` on it to get all rows.

**`GetAllRecords()` returns a FlexJson array — NOT a plain JS array.**
- ✅ Iterate with `for...of`: `for (const row of rows) { ... }`
- ❌ Never subscript with `[0]` — FlexJson objects do not support index access; `rows[0]` is always `undefined`
- Each `row` is a FlexJson object — use `row.getStr('field', '')`, `row.getNum('field', 0)`, etc.
- PostgreSQL returns all column names **lowercase** — `row.getStr('userid')` not `row.getStr('userID')`

```javascript
// Correct pattern:
const rs = await cms.db.GetDataReader(sql);
const rows = rs ? rs.GetAllRecords() : null;
if (rows) {
    for (const row of rows) {
        const val = row.getStr('fieldname', '');
        // ...
        break; // if you only need the first row
    }
}
```

For a single row lookup, `GetFirstRow(sql)` is also available and returns a FlexJson directly (or null).

### Shared connection across multiple handlers

`Open()` returns `true` if it opened the connection, `false` if it was already open. Use this to write handlers that are safe whether called standalone **or** from a parent handler that owns the connection:

```javascript
// In every handler that touches the DB:
const needToClose = await cms.db.Open();
// ... queries ...
if (needToClose) await cms.db.Close();
```

A parent handler (e.g. a combined endpoint that calls several sub-handlers) can then open once, let all sub-handlers share the connection without closing it, and close once at the end:

```javascript
// Parent / combined handler:
await cms.db.Open();          // opens once; sub-handlers see it's already open
await handlerA.handler(cms); // Open() → false; needToClose=false; no close
await handlerB.handler(cms); // Open() → false; needToClose=false; no close
await handlerC.handler(cms); // Open() → false; needToClose=false; no close
await cms.db.Close();         // single close owned by the parent
```

When a handler is called on its own (one handler per request, the normal case), `Open()` returns `true` and the handler closes as usual. The pattern is transparent to callers.

**Important:** always `await cms.db.Close()` — an unawaited `Close()` creates a race condition where the connection is torn down while a subsequent handler's query is still in flight.

---

## Site Config Loading (`cms.SITE`)

`cms.SITE` (a site's `site.cfg`/`site.jfx`, resolved via `resolveSiteConfigPath()`) is loaded once at startup and kept fresh via a cheap per-request `fs.statSync().mtimeMs` check — not a full re-parse every request [#REQ-CONFIG-01-07].

- `app.js`'s `getSiteConfig(siteId)` reuses the parse the startup site-discovery loop already does (stored in a `siteID → { cfg, path, mtimeMs }` map, `siteConfigs`) as the initial cache entry, then on each request compares the file's current mtime against the cached one — reusing the cached `FlexJson` object if unchanged, re-parsing only if the file was actually touched.
- **This exists specifically to keep the live single-site-lock workflow working without a restart**: `require/iesCommon.js`'s `overrideMinViewLevel` ("used for locking website") reads `OverrideMinViewLevel` off `cms.SITE` every request — hand-editing that value in a site's config file changes the file's mtime, which invalidates just that one site's cache entry, so the lock takes effect on the very next request. A full startup-only cache (no reload check) was evaluated and explicitly rejected (2026-08-12) because restarting the shared Node process to lock one site would interrupt every other site's live users too.
- A siteId with no cache entry at all (e.g. `mimic` targeting a site that wasn't successfully discovered at startup) falls back to a direct, uncached read via `resolveSiteConfigPath()` — the same live lookup the platform always did before caching was added.
- If a reload attempt fails to parse, the last-known-good cached config is kept and served rather than going blank, and the failure is logged via `console.log(...)` — reaches `pm2 logs iescms` (PM2 captures all console output, see "Logging" below). A typo in a live-edited `site.cfg` degrades to "stale config" rather than "site goes blank."
- **Every `FlexJson` used here is constructed with `ThrowOnError:false`**: `new FlexJson(undefined, undefined, false)` — the 3rd constructor param (default `true`). With this flag, a parse failure sets `.Status`/`.statusMsg` (the exact line/position, e.g. `"Expected : symbol in key:value pair @Line:1 @Position:0"`) instead of throwing a `FlexJsonError` — see `require/FlexJson/FlexJsonClass.js`'s `StatusErr()`, which only calls `throw` when `this._throwOnError` is true. This is the correct mechanism for "parse this and tell me what went wrong without crashing" — don't reach for `try/catch` around `DeserializeFlexFile()`/`DeserializeFile()` as the primary error signal; construct with `ThrowOnError:false` and check `.Status` instead.
- `cms.SECRETS` (below) follows the identical cache+mtime-check pattern, added first and then applied to `cms.SITE` for consistency.

---

## Per-Site Secrets (`cms.SECRETS`)

For credentials (API keys, tokens) a site needs but must not commit inside its own `site.cfg`/`site.jfx` — most websites are their own separate git repo (see README's "Install each website"), so a value written into `site.cfg` goes straight into that repo's history.

- Optional file: `websites/<siteId>/secrets/secrets.jfx` — a FlexJSON file, shaped however that site needs. Omit it entirely if the site has no secrets.
- **Loaded once at server startup** (`app.js`, into a `siteID → { cfg, path, mtimeMs }` map), then kept fresh via `getSiteSecrets(siteId)` — the same cache+mtime-check pattern as `cms.SITE` above, applied here first. Unlike a pure startup-only cache, **rotating a token in an already-present `secrets.jfx` takes effect on the very next request, no app restart needed** (revised 2026-08-12 for exactly this reason — see PRD.md #REQ-SECRETS-01-02). Only sites with a `secrets.jfx` at startup pay the per-request `statSync` cost; a site with none returns an empty `FlexJson` at zero I/O (unlike `cms.SITE`, which every real site has one of, so it always pays the check). Adding a `secrets.jfx` to a site that had none at boot still needs a restart, same as adding a brand-new site folder.
- Exposed at request time as `cms.SECRETS` — always a valid `FlexJson` object (empty if the site has no secrets file), assigned right alongside `cms.SITE` in `app.js`. Read it the same way as `cms.SITE`/`cms.SERVER`:
  ```javascript
  const apiKey = cms.SECRETS.getStr('anthropic.apiKey', '');
  ```
- **Never wired into the `[[tag]]` lookup chain.** `getParam()`/`getParamStr()` in `require/iesCommon.js` only ever check `HEADER → SITE → SERVER` — `cms.SECRETS` is deliberately excluded, so a `[[someTag]]` in page/template content can never accidentally render a secret. The only way to read one is code explicitly calling `cms.SECRETS.getXxx(...)`.
- This is a fixed filename, always exactly `secrets.jfx` — unrelated to the `site.cfg`/`site.jfx` dual-naming resolver described below; there is no `.cfg` fallback for secrets.
- **Any site adopting this must gitignore its own `secrets/` folder** (that site's own `.gitignore`, not the platform root one):
  ```
  /secrets/*
  !/secrets/.gitkeep
  ```
  plus a committed `secrets/.gitkeep` and a `secrets-example.jfx` template at the site root. Start from `secrets_SAMPLE/website-secrets-SAMPLE.jfx` (generic template), or see `websites/chatbot/secrets-example.jfx` for a working real-world example (`anthropic.apiKey` / `openai.apiKey`), and `websites/chatbot/cmd/chat/sendMessage_pub.js` for a consumer.

---

## Admin Edit System (eclass)

The admin UI uses "edit class" config files in `cmsCommon/config/eclass-*.cfg` to define editable data tables. The `CommonConfigFolder` in `server.cfg` must point to `cmsCommon/config/` for these to be found.

- File names **must be all lowercase** (Linux case-sensitive)
- Fields are defined in `EditFields` and `SearchList` arrays
- `PrimaryKeyNumeric:true` means the DB key is an integer; string keys get auto-quoted by `dbStr()`
- When `id=*new*` (add record), the DB query is skipped and an empty form is returned

The front-end is `cmsCommon/src/admin-editlist.js` (jQuery-based). Key functions:
- `SetHeader()` — loads eclass config info, populates `SearchConfig`
- `SetItem()` — receives record data, calls `GenForm()`
- `GenForm(editFields, fieldData, primaryKey, id, defaults)` — renders the edit form HTML
- `bViewOnly` controls whether fields are read-only — must be `false` for editing

---

## Linux / Case Sensitivity

All filenames in `cmsCommon/` and `websites/` must be **all lowercase**. The CMS calls `.toLowerCase()` on eclass filenames before lookup. Git on Windows (`core.ignorecase=true`) does not detect case-only renames — use a two-step `git mv` through a temp name if needed.

---

## Logging

- `cms.logMessage(level, msg)` — level 5=verbose, 1=general, 0=always
- `cms.logError(msg)` — always logs, prefixes `[ERR]`
- DB errors log SQL (truncated to 500 chars) via `console.log`
- PM2 captures all console output — use `pm2 logs iescms` on server
