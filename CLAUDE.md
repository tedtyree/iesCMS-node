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
├── site.cfg                  # Required. SITEID, Domains, databasename, paths
├── pages/<pageId>.cfg        # One file per web page
├── templates/layout_*.cfg   # HTML layout wrappers
├── require/website_engine.js # Optional custom engine (overrides cmsCommon)
├── cmd/**/*.js               # Optional API handlers (override cmsCommon)
├── db/
│   ├── site-db.jfx           # Optional: lists site-specific tables
│   └── table-*.sql           # Optional: SQL schemas for site tables
└── orig/                     # Optional: original HTML site for reference
```

`cmsCommon/` provides defaults for everything — pages, templates, cmd handlers, DB schemas. Site-specific files override cmsCommon equivalents.

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
