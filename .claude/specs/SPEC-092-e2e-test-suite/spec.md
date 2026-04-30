# SPEC-092: End-to-End Test Suite for Pre-Beta Validation

> **Status**: draft
> **Priority**: P0 (blocker for beta launch)
> **Complexity**: High
> **Origin**: Pre-beta readiness — need cross-app, cross-actor coverage validating real user journeys before opening to 10-30 hosts and 100-300 guests
> **Depends on**: SPEC-085 (guest-owner messaging) — MSG-01, REV-01, REV-02 require messaging system implemented before they can be authored
> **Created**: 2026-04-26
> **Revision**: 1
> **Type**: testing-infrastructure
> **Breaking change**: No (additive, new package `apps/e2e`)

---

## Problem Statement

Hospeda has unit tests, integration tests, and per-app component tests, but **no cross-app end-to-end coverage** validating real user journeys. Before opening the platform to beta testers (10-30 hosts paying real money, 100-300 guests browsing real listings), we need automated proof that:

1. The full host lifecycle works: registration, trial onboarding, upgrade to paid plan via MercadoPago, plan downgrade, addon purchases.
2. The full accommodation lifecycle works across apps: a host publishing in admin must be discoverable in the web app within seconds, edits must propagate, deletions must clean up Cloudinary assets.
3. Cross-actor isolation holds: Host A cannot read or modify Host B's data, guests cannot reach admin endpoints, trial users cannot bypass paywalls via direct API calls.
4. Discovery flows work for anonymous and authenticated guests across i18n locales.

Without this coverage, every release to beta carries the risk of a silent regression that only surfaces when a real host loses access to their listing or a real guest sees a broken page.

---

## Goals and Non-Goals

### Goals

- Validate the **24 highest-value user journeys** identified across host, guest, security, and admin actors.
- Run a fast subset (P0, mocked external services) on every PR to `main` (~5 min wall-clock).
- Run the full suite (P0+P1, real MercadoPago sandbox, real Cloudinary) on a nightly schedule (~25-30 min).
- Provide reproducible local execution: every test creates its own data, no reliance on shared mutable state.
- Provide actionable failure artifacts: HTML report, traces, screenshots, video, console logs.
- Document a contract for adding new E2E tests so the suite can grow without rotting.

### Non-Goals (Out of Scope)

- Unit, integration, or component tests (covered by Vitest in their respective packages).
- Visual regression testing (Percy / Chromatic / similar).
- Load testing or performance benchmarking.
- Accessibility audits as a CI gate (accessibility-audit skill remains a manual review tool).
- Production smoke tests (deferred to a separate observability / synthetic monitoring spec).
- Booking flow tests — booking is **explicitly out of platform scope**; Hospeda is discovery + contact only.
- WebSocket / real-time tests (no real-time features in MVP).
- Multi-tenant isolation tests beyond Host A vs Host B (no enterprise/team accounts in MVP).

---

## Overview and Success Metrics

### Overview

This spec introduces a new top-level package `apps/e2e/` containing a Playwright test suite, a `docker-compose.e2e.yml` for the dependencies (Postgres, Redis, Mailpit), helper utilities for test data creation, and CI workflows for PR and nightly execution. The suite covers 24 tests across 7 categories (HOST, ACC, GUEST, SEC, MSG, REV, ADM) split into P0 (16 tests, blocker) and P1 (8 tests, high priority).

The suite uses Playwright as the runner, runs against builds (not dev) in CI, hits a dedicated Postgres instance reset per suite, captures emails via Mailpit, splits MercadoPago between sandbox-real (nightly only) and simulated webhook (PR runs), and uses a real Cloudinary folder per run for the subset of tests tagged `@cloudinary`.

### Success Metrics

- **PR run** (P0 + mocks) completes in under 6 minutes wall-clock with 4 parallel workers.
- **Nightly run** (P0+P1 + sandbox) completes in under 35 minutes.
- **Flake rate** under 2% over a rolling 30-day window. Tests above this threshold are quarantined automatically.
- **Failure-to-diagnosis time** under 10 minutes: a failure must give a developer the trace, video, network log, and console messages to reproduce locally.
- **Coverage of host lifecycle**: 100% of paid-tier states (trial, active, canceled, expired, addon-active) exercised end-to-end at least once.
- **Zero shared mutable state** between tests: any test can run in isolation or in any order.

---

## Actors

- **Anonymous guest**: Non-authenticated visitor on `apps/web`. Searches, browses, may register.
- **Authenticated guest**: Registered platform user with `role=GUEST`. Can favorite, contact hosts, leave reviews post-contact.
- **Host (trial)**: Newly registered user with `role=HOST` in trial subscription. Limited write access.
- **Host (active)**: Host with active paid subscription. Full feature access per plan tier.
- **Host (expired)**: Host whose trial or paid subscription has lapsed. Read-only access until re-upgrade.
- **Super-admin**: Platform staff with `role=SUPER_ADMIN`. Moderation, user management, plan management.
- **System (cron, webhooks)**: MercadoPago webhook deliveries, Mailpit SMTP, Cloudinary callbacks.

---

## Test Catalog

### Tag Vocabulary

| Tag | Meaning |
|-----|---------|
| `@p0` | Blocker for beta launch. Runs on every PR. |
| `@p1` | High priority. Runs nightly only. |
| `@host` | Test focuses on host actor flows. |
| `@guest` | Test focuses on guest actor flows. |
| `@admin` | Test focuses on admin/super-admin flows. |
| `@billing` | Touches subscription, plan, or addon state. |
| `@onboarding` | Touches first-run UX (email verification, tour). |
| `@accommodation` | Touches accommodation lifecycle. |
| `@cross-app` | Test exercises two or more apps in the same run (admin + web). |
| `@cache` | Validates ISR / cache invalidation behavior. |
| `@cloudinary` | Uses real Cloudinary account (folder `e2e/{run-id}/`). |
| `@real-payment` | Uses MercadoPago sandbox (real HTTP calls to MP). Nightly only. |
| `@i18n` | Validates locale switching and translation completeness. |
| `@security` | Validates authorization, isolation, or paywall enforcement. |
| `@messaging` | Touches the conversation/message system from SPEC-085. |
| `@reviews` | Touches the accommodation review system. |
| `@resilience` | Exercises failure paths: timeouts, compensation, idempotency, cron repair. |

### Catalog Summary

| Category | P0 | P1 | Total |
|----------|----|----|-------|
| HOST (onboarding & billing) | 6 | 1 | 7 |
| ACC (accommodation lifecycle) | 4 | 0 | 4 |
| GUEST (discovery) | 3 | 0 | 3 |
| SEC (security & isolation) | 3 | 0 | 3 |
| MSG (messaging) | 0 | 1 | 1 |
| REV (reviews) | 0 | 2 | 2 |
| ADM (admin platform) | 0 | 4 | 4 |
| **Total** | **16** | **8** | **24** |

