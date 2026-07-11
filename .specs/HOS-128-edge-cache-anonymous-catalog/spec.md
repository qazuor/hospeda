---
linear: HOS-128
statusSource: linear
title: Edge-cache the anonymous catalog SSR at Cloudflare (gated by real traffic)
created: 2026-07-10
type: feature
area: [web, devops]
---

# HOS-128 — Edge-cache the anonymous catalog SSR at Cloudflare

## Context

Surfaced during **HOS-117** Wave 4 (T-016). See
`apps/web/docs/seo/rendering-strategy.md` (lines 45–101) — verified empirically on
prod (2026-07-10): **every** HTML response returns `cf-cache-status: DYNAMIC`.
Cloudflare caches no `text/html` by default, so the whole catalog SSR reaches the
Node origin on every request, and each detail page fans out to ~9–12 API calls
(`apps/web/astro.config.mjs` `prefetch.defaultStrategy: 'tap'` comment). Even the
pricing pages that already send `Cache-Control: s-maxage=…` are served `DYNAMIC`
(a **dead no-op**) because Cloudflare needs an explicit **Cache Rule** to cache
HTML at all — an origin header alone does nothing.

This is the **decoupled, viable half** of the original **HOS-124**: it does NOT
require the (blocked) Astro native-CSP migration. SSR responses already carry the
middleware CSP header, which gets cached along with the HTML (with a caveat — see
D-5 / R-2).

> **Priority / trigger — NOT urgent (read before starting implementation).** The
> HOS-117 CWV baseline is already "Good" (LCP 1.0–1.3s, CLS ~0, field INP p75
> 64ms) and prod traffic is ~zero (100% demo). This is **scaling insurance** — the
> owner's decision (2026-07-10) is to write the spec now but gate the
> implementation on real traffic / real hosts arriving and PostHog web-vitals
> showing origin strain. Do not open the implementation worktree until that
> trigger fires.

## 1. Summary

Serve the anonymous catalog HTML from the Cloudflare edge (short TTL +
stale-while-revalidate) so origin load and TTFB drop and the app scales under real
traffic. Two coupled pieces: (a) an origin that sends
`Cache-Control: s-maxage=…, stale-while-revalidate=…` on the anonymous catalog
routes, and (b) a Cloudflare **Cache Rule** that actually caches `text/html` for
those paths. The hard prerequisite is making the cached HTML **genuinely
anonymous** — today those pages bake one specific user's personalized state into
the SSR markup (see §5 / R-1), which must move client-side before any caching is
safe.

## 2. Problem

1. **Cloudflare caches zero HTML.** Default CF behavior does not cache `text/html`
   without an explicit Cache Rule. Every catalog request hits the Node origin,
   which fans out to the API (~9–12 calls per detail page). Under real traffic this
   is the origin's scaling ceiling.
2. **The origin's existing cache headers are dead.** The four pricing pages already
   send `Cache-Control: s-maxage=300, stale-while-revalidate=60`
   (`apps/web/src/pages/[lang]/suscriptores/planes/index.astro:46-49` and siblings)
   yet still serve `DYNAMIC` — proof that the header alone is inert without the
   Cache Rule.
3. **The catalog HTML is not safely cacheable as written.** Unlike the pricing
   pages (which deliberately keep personalization client-side —
   `apps/web/src/components/billing/PricingCardsGrid.astro:807-826`), the catalog
   listing and detail pages embed per-user data directly into the SSR HTML
   (favorite/bookmark state, conversation IDs, user name/email — see §5). Caching
   these as-is would leak one user's page to the next visitor — the exact
   CDN cache-poisoning class flagged for HOS-115.

## 3. Goals

- **G-1** — The anonymous catalog HTML is served from the Cloudflare edge
  (`cf-cache-status: HIT` on a warm second request) with a short TTL +
  stale-while-revalidate, dropping origin load and TTFB.
- **G-2** — Caching is **safe**: no authenticated/personalized response is ever
  stored or served to a different user. Anonymous cache entries contain **zero**
  per-user data.
- **G-3** — The origin sends `Cache-Control: s-maxage=…, stale-while-revalidate=…`
  on the anonymous catalog routes, and the CF Cache Rule that makes it effective is
  captured somewhere reproducible (dashboard runbook or config-as-code — OQ-1).
- **G-4** — A content edit still surfaces within a bounded, documented staleness
  window (TTL + SWR + purge behavior), so cached pages don't show stale listings
  indefinitely.

## 4. Non-goals

