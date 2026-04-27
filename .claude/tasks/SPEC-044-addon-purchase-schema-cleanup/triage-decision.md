# SPEC-044-GAPS — Triage Decision (2026-04-26)

49 gap tasks were generated against the addon purchase schema cleanup work.
Per BBT-6 ("Apply migration + decide gaps fate"), the recommendation was
"triaje rápido y diferir la mayoría post-beta". This document records that
decision phase by phase so a future operator can see exactly what was
deferred and why.

## Top-line decision

- **Epic status**: `deferred-post-beta` (was `pending`)
- **Total tasks**: 49 across 8 phases (~22.7h estimated effort)
- **Done in this session**: T-021 (apply migration to dev DB) — verified via
  direct SQL: `canceled_at` and `deleted_at` columns exist nullable, no
  British `cancelled_at`, zero rows with legacy `status = 'cancelled'`.
- **Critical race condition tasks (Phase 3, 4 tasks)**: VERIFIED DONE on
  2026-04-27 by direct code audit. All four were already implemented and
  covered by existing tests. See per-phase breakdown below.
- **Deferred to post-beta**: the remaining 45 tasks (Phases 1, 2, 4-8 minus
  the items already covered above).

## Phase-by-phase breakdown

### Phase 1 — Quick Wins, Spelling & Mocks (47 min, 5 tasks) — DEFERRED

| Task | Effort | Triage | Rationale |
|------|--------|--------|-----------|
| T001 metadata status to in-progress | 5 min | DEFER | Metadata churn, no functional impact. |
| T002 add deletedAt to test mocks | 15 min | DEFER | Tests pass today; this is hygiene. |
| T003 spelling cancelled → canceled in services | 15 min | DEFER | Comments and string keys. Not load-bearing. |
| T004 i18n English Cancelled → Canceled | 10 min | DEFER | English locale is secondary; primary locale is Spanish. |
| T005 delete stale agent worktree | 2 min | DEFER | Filesystem hygiene. |

### Phase 2 — Schema & Type Safety Fixes (65 min, 4 tasks) — DEFERRED

All four are defensive validation hardening on already-working paths
(strict enum on response status, orderId regex, Zod on JSONB columns,
annualPriceArs check). No incident traceable to their absence; safe to
ship beta without them.

### Phase 3 — Race Condition & Resilience Fixes (75 min, 4 tasks) — VERIFIED DONE (2026-04-27)

A direct code audit on 2026-04-27 found all four tasks already implemented
in production code, more robustly than the spec required. Marked as
`completed` in gaps-state.json. Test coverage exists:

| Task | Implementation | Coverage |
|------|----------------|----------|
| T001 harden `cancelUserAddon` WHERE clause | `apps/api/src/services/addon.user-addons.ts:168-173` — WHERE includes `status = 'active'` and `isNull(deletedAt)`; rowCount checked with structured warning when 0 rows are affected | `addon-concurrent-cancellation.test.ts` (12 tests including "exactly one wins", "no double revocation", "no orphaned state") and `addon-user-addons-atomicity.test.ts` |
| T002 harden `expireAddon` WHERE clause | `addon-expiration.service.ts:228-234` — same WHERE guards plus rowCount check; idempotent path for already-expired purchases at line 144 | `addon-expiration.service.test.ts` "should be idempotent — return success for already expired add-on" and "should return INVALID_STATUS for non-active status" |
| T003 wrap entitlement removal in try/catch in `expireAddon` | `addon-expiration.service.ts:180-214` — full try/catch around `removeAddonEntitlements`; both `success: false` and thrown exceptions handled with structured warnings | `addon-expiration.service.test.ts` "should handle entitlement removal failure" + "should handle AddonEntitlementService throwing exception" |
| T004 ensure status update always executes after entitlement removal | `addon-expiration.service.ts:220-234` — UPDATE runs unconditionally after the catch with `entitlementRemovalPending` flag set when removal failed, enabling the addon-expiry cron reconciliation phase to retry | Same suite verifies `entitlementRemovalPending: true` is written on failure (lines 480 + 956) |

The implementation goes beyond what the spec asked for (the
`entitlementRemovalPending` reconciliation flag and the idempotent path
for already-expired records were not part of the original task, but
strengthen the contract). 32/32 tests pass in `addon-expiration.service.test.ts`.

### Phase 4 — Admin Route & Pagination Fixes (255 min, 6 tasks) — DEFERRED

Admin operator UX improvements (correct pagination, includeDeleted filter,
extract Drizzle from route, new expire/activate admin endpoints). None
block end-user beta flow. Operator can use SQL or restart the addon
manually if needed.

### Phase 5 — Checkout Hardening (90 min, 3 tasks) — DEFERRED

Replace raw MercadoPago SDK with the billing adapter (consistency, not
correctness — current path works), targetCategories validation
(defensive — current path checks at entitlement layer), notification
display name (cosmetic UX). Defer.

### Phase 6 — Schema Consolidation & Admin Tier Fix (235 min, 8 tasks) — DEFERRED

Move local addon schemas into `@repo/schemas` to align with single source
of truth policy, plus admin endpoints for plans/addons. This is the kind
of consolidation that pays off long-term but adds zero immediate user
value. Defer.

### Phase 7 — Service Architecture Refactor (440 min, 12 tasks) — DEFERRED

Migrate the addon services to `BaseCrudService` + `Result<T>` returns.
This is a 7+ hour refactor that touches every billing endpoint plus its
tests. Net benefit: consistency. Net risk: regression. Wrong moment.
Defer until post-beta and tackle as its own spec.

### Phase 8 — DB & Misc Tasks (155 min, 7 tasks) — MIXED

| Task | Effort | Triage | Rationale |
|------|--------|--------|-----------|
| T001 apply pending DB migration | 10 min | DONE (T-021 in main spec covered this) | Verified live. |
| T002 add CHECK constraint for status column | 20 min | DEFER | Drizzle push-only model defers numbered migration files; the manual migrations directory has analogous CHECKs already (`0007_billing_addon_purchases_status_check.sql`). Verify coverage post-beta. |
| T003 migration idempotency: filter soft-deleted | 15 min | DEFER | Edge case. |
| T004 BaseModel softDelete/restore: update updatedAt | 20 min | DEFER | Semantic improvement. Audit trail completeness, not data correctness. |
| T005 JSON metadata → DB query in UsageTrackingService | 35 min | DEFER | Performance optimisation. |
| T006 update UsageTrackingService tests for T005 | 25 min | DEFER | Depends on T005. |
| T007 ADDON_PURCHASE email template | 30 min | DEFER | New feature. Beta can launch without addon purchase emails. |

## Owner-decision items (resolved)

The four Phase 3 race condition tasks were the only items flagged as
owner-decision when this triage was first written. The 2026-04-27 audit
confirmed they are already implemented in production code and covered by
existing tests, so no additional follow-up is required before beta.

## How to revisit

When the deferred work becomes priority:

1. Read this document for the rationale per phase.
2. Open `.claude/tasks/SPEC-044-addon-purchase-schema-cleanup/gaps-state.json`
   and the per-phase task entries (each retains its full description and
   acceptance criteria).
3. Decide whether to absorb a phase into a fresh SPEC, or run the
   gaps-state.json directly as a tracked epic.

## Trail

- BBT-6 line in `BEFORE_BETA_TESTING.md` instructed the triage approach.
- T-021 verified live on dev DB (Postgres container `hospeda-postgres`,
  database `hospeda_dev`).
- Main task state.json shows 21/21 completed for SPEC-044.
- Gaps state.json kept verbatim; only the top-level `status` was updated.
