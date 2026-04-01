# SPEC-063: Lifecycle State Standardization

> **Status**: draft
> **Priority**: P3
> **Complexity**: High
> **Origin**: GAP-057-021 (SPEC-057 gaps audit)
> **Depends on**: GAP-057-022, GAP-057-023 (DB-Zod sync for AccommodationReview and DestinationReview should be resolved first, as those gaps establish the DB-level `lifecycleState` column that this spec builds upon for AccommodationReview)
> **Created**: 2026-03-31
> **Type**: architectural-consistency
> **Breaking change**: Yes (DB migrations required, API response shape changes for OwnerPromotion and Sponsorship)

---

## Problem Statement

The 6 entities audited in SPEC-057 use three structurally different approaches to represent entity lifecycle state:

| Entity | Current field | Type | Pattern |
|--------|---------------|------|---------|
| PostSponsor | `lifecycleState` | `LifecycleStatusEnum` | Standard (`BaseLifecycleFields`) |
| Tag | `lifecycleState` | `LifecycleStatusEnum` | Standard (inline) |
| OwnerPromotion | `isActive` | `boolean` | Non-standard (simple toggle) |
| Sponsorship | `status` | `SponsorshipStatusEnum` | Custom domain-specific enum |
| AccommodationReview | (none) | N/A | No lifecycle field |
| DestinationReview | (none) | N/A | No lifecycle field |

This fragmentation creates three concrete problems:

1. **Generic admin UI is impossible.** A shared lifecycle status component cannot be built because there is no guaranteed field name or type to bind to.
2. **Filtering is inconsistent.** The base `adminList()` in `BaseCrudRead` hardcodes `where.lifecycleState = status`, causing the filter to silently fail for OwnerPromotion, Sponsorship, AccommodationReview, and DestinationReview. SPEC-050 worked around this per-entity, but the root cause remains.
3. **Reasoning about entity state is ambiguous.** A boolean `isActive`, a domain enum `pending|active|expired|cancelled`, and an absent field all express "state" in ways that are not interchangeable or comparable.

The chosen solution standardizes all 6 entities so every entity carries a `lifecycleState: LifecycleStatusEnum` field as the base lifecycle contract. Entities that additionally need domain-specific state extend with a separate dedicated field.

---

## Goals and Non-Goals

### Goals

- Every entity has a `lifecycleState: LifecycleStatusEnum` field in its Zod schema and its database column.
- No entity uses a bare `isActive: boolean` to represent lifecycle state.
- Domain-specific workflow states live in a clearly named separate field (not as a replacement for `lifecycleState`).
- The admin UI can filter any entity by `lifecycleState` using the same control.
- All DB migrations are reversible.
- All schema, service, route, and frontend changes have test coverage.

### Non-Goals

- Changing the `LifecycleStatusEnum` values themselves (`DRAFT`, `ACTIVE`, `ARCHIVED`). This spec does not add or remove enum members.
- Migrating entities outside the 6 SPEC-057 entities even if they have similar patterns.
- Replacing `SponsorshipStatusEnum` with `LifecycleStatusEnum`. The domain workflow (`PENDING`, `ACTIVE`, `EXPIRED`, `CANCELLED`) is intentionally preserved in a renamed `sponsorshipStatus` field.
- Changing public API response shapes for entities that already have `lifecycleState` (PostSponsor, Tag). They are already compliant.
- Modifying `DestinationReview`'s boolean flags `isPublished` and `isVerified`. These express different semantic concerns (content readiness and moderation trust) and coexist alongside `lifecycleState`.

---

## Overview and Success Metrics

### Overview

This spec adds or migrates the `lifecycleState` field across 4 entities (OwnerPromotion, Sponsorship, AccommodationReview, DestinationReview), requiring DB migrations for 3 of them. It is a breaking change for the API responses of OwnerPromotion (removes `isActive`, adds `lifecycleState`) and Sponsorship (renames `status` to `sponsorshipStatus`, adds `lifecycleState`).

### Success Metrics

- Zero admin UI components that need entity-specific conditional logic to render a lifecycle status badge.
- The base `adminList()` `status` filter works identically for all 6 entities after SPEC-050's `statusField` property is set to `lifecycleState` on each service.
- All 6 entities have `lifecycleState` in their Zod schema, DB schema, access schemas (at appropriate tiers), and service filter logic.
- All existing tests continue to pass. New tests cover the migration path and field presence.