- **NG-1** — No Astro native-CSP migration (that's the blocked HOS-124 half). This
  spec works with the current middleware-injected CSP.
- **NG-2** — No `prerender = true` on any catalog page. Per
  `rendering-strategy.md:70-83`, prerendering bypasses the request-time middleware
  and would ship pages with no CSP header. Out of scope; blocked on HOS-124.
- **NG-3** — No change to which data the catalog pages show or to the API
  contracts. This is a caching + personalization-relocation change, not a product
  change.
- **NG-4** — No caching of genuinely dynamic/personalized surfaces: account,
  checkout, owner controls, search results, favorites pages. Those stay `DYNAMIC`.
- **NG-5 (candidate — see OQ-4)** — Wiring the existing `entity-path-mapper`
  granular purge may be split into its own follow-up if it grows the surface too
  much; provisionally in-scope because without it the cache benefit is largely
  self-defeating (see R-4).

## 5. Current baseline

Grounded in the current code (paths + lines as of `origin/staging`):

- **Astro output / adapter** — `apps/web/astro.config.mjs`: `output: 'server'`,
  `trailingSlash: 'always'`, `adapter: node({ mode: 'standalone', staticHeaders: true })`.
  **No `prerender` export exists on any catalog page** (grep: 0 matches) — 100% SSR,
  0% edge-cached, matching the rendering-strategy doc.
- **Middleware CSP + nonce** — `apps/web/src/middleware.ts`: generates a per-request
  nonce at L66 (`generateCspNonce()`, impl `apps/web/src/lib/middleware-helpers.ts:431-434`),
  stores it at `context.locals.cspNonce` (L67), and in Step 9 (L289–304) rewrites
  the SSR HTML body per request to stamp that nonce into inline `<style>/<script>`,
  then sets the `Content-Security-Policy` header (L312). **No `Cache-Control` or
  `Vary` header is set anywhere in the middleware.** The per-request body rewrite
  means every response is uniquely nonce-stamped today.
- **Existing (dead) cache headers** — only the pricing pages set them:
  - `apps/web/src/pages/[lang]/suscriptores/planes/index.astro:46-49`
  - `apps/web/src/pages/[lang]/suscriptores/planes/comparar/index.astro:36-37`
  - `apps/web/src/pages/[lang]/suscriptores/turistas/index.astro:47-48`
  - `apps/web/src/pages/[lang]/suscriptores/turistas/comparar/index.astro:36-37`
  - Constants: `PRICING_CACHE_MAX_AGE_SECONDS = 300`, `PRICING_CACHE_SWR_SECONDS = 60`
    (`apps/web/src/lib/billing/fetch-plans.ts:25,28`).
  - Non-HTML endpoints that DO get cached today (control group): `pages/api/og.ts:191`,
    `pages/robots.txt.ts:127`, `pages/sitemap-dynamic.xml.ts:474`, `pages/llms.txt.ts:112`,
    `lib/feeds.ts:195-196,253-254`.
- **The personalization precedent to reuse** —
  `apps/web/src/components/billing/PricingCardsGrid.astro:807-826` (comment):
  > "Deliberately client-side, NOT server-rendered: this page sets
  > `Cache-Control: s-maxage=...` so Cloudflare caches the SSR HTML at the edge and
  > serves it to every subsequent visitor regardless of their own cookies. Baking
  > one visitor's personalized `intendedInterval` into that cached markup would
  > leak it to whoever the CDN serves the cached page to next."
  This is the exact pattern the catalog must adopt.
- **Personalization currently baked into catalog SSR (the blocker)** — every catalog
  page computes `isAuthenticated = Boolean(Astro.locals.user)` and, when true,
  embeds per-user data into the HTML:
  - Listing pages: `alojamientos/index.astro:224,227-229` calls
    `userBookmarksApi.checkBulk(...)` and renders per-card `isBookmarked`/`bookmarkId`
    into the SSR markup for every card. Mirror pattern in the other listing +
    `tipo/comodidades/caracteristicas/categoria/etiqueta/autor` sub-listings.
  - Detail pages: `alojamientos/[slug].astro:239-247` derives `currentUser`
    (`id`/`name`/`email`); L257-275 fetch the user's conversation
    (`canLeaveReview`, `existingConversationId`) via `protectedConversationsApi.list`;
    L294-306 fetch `initialIsFavorited`/`initialBookmarkId` via
    `userBookmarksApi.checkStatus`. `eventos/[slug].astro:278` and
    `publicaciones/[slug].astro:436` pass `currentUserName={Astro.locals.user?.name}`.
- **Auth cookie handling** — no fixed cookie name in the web app; the raw `Cookie`
  header is forwarded as-is to Better Auth
  (`apps/web/src/lib/middleware-helpers.ts:335-336`), read at `middleware.ts:79,138,189`
  and independently inside catalog detail pages (`[slug].astro:259,296`). The
  session-cookie name is owned by Better Auth in `apps/api`. **This matters for the
  Cache Rule bypass key** (OQ-2): the rule must key off the actual Better Auth
  session cookie name, which needs to be confirmed and pinned.
- **Cloudflare config in-repo** — two Workers exist as config-as-code:
  `infra/cloudflare/posthog-proxy/wrangler.toml` and
  `infra/cloudflare/sentry-tunnel/wrangler.toml` (routes + zone declared, manual
  `wrangler deploy`). **No Cache Rule / Page Rule / `_headers` file exists as code
  anywhere** — cache behavior is dashboard-only today.
- **Existing revalidation / purge plumbing** —
  `apps/web/src/pages/api/revalidate.ts` (`POST /api/revalidate?secret=…`, guarded
  by `HOSPEDA_REVALIDATION_SECRET`) calls the CF `purge_cache` API with
  `{ purge_everything: true }` (L52-61), needing `CLOUDFLARE_ZONE_ID` +
  `CLOUDFLARE_API_TOKEN`. Driven from the API side by
  `packages/service-core/src/revalidation/` (`CloudflareRevalidationAdapter`), wired
  at `apps/api/src/index.ts:304-313`. **A fully-built per-entity, per-locale path
  mapper already exists but is unused for purge**:
  `packages/service-core/src/revalidation/entity-path-mapper.ts` `getAffectedPaths()`
  knows the exact catalog URLs per entity change — the adapter ignores it and nukes
  the whole zone. Relevant to R-4 / OQ-4.

## 6. Proposed design

**D-1 — Two coupled changes, both required.** (a) Origin: send
`Cache-Control: s-maxage=<ttl>, stale-while-revalidate=<swr>` on anonymous catalog
routes (reuse the pricing-page helper pattern). (b) Cloudflare: a Cache Rule that
caches `text/html` for the catalog path set, honoring origin `s-maxage`, with an
explicit **bypass when a Better Auth session cookie is present**. Neither works
alone: the header is inert without the rule; the rule without a cookie-bypass would
cache authenticated responses.

**D-2 — Anonymous responses must be truly anonymous (the hard prerequisite).**
Before any catalog page is made cacheable, its per-user SSR state
(favorite/bookmark, conversation, user name/email — §5) must move to a client-side
fetch-after-load, mirroring `PricingCardsGrid.astro`. The cacheable SSR HTML then
contains only anonymous content; per-user overlays (favorite hearts, "leave a
review" affordances, owner controls) hydrate on the client from the user's own
authenticated API call. This is the bulk of the implementation work and the real
risk surface — the Cache Rule is the easy part.

**D-3 — Defense in depth, not a single guard.** Combine: (1) the CF Cache Rule
bypasses cache entirely when the session cookie is present (so authenticated
requests never read/write the anonymous cache), AND (2) the origin only emits
`s-maxage` on a response it knows is anonymous (`Astro.locals.user == null`), AND
(3) the anonymous SSR carries no per-user data at all (D-2). Any one failing must
not, by itself, leak user data. Do not rely solely on the cookie bypass — an
imperfect cookie match plus baked-in user data is exactly the HOS-115 failure mode.

**D-4 — Scope the Cache Rule to the anonymous catalog path set only.** Include:
`/{lang}/alojamientos/**`, `/{lang}/destinos/**`, `/{lang}/eventos/**`,
`/{lang}/publicaciones/**`, `/{lang}/gastronomia/**`, `/{lang}/experiencias/**`
(listings, `page/[n]`, detail `[slug]`, and by-type/category/tag/author/amenity/
feature landings), plus the four `suscriptores/{planes,turistas}` pricing pages
(whose dead header becomes effective). **Explicitly exclude** account, checkout,
`comparar` (holds client compare state — confirm), search, `mapa`, favorites, and
anything under protected/auth. Exact include/exclude list is OQ-6.

**D-5 — CSP nonce under caching (must be signed off).** A cached page shares its
first-visitor nonce across all cache-hit visitors for the TTL window. This weakens
(does not break) the nonce guarantee for short-TTL, read-only catalog pages. Two
options: (a) accept it explicitly for the catalog cache (owner sign-off, R-2), or
(b) move those pages' inline CSP to a hash-based strategy so no per-request nonce is
needed. Because the cached HTML embeds the nonce but the CF-served CSP header may or
may not be the matching cached one, verify header+body nonce coherence on a cache
HIT during implementation (a mismatch would break inline styles/scripts, not just
weaken security). Decision is OQ-5.

**D-6 — Bounded staleness + purge.** With `s-maxage` + SWR, a content edit is
visible after at most TTL (served stale up to SWR while revalidating). The existing
`purge_everything` on `/api/revalidate` already fires on content edits — with HTML
now cached, that purge finally does real work. **Recommend** wiring the existing
`entity-path-mapper.getAffectedPaths()` into a targeted `purge_cache` `files: […]`
call instead of `purge_everything`, so a single listing edit doesn't evict the
entire zone's cache (which would defeat the caching benefit under steady editing —
R-4). Whether that path-scoped purge lands in this spec or a follow-up is OQ-4.

## 7. Data model / contracts

- **No DB migration.** Infra + rendering change only.
- **No new env var** for the caching itself — reuses `CLOUDFLARE_ZONE_ID`,
  `CLOUDFLARE_API_TOKEN`, `HOSPEDA_REVALIDATION_SECRET` already present for the purge
  path. (New TTL/SWR values are constants, mirroring `fetch-plans.ts`.)
- **Cloudflare Cache Rule** — the only new "contract". Caches `text/html` for the
  D-4 path set, respects origin `Cache-Control`, bypasses on session cookie. Lives
  either in the CF dashboard (documented in a runbook) or as config-as-code
  (Terraform / a new `infra/cloudflare/` artifact) — OQ-1.
- **Origin response headers** — new `Cache-Control: s-maxage=<ttl>, stale-while-revalidate=<swr>`
  on anonymous catalog responses only; omitted (or `private, no-store`) when
  `Astro.locals.user != null`.
- **No API/wire contract change.** Per-user data still comes from the same protected
  endpoints — the difference is the browser calls them client-side instead of the
  SSR frontmatter calling them server-side.

## 8. UX / UI behavior

- Anonymous visitor: identical rendered result, faster (edge HIT). No favorite
  hearts / owner controls in initial HTML (there is no user) — unchanged from today
  for anonymous users, who already see none.
- Authenticated visitor: the page's anonymous shell may render first, then per-user
  overlays (favorite state, "leave a review", owner controls) hydrate client-side a
  beat later. This is a **visible behavior change** from today's server-rendered
  personalization — the favorite heart's filled/empty state now resolves after a
  client fetch instead of being correct in the first paint. Must avoid layout shift
  (reserve space / skeleton) and a "flash of un-favorited" (FOUF). Acceptable
  tradeoff for cacheability, but it IS a UX change to sign off (OQ-3 covers whether
  a brief skeleton or optimistic state is preferred).

## 9. Acceptance criteria

- **AC-1** — A second anonymous request to a catalog listing/detail URL returns
  `cf-cache-status: HIT` (first is `MISS`/`DYNAMIC`→`MISS`). Origin API call count
  for the warm request is 0.
- **AC-2** — An authenticated request (session cookie present) to the same URL
  returns `cf-cache-status: BYPASS` (or `DYNAMIC`) and is served fresh from origin —
  never a cached anonymous copy.
- **AC-3** — The cached anonymous HTML contains **no** per-user data: no bookmark
  IDs, no `existingConversationId`, no user name/email, no favorite-true state.
  (Verified by inspecting a cache-HIT response body.)
- **AC-4** — After a content edit + revalidation purge, the affected catalog URL
  reflects the change within the documented TTL+SWR window; unrelated URLs are not
  needlessly evicted if path-scoped purge is in scope (OQ-4).
- **AC-5** — The four pricing pages now return `cf-cache-status: HIT` on warm
  anonymous requests (their previously-dead `s-maxage` is effective).
- **AC-6** — Excluded surfaces (account, checkout, search, favorites, owner) still
  return `DYNAMIC`/`BYPASS` and are never cached.
- **AC-7** — On a cache HIT, the served CSP header and the nonce embedded in the
  cached body are coherent (inline styles/scripts still execute; no CSP console
  violations). Nonce-reuse-across-visitors is accepted per the D-5 sign-off.
- **AC-8** — Authenticated per-user overlays (favorite heart, review affordance,
  owner controls) still work, now hydrated client-side, with no layout shift and no
  persistent wrong state.

## 10. Risks

- **R-1 (highest) — CDN cache-poisoning / personalization leak.** The catalog SSR
  currently bakes one user's favorites/conversation/name into HTML. If caching is
  enabled before D-2 fully lands, or the cookie bypass is imperfect, one user's page
  is served to others. Mitigation: D-2 + D-3 defense-in-depth; AC-3 verifies the
  cached body is clean. This is the same class as HOS-115 — treat as blocking.
- **R-2 — CSP nonce reuse under caching.** Cache-hit visitors share the first
  visitor's nonce for the TTL. Weakens (not breaks) the nonce guarantee; also a
  correctness risk if the served CSP header and cached body nonce diverge (breaks
  inline assets). Mitigation: D-5 sign-off + AC-7 coherence check, short TTL.
- **R-3 — UX regression from client-side personalization.** Favorite state now
  resolves after load → FOUF / layout shift if done naively. Mitigation: skeleton /
  reserved space / optimistic hydration (OQ-3).
- **R-4 — `purge_everything` self-defeats the cache.** Under real editing traffic,
  every content edit currently nukes the whole zone, so warm cache is rare.
  Mitigation: path-scoped purge via the existing `entity-path-mapper` (D-6 / OQ-4).
- **R-5 — Cache Rule config is dashboard-only drift.** If the rule lives only in the
  CF dashboard, it's undocumented-as-code and can silently regress (same failure the
  dead pricing header already demonstrates). Mitigation: config-as-code or a
  versioned runbook (OQ-1).
