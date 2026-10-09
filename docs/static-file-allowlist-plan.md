# Block static-file exposure of hidden/sensitive paths (allow-list)

## Context

iesCMS serves any file that resolves on disk under a site folder (or `cmsCommon/`)
whenever the request's extension isn't `.cfg`, `.htm`, `.html`, or empty — this is the
"NON-HTML/JSON RESOURCES" branch in `cmsCommon/require/website_engine.js:426-446`, reached
via `app.js`'s raw file-streaming at `app.js:603-663`. There is currently **no folder or
hidden-file restriction at all** — only a single global rule blocks the `.cfg` extension
(`app.js:438-447`). As a result, `/.git/...`, `/.github/...`, a site's `secrets/secrets.jfx`,
every `require/*.js` / `cmd/**/*.js` source file, `db/*.sql` schemas, `config/*.jfx`, and
internal docs (`CLAUDE.md`, `PRD.md`, `docs/*.md`) are all reachable over plain HTTP today
(confirmed in `websites/chatbot/ACTION.md`'s original bug report and verified against the
live code path).

Decision (discussed with user): fix this with a **default-deny allow-list**, not an
expanded deny-list. The existing `.cfg`-only block already proved the deny-list failure
mode — it missed every other sensitive category above. An allow-list fails closed: a
newly-added sensitive file/folder is unreachable by default until explicitly opted in,
instead of silently exposed until someone remembers to blocklist it.

A real audit of every site's actual `src=`/`href=`/`url()` references (not guesswork) showed
most sites only need a small shared set of folder names; a few need one or two extras. The
user has also explicitly directed that `require`, `cmd`, `spam`, `content`, and `blogs` be
on the **shared default** list (not per-site), despite `require`/`cmd` containing server-side
source — confirmed those folders contain no hardcoded credentials (secrets live only in
`secrets/secrets.jfx` / `secrets/server.cfg`, read into `cms.SECRETS`/`cms.SERVER` at
runtime, per `CLAUDE.md`), so this exposes implementation detail, not credentials.

## Design

**Enforcement point:** `app.js`, immediately after `cms.SITE`/`cms.SECRETS` are loaded
(~`app.js:525`) and before the `/orig` gatekeeper (~`app.js:530`). This is a single
choke point that covers every site — including the ones with their own copy-pasted
`CreateHtml()` override (`websites/pamoja-or-ke`, `websites/old-pamoja-or-ke`) — because it
runs in `app.js` before any engine (common or custom) gets a chance to resolve a file,
exactly like the existing `.cfg` block it sits next to.

**Scope of the check** — only applies when the request would otherwise fall into the
generic static-file branch, i.e. `cms.pathExt` is not `''`/`htm`/`html` (those go through
the page-lookup path, already safe) and not `cfg` (already blocked). Exempt
`cms.urlBasePath.toLowerCase() === 'orig'` entirely — `/orig/*` has its own dedicated
gatekeeper + `path.resolve` containment check already (`app.js:530-568`) and must not be
double-filtered.

**Rule 1 — hidden segments (always on, no config):** reject if `cms.urlBasePath`, any
entry in `cms.urlPathList`, or `cms.urlFileName` starts with `.` — **except** the single
literal segment `.well-known`, which is exempted from this rule only (not auto-allowed —
it still has to pass Rule 2 below like any other folder). Kills `/.git/*`, `/.github/*`,
`/.claude/*`, `/.gitignore`, `/.env`, etc. uniformly, everywhere, with zero per-site config.

Deliberately **not** relying on the reverse proxy to keep `/.well-known/*` out of Node:
deployments vary (Apache vs. Caddy), `README.md:179`'s `ProxyPass /.well-known !` is a
documented template, not something verified live on every site's vhost, and Caddy only
auto-intercepts `/.well-known/acme-challenge/*` for its own automatic-HTTPS HTTP-01
flow — not other `.well-known` uses (security.txt, app-link verification files, etc.), and
not at all if a site's Caddy config uses DNS-01 or an external cert. So instead of assuming
the proxy handles it, `.well-known` is just carved out of the dot-segment block and treated
like any other path: unreachable by default (it's not on the default folder list and no
current site references it anywhere), but a site can opt in via
`StaticAllowFolders: [".well-known"]` if it ever needs to serve something there directly
from Node, regardless of which proxy sits in front of it.

