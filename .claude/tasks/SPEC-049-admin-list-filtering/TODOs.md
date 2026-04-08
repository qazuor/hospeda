# SPEC-049: Admin List Filtering - adminList() Method for BaseCrudService

## Progress: 47/68 tasks (69%)

**Last Updated:** 2026-03-20 (Audit Pass 1)
**Average Complexity:** 1.9/2.5 (max)
**Gaps Found:** 10 (see `.claude/specs/specs-gaps-049.md`)

---

### Setup Phase (16 tasks) - COMPLETE

- [x] **T-001** (complexity: 1) - Add CONFIGURATION_ERROR to ServiceErrorCode enum
- [x] **T-002** (complexity: 1) - Map CONFIGURATION_ERROR to HTTP 500 in ResponseFactory
- [x] **T-003** (complexity: 1.5) - Create queryBooleanParam() helper and export
- [x] **T-004** (complexity: 1.5) - Tests for queryBooleanParam() helper
- [x] **T-005** (complexity: 1.5) - Replace z.coerce.boolean() in Accommodation, Attraction, Event schemas
- [x] **T-006** (complexity: 2) - Replace z.coerce.boolean() in Post, Destination, Amenity, Feature schemas
- [x] **T-007** (complexity: 1.5) - Replace z.coerce.boolean() in OwnerPromotion, EventLocation, EventOrganizer schemas
- [x] **T-008** (complexity: 1) - Replace z.coerce.boolean() in review AdminSearchSchemas
- [x] **T-009** (complexity: 1.5) - Remove nameContains from TagAdminSearchSchema
- [x] **T-010** (complexity: 1.5) - Add averageRating to accommodation_reviews Drizzle schema
- [x] **T-011** (complexity: 1.5) - Add averageRating to destination_reviews Drizzle schema
- [x] **T-012** (complexity: 2.5) - Generate DB migration for averageRating with backfill SQL
- [x] **T-013** (complexity: 2.5) - AccommodationReviewService hooks for averageRating
- [x] **T-014** (complexity: 2.5) - DestinationReviewService hooks for averageRating
- [x] **T-015** (complexity: 2) - Tests for AccommodationReview averageRating hooks
- [x] **T-016** (complexity: 2) - Tests for DestinationReview averageRating hooks

### Core Phase (21 tasks) - 16/21 COMPLETE

