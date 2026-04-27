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
- **Critical-keep flagged for owner review**: 4 tasks in Phase 3
  (race conditions in addon cancel/expire). See "Owner-decision items" below.
- **Deferred to post-beta**: the remaining 45 tasks.

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

### Phase 3 — Race Condition & Resilience Fixes (75 min, 4 tasks) — OWNER DECISION

These four touch the billing money path. Each is a small change but the
underlying risk is real (concurrent cancel/expire writes against the same
purchase row). Recommendation: review before beta launch and decide
whether to ship them now or accept the risk for the beta cohort size.

| Task | Effort | Risk if unfixed |
|------|--------|-----------------|
| T001 harden cancelUserAddon WHERE clause | 20 min | Two simultaneous cancel requests can both succeed; second one writes inconsistent state. |
| T002 harden expireAddon WHERE clause | 20 min | Cron expiry can race with manual cancel and double-process. |
| T003 wrap entitlement removal in try/catch in expireAddon | 20 min | Today a partial failure leaves an addon in inconsistent state with no compensating event. (Note: T-046/T-047 of SPEC-064 already addressed compensating events for the cancellation path; expiry may benefit from the same pattern.) |
| T004 ensure status update always executes after entitlement removal in expireAddon | 15 min | Status drift if the entitlement remove succeeds but the status update is skipped. |

**Mitigating factor**: beta cohort is small (~5-10 users). Real-world
contention probability is low. Still worth a 75-minute follow-up before
opening beta to a wider audience.

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

## Owner-decision items (please review before opening beta)

The four Phase 3 race condition tasks total **75 minutes of work** and
touch the billing money path. They are individually small but
collectively meaningful for a system that handles real charges.

If you choose to ship them, treat them as a single follow-up commit
under `fix(billing): harden addon cancel/expire race conditions
(SPEC-044 GAPS-P3)`. If you choose to defer, plan them into the first
post-beta hardening sprint.

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
