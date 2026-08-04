# Cache Rules

Mirror of the Cache Rules live in the zone `hospeda.com.ar`. See
[`../README.md`](../README.md) for why these are documented rather than applied
from code, and for the shared-zone constraint every rule must respect.

Dashboard path: **hospeda.com.ar → Caching → Cache Rules**.

Current state: **1 active rule**.

---

## `HOS-369 W1-2 - staging catalog + subscriber`

Makes the accommodation catalog and the subscriber pricing pages eligible for
edge caching **on staging only**, honoring the origin's own `Cache-Control`.

- **Rule id**: `ff033810a5cf4751aa7dfa000e85b66f`
- **Phase**: `http_request_cache_settings`
- **Order**: 1
- **Status**: active
- **Created**: 2026-08-04 (HOS-369 W1-2)

### Expression

```
(http.host eq "staging.hospeda.com.ar"
 and http.request.method in {"GET" "PURGE"}
 and http.request.uri.query eq ""
 and not http.cookie contains "better-auth.session_token"
 and (starts_with(http.request.uri.path, "/es/alojamientos")
   or starts_with(http.request.uri.path, "/en/alojamientos")
   or starts_with(http.request.uri.path, "/pt/alojamientos")
   or starts_with(http.request.uri.path, "/es/suscriptores/planes")
   or starts_with(http.request.uri.path, "/en/suscriptores/planes")
   or starts_with(http.request.uri.path, "/pt/suscriptores/planes")
   or starts_with(http.request.uri.path, "/es/suscriptores/turistas")
   or starts_with(http.request.uri.path, "/en/suscriptores/turistas")
   or starts_with(http.request.uri.path, "/pt/suscriptores/turistas")))
```

The live rule stores this on a single line (745 characters). The nine
`starts_with` terms are written out rather than expressed as a regex because
the `matches` operator requires a Business plan.

### Settings

| Setting | Value | API equivalent |
|---|---|---|
| Cache eligibility | Eligible for cache | `"cache": true` |
| Edge TTL | Use cache-control header if present, **bypass cache if not** | `edge_ttl.mode = "bypass_by_default"` |
| Browser TTL | Respect origin TTL | `browser_ttl.mode = "respect_origin"` |
| Cache key → Sort query string | on | `cache_key.ignore_query_strings_order = true` |

Everything else (Vary, serve stale, strong ETags, origin error page passthru,
status-code TTLs, cache deception armor, cache by device type) is left unset.

```json
"action": "set_cache_settings",
"action_parameters": {
  "cache": true,
  "edge_ttl":    { "mode": "bypass_by_default" },
  "browser_ttl": { "mode": "respect_origin" },
  "cache_key":   { "ignore_query_strings_order": true }
}
```

### Why each clause

**`http.host eq "staging.hospeda.com.ar"`** — staging only, on purpose.
Production is behind on the branch that emits `Cache-Tag`; caching HTML there
would produce objects nothing can purge selectively, which is strictly worse
than not caching at all. Lift this only after staging is promoted.

**`http.request.method in {"GET" "PURGE"}`** — a `GET`-only expression does not
match during a purge, so single-file purges report success and evict nothing.
Silent failure (HOS-369 §5.11.3).

**`http.request.uri.query eq ""`** — fail-closed on filters. A whitelist of
known filter params would silently admit the next param somebody adds; requiring
an empty query string means a new facet is excluded by default and has to be
let in deliberately. Nothing is lost: pagination uses path segments
(`/page/2/`), and the faceted query URLs are already `Disallow`ed in
`robots.txt`.

**`not http.cookie contains "better-auth.session_token"`** — no logged-in
request may read from or populate a shared cache object. One `contains` covers
both cookie names, because `__Secure-better-auth.session_token` contains
`better-auth.session_token` as a substring (verified, both forms bypass).

Since W1-2a the shell no longer bakes the visitor's identity into these pages,
so this is belt-and-braces rather than the only thing standing between
visitors. Remove it **per path, after that path is verified by measurement**
— never on the strength of that note alone (HOS-369 §6.4).