---

## Actors

- **Admin user**: Uses the admin panel to filter, view, and change the lifecycle state of entities.
- **API consumer (web app)**: Reads entity data from public/protected endpoints. Affected by any field renames in response bodies.
- **System (background jobs, seed scripts)**: Creates or updates entities programmatically. Affected by field renames in create/update input schemas.

---

## User Stories

### US-001: Admin filters entities by lifecycle state uniformly

As an admin user,
I want to filter any entity list by lifecycle state using the same status control,
so that I do not need to learn entity-specific filtering conventions for OwnerPromotion, Sponsorship, and reviews.

**Priority**: Must-have

#### AC-001-01: OwnerPromotion list supports lifecycleState filter

Given the admin is on the OwnerPromotion list page,
When they select "ACTIVE", "ARCHIVED", or "DRAFT" from the status filter,
Then the list returns only promotions whose `lifecycleState` matches the selected value.

#### AC-001-02: Sponsorship list supports lifecycleState filter independently of sponsorshipStatus

Given the admin is on the Sponsorship list page,
When they filter by lifecycle state (e.g., "ARCHIVED"),
Then the list returns only sponsorships matching that `lifecycleState`,
And the `sponsorshipStatus` filter (PENDING, ACTIVE, EXPIRED, CANCELLED) operates independently as a separate filter control.

#### AC-001-03: AccommodationReview list supports lifecycleState filter

Given the admin is on the AccommodationReview list page,
When they select "DRAFT" from the status filter,
Then the list returns only accommodation reviews with `lifecycleState = DRAFT`.

#### AC-001-04: DestinationReview list supports lifecycleState filter

Given the admin is on the DestinationReview list page,
When they select "ARCHIVED" from the status filter,
Then the list returns only destination reviews with `lifecycleState = ARCHIVED`,
And the existing `isPublished` and `isVerified` boolean flags remain accessible as separate filters.

---

### US-002: Admin changes the lifecycle state of an OwnerPromotion

As an admin user,
I want to set an OwnerPromotion to DRAFT, ACTIVE, or ARCHIVED,
so that I can control its visibility with granular precision rather than a binary on/off toggle.

**Priority**: Must-have

#### AC-002-01: Update accepts lifecycleState

Given an OwnerPromotion with `lifecycleState = ACTIVE`,
When the admin sends an update request with `lifecycleState = ARCHIVED`,
Then the promotion's lifecycle state is changed to ARCHIVED,
And the response body contains the updated promotion with `lifecycleState: "ARCHIVED"`.

#### AC-002-02: isActive field is no longer accepted

Given any OwnerPromotion update request,
When the request body includes `isActive: false`,
Then the API returns a validation error,
And the response explains that `isActive` is no longer a valid field.

#### AC-002-03: Default lifecycleState on creation is ACTIVE

Given a valid OwnerPromotion creation request without a `lifecycleState` field,
When the promotion is created,
Then `lifecycleState` defaults to `ACTIVE`.

---

### US-003: Admin changes the lifecycle state of a Sponsorship independently of its workflow status

As an admin user,
I want to archive a Sponsorship without changing its domain workflow status,
so that I can hide a sponsorship from public listings while preserving its `EXPIRED` or `CANCELLED` workflow record for billing and audit purposes.

**Priority**: Must-have

#### AC-003-01: Sponsorship carries both lifecycleState and sponsorshipStatus

Given any Sponsorship,
When the admin retrieves it via any admin endpoint,
Then the response body contains both `lifecycleState` (one of DRAFT, ACTIVE, ARCHIVED) and `sponsorshipStatus` (one of pending, active, expired, cancelled).

#### AC-003-02: Archiving a sponsorship does not change sponsorshipStatus

Given a Sponsorship with `sponsorshipStatus = expired` and `lifecycleState = ACTIVE`,
When the admin updates `lifecycleState = ARCHIVED`,
Then `lifecycleState` becomes ARCHIVED,
And `sponsorshipStatus` remains `expired`.

#### AC-003-03: The old status field is no longer accepted in update requests

Given any Sponsorship update request,
When the request body includes a `status` field (the old name),
Then the API returns a validation error,
And the response explains that `status` has been renamed to `sponsorshipStatus`.

#### AC-003-04: Default lifecycleState on creation is ACTIVE

