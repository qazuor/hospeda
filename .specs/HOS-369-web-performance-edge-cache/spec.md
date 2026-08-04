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

### Rev 3 — 2026-08-01: purge-by-URL is a dead end, and the SSR must go auth-blind

Wave A shipped and is live in production (§0.1 below). Preparing Wave B's
selective purge (W1-1) surfaced three findings that invalidate part of the Rev 2
plan and add a wave that Rev 2 had scattered across Wave C.

What changed in this revision:

- **W1-1 as written cannot work.** Rev 2 said "replace `purge_everything: true`
  with `files: [...]`". Two independently fatal problems: the path mapper emits
  URLs that do not exist for the default locale, and on the **Free** plan the
  query string cannot be removed from the cache key, so purge-by-URL can never
  reach the `?page=`/`?sortBy=` variants that the origin marks cacheable. The
  purge contract moves to **cache tags**. See §5.11.
- **Auth-blind SSR is promoted from a Wave C task (old W2-4) to its own wave
  (Wave B0), and re-scoped.** An audit of all 27 public content pages, ~37
  components and the client-side session machinery found the conversion is far
  cheaper than Rev 2 assumed — but also that Rev 2 aimed it at the wrong file
  set. See §5.12.
- **OQ-3 (shared CSP nonce) is decided, and it is a hard prerequisite**, not a
  footnote. It blocks Wave B for every page, not just the ones being
  de-personalized. See §5.13 and D-9.
- **Ordering changed on a risk argument, not a value argument.** Rev 2 deferred
  the de-personalization because the traffic is ~100 % bots and the performance
  payoff is therefore ≈0 today. The owner overrode this: the blast radius of the
  migration is proportional to the number of authenticated users it can break,
  and that number is ≈0 right now. See D-10.

Rev 1's §5.1–§5.7 and Rev 2's §5.9–§5.10 measurements are unchanged and still
valid.

#### 0.1 Wave A — shipped

| Task | Commit | Notes |
|---|---|---|
| WA-1 | `edf33948d` | facet crawl policy |
| WA-2 | `21a61497c` | `rel="nofollow"` derived from the href, never a per-caller prop |
| WA-3 | `cf134f690` | query-free canonical on facet URLs |
| AC-A3 | `1c8aa7085` | non-vacuous robots.txt root-conflict guard |
| WA-4 | `3921e17f3` | single reconciled crawler policy |
| fixture | `9be1a1f3e` | fixture corrected against the live file |

PR #2551 → `staging`; PR #2552 → `main` (`616bf1613`). Live: 414-line
`robots.txt`, 280 facet rules, no contradictions, Cloudflare's managed block
disabled. **WA-5 measured 2026-08-03: Wave A worked.** Applebot — the clean
signal, still unblocked — fell **326,810 → 1.2 k (−99.6 %)**; total crawl
traffic **464 k → ≈2 k (−95.5 %)**; egress **83.7 GB/day → ≈21 MB/day**. The
trigger to reconsider strategy C did not fire; D-1 stands. Full table and
caveats in §6.1 (WA-5).

> Read WA-5 correctly: GPTBot is now `Disallow: /`, so its drop proves nothing
> about the crawl trap. **Applebot is the clean signal** — still allowed, so it
> can only fall because the combinatorial tree closed.

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

### 5.5 Purge is still whole-zone — RESOLVED by W1-1 (2026-08-03)

> **Status.** Everything below described the state before W1-1. It shipped:
> `/api/revalidate` now purges `{ tags }` (or `{ purgeEverything: true }` behind
> an explicit flag), `entity-path-mapper.ts` is deleted, and
> `revalidation_log.path` is now `target`. Kept as written because it is the
> record of WHY, and because §5.11's reasoning still governs W1-2.


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

> **Rev 3 — do not act on the paragraph above.** "Wire the existing mapper into
> the purge" was the Rev 2 plan and it does not work: the mapper emits redirect
> URLs for the default locale, and exact-URL purge cannot reach the cacheable
> query-string variants at this plan tier. The mapper is **deleted**, not wired.
> See §5.11 and D-6.

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

### 5.11 Purge-by-URL is a dead end on this plan (Rev 3)

> Method: read the installed source of the purge path on 2026-08-01
> (`apps/web/src/pages/api/revalidate.ts`,
> `packages/service-core/src/revalidation/**`), then checked every limit against
> the live Cloudflare documentation rather than from memory. Facts below are
> quoted from the docs, not inferred.

Rev 2's W1-1 ("replace `purge_everything: true` with `files: [...]`") fails for
two independent reasons. Either one alone would sink it.

#### 5.11.1 The path mapper emits URLs that do not exist

`entity-path-mapper.ts:463` ends with:

```ts
export function getLocalizedPath(path: string, locale: string): string {
    if (locale === 'es') return path;      // '/alojamientos/'  ← no prefix
    return `/${locale}${path}`;
}
```

But `apps/web/src/pages/` contains **only** `[lang]/` for content routes.
`pages/index.astro` is 44 bytes: `Astro.redirect('/es/', 301)`. There is no
`/alojamientos/` route — it is a 301 to `/es/alojamientos/`.

So for `es` — the default locale and effectively all human traffic — the mapper
produces **redirect URLs, not content URLs**. Under `purge_everything` this is
invisible. Under selective purge, every Spanish path would purge a URL that was
never cached, and Cloudflare would return `200 success` for it.

This is a **latent bug that only detonates on the change that was supposed to be
an improvement** — the same shape as HOS-370 (a race that only surfaced once a
deploy reordered module loading). It is not a reason to abandon selectivity; it
is a reason to distrust a 466-line hand-maintained duplicate of the routing
table. See D-6.

#### 5.11.2 On the Free plan the query string cannot leave the cache key

| Purge method | Per request | Rate (account) | Available on Free |
|---|---|---|---|
| By URL (single-file) | 100 URLs | 800 URLs/s | Yes |
| By prefix / tag / hostname / everything | 100 ops | **5 requests/min** | Yes |

All five purge methods became available on every plan on **2025-04-01**
(Cloudflare changelog, *"All cache purge methods now available for all plans"*).
Purge by tag is no longer Enterprise-only — this is the fact that unlocks the
design in §6.3.

But **cache-key customization did not follow**. `Ignore query string` and
`No query parameters except` remain Enterprise (the former also Pay-as-you-go).
On Free only **Sort query string** is available.

That is decisive, because `listing-cache.ts` deliberately marks bounded
query-string variants as cacheable — `page`, `sortBy`, `sortOrder`, `checkIn`,
`checkOut`, `type`, `types` are all in `NON_FILTERING_PARAMS`. So the cache
*will* contain `?page=2`, `?sortBy=price` entries, the cache key *will* include
the query string, and exact-URL purge can **never** reach them. This is not a
tradeoff we can choose to accept later and fix; on this plan it has no fix.

Purge by tag invalidates on what a response *contains*, regardless of its URL.
It is the only method that closes this hole at our tier.

#### 5.11.3 A Cache Rule that matches only `GET` silently defeats single-file purge

From the Cloudflare docs (*Purge By Single File → Limitations*): a Cache Rule
whose expression matches on `http.request.method eq "GET"` **will not match
during a purge**, because the purge request is not a GET. The documented fix is
to match `(... and (http.request.method eq "GET" or http.request.method eq
"PURGE"))`.

This applies to the Cache Rule regardless of which purge method we choose, and
the failure mode is a purge that reports success and does nothing. Captured as
an explicit requirement in §7.2.

