# SPEC-287: Favorites Collections — Per-Plan Limits

## Progress: 0/13 tasks (0%)

**Average Complexity:** 1.9/3 (max)
**Critical Path:** T-001 -> T-003 -> T-004 -> T-008 -> T-013 (5 steps, weighted 11)
**Parallel Tracks:** 4 identified

Resolved decisions (2026-07-01): `CAN_USE_COLLECTIONS` / `MAX_COLLECTIONS`; tourist-plus = 10,
tourist-vip = 25 (inherited by owner/complex via the shared VIP tier); no grandfather handling
needed (no real users yet).

---

### Core Phase

- [ ] **T-001** (complexity: 1) - Add CAN_USE_COLLECTIONS and MAX_COLLECTIONS enum keys
  - Foundation: EntitlementKey + LimitKey enum entries in packages/billing/src/types/
  - Blocked by: none
  - Blocks: T-002, T-003, T-004, T-005

- [ ] **T-002** (complexity: 1) - Add CAN_USE_COLLECTIONS entitlement metadata entry
  - entitlements.config.ts metadata (name/description), mirrors CAN_VIEW_SEARCH_HISTORY
  - Blocked by: T-001
  - Blocks: T-004

- [ ] **T-003** (complexity: 2) - Add MAX_COLLECTIONS limit metadata and display name entries
  - LIMIT_METADATA (limits.config.ts) + RESOURCE_NAMES (limit-check.ts)
  - Blocked by: T-001
  - Blocks: T-004, T-008

- [ ] **T-004** (complexity: 3) - Wire collections entitlement and limit into tourist plan definitions
  - plans.config.ts: plus=10 explicit, vip=25 via shared TOURIST_VIP tier (owner/complex inherit); free untouched
  - Blocked by: T-001, T-002, T-003
  - Blocks: T-008, T-010, T-011, T-012

- [ ] **T-005** (complexity: 2) - Add gateCollections() entitlement middleware
  - tourist-entitlements.ts, modeled on gateSearchHistory()
  - Blocked by: T-001
  - Blocks: T-007, T-008

- [ ] **T-006** (complexity: 3) - Switch collection service cap from env var to planLimit parameter
  - Removes HOSPEDA_MAX_COLLECTIONS_PER_USER read from UserBookmarkCollectionService
  - Blocked by: none (independent track)
  - Blocks: T-008, T-009

### Integration Phase

- [ ] **T-007** (complexity: 2) - Mount gateCollections() on non-create collection routes
  - list, getById, update, delete, addBookmark, removeBookmark
  - Blocked by: T-005
  - Blocks: T-013

- [ ] **T-008** (complexity: 3) - Mount gate and resolve plan limit on create-collection route
  - getRemainingLimit() + pass planLimit into collectionService.createCollection()
  - Blocked by: T-003, T-004, T-005, T-006
  - Blocks: T-013

- [ ] **T-011** (complexity: 2) - Flip PlanComparisonTable collections row from upcoming to available
  - Closes spec §6 loop with SPEC-282 (Próximamente badge -> real limit)
  - Blocked by: T-004
  - Blocks: none

### Setup Phase

- [ ] **T-009** (complexity: 1) - Remove HOSPEDA_MAX_COLLECTIONS_PER_USER env var
  - env-registry.hospeda.ts, apps/api env.ts, .env.example
  - Blocked by: T-006
  - Blocks: none

### Core Phase (DB propagation)

- [ ] **T-010** (complexity: 2) - Write extras migration to propagate collections keys to live plan rows
  - OR-PRESERVE idempotent pattern, mirrors extras/023-billing-plans-ai-consumer-search-limits.plan.sql
  - Blocked by: T-004
  - Blocks: none

### Docs Phase

- [ ] **T-012** (complexity: 1) - Update endpoint gate matrix docs for collections routes
  - docs/billing/endpoint-gate-matrix.md
  - Blocked by: T-004
  - Blocks: none

### Testing Phase

- [ ] **T-013** (complexity: 2) - Write cross-cutting entitlement + limit integration test
  - Free 403 on all routes; plus quota boundary at 10; vip quota boundary at 25
  - Blocked by: T-007, T-008
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-006
Level 1: T-002, T-003, T-005, T-009
Level 2: T-004, T-007
Level 3: T-008, T-010, T-011, T-012
Level 4: T-013

## Suggested Start

Begin with **T-001** (complexity: 1) - no dependencies, unblocks 4 other tasks. **T-006**
(complexity: 3) can be worked in parallel — it's an independent track with no blockers.