Given a valid Sponsorship creation request without a `lifecycleState` field,
When the sponsorship is created,
Then `lifecycleState` defaults to `ACTIVE`.

---

### US-004: Admin changes the lifecycle state of a review

As an admin user,
I want to set an AccommodationReview or DestinationReview to DRAFT, ACTIVE, or ARCHIVED,
so that I can moderate review visibility at the lifecycle level without deleting content.

**Priority**: Must-have

#### AC-004-01: AccommodationReview update accepts lifecycleState

Given an AccommodationReview with `lifecycleState = ACTIVE`,
When the admin sends `lifecycleState = DRAFT`,
Then the review's lifecycle state changes to DRAFT,
And the response body contains the updated review with `lifecycleState: "DRAFT"`.

#### AC-004-02: DestinationReview update accepts lifecycleState

Given a DestinationReview with `lifecycleState = ACTIVE`,
When the admin sends `lifecycleState = ARCHIVED`,
Then the review's lifecycle state changes to ARCHIVED,
And `isPublished` and `isVerified` remain unchanged.

#### AC-004-03: Default lifecycleState on review creation is ACTIVE

Given a valid AccommodationReview or DestinationReview creation request without a `lifecycleState` field,
When the review is created,
Then `lifecycleState` defaults to `ACTIVE`.

---

### US-005: Public endpoints do not expose lifecycleState

As a web app consuming public endpoints,
I want endpoints to continue filtering out non-ACTIVE content automatically,
so that the API contract for public consumers is not changed by this internal restructuring.

**Priority**: Must-have

#### AC-005-01: Public listing endpoints filter by lifecycleState = ACTIVE implicitly

Given a public listing endpoint for any of the 4 affected entities,
When the endpoint is called without any authentication,
Then only records with `lifecycleState = ACTIVE` are returned,
And `lifecycleState` is NOT included in the public response body (following the existing tier pattern where lifecycle fields are protected/admin-only).

#### AC-005-02: ProtectedSchema does not change field exposure for review entities

Given an authenticated user calling a protected listing endpoint for AccommodationReview or DestinationReview,
When the endpoint returns review data,
Then `lifecycleState` is visible in the protected response (matching the access tier decision for each entity),
And the response is otherwise identical in structure to what existed before this spec.

---

### US-006: Migrated data is correct after deployment

As the platform operator,
I want all existing OwnerPromotion and Sponsorship records to be correctly migrated,
so that no data is lost or incorrectly mapped during the field rename and type change.

**Priority**: Must-have

#### AC-006-01: OwnerPromotion migration maps isActive = true to lifecycleState = ACTIVE

Given an existing OwnerPromotion with `is_active = true` before migration,
When the migration runs,
Then the record has `lifecycle_state = 'ACTIVE'` after migration,
And the `is_active` column no longer exists.

#### AC-006-02: OwnerPromotion migration maps isActive = false to lifecycleState = ARCHIVED

Given an existing OwnerPromotion with `is_active = false` before migration,
When the migration runs,
Then the record has `lifecycle_state = 'ARCHIVED'` after migration.

#### AC-006-03: Sponsorship migration adds lifecycleState = ACTIVE by default

Given any existing Sponsorship record before migration,
When the migration runs,
Then the record has `lifecycle_state = 'ACTIVE'`,
And the `status` column is renamed to `sponsorship_status`,
And the values in `sponsorship_status` are identical to the pre-migration values in `status`.

#### AC-006-04: Rollback restores original column state

Given a failed or rolled-back deployment,
When the rollback migration runs,
Then the `is_active` column is restored for OwnerPromotion with correct boolean values,
And the `status` column is restored for Sponsorship from `sponsorship_status`,
And the `lifecycle_state` columns added by this spec are dropped.

---

## UX Considerations

### Admin Panel - Lifecycle Status Filter

The admin list pages for all 4 affected entities should use the same `LifecycleStatusFilter` component that already exists for other entities. After this spec is implemented, the only entity-specific filter control for Sponsorship is the `sponsorshipStatus` dropdown, which maps to the domain enum values (PENDING, ACTIVE, EXPIRED, CANCELLED).

**Empty state**: When an admin filters to `DRAFT` and no results exist, the list shows the standard empty state message. No special handling per entity.

**Loading state**: The list shows a skeleton loader while the filter is applied. This is unchanged from the current behavior.

