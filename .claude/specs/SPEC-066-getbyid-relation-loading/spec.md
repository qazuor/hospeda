# SPEC-066: getById Relation Loading Consistency

> **Status**: draft
> **Priority**: P2
> **Complexity**: Medium
> **Origin**: Discovered during SPEC-062 review (Rev 6, R-008 and Future Considerations)
> **Related**: SPEC-062 (runtime response validation), SPEC-058 (BaseModel interface alignment)
> **Created**: 2026-04-03

---

## Overview

The Hospeda API has an architectural inconsistency in how single-entity fetches (`getById`, `getBySlug`, `getByName`) and list fetches (`list`, `adminList`) load related data. List operations use `model.findAllWithRelations()` with the service's `getDefaultListRelations()` configuration, returning fully populated nested objects (e.g., `destination: { id, name, slug, ... }`). Single-entity fetches use `model.findOne()`, which issues a bare `SELECT *` without any relation loading, returning only flat foreign key references (e.g., `destinationId: "uuid"`).

This means the same entity returned from two different endpoints has a different shape. An API consumer fetching an accommodation from `GET /api/v1/public/accommodations` receives `destination: { id, name, slug, ... }`, but fetching the same accommodation from `GET /api/v1/public/accommodations/:id` receives only `destinationId: "uuid"` with no nested `destination` object. This forces consumers to make additional requests to resolve references, creates confusion in client code, and undermines the consistency guarantees of the API.

---

## Goals

- Achieve response shape consistency between `getById`/`getBySlug`/`getByName` and `list`/`adminList` for all entities that define default list relations.
- Add a `findOneWithRelations()` method to `BaseModel` that mirrors the relational query behavior of `findAllWithRelations()` but for a single record.
- Introduce a `getDefaultGetByIdRelations()` hook in `BaseCrudService` that defaults to `getDefaultListRelations()` for consistency but can be overridden per-service when getById needs different relation depth.
- Ensure the change is backward compatible.. entities that return `undefined` from `getDefaultListRelations()` (no relations) are unaffected.

### Success Metrics

- All 10 affected entities return the same relation structure from getById as they do from list endpoints.
- No regression in existing list/adminList behavior.
- `findOneWithRelations()` has equivalent test coverage to `findAllWithRelations()`.
- No measurable latency regression on getById endpoints beyond the expected cost of relation JOINs (which already exist on list endpoints for the same entities).

---

## Problem Statement

### The Code Path Divergence (Verified Trace)

The following code paths have been individually verified against current source code. They show how `list()` and `getByField()` take different paths for relation loading.

**Path A: list() and adminList() .. WITH relations.**

1. `BaseCrudRead.list()` (`packages/service-core/src/base/base.crud.read.ts`, line 148) calls `this.getDefaultListRelations()` (line 182).
2. If relations are defined, it calls `this.model.findAllWithRelations(relationsToUse, ...)` (line 212).
3. `BaseModel.findAllWithRelations()` (`packages/db/src/base/base.model.ts`, line 527) uses Drizzle's relational query API via `db.query[tableName].findMany({ with: transformedRelations, ... })` (lines 594-625).
4. The result includes fully populated nested relation objects.

The same path applies to `_executeAdminSearch()` (line 421), which also calls `this.getDefaultListRelations()` (line 438) and `this.model.findAllWithRelations()` (line 441).

**Path B: getByField() .. WITHOUT relations.**

1. `BaseCrudRead.getByField()` (`packages/service-core/src/base/base.crud.read.ts`, line 60) builds a `where` clause from the field/value pair (line 83).
2. It calls `this.model.findOne(where)` (line 85).
3. `BaseModel.findOne()` (`packages/db/src/base/base.model.ts`, line 195) issues `db.select().from(this.table).where(whereClause).limit(1)` (line 203).
4. This is a plain `SELECT *` with no JOINs. Only columns from the base table are returned.
5. Foreign key columns (e.g., `destinationId`, `ownerId`, `authorId`) contain UUID strings.
6. No nested relation objects are present.

**Note:** `getById()` (line 108), `getBySlug()` (line 119), and `getByName()` (line 130) all delegate to `getByField()`. Additionally, `PostService` and `AccommodationService` call `this.getByField()` directly for custom lookups. Modifying `getByField()` is therefore the single change point that fixes all five callers. No changes to `getById`, `getBySlug`, `getByName`, or the service-specific callers are needed.

**Path C: findWithRelations() .. EXISTING overrides (not used by getByField, but actively used elsewhere).**

`BaseModel.findWithRelations()` (line 457) has a base implementation that is a documented **STUB**.. its JSDoc (line 449) states it "ignores the `relations` parameter" and performs a plain `select().from().where().limit(1)`. However, **16 model subclasses override this method** with working implementations that use `db.query[tableName].findFirst({ where, with })`:

| # | Model | File | Relations Loaded |
|---|-------|------|-----------------|
| 1 | AccommodationModel | `accommodation/accommodation.model.ts:287` | destination |
| 2 | DestinationModel | `destination/destination.model.ts:41` | accommodations, reviews, tags, attractions, createdBy, updatedBy, deletedBy |
| 3 | EventModel | `event/event.model.ts:22` | author, createdBy, updatedBy, deletedBy, location, organizer, tags |
| 4 | SponsorshipModel | `sponsorship/sponsorship.model.ts:146` | sponsorUser, level, package, createdBy, updatedBy, deletedBy |
| 5 | SponsorshipLevelModel | `sponsorship/sponsorshipLevel.model.ts:77` | createdBy, updatedBy, deletedBy |
| 6 | SponsorshipPackageModel | `sponsorship/sponsorshipPackage.model.ts:68` | eventLevel, createdBy, updatedBy, deletedBy |
| 7 | OwnerPromotionModel | `owner-promotion/ownerPromotion.model.ts:153` | owner, accommodation, createdBy, updatedBy, deletedBy |
| 8 | PostSponsorshipModel | `post/postSponsorship.model.ts:22` | post, sponsor |
| 9 | AmenityModel | `accommodation/amenity.model.ts:22` | accommodationAmenities |
| 10 | EventOrganizerModel | `eventOrganizer.model.ts:32` | events |
| 11 | RAccommodationAmenityModel | `accommodation/rAccommodationAmenity.model.ts:68` | accommodation, amenity |
| 12 | RAccommodationFeatureModel | `accommodation/rAccommodationFeature.model.ts:68` | accommodation, feature |
| 13 | RDestinationAttractionModel | `destination/rDestinationAttraction.model.ts:22` | destination, attraction |
| 14 | REntityTagModel | `tag/rEntityTag.model.ts:24` | tag |
| 15 | RUserPermissionModel | `user/rUserPermission.model.ts:24` | role, permission |
| 16 | RRolePermissionModel | `user/rRolePermission.model.ts:24` | role, permission |

