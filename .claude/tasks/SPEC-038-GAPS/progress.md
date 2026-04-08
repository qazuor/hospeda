# SPEC-038-GAPS Progress

**Epic**: Addon Entitlements Architecture — Gaps Remediation
**Source spec**: SPEC-038-addon-entitlements-architecture (all 22 tasks completed)
**Gaps analyzed**: 52 total (1 resolved during audit, 2 accepted, 49 HACER)
**Tasks generated**: 31 (covering 49 gaps)
**Out of scope**: 3 gaps excluded (require new formal SPEC)
**Created**: 2026-03-16
**Status**: In progress (27/31 tasks completed, 4 standalone deferred)

---

## Out of Scope (require new SPEC)

These gaps are explicitly excluded from this epic:

| Gap | Reason |
|-----|--------|
| GAP-038-01 | New SPEC — subscription cancellation addon cleanup (webhook handler for sub cancellation) |
| GAP-038-04 | Future SPEC — plan upgrade/downgrade addon limit recalculation (v2 enhancement) |
| GAP-038-45 | New SPEC — add deletedAt column + soft-delete to billing_addon_purchases (schema migration) |

---

## Phase Overview

### P0 / CRITICAL (3 tasks — start immediately, do not parallelize with other phases)

These are production-blocking bugs. No cancellation works in production (G-001). Admin app may fail TypeScript compilation (G-003).

| Task | Gap(s) | Description | Complexity |
|------|--------|-------------|------------|
| G-001 | GAP-038-03, 22, 24 | Fix cancel route: extract addonSlug, make purchaseId required, add purchaseId to WHERE | 3 |
| G-002 | GAP-038-03, 24 | Integration test for cancel route-to-service flow | 2 |
| G-003 | GAP-038-23 | Add revokeBySource + removeBySource to admin billing HTTP adapter | 2 |

**Critical path**: G-001 → G-002 → G-031

### P1 / HIGH (3 tasks — implement after P0 is complete or in parallel if independent)

| Task | Gap(s) | Description | Complexity |
|------|--------|-------------|------------|
| G-004 | GAP-038-36 | Fix expireAddon idempotent path timestamp (1-line fix) | 1 |
| G-005 | GAP-038-39, 28 | Fix migration idempotency: remove subscriptionId, normalize timestamps | 3 |
| G-006 | GAP-038-29, 19 | Fix migration: throw on empty returning, remove pagination ceiling | 2 |

G-005 and G-006 are sequential (G-006 depends on G-005). G-004 is independent.

### P2 / MEDIUM (8 tasks — implement after P1, many can run in parallel)

| Task | Gap(s) | Description | Complexity | Standalone |
|------|--------|-------------|------------|-----------|
| G-007 | GAP-038-26 | DRY: remove duplicate ServiceResult<T> definitions | 1 | No |
| G-008 | GAP-038-27 | Fix wasNotificationSent to filter by addonSlug | 3 | No |
| G-009 | GAP-038-37, 38 | Add Zod validation for daysAhead and fix appliedAt schema | 2 | No |
| G-010 | GAP-038-41 | Add transaction rollback simulation tests to checkout | 2 | No |
| G-011 | GAP-038-43 | Replace unsafe 'as number' casts with typeof guards | 2 | No |
| G-012 | GAP-038-46 | Document metadata race condition (deprecated path) | 1 | No |
| G-013 | GAP-038-47 | Add Sentry.captureException to cron job error catch blocks | 2 | No |
| G-028 | GAP-038-02 | Extend cron with orphaned purchase reconciliation phase | 4 | YES — Standalone |
| G-029 | GAP-038-11 | Admin endpoint + page for per-customer entitlement visibility | 4 | YES — Standalone |

G-028 blocked by G-001 and G-004.
G-029 blocked by G-003.
All others are independent and can run in parallel.

### P3 / LOW (10 tasks — polish, test coverage, minor UX)