---

## P0 Tests — HOST (Onboarding & Billing)

### HOST-01: Web→admin onboarding handoff with atomic role promotion + first publish

> **Architecture**: this test exercises the redesigned host onboarding flow
> (commit `e8da0f9ab`, 2026-04-29). Signup creates `users.role=USER`. The web
> `/publicar/nueva` mini-form posts to `POST /api/v1/protected/host-onboarding/start`,
> which creates the DRAFT and atomically promotes the owner USER -> HOST in
> the same transaction (so the owner can immediately access the admin panel,
> which gates on `ACCESS_PANEL_ADMIN`). The trial is NOT created here. The
> owner then completes the listing in admin and clicks Publicar; the
> `lifecycleState=ACTIVE` PATCH gets routed through `AccommodationService.publish`
> which (a) calls QZPay to start the trial OUTSIDE the DB transaction and
> (b) flips lifecycleState to ACTIVE in a short transaction. If the local
> transaction fails after the QZPay call succeeded, `cancelTrial` runs as
> compensation.

- **Actors**: New host (starts as USER)
- **Tags**: `@p0 @host @onboarding @billing @cross-app`
- **Estimated runtime**: ~90s (covers BOTH apps)
- **Preconditions**:
  - Email address does not exist in `users` table.
  - At least one trial plan exists in `billing_plans` (suite-level seed).
  - At least one CITY destination exists in `destinations` (suite-level seed).
  - Mailpit is reachable on `mailpit:1025` / `mailpit:8025`.
  - Either MP sandbox creds OR a stub HTTP server pinned to the same QZPay
    contract — see Test Harness Notes below.
- **Steps (web leg, browser context A on `apps/web`)**:
  1. Navigate to `/es/publicar` → click `Publicar mi alojamiento`.
  2. Inline signup with random email + strong password.
  3. Poll Mailpit for verification email (max 10s), click the link → return
     to `/es/publicar/nueva` automatically.
  4. **Assert DB**: `users.role='USER'`, `email_verified=true`, no
     `billing_subscriptions` row, no `accommodations` row for this user.
  5. Mini-form renders 4 fields (name, summary, type, cityDestination).
  6. Fill with realistic data → submit → assert response is
     `{ status: 'created', accommodationId: <uuid>, accommodationSlug: <kebab> }`
     within 5s.
  7. **Assert DB**: a) one `accommodations` row with `lifecycleState='DRAFT'`,
     `lastWarnedAt=null`, `ownerId` matching the new user; b) `users.role` is
     now `'HOST'` (atomic role promotion); c) still NO `billing_subscriptions`
     row for this owner.
  8. Browser is redirected to `${HOSPEDA_ADMIN_URL}/accommodations/{id}/edit`.
- **Steps (admin leg, browser context A continues on `apps/admin`)**:
  9. Admin route guard (`_authed.tsx`) accepts the session because the role
     is now HOST and `ACCESS_PANEL_ADMIN` is granted to HOST. Assert no
     redirect to `/auth/forbidden`.
  10. Property edit screen is prefilled with the 4 mini-form fields.
  11. Fill remaining required sections (location coords, capacity, price).
  12. Click `Publicar`. Watch the network panel: a single PATCH goes out
      with body containing `lifecycleState='ACTIVE'`, response 200 within 10s.
  13. **Assert DB**: a) `accommodations.lifecycleState='ACTIVE'`;
      b) one `billing_subscriptions` row with `status='trialing'` and
      `customer_id` linked to this user via `billing_customers.external_id`;
      c) `users.role` is still `'HOST'` (no double-promote).
  14. Navigate to `/es/alojamientos/{slug}` (web) → property publicly visible
      within ISR window.
- **Idempotency assertions** (re-fire the original mini-form):
  15. From web context A, call `POST /api/v1/protected/host-onboarding/start`
      again with the same body. Response must be
      `{ status: 'already_host', accommodationId: null, accommodationSlug: null }`.
      No new `accommodations` row inserted.
- **Asserts**:
  - Better Auth session cookie is shared between web and admin (same
    `HOSPEDA_BETTER_AUTH_URL`); session role reflects HOST after admin lands.
  - Email verification arrives within 10s.
  - Mini-form submit -> redirect lands on admin without any extra auth challenge.
  - DB invariants per steps 4, 7, 13 above.
  - No Sentry errors during the run.
- **Generated data**: 1 user, 1 active accommodation (ACTIVE), 1 billing
  customer, 1 trial subscription.
- **Cleanup**: `SET session_replication_role='replica'` to bypass the
  pre-existing `delete_entity_bookmarks` trigger bug (T-XXX), DELETE
  cascade-style across `accommodations`, `billing_subscriptions`,
  `billing_customers`, `users`, then restore replication role.

### HOST-02: Trial → upgrade to paid plan via MercadoPago sandbox

- **Actors**: Host (trial)
- **Tags**: `@p0 @host @billing @real-payment`
- **Estimated runtime**: ~90s
- **Preconditions**:
  - Trial host created via API helper (skips UI to save time).
  - MercadoPago sandbox credentials in env (`HOSPEDA_MP_ACCESS_TOKEN`, `HOSPEDA_MP_PUBLIC_KEY`).
  - Webhook reachable: nightly via ngrok tunnel; PR runs via simulated POST to webhook handler.
- **Steps**:
  1. Login admin with the trial host's session.
  2. Navigate to Billing → Plans, select `Pro` (or equivalent paid tier).
  3. Click `Upgrade`, follow redirect to MercadoPago checkout.
  4. Complete checkout with test card Visa `4509 9535 6623 3704`, CVV `123`, exp `11/30`.
  5. MP redirects back to admin success URL.
  6. Wait for webhook delivery (poll `billing_subscriptions.status` for `active`, max 30s). PR mode: helper fires the simulated POST immediately after step 5.
  7. Assert UI now shows `Plan Pro active`.
  8. Use a feature that was previously paywalled (e.g. sponsorship management) — must succeed.
- **Asserts**:
  - `billing_subscriptions.status=active`, `plan_id=pro`, `current_period_end` set ~30 days out.
  - `billing_payments` row created with `status=approved`.
  - `billing_customers` row links user to MP customer ID.
  - Permissions for the new plan are immediately effective.
- **Generated data**: 1 user, 1 active subscription, 1 payment, 1 MP customer.
- **Cleanup**: Cancel subscription on MP sandbox + cascade delete user.

### HOST-03: Trial expiration blocks writes, preserves reads

