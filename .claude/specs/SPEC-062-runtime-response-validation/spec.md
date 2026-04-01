# SPEC-062: Runtime Response Schema Enforcement

> **Status**: draft
> **Priority**: P1 (Critical)
> **Complexity**: High
> **Origin**: GAP-057-004, GAP-057-009, GAP-057-015, GAP-057-029
> **Depends on**: SPEC-057 (completed)
> **Created**: 2026-03-31

---

## Overview

The Hospeda API exposes 55 routes across three tiers (public, protected, admin). Every route declares a `responseSchema` parameter in the route factory, but that parameter is used exclusively for OpenAPI documentation generation. No runtime enforcement exists. As a result, every layer of the pipeline (database, service, handler, response helper) passes data through without field filtering. Admin-only fields such as `createdById`, `updatedById`, `deletedById`, `adminInfo`, `notes`, and `paymentId` leak to public and protected API responses.

This specification adds runtime schema enforcement at the response layer using Zod's native strip behavior, ensuring that only fields declared in the route's `responseSchema` are ever serialized to HTTP responses. The change is non-breaking: routes that do not supply a `responseSchema` continue behaving as they do today.

---

## Goals

- Guarantee that HTTP responses for every tier contain only the fields declared in that tier's `responseSchema`.
- Eliminate the exposure of admin-only, audit, and internal fields to public and protected consumers.
- Provide test coverage that verifies field presence and absence per access tier for all 16 entities.
- Establish a detection mechanism that catches future field leaks before they reach production.

### Success Metrics

- Zero admin-only fields (`createdById`, `updatedById`, `deletedById`, `adminInfo`, `deletedAt`, `notes`, `paymentId`, `lifecycleState`) present in public or protected tier responses after this spec is implemented.
- All 16 entity access schema boundary tests passing.
- Integration tests covering happy path and field-exclusion path for every access tier.
- No measurable regression in API response time (Zod `.safeParse()` on a 15-20 field schema takes approximately 0.1ms; this is negligible against typical DB latency of 50-200ms).

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
| Public | ~15 | 1 (Tag getBySlug, manual) | ~14 (93%) |
| Protected | ~8 | 0 | 8 (100%) |
| Admin | ~32 | 0 | 32 (100%) |
| **Total** | **~55** | **1 (1.8%)** | **~54 (98.2%)** |

### Sensitive Fields at Risk

| Field | Entities Affected | Sensitivity | Leak Scenario |
|-------|-------------------|-------------|---------------|
| `createdById` | All 16 entities | High (PII linkage) | Admin user UUIDs visible to anonymous users |
| `updatedById` | All 16 entities | High (PII linkage) | Admin user UUIDs visible to anonymous users |
| `deletedById` | All 16 entities | Critical | Soft-delete audit trail exposed |
| `deletedAt` | All 16 entities | Medium | Soft-delete timestamps exposed |
| `adminInfo` | 13 entities | High | Internal admin notes visible publicly |
| `notes` | Tag | High | Internal notes visible publicly |
| `lifecycleState` | ~10 entities | Medium | Internal state machine exposed |
| `paymentId` | Sponsorship | High | Payment system identifiers exposed |

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

**Scenario 4. Compiled schema cache is used at runtime.**

Given the API server has completed startup initialization,
When a request is received for any route that declares a `responseSchema`,
Then the schema used for `.safeParse()` is a pre-compiled reference,
And no schema compilation occurs per-request.

---

### US-005: Access Schema Boundary Test Coverage

As a platform engineer writing tests,
I want access schema boundary tests for all 16 entities,
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

**Scenario 4. Boundary tests exist for all 16 entities.**

Given the test suite in `packages/schemas/test/`,
When boundary tests are run,
Then tests covering all three tiers exist for each of the 16 entities:
Accommodation, AccommodationReview, Amenity, Attraction, Destination, DestinationReview, Event, EventLocation, EventOrganizer, Feature, OwnerPromotion, Post, PostSponsor, Sponsorship, Tag, and User.

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
Admin app consumers receive no change. `AdminSchema = BaseSchema` (direct alias), so the stripping behavior is a no-op for admin routes (admin schema includes all fields). The lazy-parse optimization (skip when AdminSchema equals BaseSchema) ensures zero overhead on admin routes.

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

**Schema cache visibility.**
Pre-compiled schemas at startup should be logged at debug level so engineers can verify cache loading during development.

---

## Scope

### In Scope

- Modifying `createResponse()` in `apps/api/src/utils/response-helpers.ts` to accept an optional `responseSchema` parameter and call `.safeParse()` when provided.
- Modifying `createPaginatedResponse()` in the same file to accept an optional `responseSchema` parameter and apply `.safeParse()` to each item in the `items` array when provided.
- Modifying the route factories in `apps/api/src/utils/route-factory.ts` (`createSimpleRoute`, `createOpenApiRoute`, `createListRoute`, `createAdminRoute`, `createAdminListRoute`, and all other factory variants) to pass the `responseSchema` from the route definition down to the response helpers.
- Implementing a schema registry or module-level cache so schemas are compiled once at startup and reused per request.
- Implementing the lazy-parse optimization: if the `responseSchema` reference is the same object as the base entity schema AND all fields of the base schema are present in the schema (i.e., AdminSchema = BaseSchema), skip parsing to avoid unnecessary overhead on admin routes.
- Writing access schema boundary tests for all 16 entities in `packages/schemas/test/`, covering all three tiers (Public, Protected, Admin).
- Writing integration tests that verify field presence and absence per tier for at least one endpoint per entity in the `apps/api/test/` directory.
- Adding a warning log in the fallback path when `.safeParse()` returns `success: false`.
- Updating the existing `response-validator.ts` middleware to note (via comment or documentation) that field-level enforcement has moved to the response helpers.

