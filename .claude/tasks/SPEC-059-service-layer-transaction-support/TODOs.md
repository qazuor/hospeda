# SPEC-059: Service-Layer Transaction Support & Concurrency Safety

## Progress: 7/32 tasks (22%)

**Average Complexity:** 2.7/4 (max)
**Critical Path:** T-001 → T-002 → T-003 → T-004 → T-012 → T-015 → T-016 → T-017 → T-030 (9 steps)
**Parallel Tracks:** 4 tracks identified (setup, core, integration, testing)

---

### Setup Phase

- [x] **T-001** (complexity: 1) — Define ServiceConfig type alias in types/index.ts
  - Rename existing ServiceContext to ServiceConfig. Pure type rename, no runtime changes.
  - Blocked by: none
  - Blocks: T-002

- [x] **T-002** (complexity: 2) — Define new ServiceContext<THookState> generic interface
  - New runtime context extending QueryContext from @repo/db. Carries tx? and hookState?.
  - Blocked by: T-001
  - Blocks: T-003, T-005, T-006

- [x] **T-003** (complexity: 2) — Update base class constructors to ServiceConfig
  - BaseService, BaseCrudService, BaseCrudPermissions, BaseCrudRelatedService constructors.
  - Blocked by: T-001, T-002
  - Blocks: T-004, T-008

- [x] **T-004** (complexity: 3) — Search-and-replace ServiceContext → ServiceConfig in all 21 concrete services + API
  - Mechanical find-and-replace across ~30-40 files. Single atomic commit.
  - Blocked by: T-003
  - Blocks: T-013, T-014, T-015, T-031

- [x] **T-005** (complexity: 3) — Create withServiceTransaction utility (utils/transaction.ts)
  - Wraps withTransaction, sets SET LOCAL statement_timeout, initializes ctx with tx + hookState.
  - Blocked by: T-002
  - Blocks: T-006, T-027

- [x] **T-006** (complexity: 1) — Export ServiceConfig, ServiceContext, withServiceTransaction from package indexes
  - Update utils/index.ts and main index.ts.
  - Blocked by: T-002, T-005
  - Blocks: T-027

- [x] **T-007** (complexity: 1) — Add idle_in_transaction_session_timeout to PostgreSQL Pool config
  - Safety net for transactions that escape withServiceTransaction's SET LOCAL guard.
  - Blocked by: none
  - Blocks: none

---

### Core Phase

- [ ] **T-008** (complexity: 4) — Add ctx to runWithLoggingAndValidation + fix error-swallowing catch block
  - Critical fix: ServiceError and unknown errors must rethrow when ctx.tx is present.
  - Blocked by: T-003
  - Blocks: T-009, T-028

- [ ] **T-009** (complexity: 3) — Add _ctx: ServiceContext to all 20 lifecycle hook signatures
  - base.crud.hooks.ts: all 20 default no-op implementations gain _ctx as last param.
  - Blocked by: T-008
  - Blocks: T-010, T-011, T-012

- [ ] **T-010** (complexity: 4) — Add ctx to BaseCrudRead methods + _executeAdminSearch
  - getByField, getById, getBySlug, getByName, list, search, adminList, count + _executeAdminSearch.
  - Blocked by: T-009
  - Blocks: T-013, T-032

- [ ] **T-011** (complexity: 4) — Add ctx to BaseCrudWrite methods + _getAndValidateEntity
  - create, update, softDelete, hardDelete, restore, updateVisibility, setFeaturedStatus + _getAndValidateEntity.
  - Blocked by: T-009
  - Blocks: T-013, T-032

- [ ] **T-012** (complexity: 2) — Add ctx to BaseCrudAdmin + abstract _executeSearch/_executeCount
  - getAdminInfo, setAdminInfo in base.crud.admin.ts + abstract declarations in base.crud.permissions.ts.
  - Blocked by: T-009
  - Blocks: T-013, T-014, T-015

- [ ] **T-013** (complexity: 3) — Update stateless concrete services batch A (13 services): _executeSearch/_executeCount ctx
  - amenity, attraction, feature, tag, eventLocation, eventOrganizer, postSponsor, postSponsorship, ownerPromotion, sponsorship, sponsorshipLevel, sponsorshipPackage, userBookmark.
  - Blocked by: T-004, T-010, T-011, T-012
  - Blocks: T-031

- [ ] **T-014** (complexity: 3) — Update UserService + ExchangeRateService: ctx on hooks and custom methods
  - UserService hook overrides. ExchangeRateService: _executeSearch/_executeCount + 4 custom public methods.
  - Blocked by: T-004, T-012
  - Blocks: none

- [ ] **T-015** (complexity: 2) — Update stateful services: _executeSearch/_executeCount signatures only
  - accommodation, accommodationReview, destination, destinationReview, event, post — signature update only.
  - Blocked by: T-004, T-012
  - Blocks: T-016, T-018, T-019, T-021, T-022, T-023

---

### Integration Phase

- [ ] **T-016** (complexity: 4) — Migrate DestinationService: DestinationHookState + replace 4 mutable fields
  - _updateId, _pendingPathUpdate, _lastDeletedDestinationSlug, _lastRestoredDestinationSlug → ctx.hookState.
  - Blocked by: T-015
  - Blocks: T-017, T-024, T-030

