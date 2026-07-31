---
title: Web performance end-to-end — Cloudflare edge cache, web-prod CPU runaway, document weight
linear: HOS-369
statusSource: linear
created: 2026-07-31
type: fix
areas:
  - devops
  - web
  - api
---

# Web performance end-to-end — Cloudflare edge cache, web-prod CPU runaway, document weight

## 1. Summary

Make `hospeda.com.ar` fast for Argentinian visitors and for bots (Googlebot,
PageSpeed, AI crawlers) by fixing the three measured causes of the current
1.6–3.4 s TTFB, in the order that their evidence justifies:

1. Cloudflare caches **zero** HTML. The origin already emits correct
   `s-maxage` headers on part of the catalog; the Cache Rule that would make
   them effective does not exist. Every request, from every visitor and every
   bot, reaches the Node origin.
2. The `hospeda-web-prod` container burns a **full CPU core continuously while
   idle**, on a 3-vCPU VPS. This is the hard ceiling on origin render time.
3. Production ships **254 KB of JavaScript that staging does not**, containing
   the complete `@repo/config` environment-variable registry — an information
   disclosure as well as a weight problem.

Everything in §5 is measured against production, staging and the VPS on
2026-07-31, not inferred from code. Where static analysis and measurement
disagreed, measurement won — twice, in both directions (§12.2).

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

**Cause 2 — `hospeda-web-prod` spins a core while idle.** Five `docker stats`
samples 8 s apart, with no traffic generated during the window:

```
web-prod 100.81 %   api-prod  8.31 %   load 2.93 2.59 2.43
web-prod 112.05 %   api-prod 42.50 %   load 3.49 2.72 2.47
web-prod 112.87 %   api-prod  5.98 %   load 3.18 2.68 2.46
web-prod 105.30 %   api-prod  0.78 %   load 3.01 2.65 2.46
web-prod  97.46 %   api-prod  2.29 %   load 3.63 2.80 2.51
```

`api-prod` dropping to 0.78 % in the same window proves the box is genuinely
idle. The VPS has 3 vCPU and 7.9 GB RAM (6.2 GB used, 1.1 GB available), shared
between prod and staging of all three apps plus Coolify. Idle load average is
2.4–2.8 out of 3. The container started `2026-07-27T16:00:19Z`, the same date
as the mobile `/mi-cuenta` incident — worth checking whether they are the same
event.

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

- **The Cloudflare zone configuration itself was not read.** No API token was
  used; the absence of a Cache Rule is inferred from `cf-cache-status: DYNAMIC`
  on every HTML route plus the absence of any config-as-code in the repo. The
  actual dashboard state (existing rules, plan tier, Tiered Cache, Argo)
  is unverified.
- **The cause of the `web-prod` CPU runaway.** Measured, not diagnosed. No
  profiling, heap snapshot or log correlation was done.
- **The import chain that pulls `@repo/config` into the client bundle.** Static
  grep finds no importer in `apps/web/src`; the chain is transitive and was not
  traced. A production build with `ANALYZE=1` (already wired, emits
  `apps/web/stats.html`) is the next step.
- **Field Core Web Vitals.** Only lab/synthetic measurements were taken. The
  PostHog web-vitals data was not queried.
- **Traefik/Coolify layer behavior** (compression between origin and
  Cloudflare, keep-alive, connection limits).
- **`apps/admin` and `apps/mobile`** were out of scope entirely.

## 6. Proposed design

Four waves, ordered by evidence strength and by dependency. Waves 0 and 1
contain no application-code changes.

### 6.1 Wave 0 — stop the bleeding

**W0-1 — Diagnose and fix the `web-prod` CPU runaway.**
This gates everything else: while a third of the box is consumed by a spinning
process, every SSR render is slow, and edge caching would hide the symptom for
visitors while leaving the origin equally fragile. Steps: correlate with the
2026-07-27 deploy, inspect container logs for a retry/poll loop, take a CPU
profile of the Node process, check for an unbounded `setInterval` or a failing
fetch retried without backoff.

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

### 6.2 Wave 1 — turn on the edge

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

### 6.3 Wave 2 — extend the pattern across the catalog

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

### 6.4 Wave 3 — document weight

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

### 6.5 Documentation cleanup

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

## 11. Open questions

- **OQ-1** — Should HOS-128 be closed as superseded by this spec, or kept as a
  sub-scope? This spec absorbs its goal and adds causes it never contemplated;
  its "gated on real traffic" trigger is now overtaken by measurement. Owner
  decision.
- **OQ-2** — TTL values for the newly cached routes. The existing 300 s / 600 s
  (listings) and 300 s / 60 s (pricing) are unexamined defaults. Content that
  changes rarely (legal, `nosotros`) can take far longer.
- **OQ-3** — Accept the shared CSP nonce under caching, or move the affected
  pages to a hash-based inline strategy (HOS-164's subject)? Deciding "accept"
  is fine; deciding by omission is not.
- **OQ-4** — Is the VPS adequately sized? 3 vCPU / 7.9 GB hosting prod and
  staging of three apps plus Coolify, at 2.4–2.8 idle load average, with 1.1 GB
  RAM free. Answerable only after W0-1 removes the runaway.
- **OQ-5** — Should staging be moved off the production box entirely?
- **OQ-6** — Does the Cloudflare plan tier support the needed rule count and
  features (Tiered Cache, Cache Reserve)? Unverified (§5.8).

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

### 12.3 Order dependencies

```
W0-1 (CPU runaway) ─── gates meaningful TTFB measurement of everything else
W0-2 (promote)     ─── independent, do early
W0-3 → W0-4        ─── understand before guarding
W1-1 (purge)       ─── HARD prerequisite of W1-2
W1-2 → W1-3        ─── never ship the rule without the verification
W1-3 → W1-4        ─── redirects after the cache is proven correct
W2-4               ─── requires the SSR personalization move first
W3-5               ─── blocked on HOS-164 / HOS-168 CSP resolution
```

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
