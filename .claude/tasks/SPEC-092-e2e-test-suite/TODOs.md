# SPEC-092: End-to-End Test Suite for Pre-Beta Validation

## Progress: 94/99 tasks (~95%)

**Average Complexity:** 2.2 / 3 (ceiling 3 enforced)
**Phases at 100%:** Docs, Revalidation gaps, Infrastructure, Integration tests, CI scripts, P1+SPEC-096, Resilience, **P0 E2E** (Phase 4)
**Phase 0 + Phase 9** require owner intervention or real burn-in runs

All 5 pending tasks are non-coding: 2 owner-manual (T-001/T-002) + 3 burn-in-dependent (T-096/T-097/T-099).

---

## Phase 0 — External Setup (owner-manual, 2 tasks) — 0/2

- [ ] **T-001** (1) — Create MercadoPago sandbox account + application + seller test user
- [ ] **T-002** (1) — Configure MP credentials in GitHub Secrets (blocked by T-001)

## Phase 1 — Documentation Spanish (11 tasks) — 11/11 ✅

- [x] T-003 — Extend first-time-setup.md § 1.7.b — MP test accounts setup (Spanish)
- [x] T-004 — Extend first-time-setup.md § 1.5.b — Cloudinary E2E folder setup (Spanish)
- [x] T-005 — Extend first-time-setup.md § 1.7.c — ngrok manual staging webhook test (Spanish)
- [x] T-006 — checklist-pre-release-manual.es.md skeleton + introducción
- [x] T-007 — AUTH-1..4 (autenticación, 4 items)
- [x] T-008 — MOB-1..5 (móvil, 5 items)
- [x] T-009 — MP-1..6 (MercadoPago, 6 items)
- [x] T-010 — A11Y-1..3 (accesibilidad, 3 items)
- [x] T-011 — SEO-1..4 (SEO + marketing, 4 items)
- [x] T-012 — OTH-1..4 (otros, 4 items)
- [x] T-013 — apps/e2e/README.md (incluye T-095)

## Phase 2 — Revalidation Gaps Fix (9 tasks) — 9/9 ✅

- [x] T-014 — _afterCreate hook DestinationService (verified-existing)
- [x] T-015 — _afterUpdate + _afterUpdateVisibility (verified-existing)
- [x] T-016 — _afterSoftDelete/Restore/HardDelete (verified-existing)
- [x] T-017 — Tests for hooks (verified-existing in service-hooks.test.ts)
- [x] T-018 — `/` home path in entity-path-mapper
- [x] T-019 — 5 new tests for home path
- [x] T-020 — Hierarchy revalidation cascade on reparenting
- [x] T-021 — 2 tests for hierarchy + extended baseServiceFactory mock
- [x] T-022 — assertRevalidationTriggered helper (revalidation_log query)

## Phase 3 — Infrastructure (18 tasks) — 18/18 ✅

- [x] T-023..T-025 — Scaffold apps/e2e (package.json, tsconfig, playwright.config)
- [x] T-026 — CloudinaryProvider folderRoot extension
- [x] T-027 — 9 tests for CloudinaryProvider folderRoot
- [x] T-028 — docker-compose.e2e.yml
- [x] T-029 — build-and-preview helper
- [x] T-030 — cleanup helper (session_replication_role bypass)
- [x] T-031 — api-helpers fixture
- [x] T-032 — db-helpers fixture
- [x] T-033 — mailpit-client fixture
- [x] T-034 — mp-webhook-helper fixture
- [x] T-035 — cloudinary-client fixture
- [x] T-036 — qzpay-test-control 3-layer
- [x] T-037 — e2e-seed.ts
- [x] T-038 — cloudinary-e2e-cleanup cron
- [x] T-039 — e2e-pr.yml workflow
- [x] T-040 — e2e-nightly.yml workflow

## Phase 4 — P0 E2E (20 tasks) — 20/20 ✅

- [x] T-041 — HOST-01: web→admin onboarding handoff + first publish
- [x] T-042 — HOST-02: trial → upgrade via MP sandbox (auto-fixme without secrets)
- [x] T-043 — HOST-03: trial expiration blocks writes
- [x] T-044 — HOST-04: paid plan cancellation + grace + expiration
- [x] T-045 — HOST-05: addon purchase activates feature
- [x] T-046 — HOST-07a: idempotency on mini-form retry
- [x] T-047 — HOST-07b: subscription_required rejection on republish
- [x] T-048 — HOST-07c: QZPay timeout returns 5xx (qzpay-test-control)
- [x] T-049 — HOST-07d: post-trial-tx failure compensation
- [x] T-050 — HOST-07e: cron demotes HOST→USER after last draft archived
- [x] T-051 — ACC-01: host publishes, guest discovers (Cloudinary optional)
- [x] T-052 — ACC-02: host edit propagates via revalidation_log
- [x] T-053 — ACC-03: host unpublishes
- [x] T-054 — ACC-04: soft delete + Cloudinary contract
- [x] T-055 — GUEST-01: search, filter, paginate, view detail
- [x] T-056 — GUEST-02: i18n locale switching
- [x] T-057 — GUEST-03: registration + favorites persistence
- [x] T-058 — SEC-01: cross-host isolation
- [x] T-059 — SEC-02: guest cannot reach admin
- [x] T-060 — SEC-03: trial host paywall bypass blocked