| Task | Gap(s) | Description | Complexity | Standalone |
|------|--------|-------------|------------|-----------|
| G-014 | GAP-038-30 | Replace any types in test files | 1 | No |
| G-015 | GAP-038-31 | Fix misleading -1 unlimited test case | 1 | No |
| G-016 | GAP-038-33 | Raise notification failures from debug to warn | 1 | No |
| G-017 | GAP-038-40, 20 | Fix dynamic plan count in test + billingEnabled mock coverage | 2 | No |
| G-018 | GAP-038-12, 16, 51 | Add: permanent entitlement test, cache-not-cleared tests, multi-addon same day test | 2 | No |
| G-019 | GAP-038-49, 44 | Expand error status map, document checkout metadata dual format | 2 | No |
| G-020 | GAP-038-50 | Restructure revokeBySource fallback + cascading failure test | 2 | No |
| G-021 | GAP-038-13, 05 | Update spec metadata and TODOs.md to completed | 1 | No |
| G-022 | GAP-038-07, 18 | Add overlapping limit key validation + cache TTL/FIFO tests | 3 | No |
| G-027 | GAP-038-32 | Add getUserAddons statuses filter for purchase history | 3 | YES — Standalone |
| G-030 | GAP-038-14 | Integration test for concurrent purchase constraint collision | 2 | YES — Standalone |

G-018 blocked by G-008.
All others are independent and can run in parallel.

### P4 / TRIVIAL (4 tasks — low effort, anytime)

| Task | Gap(s) | Description | Complexity |
|------|--------|-------------|------------|
| G-023 | GAP-038-06, 10, 15 | Fix Drizzle relations, FIFO naming, error logging context | 2 |
| G-024 | GAP-038-09, 17 | Remove redundant getQZPayBilling() calls and variable shadowing | 1 |
| G-025 | GAP-038-34, 35 | Replace billing.plans.get() with ALL_PLANS.find(), document restoreAllPlans exception | 2 |
| G-026 | GAP-038-52, 42, 48 | Add getDb() null check, cron timeout comment, cancel route TODO | 2 |

All are independent, can be done in any order.

### Validation (1 task — final gate)

| Task | Description |
|------|-------------|
| G-031 | Final quality gate: typecheck + lint + full test suite |

Blocked by all tasks except the 4 standalone tasks (G-027, G-028, G-029, G-030).

---

## Gap ID to Task Mapping

| Gap ID | Task(s) | Priority | Status |
|--------|---------|----------|--------|
| GAP-038-02 | G-028 | P2 (Standalone) | pending |
| GAP-038-03 | G-001, G-002 | P0 CRITICAL | completed |
| GAP-038-05 | G-021 | P3 | completed |
| GAP-038-06 | G-023 | P4 | completed |
| GAP-038-07 | G-022 | P3 | completed |
| GAP-038-09 | G-024 | P4 | completed |
| GAP-038-10 | G-023 | P4 | completed |
| GAP-038-11 | G-029 | P2 (Standalone) | pending |
| GAP-038-12 | G-018 | P3 | completed |
| GAP-038-13 | G-021 | P3 | completed |
| GAP-038-14 | G-030 | P3 (Standalone) | pending |
| GAP-038-15 | G-023 | P4 | completed |
| GAP-038-16 | G-018 | P3 | completed |
| GAP-038-17 | G-024 | P4 | completed |
| GAP-038-18 | G-022 | P3 | completed |
| GAP-038-19 | G-006 | P1 | completed |
| GAP-038-20 | G-017 | P3 | completed |
| GAP-038-22 | G-001 | P0 CRITICAL | completed |
| GAP-038-23 | G-003 | P0 CRITICAL | completed |
| GAP-038-24 | G-001, G-002 | P0 CRITICAL | completed |
| GAP-038-25 | — | POSTPONED | — |
| GAP-038-26 | G-007 | P2 | completed |
| GAP-038-27 | G-008 | P2 | completed |
| GAP-038-28 | G-005 | P1 | completed |
| GAP-038-29 | G-006 | P1 | completed |
| GAP-038-30 | G-014 | P3 | completed |
| GAP-038-31 | G-015 | P3 | completed |
| GAP-038-32 | G-027 | P3 (Standalone) | pending |
| GAP-038-33 | G-016 | P3 | completed |
| GAP-038-34 | G-025 | P4 | completed |
| GAP-038-35 | G-025 | P4 | completed |
| GAP-038-36 | G-004 | P1 | completed |
| GAP-038-37 | G-009 | P2 | completed |
| GAP-038-38 | G-009 | P2 | completed |
| GAP-038-39 | G-005 | P1 | completed |
| GAP-038-40 | G-017 | P3 | completed |
| GAP-038-41 | G-010 | P2 | completed |
| GAP-038-42 | G-026 | P4 | completed |
| GAP-038-43 | G-011 | P2 | completed |
| GAP-038-44 | G-019 | P3 | completed |
| GAP-038-46 | G-012 | P2 | completed |
| GAP-038-47 | G-013 | P2 | completed |
| GAP-038-48 | G-026 | P4 | completed |
| GAP-038-49 | G-019 | P3 | completed |
| GAP-038-50 | G-020 | P3 | completed |
| GAP-038-51 | G-018 | P3 | completed |
| GAP-038-52 | G-026 | P4 | completed |