**Rule 2 — folder/file allow-list:** compute the top-level folder the same way the engine
does (strip a leading `cmscommon` segment first if present), then:
- If there's no folder (a root-level file like `/favicon.ico`) — check `cms.urlFileName`
  (lowercased) against a default root-file list: `favicon.ico`, `robots.txt`, `sitemap.txt`,
  `manifest.json`, `sw.js`, `apple-touch-icon.png`, `humans.txt`, unioned with a site's own
  `StaticAllowFiles` extras.
- Otherwise — check the top folder (lowercased) against one shared default folder list,
  unioned with a site's own `StaticAllowFolders` extras:

  **Default folder list (applies to every site and to `cmscommon/`):**
  `images`, `img`, `css`, `js`, `styles`, `src`, `assets`, `fonts`, `modules`, `require`,
  `cmd`, `spam`, `content`, `blogs`

  (`styles` added alongside `css` per user request, covering both common naming
  conventions a site might use.)

- Read site extras from `cms.SITE.i('StaticAllowFolders')` / `.i('StaticAllowFiles')`
  using the existing FlexJson array-iteration pattern (`forEach`/`for...of`, each item's
  string via `.toStr('')`) — same pattern already used for `GetAllRecords()` rows. A site
  with no such key gets a `jsonType:"null"` stub that safely no-ops (confirmed in
  `require/FlexJson/FlexJsonClass.js`).

**Site-level deny override — `StaticDenyFolders` / `StaticDenyFiles`:** a site can
*narrow* its own exposure below the shared default via these two keys (same site.cfg/site.jfx
style). Precedence is deny-wins:
`effective = (default list ∪ site's StaticAllowFolders) − site's StaticDenyFolders`.
This only ever lets a site lock itself down tighter than the platform baseline (e.g. a site
with unusually sensitive `cmd/`/`require/` content can deny those for itself) — it can never
be used to widen access past what `StaticAllowFolders` already permits. **Only applies to a
site's own namespace, not to `/cmscommon/*` requests** — those serve the same shared files to
every site regardless of which domain asked, so a per-site deny there would be confusing
(site A's deny wouldn't stop site B from fetching the same cmsCommon file) and isn't supported;
`cmscommon/` stays governed solely by the one shared default list.

Anything not matched by either rule → `cms.resultType = 'notfound'; cms.abort = true;`,
following the exact style of the existing `.cfg` block, with new sequential error codes
(`ERR994` hidden-segment, `ERR995` not-allow-listed) and the same `debugMode`-gated
`appendFileSync(debugHttpFile, ...)` logging.

## Per-site config additions

Only sites needing something beyond the shared default list get a `StaticAllowFolders` /
`StaticAllowFiles` key added to their `site.cfg`/`site.jfx` (via `resolveSiteConfigPath()`
semantics — edit whichever file the site actually has):

| Site | Add |
|---|---|
| `un0` | `StaticAllowFolders: ["mod"]` |
| `delta_align` | `StaticAllowFolders: ["icons"]` |
| `heniv` | `StaticAllowFolders: ["uploads"]` |
| `lisa-block-sweep-web` | `StaticAllowFolders: ["_expo"]`, `StaticAllowFiles: ["icon.png"]` |
| `pamoja-or-ke`, `old-pamoja-or-ke`, `chatbot` | none — covered by shared defaults (`blogs`, `content`, `images`, `assets`, `src`) |

Everything else currently on disk and **not** on the shared list or a site's extras —
`secrets/`, `config/`, `db/`, `docs/`, `design/`, `chatbot-data/`, `deploy/`,
`google_script/`, `mar/`, `logs/`, `widgets/`, `public-ORIG/`, `images_ORIG/`, every
dotfile/dot-folder — becomes unreachable over HTTP after this change.

## Files changed

- `app.js` — added the two-rule check right after the `cms.SITE`/`cms.SECRETS` load
  (constants `STATIC_ALLOW_FOLDERS`/`STATIC_ALLOW_ROOT_FILES` and helper
  `flexArrayToSet()` defined near the top of the file, alongside `iesDomains`).
- `websites/un0/site.jfx`, `websites/delta_align/site.jfx`, `websites/heniv/site.cfg`,
  `websites/lisa-block-sweep-web/site.cfg` — added the per-site extras above.
- `CLAUDE.md` — new "Static File Allow-List" section documenting the default lists, the
  `StaticAllowFolders`/`StaticAllowFiles`/`StaticDenyFolders`/`StaticDenyFiles` site.cfg
  keys and their precedence, the hidden-segment rule, the `.well-known` carve-out, and the
  `/orig` exemption.