**Edge TTL `bypass_by_default`, not `respect_origin`** — this is what keeps the
rule honest. `respect_origin` would fall back to Cloudflare's own default TTL
for any matched response whose origin sent no `Cache-Control` — caching it with
no cache tag, so nothing could purge it. `bypass_by_default` refuses to cache
anything the origin has not explicitly opted in. The origin's opt-in is
`applyCacheHeaders()`, which sets `Cache-Control` and registers the purge tags
in the same call precisely so the two cannot drift apart
(`apps/web/src/lib/cache/response-cache.ts`).

**Browser TTL `respect_origin`** — **required, not cosmetic.** The zone's
Browser Cache TTL is 4 hours, and Cloudflare injects `max-age=14400` into every
response a Cache Rule makes cacheable. A Cloudflare purge never reaches browser
caches, so without this setting a returning visitor would hold stale HTML for up
to four hours with no way to evict it — the exact failure mode selective purge
exists to remove, newly reachable because the rule is what first made these
responses cacheable at all. Fixed per-rule; the zone-level setting is left
alone because changing it would affect production too.

**Sort query string** — mandated by HOS-369 §7.2 as the only cache-key
normalization available on the free plan (`Ignore query string` and
`No query parameters except` are Enterprise). It is currently **inert**: the
expression only matches requests with an empty query string, so there is never
an order to normalize. Kept so it is already correct if the expression is later
widened to admit parameters.

### What this rule actually caches

Matching a path is necessary but not sufficient — the origin must also declare
the response cacheable. Measured on 2026-08-04:

| Path | Cached? |
|---|---|
| `/{lang}/alojamientos/` and `/page/N/` | yes |
| `/{lang}/alojamientos/mapa/` | yes |
| `/{lang}/alojamientos/tipo/<type>/` | yes |
| `/{lang}/suscriptores/{planes,turistas}/` and `/comparar/` | yes |
| `/{lang}/alojamientos/<slug>/` (detail) | **no** — origin sends no `Cache-Control` |
| `/{lang}/alojamientos/<slug>/fotos/` | **no** |
| `/{lang}/alojamientos/comparar/` | **no** |
| `/{lang}/alojamientos/comodidades/<slug>/` | **no** |
| `/{lang}/alojamientos/caracteristicas/<slug>/` | **no** |
| `/{lang}/suscriptores/propietarios/` | **no** |

Everything in the second half returns `cf-cache-status: BYPASS` — the rule
matched, the origin did not opt in, `bypass_by_default` did its job. Note the
asymmetry among the facet landings: `tipo/` opts in, `comodidades/` and
`caracteristicas/` do not.

`/page/N/` is cached even though `page/[page].astro` contains no cache call at
all: it is an `Astro.rewrite` into `alojamientos/index.astro`, and the header is
set by the destination.

**Adding a family is an application change, not a Cloudflare change.** The rule
already matches these paths; the moment a page calls `applyCacheHeaders()` it
starts being cached, with no rule edit.

### Verifying

The cache is per-PoP, so run every probe from the same place and pin the PoP via
the `cf-ray` suffix.

```bash
# eligibility + hit
curl -sS -o /dev/null -D - https://staging.hospeda.com.ar/es/alojamientos/ \
  | grep -iE '^(cf-cache-status|age|cf-ray|cache-control):'
```

Expected on the second request: `cf-cache-status: HIT`, non-zero `age`, and a
`Cache-Control` **without** `max-age=14400` (its presence means the Browser TTL
setting was lost).

```bash
# bypasses — all three must report DYNAMIC, never HIT
curl -sSI https://staging.hospeda.com.ar/es/alojamientos/ -H 'Cookie: better-auth.session_token=x'
curl -sSI https://staging.hospeda.com.ar/es/alojamientos/ -H 'Cookie: __Secure-better-auth.session_token=x'
curl -sSI 'https://staging.hospeda.com.ar/es/alojamientos/?types=HOTEL'
```

To prove a **purge** rather than an expiry, read the status, not the `age`:
Cloudflare returns `EXPIRED` when an object ages out naturally and `MISS` when
it was explicitly evicted. An `age` reset alone proves nothing. Bound the
confirmed-HIT → purge → probe sequence well inside the object's TTL and print
the elapsed seconds, or a slow run will read a natural expiry as a successful
purge.

Measured 2026-08-04: propagation ≤ ~4 s; purging `preview:list-accom` evicted
`/es/alojamientos/` and `/es/alojamientos/page/2/` while the `/_astro/*` chunks
kept climbing their `age` untouched (purge by tag is not affected by custom
cache keys and does not reach static assets).
