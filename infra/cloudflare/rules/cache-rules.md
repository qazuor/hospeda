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
 and (http.request.uri.path in {"/es/" "/en/" "/pt/"
        "/es/nosotros/" "/es/beneficios/" "/es/funcionalidades/" "/es/contacto/"
        "/es/preguntas-frecuentes/" "/es/legal/cookies/" "/es/legal/privacidad/"
        "/es/legal/terminos/" "/es/colaborar/" "/es/colaborar/editores/"
        "/es/colaborar/fotos/" "/es/colaborar/reportar/"
        "/en/nosotros/" "/en/beneficios/" "/en/funcionalidades/" "/en/contacto/"
        "/en/preguntas-frecuentes/" "/en/legal/cookies/" "/en/legal/privacidad/"
        "/en/legal/terminos/" "/en/colaborar/" "/en/colaborar/editores/"
        "/en/colaborar/fotos/" "/en/colaborar/reportar/"
        "/pt/nosotros/" "/pt/beneficios/" "/pt/funcionalidades/" "/pt/contacto/"
        "/pt/preguntas-frecuentes/" "/pt/legal/cookies/" "/pt/legal/privacidad/"
        "/pt/legal/terminos/" "/pt/colaborar/" "/pt/colaborar/editores/"
        "/pt/colaborar/fotos/" "/pt/colaborar/reportar/"}
   or starts_with(http.request.uri.path, "/es/alojamientos")
   or starts_with(http.request.uri.path, "/en/alojamientos")
   or starts_with(http.request.uri.path, "/pt/alojamientos")
   or starts_with(http.request.uri.path, "/es/suscriptores/planes")
   or starts_with(http.request.uri.path, "/en/suscriptores/planes")
   or starts_with(http.request.uri.path, "/pt/suscriptores/planes")
   or starts_with(http.request.uri.path, "/es/suscriptores/turistas")
   or starts_with(http.request.uri.path, "/en/suscriptores/turistas")
   or starts_with(http.request.uri.path, "/pt/suscriptores/turistas")
   or starts_with(http.request.uri.path, "/es/destinos")
   or starts_with(http.request.uri.path, "/en/destinos")
   or starts_with(http.request.uri.path, "/pt/destinos")
   or starts_with(http.request.uri.path, "/es/eventos")
   or starts_with(http.request.uri.path, "/en/eventos")
   or starts_with(http.request.uri.path, "/pt/eventos")
   or starts_with(http.request.uri.path, "/es/publicaciones")
   or starts_with(http.request.uri.path, "/en/publicaciones")
   or starts_with(http.request.uri.path, "/pt/publicaciones")
   or starts_with(http.request.uri.path, "/es/gastronomia")
   or starts_with(http.request.uri.path, "/en/gastronomia")
   or starts_with(http.request.uri.path, "/pt/gastronomia")
   or starts_with(http.request.uri.path, "/es/experiencias")
   or starts_with(http.request.uri.path, "/en/experiencias")
   or starts_with(http.request.uri.path, "/pt/experiencias")))
