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

## Common support functions to handle standard functionality across websites [#REQ-COMMON-01]

- Common support functions are provided to handle standard functionality across websites [#REQ-COMMON-01-01]
    - Reaplcetags() - replaces [[tags]] in content with values from the config (or in some cases a custome process)
    - getParamStr() - gets a parameter from the configs
    - LoadHTMLfile() - loads an HTML file and processes it with Reaplcetags()
- **Tag collision warning** [#REQ-COMMON-01-02]: The tag processor scans ALL content in `.cfg` files (pages, templates, partials) for `[[...]]` sequences. Any literal `[[` in page content — including JavaScript, JSX, or HTML — will be treated as a tag substitution and may corrupt the output. **To include a literal `[[` in page content, insert a space: write `[ [` instead of `[[`.** Common trigger: JavaScript array-of-arrays literals inside JSX `.map()` calls.

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

## Ideas

- Allow tag replacements in JS, CSS, and other documents? Would this slow things down or create awesome flexibility such as specifying a color #00A5B9 that will be used in many locations throughout the app?
- Make FlexJson object iterable + easy way to convert to a traditional JSON object
