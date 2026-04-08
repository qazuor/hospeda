# SPEC-058: Align BaseModel Interface with Implementation

## Progress: 0/18 tasks (0%)

**Average Complexity:** 2.2/4 (max)
**Critical Path:** T-001 -> T-002 -> T-005 -> T-006 -> T-007 -> T-008 -> T-009 -> T-015 -> T-017 (9 steps)
**Parallel Tracks:** 4 identified (T-009, T-010, T-011, T-012 run in parallel after T-008)

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Run pre-implementation verification checks
  - Verify SPEC-053 completion, circular deps, PaginatedListOutput export, EventOrganizer files, 39 model subclass count
  - Blocked by: none
  - Blocks: T-002

---

### Core Phase

- [ ] **T-002** (complexity: 2) - Create packages/db/src/types.ts with DrizzleClient and QueryContext
  - New file: DrizzleClient type alias (PgDatabase base) + QueryContext interface with tx?: DrizzleClient
  - Blocked by: T-001
  - Blocks: T-003, T-005

- [ ] **T-003** (complexity: 3) - Add BaseModel<T> interface definition to packages/db/src/types.ts
  - Full 14-member interface with JSDoc, generic constraint T extends Record<string, unknown>
  - Blocked by: T-002
  - Blocks: T-004, T-014

- [ ] **T-004** (complexity: 1) - Export DrizzleClient, QueryContext, BaseModel from packages/db/src/index.ts
  - One-line addition: export type { DrizzleClient, QueryContext, BaseModel } from './types'
  - Blocked by: T-003
  - Blocks: T-013

- [ ] **T-005** (complexity: 2) - Update withTransaction callback type in packages/db/src/client.ts
  - Change callback param from NodePgDatabase to DrizzleClient; keep getDb() return type unchanged
  - Blocked by: T-002
  - Blocks: T-006

- [ ] **T-006** (complexity: 3) - Rename BaseModel to BaseModelImpl + generic constraint + getClient() in base.model.ts
  - Rename class, add T extends Record<string, unknown>, update getClient() type, add JSDoc
  - Blocked by: T-005
  - Blocks: T-007

- [ ] **T-007** (complexity: 2) - Update all 13 method tx params in base.model.ts + backward-compat re-export
  - Change tx types from NodePgDatabase to DrizzleClient on all 13 methods; add @deprecated re-export alias
  - Blocked by: T-006
  - Blocks: T-008, T-009, T-010, T-011, T-012, T-014

---

### Integration Phase

- [ ] **T-008** (complexity: 3) - Consolidate duplicate EventOrganizer models
  - Merge orphaned root-level file into event/ dir; CRITICAL: fix getTableName() to return 'eventOrganizers'; delete orphan
  - Blocked by: T-007
  - Blocks: T-009, T-011

- [ ] **T-009** (complexity: 2) - Update accommodation model subclasses to use BaseModelImpl (8 files)
  - Mechanical rename in accommodation.model.ts, accommodationFaq, accommodationIaData, accommodationReview, amenity, feature, rAccommodationAmenity, rAccommodationFeature
  - Blocked by: T-007, T-008
  - Blocks: T-015

- [ ] **T-010** (complexity: 2) - Update billing model subclasses to use BaseModelImpl (5 files)
  - Mechanical rename in billingAddonPurchase, billingDunningAttempt, billingNotificationLog, billingSettings, billingSubscriptionEvent
  - Blocked by: T-007
  - Blocks: T-015

- [ ] **T-011** (complexity: 2) - Update destination and event model subclasses to use BaseModelImpl (6 files)
  - Mechanical rename in attraction, destination, destinationReview, rDestinationAttraction, event, eventLocation
  - Blocked by: T-007, T-008
  - Blocks: T-015

- [ ] **T-012** (complexity: 2) - Update remaining 18 model subclasses to use BaseModelImpl
  - exchange-rate(2), owner-promotion(1), post(3), revalidation(2), sponsorship(3), tag(2), user(5)
  - Blocked by: T-007
  - Blocks: T-015

- [ ] **T-013** (complexity: 2) - Update service-core/src/types/index.ts: remove BaseModel interface, add re-export
  - Remove inline BaseModel<T> definition + NodePgDatabase/schema imports; add export type { BaseModel } from '@repo/db'
  - Blocked by: T-004
  - Blocks: T-014, T-016

- [ ] **T-014** (complexity: 2) - Add implements BaseModel<T> clause to BaseModelImpl in base.model.ts
  - Add same-package import from ../types; add implements BaseModel<T> to class declaration
  - Blocked by: T-003, T-007, T-013
  - Blocks: T-015, T-016

---

### Testing Phase

- [ ] **T-015** (complexity: 2) - Run pnpm typecheck --filter @repo/db and fix all errors
  - Verify zero TypeScript errors; fix any missed BaseModel refs or interface violations
  - Blocked by: T-009, T-010, T-011, T-012, T-014
  - Blocks: T-017, T-018

- [ ] **T-016** (complexity: 2) - Run pnpm typecheck --filter @repo/service-core and fix all errors
  - Verify zero TypeScript errors; confirm BaseModel re-export works for all service-core consumers
  - Blocked by: T-013, T-014
  - Blocks: T-017, T-018

- [ ] **T-017** (complexity: 3) - Run full test suite for @repo/db and @repo/service-core and fix regressions
  - Zero test failures; verify backward-compat alias works in base.model.test.ts and modelMockFactory.ts
  - Blocked by: T-015, T-016
  - Blocks: none

- [ ] **T-018** (complexity: 2) - Run pnpm lint and fix all biome errors
  - Zero biome errors; watch for useDefaultParameterLast, noUnusedVariables, leftover imports
  - Blocked by: T-015, T-016
  - Blocks: none

---

## Dependency Graph

```
Level 0: T-001
Level 1: T-002
Level 2: T-003, T-005
Level 3: T-004, T-006
Level 4: T-007, T-013
Level 5: T-008, T-010, T-012, T-014
Level 6: T-009, T-011, T-016
Level 7: T-015
Level 8: T-017, T-018
```

## Parallel Tracks (after T-007)

- **Track A**: T-008 → T-009, T-011 (accommodation + destination/event)
- **Track B**: T-010 (billing — no EventOrganizer dep)
- **Track C**: T-012 (remaining 18 models — no EventOrganizer dep)
- **Track D**: T-013 → T-016 (service-core — independent of model renames)

## Suggested Start

Begin with **T-001** (complexity: 2) — pre-implementation verification with no dependencies. Unblocks T-002.

## Key Risks

1. **T-008 getTableName CRITICAL**: Must return `'eventOrganizers'` (not `'event_organizers'`). Wrong value = runtime crash in findAllWithRelations.
2. **T-007 backward-compat alias**: Must be added before running tests or base.model.test.ts will fail.
3. **T-014 implements clause**: Will surface any signature mismatch immediately — run typecheck right after.
4. **T-012 verification**: After completion run `rg 'extends BaseModel<' packages/db/src/models/` — must return 0 results.