#### 5.11.4 Prefix purge was considered and rejected

Prefix purge would cover the query-string variants too. It is rejected because
it over-purges catastrophically: purging `/es/alojamientos/` also evicts every
accommodation detail page under it — precisely the finite, high-value, expensive
-to-render surface the cache exists to protect. Tags give the same coverage with
none of the collateral.

#### 5.11.5 Does Free honor a `Cache-Tag` header from an ORIGIN? (RESOLVED — yes, measured 2026-08-03)

> **Outcome: YES.** Cloudflare honors an origin-emitted `Cache-Tag` on the Free
> plan, and purge-by-tag evicts it. The fallback below is NOT needed and the
> emitter side stays exactly as built. **W1-2 is unblocked.** The measurement
> and the method that actually proves it are in §5.11.6; the original open
> question is preserved below because the reasoning is what made it worth
> testing rather than assuming.

> Method: re-read the live Cloudflare docs on 2026-08-03 while implementing
> W1-1 — the purge-cache overview, the purge-by-tags page, and the Workers
> cache configuration page.

Everything §5.11.2 claims about the purge METHODS holds. What no page states is
whether the `Cache-Tag` **response header emitted by an origin server** — as
opposed to one set inside a Worker — is honored on the Free plan. The
2025-04-01 changelog universalized the five purge *methods*; it says nothing
about the header, which was historically Enterprise-only.

The circumstantial case that it works is decent: purge-by-tag on Free would be
useless without an origin-side way to attach tags, and Cache Response Rules
(available on Free, 10 rules) exist to set cache tags on responses. But that is
inference, and the failure mode is the silent one §5.11.3 warns about — the
purge returns `200 success` and evicts nothing.

**This must be verified empirically before the Cache Rule opens** (W1-2), and
it is cheap: scope a Cache Rule to one probe path, confirm `CF-Cache-Status:
HIT`, purge by that response's tag, confirm the next request is a `MISS`. If it
fails, the fallback is a Cache Response Rule that copies a first-party origin
header into `Cache-Tag` — the emitter side stays exactly as built either way.

#### 5.11.6 The measurement, and why the test above was not sufficient

> Method: executed against `staging.hospeda.com.ar` on 2026-08-03, immediately
> after W1-1 + the environment namespace were deployed there.

Setup: one Cache Rule scoped to
`(http.host eq "staging.hospeda.com.ar" and http.request.uri.path eq "/llms.txt")`,
action *Eligible for cache*, Edge TTL **ignore the origin `cache-control`, use
120 s**. Overriding the TTL is not incidental — it bounds the whole experiment,
and the origin's own `max-age=3600` would have made it unrunnable. Blast radius:
one staging URL, one zone-shared config row, no production path.

The purge went through the REAL chain — `POST /api/revalidate?secret=…` on the
staging web app, the same endpoint `CloudflareRevalidationAdapter` calls and the
only process holding the Cloudflare credentials — with
`{"tags":["preview:site-config"]}`, answering `200 {"ok":true,"purged":1}`. That
the endpoint ACCEPTED the namespaced tag instead of rejecting it (§7.3) is a
second result: the purger and the emitter agreed on the namespace.

| Condition | Terminal status | `age` at reset |
|---|---|---|
| Control, no purge | **`EXPIRED`** | ~120 s (the configured TTL) |
| After purge-by-tag | **`MISS`** | ~70 s, 5-8 s after the POST |

**`EXPIRED` vs `MISS` is the discriminator, not the `age` reset.** §5.11.5's
proposed test — "confirm the next request is a `MISS`" — is NOT sufficient, and
following it literally produced a false positive on the first attempt: a `MISS`
observed after several minutes of unrelated debugging looked like proof, but the
elapsed time had exceeded the TTL, so the object would have dropped out on its
own. Cloudflare reports a natural TTL expiry as `EXPIRED` and an explicit
eviction as `MISS`, so the STATUS is what carries the signal. Two further
controls are required for the result to mean anything:

- **Bound the sequence inside the TTL.** Print the elapsed seconds between the
  confirmed `HIT` and the post-purge probe; if it approaches the Edge TTL the
  run proves nothing and must be repeated.
- **Pin the PoP.** Cache is per-PoP, so a `MISS` served from a different edge is
  a false negative. Every probe above reported `cf-ray … -EZE`.

Purge propagation was **not instantaneous**: a probe 3 s after the POST still
returned `HIT age 70`; the eviction landed within ~5-8 s. Any automated check
that asserts a `MISS` immediately after purging will flake.

Incidental findings from the same session: the zone is on the **`free`** plan
(dashboard badge) and had **0 Cache Rules and 0 Cache Response Rules** before
this probe — consistent with the `DYNAMIC` measured everywhere in §2.3 — and
both rule types are in fact available on Free, so the §5.11.5 fallback would
have been viable had it been needed.

### 5.12 The auth-blind SSR audit (Rev 3)

> Method: three parallel read-only audits on 2026-08-01 — (1) all 27 public
> content pages under `alojamientos|destinos|eventos|publicaciones|experiencias|
> gastronomia`, (2) all ~37 components accepting session-derived props, (3) the
> existing client-side session/favorites machinery. Findings below are quoted
> from source with line numbers, not summarized from grep counts.

