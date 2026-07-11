# Rendering strategy & edge caching

> Tracks HOS-117 Wave 4 (T-015 page classification, T-016 Cloudflare edge-cache verification).

This document records how every public page in `apps/web` is rendered, why,
and the state of edge caching in front of the Node origin. It is the durable
companion to the Core Web Vitals baseline recorded on the HOS-117 Linear issue
(T-003).

Last audited: 2026-07-10.

## Anti-myth: SSR vs prerender does NOT change indexability

A recurring misconception is that server-side rendering (SSR) hurts SEO and that
pages must be prerendered (built to static HTML) to be indexable. **This is
false.** Both SSR and prerender serve complete HTML in the initial response; a
crawler cannot tell request-time HTML from build-time HTML. Googlebot and LLM
fetchers index the HTML they receive either way.

Prerender only affects **Core Web Vitals**, and only via TTFB: a static file
served from a CDN edge has a lower, more consistent TTFB than a response the
origin computes per request. It changes *how fast*, never *whether*, a page is
indexed. Any rendering decision below is therefore a **performance/cost**
decision, not an SEO one.

## Current state: 100% SSR, 0% edge-cached

- **Astro config** (`astro.config.mjs`): `output: 'server'` + `@astrojs/node`
  (`mode: 'standalone'`). Every route is SSR; no page sets
  `export const prerender = true` (several static-looking pages explicitly set
  `prerender = false`).
- **Cloudflare edge cache**: verified empirically on prod (2026-07-10) — every
  HTML response returns `cf-cache-status: DYNAMIC`, i.e. Cloudflare caches
  **nothing** and every request reaches the Node origin. This holds even for
  pages that already send `Cache-Control: s-maxage=…` (see below).

## Page classification

| Class | Pages | Rationale |
|---|---|---|
| **Pure SSR** (correct as-is) | `/mi-cuenta/*`, `/suscriptores/checkout/*`, `/guest/messages/*`, search, `/publicar/*` | Per-user / authenticated / personalized. Must never be cached or prerendered. |
| **SSR + edge-cache candidate** (not cached today) | Catalog listings + detail: `/alojamientos`, `/destinos`, `/eventos`, `/publicaciones`, `/gastronomia`, `/experiencias` (+ programmatic landings `/tipo/[type]`, `/comodidades/[slug]`, `/caracteristicas/[slug]`) | Anonymous, content-driven, changes slowly. Would benefit from a short-TTL edge cache (`s-maxage` + `stale-while-revalidate`) — but is **not cached today** and enabling it is deferred (see below). |
| **Prerender candidate in principle — BLOCKED** | Legal (`terminos`/`privacidad`/`cookies`), `/funcionalidades`, home | Truly static content. Cannot be prerendered under the current architecture — see the CSP blocker below. |

## T-016 finding: Cloudflare caches no HTML; pricing `s-maxage` is a dead no-op

Verified on prod:

| URL | `Cache-Control` sent | `cf-cache-status` |
|---|---|---|
| `/es/` (home) | — | `DYNAMIC` |
| `/es/alojamientos/` (listing) | — | `DYNAMIC` |
| `/es/alojamientos/{slug}/` (detail) | — | `DYNAMIC` |
| `/es/destinos/{slug}/` (detail) | — | `DYNAMIC` |
| `/es/suscriptores/planes/` (pricing) | `s-maxage=300, stale-while-revalidate=60` | `DYNAMIC` |

The pricing pages (`/suscriptores/planes`, `/suscriptores/turistas`) already set
an edge-cache `Cache-Control` header, yet Cloudflare still serves them
`DYNAMIC`. There is no `Set-Cookie` or `Vary` on the responses to explain it.
The cause is Cloudflare's default behavior: **it does not cache `text/html`
unless an explicit Cache Rule enables it.** Without such a rule the `s-maxage`
directive is ignored — the header these pages ship today is a **dead no-op**.

**Impact:** every catalog and detail request recomputes on the Node origin
(each detail page fires ~9–12 API calls per the `astro.config` prefetch note).
At current traffic this is fine — the CWV baseline (T-003) is "Good" across all
page types (LCP 1.0–1.3 s, CLS ≈ 0, field INP p75 64 ms). It is a **scaling**
risk, not a present defect.

## Why prerender is blocked (HOS-74 / CSP)

The CSP header is built per-request in `src/middleware.ts` (Step 9) with a
per-request nonce, and the response body is rewritten to stamp that nonce onto
inline `<style>`/`<script>` tags. A prerendered page bypasses middleware at
request time — `@astrojs/node` standalone serves the static file straight off
disk — so it would ship **with no CSP header at all**. HOS-74 deliberately moved
every content page off `prerender` onto the SSR path for exactly this reason.
`staticHeaders: true` only forwards headers registered by Astro's *native*
`security.csp` build feature, not the hand-built middleware header.

**Do not add `export const prerender = true` to any content page** — it would
silently ship without a CSP. Migrating to Astro's native `security.csp` to allow
it is **not viable** (see below).

## Deferred follow-ups (scaling; out of HOS-117 scope)

1. **Edge-cache the anonymous catalog — HOS-128 (viable path).** Add a Cloudflare
   Cache Rule that caches `text/html` for the catalog paths honoring `s-maxage`,
   and make the origin send `Cache-Control: s-maxage=… , stale-while-revalidate=…`
   on those routes. This does **not** require any CSP change — the SSR responses
   already carry the middleware CSP, which is cached with the HTML. Requires two
   sign-offs: (a) personalization — cache only anonymous responses / `Vary` on
   the auth cookie, to avoid the CDN cache-poisoning class of bug seen in HOS-115;
   (b) the middleware's per-request CSP nonce is shared across users for the cache
   TTL, which weakens (does not break) the nonce guarantee — acceptable for
   short-TTL read-only catalog pages, or move those to a hash-based inline
   strategy. Also makes the pricing pages' existing (currently dead) `s-maxage`
   effective.
2. **Migrate hand-built CSP → Astro native `security.csp` — NOT viable (HOS-124,
   canceled).** Would be the prerequisite for prerendering static pages, but
   Astro's native `security.csp` does **not** support `<ClientRouter />` / view
   transitions, which this app uses in `BaseLayout` (every page). Astro added and
   then **removed** that support (commit `76c5480` / #13914, June 2025 — view
   transitions had to become async, which broke users); it "might" return with no
   timeline. Native CSP is also hash-based (not per-request nonces), incompatible
   with `unsafe-inline`, and drops Shiki. Migrating would first require moving the
   whole app off `<ClientRouter />` — a large navigation-architecture change.
   Revisit only if Astro re-adds `<ClientRouter />` + CSP, or the app migrates off
   `<ClientRouter />` independently.
3. **Prerender truly-static pages** (legal, `/funcionalidades`) — blocked on (2),
   which is not viable. Low value anyway (CWV already "Good").

Deferred because the CWV baseline is already "Good"; these are robustness/cost
improvements to revisit under real traffic pressure, not fixes for a current
problem.
