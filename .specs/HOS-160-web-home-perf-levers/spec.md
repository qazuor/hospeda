---
title: Web home PageSpeed mobile perf levers (JS/CSS/image)
linear: HOS-160
statusSource: linear
created: 2026-07-13
type: chore
areas:
  - web
  - content
  - devops
---

# Web home PageSpeed mobile perf levers (JS/CSS/image)

## 1. Summary

Raise the `apps/web` home page mobile PageSpeed score (measured 35/100, cold-simulated)
by removing wasted client JavaScript, cutting render-blocking CSS round-trips, and fixing
uncached on-demand image transforms. The TTFB/edge-cache lever is out of scope here (tracked
separately in HOS-128); this spec covers the JS / CSS / image levers, which are largely
independent of traffic volume.

Work ships in two phases:

- **Phase 1 (low-risk, no architectural change)**: quick-wins (auth-me dedup, `/_image`
  caching, cloudinary preconnect audit) + CSS file consolidation.
- **Phase 2 (architectural, owner-approved)**: single-locale i18n delivery (removes a ~1 MB
  client chunk) + session-scoped CSP nonce to re-enable Astro's inline critical CSS.

## 2. Problem

`https://hospeda.com.ar/es/` scores **35/100** on mobile PageSpeed (Lighthouse
`--throttling-method=simulate`, the same engine PageSpeed uses). There is no CrUX field data
(low traffic), so the score is 100% lab. A live DevTools trace against warm-CDN prod shows
LCP 1.08s / CLS 0 / TTFB 160ms — i.e. real Argentine users already get good UX; the 35 is the
**cold-simulated** case that matters for SEO/perception and slow-network/first-visit users.

The score is dragged down entirely by FCP (4.8s), LCP (6.4s), TBT (1230ms), Speed Index
(16.1s) and TTI (17.6s). CLS is 0.007 (perfect) — untouched by this spec.

Root causes, established by a three-front investigation (2026-07-13):

1. **A ~1.04 MB client JS chunk ships all three i18n locales** (es+en+pt × 46 web namespaces)
   to every visitor. Straight parse/eval cost, network-independent — the single largest lever.
2. **~30 render-blocking external CSS files** in `<head>` (one per component), forced by a
   deliberate config (`inlineStylesheets: 'never'`) that works around a CSP + soft-nav bug.
3. **On-demand `/_image` transforms are not cached**, so the LCP hero image pays a cold Sharp
   transform and a weak cache lifetime on each request.
4. Minor: a duplicated `/auth/me` request on cold load; a possibly-unused `preconnect`.

## 3. Goals

- G-1: Eliminate `en` + `pt` translation payloads from the browser (ship only the active
  locale), removing the ~1 MB i18n client chunk. `createTranslations` stays synchronous.
- G-2: Reduce home render-blocking CSS from ~30 external files to a small number (target ≤ 3),
  with no CSP regression and no soft-nav style breakage.
- G-3: Give the `/_image` endpoint a long, correct `Cache-Control` so the LCP hero image is
  edge/browser cacheable and not re-transformed per request.
- G-4: Fire at most one `GET /api/v1/public/auth/me` per cold page load.
- G-5: Remove or per-page-gate the `res.cloudinary.com` preconnect if a live check confirms
  the home page issues zero Cloudinary requests.
- G-6: Re-enable Astro's inline critical CSS (`inlineStylesheets: 'auto'`) via a session-scoped
  CSP nonce that survives `<ClientRouter>` soft navigation.

## 4. Non-goals

- NG-1: Edge-caching the anonymous catalog HTML / fixing TTFB (that is HOS-128; this spec only
  *hands over* the finding that the home page bakes no per-user data — see §12).
- NG-2: Icon micro-chunk consolidation (41 chunks, mostly <5 KB — smallest lever, deprioritized).
- NG-3: Per-namespace lazy i18n loading. It changes the `@repo/i18n` public `trans` shape
  (consumed by admin/API/service-core) and needs its own owner decision — separate follow-up.
