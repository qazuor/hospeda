---
title: CSP header missing on prerendered (SSG) routes — move remaining routes off prerender
linear: HOS-74
statusSource: linear
created: 2026-07-04
type: fix
areas:
  - web
---

# CSP header missing on prerendered (SSG) routes — move remaining routes off prerender

## 1. Summary

The 14 remaining `export const prerender = true` routes in `apps/web` ship **zero**
`Content-Security-Policy` header on direct (hard) navigation in production. The
hand-built CSP in `apps/web/src/middleware.ts` never reaches them because middleware
does not run per-request for prerendered pages. This spec applies the **same fix
already used for the home page under HOS-30 2.C** — remove `prerender = true` so each
route is served on the SSR path where middleware runs — to **13 of the 14 routes**,
plus adds an over-the-wire regression test so the fix cannot silently regress. The
14th route (`beta/[...slug].astro`) stays prerendered as a documented exception (OQ-3).

Fix approach chosen by owner (2026-07-04): **Option B — remove `prerender`** (see §11
for the A/B/C tradeoff that was decided, and OQ-3 for the beta exception).

## 2. Problem

CSP is a defense-in-depth XSS mitigation. As of the HOS-30 T-020 enforce flip, SSR
routes (`/es/`, `/es/alojamientos/`, …) correctly emit the full enforce-mode policy,
but the 14 prerendered routes emit **no CSP header at all** — not even the old
Report-Only value — so they get zero CSP hardening.

### Confirmed root cause (was "not yet confirmed" on the Linear issue — now confirmed)

1. `@astrojs/node`'s `staticHeaders: true` (astro.config.mjs:73) only captures headers
   that Astro's **native** `security.csp` build feature registers into the
   `routeToHeaders` map. This app builds its CSP **by hand** in `middleware.ts` via
   `response.headers.set()` — a mechanism `staticHeaders` was never wired to. (The
   `astro.config.mjs` comment itself already says `staticHeaders` only pays off "once
   CSP migrates to native `security.csp`"; that knowledge never reached the
   `middleware.ts` comment, which wrongly implies `context.isPrerendered` is enough.)
2. For a `prerender = true` route, Astro middleware (`onRequest`) runs **exactly once,
   at `astro build` time**, to produce the static HTML file (Astro Middleware guide:
   rendering "occurs at build time for all prerendered pages"). In production,
   `@astrojs/node` **standalone** mode serves that file **directly off disk**, a code
   path that never invokes `app.render()` / middleware. So the one build-time
   `response.headers.set(CSP_HEADER_NAME, …)` call is discarded and no live visitor
   ever receives it.

`context.isPrerendered` **does** evaluate `true` (at build time) and `isHtmlPage`
**is** `true`, so the HOS-30 middleware detection fix was real — but the bug was never
detection, it is that the **entire header-setting code path is unreachable at runtime**
for these routes. This is the identical HOS-30 2.C issue, already fixed for `/es/`
(home) by removing `prerender = true`, just never applied to the other 14 routes.

## 3. Goals

- G-1: All 14 currently-prerendered `apps/web` routes emit the full enforce-mode CSP
  header on a direct/hard navigation in production, matching the already-correct SSR
  routes.
- G-2: A test proves the header is present **over the wire** for at least a
  representative prerendered-turned-SSR route (build + run the standalone server +
  fetch + assert the `content-security-policy` header exists), not just a source-string
  match against `middleware.ts`.
- G-3: The misleading comment block in `middleware.ts` (lines ~300-305) is corrected to
  state the real mechanism (middleware does not run at runtime for prerendered routes;
  `staticHeaders` only captures native `security.csp` output).
- G-4: No functional or visible regression on any of the 14 pages.

## 4. Non-goals

- NG-1: Migrating to Astro's native `security: { csp: true }` (Option A). Rejected for
  now — it does not support `<ClientRouter/>`/View Transitions (which this app uses),
  no Shiki, requires hashes for inline/external, incompatible with `unsafe-inline`.
  Track as a possible future spec if the app ever wants static-file serving back on
  these routes.
- NG-2: Injecting CSP at the Cloudflare/Traefik proxy layer (Option C). Rejected —
  duplicates the CSP value outside the repo, permanent drift risk.
- NG-3: Any change to the CSP directive **content** itself. The value is owned by
  HOS-30; this spec only changes *which routes the existing value reaches*.
- NG-4: Removing `prerender` from routes that are **not** currently prerendered, or
  touching SSR routes that already emit the header correctly.

## 5. Current baseline

- **Astro stack**: `astro@6.4.7`, `@astrojs/node@10.1.1` (mode `standalone`),
  `@astrojs/react@5.0.5`. `output: 'server'`, `staticHeaders: true`,
  `trailingSlash: 'always'`. Astro native `security.csp` is NOT enabled. (Astro 6→7
  migration HOS-76 / PR #2045 is still open and unmerged — irrelevant here; do not
  couple this spec to it.)