- `README.md` — pointer added near the Apache `ProxyPass` config noting static files are
  served only from an explicit allow-list, not relying on the reverse proxy.
- `docs/static-file-allowlist-plan.md` (this file) — design record.

## Verification (completed)

Ran the server locally and curled every site via its real `Host` header (not `?mimic=`,
since `mimic` only works when the request already resolves to `hostsite`):

- **Allowed and confirmed reachable:** `un0` `/images/favicon.png`, `/mod/jquery/jquery.min.js`,
  `/content/files/*.pdf`; `delta_align` `/manifest.json`, `/sw.js`, `/icons/icon.svg`,
  `/require/cleanup.js`, `/require/run-rules.js`; `heniv` `/css/post-3692.css`,
  `/uploads/*.jpg`; `lisa-block-sweep-web` `/icon.png`, `/favicon.ico`, `/_expo/static/js/web/*.js`;
  `pamoja-or-ke` `/blogs/.../img/banner/*.webp`, `/img/hero.jpg`; `chatbot`
  `/cmd/chat/sendMessage_pub.js`, `/src/helloaudi.css`; `/cmscommon/require/website_engine.js`,
  `/cmscommon/images/e.gif`.
- **Blocked and confirmed 404:** `/spam/spam.cfg` (universal `.cfg` block), `/.git/config`,
  `/.github/workflows/ci.yml`, `/.env`, `/images_ORIG/x.jpg`, `delta_align` `/deploy/x.sh`,
  `/db/table-users.sql`; `heniv` `/logs/x.txt`; `pamoja-or-ke` `/widgets/recent-posts.jfx`;
  `chatbot` `/chatbot-data/x.jfx`, `/secrets/secrets.jfx`; `/cmscommon/db/table-users.sql`;
  `/.well-known/test.txt` (no site opted in).
- No uncaught exceptions or crashes across ~25 requests; checked the server's own log for
  stack traces.

## Follow-up fix: missing-page requests now return a real 404 [#REQ-STATIC-ALLOW-02]

While verifying the above, found that a request for a genuinely nonexistent *page* (no
file extension — e.g. `/this-page-does-not-exist`) returned HTTP 200 with a "SERVER ERROR
[ERR-0001]: ERROR: Page not found. [ERR1111]" body instead of a 404 status — a pre-existing
issue, unrelated to the allow-list change itself (reproduced identically before and after,
and leaked no file content), but worth fixing since it was found along the way.

**Root cause:** `website_engine.js`'s page-lookup branch called
`reject('ERROR: Page not found. [ERR1111]')` when the page's `.cfg` file wasn't found. That
rejection was caught by a *generic* catch-all in `app.js` shared with genuine crashes
(`catch (e) { cms.Html = "SERVER ERROR..."; cms.resultType = 'html'; }`), and the `'html'`
response branch always does `res.writeHead(200, ...)` with no status differentiation.

**Fix:** at that one spot, set `cms.resultType = 'notfound'; resolve('');` instead of
rejecting — routing straight into the existing, already-correct
`if (cms.resultType == 'notfound')` branch (`app.js`: plain text, real `404`), the same
branch the allow-list fix above already uses. The generic `SERVER ERROR` catch-all for
actual exceptions/crashes was deliberately left untouched — conflating "missing page" with
"server crashed" risks misclassifying real 500-level errors as 404s, a separate and riskier
problem than the one being fixed here. `INVALID_PAGE` (a site.cfg key suggesting a styled
404 page) was checked and confirmed to be dead config — only present in sample/template
files, never wired up in the Node engine — so this fix doesn't disturb any existing
"nice 404 page" behavior (there wasn't one).

This exact code block is duplicated in 3 places (same pattern as the allow-list fix needing
to check for custom engine forks):
- `cmsCommon/require/website_engine.js`
- `websites/pamoja-or-ke/require/website_engine.js` (custom engine fork)
- `websites/old-pamoja-or-ke/require/website_engine.js` (same fork)

All three were fixed identically. Every other site has no engine override and inherits the
`cmsCommon` fix automatically.

**Verified:** `/this-page-definitely-does-not-exist-xyz` now returns `404` (body: "Not
found") on `chatbot`, `un0` (both via the `cmsCommon` engine) and `pamoja-or-ke` (custom
engine fork). Real pages (`/home` on all three, `/login` on `delta_align`) still return
`200`. No uncaught exceptions in the server log.
