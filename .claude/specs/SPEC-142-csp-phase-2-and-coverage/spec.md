---
spec-id: SPEC-142
title: CSP Phase 2 + remaining SPEC-046 coverage gaps
type: feat
complexity: medium
status: draft
created: 2026-05-17T18:30:00Z
effort_estimate_hours: 6-10
tags: [security, csp, web, billing, phase-2, auth-flows, mercadopago]
extracted_from: SPEC-046 closure (T-015 deferred + T-014 follow-up findings)
depends_on: [SPEC-046]
blocked_by_external: [SPEC-140 Umami if measuring engagement Web Vitals from Sentry only]
---

# SPEC-142: CSP Phase 2 + remaining SPEC-046 coverage gaps

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal**: complete the SPEC-046 work by (a) closing the coverage gaps deferred at SPEC-046 closure, (b) migrating the Content-Security-Policy header from `-Report-Only` to enforce mode, and (c) integrating MercadoPago Brick (and any other payment / auth third-party widgets) under the hardened policy without regressions.

**Why now**: SPEC-046 shipped 14/15 tasks. The remaining T-015 (authenticated crawl) was risk-accepted as "Report-Only mode means no UX impact". That risk acceptance EXPIRES the moment we flip to enforce — at that point uncatalogued violations on `/mi-cuenta/*` or the MercadoPago checkout flow stop being silent reports and START blocking real users. SPEC-142 is the pre-Phase-2 audit that ensures the enforce flip is non-breaking.

**Scope**: five cohesive workstreams. Three are inherited from SPEC-046 deferrals (auth crawl, home header gap, Sentry env). Two are new (Phase 2 enforce + MercadoPago Brick integration). Plus optional cleanups (eval-probe report filter, Logo-style sweep).

### 2. Workstreams

#### 2.A Authenticated coverage crawl (was SPEC-046 T-015)

Pre-Phase-2 prerequisite. Crawl the routes that need login + payment using a staging test account, catalogue any new CSP violations not seen in T-014 (which covered public pages only).

**Routes in scope**:

| Route group | Notes |
|---|---|
| `/es/auth/sign-in/`, `/es/auth/sign-up/`, OAuth callback | Already crawled unauthenticated in T-014; re-crawl the FORM SUBMISSION + redirect flow |
| `/es/mi-cuenta/favoritos/` | FavoriteButton, MoveToCollectionModal islands |
| `/es/mi-cuenta/colecciones/` and `/colecciones/[id]/` | CreateEditCollectionModal, CollectionDetailActions |
| `/es/mi-cuenta/historial/` | Activity feed |
| `/es/mi-cuenta/propiedades/*` | Owner forms (large surface — many inputs, file upload, image previews) |
| `/es/suscriptores/precios/` | Public but worth re-crawling once authenticated to check upgrade CTAs |
| `/es/suscriptores/checkout/` → MercadoPago Brick load | **Highest risk** — third-party payment widget |

**Acceptance**: a markdown report at `verification-authenticated-2026-MM-DD.md` covering the same 6 assertions T-014 used, plus a new assertion (g): MercadoPago Brick loads and operates without CSP-driven failure (defined precisely in workstream 2.D).

#### 2.B MercadoPago Brick CSP integration (new)

MercadoPago's Brick widget loads JS bundles, calls back-end APIs, and embeds an iframe for sensitive card-data entry. Each of those needs CSP allowlist entries:

| MP behavior | CSP directive likely affected | Likely value to add |
|---|---|---|
| Loads SDK from `sdk.mercadopago.com/js/v2` | `script-src` (covered by `'strict-dynamic'` + nonce IF the snippet is inline AND walker-stamped) | none if stamped; verify |
| Iframe `mlstatic.com` / `mercadopago.com` for PCI-scoped card input | `frame-src` | currently `'none'` — needs `https://*.mercadopago.com https://*.mlstatic.com` |
| API calls to MP gateway | `connect-src` | `https://api.mercadopago.com` (or whatever the actual host is) |
| Hosted images (logos, card-type icons) | `img-src` | `https://*.mlstatic.com` |
| Webfonts (if MP loads any) | `font-src` | `https://*.mlstatic.com` likely |

**Acceptance**: a successful test payment in staging from a logged-in test account using MP test credentials with the final hardened CSP active and zero browser CSP errors.

