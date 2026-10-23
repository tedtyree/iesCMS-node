# Per-site hot reload without restarting iesCMS [#REQ-HOTRELOAD]

## Context

Before this change, picking up a code change to one site's `website_engine.js` or any of
its `cmd/**/*.js` API handlers required `pm2 restart iescms` — bouncing the single Node
process that serves *every* site, interrupting every other site's live users for a
one-site deploy.

Most per-site state already self-heals without a restart:

| State | Status |
|---|---|
| `cms.SITE` / `cms.SECRETS` (site.cfg, secrets.jfx) | Already hot — mtime-checked and re-parsed per request (`getSiteConfig`/`getSiteSecrets`, `app.js`) |
| `pages/<id>.cfg`, `templates/layout_*.cfg` | Already hot — read fresh via `readFileSync` every request |
| Static allow-list overrides | Already hot — derived from the already-hot `cms.SITE` |
| `cms.db` | N/A — a fresh `iesDbClass` instance is created and closed per request |
| `websiteEngines[siteId]` (that site's `website_engine.js`) | Was stale until restart — `require()`'d once at startup, never re-required |
| `cmdRegistry[siteId]` (that site's `cmd/**/*.js` handlers) | Was stale until restart — built once at startup, never rebuilt |
| `siteList` / `iesDomains` (which site folders/domains exist) | Was stale until restart — only mattered for a brand-new site folder |

The two real blockers were the cached `website_engine.js` instance and the cached
`cmd/` handler registry for a site. PM2 runs this app as a single fork-mode instance
(`ecosystem-s1.config.js` / `ecosystem-s6.config.js` — no cluster, no multiple workers),
so there's exactly one process holding this state and no cross-worker broadcast to worry
about.

**Trigger model.** This is operated from the Ubuntu host itself — a CI/CD deploy script
or a server admin with shell access — not an authenticated website user. So instead of an
authenticated `/runcmd` admin API (reachable from the public site), `app.js` opens a
**second, tiny HTTP listener bound only to `127.0.0.1`**, on a port that must never be
proxied by Apache/Caddy to the public internet. Loopback binding is the access-control
boundary: whoever can reach that port already has shell access to the box, equivalent
trust to running a local script, so there's no token/auth on top of it.

## Design

### New config field: `AdminControlPort` (`secrets/server.cfg`)

Optional, default absent/`0` = disabled — same "pay only if configured" convention as a
site's optional `secrets.jfx`. When set to a port number, `app.js` opens the control
listener on `127.0.0.1:<AdminControlPort>` (never `0.0.0.0` — unreachable off-box at the
OS/network level regardless of firewall state).

### Control endpoint (`app.js`)

- `GET /reload` → `reloadAll()` — discovers any brand-new site folders under
  `./websites/` and registers them, then hot-reloads every other already-known site's
  engine + cmd handlers. Useful for a generic "just redeployed, don't know/care which
  sites changed" CI step.
- `GET /reload?site=<id>` → `reloadOrLoadSite(id)` — if `<id>` is an already-known site,
  hot-reloads just that one (smallest blast radius); if it's a brand-new folder not yet
  registered, treats it as first-time onboarding.
- Anything else → `404`.
- Responds JSON `{success, ...}` mirroring the called function's return value.

### Core functions (`app.js`)

- **`loadSite(siteId)`** — registers a site for the first time: parses `site.cfg`/
  `site.jfx`, caches it into `siteConfigs`, loads optional `secrets.jfx` into
  `siteSecrets`, registers `Domains[]` into `iesDomains`, `require()`s + instantiates its
  `website_engine.js` (site override or the legacy `./require/website_<id>.js` fallback,
  tracked in `websiteEnginePaths[siteId]`), and builds its `cmdRegistry[siteId]` entry.
  This is the exact body of the original startup loop, factored into a named function so
  it can also be called later for a site added after boot. Only pushes `siteId` into
  `siteList` (and only builds a `cmdRegistry` entry) if `SITEID` in the config actually
  matches the folder name — a bad/mismatched folder is rejected the same way it always
  was at startup, just without crashing anything.
- **`reloadSite(siteId)`** — hot-reloads one *already-known* site: busts
  `require.cache` under that site's own folder (`require/hotReload.js`'s
  `clearRequireCacheUnderDir`) plus the legacy engine path if that's what's in use
  (`clearRequireCacheForFile` — the legacy path lives outside the site's folder, so the
  directory-based clear can't see it), re-`require()`s + reinstantiates the engine, and
  rebuilds just that site's `cmdRegistry` entry via `buildSiteCmdRegistry(siteId,
  commonHandlers)` (never rescans `cmsCommon/cmd/`). On any thrown error (e.g. a syntax
  error in the edited file), the previous `websiteEngines[siteId]`/`cmdRegistry[siteId]`
  are left untouched — same last-known-good philosophy as `getSiteConfig()`.
- **`discoverNewSites()`** — re-lists `./websites`, calls `loadSite()` on any folder not
  already in `siteList`, and returns only the siteIds that actually got registered (a
  folder with a SITEID/folder-name mismatch, like the existing `old-pamoja-or-ke` vs.
  `pamoja-or-ke` case, must not be reported as newly added just because its folder name
  wasn't already known).
- **`reloadAll()`** — `discoverNewSites()` then `reloadSite()` for every other
  already-known site.
- **`reloadOrLoadSite(siteId)`** — the `?site=` endpoint's dispatch: `reloadSite()` if
  known, otherwise `loadSite()` + report whether it actually registered.

### `require/cmdRegistry.js`

Split the original single `buildCmdRegistry(siteList)` into:
- `buildCommonHandlers()` — the common-handler scan (`cmsCommon/cmd/**/*.js`), run once.
- `buildSiteCmdRegistry(siteId, commonHandlers)` — clones the given `commonHandlers`,
  then scans/`require()`s that one site's `cmd/**/*.js` into the clone. Safe to call
  repeatedly for a live reload — never rescans the common handlers or touches another
  site.
- `buildCmdRegistry(siteList)` — unchanged signature/behavior, now composed from the two
  functions above, kept so nothing else depending on it needs to change.

### `require/hotReload.js` (new)

- `clearRequireCacheUnderDir(dirPath)` — deletes every `require.cache` entry whose
  resolved filename is `dirPath` itself or falls under it (case-insensitive compare on
  win32, since `require.cache` keys preserve on-disk casing but the dev filesystem is
  case-insensitive there; case-sensitive on Linux prod, per `CLAUDE.md`'s "Linux / Case
  Sensitivity" section).
- `clearRequireCacheForFile(resolvedFilePath)` — deletes one exact cache entry, for the
  legacy engine path case.

## Known limitations (by design, not fixed here)

- **Module-scope state survives a reload as an orphaned closure.** Reload relies on
  plain JS reference semantics — an in-flight request already holding the old engine
  instance finishes safely on old code, no locking needed. This only breaks if a site's
  `website_engine.js`/`cmd/*.js` registers a `setInterval`/`setTimeout`/file watcher or a
  module-level cache **at require-time** rather than per-instance — that keeps running
  against the old module after a reload, invisible to the newly required code. This is a
  constraint for site authors to be aware of, not something this change detects or
  prevents.
- **`cmsCommon`'s shared engine/handlers and other top-level `require/*.js` utilities are
  out of scope.** Reload only busts cache under the target site's own folder (plus its
  legacy engine path, if used). A fix to shared platform code still needs
  `pm2 restart iescms`.
- **`reloadAll()` is synchronous and blocks the event loop briefly**, proportional to the
  number of sites — the same cost startup already pays, acceptable for an infrequent ops
  action.

## Operational usage

```bash
# After deploying new code to one site (from the box running iescms, as the last deploy step):
curl http://127.0.0.1:<AdminControlPort>/reload?site=<siteId>

# Generic "just redeployed, reload everything + pick up any new site folder":
curl http://127.0.0.1:<AdminControlPort>/reload
```

`AdminControlPort` must be set in `secrets/server.cfg` (and the port must not be exposed
through any reverse proxy) for either endpoint to exist at all.
