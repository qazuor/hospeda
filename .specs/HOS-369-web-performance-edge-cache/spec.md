---
title: Web performance end-to-end — AI crawl trap, Cloudflare edge cache, document weight
linear: HOS-369
statusSource: linear
created: 2026-07-31
type: fix
areas:
  - devops
  - web
  - api
---

# Web performance end-to-end — AI crawl trap, Cloudflare edge cache, document weight

## 0. Revision log

### Rev 2 — 2026-07-31, same day: the "CPU runaway" was misdiagnosed

Rev 1 listed a `hospeda-web-prod` CPU runaway as an independent root cause and
declared its origin uninvestigated (old §5.8). It has now been investigated and
**that framing was wrong**. There is no runaway loop. The container is doing
real work: serving an **AI crawler storm against a zero-cache origin**, and the
crawl volume is amplified by a **self-inflicted infinite URL space** in our own
markup.

What changed in this revision:

- **Causes 1 and 2 collapsed into one.** The edge cache is not "scaling
  insurance" (HOS-128's framing) — it is the direct fix for the CPU saturation.
- **A new, larger root cause was found**: the destination pages emit 35
  crawlable, accumulative filter links with no `rel="nofollow"`, turning a
  381-URL site into a combinatorial crawl space. See §5.9.
- **A second bug was found**: `robots.txt` contains contradictory duplicate
  groups; the app's dynamic block neutralizes Cloudflare's managed AI-bot
  blocks. See §5.10.
- **Owner decisions were taken** on crawler policy and work ordering. See §11.
- The wave plan was restructured accordingly (§6): closing the crawl trap is now
  Wave A and precedes the edge cache.

Rev 1's §5.1–§5.7 measurements are unchanged and still valid.

## 1. Summary

Make `hospeda.com.ar` fast for Argentinian visitors and for the crawlers that
matter, by fixing the measured causes of the current 1.6–3.4 s TTFB, in the
order their evidence justifies:

1. **A self-inflicted crawl trap.** The destination pages publish 35 crawlable
   filter-combination links each, with no `rel="nofollow"` and no `robots.txt`
   guard. A site with 381 sitemap URLs is offering crawlers an effectively
   unbounded URL space, and they are taking it: **464,000 AI-crawler requests
   and ~83.7 GB of egress in 24 h**, one single URL absorbing 84,830 of them.
2. **Cloudflare caches zero HTML.** The origin already emits correct `s-maxage`
   headers on part of the catalog; the Cache Rule that would make them effective
   does not exist. Every one of those 464,000 requests is therefore a full SSR
   render with a ~10-call API fan-out — which is exactly what saturates the CPU
   on the 3-vCPU VPS.
3. **`robots.txt` contradicts itself**, so neither the managed nor the app-side
   AI-bot policy is actually in force.
4. **Production ships 254 KB of JavaScript that staging does not**, containing
   the complete `@repo/config` environment-variable registry — an information
   disclosure as well as a weight problem.

Everything in §5 is measured against production, staging, the VPS and the
Cloudflare dashboard on 2026-07-31, not inferred from code. Where static
analysis and measurement disagreed, measurement won — three times now, in both
directions (§12.2).

## 2. Problem

### 2.1 What users and bots experience today

Measured from Buenos Aires against the EZE Cloudflare PoP. Connection setup is
fast (15–38 ms), so the latency is entirely origin time:

| Route | TTFB | `cf-cache-status` |
|---|---|---|
| `/es/` (home) | 1.59 s / 2.35 s / 2.68 s | `DYNAMIC` |
| `/es/alojamientos/` | 1.57 s | `DYNAMIC` |
| `/es/destinos/` | 2.84 s | `DYNAMIC` |
| `/es/eventos/` | 2.15 s | `DYNAMIC` |
| `/es/alojamientos/<slug>/` | 1.61 s / 3.00 s / 3.37 s | `DYNAMIC` |
| `/es/` as Googlebot | 2.32 s | `DYNAMIC` |

Every entry into the site also pays a redirect first: `trailingSlash: 'always'`
is resolved at the origin, so `https://hospeda.com.ar/` → 301 → `/es/` costs a
full round-trip to the VPS before the page even starts. `/es/blog` chains two
redirects (`/es/blog` → `/es/blog/` → `/es/publicaciones/`).

### 2.2 Why this is not an API or database problem

The API is healthy and must not be the focus of this work:

- TTFB 0.29–0.42 s on `/public/accommodations`, `/public/destinations`,
  `/public/amenities`.
- Its in-process cache works: two consecutive requests return `X-Cache: MISS`
  then `X-Cache: HIT`.
- It compresses at origin (`hono/compress`, gzip/deflate).

The cost is in the web tier: SSR render time on a saturated box, multiplied by
the fact that nothing is ever cached at the edge.

### 2.3 The three root causes

**Cause 1 — no HTML is cached at the edge.** Cloudflare does not cache
`text/html` by default; it needs an explicit Cache Rule. None exists.
`apps/web/src/lib/cache/listing-cache.ts` already emits
`public, s-maxage=300, stale-while-revalidate=600` on the accommodation
listings, and the pricing pages emit `s-maxage=300, stale-while-revalidate=60`.
Both are inert. The file's own docstring says so explicitly — this was known
and documented at the time it shipped, and the missing half was never built.

**Cause 2 — the origin renders continuously because nothing is cached.**
Superseded framing: Rev 1 called this an idle CPU runaway. It is not idle and it
is not a runaway — see §5.9 for the real driver (464k AI-crawler requests/day
against a zero-cache origin). The CPU measurements below stand; only their
interpretation changed. Five `docker stats` samples 8 s apart, with no traffic
generated *by us* during the window:

```
web-prod 100.81 %   api-prod  8.31 %   load 2.93 2.59 2.43
web-prod 112.05 %   api-prod 42.50 %   load 3.49 2.72 2.47
web-prod 112.87 %   api-prod  5.98 %   load 3.18 2.68 2.46
web-prod 105.30 %   api-prod  0.78 %   load 3.01 2.65 2.46
web-prod  97.46 %   api-prod  2.29 %   load 3.63 2.80 2.51
```

The VPS has 3 vCPU and 7.9 GB RAM (6.2 GB used, 1.1 GB available, 2.6 GB swap in
use), shared between prod and staging of all three apps plus Coolify. Load
average is 2.4–2.8 out of 3. The container started `2026-07-27T16:00:19Z` with
`RestartCount=0`.

Thread-level detail (`top -H`): the **main JS thread** holds 3,722 minutes of CPU
over 4 d 4 h elapsed (~62 % of a core sustained), while the four V8 platform
worker threads hold only ~352 minutes each — so this is **JS execution, not GC
thrashing**. `docker logs --since 2m` returns **zero lines**, i.e. the work is
silent, which is what initially made it look like a spin loop.

It is not. The process is serving requests. §5.9 has the driver.