Additionally, `findWithRelations()` **IS called from the service layer**: `AccommodationService.getFaqs()` (`accommodation.service.ts:986`) calls `this.model.findWithRelations({ id: validated.accommodationId }, { faqs: true })` to load an accommodation with its FAQs. The test suite also mocks this method (`modelMockFactory.ts` includes `findWithRelations` as a standard mock method).

**Important:** Despite these overrides and usages, `getByField()` does NOT call `findWithRelations()`. The `getById`/`getBySlug`/`getByName` code path always goes through `findOne()`, which is the inconsistency this spec addresses. The new `findOneWithRelations()` method is added ALONGSIDE `findWithRelations()`.. not as a replacement. See "Design Decision: New Method vs Replacing Existing" below.

### Entities Affected (10 of 21 CRUD services)

The following services define non-`undefined` return values from `getDefaultListRelations()`, meaning their list endpoints return nested relation data while their getById endpoints do not:

| # | Service | File | `getDefaultListRelations()` | Relations Loaded for List |
|---|---------|------|---------------------------|--------------------------|
| 1 | PostService | `post/post.service.ts:77` | `{ author: true, relatedAccommodation: true, relatedDestination: true, relatedEvent: true, sponsorship: { sponsor: true } }` | author, relatedAccommodation, relatedDestination, relatedEvent, sponsorship with nested sponsor |
| 2 | AccommodationService | `accommodation/accommodation.service.ts:133` | `{ destination: true, owner: true }` | destination, owner |
| 3 | AccommodationReviewService | `accommodationReview/accommodationReview.service.ts:69` | `{ user: true, accommodation: true }` | user, accommodation |
| 4 | DestinationReviewService | `destinationReview/destinationReview.service.ts:56` | `{ user: true, destination: true }` | user, destination |
| 5 | PostSponsorshipService | `postSponsorship/postSponsorship.service.ts:44` | `{ post: true, sponsor: true }` | post, sponsor |
| 6 | UserBookmarkService | `userBookmark/userBookmark.service.ts:45` | `{ user: true }` | user |
| 7 | OwnerPromotionService | `ownerPromotion/ownerPromotion.service.ts:51` | `{ owner: true, accommodation: true }` | owner, accommodation |
| 8 | SponsorshipService | `sponsorship/sponsorship.service.ts:49` | `{ sponsorUser: true, level: true, package: true }` | sponsorUser, level, package |
| 9 | SponsorshipPackageService | `sponsorship/sponsorshipPackage.service.ts:37` | `{ eventLevel: true }` | eventLevel |
| 10 | EventService | `event/event.service.ts:77` | `{ organizer: true, location: true }` | organizer, location |

**Services NOT affected (11 of 21).** These return `undefined` from `getDefaultListRelations()`, so both list and getById already return the same flat structure:

- **Extending BaseCrudService (7):** DestinationService, UserService, PostSponsorService, EventOrganizerService, EventLocationService, SponsorshipLevelService, ExchangeRateService.
- **Extending BaseCrudRelatedService (4):** TagService, FeatureService, AmenityService, AttractionService. These extend `BaseCrudRelatedService` (a subclass of `BaseCrudService`), not `BaseCrudService` directly. Since `BaseCrudRelatedService` inherits from `BaseCrudService`, `getByField()` and the new `getDefaultGetByIdRelations()` hook apply to them as well.. but since they return `undefined` from `getDefaultListRelations()`, they are unaffected.

**Non-CRUD services (not counted above):** PermissionService and ExchangeRateConfigService extend `BaseService` (not `BaseCrudService`) and do not have `getByField()` or relation hooks. They are outside this spec's scope.

### Concrete Example of the Inconsistency

**Accommodation entity:**

```
GET /api/v1/public/accommodations (list)
→ items[0] = {
    id: "acc-uuid",
    name: "Hotel Paradise",
    destinationId: "dest-uuid",
    ownerId: "owner-uuid",
    destination: { id: "dest-uuid", name: "Concepcion", slug: "concepcion", ... },
    owner: { id: "owner-uuid", displayName: "John", ... },
    ...
  }

GET /api/v1/public/accommodations/acc-uuid (getById)
→ data = {
    id: "acc-uuid",
    name: "Hotel Paradise",
    destinationId: "dest-uuid",
    ownerId: "owner-uuid",
    // NO destination object
    // NO owner object
    ...
  }
```

---

## User Stories

### US-001: Consistent Response Shape Between List and Detail Endpoints

As a frontend developer consuming the Hospeda API,
I want the accommodation detail endpoint (`GET /api/v1/public/accommodations/:id`) to return the same nested relation structure as the list endpoint (`GET /api/v1/public/accommodations`),
so that I can reuse the same TypeScript interface and rendering logic for both list items and detail views without making additional API calls to resolve foreign key references.

#### Acceptance Criteria

**Scenario 1. getById returns populated relations matching list output.**

Given an accommodation record with `destinationId` referencing a valid destination,
When I call `GET /api/v1/public/accommodations/:id`,
Then the response contains a `destination` object with `{ id, name, slug, ... }`,
And the response also contains `destinationId` as a flat field (the FK column),
And the `destination` object matches the shape returned by the list endpoint for the same record.

