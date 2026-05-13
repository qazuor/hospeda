---
spec-id: SPEC-108
title: Newsletter MVP — Post-Merge Follow-Ups
type: chore
complexity: medium
status: draft
created: 2026-05-13T07:30:00Z
effort_estimate_hours: 3-5
tags: [newsletter, tech-debt, quality, test-infra]
extracted_from: SPEC-101 pre-merge audit (PR #1061)
---

# SPEC-108: Newsletter MVP — Post-Merge Follow-Ups

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Close the three known follow-ups carried over from SPEC-101's pre-merge audit:

1. **T-108-01** — Switch the admin campaign template renderer from synchronous `react-dom/server.renderToStaticMarkup` to asynchronous `@react-email/render`. The current sync path produces working HTML but skips react-email's CSS inlining and Tailwind passes — emails may render slightly off in some clients (links / footer styles in particular).
2. **T-108-02** — Notify the admin when a newsletter campaign closes with `failed > 0` deliveries. Today the data is visible in the admin metrics panel, but admins find out only by clicking in. A proactive notification (email or in-app) when `closeSentCampaigns` finalises a campaign with any failed rows shortens response time on Brevo outages.
3. **T-108-03** — Stop the `newsletter.test.ts` integration suite from failing when `apply-postgres-extras.sh` itself fails on CI. The integration-setup already swallows the error and warns "tests that require triggers/views should skip via `it.skipIf()`", but the newsletter tests do not. Either: (a) wrap the newsletter integration tests in `it.skipIf(!postgresExtrasApplied)`, or (b) fix the setup so `apply-postgres-extras.sh` is reliable on CI (preferred).

**Why now:** All three are bounded, low-risk improvements to a feature that just shipped. The cost of leaving them is paid in (a) email styling oddities going unnoticed, (b) silent failure modes for staging campaigns hitting transient Brevo errors, and (c) flaky integration suite causing false-red PRs.

**Why a new spec (not part of SPEC-101 or SPEC-103):**

- **Not SPEC-101**: SPEC-101 is "newsletter MVP" and shipped 60/60. Adding these would re-open the spec for non-MVP polish.
- **Not SPEC-103**: SPEC-103 closed already. T-108-03 touches the same infra (apply-postgres-extras hygiene) but is triggered by SPEC-101's newsletter tests, not by SPEC-103's deliverables.
- **Not SPEC-106**: SPEC-106 is docs CI cleanup (broken links + validate-examples hang). Newsletter follow-ups are runtime / test-infra, not docs.

**Audience:** Solo developer (qazuor). Each task is independently scoped — they can land in three small PRs or one bundled PR.

### 2. Out of Scope

- New newsletter features (additional channels, scheduling UI, segment filters, A/B testing). SPEC-101 deliberately scoped these out — see SPEC-101 spec.
- Refactoring `NewsletterCampaignService` or `NewsletterDeliveryService` beyond what each task requires.
- Rewriting `apply-postgres-extras.sh`. T-108-03 only needs the newsletter integration tests to stop failing when the script doesn't run.
- Visual redesign of the admin metrics panel. T-108-02 only adds a notification; the panel itself stays as-is.

---

### 3. Tasks

#### T-108-01 — Async render in campaign delivery

**Goal:** Replace the `react-dom/server.renderToStaticMarkup` shim in `apps/api/src/services/newsletter/delivery-factory.ts` with the proper `@react-email/render` async path so the emails ship with CSS inlining and Tailwind processing.

**Files (expected):**

- `packages/service-core/src/services/newsletter/newsletter-delivery.service.ts` — change `RenderCampaignEmailFn` type from `=> string` to `=> string | Promise<string>` (or `=> Promise<string>`).
- `packages/service-core/src/services/newsletter/newsletter-delivery.service.ts` — `processBatch`: rewrite the `eligibleDeliveries.map(...)` block to `await Promise.all(eligibleDeliveries.map(async (delivery) => ...))`. Touch points are ~lines 597-630.
- `apps/api/src/services/newsletter/delivery-factory.ts` — drop `renderToStaticMarkup` + `react-dom/server` import, switch to `render` from `@react-email/render`, return `await render(NewsletterCampaign({...}))`.
- `apps/api/package.json` — drop `@types/react-dom` devDependency added by SPEC-101 (only there for the sync renderer).
- Existing tests in `packages/service-core/test/services/newsletter/newsletter-delivery.service.test.ts` may need to be updated to stub the renderer as async.

**Acceptance:**

- `pnpm --filter @repo/service-core test newsletter` passes.
- `pnpm --filter hospeda-api typecheck` passes.
- Manual smoke: `Send test` from admin to a real inbox produces an email visually equivalent to the react-email playground render.

**Risk:**

- `processBatch` is in the hot path. The change introduces parallel rendering with `Promise.all` — be careful not to introduce per-recipient state mutation across the map.
- Watch for `react-dom` peer dependency warnings in any package that imported the previous workaround.

**Estimated effort:** 1-2 hours.

---

#### T-108-02 — Admin notification on campaign close with `failed > 0`

**Goal:** When `NewsletterCampaignService.closeSentCampaigns()` transitions a campaign to `sent` and the campaign has any `failed` deliveries, send a notification to the campaign creator (or to a configured admin distribution list) summarising the failure count.

**Files (expected):**

- `packages/service-core/src/services/newsletter/newsletter-campaign.service.ts` — extend `closeSentCampaigns()` to count `failed` rows per closed campaign and emit a notification when `failed > 0`. Use the existing `NotificationService.send()` plumbing.
- `packages/notifications/src/templates/newsletter/` — add `newsletter-campaign-closed-with-failures.tsx` template (mirror the existing notification template patterns).
- `packages/notifications/src/types/` — add a notification type enum value (`NEWSLETTER_CAMPAIGN_FAILED_DELIVERIES` or similar). Wire through transports.
- `packages/service-core/test/services/newsletter/newsletter-campaign.service.test.ts` — assertion that the notification is fired when `failed > 0` and skipped when `failed === 0`.

**Acceptance:**

- A campaign that closes with `failed > 0` triggers `NotificationService.send(...)` exactly once.
- The same campaign closing with `failed === 0` does NOT trigger the notification.
- The notification body includes campaign subject, total recipients, delivered, failed, and a link to the admin campaign detail page.

**Risk:**

- The cron job runs every 5 minutes. Make sure the notification is sent only on the transition (NOT every subsequent cron tick after the campaign is already `sent`). Use the `closeSentCampaigns` return value (the campaign rows actually transitioned in this run) as the notification source.

**Estimated effort:** 1 hour.

---

#### T-108-03 — Stop `newsletter.test.ts` from failing when `apply-postgres-extras.sh` fails

**Goal:** Make the newsletter integration suite resilient to a non-fatal `apply-postgres-extras.sh` failure on CI. Today, when the script fails, the integration-setup logs a warning and continues, but `packages/db/test/integration/newsletter.test.ts` asserts on indexes and constraints that the script creates, so the suite reports 5 false-red tests.

The integration-setup itself says: "Tests that require triggers/views should skip via `it.skipIf()`". The newsletter tests do not honour that contract.

**Two ways to land this:**

**Option A — surgical skip (preferred for speed):**

- `packages/db/test/integration/newsletter.test.ts` — wrap each affected test in `it.skipIf(!postgresExtrasApplied)`. Use the setup's `postgresExtrasApplied` boolean if it exports one, or introspect the DB before each test (`SELECT 1 FROM pg_indexes WHERE indexname = ...`).

**Option B — fix the root cause (preferred long-term):**

- `packages/db/scripts/apply-postgres-extras.sh` — investigate why it intermittently fails on CI. Hypothesis: `psql` client missing on the GitHub Action runner image when the setup-pnpm step did not install it. Either: (i) ensure `apt-get install -y postgresql-client` in the CI workflow, (ii) replace the shell script with the existing `apply-postgres-extras.mjs` (Node script that uses the `pg` driver — no `psql` dependency), or (iii) add a retry with exponential backoff.

**Acceptance:**

- A CI run with `apply-postgres-extras.sh` deliberately failing produces 0 newsletter integration test failures (either tests skip cleanly with a reported "skipped" count, or tests pass because the script always runs).
- A CI run with `apply-postgres-extras.sh` succeeding still produces 9/9 newsletter tests green.

**Risk:**

- Option A masks the real problem (the script flake). If we ship A, file a tracking task for B inside this spec.
- Option B may surface other tests that silently relied on the script not running.

**Estimated effort:** 30 minutes (Option A) — 1 hour (Option B if `psql` install fixes it).

---

### 4. Sequencing

Tasks are independent — they can land in any order. Recommended order if one bundled PR:

1. T-108-03 first (clears the flaky CI surface).
2. T-108-01 second (test in isolation that emails look right).
3. T-108-02 third (depends on the notification plumbing being in a known-good state).

If shipping one task at a time, T-108-03 still goes first to keep CI honest.

---

### 5. Acceptance Criteria

This spec is "done" when:

- [ ] T-108-01 lands and `Send test` from admin produces a visually correct email (verified by sending to a real inbox).
- [ ] T-108-02 lands and a forced-failure dry run (simulated `failed > 0`) produces exactly one admin notification.
- [ ] T-108-03 lands and Integration Tests are green on 3 consecutive PRs without re-runs.

---

## Part 2 — Implementation Notes

### Origin

Surfaced during the SPEC-101 pre-merge audit (post-merge of staging into the SPEC-101 branch in PR #1061). Each item was triaged as "non-MVP-blocking" so SPEC-101 could ship; this spec captures them as the explicit follow-up surface.

### When to start

- **T-108-03 (test flake)**: as soon as Integration Tests start flapping on unrelated PRs. The fix is small.
- **T-108-01 (async render)**: after the first staging run shows ANY visual oddity in a delivered campaign email, OR pre-emptively before the first real-traffic campaign in production.
- **T-108-02 (admin notification)**: any time. No external dependency. Operationally most valuable once real-traffic campaigns are running and Brevo outages become a thing we observe.

### Sequencing relative to active specs

- **SPEC-101 (newsletter MVP, merged)**: T-108-* are pure follow-ups on its surface.
- **SPEC-106 (docs CI cleanup)**: orthogonal — no overlap.
- **SPEC-104 / SPEC-105**: independent.

### Risks

| Risk | Mitigation |
|---|---|
| T-108-01 introduces a regression in the hot-path renderer | Land behind manual `Send test` validation. Existing service-core tests cover happy path; add a snapshot test of the rendered HTML to lock in the output shape. |
| T-108-02 spams the admin on a long Brevo outage (e.g., 50 campaigns × N batches each) | The notification is per-campaign-close, not per-batch-failure. Cron runs every 5 minutes. Maximum noise is bounded by the count of campaigns transitioning per tick. If this is still too noisy, gate behind a configurable threshold (`failed_ratio > X%`) in a follow-up. |
| T-108-03 Option A hides the root cause | The spec explicitly tracks Option B as the long-term fix. Option A is a 30-minute unblock for the integration suite; the underlying script flake stays on the radar. |
