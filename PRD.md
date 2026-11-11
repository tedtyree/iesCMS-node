# iesCMS - NodeJS

Super simple content management system (CMS) leveraging NodeJS.

What makes it unique:

- Very easy to install/setup and config a new website
- Each website is contained within its own folder
- Optional .js extensions/engine can be added per website; require/website_<id>.js
- Front-end is very much HTML/CSS/JS ... not a complex proprietary framework
- Tag replacement is built in
- Configs and tag replacement enable single source - for example one menu (html) used on each web page.
- Flex JSON config files make it easy to read and manage the server, system, and each website.
- This CMS is designed to make it easy for a developer/admin to setup and manage simple websites. It is not intended to be all-things-to-all-people or to be a build-your-own-website platform. (Although Claude-AI seems to be very proficient at developing websites in this environment making it easy for a non-technical person to create a website from scratch)

&nbsp;

   NOTE: Uses Flex JSON: https://www.npmjs.com/package/flex-json

NOTE: Each requirement below is given a tag. In the sources code, the tags will be used to identify portions of the code that implement that requirement.

## Case Insensitivity [#REQ-CASEINSENSE-01]

General design rule: iesCMS should be case-insensitive end to end — config keys, tag names,
field/column names, command/endpoint ids — anywhere a human (site builder or admin) types an
identifier by hand [#REQ-CASEINSENSE-01-01]. PostgreSQL itself already forces this for unquoted
identifiers (folds everything to lowercase), and FlexJson's `getStr`/`getNum`/`contains`/`.i()`
already do case-insensitive key lookups to match — the config-file layer is fine. The actual risk
is plain JS object-property access (`obj[key]`), which is always case-sensitive in JavaScript, so
any code pulling a value out of a DB-row object using a name that came from a config file (an
eclass's `PrimaryKey`, a `Field` name, etc.) must either lowercase that name first or fall back to
the lowercased key if the exact-case lookup misses [#REQ-CASEINSENSE-01-02] — don't assume a
config-authored identifier already matches the row object's casing.
- **Known instance fixed** [#REQ-CASEINSENSE-01-03]: `cmsCommon/src/admin-editlist.js`'s
  `ReturnSearch()` looked up `row[SearchConfig.PrimaryKey]` with no lowercase fallback, while the
  column-value lookup a few lines below it already had one (`row[field] !== undefined ? row[field]
  : row[field.toLowerCase()]`). Every eclass whose `PrimaryKey` happened to already be written
  lowercase in its config (`edit-members`: `userid`, `edit-wikipage`: `pageid`) worked fine by
  accident; `eclass-messagelog.cfg`'s `PrimaryKey:"wLogID"` didn't match the real Postgres column
  `wlogid`, so `pk` was always empty and no Message Log row was ever clickable. Fixed both the
  config (`PrimaryKey:"wlogid"`) and the lookup itself (added the same fallback pattern used
  elsewhere in the file) so a future eclass with a mixed-case `PrimaryKey` doesn't silently hit the
  same thing.
- When adding new code that extracts a config-authored field/key name from a DB-row object, follow
  the existing fallback pattern (`row[name] !== undefined ? row[name] : row[name.toLowerCase()]`)
  rather than assuming callers will always write lowercase identifiers in their config.

## Admin Edit Form Field Types — Engine Fixes [#REQ-EDITFORM-01]

`cmsCommon/src/admin-editlist.js` (the shared jQuery eclass list/edit engine used by every
`admin-edit?eclass=...` screen on every site — see `admin-editlist.js`'s `MakeEditRow()`) is a
line-by-line JS port of an older VB/C#-era codebase. Large sections were left as commented-out
reference source during that port, and a few spots that look like real, live JS turned out to
still carry untranslated syntax or stub bodies — broken for *every* eclass/site using that field
`Type`, not just one admin page, so each was fixed at the engine level rather than patched per
page [#REQ-EDITFORM-01-01].

- **Dropdown fields (`Type:list`, `lkup`, `class`, and every `list-status`/`list-yesno`/etc. alias)
  were non-functional, not just mis-labeled** [#REQ-EDITFORM-01-02] — three separate bugs stacked:
  1. `case "list", "lkup", "class":` — a comma inside one `case` label is a JS comma-expression,
     not multiple alternatives, so this only ever matched `"class"`; `"list"`/`"lkup"` fell through
     to `default:` (the "INVALID TYPE" message). Fixed by stacking proper separate `case` labels
     (the same pattern already used correctly a few lines above for `list-status`/`list-status3`).
  2. Even reached, it called `fAddDDown(dField2, sOpts, nWidth)` where `sOpts` is a plain
     comma-separated **string** (e.g. `"Active,Inactive,Deleted"`, optionally `"value:Label"`
     pairs, e.g. `list-viewlevels1`'s `"7:Hidden (Admin Only),3:Members Only,..."`), but
     `fAddDDown` expected an **array** of `{value,text}` objects — `sOpts.length`/`sOpts[i].value`
     against a string produced garbage. Added `ParseOptsString()` to convert the string format
     into the array `fAddDDown` needs, handling both the plain and `value:label` forms.
  3. The real-world call path (`GenForm()` → `MakeEditRow(..., true)` — the only live call site;
     a second call site exists only inside the dead VB-syntax block) always took the
     `useFormContent` branch, which called `GenerateOpts2()` — a no-op stub
     (`debugger; return [{}];`) — and then discarded the `<select>` HTML `fAddDDown` returned
     without ever appending it to the row's output, and without closing the `<td>`/`<tr>` tags it
     had opened, corrupting every row rendered after it in the same form. Replaced the whole
     branch with a direct, always-taken path: build the options array, call `fAddDDown` (now also
     given the field's current value so it marks the matching `<option>` as `selected`,
     case-insensitively per `#REQ-CASEINSENSE-01`), and append + close the row properly.
  - Everywhere a `Status`/`Template`/similar dropdown appears on any site's Users, Pages, Message
    Log, or Galleries screen was affected by this; all now render and pre-select correctly.
- **`fAddHid()` (`Type:hidden`) was a literal stub** [#REQ-EDITFORM-01-03] — `return "fAddHid";`,
  so hidden fields rendered the bare text "fAddHid" into the page instead of a real
  `<input type="hidden">`, and the value was never submitted on save. Live and broken for
  `edit-members`'s `SiteID` field and `edit-galleries`'s `WorldID` field. Fixed to actually render
  `<input type='hidden' id='...' name='...' value='...'>`.
- **`Type:richtext` had never been ported — it only existed inside a commented-out VB block**
  [#REQ-EDITFORM-01-04], used by `edit-wikipage`'s `WikiHTML` (page content) and
  `messagelog`'s `Comments`. The CKEditor upgrade/downgrade machinery it was designed to hook into
  was already fully implemented and present (`SetItem()` converts any `<textarea id="rt_...">`
  into a CKEditor instance after the form renders; `SaveItem()` reads `.getData()` back out of it
  before the form serializes) — it had simply never had a live `case` to produce that `rt_`-prefixed
  textarea in the first place. Implemented it, with one deliberate deviation from the old dead
  code: the textarea's `id` is `rt_fld<Field>` (so the CKEditor-upgrade hook finds it) but its
  `name` stays `fld<Field>` (not `rt_fld<Field>`) — `saveRecord_admin.js` looks up
  `body['fld' + fieldName]` exactly, so keeping the old code's single `rt_fld<Field>` id-and-name
  would have rendered and edited fine but **silently failed to save** (posted under a key the
  server never looks for).
- **`Type:params` reworked into a real, generically-useful feature** [#REQ-EDITFORM-01-05] — this
  type's old case body (never actually used by any eclass) called a nonexistent `Replace()` and
  VB `&` string concatenation, assuming a pipe-delimited value format that doesn't match how any
  real column is written. The real need: `messagelog.Params` (and potentially other sites'
  JSON-text columns) holds the raw submitted form data as a JSON-text blob — `SaveFormToLog()` in
  `iesCommon.js` always writes it via `JSON.stringify(formData)`, so it's reliably strict JSON, not
  the pipe-delimited format the old code assumed. Reworked `Type:params` into a read-only
  key/value display: parses the column with `JSON.parse()` (consistent with the same codebase's
  existing precedent for the analogous `extra` JSONB blob, which also just uses `JSON.parse()` —
  no FlexJson involved, since FlexJson has no browser bundle and isn't loaded client-side anywhere)
  wrapped in try/catch, falling back to escaped raw text for any non-JSON legacy/migrated row:
  renders no `name` attribute, so it's simply absent from the posted form and the save handler
  (which already skips any field not present in the post body) leaves the stored value untouched —
  there was never a reason to let an admin hand-edit a public form submission's raw JSON anyway.
  Wired into `eclass-messagelog.cfg` (`Field:Params,Type:params,Flags:l`) so the admin can finally
  see the actual submitted message (previously only visible via a direct DB query), and reusable by
  any other eclass with a similar JSON-text blob column — the key set it displays is whatever keys
  are actually present, not hardcoded to any particular form's field names, so it works for any
  site's contact-form shape, not just `un0`'s.
- **Not fixed — flagged only, not a regression** [#REQ-EDITFORM-01-06]: `list-templates` and the
  generic `plist-<Name>` mechanism (`edit-wikipage`'s `Template`/`MinViewLevel`/`MinEditLevel`
  fields) were never implemented in the Node port at all — the only "implementation" anywhere in
  the codebase is dead C#-syntax reference source in `iesCommon.js` (`public string
  MakeEditRow(...)`, `DirectoryInfo`, etc. — not valid JS, never executed). Porting this is a new
  feature, not a bug fix; left alone pending a separate decision.

## DB Row → FlexJson Conversion: Date/Timestamp Columns [#REQ-DBJSON-01]

Every query result, for every table on every site, is converted from a raw `pg` row object into
a FlexJson row by `BuildJSON()` in `require/iesDB/iesDataReaderClass.js` — not specific to Message
Log or any one eclass. `node-postgres` returns `timestamp`/`date` columns as native JS `Date`
objects, and `FlexJson.add(value, key)` cannot serialize a `Date` (it has no enumerable own
properties, so it's neither a usable primitive nor something `FlexJson.FromNative` can convert —
the canonical `flex-json` library doesn't special-case `Date` either, see its `FromNative`/
`FromNativeObject`). The existing code already threw and caught this
(`catch { newJ.add(new FlexJson("null"), k); } //Invalid date values throw an error. Here we
ignore it and use NULL.`) — meaning **any timestamp column, on any table, was always silently
rendered as `null`/blank**, not a new regression. First noticed via Message Log's `SubmitDate`
being blank in both the list and the opened-record form [#REQ-DBJSON-01-01].
- **Fix** [#REQ-DBJSON-01-02]: convert a `Date` value to a plain `"YYYY-MM-DD HH:mm:ss"` string
  (same format `iesCommon.js`'s `dbDatetime()` already uses elsewhere) before handing it to
  `FlexJson.add()`, so it round-trips as an ordinary string the same way every other column type
  already did. Local helper (`dbDatetimeStr()`) added directly in `iesDataReaderClass.js` rather
  than touching `require/FlexJson/FlexJsonClass.js` — that file is a straight, un-customized
  vendored copy of the canonical `flex-json` repo (see the FlexJSON section above), so an
  iesCMS-specific fix belongs in iesCMS's own DB-row-conversion code, not inside the vendored
  library copy where it would create local drift and be lost on the next re-sync.
- Verified with a standalone simulated row (no live DB needed): a `Date`-valued column now
  serializes as `"2026-09-28 04:14:17"` instead of `null`.
- Any other table with a `timestamp`/`date` column (not just `messagelog`) was equally affected
  and is fixed by this same change — worth a general sanity check on any admin list/form that
  displays a date column, since this had been silently blank everywhere, possibly for a long time.

## Folder/Extensions per Website [#REQ-FOLDER-01]

- Each website is contained within its own folder [#REQ-FOLDER-01-01]  
- Folder name is also used as a VID (visual ID) for the website [#REQ-FOLDER-01-02]
- Optional .js extensions can be added per website; require/website_<id>.js [#REQ-FOLDER-01-03]
- If no require provided for a website, a default common engine will be used [#REQ-FOLDER-01-04]
- The website engine can replace the entire common engine OR can extend/override specific parts of it [#REQ-FOLDER-01-05] esp for things like tag definitions/functionality and api endpoints.
- API endpoints are not typical NodeJS routes. Instead there is a single command endpoint that handles all API requests. [#REQ-FOLDER-01-06] - currently "cmd" but could be changed in the future to "api" or other standard.
- Optional CustomForms() can be added per website in the custom engine to process forms that are unique to the website [#REQ-FOLDER-01-07]
- Not yet implemented? handleEvents() can be added per website in the custom engine to extend functionality for events per website [#REQ-FOLDER-01-08]
- The admin-extras.cfg in pages folder is an extension of the admin page and can be used to add custom menu options/functionality to the admin page [#REQ-FOLDER-01-09] — see `#REQ-ADMINUI-01-02a` for the expected markup shape on the dashboard template.

## Database per Website [#REQ-DB-01]

- Websites can load and run without a database (users will not be able to self-manage their accounts/content) [#REQ-DB-01-01]
- Each website that requires a database declares `databasename` in its `site.cfg` — this is the single authoritative source for the database name [#REQ-DB-01-02]
  - The presence of `databasename` in `site.cfg` is the trigger for both DB initialization at startup and DB connection in the website engine
  - Sites without `databasename` in `site.cfg` are silently skipped by both systems
- Database connection credentials (`host`, `port`, `user`, `password`) are shared across all sites and stored in `secrets/server.cfg` under the `DbConnect` key — no per-site credentials [#REQ-DB-01-03]
- At startup, `iesDbInit.js` automatically creates any missing site databases and tables [#REQ-DB-01-04]:
  - Reads `databasename` from each site's `site.cfg`
  - Connects to the PostgreSQL admin (`postgres`) database and issues `CREATE DATABASE` if the site DB does not exist
  - Connects to the site database and creates any missing tables using `.sql` files from `cmsCommon/db/` (common tables) and optionally `websites/<siteId>/db/` (site-specific tables)
- Each site can optionally extend the common table set by providing `websites/<siteId>/db/site-db.jfx` with a `tables` array listing additional table names [#REQ-DB-01-05]
  - `site-db.jfx` is not required — sites that only use common tables do not need this file
  - SQL schema for each table (common or site-specific) must exist as `table-<tablename>.sql` in either `cmsCommon/db/` or the site's `db/` folder; the site-local file takes precedence
- The website engine (`website_engine.js`) sets up the DB connection object at request time using `iesDbClass(dbName, dbCfg)` — no actual connection is made until the first DB query [#REQ-DB-01-06]
  - `dbName` comes from `cms.SITE.getStr('databasename', '')`
  - `dbCfg` comes from `cms.SERVER.i('DbConnect')` (shared credentials from `server.cfg`)
  - If either is absent, `cms.db` is not created and the site runs without a database for that request

## Config Files and Layers [#REQ-CONFIG-01]

- FlexJSON config files make it easy to read and manage - and config for each layer:
  - the server [#REQ-CONFIG-01-01]
  - each website [#REQ-CONFIG-01-02]
  - each page as a header block [#REQ-CONFIG-01-03]
- Each tag can refer to other tags using a sub-tag reference for example: site.cfg can contain a property ,HomeURL:"http://[[www]].[[URLHost]]" where [[www]] and [[URLHost]] are sub-tags that will be replaced with their actual values. [#REQ-CONFIG-01-04]
- Configs from page, site, server get merged/layered such that a tag in a page could come from any of the layers. [[page_title]] would first look in the page header config, then the site config (maybe a defualt vlaue), and then the server config. [#REQ-CONFIG-01-05]
- **TEMPORARY, during migration** [#REQ-CONFIG-01-06]: each site's config file may be named either `site.cfg` (legacy) or `site.jfx` (new) — every place that loads it (`app.js` startup site discovery, `app.js` per-request `cms.SITE` load, `iesDbInit.js`, `util/listSites.js`) resolves through the shared `require/resolveSiteConfig.js` helper. If a site has both files, `site.jfx` wins and `site.cfg` is ignored. Once all sites are migrated to `site.jfx`, this dual-lookup and the helper should be removed and the `.jfx` name hardcoded again.
- **`cms.SITE` is loaded once at startup and kept fresh via a cheap per-request `fs.statSync().mtimeMs` check**, not a full re-parse every request [#REQ-CONFIG-01-07]. Same pattern as `cms.SECRETS` (REQ-SECRETS-01-02), and revisited for the same reason: `require/iesCommon.js`'s `overrideMinViewLevel` ("used for locking website") lets `OverrideMinViewLevel` in a single site's `site.cfg`/`site.jfx` be hand-edited on a live server to lock/unlock just that one site — the mtime check means an edit is still picked up on the very next request, with no app restart, because editing the file changes its mtime and invalidates the cache entry for that one site only. Restarting the shared Node process to lock one site would interrupt every other site's live users, which is why a plain read-once-forever cache was rejected.
  - **History**: a full re-parse on every request was the original behavior specifically to support this live-lock workflow; a startup-only cache (no reload check at all) was evaluated and explicitly rejected (2026-08-12) for the same reason. The mtime-check middle ground was adopted immediately after, once the same pattern was proven out for `cms.SECRETS` (2026-08-12) — it gets the caching benefit without losing the live-edit capability.
  - The startup parse (`app.js`'s site-discovery loop) is reused directly as the initial cache entry rather than parsing the file twice.
  - A site with no cache entry at all (e.g. `mimic` targeting a siteId that wasn't successfully discovered at startup) falls back to a direct, uncached read via `resolveSiteConfigPath()` — the same live lookup the platform always did before caching was added — rather than failing outright.
  - If a reload attempt fails to parse, the last-known-good cached config is kept and served rather than going blank, and the failure is logged via `console.log()` (reaches `pm2 logs iescms` — PM2 captures all console output, see "Logging" below).
  - **Every `FlexJson` instance used to load/reload a site's `site.cfg`/`site.jfx` or `secrets.jfx` is constructed with `ThrowOnError:false`** (`new FlexJson(undefined, undefined, false)`, `require/FlexJson/FlexJsonClass.js`'s 3rd constructor param, default `true`) [#REQ-CONFIG-01-08]. With this flag, a parse failure sets `.Status`/`.statusMsg` (the exact line/position of the problem, e.g. `"Expected : symbol in key:value pair @Line:1 @Position:0"`) instead of throwing a `FlexJsonError` — verified directly against the class (`StatusErr()` only calls `throw` when `this._throwOnError` is true). This replaced an earlier version that wrapped `DeserializeFlexFile()` calls in `try/catch` to guard against exceptions on malformed content; the `ThrowOnError:false` flag is the correct, purpose-built mechanism for this and was adopted once it was confirmed to exist, removing the need for exception handling as the primary signal.

## Per-Site Secrets [#REQ-SECRETS-01]

Allows a website to keep credentials (API keys, tokens, etc.) out of its `site.cfg`/`site.jfx`, which is typically committed to that site's own git repo (see README's "Install each website" — each website is normally its own repo).

- Each website can optionally provide `websites/<siteId>/secrets/secrets.jfx` — a FlexJSON file structured however that site needs [#REQ-SECRETS-01-01]
  - Not required — a site with no secrets simply omits the file
  - Always named exactly `secrets.jfx`. This is unrelated to the `site.cfg`/`site.jfx` dual-naming migration in REQ-CONFIG-01-06 — there is no `.cfg` fallback for secrets.
- Loaded once at server startup into an in-memory cache, kept fresh via a cheap per-request `fs.statSync().mtimeMs` check rather than a full re-read/re-parse every request [#REQ-SECRETS-01-02]
  - **Revised 2026-08-12** — originally cached forever (a rotated token required a full app restart, same as adding a brand-new site folder). That was rejected once flagged: a shared Node process serves every site, so restarting it to rotate ONE site's leaked/rotated key would interrupt every other site's live users too — the same reasoning behind `cms.SITE`'s per-request reload for `OverrideMinViewLevel` (see REQ-CONFIG-01-07). The mtime check adds only a `statSync` call (not a re-parse) on the common unchanged-file case, and only for sites that actually have a `secrets.jfx` — a site with none pays zero extra cost.
  - A site whose `secrets.jfx` didn't exist at startup still needs a restart if one is added later — only edits/rotations to an *already-present* file are picked up live. Adding a brand-new site folder still requires a restart regardless, same as before.
- Exposed at request time as `cms.SECRETS` — a FlexJson object, always defined (an empty one for a site with no secrets file) [#REQ-SECRETS-01-03]
  - Read via `cms.SECRETS.getStr('someKey', '')` / `getNum(...)` / `getBool(...)`, the same accessor pattern as `cms.SITE`/`cms.SERVER`
- **`cms.SECRETS` is deliberately excluded from the HEADER → SITE → SERVER tag-lookup chain** (`getParam()` in `require/iesCommon.js`) [#REQ-SECRETS-01-04]
  - A page/template `[[someTag]]` never resolves from `cms.SECRETS` — a secret can only be read by code that explicitly calls `cms.SECRETS.getXxx(...)`, so it can never be accidentally rendered into HTML output the way a `cms.SITE` value could be
- Any website that adopts this feature must add its own `/secrets/*` ignore rule to its own `.gitignore` [#REQ-SECRETS-01-05]
  - Convention: `/secrets/*` + `!/secrets/.gitkeep` (keeps the empty folder tracked in git while ignoring its contents) + a committed `secrets-example.jfx` template at the site root documenting the expected shape
- First adopted by the `chatbot` site (`websites/chatbot/secrets/secrets.jfx`, holding `anthropic.apiKey` / `openai.apiKey`) [#REQ-SECRETS-01-06]

## Per-Site Hot Reload [#REQ-HOTRELOAD-01]

A single site's `website_engine.js`/`cmd/**/*.js` code changes must be deployable without restarting the shared `iescms` process, which would otherwise interrupt every other site's live users for a one-site deploy — the same motivation as the `cms.SITE`/`cms.SECRETS` live-reload above, extended to code rather than config.

- Opt-in local-only HTTP control endpoint (`127.0.0.1` only, via `AdminControlPort` in `secrets/server.cfg`) lets a CI/CD deploy script or server admin on the box trigger a reload of one site, or of every site plus discovery of brand-new site folders — not exposed as a site-facing/authenticated API, since the caller already has shell access to the server.
- Full design, endpoints, and known limitations: `docs/site-hot-reload.md`. Operator-facing usage: README's "Reloading a single website". Code reference: CLAUDE.md's "Per-Site Hot Reload" section.

## Common support functions to handle standard functionality across websites [#REQ-COMMON-01]

- Common support functions are provided to handle standard functionality across websites [#REQ-COMMON-01-01]
    - Reaplcetags() - replaces [[tags]] in content with values from the config (or in some cases a custome process)
    - getParamStr() - gets a parameter from the configs
    - LoadHTMLfile() - loads an HTML file and processes it with Reaplcetags()
- **Tag collision warning** [#REQ-COMMON-01-02]: The tag processor scans ALL content in `.cfg` files (pages, templates, partials) for `[[...]]` sequences. Any literal `[[` in page content — including JavaScript, JSX, or HTML — will be treated as a tag substitution and may corrupt the output. **To include a literal `[[` in page content, insert a space: write `[ [` instead of `[[`.** Common trigger: JavaScript array-of-arrays literals inside JSX `.map()` calls.

## Tag Replacement in JS/CSS Static Files [#REQ-TAG-02]

Opt-in only, to avoid the REQ-COMMON-01-02 collision problem in third-party/minified files.

- A `.js`/`.css` file is only considered for tag processing if its first 3 characters are exactly `[[{` — anything else is streamed raw, untouched [#REQ-TAG-02-01]
- That header runs from `[[{` to the first `}]]`, parsed as FlexJson, and is always stripped from the response regardless of its contents [#REQ-TAG-02-02]
- `ReplaceTags:true` in the header runs the remaining file body through the normal `ReplaceTags()` (same as page/template tags, just with no layout template wrapped around it); default is `false` if the key is omitted [#REQ-TAG-02-03]
- If `}]]` is missing or the header fails to parse, the file is served completely as-is (no strip, no error) [#REQ-TAG-02-04]
- Example: `cmsCommon/src/ckFinderLogin.js` starts with `[[{ ReplaceTags: true }]]` to substitute `[[userObjID]]`, `[[world]]`, `[[sessionID]]` [#REQ-TAG-02-05]

## /orig Folder — Protected Original Site Reference [#REQ-ORIG-01]

Allows a web developer to drop a complete original HTML website into a site's `/orig` subfolder and access it through the CMS with password protection. Useful during active CMS development: the developer can compare the in-progress CMS pages against the original HTML design.

- Each website folder can optionally contain an `orig/` subfolder [#REQ-ORIG-01-01]
- The `orig/` folder is intended to hold a complete original HTML website (typically with `index.html` as the default/home page) [#REQ-ORIG-01-02]
- `site.cfg` can include an optional `origMinViewLevel` parameter (integer 0–9) [#REQ-ORIG-01-03]
  - If absent from `site.cfg`, defaults to `1` (requires any logged-in user)
  - `0` = publicly accessible (no login required)
  - `1`–`9` = requires a user with that minimum access level
- All requests whose URL path begins with `/orig` are intercepted in `app.js` before the website engine is invoked [#REQ-ORIG-01-04]
  - If `origMinViewLevel == 0`, the file is served directly (publicly accessible) [#REQ-ORIG-01-05]
  - If `user.userLevel >= origMinViewLevel`, the requested file is served as-is [#REQ-ORIG-01-06]
  - If `user.userLevel < origMinViewLevel`, the user is redirected to the site's `LOGIN_PAGE` with the original URL passed as a `deeplink` query parameter [#REQ-ORIG-01-07]
- Requests to `/orig` or `/orig/` (no file specified) serve `/orig/index.html` [#REQ-ORIG-01-08]
- Path traversal outside the `orig/` folder is blocked (returns 404) [#REQ-ORIG-01-09]
- Files are served with the correct MIME type using the standard CMS mime table [#REQ-ORIG-01-10]
- Implemented entirely in `app.js` — no per-site engine changes needed [#REQ-ORIG-01-11]

## Mobile / API Client Authentication [#REQ-MOBILE-AUTH-01]

The standard auth flow issues the JWT as an `HttpOnly` cookie (`Set-Cookie: token=<jwt>`) and reads it back from `Cookie: token=<jwt>` on subsequent requests. Browser clients handle this automatically. Native mobile apps (e.g. React Native / Expo) cannot rely on cookie jars in the same way, and secure-storage best practice is to hold the token in the OS keychain (iOS Keychain / Android Keystore) and send it as a header.

To support this without changing the JWT payload, secret, or expiry:

- **Login endpoint** [#REQ-MOBILE-AUTH-01-01]: a per-site `pubcmd` handler (e.g. `cmd/align/auth-login_pub.js`) can accept JSON credentials (`username`, `password`) and return the signed JWT in the **response body** (`{ success:true, token:"eyJ..." }`) rather than as a cookie. The handler uses the same `cms._isHashed()` / `cms._verifyPassword()` helpers and `jwt.sign()` call as the browser login path — the resulting token is identical.
- **Bearer token fallback in `app.js`** [#REQ-MOBILE-AUTH-01-02]: after the existing `Cookie: token` check, `app.js` also checks the `Authorization: Bearer <token>` request header. If the cookie check left the user unauthenticated and a valid Bearer token is present, it is verified with the same `jwt.verify()` / `cms.setUser()` call. The existing siteId cross-site rejection runs afterwards and applies equally to Bearer tokens.
- **No change to JWT internals** [#REQ-MOBILE-AUTH-01-03]: payload shape, `JWT_SECRET`, and `JWT_EXPIRES_IN` are shared between cookie and Bearer paths. A token issued by the mobile login handler is accepted by the cookie path and vice versa.
- **Security properties unchanged** [#REQ-MOBILE-AUTH-01-04]: scrypt password verification, timing-safe comparison, and site-scoped token validation all apply. The mobile app is responsible for storing the token in the OS keychain (not `AsyncStorage`) and transmitting it only over HTTPS.
- **Android Google OAuth client ID, per-site** [#REQ-MOBILE-AUTH-01-05]: Android OAuth tokens carry the Android client ID as the `aud` claim rather than the web client ID — a per-site `auth-google` handler must validate against both. `GOOGLE_ANDROID_CLIENT_ID` is read from that **site's own `site.cfg`** via `cms.SITE.getStr('GOOGLE_ANDROID_CLIENT_ID', '')`, not from the server-wide `secrets/server.cfg` — each mobile app has its own Android package name and signing key, and therefore its own Android client ID, so a single server-wide value could only ever validate tokens from one mobile app across the whole CMS server. `GOOGLE_CLIENT_ID` (web) keeps a server-wide default in `secrets/server.cfg` (`cms.GOOGLE_CLIENT_ID`, loaded in `app.js`) for sites that don't need their own, but a site can override it the same way via its own `site.cfg` — both `SessionLoginGoogle()` (browser flow, `iesCommon.js`) and per-site `auth-google` handlers check the site-scoped value first and fall back to the server default. See `websites/delta_align/site.cfg` for the first real example of a site setting both keys.

*First implemented for the delta_align site's MAR (Med Reminder) mobile app — see `websites/delta_align/docs/MED-Security.md` for the full design.*

## Password Hashing & Self-Service Account Management [#REQ-AUTH-02]

- Passwords are hashed with scrypt: `cms._hashPassword(plain)` / `cms._verifyPassword(plain, stored)` / `cms._isHashed(stored)` (`require/iesCommon.js`), stored as `$1$<base64-salt>$<base64-hash>` in `users.pwd` [#REQ-AUTH-02-01]
  - Legacy plain-text passwords (no `$1$` prefix) are matched by direct string compare and auto-upgraded to a hash on next successful login [#REQ-AUTH-02-02]
  - Any code path that reads or writes `users.pwd` must reuse these three helpers rather than re-implementing hashing [#REQ-AUTH-02-03]
- `cms.user` (an `iesUser`, `require/iesUser.js`) is the only source of the current session's identity — fields `userid`, `userName`, `loginid`, `userEmail`, `userLevel`, `siteId` — rebuilt from the verified JWT on every request [#REQ-AUTH-02-04]
- A "user manages their own record" cmd handler (e.g. self-service change-password) uses `auth:'user'` and must key every query off `cms.user.userid` from the session — never an id supplied in the request body [#REQ-AUTH-02-05]
- `minViewLevel` on a page header is enforced automatically by the website engine: below-level requests redirect to the site's login page (deep-link preserved), or get a JSON `401` if the page header sets `noRedirect:true` [#REQ-AUTH-02-06]
- No password complexity rules exist beyond a minimum length check (currently 6 characters, enforced server-side) — client-side checks are UX-only and never authoritative [#REQ-AUTH-02-07]

## OTP Phone Verification (Telnyx) [#REQ-OTP-01]

Platform-level phone number verification via SMS or WhatsApp OTP codes, built on Telnyx's Verify
API (`https://api.telnyx.com/v2`). Generic and reusable by any site on the platform — this layer
only proves phone ownership at a point in time; deciding what "verified" means for a given site,
and persisting that fact, is entirely up to that site.

- One shared, server-wide Telnyx account/Verify Profile is used by every opted-in site — not a
  per-site credential [#REQ-OTP-01-01]. Credentials (`apiKey`, `verifyProfileId`) live in
  `secrets/server.cfg`'s `Telnyx` block, read via `cms.SERVER.getStr('Telnyx.apiKey','')` /
  `cms.SERVER.getStr('Telnyx.verifyProfileId','')` — same pattern as the SMTP `email_*` keys. See
  `secrets_SAMPLE/server-PUBLIC-SAMPLE.cfg`. A Telnyx account needs, at minimum: an API key
  (Mission Control Portal → API Keys) and a Verify Profile (Portal → Verify → Profiles, with the
  WhatsApp channel enabled if that's needed — Telnyx handles the WhatsApp Business integration
  internally for Verify, no separate Meta/WABA setup is required).
- `require/telnyxVerify.js` is the only code that talks to Telnyx (plain `axios` REST calls, no
  SDK dependency) [#REQ-OTP-01-02]. It exports:
  - `toE164(countryCode, rawPhone)` — normalizes a calling code (digits only, no `+`) + raw digits
    into E.164 (`+15550100`); returns `null` if the result doesn't look like a real phone number.
    If `rawPhone` already starts with `+`, it's used as-is and `countryCode` is ignored.
  - `sendVerification(cms, phoneE164, channel)` — `channel` is `'sms'` or `'whatsapp'`; triggers a
    Telnyx Verify send. Returns `{ success, error? }`.
  - `checkVerification(cms, phoneE164, code)` — checks a user-submitted code against Telnyx.
    Returns `{ success }`.
  - `issueVerifiedReceipt(cms, phoneE164, channel)` / `checkVerifiedReceipt(cms, token, phoneE164)`
    — see the receipt pattern below.
- **No OTP code is ever generated or stored by this platform** — Telnyx's Verify API is itself the
  system of record for code generation, expiry, and attempt-limiting [#REQ-OTP-01-03]. The only
  thing this platform persists is a short-lived (10-minute) signed JWT **receipt**
  (`issueVerifiedReceipt()`, signed with `cms.JWT_SECRET`, claims `{purpose, phone, channel,
  siteId}`), minted once Telnyx confirms a submitted code was correct — proof that exact phone
  number was verified, without the platform needing to store anything about the OTP code itself.
  Consuming code must validate the receipt server-side with `checkVerifiedReceipt(cms, token,
  phoneE164)` before trusting it (it checks the signature, `purpose`, an exact phone match, and
  `siteId`) — **never trust a client-submitted "this phone is verified" flag on its own.**
- Two generic `pubcmd` endpoints, auto-available to every site because `cmsCommon/cmd/**` is
  merged into every site's command registry by `cmdRegistry.js` [#REQ-OTP-01-04]:
  - `otp/send` — `POST /pubcmd { cmd:'otp/send', phone, countryCode, channel }` →
    `{ success:true }` or `{ success:false, error }`.
  - `otp/verify` — `POST /pubcmd { cmd:'otp/verify', phone, countryCode, code, channel }` →
    `{ success:true, receipt:"<jwt>" }` or `{ success:false, error }`.
  - Both are `auth:'public'` — they must be callable before a session exists (e.g. during
    registration, where there is no logged-in user yet).
- **A site must explicitly opt in** — both endpoints check `cms.SITE.getBool('OtpEnabled', false)`
  and refuse to run otherwise [#REQ-OTP-01-05]. Because the Telnyx account is shared and billed
  centrally across the whole platform, this stops an unrelated or test site from silently running
  up per-verification charges just because the handlers exist in its registry (which they do,
  automatically, for every site, opt-in or not — the flag only gates whether they'll actually run).
- `otp/send` enforces a small in-process rate limit: 10 sends per phone number per hour, 40 sends
  per IP address per hour [#REQ-OTP-01-06]. This is a narrow limiter local to that one handler
  file (`cmsCommon/cmd/otp/send_pub.js`), not a reusable platform module — a shared
  `require/rateLimit.js` was deliberately not built (see `websites/chatbot/CLAUDE.md`'s
  rateLimit.js incident note for why a generic reusable rate-limit module was avoided a second
  time here).

### Adding OTP verification to a new site [#REQ-OTP-01-07]

1. Add `OtpEnabled: true` to the site's `site.cfg`/`site.jfx`.
2. From the client, call `otp/send` with the phone number, a country calling code (digits only,
   no `+`), and a channel choice (`'sms'` or `'whatsapp'` — typically a user-facing toggle).
3. Prompt the user for the code they received, then call `otp/verify` with the same
   phone/countryCode plus the submitted code. On success this returns a `receipt` string, valid
   for 10 minutes.
4. Pass that `receipt` (plus the phone number and country code used) into whichever handler in the
   site's own `cmd/` needs to act on "this phone is verified" — e.g. account creation, a profile
   update, unlocking a feature. That handler validates the receipt itself before trusting it:
   ```javascript
   const { toE164, checkVerifiedReceipt } = require(path.resolve('./require/telnyxVerify.js'));
   const phoneE164 = toE164(cms.body.countryCode, cms.body.phone);
   const receipt = checkVerifiedReceipt(cms, cms.body.phoneVerifyReceipt, phoneE164);
   if (receipt) { /* phoneE164 is verified — receipt.channel is 'sms' or 'whatsapp' */ }
   ```
   `checkVerifiedReceipt()` returns `null` for anything invalid, expired, phone-mismatched, or
   issued under a different `siteId`.
5. Decide, and persist, what "verified" means for that site. This platform layer only proves phone
   ownership at the moment `otp/verify` succeeded — it is not stored anywhere as an ongoing fact
   by the platform itself. See `websites/chatbot/require/workspace.js`'s `setPhoneVerified()` /
   `getPhoneVerified()` for a real example: chatbot stores it in its own `workspace.jfx`, not the
   shared `users` table, because verification status there is that site's business logic (gating a
   feature), not platform-wide identity.
6. Always re-verify on change. Whenever the site later lets a user submit a *different* phone
   number, re-run this same flow rather than assuming a prior verified state still applies — see
   `websites/chatbot/cmd/account/updateProfile_user.js` for the pattern (any phone change resets
   that site's own verified flag unless a fresh, matching receipt comes with the change).

See `websites/chatbot/CLAUDE.md`'s "Phone Verification (OTP via Telnyx)" section for the full,
real end-to-end consumer of this (registration + Account Settings, gating free-tier bot creation
on a verified phone) — the concrete worked example to copy from when wiring this into another site.

## Contact-Form Message Log + Notification Throttling [#REQ-FORMNOTIFY-01]

Every site using the default `form_submit` handling (`cmsCommon/require/website_engine.js`)
previously emailed the site admin immediately on every form submission, with no way to hold back
spam/garbled-junk without also holding back real messages [#REQ-FORMNOTIFY-01-01]. This platform
feature makes notification throttled and spam-aware by default, without adding any cron/scheduler
process to the codebase — it is purely event-driven, triggered by requests that were already
happening (a form submission, an admin visiting the messages list).

- **`wlog` → `messagelog`** [#REQ-FORMNOTIFY-01-02]: form submissions used to log to a table
  called `wlog` that had no schema file and wasn't auto-created by `iesDbInit.js` (unlike every
  other common table) — it only worked because it happened to already exist in a shared database
  from the original iesCMS architecture, where one database/table was shared across every site. On
  this platform, each site now gets its own database (`databasename` in `site.cfg`), so a
  per-site id column inside a table already scoped to one site's database is redundant. `wlog` was
  replaced with `messagelog` (`cmsCommon/db/table-messagelog.sql`, listed in
  `cmsCommon/db/all-sites-db.jfx`) — identical shape, minus the site-id column, auto-created for
  every site the same way as `users`/`jobjects`/`jobjhist`/`app_log`. This is intentionally a
  narrow cleanup: other common tables that still carry a legacy `WorldID` column (e.g. `jobjects`)
  were left untouched.
  - Kept distinct from `app_log` (`cmsCommon/db/table-app_log.sql`), which is a generic
    system/developer diagnostics log (`cms.appLog(...)`) with no admin-facing review UI — different
    purpose, different shape. `messagelog` is the form-submission log with an existing admin review
    page built around its exact shape (`cmsCommon/config/eclass-messagelog.cfg` — mark-as-spam,
    `Comments`, `Status`, reachable at `/admin-edit?eclass=messagelog`).
- **Spam filtering** [#REQ-FORMNOTIFY-01-03]: unchanged mechanism, `require/iesSpamFilter/iesSpamFilterClass.js`,
  enabled per-site via that site's own `spam/spam.cfg` (`SpamFilterOn:true`). When a submission
  scores `SpamLevel > 0`, the real-time-email path (`EmailFormFlag`) is already suppressed
  (`website_engine.js`); the message is still always logged to `messagelog` with its `SpamLevel`/
  `SpamReason`, and its count is folded into the next legitimate notification's summary.
- **Event-driven notification throttle** [#REQ-FORMNOTIFY-01-04]: on every **non-spam** form
  submission, `cms.checkAndSendForm(SpamObj)` (`require/iesCommon.js`) decides whether to notify
  the site admin right now:
  1. Count non-spam `messagelog` rows with `SubmitDate` after the site's `FormLastAdminVisit`
     value (includes the message just submitted).
  2. If that count is **1** (first unread message since the admin last opened the messages list)
     → send now.
  3. Else if the time since `FormLastNotificationSent` is at least `NotifyAgainDays` (site.cfg key,
     default `7`) → send now (a reminder).
  4. Otherwise → do nothing.
  The notification email reports both counts since `FormLastAdminVisit` (e.g. *"3 new messages and
  5 spam messages since your last review"*) plus a link to `/admin-edit?eclass=messagelog`.
  `FormLastNotificationSent` updates whenever a send happens; `FormLastAdminVisit` updates
  separately, whenever the admin actually opens the messages list (hooked into
  `GenerateJsonData()`'s `editlist-json` handler in `iesCommon.js`, gated to the `messagelog`
  table only) — visiting the page never sends anything by itself, it only resets the "unread
  since" baseline.
  - **Known limitation**: because this only runs on non-spam submissions, a site that receives
    only spam and never a single legitimate message will never get any reminder email, even as
    spam accumulates in `messagelog`. This matches the stated intent ("spam doesn't count as a
    message to notify") but is worth revisiting if it surprises anyone in practice.
- **Per-site opt-out** [#REQ-FORMNOTIFY-01-05]: `NotifyOnEveryMessage` (site.cfg, bool, default
  `false`). Set `true` to fully restore the old behavior — immediate `cms.goSendEmail()` on every
  non-spam submission, throttle logic skipped entirely.
- **`params` table** [#REQ-FORMNOTIFY-01-06]: `FormLastAdminVisit`/`FormLastNotificationSent` are
  stored as rows in a new generic per-site key/value table, `params` (`id` primary key, `value`
  text; `cmsCommon/db/table-params.sql`, listed in `all-sites-db.jfx`) — no site-id column, same
  reasoning as `messagelog`. Read/write via `cms.getDbParam(id, defaultVal)` /
  `cms.setDbParam(id, value)` (`require/iesCommon.js`). This table is intentionally generic and
  reusable for future site-level settings beyond this feature — it isn't a single-purpose table.
- **Out of scope / not done here**: no migration of any pre-existing data from a live `wlog` table
  into `messagelog` — this only defines the new table going forward. If historical form-submission
  data needs to be preserved on a given server, that's a separate one-time manual migration.

See `docs/form-notification-plan.md` for the implementation-plan writeup this section supersedes.

## Admin Panel UI — Dashboard & Utility Templates [#REQ-ADMINUI-01]

The default admin panel (`cmsCommon/pages/admin.cfg` and the `admin-edit*` family) was a
table-based, ASP.NET-era layout carried over from the original CMS — hard to use, not
mobile-friendly, and not visually consistent page to page [#REQ-ADMINUI-01-01]. It now runs on
two templates sharing one nav block, replacing `cmsCommon/templates/layout_admin.cfg` as the
default for `admin.cfg`/`admin-edit.cfg` (the old template/menu files are untouched and still
used by anything still pointed at `Template:admin`):

- **`templates/layout_admin_dashboard.cfg`** [#REQ-ADMINUI-01-02] — the home page
  (`pages/admin.cfg`): site-config summary + Launch tile grid + `[[subpage:admin-extras]]`.
  - **`admin-extras` markup shape** [#REQ-ADMINUI-01-02a] — this is the pre-existing per-site
    "Admin Extras" extension point (`#REQ-FOLDER-01-09`), unchanged mechanism — a site adds its
    own `websites/<siteId>/pages/admin-extras.cfg` to override `cmsCommon`'s empty-state default
    and it gets inlined into the dashboard's `.tile-grid` via `[[subpage:admin-extras]]`. To look
    right there, each item should be a `<div class="tile extra-tile">` containing a
    `<span class="tile-icon">` (an inline SVG — `cmsCommon/pages/admin-extras.cfg`'s default stub
    uses a generic "sparkle" icon so a site doesn't have to pick one per item) and a
    `<p class="tile-title">`/`<p class="tile-desc">` pair; an optional `<span class="extra-badge">`
    can label where the link goes (e.g. "Specific to un0"). These classes come from
    `cmsCommon/src/admin2.css` — solid-fill orange, white text, no per-site CSS needed.
- **`templates/layout_admin_utility.cfg`** [#REQ-ADMINUI-01-03] — list/edit pages
  (`pages/admin-edit.cfg`, i.e. every `eclass=` screen: Pages, Users, Message Log, Settings,
  etc.): breadcrumb + card chrome wrapping `[[content_area]]`. Keeps the full legacy
  jQuery/jQuery-UI/DataTables/CKEditor head block the eclass editor depends on; the dashboard
  template doesn't load any of that.
- **Shared chrome** [#REQ-ADMINUI-01-04] — both templates include `pages/admin-shell.cfg` via
  `[[subpage:admin-shell]]` for the topbar + sidebar/drawer. This is exactly the existing
  subpage-include mechanism (no new plumbing), chosen because tag replacement already runs over
  the whole assembled template, not just page content, so a template can pull in a page-folder
  partial the same way a page can. Nav *links* still come from `[[menu:admin]]` →
  `templates/menu_admin.cfg` as before, just regrouped/iconed — unchanged mechanism.
- **Per-site override** [#REQ-ADMINUI-01-05] — this lives entirely in `cmsCommon/`, so any site
  can override any piece of it (`admin-shell.cfg`, `menu_admin.cfg`, either `layout_admin_*.cfg`,
  `admin.cfg`, `admin-edit.cfg`) the same way a site overrides any other cmsCommon file: drop a
  same-named file in its own `templates/`/`pages/` folder.
- **Theming** [#REQ-ADMINUI-01-06] — `src/admin2.css` / `src/admin2.js` (new, namespaced under
  `#app-shell` so none of this touches the legacy `admin.css`/`admin.js` used elsewhere). Dark/light
  toggle persists via `localStorage`, default dark. Mobile breakpoint turns the sidebar into an
  off-canvas drawer (same DOM, CSS transform — not a second nav render).
- **`admin-editlist-wide.cfg` re-skinned, not rebuilt** [#REQ-ADMINUI-01-07] — this file holds the
  DOM `admin-editlist.js` (the jQuery eclass list/edit engine) depends on by id:
  `editlist_title`, `editlist_search`, `editlist_form`, `editlist_loading`, `buttons_search1/2`,
  `buttons_save1/2`, `editlist_add1/2`, `editlist_refresh1/2`, `fltSearch`, `fltHistory`,
  `editlist_searchform`, plus the `remove_ok` class — and the result table it generates at
  runtime is `table.tabletext` / `tr.EditListTitles` (not a class anyone would guess from the old
  markup). All of these were kept exactly; only the surrounding HTML/classes were restyled. Any
  future touch to this file must keep those exact ids/classes or `admin-editlist.js` breaks.
- **`[[admin_block]]` removed from both templates** [#REQ-ADMINUI-01-08] — it's a floating
  "edit this page" overlay (`templates/admin_block.cfg`) meant for regular site pages, not the
  admin panel itself; the original `layout_admin.cfg` included it too but that was never
  appropriate here. `ShowAdminMenuLink:false` in `admin.cfg`'s header does not actually suppress
  it (dead flag), so simply dropping the tag was the fix, not restyling the overlay.
- **Known gotcha hit during this work** [#REQ-ADMINUI-01-09] — an explanatory HTML comment inside
  `admin-shell.cfg` that mentioned `[[subpage:...]]`/`[[menu:...]]` as literal prose got
  tag-processed for real (tag replacement doesn't know about HTML comments — see "Escaping `[[`"
  under FlexJSON in `CLAUDE.md`), corrupting the rendered page. General rule going forward:
  explain the "why" of admin-panel template changes here in PRD.md, not in comments inside the
  `.cfg`/template files themselves.
- **Not done here / out of scope** [#REQ-ADMINUI-01-10]: no other `admin-*` page beyond
  `admin.cfg`/`admin-edit.cfg` was migrated (e.g. `adminReports`, `admin-bkstg` still render on
  whatever template they already used); no real multi-site "switcher" dropdown was built (the
  topbar only shows the current site's identity/status, no cross-site session switching —
  that would be a separate, larger feature with real access-control behind it).

## Ideas

- Make FlexJson object iterable + easy way to convert to a traditional JSON object