```

The live rule stores this on a single line (2419 characters since W2-4; it was
2074 after W2-3, 1576 after W2-2, and 796 before that). The twenty-four
`starts_with` terms are written out rather than expressed as a regex because the
`matches` operator requires a Business plan.

The home is matched with `in { … }` — an **exact** path set, not a prefix.
`starts_with(path, "/es/")` would match every Spanish page in the app, including
`/es/mi-cuenta/`. Nothing would actually cache there (those pages never opt in,
and `bypass_by_default` refuses anything that has not), but a rule whose
expression claims more than it means is one refactor away from being true.

The twelve copy-only pages W2-2 added (36 entries: 12 paths × 3 locales) join
that same exact set for the same reason, and deliberately **not** as
`starts_with(path, "/es/legal")` / `"/es/colaborar"`. Those two prefixes would
be shorter, but they would also pre-approve a `legal/` or `colaborar/` page that
does not exist yet — one that might read a session. Listing the paths means a
new sibling is excluded until somebody adds it here on purpose, which is the
same fail-closed posture `http.request.uri.query eq ""` takes on filters.

`/{lang}/colaborar/reportar/` is documented as taking `?destino=<slug>`. The
pre-filled form is therefore never cached — the empty-query clause excludes it —
while the bare entry point is. That asymmetry is intended, not an oversight.

W2-3 added the three catalog families as **prefixes**, not as an exact set, and
that reversal is deliberate rather than an inconsistency. W2-2's twelve pages
are a closed list of literal paths, so enumerating them costs nothing and buys
fail-closed behavior. `destinos`, `eventos` and `publicaciones` are keyed on
slugs, categories, tags, authors and page numbers — there is no finite set to
enumerate, so a prefix is the only option available.

The safety property is not lost, it just moves: `edge_ttl.mode =
"bypass_by_default"` means matching the prefix does nothing on its own. A page
under a matched prefix that has not opted in returns `BYPASS`, which is the
mechanism working rather than a gap.

W2-3 left six such pages deliberately uncached — `/destinos/atraccion/`,
`/destinos/lugar/`, and the four gastronomy/experience pages — because
`attraction`, `pointOfInterest`, `gastronomy` and `experience` had no tag
vocabulary, no `entity-tag-mapper` case, and their services never called the
revalidation service at all. **W2-4 built that chain and all six now cache**,
which is why this wave added the `gastronomia`/`experiencias` prefixes: the
other two already sat under `/destinos`.

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
| `/{lang}/` (home) | yes — **since 2026-08-04** (W2-1), tagged `home` |
| `/{lang}/{nosotros,beneficios,funcionalidades,contacto}/` | yes — **since 2026-08-04** (W2-2), tagged `site-config` |
| `/{lang}/preguntas-frecuentes/` | yes — **since 2026-08-04** (W2-2), tagged `site-config` |
| `/{lang}/legal/{cookies,privacidad,terminos}/` | yes — **since 2026-08-04** (W2-2), tagged `site-config` |
| `/{lang}/colaborar/` and `/{editores,fotos,reportar}/` | yes — **since 2026-08-04** (W2-2), tagged `site-config` |
| `/{lang}/destinos/` and `/mapa/` | yes — **since 2026-08-04** (W2-3), tagged `list-dest` |
| `/{lang}/destinos/<path>/` (detail) | yes — **since 2026-08-04** (W2-3), tagged `dest-<slug>` + `dest-<id>` |
| `/{lang}/destinos/<slug>/{alojamientos,eventos}/` | yes — **since 2026-08-04** (W2-3), tagged `list-accom`/`list-event` + `dest-<slug>` |
| `/{lang}/eventos/` and `/categoria/<c>/` and `/en/<loc>/` | yes — **since 2026-08-04** (W2-3), tagged `list-event` |
| `/{lang}/eventos/<slug>/` (detail) | yes — **since 2026-08-04** (W2-3), tagged `event-<slug>` + `event-<id>` |
| `/{lang}/publicaciones/` and `/{categoria,etiqueta,autor}/<x>/` | yes — **since 2026-08-04** (W2-3), tagged `list-post` |
| `/{lang}/publicaciones/<slug>/` (detail) | yes — **since 2026-08-04** (W2-3), tagged `post-<slug>` + `post-<id>` |
| `/{lang}/destinos/{atraccion,lugar}/<slug>/` | yes — **since 2026-08-04** (W2-4), tagged `attr-<slug>` / `poi-<slug>` (no collection tag exists) |
| `/{lang}/{gastronomia,experiencias}/` | yes — **since 2026-08-04** (W2-4), tagged `list-gastro` / `list-exp` |
| `/{lang}/{gastronomia,experiencias}/<slug>/` | yes — **since 2026-08-04** (W2-4), tagged `gastro-<slug>` / `exp-<slug>` + id |
| `/{lang}/alojamientos/` and `/page/N/` | yes |
| `/{lang}/alojamientos/mapa/` | yes |
| `/{lang}/alojamientos/tipo/<type>/` | yes |
| `/{lang}/suscriptores/{planes,turistas}/` and `/comparar/` | yes |
| `/{lang}/alojamientos/<slug>/` (detail) | yes — **since 2026-08-04**, tagged `accom-<slug>` + `accom-<id>` |
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

### The W2-2 pages have no purger of their own

The twelve copy-only pages are tagged `site-config`, which
`platform-settings.service.ts` purges. They do not read platform settings — the
tag is borrowed, because it is the only one in the vocabulary with a live
purger, and a cacheable response whose tag nobody ever purges is the silent
no-op `home` was stuck in before W2-1. A settings write evicts them for no
reason; the cost is a re-render.

What that leaves open: **nothing purges the cache on deploy.** There is no
purge step in `.github/workflows/` or in `hops`, and these pages change only on
deploy. So the 300s `s-maxage` is also the window in which a shipped copy
change is still invisible at the edge. That is the argument against giving them
a longer TTL, and it is the thing to fix first if one is ever wanted: add the
purge to the deploy, then raise the TTL — in that order, never the reverse.

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

Purge scoping was then measured in **both** directions, which is what makes it
a demonstration rather than a coincidence:

| Purged tag | Detail page (es/en/pt) | Listing |
|---|---|---|
| `preview:accom-<slug>` | **MISS ×3** | `HIT` — survived |
| `preview:list-accom` | `HIT` ×3 — survived | **MISS** |

W2-2 repeated the same two-direction check for the borrowed `site-config` tag,
against `/es/nosotros/`, `/es/legal/terminos/` and `/pt/colaborar/`. Both probes
ran 6–7 s after the purge — far enough inside the 300 s TTL that neither result
can be a natural expiry, and `MISS` rather than `EXPIRED` confirms an explicit
eviction:

| Purged tag | Static pages (3) | `/es/alojamientos/` |
|---|---|---|
| `preview:site-config` | **MISS ×3** | `HIT` — survived |
| `preview:list-accom` | `HIT` ×3 — survived | **MISS** |

### Measured on 2026-08-04, after W2-2 was applied

All 36 static-page URLs reached `HIT` on the second request, with a rising
`age`. The bypasses hold on every one of them:

| Probe on `/es/legal/terminos/` | Result |
|---|---|
| plain `GET` | `HIT` |
| `Cookie: better-auth.session_token=x` | `DYNAMIC` |
| `Cookie: __Secure-better-auth.session_token=x` | `DYNAMIC` |
| `?foo=1` | `DYNAMIC` |
| `HEAD` | `DYNAMIC` |

The `HEAD` row is not redundant. `curl -sSI` sends `HEAD`, the expression
requires `GET`, and a probe written that way therefore reports `DYNAMIC`
forever — on a zone where the cache is working perfectly. Probe with
`curl -sS -o /dev/null -D -`. This cost real debugging time on 2026-08-04.

The fail-closed choice of an exact path set over `starts_with` was confirmed by
measurement rather than left as an argument: `/es/legal/` — which
`starts_with(path, "/es/legal")` would have matched — returns `DYNAMIC`, as does
`/es/mi-cuenta/`.

### Measured on 2026-08-04, after W2-3 was applied

All fourteen catalog pages reach `HIT`. **Pagination was the point of the
exercise** and it caches, which is what proves `hasOnlyPaginationParams` was
needed: these URLs are `Astro.rewrite`s carrying `?page=N` into the parent
listing, so a `Astro.url.search === ''` gate would have left every one of them
private while page 1 kept working.

| Probe | Result |
|---|---|
| `/es/publicaciones/page/2/` | `HIT` |
| `/es/eventos/page/2/` | `HIT` |
| `/es/publicaciones/categoria/culture/page/2/` | `HIT` |
| `/es/destinos/colon/alojamientos/page/2/` | `HIT` |

Purge scoping, both directions, each probe 7 s after the purge:

| Purged tag | Post listing | Post detail | `/es/destinos/` | `/es/eventos/` |
|---|---|---|---|---|
| `preview:list-post` | **MISS** | `HIT` — survived | `HIT` | `HIT` |
| `preview:post-<slug>` | `HIT` — survived | **MISS** | `HIT` | `HIT` |

That first row is the whole argument for not tagging a detail page with its
collection, demonstrated: every post write evicts the listing without touching
any individual post's page. The last two columns show the families are isolated
from each other.

The six deliberately-excluded pages fail closed at **two different layers**,
which is worth knowing when reading a probe:

| Path | Result | Why |
|---|---|---|
| `/es/destinos/{atraccion,lugar}/<slug>/` | `BYPASS` | matches the `/es/destinos` prefix; origin never opts in |
| `/es/{gastronomia,experiencias}/` | `DYNAMIC` | no prefix in the expression at all |

`BYPASS` there is the `bypass_by_default` mechanism doing its job, not a defect.

One trap when probing by hand: an invented slug returns **404**, and the 404
guard runs BEFORE `applyCacheHeaders`, so the response carries no
`Cache-Control` at all and reads as `BYPASS`. That looks identical to "the page
refuses to cache" and is not. `/es/publicaciones/categoria/cultura/` is 404;
the real slugs are the lowercased `PostCategoryEnum` values (`culture`,
`tourism`, …). Always check the status code before concluding a page is
misconfigured.

### Purging from a shell

The probes must run from your own machine (the cache is per-PoP and the VPS
resolves to a different one), while the purge itself runs on the VPS so the
secret never leaves it:

```bash
ssh -p 2222 qazuor@216.238.103.219 'bash -lc "
CID=\$(docker ps --filter label=coolify.serviceName=hospeda-web-staging --format \"{{.Names}}\" | head -1)
S=\$(docker exec \$CID printenv HOSPEDA_REVALIDATION_SECRET | tr -d \"\\n\")
ENC=\$(printf %s \"\$S\" | jq -sRr @uri)
curl -sS -X POST -H \"Content-Type: application/json\" \
  -d \"{\\\"tags\\\":[\\\"preview:list-accom\\\"]}\" \
  \"https://staging.hospeda.com.ar/api/revalidate/?secret=\$ENC\"
"'
```

**Resolve the container by label, never by name.** Coolify assigns a new
container name on every redeploy, so a hardcoded name breaks silently the next
time the app ships: `docker exec` fails, the secret comes back empty, and the
purge returns `Unauthorized` — which looks like a credential problem and is not.

The trailing slash on `/api/revalidate/` is mandatory; without it Astro's
trailing-slash middleware answers 301 and the POST body is lost.
