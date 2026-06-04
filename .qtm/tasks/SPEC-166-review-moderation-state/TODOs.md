# SPEC-166: Review Moderation State

## Progress: 0/27 tasks (0%)

**Average Complexity:** 2.2/3 (max)
**Critical Path:** T-001 → T-002 → T-003 → T-010 → T-012 → T-014 → T-020 → T-025 → T-026 (9 steps)
**Parallel Tracks:** 4 independent entry points (T-001 package, T-005 env, T-006 db enum, T-018 seed perms)

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Scaffold @repo/content-moderation package
  - package.json, tsconfig, vitest, barrel, workspace registration
  - Blocked by: none
  - Blocks: T-002

- [ ] **T-002** (complexity: 2) - Define frozen public contract types + Zod input schema
  - ModerationResult/Category/Input + moderateTextInputSchema + async moderateText signature
  - Blocked by: T-001
  - Blocks: T-003

### Core Phase

- [ ] **T-003** (complexity: 3) - Implement moderateText stub internals
  - Substring/domain scan reusing env words → score 1.0/0.0 mapped to ModerationResult
  - Blocked by: T-002
  - Blocks: T-004, T-010, T-011

- [ ] **T-004** (complexity: 2) - Unit tests for moderateText stub
  - match/clean/domain/case/edge cases
  - Blocked by: T-003
  - Blocks: none

- [ ] **T-005** (complexity: 1) - Register messaging blocklist env vars in Zod schema
  - Add HOSPEDA_MESSAGING_BLOCKED_WORDS/_DOMAINS to ApiEnvBaseSchema + .env.example
  - Blocked by: none
  - Blocks: none

- [ ] **T-006** (complexity: 1) - Add ReviewModerationStatePgEnum
  - PG enum (PENDING/APPROVED/REJECTED) + @repo/schemas mirror
  - Blocked by: none
  - Blocks: T-007, T-008

- [ ] **T-007** (complexity: 2) - Add moderation columns to accommodation_reviews schema
  - moderationState + moderatedById/At/Reason
  - Blocked by: T-006
  - Blocks: T-009

- [ ] **T-008** (complexity: 2) - Add moderation columns to destination_reviews schema
  - Same four columns (explicit, no adminInfo reuse)
  - Blocked by: T-006
  - Blocks: T-009

- [ ] **T-009** (complexity: 3) - Generate versioned migration with APPROVED backfill
  - db:generate + backfill existing rows → APPROVED (NOT db:push)
  - Blocked by: T-007, T-008
  - Blocks: T-012, T-013

- [ ] **T-010** (complexity: 2) - Implement resolveInitialModerationState helper
  - score threshold + per-entity default + future verified branch
  - Blocked by: T-003
  - Blocks: T-012, T-013

- [ ] **T-011** (complexity: 3) - Migrate MessageService to @repo/content-moderation
  - Swap to moderateText, delete dead word-list code, regression tests
  - Blocked by: T-003
  - Blocks: none

- [ ] **T-012** (complexity: 3) - Wire moderation into accommodation review creation
  - moderateText + resolver (semi-verified → APPROVED) on create
  - Blocked by: T-009, T-010
  - Blocks: T-014, T-016, T-022

- [ ] **T-013** (complexity: 3) - Wire moderation into destination review creation
  - moderateText + resolver (none-verified → PENDING) on create
  - Blocked by: T-009, T-010
  - Blocks: T-015, T-017, T-023

- [ ] **T-014** (complexity: 3) - Add moderateReview (approve/reject) to accommodation service
  - Permission ACCOMMODATION_REVIEW_MODERATE + audit fields, lifecycleState untouched
  - Blocked by: T-012
  - Blocks: T-020

- [ ] **T-015** (complexity: 3) - Add moderateReview (approve/reject) to destination service
  - Permission DESTINATION_REVIEW_MODERATE + audit fields
  - Blocked by: T-013
  - Blocks: T-020

- [ ] **T-016** (complexity: 2) - Add getPendingCount to accommodation review service
  - Count PENDING, permission-gated
  - Blocked by: T-012
  - Blocks: T-019

- [ ] **T-017** (complexity: 2) - Add getPendingCount to destination review service
  - Count PENDING, permission-gated
  - Blocked by: T-013
  - Blocks: T-019

- [ ] **T-018** (complexity: 1) - Grant review-moderate permissions to ADMIN/SUPER_ADMIN in seed
  - Verify/add both entity-specific moderate permissions
  - Blocked by: none
  - Blocks: T-019, T-020, T-021

### Integration Phase

- [ ] **T-019** (complexity: 3) - API: GET /admin/reviews/pending-count
  - Combined count + byType split, permission-gated
  - Blocked by: T-016, T-017, T-018
  - Blocks: T-025

- [ ] **T-020** (complexity: 3) - API: POST moderate endpoints for both review types
  - approve/reject routes, Zod body, per-entity permission
  - Blocked by: T-014, T-015, T-018
  - Blocks: T-025

- [ ] **T-021** (complexity: 2) - Admin review list: expose moderationState filter + field
  - Filter param + display field for the moderation queue
  - Blocked by: T-018
  - Blocks: T-025

- [ ] **T-022** (complexity: 2) - Public filter: accommodation reviews APPROVED + ACTIVE
  - Add moderationState=APPROVED to public reads
  - Blocked by: T-012
  - Blocks: T-024, T-025

- [ ] **T-023** (complexity: 2) - Public filter: destination reviews APPROVED + ACTIVE
  - Add moderationState=APPROVED to public reads
  - Blocked by: T-013
  - Blocks: T-025

- [ ] **T-024** (complexity: 2) - HOST dashboard review listings APPROVED only
  - Reuse public filter for SPEC-155 card E
  - Blocked by: T-022
  - Blocks: T-025

### Testing Phase

- [ ] **T-025** (complexity: 3) - Cross-cutting moderation flow integration test
  - End-to-end: default-by-entity, blocked→PENDING, approve→public, reject→hidden, lifecycle independence
  - Blocked by: T-019, T-020, T-021, T-022, T-023, T-024
  - Blocks: T-026, T-027

- [ ] **T-026** (complexity: 2) - Coverage sweep on new logic
  - ≥90% on package + new service logic
  - Blocked by: T-025
  - Blocks: none

### Docs Phase

- [ ] **T-027** (complexity: 1) - Document moderation model + content-moderation contract
  - Package README + moderation model doc + pointer to SPEC-195 internals
  - Blocked by: T-025
  - Blocks: none

---

## Dependency Graph (levels)

```
L0: T-001, T-005, T-006, T-018
L1: T-002, T-007, T-008, T-021
L2: T-003, T-009
L3: T-004, T-010, T-011
L4: T-012, T-013
L5: T-014, T-015, T-016, T-017, T-022, T-023
L6: T-019, T-020, T-024
L7: T-025
L8: T-026, T-027
```

## Suggested Start

Four tasks have no dependencies and can start in parallel: **T-001** (package scaffold, unblocks the whole contract chain), **T-005** (env registration), **T-006** (db enum, unblocks both schema tasks), **T-018** (seed permissions). Begin with **T-001** — it is on the critical path and unblocks the contract + stub engine that most of the spec depends on.