### Admin Panel - OwnerPromotion Detail

The detail view for OwnerPromotion currently shows a boolean "Active / Inactive" toggle. After this spec, it shows a select control with three options: DRAFT, ACTIVE, ARCHIVED. The visual indicator (badge color) follows the existing convention used for other entities:

- ACTIVE: green badge
- DRAFT: grey badge
- ARCHIVED: amber badge

**Error state**: If an admin tries to set a lifecycle state and the API returns a validation error, the form shows the error inline next to the field. The prior state is not changed.

### API Consumers - Breaking Change Communication

The `isActive` field removal from OwnerPromotion and the `status` → `sponsorshipStatus` rename on Sponsorship are breaking changes. The rollout strategy must include:

- A deprecation notice period if any external integrations exist.
- Clear API changelog entry.
- The admin panel frontend is updated in the same deployment as the API, so it is not affected by the window between deployments.

---

## Migration Strategy

### Phase 1: AccommodationReview (lowest risk)

AccommodationReview already has `lifecycle_state` in the database (confirmed in GAP-057-022). The work is purely additive to the Zod schema.

1. Add `lifecycleState: LifecycleStatusEnumSchema.default(LifecycleStatusEnum.ACTIVE)` to `AccommodationReviewSchema`.
2. Update `AccommodationReviewAdminSchema` access tier to include `lifecycleState`.
3. Update the service filter to map the admin `status` parameter to `lifecycleState`.
4. Update tests.

No DB migration required for this phase.

### Phase 2: OwnerPromotion (additive then drop)

1. Write DB migration (up): add `lifecycle_state` column with `NOT NULL DEFAULT 'ACTIVE'`, then run a data migration `UPDATE owner_promotions SET lifecycle_state = CASE WHEN is_active THEN 'ACTIVE' ELSE 'ARCHIVED' END`, then drop `is_active` column and its index.
2. Write DB migration (down/rollback): add `is_active` column, populate from `lifecycle_state`, drop `lifecycle_state` column.
3. Update Drizzle DB schema to remove `isActive` and add `lifecycleState`.
4. Update Zod schema (remove `isActive`, add `lifecycleState`).
5. Update access schemas, CRUD schemas, query schemas.
6. Update service and routes.
7. Update admin frontend components.
8. Update all tests.

### Phase 3: Sponsorship (rename + add)

1. Write DB migration (up): add `lifecycle_state` column with `NOT NULL DEFAULT 'ACTIVE'`, rename `status` column to `sponsorship_status` (via add-copy-drop pattern to preserve data), update indexes.
2. Write DB migration (down/rollback): rename `sponsorship_status` back to `status`, drop `lifecycle_state`.
3. Update Drizzle DB schema to add `lifecycleState` and rename `status` to `sponsorshipStatus`.
4. Update Zod schema accordingly.
5. Update access schemas, CRUD schemas, admin-search schema.
6. Update service and routes.
7. Update admin frontend.
8. Update all tests.

### Phase 4: DestinationReview (new column)

DestinationReview does NOT have `lifecycle_state` in the database (confirmed via GAP-057-023 audit). This requires a real DB migration.

1. Write DB migration (up): add `lifecycle_state` column with `NOT NULL DEFAULT 'ACTIVE'`.
2. Write DB migration (down/rollback): drop `lifecycle_state` column.
3. Update Drizzle DB schema to add `lifecycleState`.
4. Add `lifecycleState` to `DestinationReviewSchema`. Keep `isPublished` and `isVerified` as-is.
5. Update access schemas, service filter, routes.
6. Update admin frontend.
7. Update tests.

### Execution Order

Phases should be executed sequentially, with each phase tested and deployed independently before moving to the next. This limits the blast radius of any rollback.

Recommended order: Phase 1 (no DB risk) -> Phase 2 -> Phase 4 -> Phase 3 (most complex).

---

## Rollback Strategy

Each DB migration must include a complete `down` migration. The project uses Drizzle, which generates forward-only migrations by default. The `down` migrations must be written as separate SQL files following the `manual/` migration pattern documented in `packages/db/docs/triggers-manifest.md`.

For OwnerPromotion and Sponsorship, the rollback restores the original column names and types using the add-copy-drop pattern in reverse. Data integrity is preserved because the mapping is lossless in both directions (true/false to ACTIVE/ARCHIVED, and status value to sponsorshipStatus value are identity transformations).