**Scenario 2. getBySlug returns populated relations matching list output.**

Given an accommodation with slug `hotel-paradise`,
When I call `GET /api/v1/public/accommodations/slug/hotel-paradise`,
Then the response contains the same populated relation objects as Scenario 1.

**Scenario 3. Entities with no relations defined are unaffected.**

Given an entity service that returns `undefined` from `getDefaultListRelations()` (e.g., TagService),
When I call `GET /api/v1/public/tags/:id`,
Then the response contains only flat fields (same as current behavior),
And no JOINs are executed,
And there is no behavioral change from pre-SPEC-066 behavior.

**Scenario 4. Nested relations are populated correctly.**

Given a post with a sponsorship that has a nested sponsor relation,
When I call `GET /api/v1/public/posts/:id`,
Then the response contains `sponsorship: { ..., sponsor: { id, displayName, ... } }`,
And the nesting depth matches the list endpoint output.

---

### US-002: Developer Control Over getById Relation Depth

As a service developer maintaining a domain entity,
I want to be able to override which relations are loaded for getById independently from list,
so that I can optimize getById queries when the detail view needs different data than the list view (e.g., more relations for detail, fewer for list).

#### Acceptance Criteria

**Scenario 1. Default behavior delegates to list relations.**

Given a service that does NOT override `getDefaultGetByIdRelations()`,
When `getByField()` is called,
Then it uses the same relations as `getDefaultListRelations()`,
And the developer does not need to explicitly configure anything.

**Scenario 2. Custom override loads different relations for getById.**

Given a service that overrides `getDefaultGetByIdRelations()` to return a different set of relations,
When `getByField()` is called,
Then it uses the relations from `getDefaultGetByIdRelations()`,
And the list endpoint continues using `getDefaultListRelations()` (unchanged).

**Scenario 3. Override can return undefined to disable relation loading.**

Given a service that overrides `getDefaultGetByIdRelations()` to return `undefined`,
When `getByField()` is called,
Then no relations are loaded (uses `model.findOne()` as today),
And the behavior is equivalent to the current pre-SPEC-066 behavior.

---

### US-003: BaseModel Supports Single-Entity Relation Loading

As a developer working on the database layer,
I want `BaseModel` to provide a `findOneWithRelations()` method that loads a single entity with relations using Drizzle's relational query API,
so that the service layer has a proper abstraction for loading a single entity with its relations without resorting to `findAllWithRelations()` with `limit: 1`.

#### Acceptance Criteria

**Scenario 1. findOneWithRelations returns entity with populated relations.**

Given a valid `where` clause and a `relations` config,
When `findOneWithRelations(where, relations)` is called,
Then it returns a single entity with populated relation objects,
And it uses Drizzle's `db.query[tableName].findFirst({ where, with })` API.

**Scenario 2. findOneWithRelations returns null for non-existent entity.**

Given a `where` clause that matches no records,
When `findOneWithRelations(where, relations)` is called,
Then it returns `null`,
And no error is thrown.

**Scenario 3. findOneWithRelations supports nested relations.**

Given a relations config with nesting (e.g., `{ sponsorship: { sponsor: true } }`),
When `findOneWithRelations(where, relations)` is called,
Then the returned entity includes the nested relation objects,
And the `transformRelationsForDrizzle()` helper (already used by `findAllWithRelations()`) is reused for relation transformation.

**Scenario 4. findOneWithRelations supports transactions.**

Given an active database transaction `tx`,
When `findOneWithRelations(where, relations, tx)` is called,
Then the query executes within the transaction context.

---

## Scope

### In Scope

**Layer 1: BaseModel (`packages/db/src/base/base.model.ts`)**

- Add a new `findOneWithRelations()` method that uses Drizzle's `db.query[tableName].findFirst()` API to load a single entity with relations.
- The method signature: `findOneWithRelations(where: Record<string, unknown>, relations: Record<string, boolean | Record<string, unknown>>, tx?: NodePgDatabase<typeof schema>): Promise<T | null>`.
- Implementation mirrors `findAllWithRelations()` (lines 527-675) but uses `findFirst()` instead of `findMany()`, omits pagination/sorting/count, and returns `T | null` instead of `{ items: T[], total: number }`.
- Reuse the existing `transformRelationsForDrizzle()` helper function (lines 24-49) for converting the relations config to Drizzle's `{ with: { ... } }` syntax.
- The existing `findWithRelations()` method (lines 457-493) is left UNCHANGED. It has 16 model subclass overrides and is actively called by `AccommodationService.getFaqs()`. The new `findOneWithRelations()` is a separate, independent method. See "Design Decision: New Method vs Replacing Existing" in Implementation Notes for rationale.
- Include proper logging via `logQuery()` and error handling via `logError()` and `DbError`, following the same patterns as `findAllWithRelations()`.

**Layer 2: BaseCrudService (`packages/service-core/src/base/`)**

- Add a `getDefaultGetByIdRelations()` protected method to `BaseCrudPermissions` (where `getDefaultListRelations()` is declared, line 49 of `base.crud.permissions.ts`).
- Default implementation: `return this.getDefaultListRelations()`. This ensures getById and list return the same relations by default.
- The method is NOT abstract (unlike `getDefaultListRelations()`). It has a concrete default implementation. Services MAY override it.
- Modify `getByField()` in `BaseCrudRead` (line 60 of `base.crud.read.ts`) to check `this.getDefaultGetByIdRelations()`. If relations are defined (not `undefined`), use `this.model.findOneWithRelations(where, relations)` instead of `this.model.findOne(where)`. If relations are `undefined`, fall back to `this.model.findOne(where)` (current behavior, no change).

**Layer 3: Tests**

