# SPEC-062: Runtime Response Schema Enforcement

> **Status**: draft
> **Priority**: P1 (Critical)
> **Complexity**: High
> **Origin**: GAP-057-004, GAP-057-009, GAP-057-015, GAP-057-029
> **Depends on**: SPEC-057 (completed)
> **Related**: SPEC-063 (lifecycle state standardization adds `lifecycleState` to 4 entities that this spec must correctly strip), ~~SPEC-050~~ (deleted, superseded by SPEC-063 Lifecycle State Standardization.. overlapped on OwnerPromotion, DestinationReview status fields)
> **Created**: 2026-03-31
> **Zod version**: ^4.0.8 declared in package.json; installed version 4.3.6 (project uses Zod v4; strip is default behavior, ~6.5x faster than v3 for objects)

---

## Overview

The Hospeda API exposes ~55-65 routes across three tiers (public, protected, admin). Every route declares a `responseSchema` parameter in the route factory, but that parameter is used exclusively for OpenAPI documentation generation. No runtime enforcement exists. As a result, every layer of the pipeline (database, service, handler, response helper) passes data through without field filtering. Admin-only fields such as `createdById`, `updatedById`, `deletedById`, `adminInfo`, `notes`, and `paymentId` leak to public and protected API responses.

This specification adds runtime schema enforcement at the response layer using Zod v4's default strip behavior (`z.object()` strips unrecognized keys automatically, no `.strip()` call needed), ensuring that only fields declared in the route's `responseSchema` are ever serialized to HTTP responses. The change is non-breaking: routes that do not supply a `responseSchema` continue behaving as they do today.

---

## Goals

- Guarantee that HTTP responses for every tier contain only the fields declared in that tier's `responseSchema`.
- Eliminate the exposure of admin-only, audit, and internal fields to public and protected consumers.
- Provide test coverage that verifies field presence and absence per access tier for all 23 schema sets.
- Establish a detection mechanism that catches future field leaks before they reach production.

### Success Metrics