### Postponed (not excluded, not tasked)

| Gap ID | Reason |
|--------|--------|
| GAP-038-25 | Postponed — cancelledAt/canceledAt spelling fix requires DB column migration, too invasive. Revisit when schema work is scheduled. |

---

## Progress Tracking

### P0 / CRITICAL
- [x] G-001 — Fix cancel route: extract addonSlug, purchaseId required, WHERE clause fix
- [x] G-002 — Integration test for cancel route flow
- [x] G-003 — Admin HTTP adapter: add revokeBySource + removeBySource

### P1 / HIGH
- [x] G-004 — Fix expireAddon idempotent path timestamp
- [x] G-005 — Fix migration idempotency (subscriptionId + timestamp)
- [x] G-006 — Fix migration: throw on empty returning, remove pagination ceiling

### P2 / MEDIUM
- [x] G-007 — DRY: deduplicate ServiceResult<T>
- [x] G-008 — Fix wasNotificationSent to filter by addonSlug
- [x] G-009 — Zod validation: daysAhead + appliedAt schema
- [x] G-010 — Transaction rollback simulation tests
- [x] G-011 — Replace unsafe 'as number' casts
- [x] G-012 — Document metadata race condition (deprecated path)
- [x] G-013 — Add Sentry.captureException to cron error catch blocks
- [ ] G-028 — [STANDALONE] Orphaned purchase reconciliation phase in cron
- [ ] G-029 — [STANDALONE] Admin endpoint + page for customer entitlement visibility

### P3 / LOW
- [x] G-014 — Replace any types in test files
- [x] G-015 — Fix misleading -1 unlimited test case
- [x] G-016 — Raise notification failures from debug to warn
- [x] G-017 — Fix dynamic plan count + billingEnabled mock
- [x] G-018 — Add: permanent entitlement test, cache-not-cleared, multi-addon same day
- [x] G-019 — Expand error status map + document checkout metadata dual format
- [x] G-020 — Restructure revokeBySource fallback + cascading failure test
- [x] G-021 — Update spec metadata and TODOs.md
- [x] G-022 — Overlapping limit key validation + cache TTL/FIFO tests
- [ ] G-027 — [STANDALONE] getUserAddons statuses filter
- [ ] G-030 — [STANDALONE] Integration test for concurrent purchase constraint

### P4 / TRIVIAL
- [x] G-023 — Fix Drizzle relations + FIFO naming + error logging context
- [x] G-024 — Remove redundant getQZPayBilling() calls
- [x] G-025 — Replace billing.plans.get() + document restoreAllPlans
- [x] G-026 — getDb() null check + cron timeout comment + cancel route TODO

### Validation
- [x] G-031 — Final quality gate: typecheck + lint + full test suite