- Unit tests for `findOneWithRelations()` in the db package test suite (new file: `packages/db/test/base/findOneWithRelations.test.ts`), covering: entity found with relations, entity not found (returns null), nested relations, transaction support, empty relations fallback (delegates to `findOne()`), error handling (throws `DbError`), invalid relations parameter.
- Unit tests for `getDefaultGetByIdRelations()` default behavior and override behavior in the service-core test suite (add to existing `packages/service-core/test/base/crud/getById.test.ts`).
- Unit tests verifying that `getByField()` calls `findOneWithRelations()` when relations are defined and `findOne()` when relations are undefined (add to existing `packages/service-core/test/base/crud/getById.test.ts`).
- Update mock factory (`packages/service-core/test/utils/modelMockFactory.ts`) to include `findOneWithRelations` in both the `ModelMock` interface (alongside existing `findWithRelations: Mock` at line 26) and the `createBaseModelMock()` factory function (alongside existing `findWithRelations: vi.fn()` at line 57).
- Integration tests (if feasible within existing test infrastructure) verifying that getById endpoints for the 10 affected entities return populated relation objects.

### Out of Scope

- **Changing which relations each entity loads.** This spec adds the mechanism for getById to load relations, defaulting to the same set as list. Adjusting which relations are loaded for specific entities is a follow-on per-entity decision.
- **Adding new relations to any entity.** No new Drizzle relation definitions are added.
- **SPEC-062 response stripping.** Response schema enforcement is handled by SPEC-062. This spec only ensures the data is present before stripping occurs. The two specs are complementary.
- **Performance optimization of existing list relation queries.** The existing `findAllWithRelations()` implementation is not modified.
- **Modifying `findAllWithRelations()` behavior.** That method remains unchanged.
- **API route handler changes.** Route handlers call service methods (`getById`, `getBySlug`) which internally call `getByField()`. No handler code changes are needed because the service layer transparently handles relation loading. This applies to all three route tiers (public, protected, and admin).. admin getById endpoints benefit automatically since they use the same `BaseCrudService.getByField()` path.

### Future Considerations

- Per-entity customization of `getDefaultGetByIdRelations()` to load MORE relations than list (e.g., a detail view loading reviews and amenities that are too expensive for list views). **Note (added 2026-04-04, MEDIUM-006)**: Do NOT override `getDefaultGetByIdRelations()` to return FEWER relations than `getDefaultListRelations()`. This creates inconsistent response shapes between list and detail endpoints, breaking client code that assumes detail responses contain at least the same data as list items. If a service needs fewer relations for getById (rare), document the reason in a code comment and add a test case comparing list and detail response structures.
- Adding a `relations` query parameter to getById/getBySlug endpoints, allowing API consumers to request specific relations on a per-request basis (similar to GraphQL field selection).
- Column projection at the database level (`SELECT` specific columns instead of `SELECT *`) to complement relation loading with field-level optimization.
- **SPEC-054 filter coordination**: When relation-type filters are added in a future spec (e.g., `destinationId` autocomplete in admin filter bar), that spec MUST verify that `getDefaultGetByIdRelations()` includes any relations used by filter controls. If a filter displays `destination.name` in dropdown options but `getById` doesn't load `destination`, the filter UI will break for detail views.

> **Type system note (added 2026-04-04, MEDIUM-002)**: The `T` generic parameter in `BaseModel<T>` represents the **flat entity type** as defined in the Zod schema. When `findOneWithRelations()` returns data with loaded relations, the runtime value extends `T` with additional relation properties, but the TypeScript return type remains `Promise<T | null>`. This is intentional for simplicity.. using a computed union type for every possible relation combination would be fragile. Callers that need typed access to relation fields should cast or narrow: `const acc = result as Accommodation & { destination: Destination }`.

---

## Risks

### R-001. getById responses grow larger, potentially affecting frontend consumers

**Description.** After this change, getById endpoints for the 10 affected entities will return MORE data than before (nested relation objects added). Frontend code that destructures or renders getById responses may encounter unexpected nested objects. However, these objects match what the same frontend already receives from list endpoints for the same entity.

**Likelihood.** Low. Frontend code that uses list data already handles the nested structure. Detail pages that use getById data either (a) already make separate calls to resolve references (which this change eliminates), or (b) don't display relation data (in which case extra fields are harmless).

**Mitigation.** Document the change in API release notes. The data is additive (no fields removed, only new nested objects added), so it is not a breaking change per semantic versioning. SPEC-062's response schema stripping (if implemented first) will ensure that only declared fields reach the client regardless.

---

### R-002. Performance impact from adding JOINs to getById queries

**Description.** `findOne()` executes a single `SELECT * FROM table WHERE id = $1 LIMIT 1`, which is a single-table indexed lookup. `findOneWithRelations()` uses Drizzle's relational query API, which may execute multiple queries or JOINs depending on the relation type.

**Likelihood.** Low impact. The same relations are already loaded for every list/adminList request. getById is typically called for a single record, so the overhead is proportionally smaller than on list (which loads relations for up to 20-100 items per page). Drizzle's `findFirst()` with relations generates a single SQL query using **LEFT JOIN LATERAL** subqueries for ALL relation types (both `One` and `Many`). The only difference is that `One` relations apply `LIMIT 1` inside the lateral subquery. This is the same SQL generation strategy used by `findMany()`. Verified against drizzle-orm v0.44.7 source code (`pg-core/dialect.js` lines 1024-1036).

**Impact.** Expected latency increase: 1-5ms per getById call (additional JOIN or sub-query for each relation). This is negligible against typical API response times of 50-200ms.

**Mitigation.** The `getDefaultGetByIdRelations()` hook allows per-service override to `undefined` if a specific entity's getById performance is critical and relations are not needed. Monitoring existing list endpoint performance for the same entities provides a baseline.

---

### R-003. findWithRelations() has 16 active subclass overrides

**Description.** The existing `findWithRelations()` method (base STUB at lines 457-493) is overridden by 16 model subclasses with working implementations. Additionally, `AccommodationService.getFaqs()` calls `this.model.findWithRelations()` at runtime. An earlier draft of this spec proposed replacing the stub with the new `findOneWithRelations()` implementation, which would have broken all 16 overrides and the `getFaqs()` call.

