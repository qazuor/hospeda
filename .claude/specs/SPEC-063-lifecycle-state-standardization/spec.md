# SPEC-063: Lifecycle State Standardization

> **Status**: draft
> **Priority**: P3
> **Complexity**: High
> **Origin**: GAP-057-021 (SPEC-057 gaps audit)
> **Depends on**: GAP-057-023 (optional, for DestinationReview `averageRating` Zod sync). GAP-057-022 is already resolved (AccommodationReview has `lifecycleState` in both DB and Zod). ~~SPEC-050~~ deleted (superseded by this spec, see R6).
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
| AccommodationReview | `lifecycleState` | `LifecycleStatusEnum` | Already compliant: DB column exists (`lifecycle_state` in `accommodation_review.dbschema.ts:34`) AND Zod schema includes it via `BaseLifecycleFields` (`accommodationReview.schema.ts:21`). Access schemas already exclude from Public/Protected tiers. Admin filtering works via base `adminList()` hardcoded `lifecycleState` check. |
| DestinationReview | (none) | N/A | No lifecycle field |

This fragmentation creates three concrete problems:

1. **Generic admin UI is impossible.** A shared lifecycle status component cannot be built because there is no guaranteed field name or type to bind to.
2. **Filtering is inconsistent.** The base `adminList()` in `BaseCrudRead` (`base.crud.read.ts:363-365`) hardcodes `where.lifecycleState = status`, causing the filter to silently fail for OwnerPromotion, Sponsorship, and DestinationReview (AccommodationReview already works since it has `lifecycleState`). ~~SPEC-050~~ (deleted) proposed a `statusField` property workaround, but after this spec all 6 entities will have `lifecycleState`, making that approach unnecessary.
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
- Modifying `DestinationReview`'s boolean flags `isPublished` and `isVerified`. These express different semantic concerns (content readiness and moderation trust) and coexist alongside `lifecycleState`. **Note**: These fields currently exist only in the Zod schema (`destinationReview.schema.ts:83,89`) and have NO corresponding DB columns in `destination_review.dbschema.ts`. Adding DB columns for these fields is out of scope for this spec.

---

## Overview and Success Metrics

### Overview

This spec adds or migrates the `lifecycleState` field across 3 entities (OwnerPromotion, Sponsorship, DestinationReview), requiring DB migrations for all 3. AccommodationReview is already fully compliant (has `lifecycleState` in both DB and Zod schema) and only requires verification. It is a breaking change for the API responses of OwnerPromotion (removes `isActive`, adds `lifecycleState`) and Sponsorship (renames `status` to `sponsorshipStatus`, adds `lifecycleState`).

### Success Metrics

- Zero admin UI components that need entity-specific conditional logic to render a lifecycle status badge.
- The base `adminList()` `status` filter works identically for all 6 entities because every entity now has a `lifecycleState` column, matching the hardcoded `where.lifecycleState = status` in `BaseCrudRead`. No `statusField` property is required for these 6 entities (~~SPEC-050~~ deleted).
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
When the admin sends `lifecycleState = DRAFT`,
Then the review's lifecycle state changes to DRAFT,
And `isPublished` and `isVerified` remain unchanged.

#### AC-004-03: Default lifecycleState on review creation is ACTIVE

Given a valid AccommodationReview or DestinationReview creation request without a `lifecycleState` field,
When the review is created,
Then `lifecycleState` defaults to `ACTIVE`.

#### ~~AC-004-04: Archiving a DestinationReview automatically sets isPublished to false~~ **DEFERRED**

> **Moved to Future Considerations (R3).** `isPublished` and `isVerified` exist in the Zod schema (`destinationReview.schema.ts:83,89`) but have **no corresponding DB columns** in `destination_review.dbschema.ts`. A service-level side effect that sets `isPublished = false` cannot be implemented until the DB-Zod sync gap is resolved (adding `is_published` and `is_verified` columns). See Future Considerations for details.

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
And `lifecycleState` is NOT included in the public response body (admin-only field).

**Implementation note**: The filtering is enforced at the service layer via `_executeSearch()` default filters. Public search normalizers must inject `lifecycleState = ACTIVE` into the filter criteria before query execution. This follows the same pattern used by existing entities that have `lifecycleState`.

#### AC-005-02: lifecycleState is admin-only for review entities

Given an authenticated user calling a protected listing endpoint for AccommodationReview or DestinationReview,
When the endpoint returns review data,
Then `lifecycleState` is NOT included in the protected response body,
And the response is otherwise identical in structure to what existed before this spec.

**Rationale**: `lifecycleState` is an administrative management concept. End users do not need visibility into whether their review is in DRAFT, ACTIVE, or ARCHIVED state — that is managed by admins. The existing `isPublished` and `isVerified` booleans on DestinationReview remain the user-facing indicators.

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

### US-007: OwnerPromotion records are automatically archived when validUntil expires

As the platform operator,
I want OwnerPromotions whose `validUntil` date has passed to be automatically archived,
so that expired promotions do not remain in ACTIVE state requiring manual intervention.

**Priority**: Should-have

#### AC-007-01: Background job archives expired promotions

Given an OwnerPromotion with `lifecycleState = ACTIVE` and `validUntil < now`,
When the scheduled expiration job runs,
Then the promotion's `lifecycleState` is set to `ARCHIVED`,
And the change is logged with an audit trail indicating automatic archival.

#### AC-007-02: Admin can reactivate an auto-archived promotion

Given an OwnerPromotion that was automatically archived due to expiration,
When the admin updates `lifecycleState = ACTIVE` and optionally extends `validUntil`,
Then the promotion is reactivated,
And the new `validUntil` is respected by future expiration job runs.

**Implementation note**: This requires a cron job or scheduled task. The existing cron infrastructure in `apps/api` can be extended with a new handler.

**Cron job details:**
- **Implementation pattern**: Must follow the existing `CronJobDefinition` type from `apps/api/src/cron/types.ts`. Reference `addon-expiry.job.ts` as the closest pattern (batch processing of expired records).
- **File**: `apps/api/src/cron/jobs/archive-expired-promotions.job.ts` (new file)
- **Registration**: Add to `apps/api/src/cron/registry.ts` job array
- **Schedule**: `'0 * * * *'` (every hour). Hourly is sufficient because `validUntil` is date-level precision.
- **Name**: `'archive-expired-promotions'`
- **Timeout**: `60_000` (1 minute, simpler than addon-expiry)
- **Dry-run support**: Required. When `ctx.dryRun` is true, return the count of records that WOULD be archived without modifying data.
- **Advisory lock**: Use `pg_try_advisory_lock(43010)` to prevent overlapping runs (follow addon-expiry pattern with lock ID `43010`, next available after `43001`).
  - **Advisory Lock Registry**: Lock ID `43010` is registered for the OwnerPromotion archive cron job. All advisory lock IDs must be documented in `packages/db/docs/advisory-locks.md` (create if not exists). See also: `43001` (addon-expiry, SPEC-064).
- **Query**: `SELECT id FROM owner_promotions WHERE lifecycle_state = 'ACTIVE' AND valid_until IS NOT NULL AND valid_until < NOW() AND deleted_at IS NULL LIMIT 100`
- **Batch size**: Process up to 100 records per run. If more exist, the next hourly run picks them up.
- **Update**: Set `lifecycle_state = 'ARCHIVED'`, `updated_at = NOW()`. For `updated_by_id`, set to `NULL` (system-initiated action). **Note**: There is no `SYSTEM_USER_ID` constant in the codebase. If a system user is created in a future spec, update this handler to use it.
- **Logging**: Log via `@repo/logger` with level `info` and context `{ source: 'cron:archive-expired-promotions', count: N }`.
- **Error handling**: If the batch update fails, log the error via `ctx.logger.error()` and report to Sentry (follow existing pattern). Do NOT retry in the same run.
- **Result**: Return `CronJobResult` with `processed` count and `success` boolean.
- **Admin UI distinction**: The admin UI should display "Auto-archived (expired)" for archived promotions where `validUntil < now`. This is inferred client-side, not stored in DB.

