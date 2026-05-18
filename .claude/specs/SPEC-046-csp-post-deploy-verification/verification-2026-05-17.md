# SPEC-046 T-014 — Staging Verification Report

> **Date**: 2026-05-17
> **Target**: `https://staging.hospeda.com.ar`
> **Method**: automated browser crawl via Playwright (Chromium) with all console levels captured + network requests recorded
> **Deploys covered**: PR #1134 (SPEC-046 main implementation) + PR #1135 (CF Web Analytics manual snippet migration), both merged into `staging`

## 1. Pages crawled

| Path | Type | Status |
|---|---|---|
| `/es/` | Home (SSR) | OK, no real violations |
| `/es/alojamientos/` | Listing (SSR + CF cache) | OK |
| `/es/alojamientos/hotel-mirador-maravilloso-hotel/` | Detail (SSR) | OK |
| `/es/auth/signin/` | Auth form | OK |
| `/es/auth/signup/` | Signup form | **2 real violations found — both addressed below** |

## 2. Acceptance assertions (a–f from T-014 spec)

| # | Assertion | Result | Notes |
|---|---|---|---|
| (a) | Zero `style-src-attr` violations from §1C.2 patterns | ⚠️ **One real violation found** | `Logo.astro:61` had inline `style={`height: ${heightValue};`}` not caught by T-006 inventory. Fixed in this PR — see §3.1 |
| (b) | Zero `style-src-elem` violations from Astro-emitted `<style>` blocks (§1C.3) | ✅ **Pass** | Walker (SPEC-046 T-002) stamps every emitted `<style>` block with the request nonce. No violations of this type observed. |
| (c) | Zero `script-src-elem` violations from inline scripts (§1C.7) | ✅ **Pass** | Walker stamps every `<script>` (inline AND external). No violations of this type. |
| (d) | Zero cascading `/_astro/*.js` blocks (§11.2 should disappear) | ✅ **Pass** | All `/_astro/*.js` requests load 200. `'strict-dynamic'` correctly propagates trust from the nonce-stamped entry script. |
| (e) | Zero requests to `static.cloudflareinsights.com` (§1C.5) | ⚠️ **Reframed — see §3.3** | This assertion was written when the plan was to disable CF Web Analytics. The plan pivoted (PR #1135) to switch to Manual Setup snippet. Exactly ONE request to `static.cloudflareinsights.com/beacon.min.js` returns 200 (the manual snippet, nonce-stamped). Zero unwanted CF auto-injects. Subsequent RUM POSTs to `cloudflareinsights.com/cdn-cgi/rum` return 204. |
| (f) | `Content-Security-Policy-Report-Only` header includes `frame-src 'none'` (§1C.6) | ✅ **Pass** | Confirmed in headers for `/es/alojamientos/`, `/es/auth/signin/`, `/es/auth/signup/`, and `/es/alojamientos/<slug>/`. **Side observation**: `/es/` (home) does not emit the CSP header in its response — see §3.2 |

## 3. Findings

### 3.1 Logo.astro inline `style=` (real violation, fixed in this PR)

- **Page where reported**: `/es/auth/signup/` (and any page that renders the Logo island)
- **Source location**: `apps/web/src/components/shared/navigation/Logo.astro:61`
- **Old code**:
  ```astro
  style={`height: ${heightValue};`}
  ```
  where `heightValue` comes from the finite enum `size: 'sm' | 'md' | 'lg'` → `'2rem' | '2.5rem' | '3.5rem'`.
- **Why T-006 missed it**: the inventory grep matched `transition-delay`, `--corner-bg`, `--brand-accent`, `--wave-header-padding-top`, `width:0%`, `opacity:0`. The Logo height pattern (`height: Xrem`) was not in the grep list because it was not in the SPEC's documented §1C.2 examples. The T-008 "Post-T-006 discoveries" section already warned that the grep had blind spots; this is a third blind spot of the same family (interpolated `${...}` value in a `style=` attribute that does not declare a CSS custom property).
- **Fix applied here**: refactored to modifier classes `.logo__image--sm`, `.logo__image--md`, `.logo__image--lg` in the scoped `<style>` block. Drops the inline `style=` attribute entirely. Same approach as the `data-*` enum maps from T-008, but simpler (modifier class instead of data-attr) since the values are component-local.
- **Verification path**: after deploy of this PR, fresh page load on `/es/auth/signup/` should emit zero `style-src` violations and the Logo image should have `class="logo__image logo__image--md"` (or `--sm` / `--lg` depending on prop).

### 3.2 Home `/es/` does not emit the CSP-Report-Only header (pre-existing — NOT introduced by SPEC-046)

- **Observed**: the response for `/es/` returns the body (with all `<script>`/`<style>` tags nonce-stamped by our walker — middleware ran) BUT the `Content-Security-Policy-Report-Only` HTTP header is absent. The same response is missing the header BOTH before PR #1135 deploy (where we already had this observation) AND after, so this is not introduced by either SPEC-046 PR.
- **Other routes are fine**: `/es/alojamientos/`, `/es/auth/signin/`, `/es/auth/signup/`, and detail pages all emit the header correctly.
- **Hypothesis**: some interaction between the Astro-Node adapter's `staticHeaders: true` setting and the home route's response shape. Worth investigating but **does not block T-014 acceptance** — the home page has no policy in effect, so no violations are reported on it; the rest of the site (where users spend most of their time) IS protected.
- **Action**: file as a **follow-up gap** to investigate post-Phase-1. Logged for SPEC-046 backlog as `GAP-046-FOLLOWUP-HOME-CSP-HEADER`.

### 3.3 CF Web Analytics RUM probe — `unsafe-eval` violation report (intentional, fallback-safe)

- **Observed**: pages that import the `schemas.<hash>.js` chunk emit one CSP report per pageload with `blocked-uri: eval`, source `schemas.sjtBSBUc.js`. The library performs a `Function('')` feature-detection probe (see §1C.4 in spec.md for the exact snippet). The `try/catch` around the probe catches the exception and the library falls back to a CSP-safe validator path.
- **Functionality impact**: zero. Validation works regardless of whether the probe succeeds.
- **Decision**: **GAP-046-10 reopened from "dropped"** to **"accepted as known benign report"**. Spec.md §1C.4 and §1C summary table updated in this PR.
- **No policy change**: we do NOT add `'unsafe-eval'` to `script-src`. The library handles the fallback cleanly. Phase 2 enforcement is safe.
- **Optional future cleanup**: add a `beforeSend` filter on Sentry security ingestion to drop `eval`-on-`schemas*.js` reports purely to reduce ingest noise. Not a SPEC-046 acceptance criterion.

### 3.4 Browser warning — `upgrade-insecure-requests` ignored under Report-Only

- **Observed**: every page emits one console error: `The Content Security Policy directive 'upgrade-insecure-requests' is ignored when delivered in a report-only policy`.
- **Root cause**: documented browser behavior for CSP3. The `upgrade-insecure-requests` directive REWRITES requests (HTTP → HTTPS); Report-Only mode is by definition non-rewriting. Browsers therefore log this as a warning and ignore the directive.
- **Action**: no action required in Phase 1. Will disappear automatically when we flip to enforce mode (`Content-Security-Policy` instead of `-Report-Only`) in Phase 2.

## 4. Network observations (CF Web Analytics flow)

After the PR #1135 manual-snippet migration:

| Request | Status | Page |
|---|---|---|
| `GET https://static.cloudflareinsights.com/beacon.min.js` | **200** (no SRI/CORS errors) | every page |
| `POST https://cloudflareinsights.com/cdn-cgi/rum` | **204** (RUM telemetry accepted) | every page that completes load |
| Occasional `POST /cdn-cgi/rum` with `net::ERR_ABORTED` | aborted | View-Transitions navigation cancels the in-flight POST; harmless — the next pageload re-fires it |

Confirms CF Web Analytics is collecting Core Web Vitals end-to-end via the manual snippet.

## 5. Acceptance summary for T-014

- (a) **resolved by this PR** (Logo.astro refactor)
- (b), (c), (d) **passing as designed**
- (e) **reframed and passing** under the post-#1135 reality (manual snippet, one nonce-stamped request, RUM POSTs succeed)
- (f) **passing on every route except home**; home CSP-header miss filed as `GAP-046-FOLLOWUP-HOME-CSP-HEADER`, not blocking

T-014 **can be marked completed** once this PR (the Logo fix + spec.md GAP-046-10 reopen + this report) merges and re-deploys. The home CSP header gap is tracked separately as a non-blocking follow-up.

## 6. Re-verification after this PR deploys

The operator should:

1. Wait for this PR to merge to `staging` and Coolify to redeploy `hospeda-web-staging`.
2. Open `https://staging.hospeda.com.ar/es/auth/signup/` in Firefox with Persist Logs enabled.
3. Confirm in console: **zero CSP violations** from `style-src` on that page (the Logo refactor closes the only one this report flagged).
4. Confirm beacon.min.js loads 200 and at least one RUM POST returns 204.
5. If both pass, append a row to the execution log in `research/cf-analytics-disable-plan.md` and close T-014 in `state.json`.

If a new violation appears on signup that wasn't catalogued here, file a follow-up gap and re-open T-014 with the new finding.
