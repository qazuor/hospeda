# HOS-16: Plan Packaging Recalibration (Entitlements & Limits Sanitation)

## Progress: 18/20 tasks (90%) — remaining 2 blocked on a DB incident, see note below

**INCIDENT NOTE (2026-07-02)**: `pnpm db:fresh-dev` run from this worktree destroyed the
SHARED `hospeda-postgres` Docker container (it runs `docker compose down -v`, which is not
worktree-scoped despite what T-013's original description assumed). Lost: `hospeda_template`
and 5 other worktrees' isolated DBs (`worktree_hospeda_hos_21_...`, `worktree_hospeda_hos_35_...`,
`worktree_spec_291`, `worktree_spec_308`, `worktree_spec_321`), all dev-only and rebuildable, but
DB session state in those worktrees was lost. T-013/T-018 left pending — do NOT run
`pnpm db:fresh-dev` from inside a worktree again; only `wt-db.sh create` (isolated DB within
the shared container) is worktree-safe, never the docker-compose reset.

**Average Complexity:** 1.6/3
**Critical Path:** T-002 -> T-003 -> T-014 (3 steps, plus parallel T-005 -> T-007 -> T-012)
**Parallel Tracks:** 4 identified (entitlement cleanup, tourist limits, owner limits, complex hide)

---

### Setup Phase

- [x] **T-001** (complexity: 1) - Mark the 3 open questions as resolved in spec.md [DONE]
  - OQ-1/2/3 confirmed with recommended values (owner didn't respond in-session)
  - Blocked by: none
  - Blocks: none

### Core Phase

- [x] **T-002** (complexity: 2) - Remove AD_FREE from EntitlementKey enum and ENTITLEMENT_DEFINITIONS [DONE]
  - entitlement.types.ts:36 + entitlements.config.ts:160-163
  - Blocked by: none
  - Blocks: T-003, T-016

- [x] **T-003** (complexity: 2) - Remove AD_FREE from plan grants and its 2 consumers [DONE]
  - plans.config.ts (TOURIST_VIP_ENTITLEMENTS + TOURIST_PLUS_PLAN), tourist-entitlement-filter.ts, admin plan-entitlement-groups.ts
  - Also cleaned 5 more residual AD_FREE refs found opportunistically: 2 api/admin test fixtures, 3 i18n locale JSONs (+ regenerated types.ts)
  - Blocked by: T-002
  - Blocks: T-014, T-016

- [x] **T-004** (complexity: 1) - Move CAN_VIEW_RECOMMENDATIONS from tourist-free to tourist-plus [DONE]
  - tourist-plus already had it granted; only removed from tourist-free. Updated 4 test files (middleware fallback + 2 e2e checkout assertions + new plans.test.ts regression pair).
  - Blocked by: none
  - Blocks: T-015

- [x] **T-005** (complexity: 1) - Grant CREATE_PROMOTIONS entitlement to owner-basico [DONE]
  - Blocked by: none
  - Blocks: T-007, T-015

- [x] **T-006** (complexity: 2) - Recalibrate tourist MAX_FAVORITES and MAX_COMPARE_ITEMS [DONE]
  - plus 2->3, vip/owner/complex 4->5 (coord SPEC-288); favorites free 3->5, plus 20->25
  - Blocked by: none
  - Blocks: T-015

- [x] **T-007** (complexity: 2) - Recalibrate owner-basico limits [DONE]
  - photos 5->15, promotions 0->2, AI text/chat 20->50, AI import 200->10 (OQ-2)
  - Blocked by: T-005
  - Blocks: T-012, T-013, T-014, T-018

- [x] **T-008** (complexity: 2) - Recalibrate owner-pro limits [DONE]
  - photos 15->30, promotions 3->5, AI text/chat 100->250, translate 500->1000, import 500->50
  - Blocked by: none
  - Blocks: T-013, T-014, T-018

- [x] **T-009** (complexity: 2) - Recalibrate owner-premium limits (incl. AI chat decrease) [DONE]
  - photos 30->50, AI text 1000->1250, AI chat 2000->1250 (intentional decrease), translate 2000->5000, import 2000->250
  - Blocked by: none
  - Blocks: T-013, T-014, T-018

- [x] **T-010** (complexity: 1) - Hide the 3 complex plans (isActive: false) [DONE]
  - Confirmed config-validator + getDefaultPlan ignore isActive, so the spec's stated mitigation holds with zero new guard code
  - Blocked by: none
  - Blocks: T-011, T-017

- [x] **T-011** (complexity: 1) - One-time ops SQL: deactivate complex plans on existing DBs [DONE]
  - packages/db/src/migrations/extras/025-hos16-deactivate-complex-plans.plan.sql. NOT executed against any environment yet — applied deliberately at deploy time.
  - Blocked by: T-010
  - Blocks: none

### Integration Phase

- [x] **T-012** (complexity: 2) - Investigate and fix the 'promotions' comparison-table row status [DONE]
  - Confirmed real feature (OwnerPromotionService + PR #1900 tourist display, merged 2026-06-30) — flipped upcoming->available
  - Blocked by: T-007
  - Blocks: none

- [ ] **T-013** (complexity: 1) - Verify Model-C seed propagation locally
  - Blocked by: T-002, T-003, T-004, T-005, T-006, T-007, T-008, T-009, T-010
  - Blocks: none

### Testing Phase

- [x] **T-014** (complexity: 2) - Update grant-matrix.snapshot.test.ts [DONE — already satisfied by T-007/8/9]
  - Blocked by: T-003, T-007, T-008, T-009
  - Blocks: none

- [x] **T-015** (complexity: 2) - Update plans.test.ts and limits.test.ts [DONE — already satisfied by T-004/5/6]
  - Blocked by: T-004, T-005, T-006
  - Blocks: none

- [x] **T-016** (complexity: 1) - Update entitlements.test.ts and owner-inherits-tourist.test.ts [DONE — already satisfied by T-002/3]
  - Blocked by: T-002, T-003
  - Blocks: none

- [x] **T-017** (complexity: 2) - Add regression tests for AD_FREE removal and complex deactivation [DONE]
  - New complex-specific exclusion test in listPlans.test.ts; other 3 sub-requirements already covered by existing green tests
  - Blocked by: T-002, T-010
  - Blocks: none

- [ ] **T-018** (complexity: 2) - Local manual smoke: db:fresh-dev + dev test-user spot check
  - Blocked by: T-002, T-003, T-004, T-005, T-006, T-007, T-008, T-009, T-010
  - Blocks: none

### Docs Phase

- [x] **T-019** (complexity: 1) - Update docs/billing/endpoint-gate-matrix.md [DONE — verified no change needed]
  - Blocked by: T-004, T-005
  - Blocks: none

- [x] **T-020** (complexity: 1) - Fix stale EntitlementKey count in packages/billing/CLAUDE.md [DONE]
  - Also fixed LimitKey count (8->18, pre-existing staleness found while in the area)
  - Blocked by: T-002
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-002, T-004, T-005, T-006, T-010
Level 1: T-003, T-007, T-011
Level 2: T-008, T-009, T-012, T-014, T-016, T-017
Level 3: T-013, T-015, T-018, T-019, T-020

## Suggested Start

Begin with **T-002** (complexity: 2) - it has no dependencies and unblocks the entire AD_FREE cleanup chain (T-003, T-016). In parallel, T-004/T-005/T-006/T-010 are all independent and can run alongside it.