- **Actors**: Host (trial expired)
- **Tags**: `@p0 @host @billing`
- **Estimated runtime**: ~30s
- **Preconditions**:
  - Host created with `trial_end_date` forced to the past via DB helper.
  - One pre-existing published accommodation linked to the host.
- **Steps**:
  1. Login admin.
  2. Assert banner `Trial expired` with CTA `Upgrade now`.
  3. Click `Edit` on the existing accommodation — assert blocked with upgrade modal (not 500).
  4. Verify read-only flows still work: dashboard loads, accommodation list visible, accommodation detail readable.
  5. Issue `PUT /api/v1/admin/accommodations/:id` directly — must return `403` or `402 Payment Required`.
- **Asserts**:
  - All write actions blocked (UI + API).
  - All read actions succeed.
  - User is not signed out (read-only mode is not authentication failure).
- **Generated data**: 1 expired-trial user, 1 accommodation.
- **Cleanup**: Cascade delete user (cleans accommodation).

### HOST-04: Paid plan cancellation, grace period, expiration

- **Actors**: Host (active → canceled → expired)
- **Tags**: `@p0 @host @billing`
- **Estimated runtime**: ~45s
- **Preconditions**:
  - Active paid host created via API helper (`current_period_end` 7 days out).
- **Steps**:
  1. Login → Billing → `Cancel subscription` → confirm.
  2. Assert `subscription.status=canceled`, `current_period_end` unchanged (still in the future).
  3. Verify all paid features still accessible during grace period.
  4. Force `current_period_end` to the past via DB helper.
  5. Reload UI → assert paid features now blocked, banner reads `Subscription expired`.
- **Asserts**:
  - `canceled` state during grace allows full access.
  - `expired` state (computed when `now > current_period_end` AND `status=canceled`) blocks paid features.
  - User retains read access to existing data.
- **Generated data**: 1 user transitioning through 3 states.
- **Cleanup**: Cascade delete user.

### HOST-05: Addon purchase activates feature immediately

- **Actors**: Host (active)
- **Tags**: `@p0 @host @billing`
- **Estimated runtime**: ~30s
- **Preconditions**:
  - Active paid host created via API helper.
  - Addon (e.g. `extra-photos`) configured in `billing_addons`.
  - MP mock active (no sandbox call).
- **Steps**:
  1. Login → Addons → select `Extra photos`.
  2. Click `Purchase`, complete simulated payment (test helper triggers the MP webhook with success payload).
  3. Assert addon shows as active in the UI.
  4. Use the feature unlocked by the addon (e.g. upload photo beyond the base plan limit).
- **Asserts**:
  - `billing_addon_purchases` row with `status=active`.
  - Entitlement check returns `true` for the addon's feature flag.
  - Feature is usable end-to-end (file actually uploads).
- **Generated data**: 1 user, 1 addon purchase, 1 photo upload.
- **Cleanup**: Cascade delete user (cleans Cloudinary upload via existing hardDelete hook).

### HOST-06: Password reset flow (P1)

- **Actors**: Host (existing)
- **Tags**: `@p1 @host @auth`
- **Estimated runtime**: ~30s
- **Preconditions**:
  - Existing host user with verified email.
- **Steps**:
  1. Navigate to admin login → `Forgot password`.
  2. Submit email, poll Mailpit for reset email.
  3. Click reset link, set new password.
  4. Login with new password — must succeed.
  5. Login with old password — must fail.
- **Asserts**:
  - Password hash in DB updated.
  - Old password rejected with auth error.
  - Reset token invalidated after use (clicking link a second time fails).
- **Generated data**: 1 user (preexisting in DB, mutated).
- **Cleanup**: Restore original password hash via DB helper.

### HOST-07: Onboarding edge cases (idempotency, compensation, cron demote)

> Companion to HOST-01. HOST-01 covers the happy path; this test covers the
> branches that protect us against partial failure: the `resumed` idempotency
> contract, the `subscription_required` rejection, the QZPay-cancel
> compensation when the local transaction fails after a trial was created,
> and the role demotion done by the `archive-abandoned-drafts` cron.

- **Actors**: Three independent users at different stages
  - U1: USER who calls the mini-form twice in a row (idempotency)
  - U2: HOST whose only accommodation gets archived (cron demote)
  - U3: USER with a stale subscription (subscription_required path)
- **Tags**: `@p0 @host @onboarding @billing @resilience`
- **Estimated runtime**: ~120s (lots of state setup, no UI rendering for
  most of it — fixture-driven via API helpers)
- **Preconditions**:
  - Same as HOST-01.
  - The `archive-abandoned-drafts` cron handler is invokable directly via
    a test-only `POST /api/v1/admin/cron/run` admin endpoint, OR exposed
    via `pnpm --filter hospeda-api exec tsx scripts/run-cron.ts archive-abandoned-drafts`.
  - A controllable QZPay stub server (or a feature flag in the
    `buildAccommodationPublishDeps` factory) that lets the test simulate
    `startTrial` succeeding while the next local DB write fails.

#### Subtest 7a: idempotency on mini-form retry

  1. Create U1 via API helper (signup + email verify), confirm role=USER.
  2. POST `/api/v1/protected/host-onboarding/start` with valid body — assert
     `status='created'`, capture `accommodationId`.
  3. Hard-reset the session cookie (or just reuse it), POST same body again.
  4. **Assert** response is `status='already_host'` (because U1 is now HOST
     and the service short-circuits on role).
  5. Manually demote U1 back to USER via SQL helper (synthesise legacy data).
  6. POST same body again — assert `status='resumed'`, `accommodationId`
     equals the one from step 2.
  7. Re-read `users.role` — assert `HOST` (defense-in-depth re-promotion fired).

#### Subtest 7b: subscription_required rejection on republish

  1. Create U3 via API helper, promote to HOST, insert a `billing_subscriptions`
     row with `status='canceled'` (no active sub).
  2. Create a DRAFT accommodation owned by U3 via API helper.
  3. PATCH `/api/v1/admin/accommodations/{id}` with `lifecycleState='ACTIVE'`.
  4. **Assert** response 403 with message containing `subscription_required`.
  5. **Assert DB**: accommodation is still `DRAFT`, no new
     `billing_subscriptions` row inserted.
  6. Frontend leg: from admin UI, the `Publicar` click surfaces a localized
     error and a CTA to `/suscriptores/planes` (not silent failure).

#### Subtest 7c: QZPay timeout returns 503, no DB writes

  1. Create U2 as HOST with no `billing_subscriptions` row.
  2. Create a DRAFT accommodation owned by U2.
  3. Configure the QZPay stub to reject `startTrial` after 9s (over the 8s
     timeout) OR to return 500.
  4. PATCH `/api/v1/admin/accommodations/{id}` with `lifecycleState='ACTIVE'`.
  5. **Assert** response 503 with `service_unavailable` message.
  6. **Assert DB**: accommodation still `DRAFT`, no
     `billing_subscriptions` row, role still HOST.

