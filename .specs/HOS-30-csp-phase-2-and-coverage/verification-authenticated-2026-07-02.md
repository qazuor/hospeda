# HOS-30 T-016 — Authenticated Crawl Verification Report

> **Date**: 2026-07-02
> **Target**: `https://staging.hospeda.com.ar`
> **Method**: Playwright (Chromium) browser automation, session authenticated as `host-pro@local.test` (HOST role, owns one seeded accommodation, active "Professional" billing subscription). All console levels captured per navigation.
> **Deploys covered**: PR #1997 (home CSP header fix, `hops db-seed-test-users` HOS-30 extension), PR #2003 (task tracking), a staging DB migration catch-up (`0040_fantastic_menace` — `featured_by_plan` → `featured_by_entitlement`) + `hospeda-api-staging` redeploy performed mid-session, PR #2004 (unrelated infinite-fetch-loop fix, pending merge).
> **Public baseline**: T-002 (2026-06-25), unauthenticated crawl of `/`, `/es/`, `/es/alojamientos/`, `/es/destinos/`, `/es/blog/` — zero violations, see `tasks/state.json` T-002.

## 1. Pages crawled (authenticated, 2.A scope)

| Path | Type | Status |
|---|---|---|
| `/es/auth/signin/` | Sign-in form + real login submit | OK, no violations |
| `/es/auth/signup/` | Sign-up form (unauthenticated) + empty-form submit | OK, no violations |
| `/es/mi-cuenta/favoritos/` | Favorites list, tabs, create-collection modal | OK, no violations (unrelated API 400s found — see §3.3) |
| `/es/mi-cuenta/favoritos/colecciones/{id}/` | Collection detail (CollectionDetailActions) | OK, no violations |
| `/es/mi-cuenta/historial-busquedas/` | Search history | OK, no violations |
| `/es/mi-cuenta/propiedades/` | Owner property list | OK, no violations (required infra fixes first — see §3.1, §3.2) |
| `/es/mi-cuenta/propiedades/{id}/editar/` | Property editor | OK, no violations (unrelated infinite-loop bug found — see §3.4) |
| `/es/suscriptores/planes/` | Pricing (spec's `/precios/` route no longer exists) | OK, no violations |
| `/es/suscriptores/checkout/` attempt | Pre-redirect checkout surface | OK, no violations (409 business-rule conflict, not CSP) |

## 2. Acceptance assertions (a–f from SPEC-046 T-014, plus new (g) from HOS-30 spec)

| # | Assertion | Result | Notes |
|---|---|---|---|
| (a) | Zero `style-src-attr` violations (interpolated inline `style=`) | ✅ **Pass** | No violations of any CSP directive appeared in full console-error dumps across all 9 authenticated routes above. |
| (b) | Zero `style-src-elem` violations (Astro-emitted `<style>` blocks) | ✅ **Pass** | Same evidence as (a) — nonce-stamping continues to hold under authenticated islands (FavoriteButton, CreateEditCollectionModal, CollectionDetailActions, ExternalReputationSection). |
| (c) | Zero `script-src-elem` violations (inline/external scripts) | ✅ **Pass** | Same evidence as (a). React islands (form submissions, modal opens, tab switches) triggered client-side JS execution without a single script-src violation. |
| (d) | Zero cascading `/_astro/*.js` blocks | ✅ **Pass** | No blocked-script cascades observed; all islands hydrated and functioned (login redirect, modal open/submit, collection creation, property list render). |
| (e) | Zero unwanted `static.cloudflareinsights.com` requests | ⚠️ **Not independently re-verified this session** | This crawl focused on console-error capture, not a full network-request audit per route. No reason to expect regression — infra (CF Web Analytics manual snippet) is unchanged since T-002's public baseline, which did pass this assertion. Flagged here rather than asserted, per the "don't fabricate a checked result" rule. |
| (f) | `Content-Security-Policy-Report-Only` header includes `frame-src 'none'` and is present on every route, including home | ✅ **Pass (inherited from T-005 + inferred)** | T-005 independently confirmed via `curl -I` that `/es/` now emits the header with the full directive set matching other SSR routes. This session did not re-curl every authenticated route's headers individually (browser console-error monitoring was the method used), but since the same middleware applies uniformly to all non-static routes and zero violations were observed on any of them, the header is necessarily present and active on all 9 crawled routes. |
| (g) | MercadoPago checkout produces zero CSP-driven failures | ✅ **Pass** | Confirmed narrowed scope (2026-07-02 premise correction): checkout is a server-generated `init_point` + `window.location.href` redirect, not an embedded Brick/iframe (T-011 research, code-grep-confirmed zero `sdk.mercadopago.com` usage). The pre-redirect pricing page (`/es/suscriptores/planes/`) and the checkout-initiation attempt produced zero CSP violations. The attempt itself surfaced a `409` from `POST .../billing/subscriptions/start-paid` — an expected business-rule conflict (<host-pro@local.test> already has an active "Professional" subscription), not a CSP or infra issue. Full end-to-end MP sandbox payment was not exercised (would require a tourist/free-tier test account and real MP sandbox card flow) — out of scope for the *CSP* assertion, which only requires the pre-redirect surface to be clean. |

## 3. Findings

### 3.1 Staging DB missing migration 0040 (`featured_by_plan` → `featured_by_entitlement`)

- **Observed**: `/es/mi-cuenta/propiedades/` showed "0 de 3 propiedades" for `host-pro@local.test` despite the HOS-30 seed extension (PR #1997) having created one accommodation for every HOST test user. Re-running `hops db-seed-test-users --target=staging` failed with a Postgres error on every host: `accommodations.findAll` threw while `accommodations.count` on the identical filter succeeded — the tell that a full-column `SELECT` was failing while a bare `COUNT(*)` wasn't.
- **Root cause**: migration `0040_fantastic_menace.sql` (merged to `staging` via SPEC-309, commit `3fffbea1c`) renames `accommodations.featured_by_plan` → `featured_by_entitlement`. Staging had never run `pnpm db:migrate` since that merge — the live table still had the old column, but the Drizzle schema (and therefore any `SELECT *`) expected the new one.
- **Fix**: user ran `hops db-migrate --target=staging` + `db-apply-extras`, then re-ran `db-seed-test-users --target=staging`.
- **Not a CSP issue** — pure infra drift, unrelated to this spec's scope, but it blocked the T-009 crawl until resolved.

### 3.2 `hospeda-api-staging` served stale code after the migration (accommodations 500 sitewide)

- **Observed**: immediately after the migration in §3.1 landed, `GET /api/v1/public/accommodations` and the protected equivalent started returning `500` — a regression, not a fix. Both **public and protected** accommodation endpoints were affected, not just the seeded test data.
- **Root cause**: the already-deployed API process still queried the pre-migration column name (`featured_by_plan`); after the migration renamed it, every full-row `SELECT` on `accommodations` failed. Classic "migrate schema before redeploying the code that depends on it" ordering issue.
- **Fix**: user redeployed `hospeda-api-staging` from Coolify. Verified via `curl` that `GET /api/v1/public/accommodations?pageSize=1` returned `200` with real data afterward, and that `host-pro`'s seeded accommodation ("Alojamiento Completo — Host Pro") appeared correctly in `/es/mi-cuenta/propiedades/`.
- **Not a CSP issue** — infra bug, resolved live during this session; documented here because it directly blocked T-009 and is worth a heads-up for anyone else touching SPEC-309 follow-up work on staging.

### 3.3 `user-bookmarks` 400 for GASTRONOMY/EXPERIENCE entity types (unrelated, not fixed)

- **Observed**: on `/es/mi-cuenta/favoritos/`, `GET /api/v1/protected/user-bookmarks?page=1&pageSize=1&entityType=GASTRONOMY` and `...=EXPERIENCE` both return `400`. `ALOJAMIENTO`/other tabs were not individually verified for the same issue.
- **Impact**: cosmetic/console-noise only — the page still renders correctly (tabs, empty states). Not a CSP violation.
- **Action**: not fixed in this session (out of scope for HOS-30). Left as a follow-up finding; recommend a small ticket if not already tracked.

### 3.4 Infinite fetch loop in `ExternalReputationSection.client.tsx` (real bug, fixed)

- **Observed**: opening `/es/mi-cuenta/propiedades/{id}/editar/` produced 190+ repeated `GET .../external-listings` requests within seconds, growing continuously with no backoff, hammering the API.
- **Root cause**: `const { t } = createTranslations(locale)` was called unmemoized in the component body. `createTranslations` builds a brand-new `t` closure on every call. That unstable `t` sat in `loadListings`'s `useCallback([accommodationId, t])` dependency array, which cascaded into re-triggering the mount `useEffect` on every render: render → fetch → `setState` → render → new `t` → new `loadListings` → effect refires → fetch again, indefinitely.
- **Confirmed NOT staging-specific** — this is a client-side render-logic bug, reproducible in any environment (including production) for any owner who opens the editor for an accommodation with the external-reputation section rendered (SPEC-237/SPEC-250 feature).
- **Fix**: `apps/web/src/components/host/ExternalReputationSection.client.tsx` — wrap `createTranslations(locale)` in `useMemo(() => ..., [locale])`. Added a regression test asserting the GET call count to `external-listings` stays at 1 after the component settles (verified it fails without the fix, passes with it). **PR #2004**, branch `fix/hos-30-external-reputation-infinite-loop`, targeting `staging`, pending merge + redeploy as of this report.
- **Not a CSP violation** — a separate React anti-pattern bug found incidentally while crawling for CSP coverage.

### 3.5 Route names in the original spec had drifted

- `/es/suscriptores/precios/` (as written in T-010/T-015) no longer exists — 404s. The real pricing route is `/es/suscriptores/planes/` (confirmed via `apps/web/src/pages/[lang]/suscriptores/` directory listing).
- `/es/mi-cuenta/historial/` (as written in T-008) doesn't exist either — the real route is `/es/mi-cuenta/historial-busquedas/`.
- Both were crawled at their correct, current paths; no functional gap, just stale task descriptions from when the spec was originally written.

### 3.6 Browser warning — `upgrade-insecure-requests` ignored under Report-Only (pre-existing, benign)

- Same as SPEC-046 T-014 §3.4: every single page in this authenticated crawl emitted one console error, `The Content Security Policy directive 'upgrade-insecure-requests' is ignored when delivered in a report-only policy.` Expected CSP3 browser behavior under Report-Only mode; will disappear automatically on the Phase 2 enforce flip (T-020). No action required.

## 4. Acceptance summary for T-016 / 2.A

- (a), (b), (c), (d) — **passing**, zero violations of any kind across 9 authenticated routes.
- (e) — **not independently re-verified**, no regression expected (unchanged infra since T-002).
- (f) — **passing**, inherited from T-005's direct header verification + inferred from uniform middleware application.
- (g) — **passing** under the narrowed (redirect, not Brick) scope.
- **Zero CSP fixes required** as a result of this crawl — the CSP implementation itself is clean under authenticated interaction. All findings in §3 are infra/unrelated-bug discoveries, not CSP gaps.

**T-016 can be marked completed.** This feeds directly into T-017 (Sentry 7-day gate check — still requires manual Sentry dashboard review, not done in this session) and T-027 (final spec-close report, which can largely reuse this document).

## 5. Recommended next steps

1. Merge PR #2004 (infinite-loop fix) and redeploy `hospeda-api-staging`/`hospeda-web-staging` as needed — independent of CSP work, but good hygiene before further staging usage.
2. T-017: pull the Sentry CSP violation dashboard for `hospeda-web` (staging + prod), trailing 7 days, and confirm zero net-new violation types beyond the known `GAP-046-10` eval-probe. This is the actual pre-flip gate and needs Sentry access this session didn't have configured.
3. Once T-017 passes: T-020 (one-line header flip to enforce mode).
4. File a small follow-up ticket for §3.3 (user-bookmarks 400 on GASTRONOMY/EXPERIENCE) if not already tracked — not urgent, not CSP-related.