**Cause 3 — production ships a JS chunk staging does not.**
`MobileMenu.client.js` hydrates with `client:load` in the header of *every*
page:

| | staging | prod |
|---|---|---|
| bytes | 8,283 | **262,552** |
| `exampleValue` occurrences | 0 | 275 |
| `howToObtain` occurrences | 0 | 528 |
| `HOSPEDA_` occurrences | 0 | 213 |

The 254 KB delta is the full `@repo/config` env registry: 275 variable names
with descriptions, help URLs and operational instructions, readable by any
visitor. Verbatim sample from the production bundle:

```
howToObtain: `Cloudflare Dashboard → My Profile → API Tokens →
Create Token → grant "Zone.Cache Purge" on the hospeda.com.ar zone.
Set in Coolify for hospeda-web-prod as a secret.`
```

No secrets leak — the values are placeholders — but the complete infrastructure
inventory does: which integrations exist, how their credentials are obtained,
and where they are configured.

### 2.4 Document weight

The home page HTML is **1,138,902 bytes** uncompressed (~184 KB brotli). Parsed
composition:

| Block | Bytes | Share |
|---|---|---|
| `<script id="hospeda-i18n" type="application/json">` | 631,429 | 55.4 % |
| `astro-island` props (26 islands) | 170,679 | 15.0 % |
| Actual markup | ~333,000 | 29.2 % |

70 % of the document is embedded JSON. Within the i18n payload (single locale
`es`, 8,538 keys, 580 KB of leaf data), the distribution is heavily skewed:

| Namespace | Keys | Bytes |
|---|---|---|
| `validation` | 1,850 | 157,365 |
| `account` | 755 | 48,479 |
| `accommodations` | 709 | 42,322 |
| `host` | 518 | 35,557 |
| `social` | 589 | 30,019 |
| `billing` | 414 | 29,269 |
| (25 more) | — | ~237,000 |

`validation` alone is 157 KB of form error messages, shipped on a home page
with no validatable form.

## 3. Goals

- **G-1** — Anonymous catalog HTML is served from the Cloudflare edge with a
  measurable `cf-cache-status: HIT`, and an authenticated request to the same
  URL provably does **not** get a shared response.
- **G-2** — `hospeda-web-prod` idles at normal CPU (single-digit percent), so
  origin renders are not competing with a runaway process.
- **G-3** — The 254 KB env-registry chunk is gone from production, and a guard
  prevents it from coming back.
- **G-4** — Cache purge is selective by path, not whole-zone, *before* the edge
  cache is opened.
- **G-5** — Entry-point redirects (trailing slash, `/` → `/es/`) resolve at the
  edge, not at the origin.
- **G-6** — The i18n payload moves out of the HTML document into an
  immutable, edge-cacheable asset.
- **G-7** — Bots (Googlebot, PageSpeed, AI crawlers) get the same cached-edge
  benefit as human visitors, and are not throttled by the public rate limit.

Added in Rev 2:

- **G-8** — The site stops publishing an unbounded crawlable URL space. Crawlers
  are offered the ~381 real URLs, not their filter combinations.
- **G-9** — AI visibility is **preserved, not traded away**. Load drops without
  blocking Applebot, GPTBot or any other crawler (decision D-1).
- **G-10** — `robots.txt` expresses exactly one coherent policy, and a guard test
  keeps it that way.
- **G-11** — Googlebot's crawl rate recovers to something proportionate to a
  381-URL site, rather than 151 requests/day against Applebot's 326,810.

## 4. Non-goals

- **NG-1** — Optimizing the API or the database. Both measured healthy (§2.2).
  The JSONB expression-index candidates noted in §5.6 are recorded for a
  separate issue, not addressed here.
- **NG-2** — Caching authenticated pages. `/mi-cuenta/*`, checkout and any
  personalized surface stay uncached, permanently.
- **NG-3** — Caching API responses at the Cloudflare edge. That depends on
  HOS-359 (actor-blindness audit of ~30 public routes) and on HOS-351/HOS-352
  being closed; opening it before that is a cache-poisoning vector.
- **NG-4** — Migrating to Astro native CSP. That was HOS-124's blocked half;
  this work is explicitly decoupled from it, as HOS-128 already established.
- **NG-5** — Re-architecting the islands model. The `client:load` on
  `UserMenu`/`MobileMenu` is a documented, deliberate trade-off tied to the
  auth-state-under-cache problem; changing it reintroduces a known bug.
- **NG-6** — Changing `inlineStylesheets: 'never'`. That is gated on the
  CSP/ClientRouter constraint tracked in HOS-164/HOS-168.

## 5. Current baseline

### 5.1 What the origin emits today, versus what Cloudflare does with it

| Route | Origin `Cache-Control` | Cloudflare | Notes |
|---|---|---|---|
| `/es/` (home) | none | `DYNAMIC` | Never reads session; already effectively anonymous |
| `/es/alojamientos/` | `public, s-maxage=300, stale-while-revalidate=600` | `DYNAMIC` | Header inert |
| `/es/alojamientos/mapa/` | same | `DYNAMIC` | Header inert |
| `/es/alojamientos/tipo/*/` | same | `DYNAMIC` | Header inert |
| `/es/alojamientos/<slug>/` | none | `DYNAMIC` | Bakes per-user state — see §5.4 |
| `/es/destinos/`, detail | none | `DYNAMIC` | Reads session, gets nothing back |
| `/es/eventos/`, detail | none | `DYNAMIC` | idem |
| `/es/publicaciones/`, gastronomía, experiencias | none | `DYNAMIC` | idem |
| `/es/suscriptores/planes/` + siblings | `s-maxage=300, stale-while-revalidate=60` | `DYNAMIC` | Header inert; unconditional (page never reads session) |
| `/api/og` | `public, max-age=86400, s-maxage=604800` | `DYNAMIC` | Header inert |
| `robots.txt`, `llms.txt` | `public, max-age=3600` | — | |
| `sitemap-dynamic.xml`, RSS | `public, max-age=86400, stale-while-revalidate=86400` | — | |
| `sitemap-index.xml` | `public, max-age=0` | `DYNAMIC` | |
| `/_image` | `public, max-age=31536000, immutable` | — | HOS-160 lever C |
| `/_astro/*.js`, `*.css` | `public, max-age=31536000, immutable` | **`HIT`** (`age: 135656`) | The one carril that works |
| `/assets/**` (SVG) | `public, max-age=14400` | `REVALIDATED` | |
| `api.hospeda.com.ar/**` | none | `DYNAMIC` | Sets `hospeda_vid` cookie |

### 5.2 The origin-side cache mechanism that already exists

`apps/web/src/lib/cache/listing-cache.ts` (150 lines, pure functions):

- `LISTING_CACHE_S_MAXAGE_SECONDS = 300`, `LISTING_CACHE_SWR_SECONDS = 600`.
- `resolveListingCacheControl({ cacheable })` → `public, s-maxage=300,
  stale-while-revalidate=600` or `private, no-cache`.