### Out of Scope

- Changes to the database layer (no column projection, no `SELECT` changes). Database-level optimization is a separate architectural decision.
- Changes to service layer return types. Services continue returning full entity objects.
- Changes to route handler logic. Handlers continue building and returning data as before.
- Migrating routes that currently lack a `responseSchema` to declare one. That is a follow-on consistency effort.
- Fixing any GAP-057 gaps other than GAP-057-004, GAP-057-009, GAP-057-015, and GAP-057-029.
- Changes to the public or protected route schema declarations (which schemas are declared on which routes). This spec enforces existing declarations, it does not audit or change which schema is declared.
- Changing the behavior of the `response-validator.ts` middleware (beyond documentation updates).
- Performance benchmarking infrastructure. Performance impact is characterized in this spec based on known Zod characteristics and is not expected to require a formal benchmark suite.

### Future Considerations

- Extending enforcement to the `createBulkResponse()` and `createBulkResponse()` helpers.
- Adding column projection to `BaseModel.findAll()` as a deeper performance optimization once runtime enforcement is confirmed working (database-level filtering removes the need for Zod to strip in memory).
- Auditing all 55 routes to ensure every route declares the appropriate access-tier schema (this is a consistency pass separate from runtime enforcement).

---

## Risks

### R-001. Fallback behavior hides leaks in edge cases

**Description.** When `.safeParse()` returns `success: false` (which should not occur for valid entity data), the fallback returns unstripped data to preserve availability. If the schema is misconfigured (e.g., required field is missing in the returned data), this path could silently defeat the enforcement goal.

**Likelihood.** Low. Zod's strip mode never fails for extra fields; it only fails for missing required fields or invalid types. If a service returns data that fails schema validation, the route should already be failing for other reasons.

**Mitigation.** Log warnings at `warn` level (not `debug`) so the fallback is visible in monitoring. Add a test that covers the fallback path explicitly. Consider making the fallback configurable per environment (strict mode in development that throws, permissive mode in production that falls back).

---

### R-002. Admin routes silently become no-ops if lazy optimization is over-aggressive

**Description.** If the lazy-parse optimization incorrectly identifies a non-admin schema as a BaseSchema alias and skips parsing, sensitive fields could leak through without detection.

**Likelihood.** Low if the optimization compares schema references by object identity (===) rather than by structural equality. AdminSchema is a direct reference assignment (`export const TagAdminSchema = TagSchema`), so reference equality is deterministic.

**Mitigation.** Test the optimization logic independently. Verify via a dedicated unit test that `TagAdminSchema === TagSchema` evaluates to `true` and that `TagPublicSchema === TagSchema` evaluates to `false`.

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

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| SPEC-057 (completed) | Predecessor | Provides the 16 entity access schemas (`*PublicSchema`, `*ProtectedSchema`, `*AdminSchema`) that this spec enforces at runtime. Without those schemas, this spec has no tier-specific schemas to pass to the response helpers. |
| GAP-057-015 | Absorbed | The boundary test work described in GAP-057-015 is fully covered by US-005 of this spec. No separate action needed. |
| GAP-057-009 | Absorbed | The integration test work described in GAP-057-009 is covered by US-006 of this spec. No separate action needed. |
| GAP-057-029 | Absorbed | GAP-057-029 noted that access schema types are exported but have zero usage. The route factory modifications in this spec provide the first production usage of those schema references. |
| `apps/api/src/utils/response-helpers.ts` | Modified | Core file. See key files below. |
| `apps/api/src/utils/route-factory.ts` | Modified | All factory variants require updates to thread `responseSchema` to helpers. |
| `packages/schemas/src/entities/*/access.schema.ts` | Read-only (16 files) | These schemas are passed as parameters. Their content is not changed by this spec. |
| `apps/api/src/middlewares/response-validator.ts` | Documentation update | No behavioral change; add comment noting field enforcement has moved to response helpers. |

---

## Key Files

| File | Role in This Spec |
|------|-------------------|
| `apps/api/src/utils/response-helpers.ts` | Add optional `responseSchema` parameter to `createResponse()` and `createPaginatedResponse()`. Implement `.safeParse()` call and fallback with warning log. |
| `apps/api/src/utils/route-factory.ts` | Thread `responseSchema` from route definitions to response helper calls in all factory variants. |
| `apps/api/src/middlewares/response-validator.ts` | Documentation update only. Note that field-level enforcement has moved to response helpers. |
| `packages/schemas/src/entities/*/access.schema.ts` | Source of `*PublicSchema`, `*ProtectedSchema`, `*AdminSchema` references passed to routes. |
| `packages/schemas/test/access-schema-boundaries/` | New test directory. Contains boundary tests for all 16 entities across all 3 tiers. |
| `apps/api/test/routes/field-enforcement.test.ts` | New integration test file. HTTP-level tests verifying field presence and absence per tier. |