**Likelihood.** N/A (resolved by design decision).

**Mitigation.** The spec now adds `findOneWithRelations()` as a NEW, independent method on `BaseModel`. `findWithRelations()` and all its overrides remain completely untouched. The two methods coexist: `findOneWithRelations()` serves the generic getByField path via service-configured relations, while `findWithRelations()` continues to serve custom model-specific use cases (like `getFaqs()`). A future spec may consolidate the two methods and deprecate the 16 per-model overrides once the generic base implementation proves reliable.

---

### R-004. Drizzle findFirst() API compatibility

**Description.** This spec assumes Drizzle's relational query API provides a `findFirst()` method on `db.query[tableName]` that accepts `{ where, with }` parameters, mirroring `findMany()`. If the API does not support `findFirst()`, an alternative approach is needed.

**Likelihood.** Very low. Drizzle's relational query API supports `findFirst()` with the same parameters as `findMany()` (including `with` for relations). This is documented in Drizzle's official documentation.

**Mitigation.** Verify during implementation that `findFirst()` is available on the Drizzle query builder for the project's installed version. Fallback: use `findMany({ limit: 1, ... })` and take the first result, which achieves identical behavior.

---

## Execution Order & Agent Safety Guide

> **For agents**: Read this section before implementing. If prerequisites are not met, STOP and report to the user.

### Prerequisites

- **SPEC-062 Phase 0** (Access Schema Extensions): **MUST be merged to `main`**. Phase 0 adds relation fields (e.g., `destination: DestinationPublicSchema.optional()`) to access schemas. Without this, SPEC-062 Phase 1's runtime enforcement will STRIP the relation data that SPEC-066 loads, completely negating the purpose of this spec.

### Recommended Prerequisites (not blocking, but avoid double work)

- **SPEC-058** (BaseModel Interface Alignment): If merged, use `DrizzleClient` type for `tx` parameter in `findOneWithRelations()`. If NOT merged, use `NodePgDatabase<typeof schema>` and update to `DrizzleClient` later.
- **SPEC-059** (Service Context Threading): If merged, `getByField()` already has `ctx?: ServiceContext` parameter -- thread it through to `findOneWithRelations()`. If NOT merged, add only the `tx` positional parameter.
- **SPEC-060** (Model TX Propagation): If merged, follow the same `tx?: DrizzleClient` + `this.getClient(tx)` pattern established in all model methods.

### Pre-Conditions (MUST verify before starting)

- [ ] SPEC-062 Phase 0 is **merged to `main`** (access schemas include relation fields)
- [ ] `pnpm typecheck` passes on clean `main`

**If SPEC-062 Phase 0 is NOT merged: STOP. Do not start SPEC-066. Report to the user that Phase 0 must land first.**

### Position in the Dependency Graph

```
SPEC-062 Phase 0 ── MUST complete first (schemas include relation fields)
    │
    └──► SPEC-066 (THIS SPEC) ── adds findOneWithRelations + getByField change
              │
              └──► SPEC-062 Phase 1 ── BLOCKED until this spec is merged
```

### Ideal Sequence (if all specs are pending)

```
SPEC-058 → SPEC-060 → SPEC-059 → SPEC-062 Phase 0 → SPEC-066 (THIS) → SPEC-062 Phase 1
```

If SPEC-058/059/060 are NOT yet merged, SPEC-066 CAN still proceed after SPEC-062 Phase 0, but the code will need minor updates when those specs land later (type changes from `NodePgDatabase` to `DrizzleClient`, adding `ctx` parameter).

### What Happens If Order Is Wrong

| Wrong Order | Consequence |
|------------|-------------|
| SPEC-066 before SPEC-062 Phase 0 | Relations are loaded in getById responses, but access schemas don't declare them. When SPEC-062 Phase 1 enables runtime stripping, ALL relation data is silently removed. getById returns flat objects again. The entire spec's work is negated. |
| SPEC-062 Phase 1 before SPEC-066 | Phase 1 enforces stripping. Schemas from Phase 0 declare relation fields as `.optional()`. Since getById doesn't load relations yet, those fields are `undefined` -- no error, but no benefit either. SPEC-066 still works correctly when it lands later. This order is acceptable but suboptimal. |

### Parallel Safety

| Spec | Conflict Risk | Details |
|------|--------------|---------|
| SPEC-051 | None | Different layers (model/service vs permissions). |
| SPEC-052 | None | Different scope (admin search types vs getById). |
| SPEC-054 | None | Different layers (admin UI vs service/model). |
| SPEC-055 | None | Different scope (LIKE escaping vs relation loading). |
| SPEC-058 | Low | If SPEC-058 lands after SPEC-066, update `findOneWithRelations` tx type from `NodePgDatabase<typeof schema>` to `DrizzleClient`. One-line change. |
| SPEC-059 | Low | If SPEC-059 lands after SPEC-066, add `ctx?: ServiceContext` parameter to `getByField()` and thread to model call. |
| SPEC-060 | None | SPEC-060 adds `tx` to existing model methods. SPEC-066 adds a NEW method (`findOneWithRelations`). No overlap. |
| SPEC-062 | **Sequenced** | Phase 0 BEFORE this spec. Phase 1 AFTER this spec. |
| SPEC-063 | None | Different scope. SPEC-063 adds lifecycle state columns, no relation loading changes. |
| SPEC-064 | None | Different scope (billing vs entity getById). |

### Agent Instructions