- **CSP logic**: `apps/web/src/middleware.ts` ~lines 294-343. `CSP_HEADER_NAME =
  'Content-Security-Policy'` (enforce mode since HOS-30 T-020). Computes
  `isHtmlPage = contentType.includes('text/html') || context.isPrerendered`; inside
  `if (isHtmlPage)` it stamps nonces on SSR bodies and calls
  `response.headers.set(CSP_HEADER_NAME, directives)`.
- **The 14 prerendered routes** (`grep -rl "export const prerender = true" apps/web/src`):
  - `apps/web/src/pages/beta/[...slug].astro`
  - `apps/web/src/pages/[lang]/suscriptores/propietarios/index.astro`
  - `apps/web/src/pages/[lang]/beneficios/index.astro`
  - `apps/web/src/pages/[lang]/guest/messages/verify-expired.astro`
  - `apps/web/src/pages/[lang]/nosotros/index.astro`
  - `apps/web/src/pages/[lang]/legal/cookies/index.astro`
  - `apps/web/src/pages/[lang]/legal/terminos/index.astro`
  - `apps/web/src/pages/[lang]/legal/privacidad/index.astro`
  - `apps/web/src/pages/[lang]/colaborar/editores/index.astro`
  - `apps/web/src/pages/[lang]/colaborar/reportar/index.astro`
  - `apps/web/src/pages/[lang]/colaborar/fotos/index.astro`
  - `apps/web/src/pages/[lang]/colaborar/index.astro`
  - `apps/web/src/pages/[lang]/contacto/index.astro`
  - `apps/web/src/pages/[lang]/preguntas-frecuentes/index.astro`
- **Existing test gap**: `apps/web/src/lib/__tests__/csp-middleware.test.ts`'s
  "prerendered CSP emission guard" only string-matches `MIDDLEWARE_SRC` for
  `context.isPrerendered` — it always passes regardless of runtime behavior. A separate
  guard locks in that `pages/[lang]/index.astro` no longer declares `prerender`/
  `getStaticPaths` (home only).
- **Proven precedent**: commit `1b28a62a0` (HOS-30 2.C) fixed `/es/` by removing
  `export const prerender = true` **and** `getStaticPaths()` from
  `pages/[lang]/index.astro`, moving it to the SSR + Cloudflare-cache path. Use this as
  the reference implementation.

## 6. Proposed design

**Option B — remove `prerender` from each of the 14 routes**, mirroring the home-page
fix. Per route:

1. Delete `export const prerender = true`.
2. For **dynamic** routes (`beta/[...slug].astro` and every `[lang]/*` route), the
   `getStaticPaths()` used only to enumerate prerender params must also be removed —
   under `output: 'server'` SSR, params come from the request (`Astro.params`), and a
   leftover `getStaticPaths` in SSR is ignored/warns. Any `lang` validation previously
   done implicitly by `getStaticPaths`'s param list must now happen at **runtime**
   (validate `Astro.params.lang` against the supported-locales list, return 404 on an
   unknown locale). Follow exactly what `pages/[lang]/index.astro` does post-`1b28a62a0`.
3. Confirm each page renders identically as SSR (same data, same markup) — these are
   static-content pages (legal/FAQ/contact/about/beta docs), so there is no per-request
   data to fetch; the render is deterministic.

Then:

4. Fix the misleading `middleware.ts` comment (§G-3) so future readers understand why
   prerendered routes cannot carry a middleware-set header.
