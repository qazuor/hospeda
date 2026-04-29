# SPEC-080: Service-Layer Integration Tests with Real Database

## Progress: 0/22 tasks (0%)

**Average Complexity:** 2.2/4 (max)
**Critical Path:** T-001 -> T-003 -> T-010 -> T-011 -> T-022 (5 steps)
**Parallel Tracks:** 7 identified (one per service chain plus the infra chain)

---

### Setup Phase

- [ ] **T-001** (complexity: 1) - Verify SPEC-080 bootstrap baseline runs green
  - Run existing `accommodation` + `user-bookmark` integration tests against ephemeral DB to confirm bootstrap is healthy.
  - Blocked by: none
  - Blocks: T-003, T-004, T-005, T-006, T-007, T-008, T-019, T-021

- [ ] **T-002** (complexity: 1) - Mark SPEC-080 status from draft to in-progress
  - Update spec.md frontmatter and tasks/index.json.
  - Blocked by: none
  - Blocks: none

### Core Phase (seed helpers)

- [ ] **T-003** (complexity: 2) - Add seedPost helper
  - User (author) + Post. Returns `{ authorId, postId }`.
  - Blocked by: T-001
  - Blocks: T-010, T-011

- [ ] **T-004** (complexity: 4) - Add seedEvent helper
  - User + EventLocation + EventOrganizer + Event + Tag (m2m). Most complex seed.
  - Blocked by: T-001
  - Blocks: T-012

- [ ] **T-005** (complexity: 2) - Add seedAccommodationReview helper
  - Reuses seedAccommodation chain + AccommodationReview row.
  - Blocked by: T-001
  - Blocks: T-013

- [ ] **T-006** (complexity: 2) - Add seedDestinationReview helper
  - User + Destination + DestinationReview.
  - Blocked by: T-001
  - Blocks: T-014

- [ ] **T-007** (complexity: 2) - Add seedOwnerPromotion helper
  - Reuses seedAccommodation chain + OwnerPromotion.
  - Blocked by: T-001
  - Blocks: T-015

- [ ] **T-008** (complexity: 2) - Add seedSponsorshipPackage helper
  - SponsorshipLevel + SponsorshipPackage. Foundation for sponsorship chain.
  - Blocked by: T-001
  - Blocks: T-009, T-017

- [ ] **T-009** (complexity: 3) - Add seedSponsorship helper
  - Extends seedSponsorshipPackage with sponsor User + Sponsorship.
  - Blocked by: T-008
  - Blocks: T-016

- [ ] **T-010** (complexity: 3) - Add seedPostSponsorship helper
  - Extends seedPost with sponsor User + PostSponsorship.
  - Blocked by: T-003
  - Blocks: T-011, T-018

### Integration Phase (service tests)

- [ ] **T-011** (complexity: 4) - Write post.integration.test.ts (PostService getById, nested sponsorship.sponsor)
  - **Highest-value test in SPEC-080.** Validates the GAP-028 nested relation (`data.sponsorship.sponsor`).
  - Blocked by: T-003, T-010
  - Blocks: T-022

- [ ] **T-012** (complexity: 3) - Write event.integration.test.ts
  - 4 relations: author, location, organizer, tags (m2m).
  - Blocked by: T-004
  - Blocks: T-022

- [ ] **T-013** (complexity: 2) - Write accommodation-review.integration.test.ts
  - user, accommodation.
  - Blocked by: T-005
  - Blocks: T-022

- [ ] **T-014** (complexity: 2) - Write destination-review.integration.test.ts
  - user, destination.
  - Blocked by: T-006
  - Blocks: T-022

- [ ] **T-015** (complexity: 2) - Write owner-promotion.integration.test.ts
  - owner, accommodation.
  - Blocked by: T-007
  - Blocks: T-022

- [ ] **T-016** (complexity: 2) - Write sponsorship.integration.test.ts
  - sponsorUser, level, package.
  - Blocked by: T-009
  - Blocks: T-022