- [x] **T-017** (complexity: 2) - Add _gte/_lte suffix handling to buildWhereClause
- [x] **T-018** (complexity: 2) - Add buildSearchCondition() utility function
- [x] **T-019** (complexity: 2) - Tests for _gte/_lte operators
- [x] **T-020** (complexity: 2) - Tests for buildSearchCondition()
- [x] **T-021** (complexity: 1) - Add getTable() public method to BaseModel
- [x] **T-022** (complexity: 2.5) - Add additionalConditions to BaseModel.findAll()
- [x] **T-023** (complexity: 2) - Refactor BaseModel.count() to options object
- [x] **T-024** (complexity: 2) - Migrate all count(where, tx) callers
- [x] **T-025** (complexity: 2.5) - Add additionalConditions to findAllWithRelations()
- [ ] **T-026** (complexity: 2) - Tests for findAll with additionalConditions (**INCOMPLETE** - basic test exists but doesn't cover additionalConditions)
- [ ] **T-027** (complexity: 2) - Tests for count() with options object (**MISSING**)
- [x] **T-028** (complexity: 2.5) - Fix search OR bug in list() method
- [ ] **T-029** (complexity: 2) - Tests for list() search OR logic fix (**MISSING** - no explicit OR regression test)
- [x] **T-030** (complexity: 1) - Add adminSearchSchema property to BaseCrudPermissions
- [x] **T-031** (complexity: 2.5) - Implement adminList() method on BaseCrudRead
- [x] **T-032** (complexity: 2.5) - Implement _executeAdminSearch() default method
- [ ] **T-033** (complexity: 2.5) - Tests for adminList() sort, validation, permissions (**MISSING**)
- [ ] **T-034** (complexity: 2.5) - Tests for adminList() status, deleted, dates, search (**MISSING**)
- [ ] **T-035** (complexity: 2.5) - Tests for _executeAdminSearch default behavior (**MISSING**)
- [x] **T-036** (complexity: 1.5) - Create SponsorshipAdminSearchSchema
- [x] **T-037** (complexity: 2) - Export SponsorshipAdminSearchSchema + tests

### Integration Phase (18 + 3 new tasks) - 18/21 COMPLETE

**Services (all wired):**

- [x] **T-038** (complexity: 1.5) - Wire adminSearchSchema on Amenity + Feature services
- [x] **T-039** (complexity: 1.5) - Wire adminSearchSchema on Tag + Attraction services
- [x] **T-040** (complexity: 1.5) - Wire adminSearchSchema on EventLocation + EventOrganizer services
- [x] **T-041** (complexity: 1.5) - Wire adminSearchSchema on OwnerPromotion + PostSponsor services
- [x] **T-042** (complexity: 1.5) - Wire adminSearchSchema on Post + Destination services
- [x] **T-043** (complexity: 2.5) - AccommodationService override (JSONB price)
- [x] **T-044** (complexity: 2.5) - EventService override (JSONB dates)
- [x] **T-045** (complexity: 2.5) - UserService override (email ilike)
- [x] **T-046** (complexity: 2) - AccommodationReviewService override (rating range)
- [x] **T-047** (complexity: 2) - DestinationReviewService override (rating range)
- [x] **T-048** (complexity: 2) - SponsorshipService override (status rename)

**Routes (all switched to adminList):**

- [x] **T-049** (complexity: 2) - Update accommodation + user admin list routes
- [x] **T-050** (complexity: 2) - Update destination + event + post admin list routes
- [x] **T-051** (complexity: 2) - Update amenity + feature + tag + attraction admin list routes
- [x] **T-052** (complexity: 2) - Update event-location + event-organizer + owner-promotion routes
- [x] **T-053** (complexity: 1) - Update postSponsor admin list route
- [x] **T-054** (complexity: 1.5) - Update accommodation-review + destination-review routes
- [x] **T-055** (complexity: 2) - Update sponsorship admin list route + schema migration

**NEW - Frontend fixes (from gaps audit):**

- [ ] **T-065** (complexity: 1) - **[CRITICAL GAP-001]** Fix sort format mismatch: frontend sends JSON array, backend expects field:dir
  - ALL admin sorting is silently broken
  - Fix: apps/admin/src/components/entity-list/api/createEntityApi.ts

- [ ] **T-066** (complexity: 1) - **[GAP-009]** Fix sponsorship status filter name: frontend sends 'status', backend expects 'sponsorshipStatus'
  - Sponsorship filtering silently broken
  - Fix: apps/admin/src/features/sponsorships/components/SponsorshipsTab.tsx

- [ ] **T-067** (complexity: 1) - **[GAP-004]** Document toString() in review rating gte/lte comparisons
  - Add JSDoc explaining Drizzle numeric type requires string

### Testing Phase (8 + 1 new tasks) - 0/9 COMPLETE

- [ ] **T-056** (complexity: 2.5) - Integration tests: accommodation (ownerId, type, status)
- [ ] **T-057** (complexity: 2.5) - Integration tests: accommodation (sort, deleted, search, price)
- [ ] **T-058** (complexity: 2.5) - Integration tests: event (JSONB dates, organizerId)
- [ ] **T-059** (complexity: 2) - Integration tests: user (role, email, search)
- [ ] **T-060** (complexity: 2) - Integration tests: amenity (default impl)
- [ ] **T-061** (complexity: 2.5) - Integration tests: reviews (rating range)
- [ ] **T-062** (complexity: 2.5) - Integration tests: sponsorship (status rename) - Blocked by T-066
- [ ] **T-063** (complexity: 2.5) - Integration tests: destination (default with relations)
- [ ] **T-068** (complexity: 2) - **[GAP-005]** Add missing schema unit tests (CONFIGURATION_ERROR, tag admin-search, review admin-search)

### Verification Phase (1 task) - 0/1 COMPLETE

- [ ] **T-064** (complexity: 2) - Run full test suite, typecheck, and lint
  - Blocked by: T-056..T-063, T-065, T-066, T-068

---

## Remaining Work Summary

| Category | Pending | Priority |
|----------|---------|----------|
| **Frontend fixes** (T-065, T-066, T-067) | 3 tasks | P0/P1 |
| **Core unit tests** (T-026, T-027, T-029, T-033-T-035) | 6 tasks | P1 |
| **Schema tests** (T-068) | 1 task | P2 |
| **Integration tests** (T-056..T-063) | 8 tasks | P1 |
| **Verification** (T-064) | 1 task | P2 |
| **TOTAL REMAINING** | **21 tasks** | |

## Suggested Priority Order

1. **T-065** [CRITICAL] - Fix sort format mismatch (complexity 1, unblocks ALL sorting)
2. **T-066** [HIGH] - Fix sponsorship filter name (complexity 1, unblocks sponsorship testing)
3. **T-033, T-034, T-035** - adminList() + _executeAdminSearch unit tests
4. **T-026, T-027, T-029** - DB layer + list() regression tests
5. **T-056..T-063** - Integration tests
6. **T-067** - toString() documentation
7. **T-068** - Schema unit tests
8. **T-064** - Final verification