1. **FIRST**: Verify SPEC-062 Phase 0 is merged (check that access schemas include relation fields like `destination: DestinationPublicSchema.optional()`)
2. **CHECK**: Has SPEC-058 merged? If yes, use `DrizzleClient` for tx type. If no, use `NodePgDatabase<typeof schema>`.
3. **CHECK**: Has SPEC-059 merged? If yes, thread `ctx` through `getByField()`. If no, use positional `tx` only.
4. Implement `findOneWithRelations()` on `BaseModelImpl` (or `BaseModel` if SPEC-058 hasn't landed)
5. Add `getDefaultGetByIdRelations()` hook to `BaseCrudPermissions`
6. Modify `getByField()` in `BaseCrudRead` to use relations
7. Run `pnpm typecheck && pnpm test`
8. Merge to `main` -- this unblocks SPEC-062 Phase 1

---

## Key Files

| File | Role in This Spec |
|------|-------------------|
| `packages/db/src/base/base.model.ts` (676 lines) | **Primary modification.** Add `findOneWithRelations()` method (new, ~60-80 lines). The existing `findWithRelations()` STUB (lines 457-493) and its 16 model subclass overrides are left unchanged.. Reuse `transformRelationsForDrizzle()` (lines 24-49) and the `QueryableTable` interface pattern from `findAllWithRelations()` (lines 600-608). |
| `packages/service-core/src/base/base.crud.permissions.ts` (200 lines) | **Add hook declaration.** Add `getDefaultGetByIdRelations()` protected method (non-abstract, with default implementation) near line 48, adjacent to the existing `getDefaultListRelations()` abstract declaration. |
| `packages/service-core/src/base/base.crud.read.ts` (496 lines) | **Modify `getByField()`.** Update lines 83-85 to check `this.getDefaultGetByIdRelations()` and conditionally call `this.model.findOneWithRelations()` instead of `this.model.findOne()`. |
| `packages/service-core/src/types/index.ts` | **Update `BaseModel` interface.** Add `findOneWithRelations()` to the `BaseModel` type interface so the service layer can call it. |
| `packages/service-core/src/services/post/post.service.ts` | Example of a service with complex nested relations (`sponsorship: { sponsor: true }`). Automatically benefits from SPEC-066 without any code changes. |
| `packages/service-core/src/services/accommodation/accommodation.service.ts` | Example of a service with simple relations (`destination: true, owner: true`). Automatically benefits from SPEC-066 without any code changes. |
| `packages/service-core/test/base/crud/getById.test.ts` | **Existing test file.** Add tests verifying that `getByField()` calls `findOneWithRelations()` when relations are defined and `findOne()` when undefined. Uses `createBaseModelMock()` and `createServiceTestInstance()` from test utils. |
| `packages/db/test/base/findOneWithRelations.test.ts` | **New test file.** Unit tests for `findOneWithRelations()` method covering: found with relations, not found (null), nested relations, transaction support, empty relations fallback, error handling. |
| `packages/service-core/test/utils/modelMockFactory.ts` | **Existing mock factory.** Add `findOneWithRelations: Mock` to the `ModelMock` interface (line 26) and `findOneWithRelations: vi.fn()` to `createBaseModelMock()` (line 57). |

---

## Implementation Notes

### Drizzle Relational Query API: findFirst() vs findMany()

Drizzle ORM provides a relational query API via `db.query[tableName]` that supports both `findMany()` and `findFirst()`. Both accept the same parameters **except that `findFirst()` excludes the `limit` parameter** (it applies `LIMIT 1` implicitly). The TypeScript signature confirms this: `findFirst` accepts `Omit<DBQueryConfig<'many', ...>, 'limit'>`.

```typescript
// findMany (used by existing findAllWithRelations)
db.query.accommodations.findMany({
  where: whereClause,
  with: { destination: true, owner: true },
  limit: 20,
  offset: 0
});

// findFirst (to be used by new findOneWithRelations)
// Note: `limit` is NOT accepted here (implicit LIMIT 1)
db.query.accommodations.findFirst({
  where: whereClause,
  with: { destination: true, owner: true }
});
```

`findFirst()` returns `T | undefined` (a single record or undefined), while `findMany()` returns `T[]`. `findFirst()` implicitly applies `LIMIT 1` (runtime: `query.js` line 40 forces `{ limit: 1 }`). Both support `with`, `where`, `columns`, `extras`, `orderBy`, and `offset` parameters. The `with` parameter for relation loading produces equivalent SQL using **LEFT JOIN LATERAL** subqueries for ALL relation types (both `One` and `Many`).. the only difference is that `One` relations apply `LIMIT 1` inside the lateral subquery (`dialect.js` line 1024). There are NO separate queries for different relation types. Verified against Drizzle ORM v0.44.7 source code (the project's installed version).

### findOneWithRelations() Implementation Approach

The new method should mirror the structure of `findAllWithRelations()` (lines 527-675 of `base.model.ts`) with the following differences:

1. **No pagination/sorting.** Remove `page`, `pageSize`, `offset`, `sortBy`, `sortOrder`, and `orderBy` parameters and logic.
2. **No count query.** Remove the parallel `this.count()` call and the `Promise.all()` pattern. `findFirst()` returns a single record, not a paginated result.
3. **findFirst instead of findMany.** Use `typedQueryTable.findFirst(queryOptions)` instead of `typedQueryTable.findMany(queryOptions)`.
4. **Return type.** Return `T | null` instead of `{ items: T[], total: number }`. Drizzle's `findFirst()` returns `T | undefined` for "not found".. convert to `null` to match Hospeda's convention (used by `findOne()` and the rest of the BaseModel API).
5. **Same relation handling.** Use the same `transformRelationsForDrizzle()` helper to convert the relations config. Use the same `getTableName()`, `db.query` cast, and `QueryableTable`-style interface verification.
6. **Same error handling.** Use `logQuery()`, `logError()`, and `DbError` with method name `'findOneWithRelations'`.

### Design Decision: New Method vs Replacing Existing

This spec adds `findOneWithRelations()` as a **new, independent method** on `BaseModel` rather than fixing or replacing the existing `findWithRelations()` stub. The reasons:

1. **16 model subclasses override `findWithRelations()`** with per-model implementations that load hardcoded relation sets. Replacing the stub or renaming the method would break all 16 overrides.
2. **`AccommodationService.getFaqs()`** calls `this.model.findWithRelations()` at runtime to load an accommodation with its FAQs relation. Removing or renaming the method would break this production code path.
3. **Different semantics.** `findWithRelations()` overrides load model-specific hardcoded relations (e.g., DestinationModel always loads accommodations, reviews, tags). `findOneWithRelations()` loads service-configured relations (whatever `getDefaultGetByIdRelations()` returns). These are distinct use cases.
4. **`findWithRelations()` is NOT in the `BaseModel<T>` interface** (`packages/service-core/src/types/index.ts`). The service layer accesses it only through concrete model types (e.g., `AccommodationModel` in `getFaqs()`), not through the generic interface. Adding `findOneWithRelations()` to the interface is clean and doesn't conflict.

**Future consolidation:** Once `findOneWithRelations()` proves reliable in production, a follow-on spec can evaluate whether the 16 per-model `findWithRelations()` overrides can be replaced by passing the appropriate relations config through `findOneWithRelations()`, eventually deprecating the per-model approach.

### Implementation References (Imports and Helpers)

The `findOneWithRelations()` implementation uses the following existing utilities, all already imported in `base.model.ts`:

| Utility | Import Location | Current Import Line |
|---------|-----------------|-------------------|
| `buildWhereClause(where, table)` | `'../utils/drizzle-helpers.ts'` | Line 6 of `base.model.ts` |
| `transformRelationsForDrizzle(relations)` | Defined at lines 24-49 of `base.model.ts` (module-level function, no import needed) |  |
| `logQuery(entity, action, params, result)` | `'../utils/logger.ts'` | Line 8 of `base.model.ts` |
| `logError(entity, action, params, error)` | `'../utils/logger.ts'` | Line 8 of `base.model.ts` |
| `DbError(entity, method, params, message)` | `'../utils/error.ts'` | Line 7 of `base.model.ts` |
| `this.getClient(tx)` | Protected method on `BaseModel` at line 79 | Returns `tx ?? getDb()` |
| `this.getTableName()` | Abstract method on `BaseModel` at line 72 | Returns table name string for `db.query[name]` |

No new imports are needed. All dependencies are already available in scope.

### Pseudocode for findOneWithRelations()

```typescript
async findOneWithRelations(
  where: Record<string, unknown>,
  relations: Record<string, boolean | Record<string, unknown>>,
  tx?: NodePgDatabase<typeof schema>
): Promise<T | null> {
  const db = this.getClient(tx);
  const safeWhere = where ?? {};

  try {
    // Validate relations (same check as findAllWithRelations)
    if (!relations || typeof relations !== 'object') {
      throw new Error('Relations must be a valid object');
    }

    const hasRelations = Object.values(relations).some((value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(Boolean);
      }
      return false;
    });

    // If no relations requested, fall back to findOne
    if (!hasRelations) {
      return this.findOne(safeWhere, tx);
    }

    const tableName = this.getTableName();
    if (!tableName) {
      throw new Error(`Table name not defined for entity: ${this.entityName}`);
    }

    const whereClause = buildWhereClause(safeWhere, this.table);
    const queryTable = (db.query as Record<string, unknown>)[tableName];

    if (!queryTable || typeof queryTable !== 'object' || !('findFirst' in queryTable)) {
      throw new Error(`Invalid table configuration for: ${tableName}`);
    }

    interface QueryableTable {
      findFirst: (options: {
        where?: unknown;
        with?: Record<string, boolean | Record<string, unknown>>;
      }) => Promise<unknown | undefined>;
    }

    const typedQueryTable = queryTable as QueryableTable;
    const transformedRelations = transformRelationsForDrizzle(relations);

    const result = await typedQueryTable.findFirst({
      where: whereClause,
      with: transformedRelations
    });

    logQuery(this.entityName, 'findOneWithRelations', { where: safeWhere, relations }, result);
    return (result as T) ?? null;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError(this.entityName, 'findOneWithRelations', { where: safeWhere, relations }, err);
    throw new DbError(this.entityName, 'findOneWithRelations', { where: safeWhere, relations }, err.message);
  }
}
```

### Pseudocode for getByField() Modification

```typescript
// In base.crud.read.ts, getByField() method, lines 83-85
// BEFORE:
const where = { [processed.field]: processed.value };
const entity = await this.model.findOne(where as any);

// AFTER:
const where = { [processed.field]: processed.value };
const relations = this.getDefaultGetByIdRelations();
const entity = relations
  ? await this.model.findOneWithRelations(where as any, relations)
  : await this.model.findOne(where as any);
```

### Pseudocode for getDefaultGetByIdRelations()

```typescript
// In base.crud.permissions.ts, adjacent to getDefaultListRelations()

/**
 * Default relations configuration for single-entity fetch operations
 * (getById, getBySlug, getByName).
 *
 * Defaults to the same relations as list operations for consistency.
 * Concrete services can override to specify different relations for
 * single-entity fetches (e.g., more detail for a detail view, or
 * undefined to disable relation loading for performance).
 *
 * @returns Relations configuration object or undefined for no relations
 */
protected getDefaultGetByIdRelations(): import('@repo/schemas').ListRelationsConfig {
  return this.getDefaultListRelations();
}
```

### BaseModel Interface Update

The `BaseModel` type interface in `packages/service-core/src/types/index.ts` must be updated to include the `findOneWithRelations()` method signature:

```typescript
export interface BaseModel<T> {
  // ... existing methods ...
  findOne(where: Record<string, unknown>, tx?: unknown): Promise<T | null>;
  findOneWithRelations(
    where: Record<string, unknown>,
    relations: Record<string, boolean | Record<string, unknown>>,
    tx?: unknown
  ): Promise<T | null>;
  findAllWithRelations(
    relations: Record<string, boolean | Record<string, unknown>>,
    where?: Record<string, unknown>,
    options?: unknown,
    additionalConditions?: unknown[],
    tx?: unknown
  ): Promise<{ items: T[]; total: number }>;
  // ... existing methods ...
}
```

**Note:** `findWithRelations()` is intentionally NOT added to the `BaseModel<T>` interface. It remains accessible only through concrete model types for backward compatibility with existing callers like `AccommodationService.getFaqs()`. The two methods serve different use cases: `findOneWithRelations()` is the generic, interface-level method for service-configured relations; `findWithRelations()` is the model-specific method with per-model overrides.

### Interaction with SPEC-062

SPEC-062 Phase 0 adds `.optional()` relation fields to access schemas. This handles both states correctly:
- **Pre-SPEC-066 (current):** getById returns no relations. `.optional()` fields are simply absent from the parsed output. No parse failure.
- **Post-SPEC-066:** getById returns populated relations. `.optional()` fields are present and stripped to the correct tier's schema.

**Critical ordering with SPEC-062**: SPEC-062 Phase 0 (schema extensions for relations) MUST be completed before or alongside SPEC-066. Without relation fields in access schemas, SPEC-062 Phase 1's runtime enforcement will strip the newly-loaded relation data from responses, negating SPEC-066's purpose. See the Dependencies section above for the recommended full implementation sequence.

---

## Revision Log

| Rev | Date | Author | Changes |
|-----|------|--------|---------|
| 1 | 2026-04-03 | SPEC-062 review | Initial draft. Documents the getById vs list relation loading inconsistency, proposes `findOneWithRelations()` on BaseModel and `getDefaultGetByIdRelations()` hook on BaseCrudService. |
| 2 | 2026-04-03 | Review pass 1 | Verified all 13 code claims against source. Corrected 3 discrepancies: (1) `getDefaultListRelations()` line 48→49 in base.crud.permissions.ts. (2) base.crud.read.ts line count 497→496. (3) base.crud.permissions.ts line count 139→200. |
| 3 | 2026-04-03 | Exhaustive review | **8 corrections/improvements.** (1) Added SponsorshipPackageService as 10th affected entity (`{ eventLevel: true }`), was incorrectly in unaffected list. Updated all counts from 9→10 affected, 12→11 unaffected. (2) Clarified Drizzle `findFirst()` excludes `limit` parameter (implicit LIMIT 1), pinned to installed v0.44.7. (3) Added explicit note that `getById`/`getBySlug`/`getByName` all delegate to `getByField()` (single change point). (4) Distinguished `BaseCrudRelatedService` subclass (4 services) from `BaseCrudService` direct extenders in unaffected list. (5) Documented non-CRUD services (PermissionService, ExchangeRateConfigService) as out of scope. (6) Added SPEC-059 coordination dependency (adds `ctx?: ServiceContext` to `getByField()`, implementation order flexible). (7) Upgraded SPEC-058 dependency notes with concrete details on `DrizzleClient` type and interface relocation. (8) Clarified admin endpoints benefit automatically. Cross-checked against all specs SPEC-050 through SPEC-065: zero contradictions found. |
| 4 | 2026-04-03 | Exhaustive review (pass 2) | **5 critical corrections, 3 improvements.** (1) CRITICAL: Corrected false claim that "no subclass overrides findWithRelations()".. verified 16 model subclasses override it (AccommodationModel, DestinationModel, EventModel, SponsorshipModel, SponsorshipLevelModel, SponsorshipPackageModel, OwnerPromotionModel, PostSponsorshipModel, AmenityModel, EventOrganizerModel, and 6 relation-table models). (2) CRITICAL: Corrected false claim that "no code path calls findWithRelations()".. AccommodationService.getFaqs() calls it at line 986. (3) CRITICAL: Changed strategy from "replace findWithRelations stub" to "add findOneWithRelations as new independent method alongside existing findWithRelations". (4) Rewrote R-003 from "Very low likelihood" to confirmed finding with resolution. (5) Added "Design Decision: New Method vs Replacing Existing" section documenting rationale. (6) Added note that findWithRelations is intentionally NOT added to BaseModel interface. (7) Added SPEC-060 coordination dependency. (8) Updated all file descriptions to reflect "no replacement" strategy. Cross-spec analysis against SPEC-050 through SPEC-065 reconfirmed: zero contradictions. |
| 5 | 2026-04-04 | Exhaustive review (pass 3) | **1 factual correction, 1 dependency addition.** Verified ALL code claims against source (100% accuracy). Verified Drizzle ORM v0.44.7 source code for API correctness. Reviewed all specs SPEC-050 through SPEC-065 for overlaps/contradictions. (1) CORRECTION: Fixed incorrect claim about Drizzle SQL generation strategy in R-002 and Implementation Notes. The spec incorrectly stated "JOINs for one-to-one relations and separate queries for one-to-many".. Drizzle v0.44.7 actually uses LEFT JOIN LATERAL subqueries for ALL relation types in a single SQL query (verified in `dialect.js` lines 1024-1036). Updated both R-002 and the "Drizzle Relational Query API" section with precise source code references. (2) Added SPEC-053 (completed) as Context dependency since it established the `tx` parameter pattern that `findOneWithRelations()` follows. Cross-spec analysis: 0 contradictions, 0 overlapping scope conflicts. Existing SPEC-058/059/060/062 coordination dependencies confirmed accurate. |
| 6 | 2026-04-04 | Exhaustive review (pass 4) | **0 corrections, 5 implementability improvements.** Triple-verified ALL code claims against source code, Drizzle ORM v0.44.7 docs/types, and all specs SPEC-050 through SPEC-065. All 100% accurate. No contradictions or overlaps found. Improvements: (1) Documented that PostService and AccommodationService also call `getByField()` directly (both benefit automatically). (2) Added "Implementation References" table listing all existing imports/helpers needed by `findOneWithRelations()` with exact file paths and line numbers, so implementer needs zero exploration. (3) Specified exact test file paths: new `packages/db/test/base/findOneWithRelations.test.ts`, existing `getById.test.ts` for service tests. (4) Added `modelMockFactory.ts` update requirement with exact line numbers for `ModelMock` interface and `createBaseModelMock()` factory. (5) Expanded test scope descriptions with specific test case names. |