- [ ] **T-017** (complexity: 2) - Write sponsorship-package.integration.test.ts
  - eventLevel.
  - Blocked by: T-008
  - Blocks: T-022

- [ ] **T-018** (complexity: 2) - Write post-sponsorship.integration.test.ts
  - post, sponsor.
  - Blocked by: T-010
  - Blocks: T-022

### Integration Phase (wiring)

- [ ] **T-019** (complexity: 2) - Wire test:integration into turbo.json + root scripts
  - Confirm root `pnpm test:integration` runs both `@repo/db` and `@repo/service-core`.
  - Blocked by: T-001
  - Blocks: T-020, T-021

- [ ] **T-020** (complexity: 2) - Add service-core integration step to .github/workflows/ci.yml
  - After existing DB integration step.
  - Blocked by: T-019
  - Blocks: T-022

### Docs Phase

- [ ] **T-021** (complexity: 1) - Document integration tests in packages/service-core/CLAUDE.md
  - Per template in spec.md.
  - Blocked by: T-001, T-019
  - Blocks: T-022

### Cleanup Phase

- [ ] **T-022** (complexity: 2) - Run full SPEC-080 suite and close spec
  - Final acceptance gate. Mark spec completed if 10/10 services pass.
  - Blocked by: T-011, T-012, T-013, T-014, T-015, T-016, T-017, T-018, T-020, T-021
  - Blocks: none

---

## Dependency Graph

```
Level 0: T-001, T-002
Level 1: T-003, T-004, T-005, T-006, T-007, T-008, T-019
Level 2: T-009 (T-008), T-010 (T-003), T-012 (T-004), T-013 (T-005),
         T-014 (T-006), T-015 (T-007), T-017 (T-008), T-020 (T-019),
         T-021 (T-001+T-019)
Level 3: T-011 (T-003+T-010), T-016 (T-009), T-018 (T-010)
Level 4: T-022 (all tests + T-020 + T-021)
```

## Parallel Tracks

| Track | Chain |
|-------|-------|
| A — Post chain | T-003 -> T-010 -> {T-011, T-018} |
| B — Event | T-004 -> T-012 |
| C — Accommodation review | T-005 -> T-013 |
| D — Destination review | T-006 -> T-014 |
| E — Owner promotion | T-007 -> T-015 |
| F — Sponsorship | T-008 -> {T-009 -> T-016, T-017} |
| G — Infra | T-019 -> {T-020, T-021} |

All seven tracks become available in parallel as soon as T-001 completes. T-002 is independent administrative work.

## Suggested Start

Begin with **T-001** (complexity: 1) — it has no dependencies and unblocks 7 of the 8 first-batch tasks. Run `pnpm db:start && pnpm --filter @repo/service-core test:integration` and confirm both existing tests are green before extending the suite.

After T-001, the highest-leverage first task is **T-008** (seedSponsorshipPackage) because it has no dependencies on the accommodation chain and unblocks two tests (T-009 -> T-016, plus T-017 directly). T-003 (seedPost) is the second-highest-leverage because it unblocks the most valuable test in the spec (T-011, the nested sponsorship.sponsor case via T-010).

## Risks Carried From Spec

- **Drizzle schema gaps (GAP-009, GAP-010, etc.)**: These integration tests are DESIGNED to surface schema misconfigurations. A test failure is the expected outcome if `relations()` definitions are wrong. Treat failures as bugs to fix, not test failures to suppress.
- **Optional relation columns**: For each "optional relation absent" assertion, verify in the schema whether the FK is nullable. If NOT NULL, replace with a "relation FK points to valid row" test only.
- **Service context / DB pool wiring**: The bootstrap helpers already call `setDb(getServiceTestDb())` so model methods called without `tx` target the test pool. If service code starts using `ctx.tx` propagation more aggressively (per SPEC-059), some tests may need to thread `tx` through `withServiceTransaction` instead of relying on the global setDb wiring.