#### Subtest 7d: post-trial-tx failure triggers cancelTrial compensation

  1. Reuse U2 from 7c (still no subscription).
  2. Configure the QZPay stub: `startTrial` returns OK with subscription id.
  3. Configure a DB hook (test-only env var or service spy) so the next
     `accommodations.update` fails with a deterministic error.
  4. PATCH the accommodation with `lifecycleState='ACTIVE'`.
  5. **Assert** response 500.
  6. **Assert** the QZPay stub recorded a `cancelTrial(<sub-id>)` call within
     the request lifetime (compensation fired).
  7. **Assert DB**: accommodation still `DRAFT`, NO `billing_subscriptions`
     row (the row was never inserted because the failing update aborted
     the tx; the QZPay-side trial got cancelled by the compensation).
  8. **Assert logs**: structured warn with key
     `[accommodation.publish] Local tx failed after trial creation; trial cancelled as compensation`.

#### Subtest 7e: cron demotes HOST -> USER after last draft archived

  1. Create U2's draft from 7c (still DRAFT, USER promoted to HOST during
     creation).
  2. Backdate the draft's `updated_at` to NOW() - 31 days via SQL helper.
  3. Trigger the `archive-abandoned-drafts` cron in production mode (not
     dry-run).
  4. **Assert DB**: a) the draft is now `ARCHIVED`; b) `users.role` is now
     `'USER'` (auto-demote because the user has no remaining non-archived
     accommodations); c) `billing_customers` row still exists (we only
     touched the role).
  5. Repeat with a user who has TWO drafts. Backdate ONE. Run cron.
     **Assert DB**: the backdated draft is ARCHIVED, the other still DRAFT,
     `users.role` is still HOST (because they still have a non-archived
     accommodation).

- **Generated data**: 3 users, ~5 accommodations across DRAFT/ACTIVE/
  ARCHIVED, 1 trial subscription (cancelled), 1 cancelled subscription
  (pre-staged for 7b).
- **Cleanup**: bypass triggers (`session_replication_role='replica'`),
  cascade delete users + accommodations + billing rows.

#### Test harness notes

The QZPay stub (referenced by 7c and 7d) is the same one used by HOST-02
and HOST-03 nightly tests. PR runs use the stub variant; nightly uses
the real MP sandbox via ngrok tunnel. The stub server speaks the QZPay
HTTP contract on a configurable port and supports per-test
`failNext` / `delayNext` / `recordCalls` controls so subtests can drive
specific failure modes deterministically.

---

## P0 Tests — ACC (Accommodation Lifecycle)

### ACC-01: Host publishes, guest discovers via search

- **Actors**: Host (active) + Anonymous guest (two parallel browser contexts)
- **Tags**: `@p0 @accommodation @cross-app @cloudinary`
- **Estimated runtime**: ~120s
- **Preconditions**:
  - Active paid host created via API helper.
  - Cloudinary credentials configured for E2E folder `e2e/{run-id}/`.
- **Steps host (context A)**:
  1. Login admin → `New accommodation`.
  2. Fill all required fields: title, description (es/en/pt), location (destination + coordinates), capacity, price, type, amenities.
  3. Upload 5 photos to the gallery (real Cloudinary upload).
  4. Click `Publish`.
- **Steps guest (context B)**:
  5. Open `apps/web` home page.
  6. Search for the destination of the new accommodation.
  7. Assert the accommodation appears in search results with correct title and price.
  8. Click the result card → detail page loads.
  9. Verify all 5 photos render via Cloudinary URLs.
  10. Verify price, description (in current locale), amenities, map all match what host entered.
- **Asserts**:
  - `accommodations.status=published`, `accommodations.published_at` set.
  - 5 rows in `accommodation_media` with valid Cloudinary `public_id` values.
  - Search index includes the accommodation (may require materialized view refresh — helper waits up to 5s).
  - Public URL responds `200`.
- **Generated data**: 1 host, 1 accommodation, 5 photos in Cloudinary folder.
- **Cleanup**: Delete accommodation via admin (validates cleanup hook fires Cloudinary deletion), then cascade delete host.

### ACC-02: Host edit propagates to web (cache invalidation)

- **Actors**: Host (active) + Anonymous guest
- **Tags**: `@p0 @accommodation @cross-app @cache`
- **Estimated runtime**: ~45s
- **Preconditions**:
  - Host with one published accommodation (created via API helper to skip ACC-01).
- **Steps**:
  1. Guest opens accommodation detail URL, captures displayed price.
  2. Host logs in admin, edits accommodation price (+20%).
  3. Guest reloads the detail page.
  4. Assert new price is visible within 30s (ISR revalidation budget).
- **Asserts**:
  - Cache key for the accommodation is invalidated on update.
  - New value visible in web within revalidation budget.
- **Generated data**: 1 host, 1 accommodation.
- **Cleanup**: Cascade delete.

### ACC-03: Host unpublishes — accommodation disappears for guests

- **Actors**: Host (active) + Anonymous guest
- **Tags**: `@p0 @accommodation @cross-app`
- **Estimated runtime**: ~30s
- **Preconditions**:
  - Host with one published accommodation.
- **Steps**:
  1. Guest verifies accommodation URL returns `200` and search shows it.
  2. Host unpublishes the accommodation.
  3. Guest reloads URL — must return `404` or redirect to `/search`.
  4. Guest re-runs the search — accommodation must not appear.
- **Asserts**:
  - `accommodations.status=draft` (or equivalent unpublished state).
  - Public URL no longer reachable.
  - Search index updated.
- **Generated data**: 1 host, 1 accommodation.
- **Cleanup**: Cascade delete.

### ACC-04: Soft delete cleans up Cloudinary assets

- **Actors**: Host (active)
- **Tags**: `@p0 @accommodation @cloudinary`
- **Estimated runtime**: ~30s
- **Preconditions**:
  - Host with one published accommodation containing 3 Cloudinary photos.
- **Steps**:
  1. Host hard-deletes the accommodation via admin UI (or API direct if no UI for hard delete).
  2. Verify `accommodations.deleted_at` is set in DB.
  3. Query Cloudinary Admin API for each `public_id` — must return `not found`.
  4. Public URL must return `404`.
- **Asserts**:
  - DB soft-delete recorded.
  - All 3 Cloudinary assets removed (validates `_afterHardDelete` hook from SPEC-078).
  - Public route confirms removal.
- **Generated data**: 1 host, 1 deleted accommodation, 3 deleted Cloudinary assets.
- **Cleanup**: Cascade delete host.

---

## P0 Tests — GUEST (Discovery)

### GUEST-01: Search, filter, paginate, view detail