## Phase 5 — P1 + SPEC-096 E2E (15 tasks) — 15/15 ✅

- [x] T-061 — HOST-06: password reset flow (Better Auth + Mailpit)
- [x] T-062 — MSG-01: conversation initiate + reply + thread (SPEC-085)
- [x] T-063 — ADM-01: super-admin moderation (lifecycle ARCHIVED)
- [x] T-064 — ADM-02: super-admin billing metrics + USER 401/403 gate
- [x] T-065 — ADM-03: user suspend + reactivate (auth-surface contract)
- [x] T-066 — ADM-04: super-admin lists plans + addons; USER rejected
- [x] T-067 — E2E-1: anonymous browse → results → contact + honeypot + validation
- [x] T-068 — E2E-2: signup → onboarding → /protected/accommodations visible
- [x] T-069 — E2E-3: authenticated favorite toggle round-trip
- [x] T-070 — E2E-5: profile edit web → admin reflects via /me + DB
- [x] T-071 — E2E-6: profile edit admin → web reflects + admin-key 4xx gate
- [x] T-072 — E2E-7: theme isolation (settings.theme vs themeAdmin in JSON)
- [x] T-073 — E2E-8: subscription cancel flow → DB invariants + optional Mailpit
- [x] T-074 — E2E-9: 404 + zero broken-links regression on public API surface
- [x] T-075 — E2E-10: filter sub-route ISR cache contract (same query → same data)

## Phase 6 — Resilience (6 tasks) — 6/6 ✅

- [x] T-076 — RES-01: API down via qzpayControl.failNext startTrial; retry → no duplicate sub
- [x] T-077 — RES-02: 100 concurrent reads; no non-503 5xx; transient class only
- [x] T-078 — RES-03: Cloudinary missing-asset tolerance (no 5xx on missing photos)
- [x] T-079 — RES-04: webhook duplicate idempotency (delta ≤ 1 events)
- [x] T-080 — RES-05: Mailpit transient outage decoupled from signup persistence
- [x] T-081 — RES-06: concurrent edit last-write-wins (no merge corruption)

## Phase 7 — Integration tests (7 tasks) — 7/7 ✅

- [x] T-082..T-085 — verified-existing (SQL injection, CSP, rate limit, brute-force)
- [x] T-086 — CSRF on mutations (16 new tests pass)
- [x] T-087 — Soft-deleted resource access (6 new tests pass)
- [x] T-088 — DB tx rollback (verified-existing in SPEC-080)

## Phase 8 — CI Scripts (7 tasks) — 7/7 ✅

- [x] T-089 — check-unsafe-ilike.sh (verified-existing)
- [x] T-090 — pre-commit + CI integration
- [x] T-091..T-092 — seo-validator.ts (skeleton + JSON-LD)
- [x] T-093 — sitemap-validator.ts
- [x] T-094 — nightly workflow integration
- [x] T-095 — docs in apps/e2e/README.md

## Phase 9 — Burn-in stabilization (4 tasks) — 1/4

- [ ] T-096 (1) — Run 7 consecutive nightly runs and collect flake metrics (owner-manual)
- [ ] T-097 (2) — Quarantine and document tests with > 2% flake rate (depends on T-096)
- [x] T-098 (1) — Final polish of test authoring contract (apps/e2e/README.md updated with concrete usage + 10-item pitfalls list + perf guidelines + failure cheatsheet, distilled from authoring 34 specs)
- [ ] T-099 (1) — Mark SPEC-092 as completed + update index (depends on T-097)

---

## Suggested Next Tasks

With infrastructure (Phase 3) and helpers ready, the next highest-leverage E2E tests to write are:

1. **T-044** HOST-04 (cancellation + grace + expired)
2. **T-045** HOST-05 (addon purchase)
3. **T-053** ACC-03 (unpublish — simplest of ACC)
4. **T-051** ACC-01 (publish + discover — uses Cloudinary real)
5. **T-054** ACC-04 (delete cleans Cloudinary)
6. **T-052** ACC-02 (edit propagates via revalidation — uses revalidation-spy fixture)
7. Then HOST-07a..e (T-046..T-050) — 5 sub-tests with qzpay-test-control
8. HOST-02 LAST when T-001/T-002 owner-manual ready

Then Phase 5 (P1+SPEC-096), then Phase 6 (Resilience), then Phase 9 burn-in.