- `hasActiveAccommodationListingFilters({ searchParams })` — any param outside
  `page/sortBy/sortOrder/checkIn/checkOut/type/types`, or explicit `adults`, or
  non-zero `children`, makes the URL non-cacheable.

Wired into exactly three pages: `alojamientos/index.astro:523`,
`alojamientos/mapa.astro:66`, `alojamientos/tipo/[type]/index.astro:86`. In all
three, `cacheable = !isAuthenticated && !noindex && !hasActiveFilters`.

This is the correct pattern and it is the template for extending to the rest of
the catalog. What it lacks is the edge half.

### 5.3 Session detection and why caching is viable

- Recognized cookies (`middleware-helpers.ts:518-521`):
  `better-auth.session_token` and `__Secure-better-auth.session_token`.
- `parseSessionUser()` calls `GET /api/v1/public/auth/me` forwarding the raw
  `Cookie` header. That endpoint is `skipAuth: true` and always returns 200, so
  only `data.data.isAuthenticated === true` is a valid signal — `response.ok`
  is not.
- **`apps/web` emits no `Set-Cookie` anywhere.** Verified by grep over the
  whole `src` tree (`Astro.cookies.set` — zero hits) and confirmed in the live
  response headers. Better Auth cookies are set by `apps/api`, not by the web
  origin.

That last point is what makes edge caching viable at all: Cloudflare refuses to
cache responses carrying `Set-Cookie`, and there are none.

`SESSION_OPTIONAL_SEGMENTS` (`routes.ts`) currently includes `feedback`,
`alojamientos`, `destinos`, `eventos`, `publicaciones`, `guest`, `publicar`,
`gastronomia`, `experiencias`, `publicar-restaurante`, `publicar-experiencia`.
Every request under those segments pays a `/auth/me` round-trip. Of them, only
`alojamientos` currently converts that cost into a cache decision.

Routes outside all three segment lists — home, `suscriptores/*`, `legal/*`,
`contacto`, `nosotros`, `beneficios`, `funcionalidades`, `colaborar/*`,
`preguntas-frecuentes` — never call `parseSessionUser` and always have
`Astro.locals.user === null`.

### 5.4 The detail page is the hard case

`alojamientos/[slug].astro` bakes per-user state into the SSR output:
`protectedConversationsApi.list` (line ~277), `userBookmarksApi.checkStatus`
(~314), `currentUser` id/name/email, plus price alerts, entitlements and
WhatsApp lookups. Caching it as-is would serve one visitor's state to the next.

This is exactly the blocking prerequisite HOS-128 identified as "the bulk of
the work" (its D-2), and it was never done. It must be treated as its own
wave, not bundled with the listings.

Secondary finding on the same page: after an initial `Promise.allSettled` batch
of 8 calls, authenticated users pay up to 5 additional **sequential** awaits.
And `alojamientos/index.astro:208-220` runs 4 sequential awaits
(destinations → amenities → features → accommodations) with no `Promise.all`,
contradicting a comment in `listing-cache.ts:9` that claims otherwise.

### 5.5 Purge is still whole-zone

`apps/web/src/pages/api/revalidate.ts:60` sends
`{ purge_everything: true }` to the Cloudflare zone. Verified by reading the
file on 2026-07-31 — HOS-297 (Done) solved the *burst* problem (a 50 ms
`PURGE_COALESCE_MS` window collapsing ~18 simultaneous purges into one, which
was tripping the WAF with 403s), **not** the selectivity.

Today this is harmless because nothing is cached. The moment the edge cache
opens, every event or post edit will flush the entire zone — including the
static assets that currently work correctly.

`packages/service-core/src/revalidation/entity-path-mapper.ts` already has the
per-entity affected-path logic (`destination`, `event`, `post`,
`accommodation_review`, `destination_review`, `tag`, `amenity`,
`accommodation`). It is not wired to the purge call.

The adapter falls back to `NoOpRevalidationAdapter` with only a `logger.warn`
if `HOSPEDA_REVALIDATION_SECRET` is missing — a silent-disable path worth
knowing about.

### 5.6 Client-side weight, measured from production

JS referenced by the home page:

| Chunk | brotli | raw |
|---|---|---|
| `page.js` | 78,068 | 236,567 |
| `MobileMenu.client.js` | 70,616 | **262,552** (8,283 on staging) |
| `client.js` (React runtime) | 57,801 | 180,731 |
| `DestinationsIsland.client.js` | 4,971 | 14,907 |
| `TestimonialsCarousel.client.js` | 3,687 | 9,735 |
| `SearchBar.client.js` | 3,568 | 13,649 |
| (17 more) | ~19,632 | ~50,613 |
| **Total** | **238,343** | **768,754** |

Removing the regressed chunk brings JS to ~168 KB brotli, which is reasonable.

CSS: 20 separate files, 57,603 bytes brotli combined, all render-blocking.
Largest: `global.css` 15,243, `index.css` 10,364, `BaseLayout.css` 9,599.
`global.css` imports `driver.js/dist/driver.css` unconditionally, shipping the
onboarding-tour styles on every public page although tours only run under
`/mi-cuenta/*`.

Rate limiting (`apps/api/src/middlewares/rate-limit.ts`): public tier is
1000 req/h per IP, IP-keyed, `trustProxy: true`, with **no user-agent allowlist
for crawlers**. SSR server-to-server traffic is already exempt via
`X-Internal-Request` (HOS-103). The residual exposure is a crawler hitting
`api.hospeda.com.ar` directly from a shared datacenter range.

Latency candidates recorded but not addressed here (see NG-1): JSONB filters in
`accommodation.model.ts` (`extraInfo->>'capacity'`, `'bedrooms'`, `'bathrooms'`,
and the geo bbox/radius clauses) have no expression index in
`packages/db/src/migrations/extras/`.

### 5.7 What was investigated and found NOT to be a problem

Recording these so nobody re-spends effort:

- **The i18n bundle is not shipping three locales to the browser.** Static
  analysis predicted it would (barrel `webTrans` builds `es`+`en`+`pt`). The
  shipped chunks contain **zero** translated strings, and the inline JSON
  carries `locale: "es"` only. HOS-160 lever A worked. The problem that remains
  is *where* the single-locale payload lives (inline in HTML), not how many
  locales it contains.
- **`@repo/schemas` barrel leak into islands** — suspected because the package
  lacks `"sideEffects": false` and is aliased to source. The production chunks
  contain no zod markers (`ZodError`, `z.object`, `safeParse`, `PermissionEnum`
  — all zero occurrences). Adding `sideEffects: false` is still good hygiene,
  but it is not a live weight problem.
- **Leaflet** is correctly isolated behind `client:only="react"`; it does not
  appear in chunks of pages without a map.