- **R-6 — `staticHeaders: true` interaction.** The adapter already sets
  `staticHeaders: true`; confirm it doesn't alter how middleware `Cache-Control`
  headers reach the edge for SSR responses.

## 11. Open questions (for the owner — do NOT resolve unilaterally)

- **OQ-1 — Cache Rule as config-as-code vs dashboard + runbook?** Config-as-code
  (Terraform / new `infra/cloudflare/` artifact) is version-controlled and
  reviewable but adds tooling; a documented dashboard rule is faster but is the same
  undocumented-drift risk the dead pricing header already shows (R-5).
- **OQ-2 — Cookie-bypass key.** Confirm the exact Better Auth session-cookie
  name(s) the Cache Rule must bypass on (and any `__Secure-`/prefixed variants),
  since the web app never names the cookie directly (it forwards the raw header).
- **OQ-3 — Authenticated personalization UX.** Skeleton placeholder, optimistic
  state, or delayed hydration for the favorite heart / review affordance / owner
  controls once they move client-side? Affects perceived correctness (R-3).
- **OQ-4 — Path-scoped purge in scope here or a follow-up?** Wiring
  `entity-path-mapper.getAffectedPaths()` into `purge_cache files:[…]` is what makes
  the cache actually pay off under editing (R-4), but it touches the API-side
  revalidation adapter, widening the surface beyond `apps/web`.