- NG-4: Migrating off `<ClientRouter>` to Astro's native View Transitions / native `security.csp`
  (large separate migration; already rejected in SPEC-046).
- NG-5: Any change to the SSR-first island principle — islands keep rendering final data in SSR.

## 5. Current baseline

### i18n (lever A)

- `packages/i18n/src/config.shared.ts:413-419` flattens ALL three locales eagerly at module
  scope; `webTrans` (line 427) is a single `{ es, en, pt }` object literal.
- `apps/web/src/lib/i18n.ts` imports `trans` from `@repo/i18n/web` and reads `trans[locale]` at
  runtime. Because `locale` is a runtime string, Rollup cannot tree-shake `en`/`pt`.
- **This is the ONLY path the heavy dict enters the client graph.** No `*.client.tsx` island
  imports `trans` directly (verified across all 143 islands; islands import only cheap utils).
  108 islands call `createTranslations(locale)`; 101 `.astro` pages call it server-side (free).
- `createTranslations` is synchronous, used in React render.
- `import.meta.env.SSR` static replacement + dead-code elimination is already used in-repo
  (`apps/web/src/env-schema.ts`, `apps/web/src/lib/api/client.ts`).
- `BaseLayout.astro` already emits `<script is:inline nonce={cspNonce}>` blocks (theme/FOUC),
  a proven injection point.

### CSS (lever B)

- `apps/web/astro.config.mjs:97-108` sets `build.inlineStylesheets: 'never'` for bug GAP-30-01:
  Astro's default `'auto'` inlines `<style nonce>` per-request, but `<ClientRouter>` soft-nav
  swaps the DOM without a real navigation, so the browser's frozen CSP (pinned to the ORIGINAL
  page's per-request nonce) rejects the swap-in page's inline styles. Forcing external hashed
  files routes CSS through `style-src 'self'`, which is nonce-independent.
- CSP is built in `apps/web/src/middleware.ts` (nonce generated per request at `middleware.ts:67`
  via `generateCspNonce()`, `middleware-helpers.ts:431-434`; header built by `buildCspHeader()`,
  `middleware-helpers.ts:457-580`). `style-src` already contains one static `sha256-…` source
  (`middleware-helpers.ts:524`) for the `astro-island` runtime CSS — proof that build-time hash
  allowlisting works here.
- Nonce is stamped onto `<style>`/`<script>` per response by `injectNonce()`
  (`apps/web/integrations/csp-nonce-injector/inject-nonce.ts`, called at `middleware.ts:299-314`).
- The home page imports `@/styles/global.css` (which `@import`s `components.css`) plus ~12
  section components + header/footer, each emitting its own external CSS file under `'never'`.

### Images (lever C)

- Hero component is already best-practice: `apps/web/src/components/sections/hero-images.ts`
  uses `astro:assets` + `getImage({ format:'webp' })` at 480/800/1200w; `HeroImageRotator.client.tsx`
  sets `loading=eager`/`fetchPriority=high` + explicit w/h on slide 0; `index.astro:172-180`
  preloads slide 0 with a matching `imagesrcset`.
- BUT the home is `output:'server'` (no `prerender` since HOS-30), so local images are served
  through Astro's on-demand `/_image` endpoint — a dynamic route that (a) re-runs a Sharp
  transform per cold request and (b) does NOT get the `@astrojs/node` adapter's automatic
  `Cache-Control: public, max-age=31536000, immutable` (that only applies to physical
  `dist/client/_astro/*` files). No app code sets a `Cache-Control` on `/_image` today.

### auth/me (lever D)

- `UserMenu` (`Header.astro:212`) and `MobileMenu` (`MobileMenuIsland.astro:63`) both hydrate
  `client:load`; each runs `useAccountPermissions` (`src/hooks/use-account-permissions.ts`)
  mount effect independently → on cold load both call `fetchAuthMe()`
  (`src/lib/auth-cache.ts:113-155`) in parallel. No in-flight dedup; only a post-write
  sessionStorage cache (`AUTH_ME_CACHE_KEY`, 60s TTL).