AccommodationReview rollback: remove `lifecycleState` from the Zod schema. No DB rollback needed since the column already existed.

DestinationReview rollback: drop the `lifecycle_state` column. Existing data for that column is lost if records were created between deploy and rollback. Rollback window should be minimized.

---

## Scope

### In Scope

- `OwnerPromotion`: Remove `isActive` boolean, add `lifecycleState: LifecycleStatusEnum`. DB migration required.
- `Sponsorship`: Add `lifecycleState: LifecycleStatusEnum`, rename `status` to `sponsorshipStatus: SponsorshipStatusEnum`. DB migration required.
- `AccommodationReview`: Add `lifecycleState: LifecycleStatusEnum` to Zod schema only (DB column already exists per GAP-057-022).
- `DestinationReview`: Add `lifecycleState: LifecycleStatusEnum`. DB migration required. Keep `isPublished` and `isVerified` as-is.
- Zod schemas for all 4 entities: base schema, CRUD schemas, access schemas, admin-search schemas, query schemas.
- Drizzle DB schemas for OwnerPromotion, Sponsorship, DestinationReview.
- Service filter logic: update `statusField` property (per SPEC-050 design) to `lifecycleState` for all 4 entities.
- Admin route response schemas: update any route still referencing the old field names.
- Admin frontend: OwnerPromotion detail view toggle control, Sponsorship filter controls.
- DB migration files with both up and down paths.
- Tests: schema tests, service tests, integration/route tests, migration tests.

### Out of Scope

- `PostSponsor` and `Tag`: already use `lifecycleState`. No changes needed.
- Any entity outside the 6 SPEC-057 entities.
- Changing `LifecycleStatusEnum` values.
- Removing `SponsorshipStatusEnum`.
- Changing how `isPublished` or `isVerified` work on DestinationReview.
- Public API version negotiation or formal API versioning infrastructure.
- Admin dashboard real-time state sync after lifecycle state changes (covered by existing patterns).

### Future Considerations

- A future spec could enforce that the base `adminList()` no longer needs the SPEC-050 `statusField` workaround by making `lifecycleState` a required column in the base table definition. That is an architectural improvement beyond this spec's scope.
- A future spec could add audit trail entries when `lifecycleState` changes (who changed it and when), useful for compliance.

---

## Dependencies

| Dependency | Type | Blocking? | Notes |
|------------|------|-----------|-------|
| GAP-057-022 (DB-Zod sync for AccommodationReview) | Upstream | Recommended | The `lifecycle_state` DB column already exists. If GAP-022 runs first, it adds `lifecycleState` to the Zod schema. This spec then only needs to update access schemas and service logic for AccommodationReview rather than the full Zod schema change. Running them separately is still valid. |
| GAP-057-023 (DB-Zod sync for DestinationReview) | Upstream | No | DestinationReview needs a new DB column regardless. GAP-023 adds `averageRating` to Zod; this spec adds `lifecycleState`. They can run in parallel or sequentially. |
| SPEC-050 (Lifecycle State Modeling, `statusField` property) | Upstream | Yes for service filtering | The `statusField = 'lifecycleState'` override in each service depends on the `statusField` property existing in `BaseCrudPermissions`. SPEC-050 must be completed before the service changes in this spec take effect for admin filtering. |
| Drizzle migration tooling | Infrastructure | Yes | The DB migration phases require `pnpm db:generate` and `pnpm db:migrate` to be working correctly. |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data loss during OwnerPromotion migration if `is_active` has a third state not representable by `LifecycleStatusEnum` | Low | High | Verify before migration that the column is a strict boolean. The mapping `true -> ACTIVE`, `false -> ARCHIVED` is lossless and covers all values. |
| Sponsorship consumers (external or internal) break on the `status -> sponsorshipStatus` rename | Medium | High | Audit all callers of `SponsorshipSchema.status` before deployment. Update admin frontend in the same deploy. Check if any seed scripts or external integrations read the field name. |
| DestinationReview gains a `lifecycleState` column but the `isPublished` boolean creates semantic ambiguity (a review could be `ACTIVE` + `isPublished = false`) | Medium | Medium | Document explicitly in code that `lifecycleState` controls whether the record participates in system-level lifecycle management (CRUD, bulk archive) while `isPublished` controls content visibility. Add a service-level rule: setting `lifecycleState = ARCHIVED` automatically sets `isPublished = false` if it was true. |
| Rollback window for DestinationReview if new records are created between deploy and rollback | Low | Medium | Minimize rollback window. Phase 4 is last in the recommended execution order, by which point Phase 1-3 are stable. |
| Admin frontend shipping before API migration is complete in multi-step deploy | Low | High | Deploy API changes per entity before the frontend component changes. Use feature flags if needed for the Sponsorship rename. |
| SPEC-050 not completed when this spec is implemented | Medium | Low | If SPEC-050 is absent, the admin `status` filter continues to silently fail for the 4 entities. This spec's schema and DB changes still provide value. Document this as a known limitation until SPEC-050 lands. |