- **OQ-5 — CSP nonce: accept reuse under short-TTL cache, or move catalog pages to a
  hash-based inline CSP?** Accepting reuse is a one-line sign-off; hash-based is more
  work but keeps the per-visitor guarantee.
- **OQ-6 — Exact include/exclude path list for the Cache Rule** (D-4). Notably:
  cache `comparar`? `mapa`? the `destinos/[slug]/{alojamientos,eventos}` nested
  listings? Anything with client-held state or heavy interactivity may be better
  left `DYNAMIC`.
- **OQ-7 — TTL / SWR values.** Reuse the pricing 300s/60s, or shorter for the
  content catalog (fresher listings) vs longer (better hit rate)? Tie to how often
  content actually changes and to the purge strategy (OQ-4).

## 12. Implementation notes

- **Order matters**: land D-2 (move personalization client-side) and verify AC-3
  BEFORE enabling any Cache Rule. Never enable caching on a page that still bakes
  user data. Consider shipping D-2 as its own PR (pure refactor, no caching) so the
  cache-poisoning risk is fully retired and reviewed before the infra flip.
- Reuse the pricing-page header helper pattern (`fetch-plans.ts` constants +
  `Astro.response.headers.set('Cache-Control', …)`) — do not invent a new mechanism.
- The client-side personalization fetch should reuse the existing protected APIs
  (`userBookmarksApi.checkStatus/checkBulk`, `protectedConversationsApi.list`) from
  the browser; only the call site moves (SSR frontmatter → client island), not the
  contract.
- Verify header+body nonce coherence on a real cache HIT (D-5 / AC-7) — this is
  easy to miss in local dev where nothing is edge-cached; it needs a staging smoke
  against the real CF edge.
- Estimated size: ~1 day of work per the Linear issue, but the personalization
  relocation (D-2) across ~6 listing families + detail pages is the bulk and could
  itself be multi-PR. The Cache Rule + origin header is the small, fast part.
- **Smoke gate**: this needs `status-needs-smoke-staging` (real CF edge behavior,
  `cf-cache-status`, cookie bypass, nonce coherence — none of it is observable in
  local dev or vitest). Apply the label before the implementation PR.

## 13. Linear

Canonical tracking: **HOS-128**
<https://linear.app/hospeda-beta/issue/HOS-128>