- Zero admin-only fields (`createdById`, `updatedById`, `deletedById`, `adminInfo`, `deletedAt`, `notes`, `paymentId`, `lifecycleState`) present in public or protected tier responses after this spec is implemented.
- All 23 schema set boundary tests passing (see Entity Inventory below for the complete list).
- Integration tests covering happy path and field-exclusion path for every access tier.
- No measurable regression in API response time (Zod v4 `.safeParse()` on a 15-20 field schema is estimated at approximately 0.1-0.3ms based on Moltar benchmark extrapolation: v4 measured at 124us for standard object parsing, ~6.5x faster than v3's 805us; actual times depend on schema complexity and hardware. This is negligible against typical DB latency of 50-200ms).

---

## Problem Statement

### The 5-Layer Leak (Verified Code-Path Trace)

The following layers have been individually verified against current source code. None performs field filtering.

**Layer 1. Database (BaseModel).**
`db.select().from(this.table).where(finalWhereClause).$dynamic()` issues an implicit `SELECT *`. Every column stored in the database is returned to the application.

**Layer 2. Service (BaseCrudService).**
Services call `this.model.findAll(filterParams, { page, pageSize })` and return the result without any field projection.

**Layer 3. Handler (route files).**
Admin list handlers return `{ items: result.data?.items || [], pagination: ... }`, passing raw items without schema stripping.

**Layer 4. Response Helpers (`response-helpers.ts`).**
`createResponse()` wraps data as-is: `{ success: true, data, metadata: { ... } }`. `createPaginatedResponse()` does the same for `{ items, pagination }`. Neither function accepts a schema parameter.

**Layer 5. Response Validator Middleware (`response-validator.ts`).**
The middleware validates envelope shape only (`{ success, data, metadata }`) using `z.unknown()` for the `data` field. It does NOT validate field content. Additionally it is disabled in production: `enabled: env.NODE_ENV === 'development' || env.NODE_ENV === 'test'`.

### Quantified Exposure

| Tier | Total Routes | Routes Enforcing Schema | Routes Leaking Data |
|------|-------------|------------------------|---------------------|
| Public | ~15-18 | 1 (Tag getBySlug, manual) | ~14-17 (93%) |
| Protected | ~8-12 | 0 | ~8-12 (100%) |
| Admin | ~32-35 | 0 | ~32-35 (100%) |
| **Total** | **~55-65** | **1 (~1.5%)** | **~54-64 (~98.5%)** |

### Entity Inventory (23 schema sets across 21 access.schema.ts files)

The following entities in `packages/schemas/src/entities/` have `access.schema.ts` files defining Public, Protected, and Admin schemas. All 23 schema sets must be covered by boundary tests and runtime enforcement. Note that ExchangeRate and Revalidation each export TWO sets of access schemas (for their sub-entities).

| # | Entity | AdminSchema Pattern | Notes |
|---|--------|-------------------|-------|
| 1 | Accommodation | Direct reference (`= AccommodationSchema`) | |
| 2 | AccommodationReview | Direct reference | |
| 3 | Amenity | Direct reference | |
| 4 | Attraction | Direct reference | |
| 5 | Destination | Direct reference | |
| 6 | DestinationReview | Direct reference | |
| 7 | Event | Direct reference | |
| 8 | EventLocation | Direct reference | |
| 9 | EventOrganizer | Direct reference | |
| 10 | ExchangeRate | Direct reference | Same `access.schema.ts` as #11 |
| 11 | ExchangeRateConfig | Direct reference | Same `access.schema.ts` as #10 |
| 12 | Feature | Direct reference | |
| 13 | OwnerPromotion | Direct reference | |
| 14 | Permission | Built with `z.object()` | NOT a direct reference. `===` optimization does NOT apply |
| 15 | Post | Direct reference | |
| 16 | PostSponsor | Direct reference | |
| 17 | PostSponsorship | Direct reference | |
| 18 | RevalidationLog | Direct reference | Same `access.schema.ts` as #19 |
| 19 | RevalidationConfig | Direct reference | Same `access.schema.ts` as #18 |
| 20 | Sponsorship | Direct reference | |
| 21 | Tag | Direct reference | |
| 22 | User | Built via `.extend()` chain | `===` optimization does NOT apply |
| 23 | UserBookmark | Direct reference | |

**Important exceptions (2 of 23)**:
- **User**: `UserAdminSchema` is built as `UserProtectedSchema.extend({...})`, NOT as a direct reference to `UserSchema`. The `===` reference-equality optimization will correctly NOT skip parsing for User entities.
- **Permission**: `PermissionAdminSchema` is built with `z.object({ permission, role, userId })`, NOT as a direct reference. The `===` optimization will correctly NOT skip parsing for Permission entities.

Both exceptions are fail-safe: the optimization only skips when identity is guaranteed, so non-matching references simply proceed to full parsing.

### Sensitive Fields at Risk

| Field | Entities Affected | Sensitivity | Leak Scenario |
|-------|-------------------|-------------|---------------|
| `createdById` | 18 of 23 (all except ExchangeRate, ExchangeRateConfig, Permission, RevalidationLog, RevalidationConfig) | High (PII linkage) | Admin user UUIDs visible to anonymous users |
| `updatedById` | 18 of 23 (same set) | High (PII linkage) | Admin user UUIDs visible to anonymous users |
| `deletedById` | 18 of 23 (same set) | Critical | Soft-delete audit trail exposed |
| `deletedAt` | 18 of 23 (same set) | Medium | Soft-delete timestamps exposed |
| `adminInfo` | 15 of 23 (entities with BaseAdminFields: Accommodation, AccommodationReview, Amenity, Attraction, Destination, DestinationReview, Event, EventLocation, EventOrganizer, Feature, Post, PostSponsor, PostSponsorship, User, UserBookmark) | High | Internal admin notes visible publicly |
| `notes` | Tag (explicit standalone field) | High | Internal notes visible publicly |
| `lifecycleState` | ~14-15 of 23 (entities with BaseLifecycleFields; excludes AccommodationReview, DestinationReview, ExchangeRate, ExchangeRateConfig, OwnerPromotion, Permission, RevalidationLog, RevalidationConfig) | Medium | Internal state machine exposed |
| `paymentId` | Sponsorship (1 of 23) | High | Payment system identifiers exposed |

---

## User Stories

### US-001: Response Field Containment for Public Consumers

As an anonymous visitor consuming a public API endpoint,
I want the response to contain only the fields intended for public access,
so that my client never receives internal identifiers, admin annotations, or audit metadata that could be used for reconnaissance or privacy attacks.

#### Acceptance Criteria

**Scenario 1. Public endpoint strips admin-only fields.**

Given an anonymous HTTP request to a public list endpoint (e.g., `GET /api/v1/public/accommodations`),
When the response is returned with HTTP 200,
Then the response body items contain only the fields declared in the entity's `PublicSchema`,
And the fields `createdById`, `updatedById`, `deletedById`, `deletedAt`, `adminInfo`, and `notes` are absent from every item in the response.

**Scenario 2. Public endpoint strips protected-tier fields.**

Given an anonymous HTTP request to a public list endpoint,
When the entity has both a `ProtectedSchema` and a `PublicSchema`,
Then fields declared in `ProtectedSchema` but not in `PublicSchema` are also absent from the response,
And no authentication token is required to verify this behavior.

**Scenario 3. Public endpoint with no items returns empty array.**

Given a valid public list request that matches zero records,
When the response is returned with HTTP 200,
Then `data.items` is an empty array,
And `data.pagination.total` is zero,
And no field stripping error is raised.

**Scenario 4. Public single-resource endpoint strips sensitive fields.**

Given an anonymous HTTP request to a public getById or getBySlug endpoint,
When the record exists and is returned with HTTP 200,
Then the response item contains only fields in the entity's `PublicSchema`,
And `createdById`, `updatedById`, `deletedById`, `adminInfo` are absent.

---

### US-002: Response Field Containment for Authenticated Users

As an authenticated user (non-admin) consuming a protected API endpoint,
I want the response to include the fields relevant to my session (ownership, basic lifecycle) but nothing that is admin-exclusive,
so that I can build my client without exposing internal platform data.

#### Acceptance Criteria

**Scenario 1. Protected endpoint includes ownership fields but excludes admin fields.**

Given an authenticated non-admin user making a request to a protected endpoint (e.g., `GET /api/v1/protected/owner-promotions`),
When the response is returned with HTTP 200,
Then each response item contains the fields declared in the entity's `ProtectedSchema`,
And each item does NOT contain `adminInfo`, `deletedById`, or other admin-only fields.

**Scenario 2. Protected endpoint includes more fields than public.**

Given the same resource accessible from both public and protected tiers,
When an authenticated user retrieves it via the protected endpoint,
Then the protected response contains a superset of the public fields,
And both responses omit admin-only fields.

**Scenario 3. Invalid session does not bypass field stripping.**

Given a request to a protected endpoint with an expired or invalid authentication token,
When the middleware rejects the request with HTTP 401,
Then no response body containing entity data is returned,
And field stripping is not applicable because no data is produced.

---

### US-003: Full Field Access for Administrators

As an admin user consuming an admin API endpoint,
I want the response to contain all fields including internal audit fields, admin annotations, and soft-delete metadata,
so that I can perform moderation, auditing, and debugging tasks with complete information.

#### Acceptance Criteria

**Scenario 1. Admin endpoint returns all declared fields.**

Given an authenticated admin user with the required permission making a request to an admin list endpoint (e.g., `GET /api/v1/admin/accommodations`),
When the response is returned with HTTP 200,
Then each response item contains the fields declared in the entity's `AdminSchema` (which equals the full base schema),
And fields such as `createdById`, `updatedById`, `deletedById`, `deletedAt`, and `adminInfo` ARE present when populated.

**Scenario 2. Admin endpoint does not strip fields that public tier would strip.**

Given an admin request for the same entity as a public endpoint,
When the admin response is returned,
Then it contains MORE fields than the equivalent public response,
And those additional fields are the admin-exclusive ones listed in the entity's base schema.

**Scenario 3. Admin endpoint with null nullable fields.**

Given an admin request for an entity where `deletedById` is null (entity is not soft-deleted),
When the response is returned,
Then `deletedById` is present as `null` in the response (field declared in schema, value is null),
And the field is not silently omitted.

---

### US-004: Schema-Driven Field Stripping at the Response Layer

As a platform engineer maintaining the API,
I want the route factory to pass the declared `responseSchema` to the response helpers,
so that field stripping is enforced automatically at the HTTP serialization boundary without requiring any change to route handlers or service layers.

#### Acceptance Criteria

**Scenario 1. Route with responseSchema strips undeclared fields.**

Given a route definition that declares a `responseSchema` (e.g., `AccommodationPublicSchema`),
When the route handler returns an entity object with 30 fields,
And the schema declares only 12 fields,
Then the serialized HTTP response body contains only those 12 fields,
And no error is thrown for the undeclared 18 fields (Zod strips, not rejects).

**Scenario 2. Route without responseSchema passes data as-is (backward compatible).**

Given a route definition that does NOT declare a `responseSchema`,
When the route handler returns data,
Then the response helper serializes the data without modification,
And the behavior is identical to the current (pre-SPEC-062) behavior.

**Scenario 3. Schema parse failure falls back to unstripped data with a warning log.**

Given a route with a `responseSchema` and a route handler that returns data that fails schema parse,
When `.safeParse()` returns `success: false`,
Then the response helper logs a warning with the parse error details,
And falls back to returning the unstripped data (to preserve availability),
And the failure is recorded in the structured log for monitoring.

**Scenario 4. Schema references are static module-level constants.**

Given the API server has completed startup initialization,
When a request is received for any route that declares a `responseSchema`,
Then the schema used for `.safeParse()` is a static module-level constant (Zod v4 schemas are runtime class instances, not compiled artifacts),
And no schema object is instantiated or cloned per-request.

**Implementation note**: Zod does NOT have a compilation step like AJV. Schemas defined with `z.object({...})` are already static objects ready to use. No "schema registry" or "cache" is needed. The route factory receives the schema reference at module load time and passes it to response helpers. The optimization is simply: do not re-create schemas per request.

---

### US-005: Access Schema Boundary Test Coverage

As a platform engineer writing tests,
I want access schema boundary tests for all 23 schema sets,
so that any future regression (accidental addition of a sensitive field to a public schema) is caught by CI before reaching production.

#### Acceptance Criteria

**Scenario 1. PublicSchema boundary test passes with only public fields.**

Given the `PublicSchema` for an entity (e.g., `AccommodationPublicSchema`),
When a full entity object (all fields populated) is parsed with `.safeParse()`,
Then the result contains only the fields declared in `PublicSchema`,
And `createdById`, `updatedById`, `deletedById`, `adminInfo` are absent from the parse result.

**Scenario 2. ProtectedSchema boundary test passes with public and protected fields.**

Given the `ProtectedSchema` for an entity,
When a full entity object is parsed with `.safeParse()`,
Then the result contains all fields in `PublicSchema` plus the additional protected fields,
And admin-only fields are absent.

**Scenario 3. AdminSchema boundary test passes with all fields.**

Given the `AdminSchema` for an entity (alias of base schema),
When a full entity object is parsed with `.safeParse()`,
Then the result contains all fields from the base schema,
And no fields are stripped.

**Scenario 4. Boundary tests exist for all 23 schema sets.**

Given the test suite in `packages/schemas/test/entities/access-boundary/`,
When boundary tests are run,
Then tests covering all three tiers exist for each of the 23 schema sets listed in the Entity Inventory section.

**Note**: Boundary tests already exist in `packages/schemas/test/entities/access-boundary/access-boundary.test.ts` (657 lines, covering all 23 schema sets with table-driven tests across all 3 tiers, including ExchangeRateConfig and RevalidationConfig as separate entries). The work for US-005 is to:
1. Verify the existing tests cover ALL 23 schema sets (add any missing).
2. Ensure each test explicitly asserts the ABSENCE of sensitive fields (not just schema shape).
3. Add explicit assertions for fields listed in "Sensitive Fields at Risk" table (e.g., `expect(parsed.createdById).toBeUndefined()`).

---

### US-006: Integration Tests Verifying Field Presence and Absence Per Tier

As a platform engineer maintaining API integration tests,
I want HTTP-level integration tests that assert field presence and absence for each access tier,
so that the enforcement at the response layer is verified end-to-end, not just at the schema unit level.

#### Acceptance Criteria

**Scenario 1. Integration test verifies public response excludes admin fields.**

Given a running API server with seeded test data,
When an integration test sends `GET /api/v1/public/<entity>` without authentication,
Then the test asserts that `items[0].createdById` is undefined,
And `items[0].adminInfo` is undefined,
And `items[0].deletedById` is undefined.

**Scenario 2. Integration test verifies admin response includes admin fields.**

Given a running API server with seeded test data and a valid admin session,
When an integration test sends `GET /api/v1/admin/<entity>` with admin credentials,
Then the test asserts that `items[0].createdById` is a string (UUID),
And `items[0].deletedById` is null or a UUID (present in response regardless of value).

**Scenario 3. Integration tests cover at least one endpoint per access tier per entity.**

Given the integration test suite,
When all integration tests for SPEC-062 are run,
Then at least one public, one protected (where applicable), and one admin endpoint per entity is verified for field boundary compliance.

---

## UX Considerations

### API Consumer Experience

**Behavior change for existing clients.**
Public and protected API consumers who are currently receiving and ignoring extra fields will no longer receive those fields. Clients that do NOT reference the extra fields are unaffected. Clients that reference `createdById` or similar fields from a public endpoint will receive `undefined` after this change. This is the correct and intended behavior. No client should depend on admin-only fields from public responses.

**Admin consumer experience.**
Admin app consumers receive no change. `AdminSchema = BaseSchema` (direct alias for 21 of 23 schema sets), so the stripping via `safeParse()` is effectively a no-op for admin routes (admin schema includes all fields, nothing is stripped). The overhead is ~0.1-0.3ms per item, negligible against DB latency.

**Error states.**
If schema parsing unexpectedly fails (which should not happen in normal operation because Zod strips rather than rejects unknown fields), the system falls back to the current unstripped behavior and emits a structured warning log. API availability is preserved; the failure is observable through logs.

**Loading states.**
Stripping is synchronous and sub-millisecond. No loading state changes are required.

**Empty states.**
Empty paginated results are stripped as an empty array. No behavioral change.

### Developer Experience

**Gradual adoption.**
Routes that do not declare a `responseSchema` continue working unchanged. Teams can add schemas incrementally to legacy routes without a big-bang migration.

**Detection during development.**
The existing `response-validator.ts` middleware (enabled in development and test, disabled in production) already catches envelope shape violations. This spec adds actual field-level enforcement that runs in all environments via the response helpers themselves, making the development and test validator less critical for field-level concerns.

**Schema reference verification.**
Since Zod schemas are static module-level objects (no compilation step), there is no cache to verify. Engineers can verify at debug level during startup which routes declare a `responseSchema` (enforcement active) vs. those that don't (pass-through). This helps confirm enforcement coverage.

---

## Scope

### In Scope

**Phase 0: Access Schema Relation Audit & Extension (prerequisite)**

Before runtime enforcement can be enabled, access schemas that are used on routes returning relation data must be extended to include those relation fields using the corresponding tier's schema for the related entity. Without this, `safeParse()` will silently strip relation data from responses, breaking endpoints that return nested objects.

- Auditing all routes that return entities with nested relation data (see "Phase 0 Detail" in Implementation Notes).
- For each affected route, extending the corresponding access schemas to include relation fields using tier-appropriate schemas (e.g., `AccommodationPublicSchema` adds `destination: DestinationPublicSchema.optional()`, `AccommodationAdminSchema` adds `destination: DestinationAdminSchema.optional()`).
- Ensuring boundary tests still pass after schema extensions (relation fields are optional, so existing tests remain valid).

**Phase 1: Runtime Enforcement**

- Modifying `createResponse()` in `apps/api/src/utils/response-helpers.ts` to accept an optional `responseSchema` parameter and call `.safeParse()` when provided.
- Modifying `createPaginatedResponse()` in the same file to accept an optional `responseSchema` parameter and apply `.safeParse()` to each item in the `items` array when provided.
- Modifying the route factories in `apps/api/src/utils/route-factory.ts` (`createSimpleRoute`, `createCRUDRoute`, `createListRoute`, and all tiered variants via `route-factory-tiered.ts`) to pass the `responseSchema` from the route definition down to the response helpers.
- Ensuring all `responseSchema` references are static module-level constants (Zod schemas are already static objects; no compilation or registry needed). The route factory receives schema references at module load time and passes them to response helpers without per-request instantiation.
- Enhancing the existing access schema boundary tests in `packages/schemas/test/entities/access-boundary/access-boundary.test.ts` (currently 656 lines covering all 23 schema sets) to add explicit assertions for the ABSENCE of each sensitive field listed in "Sensitive Fields at Risk".
- Writing integration tests that verify field presence and absence per tier for at least one endpoint per entity in `apps/api/test/integration/field-enforcement/` directory.
- Adding a warning log in the fallback path when `.safeParse()` returns `success: false`.
- Updating the existing `response-validator.ts` middleware to note (via comment or documentation) that field-level enforcement has moved to the response helpers.

**Note on lazy-parse optimization (REMOVED)**: The original draft proposed skipping `safeParse()` when `responseSchema === baseSchema` (for admin routes where AdminSchema is a direct reference alias). This optimization has been removed from scope. The overhead of running `safeParse()` on admin routes is ~0.1-0.3ms per item, negligible against DB latency. Removing the optimization eliminates the need to thread a `baseSchema` reference through the route factory, simplifying the implementation significantly. Admin routes where AdminSchema equals BaseSchema will run `safeParse()` and produce identical output (no fields stripped), which is correct.

### Out of Scope

- Changes to the database layer (no column projection, no `SELECT` changes). Database-level optimization is a separate architectural decision.
- Changes to service layer return types. Services continue returning full entity objects.
- Changes to route handler logic. Handlers continue building and returning data as before.
- Migrating routes that currently lack a `responseSchema` to declare one. That is a follow-on consistency effort.
- Fixing any GAP-057 gaps other than GAP-057-004, GAP-057-009, GAP-057-015, and GAP-057-029.
- Changes to which `responseSchema` is declared on which routes. This spec enforces existing declarations. Phase 0 extends access schema CONTENT (adding relation fields) but does not change which schema is assigned to which route.
- Changing the behavior of the `response-validator.ts` middleware (beyond documentation updates).
- Performance benchmarking infrastructure. Performance impact is characterized in this spec based on known Zod characteristics and is not expected to require a formal benchmark suite.
- Routes using `c.json()` directly (11 routes identified in R-007). Enforcement only applies to routes using `createResponse()` and `createPaginatedResponse()`. Routes bypassing these helpers are not covered. Most are non-entity operational endpoints (metrics, health, webhooks). See R-007 for full list.
- Better Auth route responses. `/auth/handler.ts` delegates to Better Auth's own response handler (`auth.handler(c.req.raw)`), which manages its own serialization. Wrapping Better Auth responses for schema stripping requires a different architectural approach and is deferred.
- Adding relation loading to `getByField()`/`findOne()`. Currently getById routes return flat entities without nested relations (unlike list routes which use `findAllWithRelations()`). This is a pre-existing architectural inconsistency unrelated to response schema enforcement. A dedicated spec will address this (see Future Considerations).

> **Scope precision (added 2026-04-04, cross-spec conflict resolution HIGH-005, HIGH-006)**:
>
> **Route count**: "All 55-65 routes" refers to all routes that declare a `responseSchema` in the route factory. The exact count will be verified during implementation via `rg 'responseSchema' apps/api/src/routes/ --count-matches`. Routes without `responseSchema` continue unchanged. Acceptance criteria: a complete inventory of routes with `responseSchema` declarations must be provided in the PR.
>
> **Error response validation**: This spec covers ONLY successful (2xx) responses. Error responses (4xx, 5xx) and their schemas are out of scope.
>
> **Pagination metadata**: List endpoints validate both `items` and `pagination` fields per the schema. The `pagination` object itself is NOT subject to field stripping (it uses a fixed structure).
>
> **SPEC-063 coordination (HIGH-006)**: When SPEC-063 adds `lifecycleState` to OwnerPromotion, Sponsorship, AccommodationReview, and DestinationReview, the Zod schemas for these entities MUST include `lifecycleState` before SPEC-062's runtime validation is enabled. If the DB column exists but the Zod schema lacks the field, Zod v4's default strip behavior will silently remove `lifecycleState` from responses. **Hard prerequisite for SPEC-063**: SPEC-062 Phase 0 (Access Schema Relation Audit & Extension) MUST be completed before SPEC-063 begins implementation. Without Phase 0, the `lifecycleState` field added by SPEC-063 will be present in DB responses but absent from AdminSchema access schemas, causing runtime stripping when Phase 1 enforcement is later enabled. Phase 0 and Phase 1 of SPEC-062 can be separated in time, with SPEC-063 going between them. **Recommended deployment sequence**: (1) SPEC-062 Phase 0 preemptively adds `lifecycleState` to AdminSchema, (2) SPEC-063 adds DB columns and modifies schemas, (3) SPEC-062 Phases 1-4 enable and enforce validation. If SPEC-063 deploys first without SPEC-062 Phase 0, it must include `lifecycleState` in its own access schema updates (which it does per Phase 2-4 schema steps), but this is a fallback.. the preferred path is Phase 0 first.

### Future Considerations

- Extending enforcement to the `createBulkResponse()` helper (lines 387-408 in `response-helpers.ts`). Bulk responses contain `BulkResultItem` objects with a `data` field that would also need schema stripping.
- Adding column projection to `BaseModel.findAll()` as a deeper performance optimization once runtime enforcement is confirmed working (database-level filtering removes the need for Zod to strip in memory).
- Auditing all ~55-65 routes to ensure every route declares the appropriate access-tier schema (this is a consistency pass separate from runtime enforcement).
- If SPEC-063 (Lifecycle State Standardization) is implemented, verify that the newly added `lifecycleState` fields on OwnerPromotion, Sponsorship, AccommodationReview, and DestinationReview are correctly excluded from their `PublicSchema` and `ProtectedSchema` access schemas.
- Re-introducing the lazy-parse optimization (`===` identity check to skip `safeParse()` for admin routes where AdminSchema is a direct reference alias) if performance profiling shows admin response times need improvement. Currently deferred because the overhead is negligible.
- Comprehensive relation schema audit beyond the 9 entities identified in Phase 0. As new entities or relations are added, their access schemas must include relation fields to prevent silent stripping.
- **Auth route schema enforcement.** Better Auth routes (`/auth/handler.ts`, `/auth/status.ts`) bypass the route factory system entirely and return user data without schema stripping. Enforcement requires either: (a) wrapping Better Auth's response handler to post-process user objects through `UserPublicSchema`/`UserProtectedSchema`, or (b) configuring Better Auth's `user.fields` option to exclude sensitive fields at the library level. This is a separate architectural decision.
- **getById relation loading consistency.** `getByField()`/`findOne()` loads entities without relations, while `list()`/`adminList()` loads with `getDefaultListRelations()`. This creates response inconsistency: list endpoints return populated relation objects, getById returns only flat ID fields. A dedicated spec should add relation loading support to `findOne()` (e.g., `findOneWithRelations()`) and update `getByField()` to use it. Phase 0 of SPEC-062 handles this correctly via `.optional()` relation fields.. no enforcement failure occurs, but the data asymmetry is a separate UX concern.
- Migrating the 11 `c.json()` bypass routes (R-007) to use `createResponse()` for consistent enforcement coverage. Priority: auth routes first (user data sensitivity), then billing admin routes, then operational endpoints.

---

## Risks

### R-001. Fallback behavior hides leaks in edge cases

**Description.** When `.safeParse()` returns `success: false` (which should not occur for valid entity data), the fallback returns unstripped data to preserve availability. If the schema is misconfigured (e.g., required field is missing in the returned data), this path could silently defeat the enforcement goal.

**Likelihood.** Low. Zod's strip mode never fails for extra fields; it only fails for missing required fields or invalid types. If a service returns data that fails schema validation, the route should already be failing for other reasons.

**Mitigation.** Log warnings at `warn` level (not `debug`) so the fallback is visible in monitoring. Add a test that covers the fallback path explicitly. Consider making the fallback configurable per environment (strict mode in development that throws, permissive mode in production that falls back).

---

### R-002. Admin routes have negligible overhead from always-parse approach

**Description.** With the lazy-parse optimization removed, all routes (including admin routes where AdminSchema = BaseSchema) run `safeParse()` on every response item. For admin routes, this results in a parse that strips zero fields (all fields are declared in AdminSchema).

**Likelihood.** N/A (this is expected behavior, not a risk to correctness).

**Impact.** The overhead is ~0.1-0.3ms per item. For a typical admin list response of 25 items, this adds ~2.5-7.5ms, negligible against DB latency of 50-200ms. For the 21 of 23 schema sets where AdminSchema is a direct reference alias, the parse produces identical output. For User (`.extend()`) and Permission (`z.object()`), the parse also produces correct output because the AdminSchema includes all admin-visible fields.

**Mitigation.** No mitigation needed. If performance profiling in the future shows this is a bottleneck (unlikely), the lazy-parse optimization can be re-introduced as a follow-on.

---

### R-003. Paginated response strips items but pagination metadata is unaffected

**Description.** `createPaginatedResponse()` strips fields from each item in `items[]` but the `pagination` object is not subject to schema stripping. This is correct behavior but must be documented to avoid confusion.

**Likelihood.** N/A (this is intended behavior, not a risk to correctness).

**Mitigation.** Document explicitly in JSDoc on `createPaginatedResponse()` that schema stripping applies to items only.

---

### R-004. Existing integration tests may implicitly assert presence of soon-to-be-stripped fields

**Description.** Some existing integration tests may assert that certain fields are present in responses. After enforcement, fields stripped by the access schema will no longer be present, causing those tests to fail.

**Likelihood.** Medium. The existing `admin-list-routes.test.ts` tests verify pagination structure but do not currently assert specific field values. However, other route tests may.

**Mitigation.** Run the full test suite immediately after implementing enforcement and fix any test assertions that incorrectly relied on leaked fields. Treat those test failures as verification that the enforcement is working correctly, not as regressions.

---

### R-005. Relation data stripped by safeParse if access schemas lack relation fields (mitigated by Phase 0)

**Description.** Several entities are returned from services with nested relation data (e.g., Accommodation with `destination`, `owner`; Post with `author`, `relatedAccommodation`). Access schemas currently define only flat entity fields (ID references like `destinationId`, `ownerId`). If `safeParse()` is enabled without extending schemas to include relation fields, Zod will silently strip all nested relation objects, breaking endpoints that return enriched data.

**Affected entities (9):**

| Entity | Relations Returned by Service | Current Schema Has Relation Fields? |
|--------|------------------------------|--------------------------------------|
| Post | author, relatedAccommodation, relatedDestination, relatedEvent, sponsorship→sponsor | No (only ID fields) |
| Accommodation | destination, owner | No (only ID fields) |
| AccommodationReview | user, accommodation | No (only ID fields) |
| DestinationReview | user, destination | No (only ID fields) |
| PostSponsorship | post, sponsor | No (only ID fields) |
| UserBookmark | user | No (only ID fields) |
| OwnerPromotion | owner, accommodation | No (only ID fields: `ownerId`, `accommodationId`) |
| Sponsorship | sponsorUser, level, package | No (only ID fields: `sponsorUserId`, `levelId`, `packageId`) |
| Event | organizer, location | No (only ID fields: `organizerId`, `locationId`) |

**Likelihood.** Certain (without Phase 0). The mismatch between service output and schema shape is verified against current source code.

**Mitigation.** Phase 0 of this spec extends access schemas to include relation fields using tier-appropriate schemas (e.g., `AccommodationPublicSchema` adds `destination: DestinationPublicSchema.optional()`). This ensures that when `safeParse()` runs, relation data is preserved AND stripped to the correct tier.

---

### R-006. Date field type mismatch during safeParse

**Description.** Entity schemas define date fields using `z.date()` (accepting JavaScript `Date` objects). Services return raw database results containing `Date` objects. When `safeParse()` runs in the response helper, date fields pass validation because they are still `Date` objects at that point. HOWEVER, if any middleware or transformation converts dates to ISO strings before reaching the response helper, `z.date()` would reject them (`success: false`) and trigger the fallback path.

**Likelihood.** Low. The verified code path shows that services return `Date` objects directly from Drizzle, and `c.json()` handles serialization to ISO strings AFTER the response helper builds the response object. The `safeParse()` call happens before `c.json()`, so dates are still `Date` objects.

**Mitigation.** Document this assumption explicitly. If future middleware (e.g., response serialization) is added between the response helper and `c.json()`, verify that date fields are not pre-serialized.

### R-007. Routes bypassing createResponse/createPaginatedResponse are not covered

**Description.** Enforcement is implemented in `createResponse()` and `createPaginatedResponse()`. However, 11 route files use `c.json()` directly, bypassing the enforcement mechanism entirely. Most are non-sensitive (metrics, health checks, webhooks, reports), but two are critical:

| Route | Tier | Risk |
|-------|------|------|
| `/auth/handler.ts` (Better Auth catch-all, lines 471-474) | Public/Protected | Returns raw Better Auth user objects without schema stripping. Better Auth manages its own response format. |
| `/auth/status.ts` (lines 30-49) | Public | Returns actor object with permissions array via `c.json()` directly. |
| `/metrics/index.ts` | Admin | Metrics data (non-sensitive) |
| `/revalidation/index.ts` | Admin | ISR config data (non-sensitive) |
| `/billing/admin/subscription-cancel.ts` | Admin | Subscription data |
| `/billing/admin/customer-addons.ts` | Admin | Billing addons |
| `/feedback/public/submit.ts` | Public | Non-sensitive |
| `/webhooks/mercadopago/event-handler.ts` | Webhook | Webhook event data |
| `/webhooks/health.ts` | Internal | Health data |
| `/reports/create-report.ts` | Admin | Report data |
| `/health/db-health.ts` | Internal | DB health data |

**Likelihood.** Certain (these routes exist today and will continue to bypass enforcement after SPEC-062).

**Impact.** Low for most routes (non-entity data). Medium for auth routes (user data). Better Auth routes are architecturally separate.. they don't use the route factory system and Better Auth manages its own response serialization.

**Mitigation.** Document this as a known coverage boundary. Auth route enforcement requires a different approach (wrapping Better Auth responses or post-processing) and is deferred to a future spec. The remaining 9 non-auth routes return operational/system data that does not contain entity-level sensitive fields.

---

### R-008. getById routes return data WITHOUT relations (unlike list routes)

**Description.** `BaseCrudService.getByField()` uses `model.findOne()` which issues `SELECT *` without relation loading. In contrast, `list()` and `adminList()` use `model.findAllWithRelations()` with `getDefaultListRelations()`. This means getById responses contain only flat ID fields (e.g., `destinationId`), while list responses contain populated relation objects (e.g., `destination: { id, name, ... }`).

Phase 0's schema extensions use `.optional()` for all relation fields, so `safeParse()` handles both cases correctly:
- **getById**: Relations absent.. `.optional()` fields are simply not present. No parse failure.
- **list**: Relations present.. stripped to the correct tier's schema. Correct behavior.

**Likelihood.** N/A (pre-existing architectural inconsistency, not introduced by SPEC-062).

**Impact.** None on SPEC-062 correctness. The inconsistency between getById and list responses is a separate concern tracked in a dedicated spec (see Future Considerations).

**Mitigation.** No action needed within SPEC-062. A separate spec will address adding relation loading support to `getByField()`/`findOne()`.

---

## Execution Order & Agent Safety Guide

> **For agents**: Read this section before implementing. If prerequisites are not met, STOP and report to the user.

### Prerequisites

- **SPEC-057** (Admin Response Schema Naming Consistency): Already **completed**. Defined the access schema structure this spec enforces at runtime.

### Position in the Dependency Graph

```
SPEC-057 ✅ (done) ──► SPEC-062 Phase 0 (schema extensions for relations)
                            │
                            ├──► SPEC-063 (lifecycle state) ── BLOCKED until Phase 0 merged
                            │
                            └──► SPEC-066 (getById relations) ── needs Phase 0 for schemas
                                      │
                                      ▼
                               SPEC-062 Phase 1 (runtime enforcement) ── LAST
```

### CRITICAL: Phase 0 and Phase 1 Are Separate Deployments

SPEC-062 has TWO distinct phases that MUST NOT be deployed together:

#### Phase 0: Access Schema Relation Audit & Extension
- Extends PublicSchema, ProtectedSchema, AdminSchema for 9 entities to include relation fields
- Adds `lifecycleState` to AdminSchema for entities that will get it in SPEC-063
- **This is a prerequisite for SPEC-063 and SPEC-066**
- **Deploy Phase 0 FIRST, then let SPEC-063 and SPEC-066 land, THEN deploy Phase 1**

#### Phase 1: Runtime Enforcement
- Modifies `createResponse()` and `createPaginatedResponse()` to call `.safeParse()` with responseSchema
- Strips fields not declared in the route's access schema
- **This MUST be deployed LAST** -- after SPEC-063 and SPEC-066 are merged
- If deployed before SPEC-063: new `lifecycleState` columns would be stripped from admin responses
- If deployed before SPEC-066: newly loaded relations would be stripped from responses

### Deployment Sequence (MANDATORY)

```
1. SPEC-062 Phase 0  ── merge to main
2. SPEC-063           ── merge to main (adds lifecycleState columns, schemas already updated)
3. SPEC-066           ── merge to main (adds relation loading, schemas already include relations)
4. SPEC-062 Phase 1   ── merge to main (enforces stripping, all schemas are complete)
```

**If an agent tries to implement Phase 1 before SPEC-063 and SPEC-066 are merged: REFUSE. Explain the deployment sequence.**

### Parallel Safety

| Spec | Conflict Risk | Details |
|------|--------------|---------|
| SPEC-051-055 | None | Different layers entirely. |
| SPEC-058-061 | None | Transaction chain is DB/service layer. SPEC-062 is API response layer. |
| SPEC-063 | **Sequenced** | SPEC-063 MUST land AFTER Phase 0 and BEFORE Phase 1. Phase 0 adds `lifecycleState` to AdminSchema. SPEC-063 adds the DB column. Phase 1 enforces stripping. |
| SPEC-064 | None | Billing services. No shared files. |
| SPEC-066 | **Sequenced** | SPEC-066 SHOULD land AFTER Phase 0 and BEFORE Phase 1. Phase 0 adds relation fields to schemas. SPEC-066 loads those relations. Phase 1 enforces stripping. |

### Agent Instructions

**For Phase 0:**
1. Verify `pnpm typecheck` passes on current `main`
2. Extend access schemas for 9 entities with relation fields
3. Add `lifecycleState` to AdminSchema for entities listed in SPEC-063
4. Run `pnpm typecheck && pnpm test`
5. Merge to `main`
6. **STOP. Do NOT proceed to Phase 1. Wait for SPEC-063 and SPEC-066.**

**For Phase 1 (separate PR, later):**
1. Verify SPEC-063 is **merged to `main`**
2. Verify SPEC-066 is **merged to `main`**
3. Modify `createResponse()`, `createPaginatedResponse()`, route factories
4. Run `pnpm typecheck && pnpm test`
5. Verify: public endpoints do NOT return `createdById`, `adminInfo`, etc.

---

## Key Files

| File | Role in This Spec |
|------|-------------------|
| `apps/api/src/utils/response-helpers.ts` (508 lines) | Add optional `responseSchema` parameter to `createResponse()` (line 70) and `createPaginatedResponse()` (line 108). Implement `.safeParse()` call and fallback with warning log. Also contains `createBulkResponse()` (line 387), `createAcceptedResponse()` (line 433), `createNoContentResponse()` (line 460), and error utilities `throwIfError()`/`throwIfErrorWithMessage()` (lines 478-508). Only `createResponse()` and `createPaginatedResponse()` need modification. |
| `apps/api/src/utils/route-factory.ts` (484 lines) | Thread `responseSchema` from route definitions to response helper calls. Contains `createSimpleRoute` (line 245), `createCRUDRoute` (line 281), `createListRoute` (line 384). Currently passes `responseSchema` to `ResponseFactory` for OpenAPI docs only (lines 257, 314, 419) but NOT to `createResponse()`/`createPaginatedResponse()`. |
| `apps/api/src/utils/route-factory-tiered.ts` (341 lines) | Contains the tiered factory wrappers: `createPublicRoute` (line 72), `createProtectedRoute` (line 117), `createAdminRoute` (line 167), `createPublicListRoute` (line 241), `createProtectedListRoute` (line 279), `createAdminListRoute` (line 321). Re-exported from `route-factory.ts` (lines 469-476). These wrappers delegate to base factories, so changes to base factories automatically propagate. |
| `apps/api/src/middlewares/response-validator.ts` (228 lines) | Documentation update only. Currently validates envelope shape only (`data` typed as `z.unknown()`, lines 49-106). Disabled in production (line 112: `env.NODE_ENV === 'development' || env.NODE_ENV === 'test'`). Add comment noting field-level enforcement has moved to response helpers. |
| `packages/schemas/src/entities/*/<entity-name>.access.schema.ts` (21 files, 23 schema sets) | Source of `*PublicSchema`, `*ProtectedSchema`, `*AdminSchema` references. File naming convention is `<entity-name>.access.schema.ts` (e.g., `accommodation.access.schema.ts`, `exchange-rate.access.schema.ts`). Phase 0 modifies these to add relation fields; Phase 1 passes them to response helpers. |
| `packages/schemas/test/entities/access-boundary/access-boundary.test.ts` (656 lines, existing) | Existing boundary tests covering all 23 schema sets across all 3 tiers with table-driven tests. Enhance to add explicit sensitive field absence assertions per the "Sensitive Fields at Risk" table. |
| `apps/api/test/integration/field-enforcement/` | New integration test directory. HTTP-level tests verifying field presence and absence per tier for each entity. |

---

## Implementation Notes

### Zod v4 Behavior Summary

The project uses **Zod v4** (`^4.0.8`). Key behaviors relevant to this spec:

1. **Default strip behavior**: `z.object({...}).safeParse(data)` automatically strips (removes) any keys in `data` not declared in the schema. No `.strip()` call needed. This is the DEFAULT behavior.
2. **No compilation**: Zod schemas are runtime JavaScript objects (Zod class instances like `ZodObject`, `ZodString`, etc.) created at module load time. There is no "compilation" step. AJV compiles JSON Schema to functions; Zod does not. References are static.
3. **Performance**: Zod v4 is ~6.5x faster than Zod v3 for object parsing. A 15-20 field schema `.safeParse()` call takes approximately 0.1-0.3ms, negligible against DB latency.
4. **safeParse vs parse**: `.safeParse()` returns `{ success: true, data }` or `{ success: false, error }` without throwing. `.parse()` throws on failure. This spec uses `.safeParse()` for the fallback path.
5. **Strip never fails for extra keys**: Zod strip mode silently removes unrecognized keys. It only fails (returns `success: false`) if a REQUIRED field is missing or a field has an invalid type. Extra fields never cause failure.
5b. **Transforms are applied during safeParse**: Schemas using `.transform()` and `.pipe()` (e.g., SPEC-056's `createAverageRatingField()` for numeric column coercion) work correctly with `.safeParse()`. The transform executes as part of parsing, so coerced values (string-to-number for `averageRating`, `reviewsCount`, etc.) are correctly transformed in the stripped output. No special handling needed.
6. **ZodError no longer extends Error**: In Zod v4, neither `$ZodError` (from `zod/v4/core` / `zod/mini`) nor `ZodError` (from the main `zod` package) extends the native `Error` class. This was changed for performance reasons (avoiding Error object instantiation overhead during safe parsing). Code in the fallback path must NOT use `instanceof Error` to catch `ZodError`. The `safeParse()` approach used in this spec is unaffected because it returns a result object rather than throwing, but any future error-handling code must be aware of this breaking change.

### Response Stripping Logic (pseudocode)

```typescript
// In response helper:
function stripWithSchema<T>(data: T, responseSchema?: ZodType): T {
  // No schema provided: pass through (backward compatible)
  if (!responseSchema) return data;

  // Parse and strip (Zod v4 strips unknown keys by default)
  const result = responseSchema.safeParse(data);
  if (result.success) return result.data as T;

  // Fallback: log warning, return unstripped data (preserves availability)
  logger.warn('Response schema parse failed', { error: result.error });
  return data;
}
```

No lazy-parse optimization is used. All routes with a `responseSchema` run `safeParse()`. The overhead is negligible (~0.1-0.3ms per item).

### Threading responseSchema Through Route Factories

The `responseSchema` is already declared in route definitions and available in all factory functions. The change is to pass it as an additional parameter to `createResponse()` and `createPaginatedResponse()`:

```typescript
// Current (route-factory.ts, createCRUDRoute, ~line 364):
return createResponse(result, ctx, 200);

// After this spec:
return createResponse(result, ctx, 200, options.responseSchema);
```

For list routes:
```typescript
// Current (route-factory.ts, createListRoute, ~line 460):
return createPaginatedResponse(typedResult.items, typedResult.pagination, ctx, 200);

// After this spec:
return createPaginatedResponse(typedResult.items, typedResult.pagination, ctx, 200, options.responseSchema);
```

### Performance Note for Paginated Responses

For paginated responses, `safeParse()` runs on each item in the `items` array. With the default `pageSize` of 25 items and ~0.1-0.3ms per parse, the total stripping time per response is ~2.5-7.5ms. For larger page sizes (max 100), this increases to ~10-30ms. This remains well within acceptable bounds relative to DB latency (50-200ms) and network overhead.

### Phase 0 Detail: Access Schema Relation Audit & Extension

The following 9 entities have services that return nested relation objects via `getDefaultListRelations()`, but their access schemas currently define only flat ID fields. Phase 0 must extend these access schemas.

**Entities requiring relation schema extension:**

| Entity | Service Relations | Schema Extension Needed (example for Public tier) |
|--------|-------------------|---------------------------------------------------|
| Post | `author`, `relatedAccommodation`, `relatedDestination`, `relatedEvent`, `sponsorship→sponsor` | `author: UserPublicSchema.optional()`, `relatedAccommodation: AccommodationPublicSchema.optional()`, `relatedDestination: DestinationPublicSchema.optional()`, `relatedEvent: EventPublicSchema.optional()`, `sponsorship: PostSponsorshipPublicSchema.extend({ sponsor: UserPublicSchema.optional() }).optional()` |
| Accommodation | `destination`, `owner` + dynamic: `amenities` (via `?includeAmenities`), `features` (via `?includeFeatures`) | `destination: DestinationPublicSchema.optional()`, `owner: UserPublicSchema.optional()`, `amenities: z.array(AmenityPublicSchema).optional()`, `features: z.array(FeaturePublicSchema).optional()` |
| AccommodationReview | `user`, `accommodation` | `user: UserPublicSchema.optional()`, `accommodation: AccommodationPublicSchema.optional()` |
| DestinationReview | `user`, `destination` | `user: UserPublicSchema.optional()`, `destination: DestinationPublicSchema.optional()` |
| PostSponsorship | `post`, `sponsor` | `post: PostPublicSchema.optional()`, `sponsor: UserPublicSchema.optional()` |
| UserBookmark | `user` | `user: UserPublicSchema.optional()` |
| OwnerPromotion | `owner`, `accommodation` | `owner: UserPublicSchema.optional()`, `accommodation: AccommodationPublicSchema.optional()` |
| Sponsorship | `sponsorUser`, `level`, `package` | `sponsorUser: UserPublicSchema.optional()`, `level: SponsorshipLevelSchema.optional()`, `package: SponsorshipPackageSchema.optional()` (Note: SponsorshipLevel and SponsorshipPackage lack access schemas; use their base schemas directly since they have no tiered access control) |
| Event | `organizer`, `location` | `organizer: EventOrganizerPublicSchema.optional()`, `location: EventLocationPublicSchema.optional()` |

**Rules for relation field extension:**
1. Each tier uses the corresponding tier's schema for the related entity (e.g., Public tier uses `*PublicSchema`, Admin uses `*AdminSchema`).
2. Relation fields are always `.optional()` because not all queries include relations.
3. If the related entity's schema does not exist for a given tier (e.g., no `UserPublicSchema` for some relation), use the most restrictive available schema.
4. Watch for circular references: if `PostPublicSchema` includes `author: UserPublicSchema` and `UserPublicSchema` includes `posts: z.array(PostPublicSchema)`, break the cycle. In Zod v4, the preferred pattern uses getter properties instead of `z.lazy()` (e.g., `get author() { return UserPublicSchema.optional(); }`). `z.lazy()` still works but getters are the recommended v4 approach. In practice, circular relations are rare in this codebase.
5. Run existing boundary tests after each extension to verify no regressions.
6. **Dynamic/conditional relations**: Some route handlers add relations beyond `getDefaultListRelations()` based on query parameters. Accommodation's `list.ts` (lines 35-50) conditionally adds `amenities: { amenity: true }` when `?includeAmenities=true` AND `features: { feature: true }` when `?includeFeatures=true`. Access schemas MUST include these conditional relation fields as `.optional()` to prevent stripping when the query param is active. Implementers must audit route handlers for dynamic relation additions, not just service-level defaults. Currently only Accommodation has dynamic relations; all other entities use only the service-level `getDefaultListRelations()`.
7. **Nested relations**: When a relation itself contains sub-relations (e.g., Post's `sponsorship: { sponsor: true }` is a 2-level nesting), the schema extension must nest tier-appropriate schemas at each level. For Post's public tier: `sponsorship: PostSponsorshipPublicSchema.extend({ sponsor: UserPublicSchema.optional() }).optional()`. Do NOT use the base PostSponsorshipSchema for public/protected tiers; use the tier-appropriate access schema extended with its own nested relation schemas.

8. **Preemptive SPEC-063 fields**: OwnerPromotion, Sponsorship, and DestinationReview will gain a `lifecycleState` field when SPEC-063 is implemented. Phase 0 should preemptively add `lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional()` to the **AdminSchema only** for these 3 entities. This prevents the field from being silently stripped when SPEC-063 is deployed. The field should NOT be added to PublicSchema or ProtectedSchema (it is admin-only internal state). AccommodationReview already has `lifecycleState` and does not need this preemptive addition. If SPEC-063 is not implemented, the `.optional()` field simply has no effect (field absent = valid for optional).

**Entities NOT requiring extension (14 of 23):** These entities either have no relation data in their service responses (e.g., Tag, Amenity, Feature, Destination, Attraction, ExchangeRate) or are configuration/system entities (Permission, Revalidation). Note that SponsorshipLevel and SponsorshipPackage do NOT have access.schema.ts files and are therefore outside the scope of Phase 0 (they are used as relation targets but do not themselves have tiered access schemas).

---

## Revision Log

| Rev | Date | Changes |
|-----|------|---------|
| 1 | 2026-03-31 | Initial draft |
| 2 | 2026-04-02 | **Exhaustive review pass 1.** Verified all claims against source code and Zod v4 documentation. Changes: (1) Updated entity count from 16 to 21 with full inventory table. (2) Added Zod v4 version tag and confirmed strip-by-default behavior. (3) Replaced "schema pre-compilation/cache" language with correct "static module-level constants" (Zod has no compilation step). (4) Updated performance estimate from "~0.1ms" to "~0.1-0.3ms" based on Zod v4 benchmarks. (5) Acknowledged existing boundary tests (657 lines, 20 entities) and scoped US-005 as enhancement, not greenfield. (6) Fixed test path from `packages/schemas/test/access-schema-boundaries/` to actual `packages/schemas/test/entities/access-boundary/`. (7) Added `route-factory-tiered.ts` to Key Files. (8) Fixed duplicate `createBulkResponse()` mention in Future Considerations. (9) Added User entity `===` exception (uses `.extend()`, not direct reference). (10) Added SPEC-063 relationship for `lifecycleState` on 4 entities. (11) Added Implementation Notes with Zod v4 behavior summary, lazy-parse pseudocode, and threading examples. (12) Updated route count from "55" to "~55-65". (13) Added line numbers for all key file references. (14) Added revision log. |
| 3 | 2026-04-03 | **Exhaustive review pass 2 (early).** Cross-referenced with SPEC-050 through SPEC-065, verified all source code claims, researched Zod v4 and @hono/zod-openapi documentation. Changes: (1) **Entity inventory expanded from 21 to 23 schema sets**: Added ExchangeRateConfig (#11) and RevalidationLog/RevalidationConfig (#18/#19) as separate entries; noted ExchangeRate and Revalidation files each export 2 schema sets. (2) **Permission AdminSchema corrected**: Was listed as "Direct reference" but actual code uses `z.object()`. Added as second `===` exception alongside User. (3) **Sensitive Fields at Risk table**: Corrected counts with exact entity lists (18 of 23 for audit fields, 15 of 23 for adminInfo, ~14-15 for lifecycleState) replacing vague "All 16 entities". (4) **Lazy-parse optimization REMOVED**: Eliminated `baseSchema` threading complexity; always run `safeParse()`. Overhead is negligible (~0.1-0.3ms/item). (5) **Phase 0 added (prerequisite)**: "Access Schema Relation Audit & Extension". Identified 6 entities (Post, Accommodation, AccommodationReview, DestinationReview, PostSponsorship, UserBookmark) whose services return nested relation objects but whose access schemas only define flat ID fields. Without Phase 0, `safeParse()` would silently strip relation data. Phase 0 extends access schemas to include relation fields using tier-appropriate schemas. (6) **R-002 rewritten**: Changed from lazy-parse risk to always-parse overhead documentation. (7) **R-005 added**: Relation data stripping risk with full entity/relation matrix and mitigation via Phase 0. (8) **R-006 added**: Date field type mismatch risk during safeParse (low likelihood, documented assumption). (9) **Performance note for paginated responses**: Added explicit calculation for array stripping overhead (25 items = ~2.5-7.5ms, 100 items = ~10-30ms). (10) **Phase 0 implementation detail**: Added full table of 6 affected entities, their relations, required schema extensions, and 5 rules for relation field extension (tier-appropriate schemas, `.optional()`, circular reference handling with `z.lazy()`). (11) **Fixed `createOpenApiRoute` reference**: Function doesn't exist; corrected to actual factory names (`createSimpleRoute`, `createCRUDRoute`, `createListRoute`). (12) **route-factory-tiered.ts line count added**: 342 lines with individual factory line numbers. (13) **Dependencies table**: Updated file count from 16 to 21 files (23 schema sets), changed from "Read-only" to "Modified" (Phase 0). (14) **All "16 entities" references updated** to 23 schema sets across Goals, US-005, Dependencies. (15) **Pseudocode simplified**: Removed `baseSchema` parameter, simplified to direct `safeParse()` call. (16) **Threading examples fixed**: Corrected current-code line references to match actual signatures (`result` not `result.data`, includes `ctx` and `statusCode`). (17) **Out of Scope updated**: Clarified that Phase 0 modifies access schema content but not route-to-schema assignments. (18) **Future Considerations expanded**: Added lazy-parse re-introduction as future optimization option, and comprehensive relation schema audit as ongoing maintenance. (19) **Verified against @hono/zod-openapi docs**: Confirmed that `strictResponse` option exists but is incompatible with the fallback approach (it returns 500 on failure). Spec correctly uses response-helper-level enforcement instead of middleware. (20) **Verified Zod v4 behavior**: Confirmed strip-by-default, `safeParse()` performance characteristics, and that `z.date()` accepts Date objects (services return Date objects from Drizzle before `c.json()` serialization). |
| 4 | 2026-04-03 | **Exhaustive review pass 3.** Full code verification of all claims, Zod v4 documentation research, cross-spec overlap analysis (SPEC-050 through SPEC-065), and service-level relation audit. Changes: (1) **Line counts corrected (off-by-one in 5 files)**: response-helpers.ts 509→508, route-factory.ts 485→484, route-factory-tiered.ts 342→341, response-validator.ts 229→228, access-boundary.test.ts 657→656. (2) **Zod v4 "plain JavaScript objects" corrected**: Schemas are runtime class instances (ZodObject, ZodString, etc.), not POJOs. Updated wording in Implementation Notes and US-004 Scenario 4 to say "runtime JavaScript objects (Zod class instances) that require no compilation step". (3) **Phase 0 expanded from 6 to 9 entities**: Added OwnerPromotion (returns owner, accommodation via getDefaultListRelations at line 51-53), Sponsorship (returns sponsorUser, level, package at line 49-51), and Event (returns organizer, location at line 77-79). All 3 have access.schema.ts files with only flat ID fields. Without extension, safeParse would silently strip their relation data. (4) **Sponsorship relation caveat added**: SponsorshipLevel and SponsorshipPackage do NOT have access.schema.ts files. Sponsorship's schema extension must use their base schemas directly since they have no tiered access control. (5) **R-005 updated**: Affected entities table expanded from 6 to 9 rows with ID field details. (6) **"Entities NOT requiring extension" updated**: 17→14 of 23. (7) **Future Considerations updated**: "beyond the 6 entities" → "beyond the 9 entities". (8) **ZodError v4 breaking change documented**: Added item 6 to Zod v4 Behavior Summary noting ZodError no longer extends Error (performance optimization). Code must not use `instanceof Error` to catch ZodError. safeParse approach is unaffected. (9) **Stale lazy-parse references removed**: UX Considerations "Admin consumer experience" still referenced lazy-parse optimization as active (contradicting In Scope which removed it in Rev 3). Fixed to describe always-parse behavior with negligible overhead. Developer Experience "Schema reference verification" also referenced lazy-parse `===` check; rewritten. (10) **Dynamic/conditional relations rule added**: Rule 6 in Phase 0 rules documents that some route handlers add relations beyond getDefaultListRelations() via query params (e.g., Accommodation's list.ts adds amenities conditionally). Access schemas must include these as .optional(). (11) **Cross-spec overlap analysis**: No contradictions found. SPEC-063 correctly referenced. SPEC-058/059/060/061/064/065 have no overlap with SPEC-062. (12) **All function line numbers verified correct** against current source code. (13) **All 23 schema sets verified** with correct AdminSchema pattern classifications and exception documentation. |
| 5 | 2026-04-03 | **Exhaustive review pass 4.** Independent verification of all claims by separate review team (orchestrator + 3 specialized agents: Zod v4 documentation researcher, codebase verifier, cross-spec analyzer). Changes: (1) **Installed Zod version noted**: Header updated to show `^4.0.8` declared in package.json with installed version `4.3.6`. (2) **Access schema file naming corrected**: Key Files and Dependencies sections referenced `*/access.schema.ts` glob pattern, but actual files follow `<entity-name>.access.schema.ts` convention (e.g., `accommodation.access.schema.ts`). Corrected with naming convention note. (3) **ZodError statement clarified**: Expanded to explicitly mention both `$ZodError` (zod/v4/core) and `ZodError` (main package) neither extending native `Error`. (4) **z.lazy() updated for Zod v4**: Phase 0 Rule 4 updated to note that Zod v4 prefers getter properties over `z.lazy()` for circular references. (5) **SPEC-056 transform compatibility documented**: Added item 5b to Zod v4 Behavior Summary confirming `.safeParse()` correctly handles `.transform()` and `.pipe()` used by SPEC-056's numeric coercion fields. (6) **Revision log reordered**: Rev 3 and Rev 4 were swapped (Rev 4 appeared before Rev 3). Fixed to chronological order. (7) **Cross-spec overlap re-verified**: All 15 specs (SPEC-050 through SPEC-065) analyzed. No contradictions found. SPEC-056 numeric coercion confirmed compatible. SPEC-063 lifecycle state correctly referenced. SPEC-058/059/060/061/064 operate on different layers with no overlap. (8) **All 21 access.schema.ts files confirmed to exist** (21 files, 23 schema sets). SPEC-057 completion verified. (9) **All line numbers re-verified correct** against current source. |
| 6 | 2026-04-03 | **Exhaustive review pass 5.** Full independent audit with 6 specialized agents (Zod v4 docs researcher, codebase verifier, access schema verifier, cross-spec analyzer, getById relation auditor, c.json bypass scanner). All prior claims re-verified correct. Changes: (1) **SPEC-050 added to Related specs**: Lifecycle state modeling overlaps with SPEC-063 on OwnerPromotion and DestinationReview status fields. (2) **R-007 added (c.json bypass routes)**: Identified 11 routes using `c.json()` directly, bypassing enforcement. 2 critical (auth handler, auth status returning user data), 9 non-sensitive (metrics, health, webhooks, reports). Full route table with tiers and risk assessment. (3) **R-008 added (getById relation asymmetry)**: Documented that `getByField()`/`findOne()` loads NO relations while `list()`/`adminList()` uses `findAllWithRelations()`. Phase 0's `.optional()` handles both cases correctly. Tracked as separate spec. (4) **Out of Scope expanded (4 items)**: Added explicit exclusions for c.json bypass routes, Better Auth responses, getById relation loading, and cross-referenced R-007/R-008 for traceability. (5) **Future Considerations expanded (3 items)**: Added auth route schema enforcement (with two approach options: response wrapping vs Better Auth `user.fields`), getById relation loading consistency (with `findOneWithRelations()` proposal), and c.json bypass route migration plan (prioritized: auth first, billing second, operational last). (6) **All Zod v4 claims independently verified** against official docs (zod.dev/v4): strip-by-default confirmed, 6.5x benchmark confirmed, ZodError/Error inheritance confirmed (with ZodRealError variant noted), getter preference confirmed, safeParse+transforms confirmed, z.date() confirmed. (7) **All 22 code claims verified**: 5 file line counts, 12 function locations, 3 entity relation sets, Zod version, response-validator behavior. Zero discrepancies. (8) **All 21 access.schema.ts files verified**: 23 schema sets with correct AdminSchema pattern classifications (18 direct reference, 2 exceptions: User `.extend()`, Permission `z.object()`). (9) **Cross-spec re-verified (SPEC-050 through SPEC-065)**: No contradictions. SPEC-050/063 correctly referenced. No functional overlap with SPEC-058/059/060/061/064/065. |
| 7 | 2026-04-03 | **Exhaustive review pass 6.** Independent verification with 4 specialized agents (Zod v4 docs researcher via web search, codebase code-claim verifier, relation data exhaustive auditor, cross-spec analyzer). All 5 line counts, 16 function locations, 11 c.json routes, 21 access.schema.ts files, Zod v4 behavior re-verified correct with zero discrepancies. Changes: (1) **Phase 0 Rule 6 corrected (missing `features` dynamic relation)**: Accommodation's `list.ts` (lines 35-50) conditionally adds BOTH `amenities: { amenity: true }` AND `features: { feature: true }` via query params. Spec previously only mentioned `amenities`. Added `features` and confirmed Accommodation is the ONLY route with dynamic relation additions. (2) **Phase 0 Rule 7 added (nested relations)**: New rule documenting how to handle 2-level nested relations (e.g., Post's `sponsorship→sponsor`). Schema extensions must nest tier-appropriate schemas at each level using `.extend()` on the relation's access schema. (3) **Phase 0 Accommodation row expanded**: Added dynamic relations (`amenities`, `features`) and explicit schema extension examples (`z.array(AmenityPublicSchema).optional()`, `z.array(FeaturePublicSchema).optional()`). (4) **Phase 0 Post row expanded**: Replaced `etc.` with explicit schema extensions for ALL 5 relations including nested `sponsorship: PostSponsorshipPublicSchema.extend({ sponsor: UserPublicSchema.optional() }).optional()`. (5) **Zod v4 claims independently verified via web search**: strip-by-default confirmed (`.strip()` deprecated in v4 because it was already default), 6.5x benchmark confirmed (Moltar validation benchmark: v3 805µs vs v4 124µs), `.strict()` and `.passthrough()` deprecated in favor of `z.strictObject()` and `z.looseObject()`. All claims in spec are factually correct. |
| 8 | 2026-04-03 | **Exhaustive review pass 7.** Independent verification with 3 specialized agents (Zod v4 docs researcher via web search + context7, codebase code-claim verifier, cross-spec overlap analyzer covering SPEC-050 through SPEC-066). All prior claims re-verified correct with zero code discrepancies. Changes: (1) **SPEC-056 added to Dependencies table**: Documented coordination need with numeric column coercion. SPEC-056 changes `numeric()` columns to return `number` instead of `string`. Access schemas must use matching Zod types (`z.number()`) when SPEC-056 DB changes are active. Not blocking but requires deployment coordination. (2) **SPEC-059 added to Dependencies table as soft dependency**: Service-layer transaction support ensures atomic data flows into response validation. Not blocking but recommended to complete first. (3) **Performance estimate clarified**: Success Metrics updated to note that "0.1-0.3ms" is extrapolated from Moltar benchmark (v4 measured at 124us for standard object parsing), not from direct benchmarks on 15-20 field schemas. Actual times depend on schema complexity and hardware. (4) **Phase 0 Rule 8 added (preemptive SPEC-063 fields)**: Explicitly documents that OwnerPromotion, Sponsorship, and DestinationReview AdminSchemas should preemptively add `lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional()` for forward compatibility with SPEC-063. PublicSchema and ProtectedSchema should NOT include this field (admin-only). AccommodationReview already has `lifecycleState`. (5) **SPEC-063 dependency row expanded**: Added explicit instruction about preemptive `lifecycleState` field additions in Phase 0 for 3 entities. (6) **Cross-spec analysis deepened**: Full analysis of all 17 specs (SPEC-050 through SPEC-066) confirmed no blocking contradictions. SPEC-056 and SPEC-063 require coordination (now documented). SPEC-058/059/060/061/064/065/066 have no functional overlap. SPEC-066 (getById relation loading) confirmed as complementary with Phase 0's `.optional()` pattern. (7) **Zod v4 claims re-verified via official docs**: 6/8 claims CONFIRMED, 2/8 PARTIALLY CORRECT (performance estimate is extrapolation, ZodError description could be more precise about `$ZodError` vs `ZodError` class hierarchy). Both already accurate enough for implementation guidance; no wording changes needed beyond the performance clarification in (3). |