5. Update the test guard so the "no longer prerendered" assertion covers all 14 routes
   (or is generalized to "no `apps/web` page under the public set declares
   `prerender = true`"), and add the over-the-wire test in §7.

### Caching / perf

Removing `prerender` moves these from build-time static files to SSR responses. They
sit behind Cloudflare cache (same as the already-SSR routes), and their content is
static, so effective cache behavior should be equivalent after the first origin hit.
Cache-control headers for these routes must be verified to still allow edge caching
(§9 AC-5) so we don't turn cheap static pages into uncached origin load.

## 7. Data model / contracts

No DB, schema, or API contract changes. The only "contract" touched is the HTTP
response header set: each of the 14 routes gains the `content-security-policy` response
header on direct navigation.

**New over-the-wire regression test** (G-2): build `apps/web`, start the
`@astrojs/node` standalone server, `fetch()` at least one former-prerender route (e.g.
`/es/legal/terminos/`) and assert the response carries a non-empty
`content-security-policy` header whose value matches the enforce-mode policy. This is
the test class the existing suite's own JSDoc flagged as missing ("cannot prove a
given route's response actually carries the header over the wire").

## 8. UX / UI behavior

No visible change. Pages render identically; the only difference is an added response
header and a served-from-SSR-instead-of-static origin path.

## 9. Acceptance criteria

- AC-1: `grep -rl "export const prerender = true" apps/web/src/pages` returns **only**
  `beta/[...slug].astro` (the 13 content routes removed; beta is the intentional
  exception per OQ-3).
- AC-2: For each of the 14 routes, a direct/hard navigation in a production-like build
  returns HTTP 200 **and** a `content-security-policy` header equal to the enforce-mode
  policy emitted by the SSR routes.
- AC-3: An automated over-the-wire test (build + standalone server + fetch) asserts the
  CSP header is present on a former-prerender route and fails if it is absent.
- AC-4: Every affected page renders the same content as before (no missing data,
  no broken locale routing, unknown `lang` still 404s).
- AC-5: Cloudflare/edge cache still applies to these routes (cache-control verified);
  no unexpected uncached origin load introduced — **perf sign-off recorded on the
  Linear issue**.
- AC-6: The `middleware.ts` prerender comment is corrected; `csp-middleware.test.ts`
  guard covers all 14 routes, not just home.
- AC-7: Staging smoke: cache-busted `curl` against `https://staging.hospeda.com.ar` for
  each of the 14 routes confirms the header live (this is the exact method that first
  found the bug). Filed as a `status-needs-smoke-staging` gate.

## 10. Risks

- R-1: **Dynamic-route SSR migration is not a pure one-liner.** Removing `getStaticPaths`
  and moving `lang` validation to runtime is the real work per route; a naive "delete the
  prerender line only" would break dynamic routing or leave a warning. Mitigate by
  copying the proven `pages/[lang]/index.astro` pattern verbatim.
- R-2: **Perf regression** if a route was legitimately prerendered for load speed and
  edge caching doesn't fully cover it. Mitigate via AC-5 (cache verification + sign-off).
- R-3: **`beta/[...slug].astro` catch-all** may enumerate content-driven slugs via
  `getStaticPaths`; as SSR it must resolve the slug at runtime and 404 unknown slugs.
  Needs its own check — it is the least trivial of the 14.
- R-4: **Same "looks fixed, ships broken" trap** as home originally — mitigated only by
  the over-the-wire test (G-2/AC-3). Do not accept a source-string-only test as done.

## 11. Open questions

- OQ-1 (RESOLVED 2026-07-04, owner): Fix approach = **Option B (remove `prerender`)**.
  Rejected: Option A (native `security.csp`) — would break `<ClientRouter/>` View
  Transitions the app uses, large revalidation of every directive; Option C
  (proxy-layer injection) — off-repo CSP duplication + drift. B matches the proven
  home-page precedent and is low-risk on these low-traffic pages.
- OQ-2 (RESOLVED 2026-07-04, owner): Dedicated CI job, NOT part of the unit suite.
  Implemented as `apps/web/scripts/verify-csp-over-the-wire.mjs` (`pnpm --filter=hospeda-web
  verify:csp`) + a `csp-headers` job in `.github/workflows/ci.yml` that reuses the
  `build-outputs` artifact and is gated by `ci-pass`. Keeps the fast unit suite fast while
  still proving the header over the wire.
- OQ-3 (RESOLVED 2026-07-04, owner): `beta/[...slug].astro` STAYS prerendered — it is
  private, `noindex/nofollow` beta docs kept prerendered for resilience, accepted to
  ship WITHOUT CSP. So 13 of the 14 routes are converted; beta is the one documented
  exception. Rationale: its "available if SSR unhealthy" property is largely moot under
  `@astrojs/node` `standalone` (a single Node process serves both static files and SSR —
  if it is down, nothing is served), and the pages are private + noindex, so the XSS-
  hardening loss is low-stakes. The no-prerender test guard (AC-6 / T-007) allowlists
  exactly this file.

## 12. Implementation notes

- Reference implementation is commit `1b28a62a0` (home fix) — read it before touching
  any route; replicate its `getStaticPaths` removal + runtime `lang` handling exactly.
- Do **not** couple this to the Astro 6→7 migration (HOS-76). This fix must work on the
  current Astro 6 / `@astrojs/node` 10 stack.
- The `.specs/HOS-30-csp-phase-2-and-coverage/docs/2026-07-02-premise-corrections.md`
  doc already contains a pre-written A/B/C tradeoff analysis for exactly these routes —
  use it as background.
- Suggested Linear labels once implementation starts: keep `area-web` + `Bug`, relabel
  `kind-needs-spec` → `kind-spec` (done as part of publishing this spec), add
  `status-needs-smoke-staging` (per AC-7).

## 13. Linear

Canonical tracking:
HOS-74 — <https://linear.app/hospeda-beta/issue/HOS-74>
