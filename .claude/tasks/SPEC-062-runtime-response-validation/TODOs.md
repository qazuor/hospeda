# SPEC-062: Runtime Response Schema Enforcement

## Progress: 0/20 tasks (0%)

**Average Complexity:** 2.6/4 (max)
**Critical Path:** T-001 -> T-010 -> T-011 -> T-012 -> T-013 -> T-015 -> T-017 -> T-020 (8 steps)
**Parallel Tracks:** 3 identified (Phase 0 entities, Phase 1 core, Phase 1 testing)

**IMPORTANT: Phase 0 and Phase 1 are SEPARATE deployments.**
- Phase 0 (T-001 to T-011): Deploy FIRST
- Then wait for SPEC-063 and SPEC-066 to merge
- Phase 1 (T-012 to T-020): Deploy LAST

---

### Phase 0 - Core: Access Schema Relation Extensions

- [ ] **T-001** (complexity: 4) - Extend Post access schemas with relation fields
  - 5 relations: author, relatedAccommodation, relatedDestination, relatedEvent, sponsorship (nested)
  - Blocked by: none
  - Blocks: T-010

- [ ] **T-002** (complexity: 2) - Extend Accommodation access schemas with destination relation
  - Only destination missing (owner, amenities, features already exist)
  - Blocked by: none
  - Blocks: T-010

- [ ] **T-003** (complexity: 2) - Extend AccommodationReview access schemas with relation fields
  - Relations: user, accommodation
  - Blocked by: none
  - Blocks: T-010

- [ ] **T-004** (complexity: 3) - Extend DestinationReview access schemas with relation fields + lifecycleState
  - Relations: user, destination + preemptive lifecycleState on AdminSchema (SPEC-063 prep)
  - Blocked by: none
  - Blocks: T-010

- [ ] **T-005** (complexity: 2) - Extend PostSponsorship access schemas with relation fields
  - Relations: post, sponsor
  - Blocked by: none
  - Blocks: T-010

- [ ] **T-006** (complexity: 1) - Extend UserBookmark access schemas with user relation field
  - Relations: user only
  - Blocked by: none
  - Blocks: T-010

- [ ] **T-007** (complexity: 3) - Extend OwnerPromotion access schemas with relation fields + lifecycleState
  - Relations: owner, accommodation + preemptive lifecycleState on AdminSchema (SPEC-063 prep)
  - Blocked by: none
  - Blocks: T-010

- [ ] **T-008** (complexity: 3) - Extend Sponsorship access schemas with relation fields + lifecycleState
  - Relations: sponsorUser, level (base schema), package (base schema) + lifecycleState
  - Blocked by: none
  - Blocks: T-010

- [ ] **T-009** (complexity: 2) - Extend Event access schemas with relation fields
  - Relations: organizer, location
  - Blocked by: none
  - Blocks: T-010

### Phase 0 - Testing

- [ ] **T-010** (complexity: 4) - Enhance boundary tests with explicit sensitive field absence assertions
  - All 23 schema sets, all sensitive fields from risk table
  - Blocked by: T-001 through T-009
  - Blocks: T-011

- [ ] **T-011** (complexity: 1) - Run full typecheck and test suite for Phase 0 verification
  - Final quality gate for Phase 0
  - Blocked by: T-010
  - Blocks: T-012

---

### Phase 1 - Core: Runtime Enforcement (BLOCKED until SPEC-063 + SPEC-066 merged)

- [ ] **T-012** (complexity: 2) - Add stripWithSchema utility function to response-helpers.ts
  - safeParse + fallback + warning log
  - Blocked by: T-011 + SPEC-063 + SPEC-066
  - Blocks: T-013, T-014

- [ ] **T-013** (complexity: 2) - Modify createResponse to accept and apply responseSchema
  - Add optional param, call stripWithSchema before envelope
  - Blocked by: T-012
  - Blocks: T-015

- [ ] **T-014** (complexity: 3) - Modify createPaginatedResponse to accept and apply responseSchema per item
  - Strip each item in items[], pagination metadata untouched
  - Blocked by: T-012
  - Blocks: T-015

- [ ] **T-015** (complexity: 3) - Thread responseSchema through route factory functions to response helpers
  - createSimpleRoute, createCRUDRoute, createListRoute
  - Blocked by: T-013, T-014
  - Blocks: T-016, T-017, T-018

- [ ] **T-016** (complexity: 1) - Update response-validator.ts with documentation comment
  - Note that field-level enforcement moved to response helpers
  - Blocked by: T-015
  - Blocks: T-020

### Phase 1 - Testing (BLOCKED until SPEC-063 + SPEC-066 merged)

- [ ] **T-017** (complexity: 4) - Write integration tests for public tier field enforcement
  - Verify admin fields absent from public responses
  - Blocked by: T-015
  - Blocks: T-020

- [ ] **T-018** (complexity: 4) - Write integration tests for protected and admin tier field enforcement
  - Protected: has some, not all. Admin: has all.
  - Blocked by: T-015
  - Blocks: T-020

- [ ] **T-019** (complexity: 2) - Write integration test for safeParse fallback path
  - Verify fallback returns unstripped data + warning log
  - Blocked by: T-015
  - Blocks: T-020

- [ ] **T-020** (complexity: 3) - Run full test suite, fix regressions, and create route inventory
  - Final quality gate for Phase 1 + route inventory
  - Blocked by: T-016, T-017, T-018, T-019
  - Blocks: none

---

## Dependency Graph

```
Level 0: T-001, T-002, T-003, T-004, T-005, T-006, T-007, T-008, T-009  (parallel)
Level 1: T-010
Level 2: T-011
--- PHASE BOUNDARY: Wait for SPEC-063 + SPEC-066 ---
Level 3: T-012
Level 4: T-013, T-014  (parallel)
Level 5: T-015
Level 6: T-016, T-017, T-018, T-019  (parallel)
Level 7: T-020
```

## Suggested Start

Begin with **T-001 through T-009** in parallel (all complexity 1-4) - they have no dependencies and together unblock T-010. Start with the simplest ones (T-006 complexity 1, T-002/T-003/T-005/T-009 complexity 2) to build momentum, then tackle the complex ones (T-001 complexity 4, T-004/T-007/T-008 complexity 3).