- [ ] **T-017** (complexity: 3) — Update DestinationService.update() override to use ctx.hookState
  - Initializes resolvedCtx, sets updateId, executes pendingPathUpdate cascade via withTransaction (Phase 3).
  - Blocked by: T-016
  - Blocks: T-024, T-030

- [ ] **T-018** (complexity: 3) — Migrate AccommodationService: AccommodationHookState + replace 2 mutable fields
  - _lastDeletedEntity, _lastRestoredAccommodation → ctx.hookState.
  - Blocked by: T-015
  - Blocks: T-025, T-029

- [ ] **T-019** (complexity: 3) — Migrate PostService: PostHookState + replace 3 mutable fields
  - _updateId, _lastDeletedPost, _lastRestoredPost → ctx.hookState.
  - Blocked by: T-015
  - Blocks: T-020

- [ ] **T-020** (complexity: 2) — Update PostService.update() override to use ctx.hookState
  - Sets hookState.updateId = id, cleans up in finally.
  - Blocked by: T-019
  - Blocks: none

- [ ] **T-021** (complexity: 2) — Migrate EventService: EventHookState + replace 2 mutable fields
  - _lastDeletedEvent, _lastRestoredEvent → ctx.hookState.
  - Blocked by: T-015
  - Blocks: none

- [ ] **T-022** (complexity: 3) — Migrate AccommodationReviewService: AccommodationReviewHookState + replace 2 fields
  - _lastDeletedAccommodationId, _lastRestoredAccommodationId → ctx.hookState. Fix _afterCreate/_afterUpdate param order.
  - Blocked by: T-015
  - Blocks: T-025

- [ ] **T-023** (complexity: 3) — Migrate DestinationReviewService: DestinationReviewHookState + replace 2 fields
  - _lastDeletedDestinationId, _lastRestoredDestinationIdForReview → ctx.hookState. Fix _afterCreate/_afterUpdate param order.
  - Blocked by: T-015
  - Blocks: T-026

- [ ] **T-024** (complexity: 3) ⚠ NEEDS SPEC-060 — Phase 4: DestinationService replace withTransaction with ctx.tx for path cascade
  - Conditional: use ctx.tx when inside withServiceTransaction, otherwise create new withTransaction.
  - Blocked by: T-017
  - Blocks: none

- [ ] **T-025** (complexity: 3) ⚠ NEEDS SPEC-060 — Phase 4: AccommodationReviewService propagate ctx.tx to stats
  - _afterCreate, _afterUpdate, _afterSoftDelete, _afterRestore pass ctx?.tx to accommodationModel.
  - Blocked by: T-018, T-022
  - Blocks: none

- [ ] **T-026** (complexity: 3) ⚠ NEEDS SPEC-060 — Phase 4: DestinationReviewService propagate ctx.tx to stats
  - _afterCreate, _afterUpdate, _afterSoftDelete, _afterRestore pass ctx?.tx to destinationModel.
  - Blocked by: T-023
  - Blocks: none

---

### Testing Phase

- [ ] **T-027** (complexity: 3) — Tests for withServiceTransaction (commit, rollback, timeout guard)
  - packages/service-core/test/utils/transaction.test.ts
  - Blocked by: T-005, T-006
  - Blocks: none

- [ ] **T-028** (complexity: 3) — Tests for runWithLoggingAndValidation tx error-rethrow behavior
  - packages/service-core/test/base/base.service.test.ts
  - Blocked by: T-008
  - Blocks: none

- [ ] **T-029** (complexity: 3) — Tests for hookState concurrency isolation (AccommodationService concurrent softDelete)
  - packages/service-core/test/services/accommodation/accommodation.hookstate.test.ts
  - Blocked by: T-018
  - Blocks: none

- [ ] **T-030** (complexity: 3) — Tests for DestinationService hookState (updateId, pendingPathUpdate)
  - packages/service-core/test/services/destination/destination.hookstate.test.ts
  - Blocked by: T-017
  - Blocks: none

- [ ] **T-031** (complexity: 2) — Tests for backward compatibility (all methods callable without ctx)
  - packages/service-core/test/base/backward-compat.test.ts
  - Blocked by: T-013
  - Blocks: none

- [ ] **T-032** (complexity: 2) — Tests for hookState initialization edge cases
  - packages/service-core/test/base/hookstate-init.test.ts
  - Blocked by: T-011
  - Blocks: none

---

## Dependency Graph

```
Level 0 (no blockers): T-001, T-007
Level 1: T-002
Level 2: T-003, T-005
Level 3: T-004, T-006
Level 4: T-008
Level 5: T-009
Level 6: T-010, T-011, T-012
Level 7: T-013, T-014, T-015, T-027, T-028, T-032
Level 8: T-016, T-018, T-019, T-021, T-022, T-023, T-031
Level 9: T-017, T-020, T-025, T-026, T-029
Level 10: T-024, T-030
```

**Phase 4 external dependency**: T-024, T-025, T-026 require SPEC-060 model-layer tx support.

## Suggested Start

Begin with **T-001** (complexity: 1) — no dependencies, purely a type rename.
Can run **T-007** in parallel (independent).

After T-001 → T-002 → T-003: the critical path through T-004 → T-008 → T-009 → T-010/T-011/T-012 → T-015 → T-016/T-017 is the backbone of this spec.

**Phases 1-3** (T-001 through T-023 + T-027 through T-032) are fully self-contained with ZERO dependency on SPEC-060.
**Phase 4** (T-024, T-025, T-026) requires SPEC-060 completion.