---

## Affected Files (Expected)

This list is indicative. The tech analysis phase will produce the definitive inventory.

### Packages / schemas

- `packages/schemas/src/entities/accommodationReview/accommodationReview.schema.ts` - add `lifecycleState`
- `packages/schemas/src/entities/accommodationReview/accommodationReview.crud.schema.ts` - allow `lifecycleState` in create/update
- `packages/schemas/src/entities/accommodationReview/accommodationReview.access.schema.ts` - add `lifecycleState` to admin tier
- `packages/schemas/src/entities/accommodationReview/accommodationReview.admin-search.schema.ts` - remove `z.unknown().transform(() => 'all')` workaround if present
- `packages/schemas/src/entities/destinationReview/destinationReview.schema.ts` - add `lifecycleState`
- `packages/schemas/src/entities/destinationReview/destinationReview.crud.schema.ts` - allow `lifecycleState` in create/update
- `packages/schemas/src/entities/destinationReview/destinationReview.access.schema.ts` - add `lifecycleState` to admin tier
- `packages/schemas/src/entities/destinationReview/destinationReview.admin-search.schema.ts` - remove `z.unknown().transform(() => 'all')` workaround
- `packages/schemas/src/entities/owner-promotion/owner-promotion.schema.ts` - remove `isActive`, add `lifecycleState`
- `packages/schemas/src/entities/owner-promotion/owner-promotion.crud.schema.ts` - update accordingly
- `packages/schemas/src/entities/owner-promotion/owner-promotion.access.schema.ts` - update public/protected/admin picks
- `packages/schemas/src/entities/owner-promotion/owner-promotion.admin-search.schema.ts` - connect `status` filter to `lifecycleState`
- `packages/schemas/src/entities/sponsorship/sponsorship.schema.ts` - add `lifecycleState`, rename `status` to `sponsorshipStatus`
- `packages/schemas/src/entities/sponsorship/sponsorship.crud.schema.ts` - update accordingly
- `packages/schemas/src/entities/sponsorship/sponsorship.access.schema.ts` - update picks
- `packages/schemas/src/entities/sponsorship/sponsorship.admin-search.schema.ts` - update `sponsorshipStatus` field, add `lifecycleState` filter support

### Packages / db

- `packages/db/src/schemas/owner-promotion/owner_promotion.dbschema.ts` - remove `isActive`, add `lifecycleState`, update indexes
- `packages/db/src/schemas/sponsorship/sponsorship.dbschema.ts` - rename `status` to `sponsorshipStatus`, add `lifecycleState`
- `packages/db/src/schemas/destination/destination_review.dbschema.ts` - add `lifecycleState`
- DB migration files for the 3 entities requiring DB changes

### Packages / service-core

- `packages/service-core/src/services/owner-promotion/owner-promotion.service.ts` - update filter, set `statusField = 'lifecycleState'`
- `packages/service-core/src/services/sponsorship/sponsorship.service.ts` - update `_executeAdminSearch` override, set `statusField = 'lifecycleState'`
- `packages/service-core/src/services/accommodation-review/accommodation-review.service.ts` - set `statusField = 'lifecycleState'`
- `packages/service-core/src/services/destination-review/destination-review.service.ts` - set `statusField = 'lifecycleState'`

### Apps / api

- Admin and public/protected routes for the 4 entities that reference old field names in response schemas or handlers.

### Apps / admin (frontend)

- OwnerPromotion detail/list components that render or update `isActive`.
- Sponsorship list/detail components that reference `status` (rename to `sponsorshipStatus`).
- Shared lifecycle status badge/filter components if they need entity-specific logic today.
