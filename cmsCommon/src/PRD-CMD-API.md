# iesCMS – API Layer PRD
**Status:** Draft
**Date:** 2026-03-23
**Related:** PRD.md [#REQ-FOLDER-01-06]

---

## Overview

This document defines the design and requirements for the iesCMS API layer. The goal is **not** to create a generic CMS API — it is to give each individual website its own set of callable endpoints, managed through a consistent, zero-config, self-registering pattern that fits naturally into the existing iesCMS architecture.

---

## Background & Existing Mechanisms

The following API-like mechanisms already exist in the codebase and inform this design:

**API Passthrough** (`api_passthrough_path` / `api_passthrough_url` in site.cfg) — blindly proxies matching URL paths to an external server. Works today but has no auth integration, no per-site handler customization, and no response-type flexibility.

**`runcmd` page** — a private command endpoint (requires user level 3+) that dispatches to a large `switch` statement in `RunCmd()` inside `iesCommon.js`. Works for a small number of internal admin commands but does not scale and cannot be cleanly extended per-site without subclassing and overriding the entire method.

**`qcmd` concept** — a public variant of `runcmd`, carried over from the ASPX era, not yet implemented in Node. This PRD supersedes it.

**`cms.resultType` / `cms.ReturnJson`** — the existing mechanism for returning JSON from any engine. The API layer builds directly on top of this.

---

## Design Goals

- Each website can define its own API endpoints with zero configuration [#REQ-API-00-01]
- Common/shared endpoints are available to all sites and can be overridden per-site [#REQ-API-00-02]
- A single human-readable URL endpoint handles all API dispatch [#REQ-API-00-03]
- Auth enforcement is consistent and automatic — not left to each handler [#REQ-API-00-04]
- Response format is flexible with JSON as the default [#REQ-API-00-05]
- Error handling is documented and standardized at the dispatch layer [#REQ-API-00-06]
- The system feels natural to a developer, not like a framework [#REQ-API-00-07]

---

## URL Endpoints

Two URL endpoints handle all API traffic. Site identity is determined by the requesting domain — consistent with how all iesCMS requests are routed — so no site identifier is needed in the URL path.

### `runcmd` — Private Command Endpoint [#REQ-API-01]

```
POST /runcmd
```

- Requires an authenticated session (user level > 0) [#REQ-API-01-01]
- Can only dispatch to handlers registered with `auth` level > 0 [#REQ-API-01-02]
- Attempting to call a `pubcmd`-only handler (auth: 0) via `runcmd` returns an auth error [#REQ-API-01-03]
- Existing `runcmd` page behavior and all current `RunCmd()` switch cases are preserved during migration [#REQ-API-01-04]

### `pubcmd` — Public Command Endpoint [#REQ-API-02]

```
POST /pubcmd
```

- Requires no authentication [#REQ-API-02-01]
- Can only dispatch to handlers registered with `auth: 0` [#REQ-API-02-02]
- Attempting to call an authenticated handler via `pubcmd` returns an error — no auth escalation is possible [#REQ-API-02-03]
- This hard separation means a misconfigured or missing auth level on a handler can never accidentally expose a private endpoint publicly [#REQ-API-02-04]

### Request Payload

Both endpoints accept the same payload shape:

```json
{
  "cmd": "utility/importBlogs",
  "param1": "value1",
  "param2": "value2"
}
```

- `cmd` is required — identifies the handler to dispatch to [#REQ-API-03-01]
- All other fields are handler-defined parameters — the framework places no requirements on them [#REQ-API-03-02]
- GET requests with query parameters are also supported for `pubcmd` (e.g. for simple data lookups) [#REQ-API-03-03]
- The full `cms` object is passed to every handler — params are read directly from `cms.body` and `cms.url.query` as needed [#REQ-API-03-04]

---

## The `cmd` Value — Naming Convention

The `cmd` value is a developer-defined string that identifies the endpoint. The framework treats it as an opaque key — no parsing, no hierarchy, no enforced format.

**Recommended convention:** `category/actionName` (e.g. `utility/importBlogs`, `admin/rebuildIndex`, `user/getProfile`)

- The `/` separator is a human organizational aid, not a routing mechanism [#REQ-API-04-01]
- Developers may prefix with a site identifier if it helps them (`acme/utility/importBlogs`) — this is a convention choice, not a framework requirement [#REQ-API-04-02]
- Names are case-insensitive at dispatch [#REQ-API-04-03]
- Common and site-level handlers share the same namespace — site handlers override common handlers by registering the same `cmd` name (see Layered Resolution below) [#REQ-API-04-04]

---

## Handler Definition

Each API handler is a small JavaScript module that exports a descriptor object. Handlers are self-contained and self-describing — no external registration step is required.

```js
// Example: websites/acme/cmd/utility/importBlogs.js
module.exports = {
  id: 'utility/importBlogs',       // cmd value to match on
  auth: 'admin',                   // auth level required (see Auth Model)
  handler: async (cms) => {
    // Read params from cms.body or cms.url.query
    const source = cms.body.source || '';
    // Do work...
    cms.ReturnJson = { success: true, imported: 12 };
    // cms.resultType defaults to 'json' — no need to set it unless overriding
  }
};
```

Rules for handler modules [#REQ-API-05]:

- Must export an object with `id`, `auth`, and `handler` [#REQ-API-05-01]
- `handler` receives the `cms` object — the same object available to all iesCMS engines [#REQ-API-05-02]
- Handler may set `cms.ReturnJson` for JSON output, or set `cms.resultType` for other response types [#REQ-API-05-03]
- Multiple handlers may be defined in a single file by exporting an array [#REQ-API-05-04]
- Handler files may be organized into subfolders within the `cmd/` directory — folder structure has no effect on dispatch [#REQ-API-05-05]

---

## Auto-Discovery & Loading [#REQ-API-06]

At server startup, after site engines are loaded (the existing `dlist.forEach` loop in `app.js`), the CMS scans for API handlers using pattern matching — no manifest or config file required.

**Scan order:**

1. `cmsCommon/cmd/**/*.js` — common handlers available to all sites [#REQ-API-06-01]
2. `websites/<siteid>/cmd/**/*.js` — per-site handlers, loaded for each site [#REQ-API-06-02]

**Registry structure:**

A per-site registry map is built during startup:

```
cmdRegistry[siteId] = {
  'utility/importBlogs': { auth: 'admin', handler: fn },
  'admin/rebuildIndex':  { auth: 'admin', handler: fn },
  'user/getProfile':     { auth: 'user',  handler: fn },
}
```

- Common handlers are merged into each site's registry first [#REQ-API-06-03]
- Site handlers are merged second — same `id` overwrites the common entry (site wins) [#REQ-API-06-04]
- If a handler file fails to load at startup, the error is logged and startup continues — one bad handler does not crash the server [#REQ-API-06-05]
- The registry is built once at startup and held in memory — no runtime filesystem access [#REQ-API-06-06]

---

## Layered Resolution — Site Overrides Common [#REQ-API-07]

This directly mirrors how the existing engine layer works (`thisEngine` falls back to `commonEngine`).

- A site handler with the same `id` as a common handler **replaces** the common handler for that site [#REQ-API-07-01]
- The override is silent — no declaration or config needed [#REQ-API-07-02]
- Other sites are unaffected — the common handler remains active for them [#REQ-API-07-03]
- A site may also **extend** a common handler by calling it internally from its own handler if needed [#REQ-API-07-04]

---

## Auth Model [#REQ-API-08]

Each handler declares its required auth level as part of its definition. The dispatch layer enforces auth before the handler is ever called.

**Auth levels:**

| Value | Meaning |
|---|---|
| `0` or `'public'` | No auth required. Only callable via `pubcmd`. |
| `1` or `'user'` | Any logged-in user. |
| `3` or `'admin'` | User level 3 or higher (current `runcmd` standard). |
| *(integer)* | Any numeric user level supported by the existing `userLevel` model. |

Rules [#REQ-API-08]:

- Auth check occurs in the dispatch layer before the handler executes [#REQ-API-08-01]
- `runcmd` will not dispatch to any handler with `auth: 0` — returns error [#REQ-API-08-02]
- `pubcmd` will not dispatch to any handler with `auth` > 0 — returns error [#REQ-API-08-03]
- If `auth` is omitted from a handler definition, it defaults to `'admin'` (fail-safe default) [#REQ-API-08-04]
- Site isolation is enforced upstream by domain-based routing in `app.js` — by the time a handler is called, `cms.siteId` is already resolved and trusted [#REQ-API-08-05]

---

## Response Format [#REQ-API-09]

The default response type for all API calls is JSON. Handlers may override this.

**Default (JSON):**

```json
{ "success": true, "data": { ... } }
```

- Dispatch layer sets `cms.resultType = 'json'` before calling the handler [#REQ-API-09-01]
- Handler sets `cms.ReturnJson` to the response object [#REQ-API-09-02]
- If handler does not set `cms.ReturnJson`, response is an empty JSON object `{}` [#REQ-API-09-03]

**Override (non-JSON):**

A handler may set `cms.resultType` to any value supported by `app.js` (`'file'`, `'redirect'`, `'html'`, etc.) — the dispatch layer will honor it [#REQ-API-09-04].

---

## Error Handling [#REQ-API-10]

Three patterns are supported. Developers choose the appropriate pattern per handler.

**Pattern 1 — Silent (swallow):**
Handler catches errors internally and returns a normal success response or empty result. Use when the caller does not need to know a failure occurred.

```js
handler: async (cms) => {
  try {
    // ...
    cms.ReturnJson = { success: true };
  } catch (e) {
    cms.ReturnJson = { success: true }; // swallow — caller unaware
  }
}
```

**Pattern 2 — JSON Error Response (recommended default):**
Handler returns a structured error object. The dispatch layer also applies this pattern automatically for any unhandled throw — so a handler that does not catch errors will still return a clean JSON response rather than a silent failure or server crash [#REQ-API-10-01].

```json
{ "success": false, "error": "Reason message", "code": "ERR-XYZ" }
```

The `code` field is optional but encouraged for machine-readable error identification [#REQ-API-10-02].

**Pattern 3 — Custom:**
Handler sets `cms.resultType`, HTTP headers, or other response properties directly. Use when the caller expects a specific non-standard error shape, a redirect, or a specific HTTP status code [#REQ-API-10-03].

**Dispatch-layer safety net:**
Any unhandled exception thrown from a handler is caught by the dispatch layer and formatted as a Pattern 2 JSON error. This ensures the server never returns a blank response or an unformatted stack trace [#REQ-API-10-04].

---

## Folder Structure Reference

```
iesCMS-node/
├── cmsCommon/
│   └── cmd/                        ← Common handlers (available to all sites)
│       ├── admin/
│       │   └── rebuildIndex.js
│       └── utility/
│           └── ping.js
└── websites/
    └── acme/
        └── cmd/                    ← Site-specific handlers (acme only)
            ├── utility/
            │   └── importBlogs.js  ← Overrides cmsCommon version if same id
            └── user/
                └── getProfile.js
```

Note: subfolder names within `cmd/` are organizational only. They do not affect the `cmd` dispatch key — that is defined by `id` inside each handler file [#REQ-API-11-01].

---

## Migration Path from Current `RunCmd()`

The existing `RunCmd()` switch/case in `iesCommon.js` continues to work unchanged during transition [#REQ-API-12-01]. New endpoints are added as self-registering handler files. Existing switch cases are migrated to handler files incrementally [#REQ-API-12-02]. Once a case is migrated, it is removed from the switch statement. The switch statement is removed entirely once empty [#REQ-API-12-03].

---

## Out of Scope

The following are explicitly **not** part of this API layer design and should not be assumed or built against it:

- **Generic CMS API** — this is not a public API for the CMS platform itself. It is a mechanism for individual websites to expose their own commands.
- **REST-style routing** — no `GET /resource/:id` style routes. All API traffic flows through the two defined endpoints (`runcmd` / `pubcmd`).
- **OpenAPI / Swagger documentation generation** — handler definitions are not structured for auto-generated API docs.
- **Cross-site API calls** — one website cannot call another website's API endpoints. Site isolation is enforced by domain routing.
- **External developer / third-party access** — no API key management, no OAuth, no developer portal. Auth is limited to the existing iesCMS session/JWT model.
- **Webhooks / push notifications** — outbound callbacks from the CMS to external systems are not part of this design.
- **WebSocket or real-time endpoints** — all communication is standard HTTP request/response.
- **File uploads via API** — file handling is managed through existing CMS mechanisms, not through the command endpoints.
- **Rate limiting** — noted as a future consideration but not implemented in the initial design.
- **API versioning strategy** — the `cmd` naming convention handles this informally; no formal versioning scheme is defined.

---

## Open Questions / Future Considerations

- **Rate limiting** — not in scope for initial implementation but the dispatch layer is the natural place to add it.
- **Versioning** — if an endpoint's contract needs to change, the recommended approach is a new `cmd` name (e.g. `utility/importBlogs_v2`) rather than URL versioning, keeping the single-endpoint model clean.
- **Async handler timeout** — should the dispatch layer enforce a max execution time? Not required initially but worth considering for public-facing `pubcmd` endpoints.
- **Registry inspection** — a built-in `admin/listEndpoints` common handler could dump the full registry for a site — useful for debugging and documentation.