- **TipTap** never reaches the public client; rich content renders server-side
  via `marked` in `render-content.ts`.
- **Icons** already tree-shake per icon (SPEC-269 resolver plugin).
- **`Set-Cookie` on HTML** — none, as established in §5.3.

### 5.8 What was NOT investigated

Explicit gaps in this baseline, so the spec is not read as more complete than
it is:

- ~~**The Cloudflare zone configuration itself was not read.**~~ **Rev 2: partly
  closed.** The dashboard was read (Analytics → HTTP Traffic, AI Crawl Control).
  Confirmed: the zone is on the **Free** plan. Still unread: the Cache Rules /
  Page Rules list itself, Tiered Cache and Argo settings. The absence of an
  HTML Cache Rule remains inferred from `cf-cache-status: DYNAMIC` on every HTML
  route plus the absence of config-as-code, not confirmed by reading the rule
  list.
- ~~**The cause of the `web-prod` CPU runaway.**~~ **Rev 2: CLOSED.** Diagnosed —
  see §5.9. It is crawler load against an uncached origin, not a loop.
- **The import chain that pulls `@repo/config` into the client bundle.** Static
  grep finds no importer in `apps/web/src`; the chain is transitive and was not
  traced. A production build with `ANALYZE=1` (already wired, emits
  `apps/web/stats.html`) is the next step. Still open.
- **Field Core Web Vitals.** Only lab/synthetic measurements were taken. The
  PostHog web-vitals data was not queried. Still open.
- **Google Search Console crawl stats.** §5.9 shows Googlebot at 151 requests/day
  against Applebot's 326,810. Whether Google has actively throttled our crawl
  budget because of origin latency is a *hypothesis*, not a measurement — it must
  be confirmed in Search Console → Crawl stats before being treated as fact.
- **Traefik/Coolify layer behavior** (compression between origin and
  Cloudflare, keep-alive, connection limits). Traefik access logs are **not
  enabled** (0 lines in 30 s), which is why crawler identification had to come
  from the Cloudflare dashboard.
- **`apps/admin` and `apps/mobile`** were out of scope entirely.

### 5.9 The AI crawl storm (Rev 2 — the real driver of §2.3 cause 2)

Read from the Cloudflare dashboard on 2026-07-31, **last 24 hours**:

| Crawler | Requests | Egress | Change |
|---|---:|---:|---|
| **Applebot** | **326,810** | **63.3 GB** | **+254.75 %** |
| **GPTBot** | **136,990** | **20.39 GB** | +47.49 % |
| Baidu | 156 | 3.19 MB | +19.59 % |
| **Googlebot** | **151** | 10.43 MB | +73.86 % |
| ClaudeBot | 12 | — | — |
| BingBot | 4 | — | — |
| OAI-SearchBot | (in "+2") | 360.72 kB | — |
| Bytespider, PerplexityBot, CCBot, DuckAssistBot | 0 | — | — |

Totals: **464,000 requests, 100 % allowed, 0 blocked, +31.38 % vs the previous
period.** Status codes: 2xx 464,120 · 4xx 193 · 3xx 61 · 5xx 22. Aggregate egress
**≈ 83.7 GB/day ≈ 2.5 TB/month**.

Traffic by country, same window: **United States 611,398** · Brazil 2,076 ·
Singapore 1,869 · Germany 1,761 · Australia 1,728. **Argentina is not in the top
five** — the audience the site is actually built for is a rounding error next to
the crawler load.

Cloudflare's own summary line: *"`hospeda.com.ar/pt/destinos/concepcion-del-uruguay/`
is the most-crawled path with **84,830** successful requests."* One path, 18 % of
all crawl traffic, ~1 request/second sustained — on the **Portuguese** variant of
a destination page.

**The arithmetic closes exactly**, which is what confirms the chain: 464k
requests × ~180 KB brotli HTML ≈ 83 GB egress; 464k renders × ~10 API calls per
render ≈ the 38 req/s measured on the API side (1,143 log lines in 30 s). The CPU
saturation in §2.3, the API request volume, and the egress bill are all one
phenomenon.

Note the compounding factor: the **631 KB of inline i18n JSON (§2.4) is being
served 464,000 times a day**. Document weight (Wave D) is therefore not cosmetic
— it is a direct multiplier on egress.

#### 5.9.1 Why the volume is pathological: a self-inflicted crawl trap

The sitemap declares **381 URLs** (`sitemap-dynamic.xml`: 168 eventos, 69
publicaciones, 69 destinos, 45 alojamientos, 18 gastronomía, 12 experiencias).
Applebot alone made 326,810 requests against it — **857 fetches per URL per day**.
No legitimate crawler needs that. The excess is not repeat-fetching of the 381
canonical URLs; it is exploration of a URL space we generate ourselves.

Measured on `https://hospeda.com.ar/pt/destinos/concepcion-del-uruguay/`
(1,032,721 bytes of HTML):

- **107 `<a href>` total, of which 42 carry a query string.**
- **35 of them are `?categories=<value>`** — the POI thematic filter chips
  (HOS-147).
- **Zero `rel="nofollow"`** anywhere on the page (the only `rel` values present
  are `stylesheet`, `noopener noreferrer`, `preconnect`, `alternate`, `icon`,
  `preload`, `manifest`, `canonical`, `apple-touch-icon`).
- `robots.txt` has **no `Disallow` for query strings**.