This may be implemented as a follow-up task if cron infrastructure changes are complex.

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

### Phase 1: AccommodationReview (verification only)

AccommodationReview is **already fully compliant** as of the current codebase state:
- DB column `lifecycle_state` exists (`accommodation_review.dbschema.ts:34`)
- Zod schema includes `lifecycleState` via `BaseLifecycleFields` (`accommodationReview.schema.ts:21`)
- Access schemas: Public excludes `lifecycleState`, Protected excludes it, Admin includes it (full schema)
- CRUD schemas: Create omits audit fields but includes `lifecycleState` with default ACTIVE
- Admin search: Inherits `status` from `AdminSearchBaseSchema` normally (no workaround needed)
- Base `adminList()` hardcoded `where.lifecycleState = status` works because the column exists

**Phase 1 work is verification + test coverage only:**

1. Verify `lifecycleState` is present in `AccommodationReviewSchema` via `BaseLifecycleFields` spread. **Already done.**
2. Verify `AccommodationReviewAdminSchema` includes `lifecycleState` (it does: `AdminSchema = AccommodationReviewSchema`). **Already done.**
3. Verify `AccommodationReviewPublicSchema` and `AccommodationReviewProtectedSchema` do NOT include `lifecycleState`. **Already done.**
4. Verify the admin `status` filter works against the `lifecycleState` column via the base `adminList()` logic. **Already works.**
5. Write verification tests confirming the above. This is the only new work.

No DB migration, no schema changes, no service changes required for this phase.

### Phase 2: OwnerPromotion (additive then drop)

1. Write DB migration (up): add `lifecycle_state` column with `NOT NULL DEFAULT 'ACTIVE'` using `LifecycleStatusPgEnum` type, then run a data migration `UPDATE owner_promotions SET lifecycle_state = CASE WHEN is_active THEN 'ACTIVE' ELSE 'ARCHIVED' END`, then drop `is_active` column and its index.
   **Index migration details**: Drop `ownerPromotions_isActive_idx` (on `isActive`) and `ownerPromotions_ownerId_isActive_idx` (composite on `ownerId, isActive`). Add `ownerPromotions_lifecycleState_idx` (on `lifecycleState`) and `ownerPromotions_ownerId_lifecycleState_idx` (composite on `ownerId, lifecycleState`).