**Reference**: MP docs require updating CSP — see [MercadoPago dev docs CSP section](https://www.mercadopago.com.ar/developers/en/docs/checkout-bricks/additional-content/security/csp).

#### 2.C `/es/` home does NOT emit the CSP header (was `GAP-046-FOLLOWUP-HOME-CSP-HEADER`)

**Observed in T-014**: every route emits `Content-Security-Policy-Report-Only` on the response, EXCEPT `/es/` (home). The body still carries nonce-stamped tags (so middleware ran), but the header itself is missing from the response. The same was true before AND after SPEC-046 deploys — pre-existing, not introduced by SPEC-046.

**Why this MUST be resolved before Phase 2 enforce**: if the home page has no policy active, an attacker that lands on it (e.g. from external link) has a window with no CSP protection. In Report-Only this is silent; in enforce it becomes a real attack surface differential.

**Likely causes** (investigate):

1. Astro `staticHeaders: true` interaction with prerender hint on the home route — the middleware may be running but the response object is replaced downstream by the node adapter.
2. Coolify / Traefik layer stripping headers from specific paths (unlikely — `X-Robots-Tag` is preserved on the same response).
3. Some `Astro.locals` short-circuit on `/es/` that I missed.

**Diagnostic plan** (≈ 1-2 hours):

- Curl `staging.hospeda.com.ar/es/` with verbose tracing to see which proxy/server stage drops the header.
- Add temporary debug logging to middleware step 9 to confirm it executes for `/es/` and that the header is set on the response before return.
- If middleware DOES set the header but it doesn't arrive, suspect node-adapter / Vite ssr / Astro internal response wrapping.

**Acceptance**: `/es/` emits `Content-Security-Policy-Report-Only` (or `Content-Security-Policy` after Phase 2 flip) with the same directives as other routes.

#### 2.D Phase 2 — flip Report-Only to enforce

**Pre-requisites** (all must be green):

- 2.A authenticated crawl finds zero unresolved violations
- 2.B MercadoPago Brick passes a successful payment with hardened CSP active
- 2.C home page emits the CSP header consistently
- Sentry has been running `report-uri` ingestion for at least 14 days (currently SPEC-046 has been in Report-Only since 2026-05-17) so we have real-traffic violation data, not just synthetic crawls. Goal: at the time of flip, the trailing-7-day count of net-new violation types ingested is **zero**.

**Mechanism**: in `apps/web/src/lib/middleware-helpers.ts`, swap the header name from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`. That's the entire code change. A re-deploy then enforces.

**Rollback**: revert the one-line change, re-deploy. The CSP body content is identical — what changes is browser action (REPORT vs. BLOCK).

**Acceptance**: header name flipped, Sentry-side violation ingestion drops to zero or near-zero (excluding the GAP-046-10 eval probe report which we accept), no user reports of broken UX in the first 48 hours of enforce.

#### 2.E Optional cleanups (nice-to-have, can ship anytime)

| Item | Effort | Value |
|---|---|---|
| Add Sentry `beforeSend` filter to drop the GAP-046-10 eval-probe reports | small (1-2h) | Less Sentry ingest noise; the probe is benign so the reports are noise. |
| Logo-pattern blind-spot sweep: grep `style=.*\$\{` across `apps/web/src/` and audit any results that interpolate a finite-enum value into a CSS property declaration | small-medium (2-4h) | Pre-empts a Phase-2 surprise where a SPEC-046-T-006-blind-spot inline style triggers a real block. |
| Sentry environment config fix: `import.meta.env.MODE` always evaluates to `'production'` on built artifacts, so staging traces show under "production" in Sentry. Wire `HOSPEDA_ENV` (or equivalent) per Coolify deploy. | small (1h) | Lets us filter staging vs prod data in Sentry; useful for Phase-2 dashboarding. |
| Tracing sample-rate ramp: `tracesSampleRate: 0.1` is fine for prod cost but starves staging. Bump staging to `1.0` via env-controlled config. | tiny (30 min) | More CWV data when QA navigates staging. |

### 3. Acceptance criteria summary

| Workstream | Done when |
|---|---|
| 2.A Auth crawl | `verification-authenticated-YYYY-MM-DD.md` committed + assertions (a)–(g) green |
| 2.B MP Brick | Successful staging payment + zero CSP errors in browser console during checkout |
| 2.C Home header | Curl on `/es/` shows the CSP header |
| 2.D Phase 2 flip | One-line header rename merged + 48-hour soak shows no user impact |
| 2.E Cleanups | At your discretion; not required for spec closure |

Spec is **complete** when 2.A + 2.B + 2.C + 2.D are green. 2.E is optional polish.

### 4. Out of scope (explicit)

- **Replacing CF Web Analytics with Umami end-to-end** — that lives in SPEC-140. SPEC-142 just inherits whatever analytics stack is current at the time of Phase-2 flip.
- **Cookie-consent rewiring** — current behavior (Sentry behind analytics consent, CF Web Analytics unconditional) is acceptable. If we move CWV measurement out of CF, the consent decision changes; that's SPEC-140 territory.
- **CSP Level 3 advanced directives** like `Trusted Types`, `require-trusted-types-for` — orthogonal hardening for a later cycle.
- **Server-side billing / payment logic changes** — only the CSP allowlist surface is in scope here.

### 5. Risks

| Risk | Mitigation |
|---|---|
| MP Brick deeply needs `'unsafe-inline'` or `'unsafe-eval'` (some payment widgets do for legacy reasons) | The acceptance criterion is "zero CSP errors during checkout". If MP genuinely requires unsafe-eval, we either degrade `script-src` for just the checkout route (route-specific CSP via middleware) or accept the trade-off and document it. Decided in workstream 2.B execution. |
| Phase 2 flip surfaces new violations from logged-in users we never tested | Mitigated by 2.A. If still happens post-flip, the one-line revert restores Report-Only behavior immediately. |
| Sentry CWV gating by cookie consent under-samples real Phase-2 data | Out of scope of this spec, but worth raising with the product owner. The data we DO have is the consenting subset; that's the operating reality of a privacy-friendly stack. |

### 6. Dependencies

- **SPEC-046** must be closed (14/15 tasks done; T-015 deferred to this spec).
- **SPEC-140 (Umami) ** is NOT a hard dependency. SPEC-142 ships independently of analytics stack composition.
- **MercadoPago test credentials** for staging must be valid at the time of 2.B execution.