The filter is **multi-select and accumulative** (`apps/web/CLAUDE.md`: "clicking a
chip accumulates its value in a CSV array query param"). So a crawler that
follows a filtered URL lands on a page that offers *further* filtered URLs, each
a new combination. Across 69 destinations × 3 locales this is a combinatorial
tree, and every node is a full uncached ~1 MB SSR render with a 10-call API
fan-out.

**`noindex` does not help here.** HOS-96's rule marks 2+-value facet URLs
`noindex,follow`, which prevents *indexing* — but the crawler must still fetch
the megabyte to read the tag. Crawl cost is paid in full. (`follow` arguably makes
it worse by inviting the crawler onward.)

This also explains why the Cloudflare panel attributes 84,830 requests to a
single *path*: those are thousands of distinct query-string variants that the
panel groups under the same path.

### 5.10 `robots.txt` contradicts itself

`https://hospeda.com.ar/robots.txt` contains **two competing sources** that are
concatenated into one file:

1. Cloudflare's **managed content block** (`# BEGIN Cloudflare Managed content`),
   which sets `Content-Signal: search=yes,ai-train=no,use=reference` and
   `Disallow: /` for Amazonbot, **Applebot-Extended**, Bytespider, CCBot,
   **ClaudeBot**, CloudflareBrowserRenderingCrawler, **Google-Extended**,
   **GPTBot**, meta-externalagent.
2. The app's **dynamic `robots.txt`** (`apps/web/src/pages/robots.txt.ts`), which
   then emits its own groups — including `User-agent: GPTBot` / `Allow: /`,
   `User-agent: ClaudeBot` / `Allow: /`, `User-agent: Google-Extended` / `Allow: /`
   and `User-agent: CCBot` / `Allow: /`.

Per RFC 9309 crawlers **merge** groups matching the same user-agent, and on an
equally-specific conflict the least restrictive rule wins — so `Allow: /` beats
the managed `Disallow: /`. Observed behavior matches: GPTBot crawled 136,990
times despite the managed block.

**Net effect: neither policy is in force.** The managed block is inert, and the
app block is silently granting access the operator believes was revoked.

Two further notes:

- **`Applebot-Extended: Disallow: /` is correctly set** and should stay. But it
  reduces **zero** traffic: `Applebot-Extended` is not a separate fetching
  crawler, it is a robots token governing whether data already fetched by
  `Applebot` may be used for Apple Intelligence training.
- **`Applebot` itself has no rule** and falls through to `User-agent: *` /
  `Allow: /`. That is why it crawls unthrottled at 326,810/day.

#### 5.10.1 Which crawler buys what (basis for the §11 policy decision)

| Crawler | What it actually does | Blocking it costs |
|---|---|---|
| `Applebot` | Crawls for **Siri, Spotlight, Safari suggestions** | Apple search visibility — real |
| `Applebot-Extended` | Robots token: opt out of **Apple Intelligence training** | Nothing; already disallowed |
| `GPTBot` | Crawls for **OpenAI model training** | Presence in training corpora |
| `OAI-SearchBot` | Indexes for **ChatGPT search results** | **Being cited in ChatGPT** |
| `ChatGPT-User` | Live fetch when a user asks ChatGPT to open the page | Live retrieval |
| `Googlebot` | Google Search | Organic search — the revenue channel |

The operational consequence: **blocking `GPTBot` does not remove the site from
ChatGPT's answers** — `OAI-SearchBot` and `ChatGPT-User` do that, and they are
separate agents currently moving 360 kB and near-zero traffic respectively.
Blocking `Applebot`, by contrast, does cost real Siri/Spotlight visibility.

## 6. Proposed design

**Rev 2 restructure.** The wave plan changed once §5.9/§5.10 landed. The chosen
strategy is **A → B, explicitly not C** (owner decision D-1, §11):

- **A — close the crawl trap.** Cut the URL space at the source. This is the only
  lever that reduces load **without surrendering any AI visibility**, and it is
  cheap and reversible.
- **B — turn on the edge cache.** Protects the origin for all traffic, bots and
  humans alike, and is a prerequisite for the site being fast for real users.
- **C — throttling/blocking crawlers is rejected** as a first move. It treats the
  symptom, and it costs exactly the thing the owner wants (AI visibility).
  Revisit only with post-A data (§11 D-2).

A precedes B for a concrete technical reason, not just cost: **B without A
under-performs**, because un-normalized filter query strings fragment the edge
cache across thousands of variants and collapse the hit rate.

### 6.1 Wave A — close the crawl trap

The highest-yield, lowest-risk work, and the fastest to ship. Three independent
mechanisms; do all three, since each covers a gap the others leave.

**WA-1 — `Disallow` filter query strings in `robots.txt`.**
Stop the combinatorial exploration at the source, in
`apps/web/src/pages/robots.txt.ts`. Target the facet params (`categories`,
`types`, `attractions`, and the date/occupancy params) rather than a blanket
`Disallow: /*?*`, so that legitimate parameterised URLs are not caught. The
path-based facet landings (`/alojamientos/tipo/*`, `/eventos/categoria/*`) are
**not** query strings and must stay crawlable — they are indexable SEO surface.

**WA-2 — `rel="nofollow"` on every facet chip link.**
`robots.txt` governs fetching; `nofollow` governs link-graph discovery. A crawler
that already has a filtered URL queued will still try it, so both are needed.
Applies to the POI category chips (`DestinationPOIFilter` / the SSR chips in
`DestinationPOISection.astro`) and to the `FilterChips.astro` consumers on the
accommodation/event/post listings. Note the existing `aria-current` convention on
those `<a>` elements — do not disturb it.

**WA-3 — Verify canonical on filtered URLs.**
Every facet-combination URL must carry a canonical pointing at the clean listing.
`resolveFacetSeoDecision` (`src/lib/seo/promoted-facet-canonical.ts`) already
implements this rule; WA-3 is a verification task, not new logic — confirm it is
actually emitted on the destination detail page, which reached the facet pattern
via HOS-147 and may not be wired into that predicate.

**WA-4 — Fix the contradictory `robots.txt` (§5.10).**
Reconcile the app-generated groups with Cloudflare's managed block so exactly one
policy is in force. This is where the GPTBot decision (§11 D-3) is actually
expressed. Add a guard test asserting no user-agent appears in two groups with
conflicting root rules.

**WA-5 — Measure the effect before doing anything else.**
Re-read AI Crawl Control after 48–72 h (crawlers must re-read `robots.txt` and
drain their queues). Record the new per-crawler numbers against the §5.9
baseline. **If Applebot has not dropped materially, that is the trigger to
reconsider C** — with data, not preemptively.

### 6.2 Wave 0 — housekeeping (independent, can run in parallel with A)

These do not depend on A or B and should not block them.

**W0-2 — Promote `staging` → `main`.**
Recovers 254 KB of JS on every page and closes the env-registry disclosure. The
fix already exists on staging; it just has not reached production. Follow the
normal promotion flow (`[NOSPEC:promote-staging]`, back-merge check first).

**W0-3 — Trace how `@repo/config` entered the client graph.**
Run `ANALYZE=1 pnpm build` in `apps/web` and read `stats.html`. Without
understanding the chain, W0-2 is a coincidence, not a fix.

**W0-4 — Add a bundle guard.**
A CI test asserting that no client chunk contains env-registry markers
(`exampleValue`, `howToObtain`, `HOSPEDA_` variable definitions). This is the
non-regression half of W0-2/W0-3. Follow the existing static-guard conventions
in `apps/api/test/routes/isverified-badge-gate.guard.test.ts` — discovery by
symbol reference, explicit non-vacuity check, and a documented statement of
what the guard does **not** cover.

### 6.3 Wave B — turn on the edge

**W1-1 — Selective purge (prerequisite, not follow-up).**
Wire `entity-path-mapper.getAffectedPaths()` into
`apps/web/src/pages/api/revalidate.ts`, replacing `purge_everything: true` with
`files: [...]`. Keep a whole-zone escape hatch behind an explicit flag for
deploys. This must land **before** W1-2; opening the cache with a whole-zone
purge trades one problem for another.

**W1-2 — Cloudflare Cache Rule.**
Scope: `/{lang}/alojamientos*` and `/{lang}/suscriptores/{planes,turistas}*`
only — the routes that already emit a correct header. Requirements, in order:

1. Make `text/html` eligible on those paths, honoring the origin
   `Cache-Control` rather than overriding it with an Edge TTL.
2. **Bypass when a session cookie is present**: `better-auth.session_token` or
   `__Secure-better-auth.session_token`. The origin-side `isAuthenticated` gate
   is not sufficient — the edge cache key must reflect it too, or an
   authenticated visitor can be served (or can poison) the anonymous variant.
3. Bypass on any query string carrying filters, to avoid fragmenting the cache
   across thousands of variants.

**W1-3 — Verify by measurement, not by assumption.**
Re-run the §5.1 probes. Acceptance is in §9; a rule that is created but not
verified is exactly the failure mode that left the pricing header dead for
months.

**W1-4 — Redirect Rules at the edge.**
Move the trailing-slash and `/` → `/es/` redirects to Cloudflare Redirect
Rules. Collapse the `/es/blog` → `/es/blog/` → `/es/publicaciones/` chain into a
single hop.

**W1-5 — Version the Cloudflare configuration.**
The only Cloudflare config-as-code in the repo today is two Workers
(`infra/cloudflare/posthog-proxy`, `infra/cloudflare/sentry-tunnel`). Cache
Rules and Redirect Rules must not be dashboard-only — that is precisely how a
dead header survived unnoticed. At minimum, commit the rule expressions as
documentation under `infra/cloudflare/`; ideally as Terraform.

### 6.4 Wave C — extend the pattern across the catalog

**W2-1 — Home.** The easiest case: it never reads the session, is already
unconditionally anonymous, and emits no cache header at all. Apply the
`listing-cache.ts` pattern (unconditional, like the pricing pages).

**W2-2 — Truly static pages.** `nosotros`, `beneficios`, `funcionalidades`,
`contacto`, `legal/*`, `preguntas-frecuentes`, `colaborar/*`. None reads
`Astro.locals.user`. Long TTL.

**W2-3 — Remaining catalog listings.** `destinos`, `eventos`, `publicaciones`,
`gastronomia`, `experiencias` — listings and detail. These currently pay the
`/auth/me` round-trip via `SESSION_OPTIONAL_SEGMENTS` and get no caching
benefit in return. Same conditional pattern as accommodations.

**W2-4 — Accommodation detail.** The hard case (§5.4). Move bookmark state,
conversation state and user identity out of SSR into client-side fetches,
following the pattern already used in `PricingCardsGrid.astro:807-826`. Only
then apply the cache header.

**W2-5 — Parallelize the sequential SSR fetches** in
`alojamientos/index.astro` and the authenticated branch of
`alojamientos/[slug].astro`. This reduces cold-cache TTFB, which still matters
for the first request after every TTL expiry and for every `stale-while-
revalidate` refresh.

**W2-6 — Bot handling.** Confirm crawlers benefit from the edge cache (they
will, since the cache is UA-agnostic) and add a rate-limit allowlist or a
separate tier for verified crawler traffic hitting the API directly.

**W2-7 — Fix the 19 misleading `@rendering SSR + ISR 24h` comments** — either
implement the caching they claim (covered by W2-3) or correct the comment. A
comment promising a mechanism that does not exist is worse than no comment.

### 6.5 Wave D — document weight

> **Rev 2 reprioritisation.** Rev 1 treated this as the lowest-value wave. §5.9
> changes that: the 631 KB inline i18n payload is served **464,000 times a day**,
> so document weight is a direct multiplier on the ~83.7 GB/day egress bill, not
> a page-speed nicety. W3-1 is now the largest single byte win available anywhere
> in this spec.

Overlaps HOS-168; this spec supplies the measurements it lacked.

- **W3-1** — Move the i18n payload out of the HTML into a hashed, immutable
  asset served on the `/_astro/*` carril that already returns `HIT`. Saves
  631 KB per cold page load. **This is the single largest byte win available.**
- **W3-2** — Split the i18n catalog by namespace. `validation` (157 KB) has no
  business being on a page without forms.
- **W3-3** — Audit the 170 KB of `astro-island` props across 26 islands.
- **W3-4** — Remove `driver.js` CSS from the global bundle.
- **W3-5** — Consolidate the 20 render-blocking stylesheets. Gated on the
  CSP/`inlineStylesheets` constraint (HOS-164/HOS-168) — do not start before
  that resolves.

### 6.6 Documentation cleanup

`docs/performance/caching.md`, `docs/performance/README.md`,
`docs/runbooks/scaling.md`, `docs/deployment/apps/web.md` and
`docs/deployment/apps/api.md` describe a Vercel + Neon + Redis + Fly.io
architecture that has not existed since the May 2026 migration to
Coolify/VPS/Cloudflare (`docs/migration/vps-deployment-spec.md` v3). They are
surviving boilerplate. Either mark them obsolete or rewrite them against the
real infrastructure — anyone planning cache work from them designs against a
system that does not exist.

## 7. Data model / contracts

No database changes. The contracts introduced or modified:

### 7.1 Origin cache-header contract

Extends the existing `resolveListingCacheControl` contract to the rest of the
catalog. A route is cacheable when **all** hold:

- `Astro.locals.user === null` (anonymous), and
- the page is indexable (`!noindex`), and
- no narrowing filters are present in the query string.

Otherwise: `private, no-cache`. No new header names — `Cache-Control` only.
`apps/web` currently emits no `Vary`, `ETag`, `Surrogate-Key` or
`CDN-Cache-Control` anywhere, and this work does not introduce them; the
anonymous/authenticated split is enforced by the edge bypass rule, not by
`Vary`.

### 7.2 Cloudflare Cache Rule contract

Documented under `infra/cloudflare/` (W1-5). Must specify: match expression,
cache eligibility, cookie-based bypass condition, query-string bypass
condition, and TTL source (origin `Cache-Control`, not an Edge TTL override).

### 7.3 Purge contract

`POST /api/revalidate?secret=…` changes from
`{ purge_everything: true }` to `{ files: string[] }`, sourced from
`entity-path-mapper.getAffectedPaths()`. The whole-zone form stays available
behind an explicit parameter for deploy-time flushes.

Env vars unchanged: `HOSPEDA_REVALIDATION_SECRET` (required),
`CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN` (production-scoped, `web` app
only).

## 8. UX / UI behavior

No intentional UI change. One behavior worth stating explicitly:

On a cached page, `Astro.locals.user` is always `null`, so the header renders
its logged-out state until `UserMenu`/`MobileMenu` hydrate and resolve the real
session. This is the existing, documented reason both are `client:load` rather
than `client:idle`. Extending caching to more routes widens the surface where
that brief wrong-state window is visible — it does not create a new one, but it
should be confirmed as acceptable on the newly cached routes.

## 9. Acceptance criteria

Wave A (added Rev 2):

- **AC-A1** — `/pt/destinos/concepcion-del-uruguay/` emits **zero** `<a href>`
  containing a facet query string without `rel="nofollow"`. Asserted on the raw
  SSR HTML, per the repo's existing SSR-assertion convention.
- **AC-A2** — `robots.txt` `Disallow`s the facet query params, while the
  path-based facet landings (`/alojamientos/tipo/*`, `/eventos/categoria/*`)
  remain crawlable. A guard test covers both directions — the second half is what
  stops an over-broad `Disallow: /*?*` from silently de-indexing real SEO surface.
- **AC-A3** — No user-agent appears in two `robots.txt` groups with conflicting
  root rules. Guard test, non-vacuous: it must fail if the managed block and the
  app block are concatenated as they are today.
- **AC-A4** — 48–72 h after Wave A ships, AI Crawl Control shows a **material
  drop** against the §5.9 baseline (464k requests / 83.7 GB / 24 h). Recorded
  with the same per-crawler breakdown so the comparison is like-for-like. No
  numeric target is set deliberately — the baseline is one day's reading of a
  metric that moved +31 % in a day, and inventing a threshold would be false
  precision.
- **AC-A5** — Googlebot's daily request count is re-read in Search Console before
  and after. Directional evidence for D-2, not a pass/fail gate.

Wave B onward:

- **AC-1** — `curl -D -` on `/es/alojamientos/` returns `cf-cache-status: HIT`
  on the second request, with a non-zero `age`.
- **AC-2** — The same URL requested **with** a valid `better-auth.session_token`
  cookie returns `BYPASS` (or `DYNAMIC`), never `HIT`, and its body contains
  that user's state.
- **AC-3** — A URL with filter params (`?amenities=…`) is not cached.
- **AC-4** — `hospeda-web-prod` idles below 10 % CPU across five `docker stats`
  samples with no traffic.
- **AC-5** — No production client chunk contains `exampleValue`,
  `howToObtain`, or `HOSPEDA_*` variable definitions, enforced by a CI guard
  that demonstrably fails when the leak is reintroduced.
- **AC-6** — `POST /api/revalidate` issues a `files: [...]` purge; editing one
  event does not evict `/_astro/*` assets (verify `age` on a static asset
  survives the purge).
- **AC-7** — `https://hospeda.com.ar/` resolves to `/es/` at the edge
  (`cf-cache-status` present on the 301, no origin hit).
- **AC-8** — Home HTML drops below 500 KB uncompressed after W3-1.
- **AC-9** — TTFB for an anonymous, cached catalog route measured from Buenos
  Aires is under 200 ms.
- **AC-10** — Googlebot user-agent receives the same `HIT` as a browser
  user-agent on the same URL.

## 10. Risks

- **R-1 — Cache poisoning / personalization leak.** The highest-severity risk
  and the reason W1-2's cookie bypass is non-negotiable. Precedent: HOS-115,
  HOS-341, HOS-353. Mitigation: bypass at the edge *and* the origin gate, plus
  AC-2 as an explicit verification step.
- **R-2 — CSP nonce shared across visitors.** Each response carries a
  per-request nonce in both the CSP header and the HTML. Under caching, all
  visitors share one nonce for the TTL. Header and document stay consistent so
  nothing breaks, but the `strict-dynamic` guarantee is weakened. HOS-128 flagged
  this as requiring explicit sign-off; it still does. See OQ-3.
- **R-3 — Whole-zone purge under an active cache.** Addressed by W1-1 being a
  prerequisite rather than a follow-up.
- **R-4 — Dashboard-only configuration drift.** The exact failure mode that
  produced the dead pricing header. Addressed by W1-5.
- **R-5 — Fixing the CPU runaway may reveal a different bottleneck.** The 1.6 s
  best-case TTFB is measured on a saturated box; it is not yet known how much
  is contention and how much is genuine render cost. Re-baseline after W0-1.
- **R-6 — Promoting staging→main carries unrelated changes.** W0-2 is a normal
  promotion with normal promotion risk; it should not be treated as an isolated
  perf fix. Check for pending Dependabot PRs on `main` first
  (`project_staging_to_main_promotion_gotchas`).
- **R-7 — Extending `SESSION_OPTIONAL_SEGMENTS` caching without auditing what
  each page bakes.** `destinos`/`eventos`/`publicaciones` were assumed to bake
  only `isAuthenticated`, but this was not verified page by page. W2-3 must
  start with that audit, not skip to the header.

Added in Rev 2:

- **R-8 — An over-broad `robots.txt` `Disallow` de-indexes real SEO surface.**
  The blunt fix (`Disallow: /*?*`) is tempting and wrong: it would also block any
  legitimate parameterised URL. The facet **landings** are path-based
  (`/alojamientos/tipo/*`, `/eventos/categoria/*`) and must stay crawlable — they
  are deliberate SEO surface from HOS-96. AC-A2 tests both directions precisely
  because the failure here is silent and slow to notice.
- **R-9 — `robots.txt` and `nofollow` are advisory and lagged.** Well-behaved
  crawlers (Applebot, GPTBot both qualify) honour them, but only after re-reading
  the file and draining queued URLs — expect 48–72 h, not minutes. Wave A is not
  an emergency brake. If the situation degrades before it takes effect, that is
  the one case for a temporary C-style throttle, as a stopgap and not as the
  strategy.
- **R-10 — Caching a crawl trap makes it cheaper to crawl.** If B shipped before
  A, the filter-combination URLs would become fast to fetch, which plausibly
  *increases* crawl rate while fragmenting the cache across thousands of
  low-value variants. This is the concrete reason A precedes B (§12.3), beyond
  cost ordering.
- **R-11 — Applebot may not respond to Wave A at all.** Its +254 % growth is
  anomalous for a 381-URL site, and the crawl-trap explanation, while
  well-evidenced, is not proven to be the *whole* explanation. WA-5 exists to
  detect that case rather than assume it away.

## 11. Decisions and open questions

### 11.1 Decisions taken (owner, 2026-07-31)

- **D-1 — Strategy is A → B, explicitly not C.** Close the crawl trap first
  (Wave A), then turn on the edge cache (Wave B). Do **not** block or throttle AI
  crawlers as a first move. Rationale: the owner wants AI visibility; A is the
  only lever that reduces load without surrendering any of it; and C treats the
  symptom. C is reconsidered only if WA-5's post-A measurement shows Applebot has
  not dropped materially.
- **D-2 — Googlebot's 151 requests/day is treated as a first-class concern**, not
  a footnote. Organic search is the revenue channel; Applebot and GPTBot are not.
  The working hypothesis — that Google throttled our crawl budget because of
  origin latency — must be confirmed in Search Console → Crawl stats (§5.8), not
  assumed.
- **D-3 — `robots.txt` must express exactly one policy** (WA-4). The current
  contradiction (§5.10) means neither the managed nor the app-side policy is in
  force, which is strictly worse than either choice. The specific GPTBot
  allow/deny call is made inside WA-4; it is informed by §5.10.1 —
  **blocking `GPTBot` does not remove the site from ChatGPT answers**, because
  `OAI-SearchBot` and `ChatGPT-User` are the agents that produce citations.
- **D-4 — `Applebot-Extended: Disallow: /` stays.** It is the Apple Intelligence
  training opt-out. It costs nothing and reduces no traffic (§5.10).
- **D-5 — Wave D (document weight) is promoted** from "nice to have" to a direct
  egress lever, on the strength of §5.9 (631 KB × 464k requests/day).

### 11.2 Still open

- **OQ-1** — Should HOS-128 be closed as superseded by this spec, or kept as a
  sub-scope? This spec absorbs its goal and adds causes it never contemplated;
  its "gated on real traffic" trigger is now overtaken by measurement. Owner
  decision, still pending.
- **OQ-2** — TTL values for the newly cached routes. The existing 300 s / 600 s
  (listings) and 300 s / 60 s (pricing) are unexamined defaults. Content that
  changes rarely (legal, `nosotros`) can take far longer.
- **OQ-3** — Accept the shared CSP nonce under caching, or move the affected
  pages to a hash-based inline strategy (HOS-164's subject)? Deciding "accept"
  is fine; deciding by omission is not.
- **OQ-4** — Is the VPS adequately sized? 3 vCPU / 7.9 GB hosting prod and
  staging of three apps plus Coolify, at 2.4–2.8 load average with 1.1 GB RAM
  free and 2.6 GB of swap in use. **Rev 2: not answerable until A and B land** —
  the current load is crawler-driven, so sizing cannot be judged against it.
- **OQ-5** — Should staging be moved off the production box entirely?
- **OQ-6** — The zone is on the **Free** plan (confirmed Rev 2). Does Free
  support the needed Cache Rule / Redirect Rule count? Tiered Cache and Cache
  Reserve are paid features and are **not** available at this tier — if either is
  wanted, that is a plan-upgrade decision.
- **OQ-7** — Is the `hospeda_vid` cookie churn worth fixing? The SSR client does
  not return the cookie the API sets, so the API mints a new visitor id on every
  internal call — ~38/second (§12.2). Harmless for caching (the web origin sets
  no cookies of its own) but it makes `hospeda_vid` useless as an analytics
  dimension and adds a `Set-Cookie` to every API response.

## 12. Implementation notes

### 12.1 Measurement methodology

All measurements taken 2026-07-31 from Buenos Aires against the EZE Cloudflare
PoP. Headers via `curl -D -` on canonical URLs. Timings are
`curl -w '%{time_starttransfer}'`, three samples where variance was observed.
Asset weights measured by downloading each file from production with and
without `Accept-Encoding: br`. HTML composition by parsing the real document
and measuring each block. Cross-environment comparison by downloading the same
component from prod and staging. VPS data via SSH: `docker stats`,
`/proc/loadavg`, `docker inspect`, five samples spaced 8 s with no traffic
generated during the window.

Reproducing any of these is a single `curl`; the spec deliberately records the
exact commands' outputs rather than summarizing them, so the baseline can be
re-verified independently after each wave.

### 12.2 Where static analysis was wrong, in both directions

Worth internalizing beyond this spec: **for bundle questions, measure the
served artifact.** Import-graph grep misled in both directions here.

- **False positive.** Static analysis concluded the i18n barrel ships all three
  locales to the browser (`webTrans` does build `es`+`en`+`pt` in
  `config.shared.ts`). Inspecting the actual chunks found zero translated
  strings; the shipped payload is single-locale and lives in the HTML. HOS-160
  lever A worked as designed.
- **False negative.** No file in `apps/web/src` imports `@repo/config` — grep
  returns nothing. The full env registry is nonetheless in the production
  bundle, verified byte by byte.

The decisive technique for separating "code bug" from "stale production" was
downloading the *same component* from both environments and diffing size and
marker counts.

- **Rev 2, a third miss — and this one was mine, mid-diagnosis.** With the CPU
  pegged and no logs, the obvious hypothesis was a spin loop, and two plausible
  suspects turned up immediately: a `setInterval(i,50)` in the bundle and a
  `while (resolvedStore.size >= MAX)` in `ssr-cache.ts`. Both were wrong. The
  interval was in the **client** bundle (`/app/dist/client/_astro/client.*.js`),
  never executed by the server; the `while` has a `break` on an empty store and
  cannot hang. Grepping source for loop-shaped code finds loop-shaped code, not
  the loop that is running. What actually settled it was following the process
  outward — thread-level CPU, then open sockets, then the API's own logs, then
  the CDN's crawler analytics.
- **A near-miss worth recording.** 300 consecutive API requests carried 300
  distinct `vid` values, zero repeats. The tempting read was "cookie-less bots".
  Wrong: `hospeda_vid` is minted by the API and the SSR client never returns it,
  so a fresh id per internal call is structural and says nothing about the
  inbound caller. It did surface a genuine side finding (OQ-7).

### 12.3 Order dependencies

```
WA-1 + WA-2 + WA-4 ─── do together; robots.txt and nofollow cover different gaps
WA-3               ─── verification only, no new logic
WA-1..4 → WA-5     ─── measure 48–72 h after; crawlers must re-read robots.txt
WA-5               ─── the ONLY trigger for reconsidering strategy C
WA-*  → WB-*       ─── A before B: unnormalized query strings fragment the cache
W0-2 (promote)     ─── independent, do early, parallel to A
W0-3 → W0-4        ─── understand before guarding
WB-1 (purge)       ─── HARD prerequisite of WB-2
WB-2 → WB-3        ─── never ship the rule without the verification
WB-3 → WB-4        ─── redirects after the cache is proven correct
WC-4               ─── requires the SSR personalization move first
WD-5               ─── blocked on HOS-164 / HOS-168 CSP resolution
```

Note the wave labels changed in Rev 2 (0/1/2/3 → A/0/B/C/D). Task ids inside the
carried-over waves kept their original `W1-*`/`W2-*`/`W3-*` numbering to avoid
breaking references; read `W1-*` as Wave B, `W2-*` as Wave C, `W3-*` as Wave D.

### 12.4 Related work

- **HOS-128** — edge-cache anonymous catalog. Absorbed; see OQ-1.
- **HOS-168** — CSS/JS/HTML weight. Wave 3 is its body of work.
- **HOS-160** — perf levers. Shipped A (i18n single-locale), C (`/_image`
  cache), D (`/auth/me` dedup). Left F (conditional Cloudinary preconnect) and
  both halves of B (CSS) undone.
- **HOS-359** — actor-blindness audit of ~30 cached public API routes.
  Prerequisite for any API-level edge caching (NG-3).
- **HOS-297** — purge burst coalescing. Done; not the same as selectivity.
- **HOS-218** — the bugfix under which `listing-cache.ts` actually shipped.
- **HOS-103** — internal-request rate-limit exemption, already in place.

## 13. Linear

Canonical tracking:
HOS-369