2. Write DB migration (down/rollback): add `is_active` column, populate from `lifecycle_state` (`'ACTIVE' -> true`, `'ARCHIVED' -> false`, `'DRAFT' -> false`), drop `lifecycle_state` column, restore original indexes.
3. Update Drizzle DB schema (`owner_promotion.dbschema.ts`) to remove `isActive` column and add `lifecycleState` with `LifecycleStatusPgEnum`.
4. Update Zod base schema (`owner-promotion.schema.ts`) to remove `isActive: z.boolean().default(true)` and add `...BaseLifecycleFields`.
5. Update access schemas (`owner-promotion.access.schema.ts`): remove `isActive` from Public and Protected tier picks, ensure Admin tier includes `lifecycleState`.
6. Update CRUD schemas (`owner-promotion.crud.schema.ts`): remove `isActive` references.
7. Update query schema (`owner-promotion.query.schema.ts`): replace `isActive: z.boolean().optional()` filter with `lifecycleState: LifecycleStatusEnumSchema.optional()`.
8. Update HTTP schema (`owner-promotion.http.schema.ts`): replace `isActive: z.coerce.boolean().default(true)` with `lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional()` in search schemas and `lifecycleState: z.nativeEnum(LifecycleStatusEnum).default('ACTIVE')` in create schemas. Update `httpToDomainOwnerPromotionSearch()` conversion function: remove the `isActive` mapping and add `lifecycleState` passthrough (no conversion needed since it's already an enum string). The remaining HTTP search params (`validFromAfter`, `validUntilAfter`, `discountMin`, etc. at lines 32-57) are unrelated to lifecycle state and remain unchanged.
9. Update admin-search schema (`owner-promotion.admin-search.schema.ts`): remove `isActive: queryBooleanParam()` filter (the base `status` from `AdminSearchBaseSchema` now works directly).
10. **Update model methods** (`ownerPromotion.model.ts`): change `findActiveByAccommodationId` and `findActiveByOwnerId` to use `eq(ownerPromotions.lifecycleState, 'ACTIVE')` instead of `eq(ownerPromotions.isActive, true)`.
11. Update service (`ownerPromotion.service.ts`): remove any `isActive`-specific filter logic. **Important**: the current `_executeSearch()` (line 114-117) does NOT inject `isActive = true` as a default filter .. it passes `filterParams` directly to `model.findAll()`. After this migration, `_executeSearch()` MUST inject `lifecycleState = 'ACTIVE'` into `filterParams` when the caller does not already specify a `lifecycleState` value. This ensures AC-005-01 compliance (public endpoints only return ACTIVE records). Implementation: add `if (!filterParams.lifecycleState) { filterParams.lifecycleState = 'ACTIVE'; }` before the `model.findAll()` call. The admin path uses `adminList()` which has its own status filter, so this injection only affects public/protected `list()` calls.
12. Update API routes (admin, protected, public): remove `isActive` references in handlers and response schemas.
13. **Update `apps/api/src/services/usage-tracking.service.ts`** (line 406): replace `isActive: true` with `lifecycleState: 'ACTIVE'` in the `MAX_ACTIVE_PROMOTIONS` count query for `OwnerPromotionService.count()`.
14. **Update `apps/api/src/middlewares/limit-enforcement.ts`** (line 318): replace `isActive: true` with `lifecycleState: 'ACTIVE'` in the promotion count query for `OwnerPromotionService.count()`.
15. Update admin frontend: replace `togglePromotionActive()` hook (`apps/admin/src/features/owner-promotions/hooks.ts`) with lifecycle state update. Replace boolean toggle widget in column config (`owner-promotions.columns.ts:144-167`) with standard lifecycle status badge/select.
16. Update all tests.

### Phase 3: Sponsorship (rename + add)

1. Write DB migration (up): add `lifecycle_state` column with `NOT NULL DEFAULT 'ACTIVE'` using `LifecycleStatusPgEnum` type, rename `status` column to `sponsorship_status` (via add-copy-drop pattern: add `sponsorship_status` column with same `SponsorshipStatusPgEnum` type, copy data `UPDATE sponsorships SET sponsorship_status = status`, drop `status` column). **Important**: The PG enum type `SponsorshipStatusPgEnum` remains unchanged .. only the column name changes. **Default values note**: `lifecycleState` defaults to `ACTIVE` and `sponsorshipStatus` defaults to `pending`. These are intentionally independent .. a new sponsorship starts with `lifecycleState = ACTIVE` (visible in the system) and `sponsorshipStatus = pending` (awaiting approval). **Index migration**: Drop `sponsorships_status_idx`. Add `sponsorships_sponsorshipStatus_idx` (on `sponsorship_status`) and `sponsorships_lifecycleState_idx` (on `lifecycle_state`).
2. Write DB migration (down/rollback): add `status` column with `SponsorshipStatusPgEnum`, copy data from `sponsorship_status`, drop `sponsorship_status`, drop `lifecycle_state`, restore `sponsorships_status_idx`.
3. Update Drizzle DB schema (`sponsorship.dbschema.ts`) to add `lifecycleState` with `LifecycleStatusPgEnum` and rename `status` column to `sponsorshipStatus` (keeping `SponsorshipStatusPgEnum` type).
4. Update Zod base schema (`sponsorship.schema.ts`): rename `status` field to `sponsorshipStatus`, add `...BaseLifecycleFields`.
5. Update access schemas (`sponsorship.access.schema.ts`): replace `status` picks with `sponsorshipStatus`, add `lifecycleState` to admin tier. Verify Public/Protected tiers include `sponsorshipStatus` (replaces `status`) but NOT `lifecycleState`.
6. Update CRUD schemas (`sponsorship.crud.schema.ts`): rename `status` to `sponsorshipStatus`.
7. Update query schema (`sponsorship.query.schema.ts`): rename `status` filter to `sponsorshipStatus`, add `lifecycleState` filter.
8. Update HTTP schema (`sponsorship.http.schema.ts`): rename `status` to `sponsorshipStatus` in search/create schemas, update conversion functions.
9. Update admin-search schema (`sponsorship.admin-search.schema.ts`): the `sponsorshipStatus` filter already exists (line 24). Remove the `_executeAdminSearch` remapping logic from the service since the DB column now matches the schema field name. Add `lifecycleState` filter support via base `status` from `AdminSearchBaseSchema`.
10. **Update model methods** (`sponsorship.model.ts`): (a) Rename `findByStatus(status)` to `findBySponsorshipStatus(sponsorshipStatus)` and update the internal query from `eq(sponsorships.status, status)` to `eq(sponsorships.sponsorshipStatus, sponsorshipStatus)`. (b) Update `findActiveByTarget()` to use BOTH conditions: `eq(sponsorships.sponsorshipStatus, 'active')` AND `eq(sponsorships.lifecycleState, 'ACTIVE')`. An archived sponsorship must not be returned even if its domain status is still 'active' (consistent with AC-003-02: archiving hides from public listings).
11. Update service (`sponsorship.service.ts`): remove `_executeAdminSearch` override that remaps `sponsorshipStatus -> status` (lines 168-184, no longer needed after column rename). The base `adminList()` handles `lifecycleState` filtering.
12. Update API routes: rename `status` references to `sponsorshipStatus` in handlers and response schemas.
13. Update admin frontend: rename `status` references to `sponsorshipStatus` in sponsorship components. Add lifecycle status filter.
14. **Update `apps/admin/src/features/sponsorships/hooks/useSponsorshipQueries.ts`**: rename `status` to `sponsorshipStatus` in the `updateSponsorshipStatus()` function (line 96: `body: { status }` -> `body: { sponsorshipStatus }`) and the mutation type (line 170: `{ id: string; status: string }` -> `{ id: string; sponsorshipStatus: string }`).
15. **Permissions clarification**: The existing `SPONSORSHIP_STATUS_MANAGE` permission (`sponsorship.status.manage`) continues to govern `sponsorshipStatus` changes (domain workflow transitions). Standard `lifecycleState` changes (DRAFT/ACTIVE/ARCHIVED) fall under the entity's general `SPONSORSHIP_UPDATE` permission, consistent with how other entities handle lifecycle state. No permission enum changes are required.
16. Update all tests.

### Phase 4: DestinationReview (new column)

DestinationReview does NOT have `lifecycle_state` in the database (confirmed via codebase audit of `destination_review.dbschema.ts`). It also does NOT have `lifecycleState` in the Zod schema (no `BaseLifecycleFields` import). This requires a real DB migration and full schema changes.

1. Write DB migration (up): add `lifecycle_state` column with `NOT NULL DEFAULT 'ACTIVE'` using `LifecycleStatusPgEnum` type. All existing rows get `'ACTIVE'`.
2. Write DB migration (down/rollback): drop `lifecycle_state` column.
3. Update Drizzle DB schema (`destination_review.dbschema.ts`) to add `lifecycleState` with `LifecycleStatusPgEnum`. Add index `destinationReviews_lifecycleState_idx`.
4. Update Zod base schema (`destinationReview.schema.ts`): add `...BaseLifecycleFields` import and spread. Keep `isPublished` and `isVerified` as-is.
5. Update CRUD schemas (`destinationReview.crud.schema.ts`): ensure `lifecycleState` is available in create/update inputs (via base schema, omit only audit fields).
6. Update access schemas (`destinationReview.access.schema.ts`): add `lifecycleState` to Admin tier ONLY. Do NOT add to Public or Protected tiers.
7. Update admin-search schema (`destinationReview.admin-search.schema.ts`): **remove the `z.unknown().transform(() => 'all')` workaround** (lines 68-71). The base `status` from `AdminSearchBaseSchema` now maps correctly to `lifecycleState`.
8. Update query schema (`destinationReview.query.schema.ts`): add `lifecycleState: LifecycleStatusEnumSchema.optional()` filter.
9. Update HTTP schema (`destinationReview.http.schema.ts`): add `lifecycleState` support.
10. ~~Update service (`destinationReview.service.ts`): add `_beforeUpdate()` hook that sets `isPublished = false` when `lifecycleState` changes to `ARCHIVED`.~~ **DEFERRED** (AC-004-04 moved to Future Considerations .. `isPublished` has no DB column yet).
11. Update API routes (admin): ensure admin response includes `lifecycleState`.
12. Update admin frontend: add lifecycle status filter to DestinationReview list.
13. Update all tests.

### Execution Order

Phases should be executed sequentially, with each phase tested and deployed independently before moving to the next. This limits the blast radius of any rollback.

Recommended order: Phase 1 (no DB risk) -> Phase 2 -> Phase 4 -> Phase 3 (most complex).

### Seed Data

No seed files currently create OwnerPromotion or Sponsorship records (confirmed via codebase audit). The seed package (`packages/seed/`) creates SponsorshipLevel and PostSponsorship records but not the entities affected by this spec. Therefore, no seed file changes are required for the DB migrations. If seed files are added in the future, they must use `lifecycleState` instead of `isActive` or `status`.

---

## Rollback Strategy

Each DB migration must include a complete `down` migration. The project uses Drizzle, which generates forward-only migrations by default. The `down` migrations must be written as separate SQL files following the `manual/` migration pattern documented in `packages/db/docs/triggers-manifest.md`.

For OwnerPromotion and Sponsorship, the rollback restores the original column names and types using the add-copy-drop pattern in reverse. Data integrity is preserved because the mapping is lossless in both directions (true/false to ACTIVE/ARCHIVED, and status value to sponsorshipStatus value are identity transformations).

AccommodationReview rollback: No rollback needed. AccommodationReview was already compliant before this spec. Phase 1 only adds tests.

DestinationReview rollback: drop the `lifecycle_state` column. Existing data for that column is lost if records were created between deploy and rollback. Rollback window should be minimized.

---

## Deployment Strategy

This spec introduces **breaking API changes** for OwnerPromotion (`isActive` removed) and Sponsorship (`status` renamed to `sponsorshipStatus`). The strategy is **immediate breaking change** (no transition period, no dual field support).

**Justification**: The admin frontend is the only known API consumer for these entities and is deployed in the same release as the API. There are no documented external integrations. The project is pre-production.

### Per-Phase Deployment Order

Each phase is deployed independently in this sequence:

1. **DB migration** runs first (adds columns, migrates data)
2. **API code** deploys (schema changes, service changes, route changes)
3. **Admin frontend** deploys (UI changes)

For Vercel deployments, API and admin are separate apps. The API must deploy and be healthy BEFORE the admin frontend deploy begins.

### Pre-Migration Validation Queries

Before running each DB migration, execute these validation queries to confirm data integrity:

**Phase 2 (OwnerPromotion)**:
```sql
-- Verify all is_active values are non-null booleans (no unexpected state)
SELECT COUNT(*) AS total, 
       COUNT(CASE WHEN is_active IS NULL THEN 1 END) AS null_count
FROM owner_promotions;
-- Expected: null_count = 0 (NOT NULL constraint should guarantee this)
```

**Phase 3 (Sponsorship)**:
```sql
-- Verify all status values are valid SponsorshipStatusEnum members
SELECT status, COUNT(*) FROM sponsorships GROUP BY status;
-- Expected: only 'pending', 'active', 'expired', 'cancelled'
-- Any unexpected value will cause the PG enum column copy to fail
```

**Phase 4 (DestinationReview)**:
```sql
-- Count existing rows (all will get lifecycle_state = 'ACTIVE')
SELECT COUNT(*) FROM destination_reviews;
-- No validation needed beyond confirming row count for post-migration verification
```

### Post-Migration Verification

After each phase migration, verify:
```sql
-- Phase 2: All OwnerPromotions have valid lifecycle_state
SELECT lifecycle_state, COUNT(*) FROM owner_promotions GROUP BY lifecycle_state;
-- Expected: only 'ACTIVE' and 'ARCHIVED', counts match pre-migration true/false counts

-- Phase 3: All Sponsorships have lifecycle_state AND sponsorship_status
SELECT lifecycle_state, COUNT(*) FROM sponsorships GROUP BY lifecycle_state;
SELECT sponsorship_status, COUNT(*) FROM sponsorships GROUP BY sponsorship_status;
-- Expected: all lifecycle_state = 'ACTIVE'; sponsorship_status distribution matches pre-migration status

-- Phase 4: All DestinationReviews have lifecycle_state
SELECT lifecycle_state, COUNT(*) FROM destination_reviews GROUP BY lifecycle_state;
-- Expected: all 'ACTIVE'
```

---

## Scope

### In Scope

- `OwnerPromotion`: Remove `isActive` boolean, add `lifecycleState: LifecycleStatusEnum`. DB migration required.
- `Sponsorship`: Add `lifecycleState: LifecycleStatusEnum`, rename `status` to `sponsorshipStatus: SponsorshipStatusEnum`. DB migration required.
- `AccommodationReview`: Already fully compliant (DB column + Zod schema + access schemas). Phase 1 is verification + test coverage only.
- `DestinationReview`: Add `lifecycleState: LifecycleStatusEnum`. DB migration required. Keep `isPublished` and `isVerified` as-is.
- Zod schemas for all 4 entities: base schema, CRUD schemas, access schemas, admin-search schemas, query schemas.
- Drizzle DB schemas for OwnerPromotion, Sponsorship, DestinationReview.
- Service filter logic: after this spec, the base `adminList()` hardcoded `where.lifecycleState = status` works for all entities. No `statusField` property needed (~~SPEC-050~~ deleted).
- Admin route response schemas: update any route still referencing the old field names.
- Admin frontend: OwnerPromotion detail view toggle control, Sponsorship filter controls.
- DB migration files with both up and down paths.
- Tests: schema tests, service tests, integration/route tests, migration tests.
- OwnerPromotion auto-archive background job: cron handler that archives promotions with `validUntil < now` and `lifecycleState = ACTIVE`.
- ~~DestinationReview service-level side effect: archiving sets `isPublished = false` automatically.~~ **DEFERRED** to Future Considerations (R3) .. `isPublished` has no DB column.

### Out of Scope

- `PostSponsor` and `Tag`: already use `lifecycleState`. No changes needed.
- Any entity outside the 6 SPEC-057 entities.
- Changing `LifecycleStatusEnum` values.
- Removing `SponsorshipStatusEnum`.
- Changing how `isPublished` or `isVerified` work on DestinationReview.
- Public API version negotiation or formal API versioning infrastructure.
- Admin dashboard real-time state sync after lifecycle state changes (covered by existing patterns).
- Timezone handling policy for lifecycle state changes (all timestamps follow the existing project convention: stored as `timestamptz` in PostgreSQL, serialized as ISO 8601 UTC in API responses, converted to user's local timezone by the frontend for display).

### Future Considerations

- After this spec, all 6 SPEC-057 entities have `lifecycleState`, making the base `adminList()` hardcoded check work universally. A future spec could formalize this by making `lifecycleState` a required column in the base table definition, ensuring any new entity automatically includes it. If a future entity legitimately cannot use `lifecycleState`, a new spec should be written to add configurable field mapping (the approach ~~SPEC-050~~ proposed, now deleted).
- A future spec could add audit trail entries when `lifecycleState` changes (who changed it and when), useful for compliance.
- **DestinationReview `isPublished`/`isVerified` DB-Zod sync + archival side effect (deferred from AC-004-04)**: The fields `isPublished` and `isVerified` exist in the Zod schema (`destinationReview.schema.ts:83,89`) but have **no corresponding DB columns** in `destination_review.dbschema.ts`. A future spec should: (1) add `is_published BOOLEAN NOT NULL DEFAULT false` and `is_verified BOOLEAN NOT NULL DEFAULT false` columns to the `destination_reviews` table, (2) implement the AC-004-04 side effect: `DestinationReviewService._beforeUpdate()` sets `isPublished = false` when `lifecycleState` changes to `ARCHIVED` (the reverse does NOT auto-restore). Until the DB columns exist, this side effect cannot be implemented.

---

## Dependencies

| Dependency | Type | Blocking? | Notes |
|------------|------|-----------|-------|
| GAP-057-022 (DB-Zod sync for AccommodationReview) | Upstream | No (already resolved) | **Resolved**: AccommodationReview already has `lifecycleState` in both DB (`accommodation_review.dbschema.ts:34`) and Zod schema (via `BaseLifecycleFields` in `accommodationReview.schema.ts:21`). Access schemas already exclude it from Public/Protected. No work needed. |
| GAP-057-023 (DB-Zod sync for DestinationReview) | Upstream | No | DestinationReview needs a new DB column regardless. GAP-023 adds `averageRating` to Zod; this spec adds `lifecycleState`. They can run in parallel or sequentially. |
| ~~SPEC-050 (Lifecycle State Modeling)~~ | ~~Upstream~~ | ~~No~~ | **DELETED in R6**: SPEC-050 proposed a configurable `statusField` property as an alternative approach. After analysis, SPEC-063's standardization approach was chosen and SPEC-050 was deleted as it was fully superseded. No residual items from SPEC-050 need implementation. |
| SPEC-062 Phase 0 (Access Schema Relation Audit & Extension) | Upstream | **Yes** | **Depends on**: SPEC-062 Phase 0 (Access Schema Relation Audit & Extension) -- AdminSchema access schemas must include `lifecycleState` before this spec adds the DB columns, otherwise runtime response enforcement (SPEC-062 Phase 1) will strip the new field from admin responses. |
| Drizzle migration tooling | Infrastructure | Yes | The DB migration phases require `pnpm db:generate` (runs `drizzle-kit generate` to create SQL migration files) and `pnpm db:migrate` (runs `drizzle-kit push` for dev environments). **Important**: `pnpm db:migrate` maps to `drizzle-kit push`, which applies schema changes directly without using generated migration files. For production deployments, the generated SQL migration files must be applied via `drizzle-kit migrate` (not `push`). The down/rollback migrations must be written manually as Drizzle generates forward-only migrations. |

---

## Execution Order & Agent Safety Guide

> **For agents**: Read this section before implementing. If prerequisites are not met, STOP and report to the user.

### Prerequisites

- **SPEC-062 Phase 0** (Access Schema Extensions): **MUST be merged to `main`** before starting SPEC-063. Phase 0 adds `lifecycleState` to AdminSchema access schemas. Without this, runtime response enforcement (SPEC-062 Phase 1) would strip the new `lifecycleState` field from admin responses.

### Pre-Conditions (MUST verify before starting)

- [ ] SPEC-062 Phase 0 is **merged to `main`**
- [ ] AdminSchema for OwnerPromotion, Sponsorship, DestinationReview includes `lifecycleState` field
- [ ] `pnpm typecheck` passes on clean `main`

**If SPEC-062 Phase 0 is NOT merged: STOP. Do not start SPEC-063. Report to the user that Phase 0 must land first.**

### Position in the Dependency Graph

```
SPEC-062 Phase 0 ── MUST complete first (schemas include lifecycleState)
    │
    └──► SPEC-063 (THIS SPEC) ── adds DB columns + service logic
              │
              └──► SPEC-062 Phase 1 ── BLOCKED until this spec AND SPEC-066 are merged
```

### What Happens If Order Is Wrong

| Wrong Order | Consequence |
|------------|-------------|
| SPEC-063 before SPEC-062 Phase 0 | `lifecycleState` exists in DB but AdminSchema doesn't include it. When SPEC-062 Phase 1 enables runtime stripping, admin responses lose `lifecycleState`. |
| SPEC-062 Phase 1 before SPEC-063 | Phase 1 enforces stripping. If SPEC-063 hasn't added `lifecycleState` to entities yet, the AdminSchema extension from Phase 0 references a non-existent field. Zod `.safeParse()` may strip it or error. |

### Parallel Safety

| Spec | Conflict Risk | Details |
|------|--------------|---------|
| SPEC-051-055 | None | Different layers entirely. |
| SPEC-058-061 | None | Transaction chain doesn't touch lifecycle state columns. |
| SPEC-054 | Low | SPEC-054 builds filter UI. After SPEC-063 merges, 6 entities gain `lifecycleState` and need filter configs added (follow-up task, not a conflict). |
| SPEC-059 | None | SPEC-059 threads `ctx` through services. SPEC-063 adds `lifecycleState` field and migration logic. Orthogonal changes. |
| SPEC-062 | **Sequenced** | Phase 0 BEFORE this spec. Phase 1 AFTER this spec. See deployment sequence. |
| SPEC-066 | None | Different scope. SPEC-066 adds relation loading to getById. No shared files. |

### Deployment Sequence Context

```
1. SPEC-062 Phase 0  ── schemas extended with lifecycleState ✓
2. SPEC-063 (THIS)   ── DB migrations + service logic
3. SPEC-066           ── getById relation loading (parallel-safe with this spec)
4. SPEC-062 Phase 1   ── runtime enforcement enabled (LAST)
```

### Agent Instructions

1. **FIRST**: Verify SPEC-062 Phase 0 is merged (check AdminSchema includes `lifecycleState`)
2. Implement by phase: Phase 1 (AccommodationReview verification), Phase 2 (OwnerPromotion migration), Phase 3 (Sponsorship migration)
3. For each migration: add column → copy data → drop old column → update indexes
4. Update service layer: inject `lifecycleState = ACTIVE` default in public/protected queries
5. Add cron job for OwnerPromotion auto-archive (lock ID `43010`)
6. Run `pnpm typecheck && pnpm test && pnpm db:generate`
7. Merge to `main`

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data loss during OwnerPromotion migration if `is_active` has a third state not representable by `LifecycleStatusEnum` | Low | High | Verify before migration that the column is a strict boolean. The mapping `true -> ACTIVE`, `false -> ARCHIVED` is lossless and covers all values. |
| Sponsorship consumers (external or internal) break on the `status -> sponsorshipStatus` rename | Medium | High | Audit all callers of `SponsorshipSchema.status` before deployment. Update admin frontend in the same deploy. Check if any seed scripts or external integrations read the field name. |
| DestinationReview gains a `lifecycleState` column but the `isPublished` boolean creates semantic ambiguity (a review could be `ACTIVE` + `isPublished = false`) | Medium | Medium | `lifecycleState` controls system-level lifecycle management (CRUD, bulk archive); `isPublished` controls content visibility. **Note (R3)**: `isPublished` and `isVerified` currently have NO DB columns (Zod-only fields). The archival side effect (AC-004-04) is deferred to Future Considerations until the DB-Zod sync gap is resolved. Until then, the semantic ambiguity is theoretical since `isPublished` defaults to `false` and is never persisted. |
| OwnerPromotion auto-archive via background job adds infrastructure complexity | Medium | Medium | The cron handler follows the existing pattern in `apps/api` cron infrastructure. If cron changes prove complex, this can be deferred to a follow-up task while the rest of SPEC-063 ships. The admin UI shows "Auto-archived (expired)" as visual distinction. |
| Rollback window for DestinationReview if new records are created between deploy and rollback | Low | Medium | Minimize rollback window. Phase 4 is last in the recommended execution order, by which point Phase 1-3 are stable. |
| Admin frontend shipping before API migration is complete in multi-step deploy | Low | High | Deploy API changes per entity before the frontend component changes. Use feature flags if needed for the Sponsorship rename. |
| SPEC-062 not deployed before SPEC-063 causes admin field stripping | Medium | High | SPEC-062's `.safeParse()` will strip `lifecycleState` from admin responses if AdminSchema doesn't include the field. Mitigation: SPEC-063's own Phase 2/3/4 schema updates add `lifecycleState` to Admin tier access schemas, so this risk only applies if SPEC-062 Phase 0 runs independently with incomplete field definitions. |
| SPEC-059 hook signature mismatch if implemented concurrently | Low | Medium | If SPEC-059 and SPEC-063 modify the same service hooks simultaneously, signatures may conflict. Mitigation: implement sequentially or coordinate on the same branch. |

---

## Test Plan

### Phase 1: AccommodationReview (verification tests only)

All tests below verify EXISTING behavior (no code changes needed, only new test files):

- **Schema tests**: Verify `lifecycleState` field exists in `AccommodationReviewSchema` via `BaseLifecycleFields`, accepts DRAFT/ACTIVE/ARCHIVED, defaults to ACTIVE
- **CRUD schema tests**: Verify `CreateInput` and `UpdateInput` accept `lifecycleState` (create omits audit fields but NOT lifecycleState)
- **Access schema tests**: Verify `AccommodationReviewPublicSchema` does NOT include `lifecycleState`; `AccommodationReviewProtectedSchema` does NOT include `lifecycleState`; `AccommodationReviewAdminSchema` DOES include `lifecycleState`
- **Admin search tests**: Verify status filter maps correctly to `lifecycleState` column via the base `adminList()` hardcoded check

### Phase 2: OwnerPromotion (DB migration)

- **Migration tests**: Verify `is_active = true` maps to `lifecycle_state = 'ACTIVE'`; `is_active = false` maps to `lifecycle_state = 'ARCHIVED'`
- **Rollback tests**: Verify `lifecycle_state = 'ACTIVE'` maps back to `is_active = true`; `lifecycle_state = 'ARCHIVED'` maps back to `is_active = false`
- **Schema tests**: `isActive` field no longer exists; `lifecycleState` field exists with correct type and default
- **CRUD tests**: Create without lifecycleState defaults to ACTIVE; update accepts lifecycleState; update rejects `isActive` with validation error
- **Index tests**: Verify `ownerPromotions_lifecycleState_idx` and `ownerPromotions_ownerId_lifecycleState_idx` exist after migration
- **Model method tests**: `findActiveByAccommodationId` and `findActiveByOwnerId` return only records with `lifecycleState = ACTIVE` (not using `isActive`)
- **Admin search tests**: status filter works for DRAFT, ACTIVE, ARCHIVED; `isActive` filter no longer accepted
- **Usage tracking test**: `usage-tracking.service.ts` counts promotions using `lifecycleState: 'ACTIVE'` (not `isActive: true`)
- **Limit enforcement test**: `limit-enforcement.ts` counts promotions using `lifecycleState: 'ACTIVE'` (not `isActive: true`)

### Phase 3: Sponsorship (rename + add)

- **Migration tests**: `status` values preserved in `sponsorship_status`; `lifecycle_state` defaults to ACTIVE for all rows
- **Rollback tests**: `sponsorship_status` values restored to `status`; `lifecycle_state` dropped
- **Schema tests**: `status` field no longer exists; `sponsorshipStatus` exists with `SponsorshipStatusEnum` type; `lifecycleState` exists with `LifecycleStatusEnum` type
- **CRUD tests**: Update accepts both `lifecycleState` and `sponsorshipStatus`; update rejects `status` (old name) with validation error
- **Independence test**: Changing `lifecycleState` does not affect `sponsorshipStatus` and vice versa
- **Admin search tests**: status filter maps to `lifecycleState`; `sponsorshipStatus` filter operates independently
- **Index tests**: Verify `sponsorships_sponsorshipStatus_idx` and `sponsorships_lifecycleState_idx` exist after migration
- **Frontend hook test**: `useSponsorshipQueries.ts` sends `sponsorshipStatus` (not `status`) in PATCH body

### Phase 4: DestinationReview (new column)

- **Migration tests**: New column `lifecycle_state` exists with NOT NULL DEFAULT 'ACTIVE'; all existing rows have 'ACTIVE'
- **Rollback tests**: Column is dropped cleanly
- **Schema tests**: `lifecycleState` field exists; `isPublished` and `isVerified` still exist and are unchanged
- **CRUD tests**: Create defaults to ACTIVE; update accepts lifecycleState
- ~~**Side effect test**: Setting `lifecycleState = ARCHIVED` automatically sets `isPublished = false`; setting `lifecycleState = ACTIVE` does NOT auto-restore `isPublished`~~ **DEFERRED** (AC-004-04, `isPublished` has no DB column)
- **Access schema tests**: `DestinationReviewPublicSchema` does NOT include `lifecycleState`; `DestinationReviewProtectedSchema` does NOT include `lifecycleState`; `DestinationReviewAdminSchema` DOES include `lifecycleState`
- **Admin search tests**: status filter now works (workaround removed); filters by DRAFT, ACTIVE, ARCHIVED correctly

### Cross-cutting

- **Admin UI tests**: OwnerPromotion detail shows DRAFT/ACTIVE/ARCHIVED select instead of boolean toggle; Sponsorship list has both lifecycle and sponsorshipStatus filter controls
- **Public endpoint tests**: All 4 entities return only ACTIVE records on public endpoints; lifecycleState field is NOT present in public/protected response bodies
- **Regression tests**: All existing tests for PostSponsor and Tag continue to pass unchanged

---

## Affected Files (Expected)

This list is indicative. The tech analysis phase will produce the definitive inventory.

### Packages / schemas

- `packages/schemas/src/entities/accommodationReview/accommodationReview.schema.ts` - **NO CHANGES** (already has `lifecycleState` via `BaseLifecycleFields`)
- `packages/schemas/src/entities/accommodationReview/accommodationReview.crud.schema.ts` - **NO CHANGES** (already includes `lifecycleState`)
- `packages/schemas/src/entities/accommodationReview/accommodationReview.access.schema.ts` - **NO CHANGES** (already excludes from Public/Protected, includes in Admin)
- `packages/schemas/src/entities/accommodationReview/accommodationReview.admin-search.schema.ts` - **NO CHANGES** (inherits `status` from `AdminSearchBaseSchema` normally)
- `packages/schemas/src/entities/destinationReview/destinationReview.schema.ts` - add `lifecycleState`
- `packages/schemas/src/entities/destinationReview/destinationReview.crud.schema.ts` - allow `lifecycleState` in create/update
- `packages/schemas/src/entities/destinationReview/destinationReview.access.schema.ts` - add `lifecycleState` to admin tier ONLY (not public, not protected)
- `packages/schemas/src/entities/destinationReview/destinationReview.admin-search.schema.ts` - remove `z.unknown().transform(() => 'all')` workaround
- `packages/schemas/src/entities/destinationReview/destinationReview.query.schema.ts` - add `lifecycleState: LifecycleStatusEnumSchema.optional()` filter
- `packages/schemas/src/entities/destinationReview/destinationReview.http.schema.ts` - add `lifecycleState` support to HTTP search/create schemas
- `packages/schemas/src/entities/ownerPromotion/owner-promotion.schema.ts` - remove `isActive`, add `lifecycleState`
- `packages/schemas/src/entities/ownerPromotion/owner-promotion.crud.schema.ts` - update accordingly
- `packages/schemas/src/entities/ownerPromotion/owner-promotion.access.schema.ts` - update public/protected/admin picks
- `packages/schemas/src/entities/ownerPromotion/owner-promotion.admin-search.schema.ts` - remove `isActive: queryBooleanParam()` filter (base `status` from `AdminSearchBaseSchema` now works)
- `packages/schemas/src/entities/ownerPromotion/owner-promotion.query.schema.ts` - replace `isActive: z.boolean().optional()` with `lifecycleState: LifecycleStatusEnumSchema.optional()`
- `packages/schemas/src/entities/ownerPromotion/owner-promotion.http.schema.ts` - replace `isActive` with `lifecycleState` in search/create schemas and conversion functions
- `packages/schemas/src/entities/sponsorship/sponsorship.schema.ts` - add `lifecycleState`, rename `status` to `sponsorshipStatus`
- `packages/schemas/src/entities/sponsorship/sponsorship.crud.schema.ts` - update accordingly
- `packages/schemas/src/entities/sponsorship/sponsorship.access.schema.ts` - update picks
- `packages/schemas/src/entities/sponsorship/sponsorship.admin-search.schema.ts` - `sponsorshipStatus` already exists (line 24). Remove comment about collision since DB column now matches. Base `status` from `AdminSearchBaseSchema` now maps to `lifecycleState`.
- `packages/schemas/src/entities/sponsorship/sponsorship.query.schema.ts` - rename `status` filter to `sponsorshipStatus`, add `lifecycleState` filter
- `packages/schemas/src/entities/sponsorship/sponsorship.http.schema.ts` - rename `status` to `sponsorshipStatus` in search/create schemas, update conversion functions

### Packages / db

- `packages/db/src/schemas/owner-promotion/owner_promotion.dbschema.ts` - remove `isActive`, add `lifecycleState`, update indexes
- `packages/db/src/schemas/sponsorship/sponsorship.dbschema.ts` - rename `status` to `sponsorshipStatus`, add `lifecycleState`
- `packages/db/src/schemas/destination/destination_review.dbschema.ts` - add `lifecycleState`
- `packages/db/src/models/owner-promotion/ownerPromotion.model.ts` - update `findActiveByAccommodationId` (line 85: `eq(ownerPromotions.isActive, true)` -> `eq(ownerPromotions.lifecycleState, 'ACTIVE')`) and `findActiveByOwnerId` (line 127: same change)
- `packages/db/src/models/sponsorship/sponsorship.model.ts` - rename `findByStatus()` to `findBySponsorshipStatus()`, update `findActiveByTarget()` to filter by BOTH `sponsorshipStatus = 'active'` AND `lifecycleState = 'ACTIVE'`
- DB migration files for the 3 entities requiring DB changes

### Packages / service-core

- `packages/service-core/src/services/owner-promotion/ownerPromotion.service.ts` - remove any `isActive`-specific filter logic. Base `adminList()` works directly.
- `packages/service-core/src/services/sponsorship/sponsorship.service.ts` - remove `_executeAdminSearch` override that remaps `sponsorshipStatus -> status` (lines 168-184, no longer needed after DB column rename). Base `adminList()` works directly.
- `packages/service-core/src/services/accommodationReview/accommodationReview.service.ts` - **NO CHANGES** (already works with base `adminList()`)
- `packages/service-core/src/services/destinationReview/destinationReview.service.ts` - ~~add `_beforeUpdate()` hook for isPublished side effect on archival~~ **DEFERRED** (AC-004-04, no DB column for `isPublished`). Remove DestinationReview admin-search `status` workaround dependency. Base `adminList()` works directly.

### Apps / api

- Admin and public/protected routes for OwnerPromotion, Sponsorship, and DestinationReview that reference old field names in response schemas or handlers. AccommodationReview routes need no changes. Specific route files to audit: `apps/api/src/routes/admin/owner-promotion/`, `apps/api/src/routes/admin/sponsorship/`, `apps/api/src/routes/admin/destination-review/`, and their public/protected counterparts.
- `apps/api/src/cron/jobs/archive-expired-promotions.job.ts` - new cron handler following `CronJobDefinition` pattern
- `apps/api/src/cron/registry.ts` - register new cron job
- `apps/api/src/services/usage-tracking.service.ts` - replace `isActive: true` with `lifecycleState: 'ACTIVE'` in `MAX_ACTIVE_PROMOTIONS` count (line 406)
- `apps/api/src/middlewares/limit-enforcement.ts` - replace `isActive: true` with `lifecycleState: 'ACTIVE'` in promotion count (line 318)

### Test files and fixtures

- `packages/schemas/test/fixtures/ownerPromotion.fixtures.ts` - replace `isActive` references with `lifecycleState`
- `packages/schemas/test/fixtures/sponsorship.fixtures.ts` - rename `status` to `sponsorshipStatus`
- `packages/schemas/test/entities/ownerPromotion/owner-promotion.schema.test.ts` - update `isActive` tests to `lifecycleState`
- `packages/schemas/test/entities/ownerPromotion/owner-promotion.crud.schema.test.ts` - update `isActive` references
- `packages/schemas/test/entities/ownerPromotion/owner-promotion.admin-search.schema.test.ts` - replace `isActive` boolean filter tests with `lifecycleState` enum tests
- `packages/schemas/test/entities/admin-search/group-c.admin-search.schema.test.ts` - update OwnerPromotionAdminSearchSchema test expectations

### i18n

- `packages/i18n/` locale files - update `admin-billing.ownerPromotions.actionActivate` and `admin-billing.ownerPromotions.actionDeactivate` keys to reflect lifecycle state transitions (e.g., `actionSetDraft`, `actionSetActive`, `actionSetArchived`). Update `admin-billing.ownerPromotions.statuses.inactive` to `admin-billing.ownerPromotions.statuses.draft` and add `admin-billing.ownerPromotions.statuses.archived`.

### Apps / admin (frontend)

- `apps/admin/src/features/owner-promotions/config/owner-promotions.columns.ts` - replace `isActive` status widget (lines 144-167) with standard lifecycle badge
- `apps/admin/src/features/owner-promotions/config/owner-promotions.config.ts` - update entity config for lifecycle state
- `apps/admin/src/features/owner-promotions/hooks.ts` - remove `togglePromotionActive()` function, replace with lifecycle state update mutation
- `apps/admin/src/features/owner-promotions/config/owner-promotions.admin-search.schema.ts` (if exists) - remove `isActive` filter
- `apps/admin/src/routes/_authed/sponsor/sponsorships.tsx` - rename `sponsorshipStatus` filter references (already using `sponsorshipStatus` at line 37)
- `apps/admin/src/routes/_authed/billing/sponsorships.tsx` - rename `status` references to `sponsorshipStatus`
- `apps/admin/src/features/sponsorships/` components - update any `status` references to `sponsorshipStatus`
- `apps/admin/src/features/sponsorships/hooks/useSponsorshipQueries.ts` - rename `status` to `sponsorshipStatus` in `updateSponsorshipStatus()` function (line 96) and mutation type (line 170)
- `apps/admin/src/features/sponsorships/components/SponsorshipsTab.tsx` - rename `status` references to `sponsorshipStatus`
- `apps/admin/src/features/sponsorships/types.ts` - update type definitions for renamed field
- Shared lifecycle status badge/filter components if they need entity-specific logic today.

---

## Revision History

| Revision | Date | Changes |
|----------|------|---------|
| R1 | 2026-04-02 | **Exhaustive review pass 1**: (1) Fixed AccommodationReview Problem Statement row — DB column exists, only Zod schema missing. (2) Added AC-004-04: archiving DestinationReview auto-sets isPublished=false. (3) Added US-007: OwnerPromotion auto-archive via background job when validUntil expires. (4) Clarified lifecycleState is admin-only tier for review entities (AC-005-01, AC-005-02 updated). (5) Added detailed index migration for Phase 2 (OwnerPromotion) and Phase 3 (Sponsorship). (6) Fixed AccommodationReview admin-search note in Affected Files (workaround is on DestinationReview, not AccommodationReview). (7) Added Seed Data section confirming no seed changes needed. (8) Added Cross-Spec Coordination section (SPEC-050, SPEC-062, SPEC-057). (9) Added detailed Test Plan with per-phase test matrix. (10) Added public endpoint filtering implementation note. (11) Added auto-archive risk to Risks table. |
| R2 | 2026-04-03 | **Exhaustive review pass 2 (codebase-verified)**: All claims verified against actual code with file paths and line numbers. Changes: (1) **CRITICAL FIX**: AccommodationReview is ALREADY fully compliant — Zod schema includes `lifecycleState` via `BaseLifecycleFields` (`accommodationReview.schema.ts:21`), access schemas already exclude from Public/Protected. Phase 1 reduced to verification + test coverage only. (2) **CRITICAL FIX**: SPEC-050 is NOT a blocking dependency — after SPEC-063 all 6 entities have `lifecycleState`, so the base `adminList()` hardcoded `where.lifecycleState = status` works universally. Removed blocking dependency. (3) Overview corrected: 3 entities need changes, not 4 (AccommodationReview already done). (4) Added OwnerPromotion model method changes: `findActiveByAccommodationId` and `findActiveByOwnerId` use `eq(ownerPromotions.isActive, true)` and must change to `lifecycleState`. (5) Added missing Affected Files: HTTP schemas (`owner-promotion.http.schema.ts`, `sponsorship.http.schema.ts`), query schemas, model file (`ownerPromotion.model.ts`), admin hooks (`togglePromotionActive()`). (6) Fixed service-core file paths from kebab-case to actual camelCase (`ownerPromotion.service.ts`, `accommodationReview.service.ts`, `destinationReview.service.ts`). (7) Phase 2 expanded from 8 to 14 steps with granular file-level instructions. (8) Phase 3 expanded from 8 to 13 steps with PG enum type handling note. (9) Cron job details added: hourly schedule, batch size 100, query, error handling, logging pattern. (10) Sponsorship migration clarified: PG enum type `SponsorshipStatusPgEnum` unchanged, only column name changes. (11) Rollback Phase 2 expanded: added DRAFT -> false mapping. (12) Admin frontend section made specific: exact file paths for columns config, hooks, routes. (13) Removed stale SPEC-050 risk row. (14) Updated Cross-Spec Coordination to reflect SPEC-050 independence. |
| R3 | 2026-04-03 | **Exhaustive review pass 3 (cross-spec + external verification)**: Full cross-spec overlap analysis (SPEC-050 through SPEC-065), code claim verification with line-by-line audit, external lib/service validation. Changes: (1) **CRITICAL FIX**: Discovered `isPublished` and `isVerified` exist only in Zod schema (`destinationReview.schema.ts:83,89`) with NO DB columns in `destination_review.dbschema.ts`. AC-004-04 (archival sets `isPublished = false`) is **impossible to implement** without DB columns. (2) **AC-004-04 deferred** to Future Considerations with full context on the DB-Zod sync gap and what a future spec must do. (3) Phase 4 Step 10 (`_beforeUpdate()` hook) marked DEFERRED. (4) Phase 4 Side effect test marked DEFERRED. (5) In Scope list updated: DestinationReview service side effect marked DEFERRED. (6) Affected Files: `destinationReview.service.ts` `_beforeUpdate()` hook marked DEFERRED. (7) **Path fix**: Affected Files line 608 corrected from `entities/owner-promotion/` to `entities/ownerPromotion/` (verified actual directory is camelCase). (8) Phase 4 Step 9: removed `if exists` conditional for `destinationReview.http.schema.ts` (file confirmed to exist). (9) Non-Goals clarified: added note that `isPublished`/`isVerified` have no DB columns. (10) Risk table updated: `isPublished` semantic ambiguity risk clarified with DB-Zod sync gap context. (11) Cross-spec overlap analysis: confirmed zero conflicts with SPEC-050 through SPEC-065 (SPEC-050 independence validated, SPEC-057 dependency already completed, SPEC-062 coordination documented). (12) All 17 code claims verified correct against actual codebase with exact line numbers. (13) External libs verified: Drizzle ORM migration patterns and Zod usage are standard, no hallucinations. |
| R4 | 2026-04-03 | **Exhaustive review pass 4 (missing affected files audit)**: Full codebase grep for all references to `isActive` (OwnerPromotion context) and `status` (Sponsorship context) beyond the files already listed. Changes: (1) **GAP FIX**: Added `apps/api/src/services/usage-tracking.service.ts:406` to Affected Files and Phase 2 steps .. uses `isActive: true` for `MAX_ACTIVE_PROMOTIONS` count query, must change to `lifecycleState: 'ACTIVE'`. (2) **GAP FIX**: Added `apps/api/src/middlewares/limit-enforcement.ts:318` to Affected Files and Phase 2 steps .. same `isActive: true` pattern in promotion limit validation. (3) **GAP FIX**: Added `apps/admin/src/features/sponsorships/hooks/useSponsorshipQueries.ts:96,170` to Affected Files and Phase 3 steps .. `updateSponsorshipStatus()` function sends `{ status }` in PATCH body (old field name), must change to `{ sponsorshipStatus }`. Mutation type also needs renaming. (4) Phase 2 step 11 clarified: added note about ensuring `_executeSearch()` injects `lifecycleState = ACTIVE` for non-admin queries (current `_executeSearch` passes filters through without default injection). (5) Test plan expanded: added usage-tracking, limit-enforcement, and frontend hook tests for Phases 2 and 3. (6) All 32 code claims re-verified correct. Cross-spec analysis (SPEC-050 through SPEC-065) confirmed zero new conflicts. |
| R5 | 2026-04-03 | **Exhaustive review pass 5 (implementation-readiness audit)**: Full 3-agent parallel analysis: (a) code audit of all 6 entities across 10 file types each, (b) cross-spec overlap analysis of SPEC-050 through SPEC-065, (c) external library/pattern verification (Drizzle ORM, Zod, PostgreSQL). Changes: (1) **FIX**: Phase 2 step numbering corrected .. steps 13a/13b/13/14 renumbered to 13/14/15/16 to eliminate ambiguous duplicate step numbers. (2) **FIX**: Revision History reordered R3 before R4 (were swapped in R4 edit). (3) **EXPANSION**: Phase 2 Step 11 (`_executeSearch` public filtering) expanded with critical implementation detail .. current `_executeSearch()` (line 114-117) does NOT inject `isActive = true` as default, it passes `filterParams` directly. Added explicit implementation guidance: inject `lifecycleState = 'ACTIVE'` into `filterParams` when caller doesn't specify it. This is a BEHAVIOR CHANGE, not just a field rename. (4) **ADDITION**: Cross-Spec Coordination section expanded with SPEC-054 (Admin Filter Bar) .. filter configs for OwnerPromotion must use `lifecycleState` enum (not old `isActive` boolean), and Sponsorship needs two separate filters. (5) **CLARIFICATION**: Dependencies table expanded for Drizzle migration tooling .. clarified that `pnpm db:migrate` maps to `drizzle-kit push` (dev only), production deployments need `drizzle-kit migrate` with generated SQL files, and down migrations must be manual. (6) **CLARIFICATION**: Phase 3 Step 1 .. added default values note explaining `lifecycleState = ACTIVE` and `sponsorshipStatus = pending` are intentionally independent defaults. (7) **VERIFIED CORRECT**: All code claims (file paths, line numbers, field names, types) confirmed accurate against current codebase. (8) **VERIFIED CORRECT**: All external library patterns (Drizzle pgEnum, Zod transforms, PostgreSQL NOT NULL + DEFAULT safety) confirmed non-hallucinated via docs and codebase examples. (9) **VERIFIED CORRECT**: Cross-spec analysis found no NEW conflicts beyond already documented SPEC-050/SPEC-057/SPEC-062 coordination. |
| R6 | 2026-04-03 | **Exhaustive review pass 6 (SPEC-050 deletion + deployment hardening)**: 5-agent parallel analysis: (a) full SPEC-063 content deep audit, (b) cross-spec overlap analysis SPEC-050 through SPEC-065, (c) codebase lifecycle state implementation audit, (d) SPEC-050 item-by-item comparison for supersession validation, (e) external library verification. Changes: (1) **SPEC-050 DELETED**: After exhaustive item-by-item audit confirming zero residual items needed, SPEC-050 was deleted. All references in SPEC-063 updated to reflect deletion (Dependencies table, Cross-Spec Coordination, Scope, Future Considerations, Risks). (2) **NEW SECTION: Deployment Strategy**: Added concrete deployment order (DB migration → API → admin frontend), breaking change justification (immediate, no transition period), pre-migration validation queries for all 3 phases, and post-migration verification queries. (3) **NEW: SPEC-059 Cross-Spec Coordination**: Added coordination section for hook signature alignment (`_ctx: ServiceContext` parameter). Documented affected hooks and implementation order options. (4) **STRENGTHENED: SPEC-062 Cross-Spec Coordination**: Expanded from 3 bullets to full section with critical Phase 0 preemptive field requirement, recommended deployment sequence (SPEC-062 Phase 0 → SPEC-063 → SPEC-062 Phases 1-4), and fallback if SPEC-063 deploys first. (5) **EXPANDED: Phase 2 Step 8 (HTTP schema)**: Added specific Zod types for search vs. create schemas, detailed `httpToDomainOwnerPromotionSearch()` conversion changes, confirmed remaining HTTP params (validFromAfter, discountMin, etc.) are unrelated and unchanged. (6) **GAP FIX: Affected Files**: Added missing `destinationReview.query.schema.ts` and `destinationReview.http.schema.ts` to Packages/schemas section. (7) **GAP FIX: Affected Files**: Added specific route directory paths for API routes (`apps/api/src/routes/admin/owner-promotion/`, etc.). (8) **NEW RISKS**: Added SPEC-062 admin field stripping risk and SPEC-059 hook signature mismatch risk to Risks table. (9) **REMOVED**: Stale SPEC-050 risk row. (10) All previous code claims re-verified correct. |
| R7 | 2026-04-03 | **Exhaustive review pass 7 (model methods, cron alignment, test fixtures, i18n)**: Full codebase audit for ALL references to `isActive` (OwnerPromotion) and `status` (Sponsorship) including model files, test fixtures, i18n keys, and admin components. Changes: (1) **GAP FIX**: Added `sponsorship.model.ts` to Affected Files and Phase 3 — `findByStatus()` must be renamed to `findBySponsorshipStatus()`, and `findActiveByTarget()` must add dual filter: `sponsorshipStatus = 'active' AND lifecycleState = 'ACTIVE'` (archived sponsorships must not appear as active, per AC-003-02). (2) **GAP FIX**: Added Test files and fixtures section to Affected Files — 6 test/fixture files reference `isActive` or `status` and need updating. (3) **GAP FIX**: Added i18n section to Affected Files — `actionActivate`/`actionDeactivate` keys and `statuses.inactive` must be updated for lifecycle states. (4) **GAP FIX**: Added sponsorship admin components (`SponsorshipsTab.tsx`, `types.ts`) to Affected Files. (5) **FIX**: Cron job pattern aligned with existing `CronJobDefinition` infrastructure — added advisory lock (`43010`), dry-run support, Sentry integration, `CronJobResult` return type, file path corrected to `jobs/` subdirectory, registration in `registry.ts`. (6) **FIX**: `SYSTEM_USER_ID` clarified — constant does not exist; `updatedById` set to NULL for system-initiated actions with note to update when system user is created. (7) **ADDITION**: Phase 3 permissions clarification — `SPONSORSHIP_STATUS_MANAGE` governs `sponsorshipStatus` changes; `lifecycleState` changes use general `SPONSORSHIP_UPDATE` permission. (8) **ADDITION**: Phase 3 step count expanded from 14 to 16 with model methods (step 10) and permissions (step 15). (9) **FIX**: Cron handler registered in `registry.ts` (was missing from Affected Files). (10) All code claims re-verified against codebase. Cross-spec analysis (SPEC-050–065) confirmed zero new conflicts. |