### cloudinary (lever E/F)

- `apps/web/src/layouts/BaseLayout.astro:106` emits an unconditional
  `<link rel=preconnect href="https://res.cloudinary.com" crossorigin>` (SPEC-157 REQ-4).
  Whether the home actually hits Cloudinary depends on where prod card images live
  (`res.cloudinary.com` is in `ALLOWED_REMOTE_HOSTS` alongside pexels/unsplash) — needs a live check.

## 6. Proposed design

### Lever A — single-locale i18n via per-request SSR-inlined dict (Phase 2)

Keep the public API (`createTranslations`/`createT`/`getTranslations`) byte-identical and
**synchronous**. Change only *where the dict comes from* in `apps/web/src/lib/i18n.ts`:

- On the server (`import.meta.env.SSR === true`): read from the statically-imported full `trans`
  as today. Vite keeps this branch only in the server build.
- On the client: read the current locale's dict from a global (`globalThis.__HOSPEDA_I18N__`)
  that `BaseLayout.astro` inlines for `Astro.locals.locale` only, before island hydration
  scripts. The full-dict static import is dead-code-eliminated from the client build because the
  client branch never references it (the `import.meta.env.SSR` guard, proven in-repo).

`BaseLayout.astro` emits one `<script is:inline nonce={cspNonce} set:html=...>` assigning
`globalThis.__HOSPEDA_I18N__ = { <locale>: <flattened-dict-json> }`, placed BEFORE island
hydration so the synchronous read at hydration is guaranteed by script order. A small
server-only helper produces the flattened single-locale JSON.

**Tree-shaking caveat**: `config.shared.ts` builds `webTranslationsFlat` in a top-level `for`
loop (a module side effect Rollup may refuse to drop). Verify with `ANALYZE=1 pnpm build`
(→ `stats.html`) that no locale JSON remains in client chunks. If it leaks: make the flatten
lazy (a `getWebTrans()` function instead of a top-level loop) and/or add `"sideEffects": false`
to `packages/i18n/package.json` — small, safe, benefits all consumers.

**Ship in two safe steps**: (1) land the plumbing with a client-branch *fallback* to the static
import (proves the blob path in prod, still ships all locales, zero risk); (2) remove the
fallback → realize the savings (one-line revert if anything regresses).

Optional refinement (defer): instead of inlining the blob in every SSR response, emit three
hashed per-locale JS assets and inject the right `<script src="/i18n-<locale>.[hash].js">` — keeps
it sync, makes the dict browser-cacheable across navigations. Not in scope unless per-response
HTML size becomes a concern.

### Lever B — render-blocking CSS

**Phase 1 (no CSP interaction)** — consolidate the ~30 external CSS files into a small number.
External `<link>` is governed only by `style-src 'self'`, so file count is CSP-irrelevant.
Evaluate, in order of preference:

- Per-page CSS bundling via Vite `build.rollupOptions.output` keyed by route (precise, no
  over-fetch, but needs a custom function — validate against Astro's module-id conventions).
- `vite.build.cssCodeSplit: false` (≈1 file) — simplest, but bundles home-irrelevant CSS into
  every page (over-fetch); measure the byte tradeoff against the mobile CWV budget before adopting.
- Combine with non-blocking load (`media="print" onload` / `rel=preload as=style`) for
  below-the-fold section CSS (Testimonials/Partners/LatestArticles/NextEvents/Stats/Footer),
  keeping `global.css`+`components.css` + above-fold (Header/Hero/CategoryTiles) blocking.
  Tune to avoid FOUC on throttled mobile.

**Phase 2 (root fix, owner-approved)** — session-scoped CSP nonce. The real cause is that the
nonce rotates per HTTP request while the browser's enforced policy only rotates per *hard*
navigation. Fix: mint a fresh nonce only on a true hard navigation (detect via the browser-set,
unspoofable `Sec-Fetch-Dest: document` request header; absent header → treat as hard-nav, matching
today's behavior as a safe fallback) and persist it in a short-lived `HttpOnly; Secure;
SameSite=Lax` cookie; on soft-nav `fetch`es (`Sec-Fetch-Dest: empty`) reuse the cookied nonce for
both `injectNonce()` and the `style-src`/`script-src` directives. Then revert
`astro.config.mjs` to `inlineStylesheets: 'auto'` and remove the GAP-30-01 workaround comment.
This lets Astro inline its chosen critical CSS again, eliminating most of the ~30 blocking
requests with the least manual bookkeeping. Owner has accepted the per-session (vs per-request)
nonce posture — nonces are already visible in page source; their protection is against an
attacker who can inject markup but not predict the nonce, which session-scope preserves.

Isolate the hard-nav detection as a pure helper (`isHardNavigation({ headers })`) for unit tests.

### Lever C — `/_image` caching (Phase 1)

**Verify first**: `curl` a live `/_image?...` URL on staging/prod, inspect response headers +
timing. Then set a long `Cache-Control` on `/_image` responses (custom endpoint override, or a
Cloudflare cache rule for `/_image*`), with the cache key varying by the full querystring
(href/width/format) so variants don't collide. Optionally pre-generate the 3 hero images × 3
widths at build time as static `_astro/*` assets (inherits the immutable header automatically).

### Lever D — auth/me dedup (Phase 1)

Add a module-level in-flight promise in `apps/web/src/lib/auth-cache.ts`: a
`let pendingAuthMeRequest: Promise<AuthMeSnapshot> | null` that `fetchAuthMe()` returns to
concurrent callers and clears in a `finally`. Strictly at the fetch layer — do NOT touch
`use-account-permissions.ts` reconciliation (preserves the `syncAuthenticatedAttribute`
single-writer contract and the recent stale-guest-state fixes in commits a728cc85a / 9a1b72acb).

### Lever F — cloudinary preconnect (Phase 1)

Live network-tab check of the prod home page. If zero Cloudinary requests, gate the preconnect
per-page (emit only on pages that render user-media images) rather than unconditionally in
`BaseLayout.astro`. Trivial, single `<link>`, no other consumers.

## 7. Data model / contracts

No DB models, schemas, or migrations. No public API changes.
`@repo/i18n`'s public API (`trans`, `createTranslations`) is UNCHANGED — only the web app's
internal `src/lib/i18n.ts` delivery path and (conditionally) `config.shared.ts`'s internal
side-effect shape change. New env vars: none.

## 8. UX / UI behavior

No visible UI change intended. The home renders identically; locale switching (es/en/pt) keeps
working; SSR HTML still contains resolved strings (crawler-visible) because the SSR path uses the
full dict server-side. Below-the-fold CSS deferral (if adopted) must not produce perceptible FOUC.

## 9. Acceptance criteria

- AC-1: The production client bundle for the home page contains NO `en`/`pt` translation values
  (assert via a build-output grep for a pt-only marker string, or `stats.html`).
- AC-2: `apps/web/src/lib/i18n.ts` does not statically import `trans` outside the
  `import.meta.env.SSR` branch (source guard test).
- AC-3: An island `t()` call resolves from `globalThis.__HOSPEDA_I18N__` when the static dict is
  absent, and falls back to `es` when a key/locale is missing (hydration test).
- AC-4: Existing raw-SSR-HTML regression tests (`test/integration/json-ld-coverage.test.ts` +
  per-island) stay green (SSR path unchanged).
- AC-5: Home render-blocking CSS is ≤ 3 external files (verified in the built HTML), with no new
  CSP violations on hard load OR soft-nav (headless browser: navigate + soft-nav, assert zero
  `securitypolicyviolation` events; assert computed styles applied post-swap).
- AC-6: `/_image` responses carry a long `Cache-Control` (verified via curl on staging), keyed
  correctly by querystring.
- AC-7: At most one `GET /api/v1/public/auth/me` fires per cold page load (network assertion /
  a unit test asserting the underlying `fetch` mock is called once for two concurrent callers).
- AC-8: (Phase 2 CSS) After reverting to `inlineStylesheets:'auto'` with the session-scoped
  nonce, a hard-load-then-soft-nav flow produces zero CSP style violations and correct styling.
- AC-9: Lighthouse mobile score on the home improves measurably vs the 35 baseline (record the
  new number; no hard target, but Phase 1 alone should move FCP/LCP/TBT).

## 10. Risks

- R-1: i18n tree-shaking leak (top-level flatten side effect). Mitigation: `ANALYZE=1` build
  check + `sideEffects:false` / lazy getter fallback. Ship-with-fallback de-risks prod.
- R-2: Session-scoped nonce is a genuine CSP-model change and is exactly the bug class that
  motivated the current architecture (GAP-30-01). Mitigation: mandatory soft-nav CSP regression
  test; `Sec-Fetch-Dest`-absent falls back to today's per-request behavior (no regression for
  old clients/bots). Owner has signed off on the posture change.
- R-3: CSS `cssCodeSplit:false` over-fetch. Mitigation: prefer per-page bundling; measure bytes
  before adopting the single-file option.
- R-4: `/_image` cache key collisions if the key omits any transform param. Mitigation: vary by
  full querystring; verify on staging before prod.
- R-5: Below-the-fold CSS deferral FOUC on slow mobile. Mitigation: keep global + above-fold CSS
  blocking; visual-regression + throttled-3G check.
- R-6: Config changes touch a shared package (`@repo/i18n`) only if the tree-shaking fallback is
  needed — low risk (`sideEffects:false` only helps consumers) but cross-package; note in the PR.

## 11. Open questions

- OQ-1 (non-blocking): i18n delivery — inline blob in every SSR response (default, simpler) vs
  hashed per-locale cacheable asset (browser-cacheable across navs). Default to blob unless
  per-response HTML size is a concern.
- OQ-2 (non-blocking): CSS Phase 1 — per-page bundling (precise, custom Rollup) vs
  `cssCodeSplit:false` (simple, over-fetch). Decide after measuring the byte tradeoff.
- OQ-3 (deferred): per-namespace lazy i18n as a follow-up lever (changes `@repo/i18n` public API)
  — own spec, own owner decision (NG-3).

## 12. Implementation notes

- Suggested sequencing: Phase 1 first (D → C → F → B-phase-1), each independently shippable and
  low-risk; then Phase 2 (A with the fallback→flip two-step, then B-phase-2 nonce). A and
  B-phase-2 are independent and can be parallelized once Phase 1 lands.
- Icons (NG-2) intentionally skipped: 41 chunks, mostly <5 KB; on HTTP/2 the cost is per-request
  latency not bytes, and consolidating risks regressing SPEC-269's monolith tradeoff.
- **Hand-over to HOS-128**: the investigation found the home page bakes NO per-user data
  server-side (`NextEventsSection` is `server:defer` + client-hydrated; `LatestArticlesSection`
  passes only an `isAuthenticated` boolean, no `checkBulk`). So HOS-128's "Phase 0 = cache the
  home page alone" is nearly free (origin-gate `s-maxage` on `locals.user==null` + a CF rule with
  session-cookie bypass) and is the exact page scoring 35 — the highest-ROI, lowest-risk first
  slice for HOS-128. The heavy per-user baking is concentrated in `alojamientos/[slug].astro`.
- Reproduce the score with `pnpm dlx lighthouse "<url>" --only-categories=performance
  --form-factor=mobile --throttling-method=simulate` (NOT `npx`, which is intercepted in this
  environment; the PSI public API without a key hits a daily quota).
- Full investigation detail (3 deep-dives: CSS/CSP, edge-cache feasibility, JS/bundle; plus the
  Lever-A technique spike) is captured in the HOS-160 Linear comments.

## 13. Linear

Canonical tracking:
HOS-160
