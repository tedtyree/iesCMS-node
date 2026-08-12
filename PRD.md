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

## Folder/Extensions per Website [#REQ-FOLDER-01]

- Each website is contained within its own folder [#REQ-FOLDER-01-01]  
- Folder name is also used as a VID (visual ID) for the website [#REQ-FOLDER-01-02]
- Optional .js extensions can be added per website; require/website_<id>.js [#REQ-FOLDER-01-03]
- If no require provided for a website, a default common engine will be used [#REQ-FOLDER-01-04]
- The website engine can replace the entire common engine OR can extend/override specific parts of it [#REQ-FOLDER-01-05] esp for things like tag definitions/functionality and api endpoints.
- API endpoints are not typical NodeJS routes. Instead there is a single command endpoint that handles all API requests. [#REQ-FOLDER-01-06] - currently "cmd" but could be changed in the future to "api" or other standard.
- Optional CustomForms() can be added per website in the custom engine to process forms that are unique to the website [#REQ-FOLDER-01-07]
- Not yet implemented? handleEvents() can be added per website in the custom engine to extend functionality for events per website [#REQ-FOLDER-01-08]
- The admin-extras.cfg in pages folder is an extension of the admin page and can be used to add custom menu options/functionality to the admin page [#REQ-FOLDER-01-09]

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

## Ideas

- Make FlexJson object iterable + easy way to convert to a traditional JSON object