- **Actors**: Anonymous guest
- **Tags**: `@p0 @guest @discovery`
- **Estimated runtime**: ~60s
- **Preconditions**:
  - Suite-level seed populates 25+ accommodations across 3 destinations, mixed types and price ranges.
- **Steps**:
  1. Open web home page.
  2. Search by destination `Concepción del Uruguay`.
  3. Apply price range filter.
  4. Apply type filter `country-house`.
  5. Verify result set matches filters (every result has type=country-house and price in range).
  6. Navigate to next page; verify URL updates and new results load.
  7. Click a card → detail page loads with gallery, map, description, amenities, contact CTA.
- **Asserts**:
  - Filter logic correctly narrows results.
  - Pagination works without duplicate or missing rows across pages.
  - Detail page renders all required components.
- **Generated data**: None (uses shared seed, read-only).
- **Cleanup**: None.

### GUEST-02: i18n locale switching across pages

- **Actors**: Anonymous guest
- **Tags**: `@p0 @guest @i18n`
- **Estimated runtime**: ~30s
- **Preconditions**:
  - Suite-level seed includes accommodations with translations in `es`, `en`, `pt`.
- **Steps**:
  1. Open `/es/`, capture key UI strings (header nav, search button label).
  2. Switch to `/en/`, verify URL changed and same strings now in English.
  3. Switch to `/pt/`, repeat.
  4. Click into an accommodation detail in `pt`, verify translated description.
  5. Use the language switcher from a deep page, verify locale preserved on internal links.
- **Asserts**:
  - No missing i18n keys logged in console.
  - URLs include locale segment correctly.
  - All visible UI strings change with the locale.
- **Generated data**: None.
- **Cleanup**: None.

### GUEST-03: Guest registration and favorites persistence

- **Actors**: New guest
- **Tags**: `@p0 @guest @auth`
- **Estimated runtime**: ~45s
- **Preconditions**:
  - Email not in DB.
  - Suite seed has at least 5 published accommodations.
- **Steps**:
  1. Web sign-up form with random email, password, name.
  2. Verify email via Mailpit link.
  3. Mark 3 accommodations as favorites.
  4. Logout.
  5. Login again with the same credentials.
  6. Navigate to `/favorites` — assert all 3 favorites still present.
- **Asserts**:
  - `users` row with `role=GUEST`, `email_verified=true`.
  - `user_favorites` rows for the 3 accommodations.
  - Favorites survive a logout/login cycle (not session-only).
- **Generated data**: 1 guest user, 3 favorite rows.
- **Cleanup**: Cascade delete user.

---

## P0 Tests — SEC (Security & Isolation)

### SEC-01: Host A cannot access Host B's resources

- **Actors**: Host A (active) + Host B (active)
- **Tags**: `@p0 @security`
- **Estimated runtime**: ~30s
- **Preconditions**:
  - Two active hosts created via API helper, each with one accommodation.
- **Steps**:
  1. Login as Host A.
  2. Open URL `/admin/accommodations/{id-of-B-accommodation}/edit` directly — must return `403` or `404` (not the edit form).
  3. Issue `GET /api/v1/admin/accommodations/{id-of-B}` with A's token — must return `403`.
  4. Issue `PUT` and `DELETE` for the same resource with A's token — must return `403`.
  5. Verify B's accommodation is unchanged in DB.
- **Asserts**:
  - All cross-host access attempts blocked (UI + API).
  - No data leakage in error responses (no titles, no internal IDs leaked beyond the requested ID).
- **Generated data**: 2 hosts, 2 accommodations.
- **Cleanup**: Cascade delete both hosts.

### SEC-02: Common guest cannot reach admin surfaces

- **Actors**: Authenticated guest
- **Tags**: `@p0 @security`
- **Estimated runtime**: ~20s
- **Preconditions**:
  - Guest user (role=GUEST) created via API helper.
- **Steps**:
  1. Login web as guest.
  2. Open `apps/admin` (port 3000) directly — must redirect to admin login or show forbidden.
  3. Issue requests to `/api/v1/admin/accommodations`, `/api/v1/admin/billing/plans`, `/api/v1/admin/users` with guest token — must all return `403`.
- **Asserts**:
  - Admin app rejects guest sessions.
  - Admin API endpoints reject guest tokens.
- **Generated data**: 1 guest user.
- **Cleanup**: Cascade delete.

### SEC-03: Trial host cannot bypass paywall via direct API calls

- **Actors**: Host (trial)
- **Tags**: `@p0 @security @billing`
- **Estimated runtime**: ~30s
- **Preconditions**:
  - Trial host created via API helper.
- **Steps**:
  1. With the trial host's token, attempt `POST /api/v1/admin/sponsorships` (requires paid plan).
  2. Attempt `POST /api/v1/admin/billing/addon-purchases` for an addon requiring active subscription.
  3. Attempt to bulk-publish more accommodations than trial allows.
- **Asserts**:
  - Each request returns `403` or `402 Payment Required`.
  - No partial side-effects (no rows created, no Cloudinary uploads triggered).
- **Generated data**: 1 trial host.
- **Cleanup**: Cascade delete.

---

## P1 Tests — MSG (Messaging)

### MSG-01: Guest contacts host, host replies, guest sees response

- **Actors**: Anonymous guest + Host (active)
- **Tags**: `@p1 @messaging @cross-app`
- **Estimated runtime**: ~60s
- **Preconditions**:
  - Host with one published accommodation.
  - Guest already registered (authenticated path).
  - SPEC-085 conversation/messaging feature implemented.
- **Steps**:
  1. Guest opens accommodation detail page in web.
  2. Click `Contact host` CTA, fill subject and message body.
  3. Submit — confirmation toast appears.
  4. Switch to host context (admin app).
  5. Open inbox — assert new conversation visible with correct subject and unread badge.
  6. Open conversation, read guest's message, reply with text body.
  7. Switch back to guest context, navigate to `/messages` — assert host's reply visible in the thread.
- **Asserts**:
  - `conversations` row created with correct guest and host references.
  - Two `messages` rows (guest's initial, host's reply) with correct `direction` values.
  - Email notification queued for both directions (verify via `conversation_notification_schedules` rows).
  - Unread counts update correctly on both sides.
- **Generated data**: 1 host, 1 guest, 1 conversation, 2 messages, 2 notification schedules.
- **Cleanup**: Cascade delete both users.

---

## P1 Tests — REV (Reviews)

> Reviews are gated by **post-contact**: a guest may only leave a review for an accommodation whose host they have previously contacted via the messaging system (SPEC-085). There is no booking concept — Hospeda is discovery + contact only.

### REV-01: Guest leaves review after contacting host

