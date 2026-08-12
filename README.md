# iesCMS-node

Outrageously simple content management system (CMS) for NodeJS
UNDER DEVELOPMENT

- Made for web developers and website managers managing many sites for multiple customers. Fully configurable.
- Does not require compiling.
- Each website content is contained within their folder.

   Optional .js extensions can be added per website.
   require/website_<id>.js

- Each website is given an "id" used as the folder name,

   the name of the option website js extensions, and a tag
   used in the database to mark records belonging to that site.

- Pages:
  - Each *.cfg in the websites/<id>/pages folder corresponds to a web page on the website. 
  - It includes a header with page parameters 
  - Includes [[tags]] that get replaced at runtime.
- Template files:
  - Each page specifies a template file (usually the header and footer of the page) 
  - found in the templates/ folder - format layout_<template_name>.cfg 
  - also contains [[tags]] that get replaced at runtime.

NOTE: Uses Flex Json: https://www.npmjs.com/package/flex-json

# RUN  (currently on serverPort 8118)

node app.js
or
Open app.js in VS Code and select Run > Start Debugging
browse to > localhost:8118

Use localhost:8118/home?mimic=<siteid> to mimic a specific website for testing

**NOTE — always use `localhost:8118` (or a real registered domain), never a bare IP like `127.0.0.1:8118`:**
iesCMS resolves which site to serve strictly by matching the request's `Host` header against every
site's `Domains` list (`app.js`, `iesDomains[cms.urlHost.toLowerCase()]`). A host that matches nothing
is treated as unknown/scanning traffic — the TCP connection is destroyed immediately with **zero HTTP
response** (`res.connection.destroy()`), not a 404. This is deliberate, pre-existing anti-scanning
behavior, not a bug. `curl`/browsers hitting `127.0.0.1` instead of `localhost` (or any other
unregistered host/IP) will see this as a hang or "Empty reply from server" — it can look exactly like
the server being dead when it's actually healthy and serving other requests fine. This has caused
real, extended debugging chases before (mistaking it for a hung/broken server) — if you ever need to
test against a different hostname or IP, add it to the relevant site's `Domains` list first (usually
`hostsite`'s `site.cfg`/`site.jfx`) — see `websites_example/hostsite/site.cfg`, which already lists
`"localhost:8118"` for exactly this reason.

# DEBUGGING ON LOCAL PC

Open app.js in the editor (select the app.js tab if not selected)
Select Run > Start Debugging
Select "Node.js"
Navigate to http://localhost:8118 — **not** `http://127.0.0.1:8118` (see NOTE above)
To test a specific website, for example "chatbot" (That is the site id) navigate to http://loclhost:8118?mimic=chatbot

# INSTALL

copy entire iesCMS-node folder to server > /var/www/iescms
NOTE: Do not overwite websites folder (since each site should be managed it its own repo)
NOTE: May need to update /secrets/server.cfg if there were structure changes to that file
Copy websites/hostsite/require/website_hostsite.js to require/website_hostsite.js
Key folders/files
  app.js
  /iesCommon
  /node_modules  (or run 'npm i' as mentioned below)
  /require  (exclude website_*.js ... but include website_hostsite.js)
Run 'npm i' in /var/www/iescms to get node_modules
open a folder in the root installation and run npm install string-builder 
Start the app using PM2 (preinstalled pm2 on the server)

# Install each website

Websites should each be their own git repository. 

- Copy/clone website files/folders to websites/<id> 
- copy websites/<id>/require/website_<id>.js to require/website_<id>.js
- site.cfg contains core site parameters - update as needed
  - **TEMPORARY, during migration:** the file may instead be named `site.jfx`. Every place that loads it resolves through `require/resolveSiteConfig.js`, which checks `site.jfx` first, then falls back to `site.cfg`. If both exist for a site, `site.jfx` wins and `site.cfg` is ignored. This dual-lookup will be removed once all sites are migrated to `site.jfx`.
  - The parsed config is cached at server startup and kept fresh via a cheap per-request file-modified-time check (not a full re-parse every request) — editing a live site's `site.cfg`/`site.jfx` (e.g. the `OverrideMinViewLevel` "lock this site" trick) still takes effect on the very next request, no restart needed.
- For development purposes they can be included in the websites/ folder but are ignored by the parent git repository.
- Restart the iesCMS app so that it sees the website config (and optional .js)

Rather than cloning the iesCMS to one location on the server (a github sync) and then copying it to a production location - on s3 we are triyng out just cloning directly to the production location and running it from there. See deploy_s3.sh

Rather than cloning each website to a git sync location and then copying it to the production location, on s3 I cloned each website directly into the websites/ folder and renamed it to the proper <id>. Then the deploy_s3_site.sh script will pull the latest changes - copy website_<id>.js as needed, and restart the iesCMS server.

So everything is being cloned to the specific location on s3.

# Database per Website

Sites that need a PostgreSQL database declare `databasename` in `site.cfg`. That single entry drives everything:

- **Startup (`iesDbInit.js`):** automatically creates the database if missing, then creates any missing tables using `.sql` files from `cmsCommon/db/` (common) and optionally `websites/<id>/db/` (site-specific).
- **Request time (`website_engine.js`):** creates `cms.db` (an `iesDbClass` instance) using the name from `site.cfg` and shared credentials from `secrets/server.cfg → DbConnect`.

Sites without `databasename` in `site.cfg` are silently skipped by both systems — no DB required.

**Optional site-specific tables:** create `websites/<id>/db/site-db.jfx` with a `tables` array. Each table needs a matching `table-<name>.sql` schema file.

**Credentials** (`host`, `port`, `user`, `password`) live in `secrets/server.cfg → DbConnect` — shared across all sites, never in `site.cfg`.

# Per-Site Secrets (`cms.SECRETS`)

Some websites need credentials (API keys, tokens, etc.) that must not end up in `site.cfg`/`site.jfx`, since that file is normally committed to that website's own git repo.

- Create `websites/<id>/secrets/secrets.jfx` — a FlexJSON file, structured however that site needs (e.g. `{ anthropic: { apiKey: "..." } }`). Optional — sites with no secrets just omit it.
- It's loaded **once, at server startup**, then kept fresh with a cheap per-request file-modified-time check — not a full re-read/re-parse every request. (`site.cfg`/`site.jfx` itself now uses the identical cache+mtime-check pattern — see below.) **Rotating a token in an already-existing `secrets.jfx` takes effect on the next request, no restart needed** — only sites that use this feature pay the (very cheap) check, and it never touches other sites' cached secrets. Adding a `secrets.jfx` to a site that didn't have one at boot still needs a restart, same as adding a brand-new site folder.
- Any code (a `cmd/` handler, a custom engine, etc.) reads it via `cms.SECRETS.getStr('someKey', '')` / `getNum(...)` / `getBool(...)` — same accessor pattern as `cms.SITE`/`cms.SERVER`. `cms.SECRETS` is always a valid FlexJson object, even for a site with no secrets file (empty in that case).
- **`cms.SECRETS` is never part of the `[[tag]]` replacement chain** (HEADER → SITE → SERVER) — a `[[someTag]]` in a page or template will never resolve from it. Secrets can only be read by code that explicitly asks for them, so they can't leak into rendered HTML by accident.
- **Required if you use this feature:** add to that website's own `.gitignore`:
  ```
  /secrets/*
  !/secrets/.gitkeep
  ```
  and commit an empty `secrets/.gitkeep` plus a `secrets-example.jfx` template at the site root (documented, placeholder values) so other developers know what to fill in.

Start from `secrets_SAMPLE/website-secrets-SAMPLE.jfx` for a generic template, or see `websites/chatbot/secrets-example.jfx` for a real example (Anthropic/OpenAI API keys).

# /orig Folder — Protected Original Site Reference

Each website can optionally include an `orig/` subfolder containing a complete original HTML website (typically with `index.html` as the home page). This is useful during active development — the developer can view the original HTML design alongside the in-progress CMS version.

Access to `/orig/**` is gated by the `origMinViewLevel` parameter in `site.cfg`:

| Value | Behavior |
|---|---|
| (absent) | Defaults to `1` — requires any logged-in user |
| `0` | Publicly accessible — no login required |
| `1`–`9` | Requires a user with that minimum access level |

If a user without sufficient access tries to reach any `/orig/...` URL, the CMS redirects them to the site's login page (with the original URL as a `deeplink` query parameter).

Example `site.cfg` entry:

```
,origMinViewLevel:1  // protect the /orig folder — requires login
```

This feature is implemented entirely in `app.js` and requires no per-site engine customization.

# CONVERT WEBSITE TO iesCMS-Node

1) rename site.cfg to all lowercase letters (linux/node is case sensitive)
2) fix any json errors in site.cfg (example: fixed a missing quote)
3) Change "baseFolder" in site.cfg to...
   ,baseFolder:"[[SERVER_FOLDER]]/websites/[[SiteID]]"
4) changed url of logo in top left corner to "/" (it was index.html)
5) update other page links to remove ".html" or ".ashx" suffix
6) migrate any custom tags (if needed, you will need to create a custom class for the website)
7) test website locally for all functionality

# Build backdoor login for top-level admin

cd /util
node makeTruffle.js
Enter userid/pwd of BD Admin
>> this reads /secrets/server.cfg (parameters: truffleId, ServerId)
>> this generates /secrets/trufflebd.cfg

# Run app on server using pm2

login to server using ssh
sudo su - s57app
cd /var/www/iescms
pm2 start app.js  (see notes in server setup doc)
pm2 list

# restart app

pm2 restart app

# Apache2 setup

Typical example config if port defined as 8118...
<VirtualHost *:80>
    ProxyPass /.well-known !
    ServerName <domain>
    ErrorLog /var/log/apache2/<domain>.error.log
    CustomLog /var/log/apache2/<domain>.requests.log combined
    ProxyRequests On
    ProxyPass / http://localhost:8118/
    ProxyPassReverse / http://localhost:8118/
</VirtualHost>