Rev 2 treated this as one Wave C task (old W2-4, "accommodation detail — the
hard case"). The audit shows the scope was both wider (27 pages, not 1) and
much shallower (only 2 files are genuinely hard).

#### 5.12.1 The blocking surface, classified

| Class | What it is | Files | Conversion cost |
|---|---|---|---|
| **B** — boolean flag | `isAuthenticated` threaded to components | ~14 | **None.** The flag becomes inert once every visitor gets the same HTML; components receive `false` and self-correct, exactly as a guest does today |
| **A** — personalized data | `checkBulk` / `checkStatus` / `currentUserName` baked into props | ~11 | Mechanical: move the fetch to post-hydration |
| **C** — branching markup | the component *tree* differs by session | **2** | Real work — see below |
| **D** — the cache gate itself | `cacheable: !isAuthenticated && …` | 3 | **Disappears by construction** |

All five class-C instances live in two files:

- `alojamientos/[slug].astro` — `{isAuthenticated && <AiChatWidget/>}` (697),
  `{… && <PriceAlertButton/>}` (720), `{… && <ReviewSidebarCard/>}` (762)
- `destinos/[...path].astro` — `isAuthenticated ? <DestinationReviewSidebarCard/>
  : <DestinationReviewSignInCta/>`, twice (677, 844)

**There is not one session-based redirect anywhere in the audited scope.** Every
`Astro.redirect` in those six directories is pagination canonicalization. A
session-driven redirect would have made these pages uncacheable outright; there
are none.

#### 5.12.2 The leverage point is one line

Most of the ~37 components decide nothing: 6 detail headers, 7 card types and 4
map components merely forward `isAuthenticated` to `FavoriteButton`. The root is
`FavoriteButton.client.tsx:236`:

```ts
if (!needsHydration || !isAuthenticated || hydrationFiredRef.current) return;
```

The client-side self-correction is itself gated on the SSR-baked prop, so a
component told "anonymous" can never recover. Fixing this one guard fixes ~17
components at once.

Six components gate **content**, not an icon, and none re-checks:
`ContactHost`, `CommentThreadIsland`, `SearchChatPanel`/`AiSearchEntry`,
`ExperienceReviews`, `GastronomyReviewForm`, `CompareModeToggle`. For a
logged-in visitor served a cached anonymous page these hide real functionality
(the contact form's authenticated mode, the comment form, AI search) with no
error and nothing in the logs.

#### 5.12.3 Nothing needs to be invented

The pattern already exists and already runs in production:

- `apps/web/src/lib/auth-cache.ts` — `fetchAuthMe()` against
  `GET /api/v1/public/auth/me` with `credentials: 'include'`, in-flight request
  dedup, 60 s `sessionStorage` cache. Consumed today by `UserMenu`,
  `MobileMenu`, `HostLandingCta`, `NewsletterForm`, `AuthedPreferenceSync`.
- `use-account-permissions.ts` — treats the SSR prop as a **hint**, trusts the
  cache only when it agrees with that hint, otherwise refetches.
- `NewsletterForm.client.tsx` is the exemplar: it corrects in **both**
  directions — downgrades on an expired session and **promotes** when SSR said
  guest but the real session is authenticated. That second direction is exactly
  the "cached anonymous HTML served to a logged-in user" case.
- `userBookmarksApi.checkBulk` already works unmodified from the browser; its
  `cookieHeader` parameter is documented as SSR-only and optional. It is simply
  never called client-side today.
- Rate budget: the governor is a global **200 req/60 s per user across all**
  `/api/v1/protected/*` (`apps/api/src/routes/index.ts:414-421`). One `/auth/me`
  plus one `check-bulk` per page load is noise.

Two things genuinely do not exist and must be built: a **shared favorites
store** (without it, 24 cards hydrate with 24 individual `/check` calls instead
of one bulk call — template: `apps/web/src/store/compare-store.ts`), and a
**static guard** asserting no cacheable page bakes session state.

`publicaciones/index.astro` is the existence proof: it is the one listing page
with **no** SSR bulk-check, and its cards self-hydrate today.

#### 5.12.4 Do not solve this with Server Islands

Already tried and reverted. `MobileMenuIsland` was `server:defer`; because it
mounts on every page, each page view fired an extra `get-session` request and
flooded the API's auth rate-limit bucket (50/5 min per IP). It was moved to the
client-reconciliation pattern instead. `server:defer` now appears exactly once in
the app (`NextEventsSection`), and inside any Server Island the middleware forces
`Astro.locals.user = null` (`middleware.ts:166`).

#### 5.12.5 This does not violate the SSR-first island rule

`apps/web/CLAUDE.md` requires an island's SSR output to already contain its final
critical data, because crawlers do not run JS. That rule protects **indexable
content** — prices, counts, ratings, badges. Per-user state is by definition not
crawler-relevant: **a crawler is never logged in**. Moving favorite/session state
to post-hydration is compatible with the rule, not an exception to it.

### 5.13 The cached CSP nonce (Rev 3 — resolves OQ-3)

Every HTML response carries a per-request CSP nonce: `BaseLayout.astro` — the
shell of every page — threads `Astro.locals.cspNonce` into `FontsLoader`,
`ThemeFoucScript`, `I18nClientData`, `PostHogScript` and `GlobalAnnouncements`,
and middleware step 9 emits the matching `Content-Security-Policy` header.

Cloudflare caches headers with the body, so **nothing breaks**: the header nonce
and the body nonce stay paired. What breaks is the guarantee. For the TTL the
nonce becomes a static, publicly readable token — anyone can `GET` the page,
read it, and reuse it. That collapses the inline-script protection that HOS-30
Phase 2 was built to provide, for whatever injection vector exists.

This was **already documented** in `apps/web/docs/seo/rendering-strategy.md:94`
as a known consequence of HOS-128, with the escape hatch already named
(*"or move those to a hash-based inline strategy"*). Rev 3 does not discover it;
it decides it (D-9).

#### 5.13.1 Why "just use hashes" is not the rejected option

The instinct to reach for hashes has been evaluated and rejected **twice** —
SPEC-046 (`research/astro-csp-options.md`, 2026-05-16) and HOS-124 (canceled).
Both were evaluating **Astro's native `security.csp`**, which is hash-based, and
both rejected it for the same blocking reason:

- **Astro's native CSP does not support `<ClientRouter />`**, which `BaseLayout`
  uses on every page. Astro added that support and then **removed** it
  (`76c5480` / #13914, June 2025 — view transitions had to become async, which
  broke users). No timeline for its return.
- The policy moves to `<meta http-equiv>`, which cannot carry `report-uri`.
- `security.csp` is build+preview only — **dev mode loses CSP coverage entirely**.
- External SDK URLs (Sentry, MercadoPago) need manual hash entries per build.
- Shiki is unsupported; `'unsafe-inline'` is incompatible.

Which is why SPEC-046 chose Path A2 and the repo has a hand-written nonce
injector (`apps/web/integrations/csp-nonce-injector`, imported by
`middleware.ts:22`).

**What Rev 3 proposes is not that.** It keeps middleware as the single CSP
source, keeps `report-uri`, keeps `<ClientRouter/>`, keeps dev coverage, and
never enables `security.csp`. It changes only what our **own** injector stamps:
instead of *add a `nonce` attribute and put the nonce in the header*, compute the
`sha256` of each inline script's content and put that hash in the header. None
of the five blockers above applies, because none of them is about hashes as
such — they are all about Astro's implementation of them.

It also has a property nonces lack under caching: **the hash is derived from the
content, so header and body cannot desynchronize**, cached or not.

Cost we keep paying: it is our own integration, maintained by us. That is already
true today.

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

**WA-5 — Measure the effect before doing anything else. DONE 2026-08-03 — Wave A worked; C stays rejected.**
Re-read AI Crawl Control after 48–72 h (crawlers must re-read `robots.txt` and
drain their queues). Record the new per-crawler numbers against the §5.9
baseline. **If Applebot has not dropped materially, that is the trigger to
reconsider C** — with data, not preemptively.

> Measured 2026-08-03, AI Crawl Control → Métricas, **last 24 h (GMT-3)**, same
> window shape as the §5.9 baseline.

| Crawler | §5.9 baseline (07-31) | Now (08-03) | Change |
|---|---:|---:|---|
| **Applebot** — the clean signal | **326,810** | **1.2 k** | **≈ −99.6 %** |
| GPTBot | 136,990 | not in top 5 | now `Disallow: /` |
| Googlebot | 151 | 63 | — |
| Baidu | 156 | 159 | flat |
| Claude-SearchBot | — | 15 | — |
| OAI-SearchBot | in "+2" | 7 | — |
| **Total requests** | **464,000** | **≈ 2 k** | **−95.48 %** |
| **Egress** | **≈ 83.7 GB/day** | **≈ 21 MB/day** | **≈ −99.97 %** |

Per-crawler egress now: Applebot 12.04 MB, Googlebot 3.92 MB, Baidu 3.81 MB,
OAI-SearchBot 1.15 MB, ChatGPT-User 552 kB. Monthly projection falls from
≈2.5 TB to well under 1 GB.

**Verdict: the trigger did NOT fire. Strategy C is not reconsidered; D-1 stands.**

Read it the way §3's note instructed. GPTBot's disappearance proves nothing —
it is explicitly `Disallow: /` in the live file, alongside ClaudeBot,
anthropic-ai, CCBot, Applebot-**Extended**, Amazonbot, Bytespider,
meta-externalagent and CloudflareBrowserRenderingCrawler. **Applebot carries the
signal**: it is NOT blocked (only its `-Extended` training variant is), it was
free to crawl exactly as before, and it still fell 99.6 %. The only thing that
changed for it is that the ~280 facet `Disallow` rules closed the combinatorial
URL space.

That is direct confirmation of §5.9.1's diagnosis — the volume was a
self-inflicted crawl trap, not legitimate demand — and it **refutes R-11**
("Applebot may not respond to Wave A at all"). The 857-fetches-per-URL-per-day
figure is now ≈3, which is ordinary.

Two caveats worth carrying forward rather than declaring victory:

- **The load is gone, but the cache is not built yet.** Wave B remains
  justified on its own terms (origin CPU, TTFB, egress on *human* traffic); it
  simply no longer has a crawl storm to absorb. Do not read this as licence to
  descope B.
- **Googlebot fell too (151 → 63)**, and Googlebot is the revenue channel (D-2).
  Some of that is the same facet closure removing junk URLs it was wasting
  budget on, which is the intended outcome — but D-2's requirement stands: this
  must be confirmed in Search Console → Crawl stats, not inferred from this
  panel.

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

### 6.3 Wave B0 — make the origin cacheable (Rev 3, new)

Everything in Wave B is inert until the origin emits a response that is (a) safe
to share and (b) invalidatable. Wave B0 is that work. It absorbs Rev 2's old
W2-4 and re-scopes it (§5.12).

**WB0-1 — CSP: nonce → content hash.** Modify
`apps/web/integrations/csp-nonce-injector` to compute a `sha256` per inline
script/style and emit those as `script-src`/`style-src` sources from
`buildCspHeader()`, instead of stamping a per-request nonce. Middleware stays
the single CSP source; `security.csp` is **not** enabled; `<ClientRouter/>`,
`report-uri` and dev coverage are untouched (§5.13). Blocks every other Wave B
task — it applies to all pages, not only the de-personalized ones.

**WB0-2 — Shared favorites store.** New client store on the
`store/compare-store.ts` template: one `checkBulk` per page load, shared across
every `FavoriteButton` island on the page. Without it, de-personalizing a
24-card listing trades one SSR bulk call for 24 client `/check` calls.

**WB0-3 — `FavoriteButton` reconciles.** Remove the SSR-prop gate at
`FavoriteButton.client.tsx:236` and adopt the `use-account-permissions` contract
(SSR prop is a hint; always re-resolve; correct in **both** directions, per
`NewsletterForm`). Fixes ~17 pass-through components — 6 detail headers, 7 card
types, 4 map components — with one change.

**WB0-4 — The six content-gate components.** `ContactHost`,
`CommentThreadIsland`, `SearchChatPanel`/`AiSearchEntry`, `ExperienceReviews`,
`GastronomyReviewForm`, `CompareModeToggle`. Same pattern, copied.

**WB0-5 — Strip SSR personalization from the listings and the four mechanical
detail pages.** The ~11 class-A pages plus the class-B threading. `eventos`,
`publicaciones`, `experiencias`, `gastronomia` detail pages are class A/B only —
mechanical. Mostly deletion. Watch for `currentUserName`, which is personalized
data hiding behind a name that does not look like `isAuthenticated`
(`eventos/[slug].astro:272`, `publicaciones/[slug].astro:411`).

**WB0-6 — The static guard.** A test that fails if any page emitting a cacheable
`Cache-Control` also reads `Astro.locals.user`, or if `FavoriteButton`'s
reconciliation is re-gated on an SSR prop. Non-negotiable: the audit found
`currentUserName` only because a human went looking, and vigilance does not
survive three months. Must be non-vacuous — prove it fails when the guarded
property is removed, per the HOS-370 precedent.

**WB0-7 — The two hard files. DONE.** `alojamientos/[slug].astro` and
`destinos/[...path].astro` (§5.12.1, §5.4). Five class-C instances plus the
accommodation detail's conversations / price alerts / entitlements / WhatsApp
lookups. It was the only part of Wave B0 that needed design rather than pattern
application. Rendering rule in D-11.

How each class-C instance was resolved, all three following one shape — the
island is always mounted, the ANONYMOUS variant is passed to it as slot
children, and the island swaps itself in only after resolving a session:

- **`destinos` (2 swap sites).** `DestinationReviewSidebarCard` now takes
  `children` and renders them until `useAccountPermissions` resolves a user;
  the page passes `DestinationReviewSignInCta`, which is what the server emits.
- **`alojamientos` sidebar (2 additive sites).** `PriceAlertButton` and
  `ReviewSidebarCard` do the same, with a new shared `SignInCtaCard.astro` as
  the anonymous variant. D-11 asked for "a correctly-sized placeholder"; an
  equally-sized sign-in CTA is strictly better, because a placeholder that
  COLLAPSES for a guest costs a layout shift on ~100% of cached traffic, which
  is the metric this spec exists to improve (**owner decision**, and the
  pattern `destinos` already shipped).
- **`AiChatWidget` (1 additive site).** No placeholder: the FAB and panel are
  both `position: fixed`, so appearing after hydration moves nothing.

Two per-visitor lookups moved to the browser rather than being dropped:
`priceAlertsApi.list` + `billingApi.getEntitlements`
(`use-price-alert-gate-state.ts`), and the conversations lookup that feeds BOTH
`ContactHost.existingConversationId` and `ReviewSidebarCard.canLeaveReview`. The
latter got its own store (`accommodation-conversation-store.ts`) for the reason
the SSR version was collapsed into one call in the first place: the two islands
hydrate in different ticks, so a result-only cache would still issue two
requests. Caching the in-flight **promise** keeps it at one.

**Not in the original scope, found here: the WhatsApp number.** §5.4 listed the
"WhatsApp lookups" as page state to move, which undersold it. The SSR lookup put
a specific viewer's *entitled phone number* in the page body — on a page destined
for a shared cache, meaning it would have been served to every subsequent
visitor, entitled or not, for the whole TTL. `WhatsAppContact` therefore became
an island (`.astro` → `.client.tsx` + CSS module, HOS-314's contrast rationale
carried over verbatim) that renders the upsell on the server and only ever shows
a number the protected endpoint returned to that viewer personally.

### 6.4 Wave B — turn on the edge

**W1-1 — Selective purge by cache tag (prerequisite, not follow-up). DONE
(2026-08-03, PRs #2575 + the purge-side PR).**

Shipped in two halves, emission before purge — tags nobody purges by are
inert, while purging by tags nobody emits is a silent no-op against a live
cache. What landed, and the four things that differ from the plan below:

- **`@repo/cache-tags`**, a new dependency-free package, is the single
  vocabulary both sides read. Anything it imported would be pulled into the web
  client graph, hence the zero dependencies.
- **The tag vocabulary in §7.3 would not have purged anything.** It specifies
  `accom-<id>`, but all ~40 revalidation call sites pass `slug`; only the
  plan-remediation paths pass `id`, and they fall back to an id-only event when
  the slug lookup fails. Emitting one and purging by the other purges nothing,
  silently. Resolved by emitting BOTH tags per entity — a few dozen bytes
  against a 16 KB header budget.
- **Four cacheable responses bypass middleware entirely**: `robots.txt`,
  `llms.txt`, the sitemaps and the RSS feeds, because `isStaticAssetRoute`
  short-circuits on the `.txt`/`.xml` extension. They set `Cache-Tag`
  themselves. A static guard found them; without it the sitemap would have
  shipped stale for 24 h with nothing able to evict it. `/api/og` is exempt and
  needs no tag: it is content-addressed by construction, since every input that
  changes the image is a query param and the query string is in the cache key.
- **`revalidateByEntityType` no longer enumerates published rows.** The
  collection tag covers every listing surface for a type, and walking hundreds
  of rows would blow past the 5-requests-per-minute tag-purge ceiling. Each
  entity purges its own tag from its own write hook. This is a deliberate
  narrowing of the cron backstop, not an oversight.

**Two gates remained before W1-2. Both cleared on 2026-08-03:**

1. ~~**§5.11.5** — verify empirically that Free honors an origin-emitted
   `Cache-Tag` header. The failure mode is silent.~~ **PASSED** — measured, see
   §5.11.6. Free honors it; purge-by-tag evicts within ~5-8 s. No fallback
   needed.
2. ~~**Audit the live `revalidation_config` rows.**~~ **PASSED, clean.** Queried
   prod directly (`hops --target=prod psql`): all 8 baseline rows present, none
   with `enabled = false`, and `tag` + `amenity` carrying
   `auto_revalidate_on_change = false` exactly as seeded — no drift, every row
   still on the original seed `updated_at`. The consequence below is therefore
   accepted rather than discovered: an amenity or tag write invalidates nothing
   until the next write of another type or the 24 h cron. Under
   `purge_everything` this was harmless — the next write of any type flushed the
   zone and corrected it within minutes.

   Note the audit is **wider than "rows set to false"**: the gate in
   `revalidation.service.ts` is three conditions, and the first is `if (!config)
   return` — an entity type with NO row invalidates nothing either. That is not
   reachable today only because `EntityChangeData` is a closed union over the
   same 8 types the seed creates. Adding a ninth entity type to that union
   without seeding its config row would silently disable its invalidation.

The original plan, for the record:

Emit `Cache-Tag` per response (entity ids + listing/collection tags + locale)
from an Astro middleware collector, and change
`CloudflareRevalidationAdapter` to POST the tags to `/api/revalidate`, which
purges `{ tags: [...] }` instead of `{ purge_everything: true }`. Keep a
whole-zone escape hatch behind an explicit flag for deploys.

This **replaces** Rev 2's "wire `getAffectedPaths()` into `files: [...]`", which
cannot work (§5.11). Tags also retire
`packages/service-core/src/revalidation/entity-path-mapper.ts` — 466 lines that
duplicate the routing table by hand, in a different package, and have already
drifted from it (§5.11.1). This wave deletes more code than it adds.

Budget check against the limits in §5.11.2: the revalidation service already
coalesces per-entity debounce buckets into a **single** flush per window
(`revalidation.service.ts`, `enqueuePurgeGroup`), so the 5 requests/min tag-purge
ceiling is not a constraint at our write volume.

**W1-2 — Cloudflare Cache Rule.**
Scope: `/{lang}/alojamientos*` and `/{lang}/suscriptores/{planes,turistas}*`
first — the routes that already emit a correct header — then **one path family
at a time** as WB0-5 proves each one auth-blind. Requirements, in order:

1. Make `text/html` eligible on those paths, honoring the origin
   `Cache-Control` rather than overriding it with an Edge TTL.
2. Match **`PURGE` as well as `GET`** in the rule expression, or single-file
   purge silently no-ops against it (§5.11.3).
3. **Bypass when a session cookie is present**: `better-auth.session_token` or
   `__Secure-better-auth.session_token`. Required until WB0-5 lands for that
   path; the origin-side `isAuthenticated` gate is not sufficient, because the
   edge cache key must reflect it too. Once a path is genuinely auth-blind the
   bypass becomes redundant — but it is removed only after that path is
   verified, never before.
   W1-2a (below) removed the shell's dependency on the session for the six
   cacheable families, so for those the bypass is now a belt-and-braces measure
   rather than the only thing standing between visitors. Drop it per path only
   after that path is verified by measurement (W1-3), never on this note alone.
4. Bypass on any query string carrying filters, to avoid fragmenting the cache
   across thousands of variants.
5. Turn **Sort query string** on — the only cache-key normalization available at
   this tier (§5.11.2).

**W1-2a — De-personalize the shell. DONE (landed with WB0-7).**
Discovered while extending the WB0-6 guard to `src/layouts` during WB0-7: the
guard only ever swept `src/pages` and `src/components`, so it certified 25 pages
as session-blind while the LAYOUT wrapping every one of them was not. On every
session-optional segment (which was every cacheable content path —
`alojamientos`, `destinos`, `eventos`, `publicaciones`, `gastronomia`,
`experiencias`), the shell baked:

- `BaseLayout.astro` — `<html data-user-authenticated>`, plus the visitor's id,
  e-mail and name forwarded to `FeedbackHeadlessHost`.
- `Header.astro` — the visitor's id, name, e-mail and avatar URL, as `UserMenu`'s
  SSR props.
- `Footer.astro` — the visitor's e-mail, as `NewsletterForm`'s SSR props. This
  one was invisible to the guard for a second reason: it reads
  `const locals = Astro.locals as { user?: … }`, an ALIASED read that neither the
  direct nor the destructured detector matched. A third detector was added.

Astro serializes island props into the document, so all of that was literal
text in the HTML — worse than anything Wave B0 removed, since it is PII rather
than UI state. Nor was the harm only at the far end: the first paint of a
cached page would show one visitor's name in another's header until
`useAccountPermissions` corrected it.

**The fix was structural, not per-component.** The obvious move — rewrite the
three layouts to render an anonymous shell — was rejected: `UserMenu` and
`MobileMenu` run the hook in *SSR-reconciling* mode, whose whole contract is
that the SSR snapshot is trustworthy, so the change would have cascaded into a
redesign of how those two resolve the session. But `Astro.locals.user` is only
populated at all on the segments listed in `SESSION_OPTIONAL_SEGMENTS`, and the
six catalog families were on that list for ONE reason: their pages needed the
visitor. Wave B0 removed every such read. So the six were removed from the list
instead, and the shell now gets `null` there by construction — no layout
change, no hook change.

Two consequences, both intended:

- The shell renders its guest variant on those routes; a signed-in visitor sees
  it for one frame until `UserMenu` resolves `/auth/me`. This is the behaviour
  that already applied on SSG/public routes and that `BaseLayout` and
  `MobileMenuIsland` both already documented. A cached page cannot know who you
  are — it is the cost of the cache, not a defect.
- Those six families stop issuing a `get-session` call per page view, on the
  highest-traffic paths in the app. The fix is also a measurable win.

The invariant is guarded by set intersection rather than source text, in
`test/lib/cacheable-routes-parse-no-session.guard.test.ts`: no cacheable route
family may appear in `SESSION_OPTIONAL_SEGMENTS`. That form was chosen because
the `Footer` read had escaped the text-matching guard for a whole wave — it
aliased the whole locals object (`const locals = Astro.locals as { user?: … }`)
rather than reading `Astro.locals.user`. A membership check cannot be defeated
by a spelling, and it covers every future consumer, not just the three layouts.

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

### 6.5 Wave C — extend the pattern across the catalog

> **Rev 3.** Wave C shrank. Its de-personalization tasks moved into Wave B0,
> which does them for the whole catalog at once rather than per-page:
> **old W2-4 → WB0-7**, and the personalization half of **W2-3 → WB0-5**. What
> remains here is the cache-header rollout for surfaces Wave B0 does not touch.

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

**W2-4 — Accommodation detail. → MOVED to WB0-7 (Rev 3).** Rev 2 scoped this as
one page; the §5.12 audit found the same blocker across 27 pages and a much
cheaper conversion than assumed. Kept here as a pointer so existing references
do not dangle.

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

### 6.6 Wave D — document weight

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

### 6.7 Documentation cleanup

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

**Rev 3 additions, both non-obvious and both silent when wrong:**

- The match expression MUST include `http.request.method eq "PURGE"` alongside
  `"GET"`. A `GET`-only expression does not match during a purge, so purges
  report success and evict nothing (§5.11.3).
- **Sort query string** ON. It is the only cache-key normalization available on
  Free; `Ignore query string` and `No query parameters except` are Enterprise
  (§5.11.2).

### 7.3 Purge contract (revised Rev 3)

`POST /api/revalidate?secret=…` changes from `{ purge_everything: true }` to
`{ tags: string[] }`. The whole-zone form stays available behind an explicit
parameter for deploy-time flushes.

**Tag vocabulary** (must be printable ASCII, ≤1024 chars each, ≤1000 tags per
response — Cloudflare limits):

> **As built (W1-1).** The table below was the plan; two rows changed. Both
> tags are emitted per entity — by SLUG **and** by ID — because the call sites
> are not consistent about which identifier they hold, and emitting one while
> purging by the other purges nothing (§6.4). Two page tags were also added
> that the plan did not anticipate. The vocabulary lives in
> `packages/cache-tags/src/vocabulary.ts`, which is the source of truth.

> **EVERY tag below is prefixed by its deployment environment** —
> `prod:list-accom`, `preview:home` — see §7.3.1. The table gives the bare
> vocabulary; the namespace is applied on top of it, symmetrically, in every
> environment including production.

| Tag shape | Emitted by | Purged when |
|---|---|---|
| `accom-<slug>` **and** `accom-<id>` (same for `dest-`, `event-`, `post-`) | any response rendering that entity | that entity is written |
| `list-accom` / `list-dest` / `list-event` / `list-post` | any listing containing that collection — including the facet landings, the sitemaps and the feeds | any member of the collection changes |
| `home` | the home page | anything featured on it changes |
| `pricing` | the four subscriber pricing/comparison pages | a billing plan is written |
| `site-config` | `robots.txt`, `llms.txt` | platform settings change |

The response-side collector is Astro middleware; the purge-side caller is
`CloudflareRevalidationAdapter`. `entity-path-mapper.ts` is **deleted** by this
change, not extended (D-6).

**As built**, two contract details the plan did not state:

- The whole-zone form is a **separate method** (`purgeEverything`) at every
  layer — adapter, service, HTTP body — not a flag on the tag path. A content
  write cannot reach a zone flush by accident, and reading a call site tells you
  which one it is. `POST /api/revalidate` rejects an ambiguous body
  (`{ tags, purgeEverything }` together) with a 400 rather than picking one.
- `revalidation_log.path` was renamed to **`target`** (migration
  `0070_volatile_freak.sql`, `RENAME COLUMN`, no data loss). It holds a cache
  tag, or `*` for a zone flush. `target` rather than `tag` because historical
  rows keep their URL paths.

Rev 2's `{ files: string[] }` form is rejected — see §5.11 for why it cannot
work at this plan tier.

Env vars: `HOSPEDA_REVALIDATION_SECRET` (required), `CLOUDFLARE_ZONE_ID` and
`CLOUDFLARE_API_TOKEN` (`web` app only), plus **`HOSPEDA_DEPLOY_ENV` — now
required on the `web` apps too**, not just the API (§7.3.1). Note the existing
silent-disable path: a missing `HOSPEDA_REVALIDATION_SECRET` falls back to
`NoOpRevalidationAdapter` with only a `logger.warn` (§5.5).

#### 7.3.1 Tags are namespaced by deployment environment

> Discovered and fixed on 2026-08-03, after W1-1 merged and before the Cache
> Rule opened. Verified by comparing `CLOUDFLARE_ZONE_ID` (sha256, without
> exposing it) inside all four containers.

`staging.hospeda.com.ar` and `hospeda.com.ar` are the **same Cloudflare zone**,
and the vocabulary above is byte-identical across deployments. Two consequences,
both dormant only because nothing was cached yet:

1. **Cross-environment eviction.** Any write in staging — a smoke run, a seed, a
   QA click — purges the identically-tagged objects cached for production, and
   vice versa. That directly attacks the hit rate this spec exists to raise.
2. **Shared quota, uncoordinated limiter.** Cloudflare's 5 purges/min is
   per-ZONE, but `MIN_PURGE_INTERVAL_MS` is enforced through
   `lastPurgeStartedAt` — instance state in process memory. Two API processes
   against one zone cannot coordinate, and over-quota no longer self-heals:
   pre-W1-1 it degraded to `purge_everything`, with tags it returns 429 and
   evicts nothing.

Resolution: every tag carries the deployment that produced it, symmetrically,
production included — `<env>:<tag>`, separator `:` (0x3A, already inside the
existing validity pattern, and unlike `-` it does not collide with slugs or
entity prefixes). Production is prefixed too because with nothing cached the
transition was free, and an unprefixed tag would otherwise mean "prod" only
implicitly. The environment comes from the existing `HOSPEDA_DEPLOY_ENV` and
reuses its established vocabulary (`prod | preview | dev | test`).

**The invariant, and where it is actually enforced.** If the emitter (web) and
the purger (API) derive different namespaces, purges match nothing and evict
nothing — silently. Both halves call one shared `resolveCacheTagEnvironment`,
but that only rules out CODE divergence, which was never the risk; the risk is
CONFIGURATION divergence between two processes, and that was the measured
state (the API had `HOSPEDA_DEPLOY_ENV`, the web apps did not). So
`POST /api/revalidate` **rejects any tag whose namespace is not its own** with a
400 naming both, turning a mismatch into a hard failure recorded in
`revalidation_log` on every write.

Deliberately **fail-closed, not fail-fast**: an unresolvable environment skips
tagging, responses demote to `private, no-cache`, and the site keeps serving
uncached. Throwing would take a public site down over a cache variable; guessing
`prod` would make staging evict production. Do NOT reuse `resolveEnvironment()`
from `@repo/media/server` here — its `NODE_ENV=production → 'prod'` fallback is
precisely the bug, since staging runs `NODE_ENV=production` too.

**Still open: `purgeEverything` cannot be namespaced.** Cloudflare has no
zone-scoped variant of a whole-zone flush, so a deploy-time flush from staging
still empties production's cache. Pre-existing, but consequential once the Cache
Rule opens.

## 8. UX / UI behavior

No intentional UI change. One behavior worth stating explicitly:

On a cached page, `Astro.locals.user` is always `null`, so the header renders
its logged-out state until `UserMenu`/`MobileMenu` hydrate and resolve the real
session. This is the existing, documented reason both are `client:load` rather
than `client:idle`. Extending caching to more routes widens the surface where
that brief wrong-state window is visible — it does not create a new one, but it
should be confirmed as acceptable on the newly cached routes.

> **Rev 3.** Wave B0 generalizes exactly this already-accepted pattern from the
> header to the rest of the page: favorites, contact-host mode, comment form, AI
> search, review CTAs. The window widens from "the header" to "every per-user
> affordance", so it stops being an incidental detail and becomes a deliberate UX
> contract — hence D-11 (anonymous branch is the server-rendered default,
> placeholders reserve space) and AC-B0-7 (CLS must not regress).

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

Wave B0 (added Rev 3):

- **AC-B0-1** — For a given catalog URL, the SSR HTML is **byte-identical**
  whether requested with or without a valid session cookie. Asserted by diffing
  two real responses, not by reasoning about the code. This is the single
  criterion that makes the cookie bypass redundant.
- **AC-B0-2** — On a **cached anonymous** page, a logged-in visitor sees their
  real favorites after hydration, and clicking a heart does **not** open the
  guest login popover. This is the exact failure the current
  `FavoriteButton.client.tsx:236` guard produces; it must be demonstrated fixed
  against a genuinely cached response, not a fresh render.
- **AC-B0-3** — The six content-gate components (§5.12.2) render their
  authenticated affordances after hydration on a cached anonymous page:
  contact-host authenticated mode, comment form, AI search panel, both review
  CTAs, compare mode.
- **AC-B0-4** — A listing of N cards issues **one** `check-bulk` after
  hydration, not N `/check` calls. Asserted on the network log.
- **AC-B0-5** — WB0-6's guard fails when session state is reintroduced into a
  cacheable page, and fails when `FavoriteButton`'s reconciliation is re-gated
  on an SSR prop. Non-vacuity demonstrated in both directions, per HOS-370's
  precedent.
- **AC-B0-6** — After WB0-1, no `nonce=` attribute remains in the HTML of a
  cacheable page, the CSP header carries `sha256-` sources instead, and the
  page's inline scripts still execute (theme FOUC applies, i18n data present,
  PostHog initializes). Verified in `build` + `preview`, then in prod.
- **AC-B0-7** — Lighthouse CLS on a cached catalog route does not regress after
  the class-C branches move to post-hydration swaps (D-11).

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
- **AC-6** (revised Rev 3) — `POST /api/revalidate` issues a `tags: [...]`
  purge. Editing one event does not evict `/_astro/*` assets (verify `age` on a
  static asset survives the purge), **and** evicts that event's detail page in
  all three locales **plus** the listing's `?page=2` variant — the case
  purge-by-URL provably could not reach (§5.11.2).
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
  **Rev 3:** Wave B0 changes the *nature* of this risk rather than just its
  likelihood. Once a path emits HTML with nothing personal in it, there is
  nothing to leak — the risk stops depending on a Cloudflare configuration
  being correct. Until then it is at its **highest** during the migration
  window, when a page may still bake user data while the Cache Rule already
  treats it as cacheable. That window is closed by the per-path ordering in
  D-8/§12.3, not by care.
- **R-2 — CSP nonce shared across visitors.** ~~Requires sign-off.~~
  **RESOLVED Rev 3 → D-9**: migrate to content hashes in our own injector.
  Residual risk moves to R-9.
- **R-7 (Rev 3) — The de-personalization misses a personalized fragment.** The
  audit found `currentUserName` threaded into `CommentThread` on two detail
  pages only because a human went looking for it; it does not look like
  `isAuthenticated` and would survive any grep for that string. Mitigation is
  WB0-6's guard, and the guard must key on *reading the session at all* in a
  cacheable page, not on a list of known prop names.
- **R-8 (Rev 3) — Tag emission drifts from what the page actually renders.**
  A response that renders an entity but forgets its tag is never purged, and the
  failure is silent — stale content with no error. This is the same failure
  shape as the `entity-path-mapper` drift that tags are replacing, so tags are
  not automatically immune: the collector must derive tags from the data the
  page actually fetched, not from a second hand-maintained list.
- **R-9 (Rev 3) — The hash migration blocks inline scripts.** If WB0-1 computes
  a hash that does not match the emitted content, the browser blocks the script:
  theme FOUC flashes, i18n data is missing, PostHog is dead. Unlike most risks
  here this one is **loud and immediate**, which makes it the cheap kind. Caught
  by AC-B0-6 in `preview` before it reaches prod.
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
- ~~**R-11 — Applebot may not respond to Wave A at all.**~~ **REFUTED
  2026-08-03.** Applebot fell 326,810 → 1.2 k (−99.6 %) while remaining
  unblocked, so the crawl trap was in fact the whole explanation. WA-5 did its
  job: the risk was retired by measurement, not by assumption. See §6.1 (WA-5).

## 11. Decisions and open questions

### 11.1 Decisions taken (owner, 2026-07-31)

- **D-1 — Strategy is A → B, explicitly not C.** Close the crawl trap first
  (Wave A), then turn on the edge cache (Wave B). Do **not** block or throttle AI
  crawlers as a first move. Rationale: the owner wants AI visibility; A is the
  only lever that reduces load without surrendering any of it; and C treats the
  symptom. C is reconsidered only if WA-5's post-A measurement shows Applebot has
  not dropped materially. **Confirmed correct 2026-08-03** — Applebot dropped
  99.6 %, so the condition for reconsidering C was never met. C stays rejected
  and AI visibility was retained in full.
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

### 11.1.1 Decisions taken (owner, 2026-08-01 — Rev 3)

- **D-6 — Purge by cache tag, not by URL.** Purge-by-URL is unfixable at this
  plan tier: the cache key keeps the query string (§5.11.2), so the `?page=` /
  `?sortBy=` variants the origin deliberately marks cacheable can never be
  reached. Tags invalidate on what a response *contains*. Secondary benefit: it
  retires `entity-path-mapper.ts`, a 466-line hand-maintained duplicate of the
  routing table that has already drifted (§5.11.1). **Rejected alternatives:**
  purge by prefix (over-purges every detail page under a listing, §5.11.4) and
  purge by URL with per-variant enumeration (combinatorial, and still cannot
  cover unenumerated variants).
- **D-7 — The `/es/` path bug is fixed as part of D-6's replacement, not
  patched.** Fixing `getLocalizedPath` in place would keep a hand-maintained
  mirror of the router alive; tags remove the need for one. If any path-based
  purge survives for an escape hatch, the prefix bug must be fixed there too.
- **D-8 — Auth-blind SSR is its own wave (B0) and precedes the Cache Rule per
  path.** No path becomes cacheable until it is proven session-blind. Until
  then, the session-cookie bypass stays. This ordering is what keeps the only
  severe risk (cross-user leakage) structurally impossible rather than
  configuration-dependent.
- **D-9 — OQ-3 resolved: move to content hashes, do not accept the shared
  nonce.** A nonce that is frozen for the cache TTL is a publicly readable
  token, which is not a nonce. The migration is to **our own injector**, not to
  Astro's `security.csp` — the latter remains rejected for the reasons in
  §5.13.1 (no `<ClientRouter/>` support, no `report-uri`, no dev coverage).
  This is a hard prerequisite for Wave B on **all** pages.
- **D-10 — Do the de-personalization now, while there are no authenticated
  users to break.** Explicitly overrides the Rev 2 / analyst recommendation to
  defer it. The analysis argued from *value* (traffic is ~100 % bots, so the
  cache-hit benefit for logged-in users is ≈0 today). The owner argued from
  *risk window*: the blast radius of this migration is proportional to the
  number of authenticated, paying users it can break, and that number is ≈0
  right now. It will never be cheaper. **Recorded as an owner override of the
  spec author's recommendation**, because the reasoning generalizes to future
  migrations of this shape.
- **D-11 — Class-C branches render the ANONYMOUS variant server-side.** It is
  what crawlers must see, the safe fallback if JS fails, and the only branch
  that can be cached. Never render the authenticated branch and hide it — that
  leaks the shape of private UI into cached HTML. Swap cases (`destinos`)
  reserve space to avoid layout shift; additive cases (`alojamientos`) render a
  correctly-sized placeholder rather than inserting into the sidebar after
  hydration.
- **D-12 — Stay on SSR; do not migrate to prerender.** Once the HTML is
  user-identical, SSR + edge cache with on-demand purge **is** ISR: a cache HIT
  is a static file served from the edge. Purge takes seconds; a rebuild+redeploy
  takes minutes on a 3-vCPU VPS with thousands of editable entities. Prerender
  is additionally blocked for an unrelated reason already documented in
  `apps/web/docs/seo/rendering-strategy.md`: a prerendered page bypasses
  middleware and would ship **with no CSP header at all** (HOS-74 moved 13
  content routes off `prerender` for exactly this; `staticHeaders: true` does
  not help, as it only forwards headers registered by Astro's native mechanism).
  Unblocking it requires native `security.csp` → dropping `<ClientRouter/>` →
  HOS-124, canceled. The same doc records that prerender does not change
  indexability, only TTFB, and that CWV is already "Good".

### 11.2 Still open

- **OQ-1** — Should HOS-128 be closed as superseded by this spec, or kept as a
  sub-scope? This spec absorbs its goal and adds causes it never contemplated;
  its "gated on real traffic" trigger is now overtaken by measurement. Owner
  decision, still pending.
- **OQ-2** — TTL values for the newly cached routes. The existing 300 s / 600 s
  (listings) and 300 s / 60 s (pricing) are unexamined defaults. Content that
  changes rarely (legal, `nosotros`) can take far longer.
- ~~**OQ-3** — Accept the shared CSP nonce under caching, or move the affected
  pages to a hash-based inline strategy?~~ **RESOLVED Rev 3 → D-9** (move to
  content hashes, via our own injector, not Astro's `security.csp`). See §5.13.
- **OQ-4** — Is the VPS adequately sized? 3 vCPU / 7.9 GB hosting prod and
  staging of three apps plus Coolify, at 2.4–2.8 load average with 1.1 GB RAM
  free and 2.6 GB of swap in use. **Rev 2: not answerable until A and B land** —
  the current load is crawler-driven, so sizing cannot be judged against it.
- **OQ-5** — Should staging be moved off the production box entirely?
- **OQ-6** — The zone is on the **Free** plan (confirmed Rev 2). Does Free
  support the needed Cache Rule / Redirect Rule count? Tiered Cache and Cache
  Reserve are paid features and are **not** available at this tier — if either is
  wanted, that is a plan-upgrade decision.
- **OQ-8** (Rev 3) — Tag granularity. `accom-<id>` per entity is obvious; the
  open call is whether listings carry one coarse `list-accom` tag (simple, but
  every accommodation edit evicts every listing page and all their pagination
  variants) or per-page tags (precise, but the collector must know which page a
  card landed on). Start coarse and measure; recorded so the choice is
  deliberate rather than accidental.
- **OQ-9** (Rev 3) — Does anything else bake per-request non-determinism into
  the HTML besides the CSP nonce? The audit found the nonce because it was
  looked for. A byte-identical cached response tolerates none, and WB0-6's guard
  should cover the general case, not just `Astro.locals.user`.
- **OQ-10** (Rev 3) — Once a path is genuinely auth-blind, do we remove the
  session-cookie bypass from its Cache Rule, or keep it as belt-and-braces? D-8
  says removal only after prod verification, but does not say it must be
  removed. Keeping it costs logged-in users the cache; removing it makes the
  guard the only thing standing between a regression and a leak.
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
WC-4               ─── superseded by WB0-7 (Rev 3)
WD-5               ─── blocked on HOS-164 / HOS-168 CSP resolution
```

Rev 3 inserts Wave B0 between A and B, and makes the Cache Rule a per-path
rollout rather than one switch:

```
WB0-1 (nonce→hash) ─── HARD prerequisite of ALL of Wave B, every page.
                       A cached per-request nonce is a public token (§5.13)
WB0-2 → WB0-3      ─── store before the button, or 24 cards = 24 /check calls
WB0-3              ─── one guard fixes ~17 pass-through components
WB0-4, WB0-5       ─── parallel with each other, after WB0-3
WB0-6 (guard)      ─── lands WITH WB0-5, never after. It is what makes the
                       "no cacheable page bakes session state" claim durable
WB0-5 → W1-2       ─── PER PATH. A path becomes cacheable only once proven
                       auth-blind; the cookie bypass is removed only after
                       that path is verified in prod, never before (D-8)
WB0-7              ─── LAST. The 2 hard files, after the pattern is proven
                       on the listings
WA-5               ─── independent of all of B0; measure on schedule
```

The single most important edge in this graph is `WB0-5 → W1-2` **per path**. It
is what turns the cross-user-leak risk from "depends on a Cloudflare
configuration being right" into "structurally impossible, because there is
nothing personal in the HTML".

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

Added in Rev 3:

- **HOS-370** — `web-prod` 500s on destination detail: a CommonJS→ESM-only
  `require(esm)` race. Opened and shipped during this spec's Wave B prep
  (PR #2554, merge `7cd18daf3`). Relevant here for two reasons: it was the
  blocker on the redeploy Wave B needs, and it is the second instance in this
  spec of *a latent defect that only detonates when something else changes*
  (the first being §5.11.1's `/es/` path bug). Both argue for guards over
  vigilance. Carries `status-needs-smoke-prod`.
- **SPEC-046** — the original CSP design. Its
  `research/astro-csp-options.md` (2026-05-16) is the primary source for why
  Astro's hash-based `security.csp` was rejected and Path A2 (our own nonce
  injector) chosen. **Read it before touching WB0-1** — it is the reason D-9 is
  careful to distinguish "content hashes in our injector" from "Astro's
  `security.csp`".
- **HOS-124** — migrate to native `security.csp`. **Canceled, not deferred.**
  Blocked on `<ClientRouter/>` support that Astro added and then removed
  (`76c5480` / #13914, June 2025). Re-read before anyone proposes it again.
- **HOS-74** — CSP missing on prerendered routes. Moved 13 content routes off
  `prerender` because a prerendered page bypasses middleware and ships with no
  CSP header. The evidentiary basis for D-12.
- **HOS-30** — CSP Phase 2 (enforce mode). The guarantee D-9 protects.
- **HOS-117 Wave 4** — `apps/web/docs/seo/rendering-strategy.md`. Already
  contains the page classification, the SSR-vs-prerender anti-myth, and — at
  line 94 — the shared-nonce-under-caching consequence that Rev 3's §5.13
  decides. It anticipated the question; it did not answer it.
- **HOS-115** — the CDN cache-poisoning class of bug that motivates the
  personalization sign-off in `rendering-strategy.md`'s HOS-128 entry.
- **HOS-296** — multi-role actors. Why `/auth/me` is the single endpoint
  carrying the role SET, and therefore why the client-side reconciliation in
  WB0-3/WB0-4 must resolve against it rather than a cheaper session probe.
- **SPEC-098 / SPEC-228** — `FavoriteButton`'s bulk pre-check (T-041) and its
  single-check hydration fallback (T-039b). WB0-3 modifies T-039b's guard; read
  both before changing it.

Engram topics worth recalling before implementation:

- `spec/HOS-369/wave-a-implementation` — Wave A decisions in full.
- `issue/HOS-370/cjs-esm-require-bridge` — the bundler-shape lesson.
- `incident/2026-08-01-destino-500-esm-linking` — the incident post-mortem, and
  a worked example of hypotheses discarded with evidence.
- `project_public_cache_actor_blind` — cached public routes must be
  actor-blind; the API-side sibling of Wave B0 (HOS-359).

## 13. Linear

Canonical tracking:
HOS-369