- **Actors**: Authenticated guest + Host (active)
- **Tags**: `@p1 @reviews @messaging @cross-app`
- **Estimated runtime**: ~60s
- **Preconditions**:
  - Host with one published accommodation.
  - Guest registered and has at least one closed conversation with the host (created via API helper using SPEC-085 endpoints).
- **Steps**:
  1. Guest opens the accommodation detail page.
  2. `Leave a review` CTA is visible (because of the prior contact); for accommodations the guest has not contacted, the CTA is hidden.
  3. Submit review: rating 4/5, text body.
  4. Confirm submission, assert review appears in the page (or in `/my-reviews` if there's moderation).
- **Asserts**:
  - `accommodation_reviews` row created with `guest_user_id`, `accommodation_id`, rating, body.
  - Review visible publicly on the accommodation detail page (assuming no moderation queue) or queued for approval if moderation is on.
  - A second guest who has NOT contacted the host does not see the `Leave a review` CTA on the same page.
- **Generated data**: 1 host, 1 guest, 1 conversation, 1 review.
- **Cleanup**: Cascade delete users.

### REV-02: Host responds to a review

- **Actors**: Host (active) + Authenticated guest
- **Tags**: `@p1 @reviews @cross-app`
- **Estimated runtime**: ~30s
- **Preconditions**:
  - Existing review on host's accommodation (created via API helper).
- **Steps**:
  1. Host logs in admin, opens reviews section.
  2. Opens the review, submits a public response.
  3. Switch to guest context, open the accommodation detail page.
  4. Assert host's response visible attached to the review.
- **Asserts**:
  - `accommodation_reviews.host_response` populated.
  - Response visible publicly.
- **Generated data**: 1 host, 1 guest, 1 review with response.
- **Cleanup**: Cascade delete users.

---

## P1 Tests — ADM (Admin Platform)

### ADM-01: Super-admin moderates reported content

- **Actors**: Super-admin + Host (active)
- **Tags**: `@p1 @admin`
- **Estimated runtime**: ~45s
- **Preconditions**:
  - Super-admin account in seed.
  - Host with one accommodation that has been flagged (via API helper inserting a `content_reports` row).
- **Steps**:
  1. Login as super-admin.
  2. Open moderation queue.
  3. Open the report; review the accommodation.
  4. Approve or reject; verify the resulting state on the accommodation.
- **Asserts**:
  - Report status updated (`approved` or `rejected`).
  - Side-effect on the accommodation correct (e.g. unpublished if rejected, no change if approved).
  - Audit log entry created for the moderation action.
- **Generated data**: 1 host, 1 accommodation, 1 report (preexisting), 1 audit log.
- **Cleanup**: Cascade delete host.

### ADM-02: Super-admin views billing metrics dashboard

- **Actors**: Super-admin
- **Tags**: `@p1 @admin`
- **Estimated runtime**: ~30s
- **Preconditions**:
  - Suite seed includes a known mix of trial / active / canceled subscriptions.
- **Steps**:
  1. Login as super-admin.
  2. Navigate to Metrics dashboard.
  3. Verify totals: trial users, active subscribers, MRR, churn rate.
  4. Compare numbers against expected values from seed.
- **Asserts**:
  - Each metric matches the seeded counts within a known tolerance (e.g. MRR ± rounding).
  - No 5xx errors during dashboard load.
- **Generated data**: None (read-only against seed).
- **Cleanup**: None.

### ADM-03: Super-admin user management — suspend and reactivate

- **Actors**: Super-admin + target user
- **Tags**: `@p1 @admin`
- **Estimated runtime**: ~45s
- **Preconditions**:
  - Target user (host) created via API helper with active session.
- **Steps**:
  1. Login as super-admin.
  2. Open Users → select target user → click `Suspend`.
  3. In a parallel context, target user attempts login → must fail with suspension message.
  4. Super-admin clicks `Reactivate`.
  5. Target user retries login → must succeed.
- **Asserts**:
  - `users.suspended_at` set then cleared.
  - Suspended user's existing sessions invalidated immediately.
  - Reactivation restores full access.
- **Generated data**: 1 target user.
- **Cleanup**: Cascade delete target user.

### ADM-04: Super-admin manages plans and addons

- **Actors**: Super-admin
- **Tags**: `@p1 @admin`
- **Estimated runtime**: ~45s
- **Preconditions**:
  - Existing plans in seed.
- **Steps**:
  1. Login as super-admin.
  2. Open Plans → create new plan with random name and price.
  3. Verify plan appears in the host signup flow (open admin sign-up in incognito context, plan is offered).
  4. Edit existing plan price; verify existing active subscriptions retain their original price (immutability of historical pricing).
  5. Deactivate the new plan; verify it disappears from the signup flow.
- **Asserts**:
  - `billing_plans` row created and updates respect immutability rules.
  - Active subscriptions are not retroactively modified by plan price changes.
- **Generated data**: 1 plan (created and deactivated).
- **Cleanup**: Hard-delete the test plan via DB helper after the test.

---

## E2E from SPEC-096

> **Origin**: SPEC-096 (web beta readiness) — REQ-096-39.
> **Source task**: SPEC-096 T-070.
> **Status**: Pending — defined here as additional E2E test definitions to be authored after the core SPEC-092 catalog. Each entry below should be promoted to a full test card (with Actors / Tags / Preconditions / Steps / Asserts) when scheduled.
> **Tracking note**: SPEC-092 does not currently have a `state.json` task tracker. When tasks are generated for SPEC-092, these 10 entries MUST be appended as tasks T-100 through T-109 (or the next free range), each with `complexity: 3`, `phase: "spec-096-e2e"`, `tags: ["e2e", "from-spec-096"]`, `status: "pending"`, `blockedBy: []`.

The following 10 cross-app E2E flows from SPEC-096 REQ-096-39 are added to the SPEC-092 scope. They cover the web beta readiness journeys not already covered by the existing P0/P1 catalog and must be authored as part of the SPEC-092 implementation.

### E2E-1: Anonymous browse → search → results → entity detail → contact form

- **Tags**: `@p0 @guest @discovery @cross-app @from-spec-096`
- **Description**: Anonymous browse → search → results → entity detail → contact form.
- **Detailed steps**: Visit web home as anonymous user, perform a search (free text + at least one filter), navigate to a results page, click into an entity detail page, open the contact form, and submit it (or assert the form is reachable and validates).
- **Source**: SPEC-096 REQ-096-39 #1.

### E2E-2: Signup → onboarding → publish → mi-cuenta/propiedades visible

- **Tags**: `@p0 @host @onboarding @cross-app @from-spec-096`
- **Description**: Signup → onboarding → publish → `mi-cuenta/propiedades` visible.
- **Detailed steps**: Sign up a new user on web, complete the host onboarding flow, publish a listing, then navigate to `/mi-cuenta/propiedades` and assert the published listing is visible.
- **Source**: SPEC-096 REQ-096-39 #2.

### E2E-3: Authenticated favorite toggle round-trip on accommodation

- **Tags**: `@p0 @guest @favorites @cross-app @from-spec-096`
- **Description**: Authenticated favorite toggle on accommodation → `/mi-cuenta/favoritos` shows it → remove → empty state.
- **Detailed steps**: As an authenticated guest, toggle the favorite control on an accommodation detail page, navigate to `/mi-cuenta/favoritos` and assert the accommodation appears, remove it from favorites, and assert the empty state is rendered.
- **Source**: SPEC-096 REQ-096-39 #3.

### E2E-4: Authenticated review submission and visibility

- **Tags**: `@p0 @guest @reviews @cross-app @from-spec-096`
- **Description**: Authenticated review submission → `/mi-cuenta/resenas` shows it → click entity → detail.
- **Detailed steps**: As an authenticated guest, submit a review on an entity, navigate to `/mi-cuenta/resenas`, assert the new review appears, click through to the reviewed entity, and assert the entity detail page loads.
- **Source**: SPEC-096 REQ-096-39 #4.

### E2E-5: Profile edit on web → admin reflects changes

- **Tags**: `@p0 @profile @cross-app @from-spec-096`
- **Description**: Profile edit on web → save → admin `/me/profile` reflects changes.
- **Detailed steps**: As an authenticated user, edit profile fields on the web app, save, then open the admin app at `/me/profile` (same user) and assert the edited fields are reflected.
- **Source**: SPEC-096 REQ-096-39 #5.

### E2E-6: Profile edit on admin → web reflects changes

- **Tags**: `@p0 @profile @cross-app @from-spec-096`
- **Description**: Profile edit on admin → save → web `/mi-cuenta/editar` reflects changes.
- **Detailed steps**: As an authenticated user with admin access, edit profile fields in the admin app, save, then open the web app at `/mi-cuenta/editar` (same user) and assert the edited fields are reflected.
- **Source**: SPEC-096 REQ-096-39 #6.

### E2E-7: Theme toggle isolation between web and admin

- **Tags**: `@p1 @theme @cross-app @from-spec-096`
- **Description**: Theme toggle in web → admin `themeAdmin` unchanged.
- **Detailed steps**: Toggle the theme in the web app for an authenticated user, then verify in the admin app that the user's `themeAdmin` preference (and admin UI theme) is unchanged. Confirms the two theme preferences are independent.
- **Source**: SPEC-096 REQ-096-39 #7.

### E2E-8: Subscription cancel flow

- **Tags**: `@p0 @host @billing @cross-app @from-spec-096`
- **Description**: Subscription cancel flow → status update → email sent.
- **Detailed steps**: As an active host, initiate the subscription cancel flow, complete it, and assert (a) `billing_subscriptions.status` transitions to the canceled state and (b) a cancellation email is captured by Mailpit.
- **Source**: SPEC-096 REQ-096-39 #8.

### E2E-9: 404 on broken link — regression of audit

- **Tags**: `@p0 @web @regression @from-spec-096`
- **Description**: 404 on broken link → 0 broken links exist (regression of audit).
- **Detailed steps**: Hit a known-bad URL and assert the web app returns 404 with the proper page. Then run the broken-link audit (or a deterministic subset thereof) against the web app and assert 0 broken internal links remain. Acts as a regression for the broken-links sweep.
- **Source**: SPEC-096 REQ-096-39 #9.

### E2E-10: Filter sub-route ISR cache hit

- **Tags**: `@p1 @web @performance @isr @from-spec-096`
- **Description**: Filter sub-route → ISR cache hit on second visit.
- **Detailed steps**: Visit a filter sub-route on the web app for the first time (cold), then revisit the same route within the ISR window and assert that the second visit is served from the ISR cache (e.g., via response header inspection or measurable response time delta).
- **Source**: SPEC-096 REQ-096-39 #10.

---

## Architecture Decisions

### A. Package layout — dedicated `apps/e2e/`

Tests cross multiple apps (admin, web, api), so they cannot live inside any single app. New top-level package `apps/e2e/` containing Playwright config, tests, fixtures, helpers, and CI scripts.

```
apps/e2e/
├── playwright.config.ts
├── docker-compose.e2e.yml
├── package.json
├── tests/
│   ├── host/
│   ├── accommodation/
│   ├── guest/
│   ├── security/
│   ├── messaging/
│   ├── reviews/
│   └── admin/
├── fixtures/
│   ├── api-helpers.ts        # Programmatic creation of users, subscriptions, accommodations
│   ├── mailpit-client.ts     # Captures emails for verification flows
│   ├── mp-webhook-client.ts  # Simulates MercadoPago webhooks for non-real-payment tests
│   ├── cloudinary-client.ts  # Verifies asset existence/absence
│   └── db-helpers.ts         # Direct DB manipulation for state forcing (expired trials, past period_end)
├── seeds/
│   └── e2e-seed.ts           # 25+ accommodations, plans, super-admin
└── ci/
    ├── pr.yml                # Workflow snippet
    └── nightly.yml
```

### B. Target — build, not dev

Tests run against `pnpm build && pnpm preview` for each app, not the dev server. Reasons:
- HMR causes flaky waits.
- ISR / cache behavior only works with built output.
- Bundles match what ships to production.

Local developer flow: `pnpm e2e:up` brings up docker dependencies + builds + previews + runs.

### C. Database — dedicated Postgres reset per suite

`docker-compose.e2e.yml` defines a fresh Postgres instance on a non-default port (5433) used only by the E2E suite. Reset (drop schema, re-migrate, re-seed) once per test suite run, not per test. Each test creates and cleans its own per-test data on top of the seed.

### D. MercadoPago — split mock vs sandbox

- Tests tagged `@real-payment` (HOST-02 only in P0; potentially HOST-04 in nightly): use real MP sandbox credentials, real HTTP, real webhook delivery via ngrok tunnel (set up by CI workflow at run start).
- All other billing tests: use a `mp-webhook-client.ts` helper that synthesizes a webhook POST with a properly signed payload, simulating MP's callback. No real HTTP to MP.

PR runs only execute the simulated path. Nightly runs the real-payment path.

### E. CI strategy

- **PR to `main`** (`.github/workflows/e2e-pr.yml`): runs P0 with mocks, 4 parallel workers, target ~5 min. Required check.
- **Nightly cron** (`.github/workflows/e2e-nightly.yml`, `0 3 * * *`): runs P0+P1 with sandbox, 2 parallel workers (sandbox rate limits), target ~30 min. Failures notify via existing alert channel.
- **Manual dispatch**: same as nightly, on-demand for pre-release validation.

### F. Reporting

Playwright HTML reporter is published as a workflow artifact for every run. Trace, screenshot, and video are captured on first retry (not first failure, to keep storage bounded). Local `pnpm e2e:report` opens the most recent report.

---

## Operational Decisions (Hospeda-Specific)

### MercadoPago webhook in CI

PR runs use a **simulated webhook** posted by the test helper (`mp-webhook-client.ts`) directly to the API's webhook endpoint with a valid signature. Nightly uses **ngrok tunnel** opened at workflow start, registered with MP sandbox as the webhook URL, torn down at workflow end.

### Cloudinary in CI

A dedicated Cloudinary account (`hospeda-e2e`) is configured. Each run uses folder `e2e/{run-id}/` (run ID = GitHub Actions run ID for CI, `local-{timestamp}` for dev). `afterAll` hook deletes the folder. Tests tagged `@cloudinary` use this real account; all other tests stub the Cloudinary SDK to return synthetic URLs.

### Email verification (Better Auth)

`docker-compose.e2e.yml` includes Mailpit (`axllent/mailpit:latest`). Better Auth is configured with `EMAIL_PROVIDER=smtp` pointing to `mailpit:1025`. The `mailpit-client.ts` helper polls Mailpit's HTTP API (`http://mailpit:8025/api/v1/messages`) to retrieve verification, password reset, and notification emails. This validates the full email path including templates.

### Booking — explicitly out of scope

Hospeda does not implement booking and never will. The platform is discovery + contact only. Reviews are gated by post-contact (SPEC-085 conversation must exist between guest and host before review CTA is visible).

### SPEC-085 dependency

This spec assumes SPEC-085 is **fully implemented** at the time E2E tests are authored. MSG-01 directly tests the messaging system. REV-01 and REV-02 assume the post-contact gate works because the conversation system underlies it.

Implementation order:
1. Author this spec (SPEC-092). ← current step
2. Implement SPEC-085 fully (messaging + conversation gating).
3. Implement SPEC-092 infrastructure and tests.

---

## Test Authoring Contract

To prevent the suite from rotting, every new E2E test must:

1. **Be independent**: create its own data, clean up after itself, never rely on another test's side-effects.
2. **Use fixtures, not raw setup**: any user/subscription/accommodation creation goes through `fixtures/api-helpers.ts`.
3. **Have explicit timeouts**: every `waitFor` has a max budget; no infinite waits.
4. **Tag correctly**: at least `@p0` or `@p1`, plus actor and feature tags.
5. **Document preconditions**: any required seed state listed in the test file's docblock.
6. **Run locally**: a developer can run a single test in isolation with `pnpm e2e:test path/to/test.spec.ts`.
7. **Not skip silently**: tests that depend on incomplete features must `test.fixme(condition, reason)` with an explicit reason and TODO link, not `test.skip()` without context.

---

## Phased Implementation Outline

### Phase 1 — Infrastructure (no tests yet)
- Scaffold `apps/e2e/` package with Playwright + TypeScript config.
- Author `docker-compose.e2e.yml` with Postgres, Redis, Mailpit.
- Author `fixtures/` helpers: API client, DB helpers, Mailpit client, MP webhook client, Cloudinary client.
- Author `seeds/e2e-seed.ts` and the suite-level setup that resets DB and runs the seed.
- Author CI workflows for PR and nightly with the run-time budget targets.

### Phase 2 — P0 critical tests
- HOST-01 through HOST-05 (5 tests).
- ACC-01 through ACC-04 (4 tests).
- SEC-01 through SEC-03 (3 tests).
- GUEST-01 through GUEST-03 (3 tests).
- Validate PR run completes under 6 min.

### Phase 3 — P1 expansion
- HOST-06 (password reset).
- ADM-01 through ADM-04.
- MSG-01 (requires SPEC-085 deployed).
- REV-01, REV-02 (require SPEC-085 deployed).
- Validate nightly run completes under 35 min.

### Phase 4 — Stabilization
- Burn-in over 7 nightly runs to measure flake rate.
- Quarantine any test exceeding 2% flake.
- Document the test authoring contract in `apps/e2e/README.md`.

---

## Dependencies

- **SPEC-085** (Guest-Owner Messaging): MSG-01, REV-01, REV-02 depend on the conversation system. Must land before Phase 3 of this spec begins.
- **SPEC-078** (Cloudinary Image Management): ACC-01, ACC-04, HOST-05 rely on the Cloudinary cleanup hooks. Already implemented.
- **Infrastructure**: GitHub Actions, ngrok account (for nightly real-payment), MercadoPago sandbox credentials, Cloudinary E2E account.
- **Tooling**: Playwright `@playwright/test`, Mailpit, Docker Compose.

---

## Risks and Open Questions

### Risks

- **Sandbox flakiness**: MercadoPago sandbox can be slow or temporarily unavailable. Mitigation: nightly retries x2 with backoff; isolate `@real-payment` failures so they don't fail the whole suite.
- **Cloudinary quota**: heavy E2E runs could exhaust the free tier. Mitigation: separate paid sub-account, monthly usage alert.
- **ngrok stability**: tunnels can drop mid-run. Mitigation: re-establish on failure, fall back to simulated webhook for the affected test if reconnect fails.
- **ISR cache timing**: the 30s budget in ACC-02 may need tuning depending on the actual revalidation strategy. Mitigation: measure during Phase 2 and adjust.
- **Test rot**: as features evolve, selectors and flows break. Mitigation: the test authoring contract + Phase 4 burn-in metric.

### Open Questions

- Does the existing review model already enforce post-contact gating, or does SPEC-085 need to add the join logic? (Resolve during SPEC-085 implementation.)
- Is `accommodation_reviews.host_response` an existing column or does it need a schema migration? (Verify in DB schema review.)
- What is the actual ISR revalidation budget configured for `apps/web` accommodation detail pages? (Read from `apps/web` config; if larger than 30s, adjust ACC-02 budget accordingly.)

---

## Acceptance Criteria

- [ ] `apps/e2e/` package scaffolded with Playwright, Docker Compose, fixtures, and seed.
- [ ] PR workflow runs P0 with mocks, completes in <6 min, marked as required check on `main`.
- [ ] Nightly workflow runs P0+P1 with MP sandbox + Cloudinary, completes in <35 min, alerts on failure.
- [ ] All 23 tests authored and passing in 5 consecutive nightly runs (flake rate <2%).
- [ ] `apps/e2e/README.md` documents the test authoring contract.
- [ ] Trace, screenshot, video captured on first retry; HTML report published as artifact.
- [ ] Each test independently runnable: `pnpm e2e:test {path}` works without other tests.
- [ ] Cleanup verified: no leftover users, accommodations, Cloudinary assets, or MP customers after a full suite run (validated by DB and Cloudinary spot checks).
