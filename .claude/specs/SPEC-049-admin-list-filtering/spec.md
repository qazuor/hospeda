---
spec-id: SPEC-049
title: "Admin List Filtering: adminList() Method for BaseCrudService"
type: bugfix
complexity: high
status: in-progress
created: 2026-03-20T04:30:00.000Z
approved: 2026-03-20T04:30:00.000Z
---

# SPEC-049: Admin List Filtering - adminList() Method for BaseCrudService

## Part 1 - Functional Specification

### 1. Overview & Goals

#### Goal

All 16 admin list routes silently ignore entity-specific filters (`ownerId`, `type`, `destinationId`, `status`, `includeDeleted`, `sort`, `createdAfter/Before`, etc.). The root cause is NOT schema stripping -- `list()` uses `z.record(z.string(), z.unknown())` which is permissive and passes all fields through. The real issue is that `buildWhereClause()` in `packages/db/src/utils/drizzle-helpers.ts` silently ignores any key that does not match a column in the table. So entity-specific filters like `ownerId`, `type`, etc. ARE passed from the route to the service to `buildWhereClause()`, but are silently dropped when building the SQL WHERE clause because the key-to-column mapping skips unrecognized keys. This spec adds an `adminList()` method to the service chain that correctly processes all `AdminSearchBaseSchema` common fields and delegates entity-specific filters to each service BEFORE they reach `buildWhereClause()`.

Additionally, this spec fixes two related bugs:
- **Search OR bug**: The existing `list()` method incorrectly joins search conditions with AND (requiring the search term to match ALL searchable columns simultaneously) instead of OR.
- **JSONB filter bugs**: Several entity-specific filters (accommodation price, event dates, review ratings) incorrectly attempt to use `eq()` on JSONB columns instead of extracting nested properties via `->>'key'`.

#### Motivation

- An admin viewing accommodations filtered by `?ownerId=UUID` sees ALL accommodations because `buildWhereClause()` silently ignores keys it does not recognize as table columns. The `ownerId` filter passes through the route validation and `list()`'s permissive Zod schema, but is dropped when constructing the SQL WHERE clause. This means the admin panel's "filter by owner" dropdown does nothing.
- Better Auth impersonation IS fully implemented (admin plugin, `impersonatedBy` field in session, ImpersonateButton, ImpersonationBanner). When an admin impersonates a HOST user, the admin panel's accommodations list with `?ownerId=<host-uuid>` should show only that host's accommodations. Currently, the `ownerId` filter is silently dropped by `buildWhereClause()`, causing all 30 accommodations to appear instead of the host's 3.
- The `sort` field (format `"field:dir"`) is ignored because `list()` expects separate `sortBy`/`sortOrder`.
- The `status` filter for lifecycle state is ignored.
- The `includeDeleted` flag is ignored.
- Date range filters (`createdAfter`/`createdBefore`) are ignored.
- Search across multiple columns uses AND instead of OR, returning zero results when a term matches name but not description.
- JSONB-stored fields (price, date, rating) cannot be filtered correctly with `eq()` comparisons.
- This affects ALL 16 admin list endpoints systemically.

#### The 16 Admin List Routes in Scope

1. `GET /api/v1/admin/accommodations` - AccommodationAdminSearchSchema
2. `GET /api/v1/admin/users` - UserAdminSearchSchema
3. `GET /api/v1/admin/destinations` - DestinationAdminSearchSchema
4. `GET /api/v1/admin/events` - EventAdminSearchSchema
5. `GET /api/v1/admin/posts` - PostAdminSearchSchema
6. `GET /api/v1/admin/amenities` - AmenityAdminSearchSchema
7. `GET /api/v1/admin/features` - FeatureAdminSearchSchema
8. `GET /api/v1/admin/tags` - TagAdminSearchSchema
9. `GET /api/v1/admin/attractions` - AttractionAdminSearchSchema
10. `GET /api/v1/admin/event-locations` - EventLocationAdminSearchSchema
11. `GET /api/v1/admin/event-organizers` - EventOrganizerAdminSearchSchema
12. `GET /api/v1/admin/owner-promotions` - OwnerPromotionAdminSearchSchema
13. `GET /api/v1/admin/post-sponsors` - PostSponsorAdminSearchSchema
14. `GET /api/v1/admin/accommodation-reviews` - AccommodationReviewAdminSearchSchema
15. `GET /api/v1/admin/destination-reviews` - DestinationReviewAdminSearchSchema
16. `GET /api/v1/admin/sponsorships` - SponsorshipAdminSearchSchema (new, migrated from SponsorshipSearchSchema)

#### Success Metrics

- All 16 admin list routes correctly filter by entity-specific fields
- All `AdminSearchBaseSchema` common fields (`sort`, `status`, `includeDeleted`, `createdAfter/Before`, `search`) work correctly
- Search across multiple columns uses OR (not AND), both in `list()` and `adminList()`
- JSONB filters (accommodation price, event dates) work correctly
- Review rating filters work via new `averageRating` numeric column (not JSONB extraction)
- `list()` method remains unchanged for its existing callers (zero breaking changes to public routes, cron jobs, existing tests) except for the search OR fix
- Sponsorship admin list route migrated from `SponsorshipSearchSchema` to `SponsorshipAdminSearchSchema`
- 90%+ test coverage on new code

#### Target Users

- Admin panel users filtering/searching entities in DataTable views
- Super admins impersonating host users and viewing filtered accommodation lists

### 2. User Stories & Acceptance Criteria

#### US-1: Admin filters accommodations by owner

**As an** admin (optionally impersonating a host user),
**I want** to filter the admin accommodations list by `ownerId`,
**So that** I can see only a specific host's accommodations.

**Acceptance Criteria:**

```gherkin
Given a host user (UUID: host-123) owns 3 accommodations out of 30 total
When the admin calls GET /api/v1/admin/accommodations?ownerId=host-123
Then the API returns only the 3 accommodations where ownerId matches host-123
And the response pagination.total is 3

Given the admin impersonates host-123 using Better Auth impersonation
When the admin panel loads the accommodations list with ?ownerId=host-123
Then the DataTable shows only the host's 3 accommodations
And the ImpersonationBanner is visible at the top of the page
```

**Technical note:** The admin panel does NOT have a `/me/accommodations` route. The real flow is: the admin uses the admin accommodations list at `GET /api/v1/admin/accommodations?ownerId=<host-uuid>`. Better Auth impersonation is already fully implemented (admin plugin, `impersonatedBy` field in session, ImpersonateButton in user detail, ImpersonationBanner component). The bug is that the `ownerId` query parameter passes through `list()` but is silently dropped by `buildWhereClause()` when it does not match a recognized table column key.

#### US-2: Admin filters entities by lifecycle status

**As an** admin,
**I want** to filter entities by status (DRAFT, ACTIVE, ARCHIVED),
**So that** I can manage entities in different lifecycle stages.

**Acceptance Criteria:**

```gherkin
Given 10 accommodations exist: 3 DRAFT, 5 ACTIVE, 2 ARCHIVED
When the admin calls GET /api/v1/admin/accommodations?status=DRAFT
Then only the 3 DRAFT accommodations are returned
And the response pagination.total is 3

Given status=all (default value)
When the admin calls GET /api/v1/admin/accommodations
Then all 10 accommodations are returned (no lifecycleState filter applied)

Given a table without a lifecycleState column (e.g., owner_promotions)
When the admin calls GET /api/v1/admin/owner-promotions?status=ACTIVE
Then the status filter is silently ignored (buildWhereClause skips unknown columns)
And all owner promotions are returned (use isActive=true entity filter instead)
```

#### US-3: Admin sorts entities with compound sort field

**As an** admin,
**I want** to sort entities using the "field:direction" format,
**So that** column sorting in the DataTable works correctly.

**Acceptance Criteria:**

```gherkin
Given accommodations exist with different names and dates
When the admin calls GET /api/v1/admin/accommodations?sort=name:asc
Then accommodations are returned sorted by name ascending

When the admin calls GET /api/v1/admin/accommodations?sort=createdAt:desc
Then accommodations are returned sorted by creation date descending

When the admin calls GET /api/v1/admin/accommodations?sort=nonExistentColumn:asc
Then the API returns HTTP 400 with VALIDATION_ERROR code
And message indicates the sort field is not a valid column
```

**Technical note:** Sort field names must use camelCase matching Drizzle table property names (e.g., `sort=createdAt:desc`, NOT `sort=created_at:desc`). The `sort` regex `/^[a-zA-Z_]+:(asc|desc)$/` accepts both formats syntactically, but column validation checks against Drizzle table properties which are camelCase.

> **Note on sort validation**: The `adminList()` method validates the sort field against the table's columns and throws `VALIDATION_ERROR` for invalid fields. However, the existing `buildOrderByClause` (used by `list()`) returns `undefined` for invalid sort fields, resulting in silently unsorted data. Consider adding per-entity allowed sort field validation in `parseAdminSort` as a future improvement, returning `VALIDATION_ERROR` for invalid fields rather than falling back to unsorted results.

#### US-4: Admin includes soft-deleted entities

**As an** admin,
**I want** to optionally include soft-deleted entities in the list,
**So that** I can review or restore deleted content.

**Acceptance Criteria:**

```gherkin
Given 5 active and 2 soft-deleted accommodations exist
When the admin calls GET /api/v1/admin/accommodations (includeDeleted defaults to false)
Then only 5 active accommodations are returned (WHERE deletedAt IS NULL)

When the admin calls GET /api/v1/admin/accommodations?includeDeleted=true
Then all 7 accommodations are returned (no deletedAt filter applied)

When the admin calls GET /api/v1/admin/accommodations?status=ACTIVE&includeDeleted=true
Then accommodations with lifecycleState=ACTIVE are returned
Including those that have a non-null deletedAt (active but soft-deleted)
```

#### US-5: Admin filters by date range

**As an** admin,
**I want** to filter entities by creation date range,
**So that** I can review recently created or historical content.

**Acceptance Criteria:**

```gherkin
Given entities created on various dates
When the admin calls GET /api/v1/admin/accommodations?createdAfter=2026-03-01
Then only entities with createdAt >= 2026-03-01 are returned

When both createdAfter=2026-03-01 and createdBefore=2026-03-15 are provided
Then only entities with createdAt >= 2026-03-01 AND createdAt <= 2026-03-15 are returned

When createdAfter=2026-03-15 and createdBefore=2026-03-01 (inverted range)
Then an empty result is returned (no error, zero items)
```

#### US-6: Admin filters by entity-specific fields

**As an** admin,
**I want** to filter by entity-specific fields (type, destinationId, category, etc.),
**So that** I can narrow down large lists efficiently.

**Acceptance Criteria:**

```gherkin
Given accommodations of types HOTEL, CABIN, APARTMENT exist
When the admin calls GET /api/v1/admin/accommodations?type=HOTEL
Then only HOTEL accommodations are returned

Given events with different organizers
When the admin calls GET /api/v1/admin/events?organizerId=UUID
Then only events by that organizer are returned

Given posts by different authors
When the admin calls GET /api/v1/admin/posts?authorId=UUID
Then only posts by that author are returned
```

#### US-7: Admin searches entities with text query (OR logic)

**As an** admin,
**I want** text search to match ANY searchable column (OR logic),
**So that** searching "hotel" returns entities where name OR description contains "hotel".

**Acceptance Criteria:**

```gherkin
Given an accommodation with name="Cabana del Rio" and description="hotel-like experience"
When the admin searches GET /api/v1/admin/accommodations?search=hotel
Then this accommodation IS returned (matches description)
Because search uses OR across name and description columns

Given the same accommodation
When the admin searches GET /api/v1/admin/accommodations?search=cabana
Then this accommodation IS returned (matches name)
```

**Technical note:** This also fixes the same bug in the existing `list()` method, which currently joins `name_like` AND `description_like` conditions.

#### US-8: Admin filters accommodations by price range (JSONB)

**As an** admin,
**I want** to filter accommodations by price range,
**So that** I can find accommodations in a specific price bracket.

**Acceptance Criteria:**

```gherkin
Given accommodations with JSONB price column: {"price": 100, "currency": "ARS"}
When the admin calls GET /api/v1/admin/accommodations?minPrice=50&maxPrice=200
Then only accommodations where (price->>'price')::numeric >= 50 AND <= 200 are returned

Given an accommodation with price: null (no price set)
When the admin filters by minPrice=50
Then that accommodation is NOT returned
```

### 3. UX Considerations

- No frontend changes needed initially. The admin UI already sends these query params via DataTable filter dropdowns, sort headers, and search input. The backend just ignores them currently.
- After this fix, existing filter dropdowns and sort columns in the DataTable will start working.
- The "filter by owner" dropdown in the accommodations admin page will correctly narrow results.
- The impersonation flow (admin impersonates host, views host's accommodations) will work correctly.

### 4. Out of Scope

- **Frontend admin UI changes**: Filters already exist in the UI. No new UI components needed.
- **Changes to `list()` method's parameter handling**: The `list()` method signature and Zod schema stay unchanged. Only the search OR fix modifies its internal behavior.
- **Changes to public/protected routes**: These use `list()` or `search()`, not `adminList()`.
- **New AdminSearchSchema creation**: All 16 entity-specific schemas already exist (sponsorship will be migrated).
- **`in()` operator for `buildWhereClause`**: Not needed for current filters.
- **i18n of error messages for new validation**: Error messages use English strings consistent with existing service errors.
- **Exchange Rate History admin list** (`GET /api/v1/admin/exchange-rates`): OUT OF SCOPE. Uses `ExchangeRateHistoryHttpSchema` which has a fundamentally different field structure (`baseCurrency`, `targetCurrency`, `dateFrom`, `dateTo`) that does not extend `AdminSearchBaseSchema`. This is a completely different query pattern (historical data lookup, not entity list).
- **Promo Codes admin list** (`GET /api/v1/admin/billing/promo-codes`): OUT OF SCOPE. Uses `ListPromoCodesQuerySchema` which has custom fields (`codeSearch`, `active`, `expired`) that do not extend `AdminSearchBaseSchema`. This lives in the billing routes which have their own query patterns.
- **`event_locations` `destinationId` FK addition**: Tracked separately in SPEC-050. The `event_locations` table currently lacks a `destinationId` column and capacity/isVerified columns.
- **`isActive` to `lifecycleState` migration**: For `owner_promotions`, `sponsorship_levels`, and `sponsorship_packages` tables that use `isActive` boolean instead of `lifecycleState` enum. Tracked as a separate migration spec.
- **UserService public `list()` search OR fix**: UserService overrides `list()` completely. The search OR fix only applies to services that use `BaseCrudRead.list()`. Fixing UserService's public list search is tracked separately.

---

## Part 2 - Technical Analysis

### 1. Architecture

#### Design Decision: New `adminList()` method vs reusing `search()`

A new `adminList()` method is added to the `BaseCrudRead` class. The justification for NOT reusing the existing `search()` method:

1. **Different schemas**: `searchSchema` (for public/protected search) vs `adminSearchSchema` (for admin list). These have different fields. Public search schemas don't have `status`, `includeDeleted`, `createdAfter/Before`. Admin search schemas have entity-specific filters that differ from public search filters.
2. **Different pipelines**: `search()` has its own pipeline with normalizers, `_beforeSearch`/`_afterSearch` hooks, designed for public/protected use cases. `adminList()` has a distinct pipeline optimized for admin filtering.
3. **Separation of concerns**: `list()` = public paginated listing, `search()` = public search with filters, `adminList()` = admin list with admin-specific filters and behavior (e.g., includeDeleted, lifecycleState).
4. **Zero breaking changes**: Existing `search()` implementations across all services remain untouched. No risk of regressions.

#### Design Decision: `adminSearchSchema` is optional

Not all services have admin list routes (e.g., a hypothetical internal-only service). The `adminSearchSchema` property is declared as `protected adminSearchSchema?: ZodSchema` on `BaseCrudPermissions`. If `adminList()` is called without the schema configured, it throws a `CONFIGURATION_ERROR`:

```ts
throw new ServiceError(
    ServiceErrorCode.CONFIGURATION_ERROR,
    `adminList() requires adminSearchSchema to be configured on ${this.entityName}Service`
);
```

**Prerequisite**: `ServiceErrorCode.CONFIGURATION_ERROR` does not currently exist in the enum. It must be added as part of Phase 0 (see Implementation Approach). The enum at `packages/schemas/src/enums/service-error-code.enum.ts` currently has: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`, `ALREADY_EXISTS`, `INVALID_PAGINATION_PARAMS`, `NOT_IMPLEMENTED`, `SERVICE_UNAVAILABLE`.

#### Design Decision: page/pageSize overlap

Both `PaginationQuerySchema` (auto-merged by `createAdminListRoute`) and `AdminSearchBaseSchema` define `page` and `pageSize`. This causes duplicate parameter definitions in the OpenAPI spec.

**Fix**: When building the `requestQuery` for admin list routes, OMIT `page` and `pageSize` from the entity's admin search schema since `createAdminListRoute` already adds them via `PaginationQuerySchema`:

```ts
// In each admin list route definition:
requestQuery: AccommodationAdminSearchSchema.omit({ page: true, pageSize: true }).shape
```

This pattern must be applied to all 16 admin list routes in Phase 6. The `adminList()` service method still receives `page` and `pageSize` from the validated query (since `PaginationQuerySchema` provides them), so no service-level changes are needed.

#### Tables without lifecycleState

Several tables use different patterns instead of the standard `lifecycleState` column. The base `status` filter from `AdminSearchBaseSchema` maps to `lifecycleState`, so it is silently ignored on these tables (because `buildWhereClause` skips columns not found on the table):

| Table | Pattern Used | Status Filter Behavior | Notes |
|-------|-------------|----------------------|-------|
| `owner_promotions` | `isActive` boolean | Base `status` filter ignored | Migration to `lifecycleState` deferred to separate spec |
| `sponsorships` | `status` enum (pending/active/expired/cancelled) | Base `status` filter ignored (no `lifecycleState` column). Intentional: different lifecycle model. Use `sponsorshipStatus` filter instead. | |
| `sponsorship_levels` | `isActive` boolean | Not in SPEC-049 scope (no admin list route) | |
| `sponsorship_packages` | `isActive` boolean | Not in SPEC-049 scope (no admin list route) | |
| `tags` | `lifecycleState` enum | Base `status` filter works normally | |

#### Existing Service Override Pattern

The current codebase has three method chains that services can override:

- **`list()`**: Public paginated listing. Most services do NOT override `list()`. The exception is `UserService`, which overrides `list()` completely to use `findAllWithCounts()`.
- **`search()` / `_executeSearch()`**: Public search with filters. Services override `_executeSearch()` (not `search()` itself) to add entity-specific search logic (e.g., AccommodationService adds VIP filtering, destination filtering). This is the established pattern for customizing query behavior.
- **`adminList()` / `_executeAdminSearch()` (NEW)**: Admin list with admin-specific filters. This spec introduces a parallel override path: services override `_executeAdminSearch()` for admin-specific filtering, following the same delegation pattern as `_executeSearch()`.

#### Component Overview

```
AdminSearchSchema (validated by Hono/Zod in route via createAdminListRoute)
  | raw validated params
  v
adminList(actor, params)
  | 1. Permission check: _canList(actor)
  | 2. Validate params against this.adminSearchSchema (if configured)
  | 3. parseAdminSort(sort) -> { sortBy, sortOrder }
  | 4. Validate sortBy is a real column on the table (or throw VALIDATION_ERROR)
  | 5. status -> lifecycleState where clause (status=all -> skip)
  | 6. includeDeleted=false -> { deletedAt: null } (default)
  | 7. createdAfter/Before -> _gte/_lte where clause
  | 8. search -> buildSearchCondition(term, columns, table) -> SQL or() clause
  | 9. Destructure remaining entity-specific filters
  v
_executeAdminSearch({ where, entityFilters, pagination, sort, search, actor })
  | DEFAULT: merge simple entityFilters into where, call model.findAll(where, options, additionalConditions)
  | OVERRIDE: extract complex filters from entityFilters, build custom SQL, pass as additionalConditions
  v
model.findAll(where, options, additionalConditions?)
  | buildWhereClause(where, table) combined with additionalConditions via and()
  v
SQL query
```

#### Data Flow (step by step)

1. Route validates query params with entity-specific `AdminSearchSchema` via `createAdminListRoute`
2. Route handler calls `service.adminList(actor, query)` (replaces `service.list(actor, { ...query })`)
3. `adminList()` checks `this.adminSearchSchema` exists (throws `CONFIGURATION_ERROR` if not)
4. `adminList()` validates params against `this.adminSearchSchema` (defense in depth)
5. `adminList()` calls `_canList(actor)` to verify permissions
6. Base logic extracts and processes `AdminSearchBaseSchema` fields:
   - Parses `sort` string into `sortBy`/`sortOrder` via `parseAdminSort()`
   - Validates `sortBy` is a valid column name on the model's table
   - Maps `status` to `lifecycleState` where clause (or skips if `status=all`)
   - Adds `deletedAt: null` to where clause unless `includeDeleted=true`
   - Maps `createdAfter` to `{ createdAt_gte: date }` and `createdBefore` to `{ createdAt_lte: date }`
   - Builds OR search condition from `search` term across `getSearchableColumns()`
7. Remaining fields become `entityFilters` via explicit destructuring
8. `_executeAdminSearch()` is called with structured params
9. Default implementation merges simple `entityFilters` (eq comparisons like `ownerId`, `type`) into `where` and calls `model.findAll()` with `additionalConditions` (for search OR clause)
10. Services with complex filters (JSONB price/date, column renames) override `_executeAdminSearch()` to extract those fields from `entityFilters`, build custom SQL conditions, and pass them as `additionalConditions`

### 2. Data Model Changes

#### 2.0. New `averageRating` column on review tables

The `accommodation_reviews` and `destination_reviews` tables currently store ratings as JSONB objects with multiple dimensions (6 keys for accommodations: cleanliness, hospitality, services, accuracy, communication, location; 18 keys for destinations). There is NO `overall` key in either rating schema.

The parent tables (`accommodations` and `destinations`) already have `averageRating` numeric(3,2) columns computed from reviews. However, the review tables themselves lack a per-review average, which makes range filtering (`minRating`/`maxRating`) require complex JSONB extraction across multiple keys.

**Change**: Add a new `averageRating` column to both review tables:
- `accommodation_reviews.averageRating` - numeric(3,2), NOT NULL, computed at review creation/update time as the average of all 6 rating dimensions
- `destination_reviews.averageRating` - numeric(3,2), NOT NULL, computed at review creation/update time as the average of all 18 rating dimensions

**Sync mechanism**: The `averageRating` column is kept in sync via the review service's lifecycle hooks:
- **`_afterCreate`**: After a new review is created, compute the average of all rating dimensions and update the review's `averageRating` column. Also recalculate the parent entity's (accommodation or destination) `averageRating` using `calculateStatsFromReviews()`.
- **`_afterUpdate`**: After a review is updated, recompute the review's `averageRating` from the updated rating dimensions. Also recalculate the parent entity's `averageRating`.
- **`_afterDelete`**: After a review is deleted, recalculate the parent entity's `averageRating` (the deleted review's own `averageRating` no longer matters).

Example hook implementation for `AccommodationReviewService`:

```ts
protected override async _afterCreate(
    entity: AccommodationReview,
    _actor: Actor,
    tx?: Transaction
): Promise<void> {
    // 1. Compute per-review average from JSONB rating dimensions
    const rating = entity.rating as Record<string, number>;
    const values = Object.values(rating).filter((v) => typeof v === 'number');
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    // 2. Update the review's averageRating column
    await this.model.update(entity.id, { averageRating: avg }, tx);

    // 3. Recalculate parent accommodation's averageRating
    await this.recalculateParentAverage(entity.accommodationId, tx);
}

private async recalculateParentAverage(
    accommodationId: string,
    tx?: Transaction
): Promise<void> {
    const stats = await calculateStatsFromReviews(accommodationId, tx);
    await accommodationModel.update(accommodationId, { averageRating: stats.averageRating }, tx);
}
```

The `DestinationReviewService` follows the same pattern but targets the parent destination entity.

This is implemented in Phase 0 (prerequisites) and dramatically simplifies the review rating filter from complex JSONB extraction to a simple `gte()`/`lte()` comparison on a numeric column.

#### 2.1. buildWhereClause additions (`packages/db/src/utils/drizzle-helpers.ts`)

New suffixes for range comparisons:

| Suffix | SQL Operator | Example Key | Example SQL | Use Case |
|--------|-------------|-------------|-------------|----------|
| `_gte` | `>=` | `{ createdAt_gte: date }` | `WHERE created_at >= date` | createdAfter |
| `_lte` | `<=` | `{ createdAt_lte: date }` | `WHERE created_at <= date` | createdBefore |

Implementation adds two new branches in the `map()` function, following the existing `_like` pattern:

```ts
// File: packages/db/src/utils/drizzle-helpers.ts
// Add imports: gte, lte from 'drizzle-orm'

// Inside the .map() callback, BEFORE the final eq() fallback:

// Handle _gte suffix for >= comparisons
if (key.endsWith('_gte')) {
    const columnName = key.slice(0, -4);
    if (Object.prototype.hasOwnProperty.call(tableRecord, columnName)) {
        const column = tableRecord[columnName] as PgColumn;
        return gte(column, value);
    }
    return undefined;
}

// Handle _lte suffix for <= comparisons
if (key.endsWith('_lte')) {
    const columnName = key.slice(0, -4);
    if (Object.prototype.hasOwnProperty.call(tableRecord, columnName)) {
        const column = tableRecord[columnName] as PgColumn;
        return lte(column, value);
    }
    return undefined;
}
```

#### 2.2. buildSearchCondition utility (`packages/db/src/utils/drizzle-helpers.ts`)

New exported function that builds an OR condition across multiple columns:

```ts
/**
 * Builds an OR search condition across multiple columns using ILIKE.
 *
 * @param term - The search term to match
 * @param columns - Array of column names to search across
 * @param table - Drizzle table schema object
 * @returns SQL OR clause, or undefined if no valid columns found
 */
export function buildSearchCondition(
    term: string,
    columns: readonly string[],
    table: unknown
): SQL | undefined {
    if (!term || term.trim().length === 0) return undefined;
    if (typeof table !== 'object' || table === null) return undefined;

    const tableRecord = table as Record<string, unknown>;
    const trimmedTerm = term.trim();

    const conditions = columns
        .filter((col) => Object.prototype.hasOwnProperty.call(tableRecord, col))
        .map((col) => {
            const column = tableRecord[col] as PgColumn;
            return ilike(column, `%${trimmedTerm}%`);
        });

    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];
    return or(...conditions);
}
```

Import `or` from `drizzle-orm` (add to existing import line).

> **Known limitation: LIKE wildcards not escaped.** The `%` and `_` characters in search terms are LIKE wildcards and are NOT escaped in the `%${trimmedTerm}%` pattern. A search for "100%" would match any string containing "100" followed by any character. This is acceptable for admin search (low risk of intentional wildcard injection), but should be improved in the future by escaping `%` and `_` characters in the search term before wrapping with `%...%`, or by using Drizzle's parameterized ILIKE approach if available.

#### 2.3. additionalConditions parameter in BaseModel.findAll (`packages/db/src/base/base.model.ts`)

Extend `findAll()` to accept an optional `additionalConditions` parameter:

```ts
async findAll(
    where: Record<string, unknown>,
    options?: {
        page?: number;
        pageSize?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    },
    // NEW PARAMETER:
    additionalConditions?: SQL[],
    tx?: NodePgDatabase<typeof schema>
): Promise<{ items: T[]; total: number }>
```

Inside the method, combine `buildWhereClause(where, table)` with `additionalConditions`:

```ts
const baseWhereClause = buildWhereClause(safeWhere, this.table as unknown);

// Combine base where clause with additional SQL conditions
const allConditions: SQL[] = [];
if (baseWhereClause) allConditions.push(baseWhereClause);
if (additionalConditions) allConditions.push(...additionalConditions);

const finalWhereClause = allConditions.length === 0
    ? undefined
    : allConditions.length === 1
        ? allConditions[0]
        : and(...allConditions);

// Use finalWhereClause in findMany AND in the count query
```

The same `additionalConditions` parameter must also be added to the `count()` method so that total counts are accurate.

**IMPORTANT**: The existing `count()` signature is `count(where, tx?)`. Adding `additionalConditions` as a positional parameter before `tx` would break existing callers that pass `count(where, tx)` (the `tx` value would be interpreted as `additionalConditions`). To avoid this breaking change, use an options object pattern:

```ts
async count(
    where: Record<string, unknown>,
    options?: { additionalConditions?: SQL[]; tx?: NodePgDatabase<typeof schema> }
): Promise<number>
```

All existing callers that use `count(where, tx)` must be migrated to `count(where, { tx })`. Search for all `count()` call sites and update them.

And to `findAllWithRelations()`:

```ts
async findAllWithRelations(
    relations: Record<string, boolean | Record<string, unknown>>,
    where: Record<string, unknown> = {},
    options: PaginatedListOptions = {},
    additionalConditions?: SQL[]
): Promise<{ items: T[]; total: number }>
```

**Implementation detail for `findAllWithRelations`**: This method passes `whereClause` directly to `db.query[tableName].findMany({ where: whereClause })`. Drizzle accepts SQL directly there, so combining works the same way:

> **Implementation caveat**: `findAllWithRelations()` uses `db.query[tableName].findMany()` (Drizzle's relational query API). Passing raw SQL to the `where` parameter works in practice (the current codebase already does this via `buildWhereClause()`), but this is not part of Drizzle's documented public API for the relational query builder. Add a targeted integration test to verify this behavior survives Drizzle upgrades.

```ts
// Inside findAllWithRelations, after building baseWhereClause:
const baseWhereClause = buildWhereClause(safeWhere, this.table as unknown);

const allConditions: SQL[] = [];
if (baseWhereClause) allConditions.push(baseWhereClause);
if (additionalConditions) allConditions.push(...additionalConditions);

const finalWhereClause = allConditions.length === 0
    ? undefined
    : allConditions.length === 1
        ? allConditions[0]
        : and(...allConditions);

// Use finalWhereClause in findMany AND in the count query
const [items, totalCount] = await Promise.all([
    typedQueryTable.findMany(queryOptions),
    this.count(safeWhere, { additionalConditions })
]);
```

**Critical**: The count query MUST receive the same `additionalConditions` as the main query. Otherwise, the pagination `total` will be incorrect (counting rows that the main query excludes).

**Important**: The existing callers of `findAll()`, `count()`, and `findAllWithRelations()` pass no `additionalConditions` argument, so the new parameter is purely additive and backward compatible.

#### 2.4. Fix search OR logic in `list()` (`packages/service-core/src/base/base.crud.read.ts`)

Replace the current AND-based search logic in `list()`:

**Current (buggy):**
```ts
if (search && search.trim().length > 0) {
    const searchColumns = this.getSearchableColumns();
    for (const col of searchColumns) {
        whereClause[`${col}_like`] = search.trim();
    }
}
```

**Fixed:**
```ts
let searchCondition: SQL | undefined;
if (search && search.trim().length > 0) {
    const searchColumns = this.getSearchableColumns();
    searchCondition = buildSearchCondition(search, searchColumns, this.model.getTable());
}
```

Then pass `searchCondition` as `additionalConditions` when calling `model.findAll()` or `model.findAllWithRelations()`:

```ts
const additionalConditions = searchCondition ? [searchCondition] : undefined;

const result = relationsToUse
    ? await this.model.findAllWithRelations(relationsToUse, whereClause, {
          page: processedOptions.page,
          pageSize: processedOptions.pageSize,
          sortBy,
          sortOrder
      }, additionalConditions)
    : await this.model.findAll(whereClause, {
          page: processedOptions.page,
          pageSize: processedOptions.pageSize,
          sortBy,
          sortOrder
      }, additionalConditions);
```

**Note**: This requires exposing `getTable()` on `BaseModel` as a public method:

```ts
// packages/db/src/base/base.model.ts
/** Returns the Drizzle table schema for this model. Used by service layer for search conditions. */
public getTable(): Table {
    return this.table;
}
```

### 3. API Design

No new endpoints. Existing admin list endpoints start respecting their declared query parameters.

#### Before (broken)

```
GET /api/v1/admin/accommodations?ownerId=UUID&type=HOTEL&status=DRAFT&sort=name:asc&search=hotel
-> Returns ALL accommodations, unfiltered, default sort, search matches nothing (AND bug)
```

#### After (fixed)

```
GET /api/v1/admin/accommodations?ownerId=UUID&type=HOTEL&status=DRAFT&sort=name:asc&search=hotel
-> Returns only DRAFT HOTEL accommodations owned by UUID where name OR description contains "hotel", sorted by name asc
```

Response format unchanged:

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": { "page": 1, "pageSize": 20, "total": 3, "totalPages": 1 }
  },
  "metadata": { "timestamp": "...", "requestId": "...", "total": 3, "count": 3 }
}
```

### 4. Dependencies

No new external dependencies. Uses only existing:
- `@repo/schemas` (AdminSearchBaseSchema, parseAdminSort, entity AdminSearchSchemas)
- `drizzle-orm` (`gte`, `lte`, `or` operators - already available, just adding to imports)

### 5. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Entities without `lifecycleState` break on `status` filter | Low | Medium | `buildWhereClause` silently skips columns not on the table. `status=ACTIVE` on tags table simply has no effect. Safe by default. Documented in "Tables without lifecycleState" section. |
| `_gte`/`_lte` operators in `buildWhereClause` affect existing code | Very Low | High | New suffixes only. No existing code uses `_gte`/`_lte` keys in where objects. Additive change only. |
| `additionalConditions` parameter breaks existing callers | None | N/A | Parameter is optional with `undefined` default. All existing callers pass no value. Fully backward compatible. |
| Some entity `_executeAdminSearch` overrides miss filters | Medium | Low | Default implementation handles simple eq filters. Only complex filters (JSONB, column renames) need overrides. Clearly documented per-service below. |
| Existing tests break from `list()` search OR fix | Low | Medium | The fix changes search behavior from AND to OR. Any test that relies on AND behavior for multi-column search is already testing broken behavior. In practice, search term matching ALL columns simultaneously is extremely unlikely. |
| `search` field double-processing (list already handles it) | None | N/A | `adminList()` has its own independent search handling via `buildSearchCondition()`. The `list()` method also gets the fix but remains independent. |
| JSONB SQL injection via sort field | Low | High | Sort field is validated against actual table columns. Invalid fields return 400. |
| `additionalConditions` on `findAllWithRelations` breaks Drizzle query builder | Low | Medium | `findAllWithRelations` uses `db.query[tableName].findMany()` which accepts `where` as raw SQL. Combining conditions via `and()` is safe. Tested in Phase 1. |
| `z.coerce.boolean()` bug on ALL boolean filter fields | High | Medium | Fixed in Phase 0 prerequisites. `z.coerce.boolean()` converts string `"false"` to `true`. ALL admin search schemas with boolean fields (`isFeatured`, `isBuiltin`, `isActive`, `isNews`, `isVerified`) are updated to use the shared `queryBooleanParam()` helper. |
| New `averageRating` column migration | Low | Low | Simple `ALTER TABLE ADD COLUMN`. Backfill script computes average from existing JSONB data. Non-destructive. |

### 6. Performance Considerations

- **Improvement, not regression**: Adding proper WHERE clauses reduces result sets, which is faster than returning everything and filtering client-side.
- **Indexed columns**: `ownerId`, `destinationId`, `type`, `lifecycleState`, `createdAt`, `deletedAt` already have indexes on most tables.
- **JSONB extraction**: `(price->>'price')::numeric` is not indexed by default. For high-volume queries, a partial index could be added later. Not needed for admin panel usage patterns.
- **OR search conditions**: `OR(ilike(col1, '%term%'), ilike(col2, '%term%'))` is slightly more expensive than a single `ilike`, but these are admin queries with pagination limits (max 100 items). Not a concern.
- **`averageRating` numeric column**: Simple numeric comparison is much faster than JSONB extraction + averaging. Can be indexed if needed.

---

## Implementation Approach

### Phase 0: Prerequisites - enum addition, schema fixes, review averageRating column

**File: `packages/schemas/src/enums/service-error-code.enum.ts`**

1. Add `CONFIGURATION_ERROR` to the `ServiceErrorCode` enum:

```ts
export enum ServiceErrorCode {
    /** Input validation failed */
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    /** Entity not found */
    NOT_FOUND = 'NOT_FOUND',
    /** User is not authenticated */
    UNAUTHORIZED = 'UNAUTHORIZED',
    /** User is not authorized to perform the action */
    FORBIDDEN = 'FORBIDDEN',
    /** Unexpected internal error */
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    /** Entity or assignment already exists */
    ALREADY_EXISTS = 'ALREADY_EXISTS',
    /** Invalid pagination parameters provided */
    INVALID_PAGINATION_PARAMS = 'INVALID_PAGINATION_PARAMS',
    /**
     * Method is not implemented.
     * Use this code for public service methods that are stubs or not yet implemented.
     * Always return this error via the homogeneous pipeline (runWithLoggingAndValidation).
     */
    NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
    /** External service or dependency is not available or not configured */
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
    /** Service method called without required configuration */
    CONFIGURATION_ERROR = 'CONFIGURATION_ERROR'
}
```

**HTTP status code mapping**: `CONFIGURATION_ERROR` must be mapped to HTTP 500 (Internal Server Error) in the `ResponseFactory` error-to-HTTP-status mapping. This is a server-side configuration issue, not a client error. Update the status code mapping in `apps/api/src/utils/response-factory.ts` (or wherever the error code to HTTP status mapping is defined) to include:

```ts
[ServiceErrorCode.CONFIGURATION_ERROR]: 500
```

**File: `packages/schemas/src/entities/tag/tag.admin-search.schema.ts`**

2. Remove the `nameContains` field from `TagAdminSearchSchema`. This field is redundant with the `search` field from `AdminSearchBaseSchema` which already does ILIKE search across searchable columns.

   > **Frontend impact check**: Before removing `nameContains`, verify whether the admin frontend currently sends `nameContains` as a query parameter for the tags list. Search `apps/admin/` for `nameContains`. If the frontend sends it, update the frontend to use `search` instead, or add a deprecation period where both are accepted (map `nameContains` to `search` in the route handler temporarily).

**File: `packages/schemas/src/common/query-helpers.ts`** (NEW)

3. Create a shared helper for safe boolean parsing from query string parameters. `z.coerce.boolean()` incorrectly converts the string `"false"` to `true` (via `Boolean("false")`). This bug affects ALL admin search schemas with boolean fields, not just `isVerified`:

```ts
import { z } from 'zod';

/**
 * Safe boolean parser for query string parameters.
 * Unlike z.coerce.boolean(), this correctly handles the string "false"
 * (which z.coerce.boolean() converts to true via Boolean("false")).
 *
 * @returns Zod schema that correctly parses "true"/"false"/"1"/"0" strings
 */
export function queryBooleanParam() {
    return z.preprocess(
        (val) => {
            if (val === undefined || val === null || val === '') return undefined;
            return val === 'true' || val === true || val === '1';
        },
        z.boolean()
    ).optional();
}
```

4. Export `queryBooleanParam` from `packages/schemas/src/common/index.ts`.

5. Replace ALL `z.coerce.boolean().optional()` usages in admin search schemas with `queryBooleanParam()`:

| Schema File | Field(s) |
|-------------|----------|
| `AccommodationAdminSearchSchema` | `isFeatured` |
| `AttractionAdminSearchSchema` | `isFeatured` |
| `EventAdminSearchSchema` | `isFeatured` |
| `PostAdminSearchSchema` | `isFeatured`, `isNews` |
| `DestinationAdminSearchSchema` | `isFeatured` |
| `AmenityAdminSearchSchema` | `isBuiltin` |
| `FeatureAdminSearchSchema` | `isBuiltin` |
| `OwnerPromotionAdminSearchSchema` | `isActive` |
| `EventLocationAdminSearchSchema` | `isVerified` |
| `EventOrganizerAdminSearchSchema` | `isVerified` |
| `AccommodationReviewAdminSearchSchema` | `isVerified` |
| `DestinationReviewAdminSearchSchema` | `isVerified` |

Each schema file must import `queryBooleanParam` from `@repo/schemas/common/query-helpers` and replace:

```ts
// Change from:
isFeatured: z.coerce.boolean().optional()
// To:
isFeatured: queryBooleanParam()
```

> **Note on Zod 4:** The project uses Zod 4.0.8. If `z.stringbool()` is available in this version, it could be used as an alternative to the custom `queryBooleanParam()` helper. Verify availability before implementation.

6. Add tests for the `queryBooleanParam()` helper (see Testing Strategy section for details).

**Database migration: Add `averageRating` to review tables**

7. Generate a new migration adding `averageRating` numeric(3,2) NOT NULL DEFAULT 0 to `accommodation_reviews` and `destination_reviews` tables:

```sql
ALTER TABLE accommodation_reviews ADD COLUMN average_rating numeric(3,2) NOT NULL DEFAULT 0;
ALTER TABLE destination_reviews ADD COLUMN average_rating numeric(3,2) NOT NULL DEFAULT 0;

-- Backfill from existing JSONB data
UPDATE accommodation_reviews SET average_rating = (
    (COALESCE((rating->>'cleanliness')::numeric, 0) +
     COALESCE((rating->>'hospitality')::numeric, 0) +
     COALESCE((rating->>'services')::numeric, 0) +
     COALESCE((rating->>'accuracy')::numeric, 0) +
     COALESCE((rating->>'communication')::numeric, 0) +
     COALESCE((rating->>'location')::numeric, 0)) / 6.0
);

-- Destination reviews have 18 dimensions - compute average of all
-- Use COALESCE to handle NULL ratings (jsonb_each_text returns empty set for NULL,
-- causing AVG() to return NULL which would violate the NOT NULL constraint)
UPDATE destination_reviews SET average_rating = COALESCE(
    (SELECT AVG(val::numeric)
     FROM jsonb_each_text(rating) AS kv(key, val)
     WHERE val IS NOT NULL),
    0
)
WHERE rating IS NOT NULL;
```

8. Update Drizzle schema to include the new column in both `accommodationReviewTable` and `destinationReviewTable`.

9. Update `calculateStatsFromReviews()` in `packages/service-core/src/services/accommodationReview/accommodationReview.helpers.ts` to also compute and store the per-review `averageRating` when creating/updating reviews.

10. Update `calculateStatsFromReviews()` in `packages/service-core/src/services/destinationReview/destinationReview.helpers.ts` similarly.

11. Add tests for the prerequisite changes (enum, schema fixes, queryBooleanParam helper, averageRating computation).

12. Check if the `search_index` materialized view (managed by `packages/db/scripts/apply-postgres-extras.sh`) needs updating for the new `averageRating` column. If the materialized view includes review data or aggregated ratings, update it to include `averageRating`. Reference ADR-017 and the triggers manifest at `packages/db/docs/triggers-manifest.md`. After any `drizzle-kit push` or migration, run `apply-postgres-extras.sh` to reapply triggers and materialized views.

### Phase 1: Infrastructure - buildWhereClause operators and search utility

**File: `packages/db/src/utils/drizzle-helpers.ts`**

13. Add `gte`, `lte`, `or` to the import from `drizzle-orm`
14. Add `_gte` suffix handling in `buildWhereClause` (before the final eq fallback)
15. Add `_lte` suffix handling in `buildWhereClause` (before the final eq fallback)
16. Add `buildSearchCondition()` exported function (OR-based ilike across columns)
17. Add unit tests for `_gte` operator with dates, numbers, and missing columns
18. Add unit tests for `_lte` operator with dates, numbers, and missing columns
19. Add unit tests for `buildSearchCondition()` with single column, multiple columns, empty term, and missing columns

**File: `packages/db/src/base/base.model.ts`**

20. Add `public getTable(): Table` method to `BaseModel`
21. Add `additionalConditions?: SQL[]` parameter to `findAll()` signature
22. Combine `buildWhereClause` result with `additionalConditions` using `and()` in `findAll()`
23. Refactor `count()` signature to use options object: `count(where, options?: { additionalConditions?: SQL[]; tx?: Transaction })`. Migrate all existing `count(where, tx)` callers to `count(where, { tx })`. Combine `additionalConditions` with the base where clause using `and()`.
24. Add `additionalConditions?: SQL[]` parameter to `findAllWithRelations()` signature and combine similarly (see section 2.3 for implementation detail)
25. Add unit tests for `findAll()` with additionalConditions
26. Add unit tests for `count()` with options object: `count(where, { additionalConditions })`, `count(where, { tx })`, and `count(where)` (backward compat)

### Phase 2: Fix search OR bug in list()

**File: `packages/service-core/src/base/base.crud.read.ts`**

27. Import `buildSearchCondition` from `@repo/db/utils/drizzle-helpers`
28. Import `SQL` type from `drizzle-orm`
29. Replace the for-loop search logic (lines 187-192 approximately) with `buildSearchCondition()` call
30. Pass resulting SQL condition as `additionalConditions` to `model.findAll()` and `model.findAllWithRelations()`
31. Add unit tests verifying search uses OR logic (search "hotel" matches name OR description)

> **Note on UserService**: `UserService` overrides `list()` completely and does NOT call `super.list()`. It uses `this.model.findAllWithCounts()` directly. The search OR fix in this phase does NOT apply to UserService's `list()` method. This is acceptable because: (1) the admin endpoint will use `adminList()` which has correct OR search, and (2) UserService's public list endpoint is primarily used for admin views that are now switching to `adminList()`. If UserService's public `list()` needs the OR fix in the future, it must be applied directly in the override.

### Phase 3: Core - adminList() infrastructure

**File: `packages/service-core/src/base/base.crud.permissions.ts`**

32. Add optional `adminSearchSchema` property:
    ```ts
    /** Optional Zod schema for validating admin list search input. */
    protected adminSearchSchema?: ZodObject;
    ```

**File: `packages/service-core/src/base/base.crud.read.ts`**

33. Add `adminList()` public method to `BaseCrudRead`:

```ts
/**
 * Fetches a paginated, filtered list of entities for admin use.
 *
 * Unlike list(), this method processes AdminSearchBaseSchema fields
 * (sort, status, includeDeleted, createdAfter/Before, search) and
 * delegates entity-specific filters to _executeAdminSearch().
 *
 * @param actor - The user performing the action.
 * @param params - The admin search parameters (validated by route against entity AdminSearchSchema).
 * @returns A ServiceOutput containing the paginated list or a ServiceError.
 */
public async adminList(
    actor: Actor,
    params: Record<string, unknown>
): Promise<ServiceOutput<PaginatedListOutput<TEntity>>>
```

Method body (pseudo-code):

```ts
return this.runWithLoggingAndValidation({
    methodName: 'adminList',
    input: { actor, ...params },
    schema: z.record(z.unknown()), // Loose schema: adminSearchSchema is entity-specific and set at subclass level, so it cannot be referenced here. Real validation happens inside execute() via this.adminSearchSchema.safeParse().
    execute: async (rawParams, validatedActor) => {
        // 1. Check adminSearchSchema is configured
        if (!this.adminSearchSchema) {
            throw new ServiceError(
                ServiceErrorCode.CONFIGURATION_ERROR,
                `adminList() requires adminSearchSchema to be configured on ${this.entityName}Service`
            );
        }

        // 2. Validate params against adminSearchSchema
        const parseResult = this.adminSearchSchema.safeParse(rawParams);
        if (!parseResult.success) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                `Invalid admin search params: ${parseResult.error.message}`
            );
        }
        const validParams = parseResult.data as Record<string, unknown>;

        // 3. Permission check
        await this._canList(validatedActor);

        // 4. Destructure base fields from entity-specific fields
        const {
            page,
            pageSize,
            search,
            sort,
            status,
            includeDeleted,
            createdAfter,
            createdBefore,
            ...entityFilters
        } = validParams as {
            page: number;
            pageSize: number;
            search?: string;
            sort: string;
            status: string;
            includeDeleted: boolean;
            createdAfter?: Date;
            createdBefore?: Date;
            [key: string]: unknown;
        };

        // 5. Parse sort
        const { field: sortBy, direction: sortOrder } = parseAdminSort(sort);

        // 6. Validate sort field exists on the table
        const table = this.model.getTable();
        const tableRecord = table as unknown as Record<string, unknown>;
        if (!Object.prototype.hasOwnProperty.call(tableRecord, sortBy)) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                `Invalid sort field "${sortBy}": column does not exist on ${this.entityName} table`
            );
        }

        // 7. Build where clause from base fields
        const where: Record<string, unknown> = {};

        // status -> lifecycleState mapping
        if (status && status !== 'all') {
            where.lifecycleState = status;
        }

        // includeDeleted behavior
        if (!includeDeleted) {
            where.deletedAt = null; // buildWhereClause converts null to IS NULL
        }

        // createdAfter/Before -> _gte/_lte
        if (createdAfter) {
            where.createdAt_gte = createdAfter;
        }
        if (createdBefore) {
            where.createdAt_lte = createdBefore;
        }

        // 8. Build search OR condition
        const searchCondition = search
            ? buildSearchCondition(search, this.getSearchableColumns(), table)
            : undefined;

        // 9. Delegate to _executeAdminSearch
        return this._executeAdminSearch({
            where,
            entityFilters,
            pagination: { page, pageSize },
            sort: { sortBy, sortOrder },
            search: searchCondition,
            actor: validatedActor
        });
    }
});
```

> **Design Decision: No admin list hooks.** Unlike `list()` which calls `_beforeList()`/`_afterList()` hooks, `adminList()` does NOT have equivalent hooks (`_beforeAdminList`/`_afterAdminList`). Admin list queries should be straightforward filtered queries without normalizers or transformations. If a service needs pre/post processing for admin lists, it should override `_executeAdminSearch()`.

34. Add default `_executeAdminSearch()` protected method:

```ts
/**
 * Executes the admin search query. Default implementation merges entityFilters
 * into where clause (for simple equality filters) and calls model.findAll()
 * or model.findAllWithRelations() depending on getDefaultListRelations().
 *
 * Override in services that need complex filters (JSONB extraction, date ranges,
 * column renames, etc.). Overrides should extract complex filters from entityFilters,
 * build SQL conditions, and pass them as extraConditions to super._executeAdminSearch().
 *
 * @param params - Structured admin search parameters
 * @returns Paginated list of entities
 */
protected async _executeAdminSearch(params: {
    where: Record<string, unknown>;
    entityFilters: Record<string, unknown>;
    pagination: { page: number; pageSize: number };
    sort: { sortBy: string; sortOrder: 'asc' | 'desc' };
    search?: SQL;
    extraConditions?: SQL[];  // For complex filters from overrides
    actor: Actor;
}): Promise<PaginatedListOutput<TEntity>> {
    const { where, entityFilters, pagination, sort, search, extraConditions } = params;

    // Default: merge all entityFilters as simple eq conditions
    const mergedWhere = { ...where, ...entityFilters };

    // Collect additional SQL conditions
    const additionalConditions: SQL[] = [];
    if (search) additionalConditions.push(search);
    if (extraConditions) additionalConditions.push(...extraConditions);

    const relationsToUse = this.getDefaultListRelations();

    const result = relationsToUse
        ? await this.model.findAllWithRelations(
              relationsToUse,
              mergedWhere,
              { ...pagination, ...sort },
              additionalConditions.length > 0 ? additionalConditions : undefined
          )
        : await this.model.findAll(
              mergedWhere,
              { ...pagination, sortBy: sort.sortBy, sortOrder: sort.sortOrder },
              additionalConditions.length > 0 ? additionalConditions : undefined
          );

    return result;
}
```

35. Add unit tests for `adminList()` base behavior:
    - Sort parsing from compound string
    - Invalid sort field returns VALIDATION_ERROR
    - Status filter mapping (status=ACTIVE -> lifecycleState=ACTIVE, status=all -> no filter)
    - includeDeleted=false adds deletedAt=null, includeDeleted=true skips it
    - createdAfter/Before mapped to _gte/_lte
    - Search uses OR condition
    - Permission check calls _canList
    - Missing adminSearchSchema throws CONFIGURATION_ERROR
    - Entity filters passed through to _executeAdminSearch

### Phase 4: Sponsorship schema migration

**File: `packages/schemas/src/entities/sponsorship/sponsorship.admin-search.schema.ts`** (NEW)

36. Create `SponsorshipAdminSearchSchema` extending `AdminSearchBaseSchema`:

```ts
import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { SponsorshipStatusEnumSchema } from '../../enums/sponsorship-status.schema.js';
import { SponsorshipTargetTypeEnumSchema } from '../../enums/sponsorship-target-type.schema.js';

export const SponsorshipAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by sponsor user UUID */
    sponsorUserId: z.string().uuid().optional().describe('Filter by sponsor user'),

    /** Filter by target type */
    targetType: SponsorshipTargetTypeEnumSchema.optional().describe('Filter by target type'),

    /** Filter by target entity UUID */
    targetId: z.string().uuid().optional().describe('Filter by target entity'),

    /** Filter by sponsorship status */
    sponsorshipStatus: SponsorshipStatusEnumSchema.optional().describe('Filter by sponsorship status')
});

export type SponsorshipAdminSearch = z.infer<typeof SponsorshipAdminSearchSchema>;
```

**Note on `sponsorshipStatus` vs base `status`**: The field is named `sponsorshipStatus` (not `status`) to avoid collision with the base `status` field which maps to `lifecycleState`. The `sponsorships` table has NO `lifecycleState` column. It uses a `status` enum column (pending/active/expired/cancelled) which represents a fundamentally different lifecycle model. The base `status` filter from `AdminSearchBaseSchema` will be silently ignored because there is no `lifecycleState` column on the table. Only the `sponsorshipStatus` filter (mapped to `status` column in the override) matters.

37. Export from `packages/schemas/src/entities/sponsorship/index.ts`
38. Add tests for SponsorshipAdminSearchSchema

### Phase 5: Services - wire up adminSearchSchema and overrides

For each service, add the `adminSearchSchema` property and, where needed, override `_executeAdminSearch()`.

> **Note on service class hierarchy**: Services `AmenityService`, `FeatureService`, `TagService`, and `AttractionService` extend `BaseCrudRelatedService` (not `BaseCrudService` directly). `BaseCrudRelatedService extends BaseCrudService`, so these services inherit `adminList()` and `_executeAdminSearch()` without issues. No special handling needed.

#### Services with DEFAULT implementation (simple eq filters only)

These services set `adminSearchSchema` but do NOT override `_executeAdminSearch()`. All their entity-specific filters are simple column equality comparisons that `buildWhereClause` handles natively.

39. **AmenityService** (`packages/service-core/src/services/amenity/amenity.service.ts`)
    - Schema: `AmenityAdminSearchSchema`
    - Entity filters: `category`, `isBuiltin` (both simple eq on real columns)

40. **FeatureService** (`packages/service-core/src/services/feature/feature.service.ts`)
    - Schema: `FeatureAdminSearchSchema`
    - Entity filters: `category` (simple eq), `isBuiltin` (boolean, simple eq)

41. **TagService** (`packages/service-core/src/services/tag/tag.service.ts`)
    - Schema: `TagAdminSearchSchema`
    - Entity filters: `color` (hex string, simple eq)
    - **Note**: `nameContains` was removed from the schema in Phase 0 (step 2). Text search is handled by the base `search` field via `buildSearchCondition()`.

42. **AttractionService** (`packages/service-core/src/services/attraction/attraction.service.ts`)
    - Schema: `AttractionAdminSearchSchema`
    - Entity filters: `category` (simple eq), `destinationId` (uuid, simple eq), `isFeatured` (boolean, simple eq)

43. **EventLocationService** (`packages/service-core/src/services/eventLocation/eventLocation.service.ts`)
    - Schema: `EventLocationAdminSearchSchema`
    - Entity filters: `city` (simple eq on real DB column)
    - **Note**: The schema also declares `minCapacity`, `maxCapacity`, and `isVerified`, but these are phantom fields with no corresponding DB columns on `event_locations`. They will be silently ignored by `buildWhereClause` (column not found on table). DEFERRED: Adding `destinationId` FK to `event_locations` and capacity/isVerified columns is tracked separately (see SPEC-050).

44. **EventOrganizerService** (`packages/service-core/src/services/eventOrganizer/eventOrganizer.service.ts`)
    - Schema: `EventOrganizerAdminSearchSchema`
    - Entity filters: `isVerified` (boolean, simple eq)

45. **OwnerPromotionService** (`packages/service-core/src/services/owner-promotion/owner-promotion.service.ts`)
    - Schema: `OwnerPromotionAdminSearchSchema`
    - Entity filters: `accommodationId` (uuid, simple eq), `ownerId` (uuid, simple eq), `discountType` (enum, simple eq), `isActive` (boolean, simple eq)
    - **Note**: The `owner_promotions` table has NO `lifecycleState` column (uses `isActive` boolean instead). The base `status` filter from `AdminSearchBaseSchema` will be silently ignored because `buildWhereClause` skips unknown columns. Migration to `lifecycleState` is tracked separately.

46. **PostSponsorService** (`packages/service-core/src/services/postSponsor/postSponsor.service.ts`)
    - Schema: `PostSponsorAdminSearchSchema`
    - Entity filters: `type` (ClientTypeEnum, simple eq)

#### Services with OVERRIDE (complex JSONB, column renames, or special filters)

47. **AccommodationService** (`packages/service-core/src/services/accommodation/accommodation.service.ts`)
    - Schema: `AccommodationAdminSearchSchema`
    - Simple eq filters (handled by default): `type`, `destinationId`, `ownerId`, `isFeatured`
    - **Complex filters requiring override**: `minPrice`, `maxPrice`
    - JSONB column: `price` with structure `{ "price": number, "currency": string, ... }`
    - Override extracts `minPrice`/`maxPrice` from `entityFilters`, builds SQL conditions, and delegates to `super._executeAdminSearch()` which handles `getDefaultListRelations()`:

    ```ts
    protected override async _executeAdminSearch(params: {
        where: Record<string, unknown>;
        entityFilters: Record<string, unknown>;
        pagination: { page: number; pageSize: number };
        sort: { sortBy: string; sortOrder: 'asc' | 'desc' };
        search?: SQL;
        extraConditions?: SQL[];
        actor: Actor;
    }): Promise<PaginatedListOutput<TEntity>> {
        const { entityFilters, ...rest } = params;
        const { minPrice, maxPrice, ...simpleFilters } = entityFilters as {
            minPrice?: number;
            maxPrice?: number;
            [key: string]: unknown;
        };

        const extraConditions: SQL[] = [...(params.extraConditions ?? [])];

        // JSONB price extraction
        if (minPrice !== undefined) {
            extraConditions.push(
                sql`(${accommodationTable.price}->>'price')::numeric >= ${minPrice}`
            );
        }
        if (maxPrice !== undefined) {
            extraConditions.push(
                sql`(${accommodationTable.price}->>'price')::numeric <= ${maxPrice}`
            );
        }

        // Admin sees everything - no VIP/excludeRestricted filter.
        // ACCOMMODATION_VIEW_ALL permission (required by the admin route) covers this.

        return super._executeAdminSearch({
            ...rest,
            entityFilters: simpleFilters,
            extraConditions
        });
    }
    ```

    **VIP access note**: `_executeAdminSearch` for AccommodationService does NOT filter by VIP/excludeRestricted. The `ACCOMMODATION_VIEW_ALL` permission (required by the admin route) already covers this. Admin sees everything.

    > **JSONB data integrity note**: The `(price->>'price')::numeric` cast will throw a PostgreSQL error if the JSONB `price` field contains non-castable values (e.g., `"price": "free"` or `"price": "N/A"`). The same applies to EventService's `(date->>'start')::timestamptz` casts. If JSONB data integrity cannot be guaranteed, wrap the casts in a SQL `CASE` expression or handle the database error gracefully at the service level. For now, this is acceptable because the seeder and create/update schemas enforce correct types via Zod validation.

48. **EventService** (`packages/service-core/src/services/event/event.service.ts`)
    - Schema: `EventAdminSearchSchema`
    - Relations: `{ organizer: true, location: true }`
    - Simple eq filters: `category`, `locationId`, `organizerId`, `authorId`, `isFeatured`
    - **Complex filters requiring override**: `startDateAfter`, `startDateBefore`, `endDateAfter`, `endDateBefore`
    - JSONB column: `date` with type `EventDate` containing `start` and `end` fields (NOT `startDate`/`endDate`)
    - Override extracts date range filters, builds SQL conditions, and delegates to `super._executeAdminSearch()`:

    ```ts
    protected override async _executeAdminSearch(params: { ... }): Promise<PaginatedListOutput<TEntity>> {
        const { entityFilters, ...rest } = params;
        const { startDateAfter, startDateBefore, endDateAfter, endDateBefore, ...simpleFilters } = entityFilters as {
            startDateAfter?: Date;
            startDateBefore?: Date;
            endDateAfter?: Date;
            endDateBefore?: Date;
            [key: string]: unknown;
        };

        const extraConditions: SQL[] = [...(params.extraConditions ?? [])];

        // JSONB date extraction - EventDateSchema uses 'start' and 'end' keys
        if (startDateAfter) {
            extraConditions.push(
                sql`(${eventTable.date}->>'start')::timestamptz >= ${startDateAfter}`
            );
        }
        if (startDateBefore) {
            extraConditions.push(
                sql`(${eventTable.date}->>'start')::timestamptz <= ${startDateBefore}`
            );
        }
        if (endDateAfter) {
            extraConditions.push(
                sql`(${eventTable.date}->>'end')::timestamptz >= ${endDateAfter}`
            );
        }
        if (endDateBefore) {
            extraConditions.push(
                sql`(${eventTable.date}->>'end')::timestamptz <= ${endDateBefore}`
            );
        }

        return super._executeAdminSearch({
            ...rest,
            entityFilters: simpleFilters,
            extraConditions
        });
    }
    ```

    **Note**: The query param names (`startDateAfter`, `startDateBefore`, `endDateAfter`, `endDateBefore`) remain as-is in the `EventAdminSearchSchema`. They are descriptive filter names. The JSONB keys they map to are `start` and `end` respectively (from `EventDateSchema`).

49. **PostService** (`packages/service-core/src/services/post/post.service.ts`)
    - Schema: `PostAdminSearchSchema`
    - Entity filters: `category` (PostCategoryPgEnum, direct column), `authorId` (uuid FK, direct column), `isFeatured` (boolean, direct column), `isNews` (boolean, direct column), `relatedDestinationId` (uuid FK, direct column)
    - All filters are simple eq on direct columns. **No override needed.** Default implementation handles all.

50. **UserService** (`packages/service-core/src/services/user/user.service.ts`)
    - Schema: `UserAdminSearchSchema`
    - Simple eq filters: `role` (RolePgEnum, direct column), `authProvider` (text, direct column)
    - **Partial match filter requiring override**: `email` (text, direct column, defined as "partial match" in schema)
    - Override extracts `email` from `entityFilters` and builds an ilike condition:

    ```ts
    protected override async _executeAdminSearch(params: { ... }): Promise<PaginatedListOutput<TEntity>> {
        const { where, entityFilters, pagination, sort, search, extraConditions, actor } = params;
        const { email, ...simpleFilters } = entityFilters as {
            email?: string;
            [key: string]: unknown;
        };

        const additionalConditions: SQL[] = [...(extraConditions ?? [])];
        if (search) additionalConditions.push(search);

        // email partial match (ilike, not eq)
        if (email) {
            additionalConditions.push(
                ilike(userTable.email, `%${email}%`)
            );
        }

        const mergedWhere = { ...where, ...simpleFilters };
        const result = await this.model.findAll(
            mergedWhere,
            { ...pagination, sortBy: sort.sortBy, sortOrder: sort.sortOrder },
            additionalConditions.length > 0 ? additionalConditions : undefined
        );
        return result;
    }
    ```

    > **INTENTIONAL: bypasses `getDefaultListRelations()`.** This override calls `this.model.findAll()` directly instead of delegating to `super._executeAdminSearch()`. This is intentional because:
    > - User admin lists do not need relations loaded (no nested entities to display in the user DataTable).
    > - Direct `findAll()` is more performant for user listings since it avoids JOIN overhead.
    > - If relations are needed in the future (e.g., showing user's accommodation count), this override should be updated to call `super._executeAdminSearch()` instead.

51. **DestinationService** (`packages/service-core/src/services/destination/destination.service.ts`)
    - Schema: `DestinationAdminSearchSchema`
    - Entity filters: `destinationType` (DestinationTypePgEnum, direct column), `parentDestinationId` (uuid self-FK, direct column), `level` (integer 0-6, direct column), `isFeatured` (boolean, direct column)
    - All filters are simple eq on direct columns. **No override needed.** Default implementation handles all.

52. **AccommodationReviewService** (`packages/service-core/src/services/accommodationReview/...`)
    - Schema: `AccommodationReviewAdminSearchSchema`
    - Relations: `{ user: true, accommodation: true }`
    - Simple eq filters: `accommodationId`, `userId`, `isVerified`
    - **Range filters requiring override**: `minRating`, `maxRating`
    - Uses the new `averageRating` numeric(3,2) column added in Phase 0 (NOT JSONB extraction)
    - Override extracts `minRating`/`maxRating`, builds SQL conditions, and delegates to `super._executeAdminSearch()`:

    ```ts
    protected override async _executeAdminSearch(params: { ... }): Promise<PaginatedListOutput<TEntity>> {
        const { entityFilters, ...rest } = params;
        const { minRating, maxRating, ...simpleFilters } = entityFilters as {
            minRating?: number;
            maxRating?: number;
            [key: string]: unknown;
        };

        const extraConditions: SQL[] = [...(params.extraConditions ?? [])];

        if (minRating !== undefined) {
            extraConditions.push(
                gte(accommodationReviewTable.averageRating, minRating)
            );
        }
        if (maxRating !== undefined) {
            extraConditions.push(
                lte(accommodationReviewTable.averageRating, maxRating)
            );
        }

        return super._executeAdminSearch({
            ...rest,
            entityFilters: simpleFilters,
            extraConditions
        });
    }
    ```

53. **DestinationReviewService** (`packages/service-core/src/services/destinationReview/...`)
    - Schema: `DestinationReviewAdminSearchSchema`
    - Relations: `{ user: true, destination: true }`
    - Simple eq filters: `destinationId`, `userId`, `isVerified`
    - **Range filters requiring override**: `minRating`, `maxRating`
    - Uses the new `averageRating` numeric(3,2) column added in Phase 0 (same pattern as AccommodationReviewService)
    - Override extracts `minRating`/`maxRating`, builds SQL conditions, and delegates to `super._executeAdminSearch()`:

    ```ts
    protected override async _executeAdminSearch(params: { ... }): Promise<PaginatedListOutput<TEntity>> {
        const { entityFilters, ...rest } = params;
        const { minRating, maxRating, ...simpleFilters } = entityFilters as {
            minRating?: number;
            maxRating?: number;
            [key: string]: unknown;
        };

        const extraConditions: SQL[] = [...(params.extraConditions ?? [])];

        if (minRating !== undefined) {
            extraConditions.push(
                gte(destinationReviewTable.averageRating, minRating)
            );
        }
        if (maxRating !== undefined) {
            extraConditions.push(
                lte(destinationReviewTable.averageRating, maxRating)
            );
        }

        return super._executeAdminSearch({
            ...rest,
            entityFilters: simpleFilters,
            extraConditions
        });
    }
    ```

54. **SponsorshipService** (`packages/service-core/src/services/sponsorship/sponsorship.service.ts`)
    - Schema: `SponsorshipAdminSearchSchema`
    - Relations: `{ sponsorUser: true, level: true, package: true }`
    - Entity filters: `sponsorUserId`, `targetType`, `targetId`, `sponsorshipStatus` (column rename needed)
    - **Override needed** because `sponsorshipStatus` field name differs from the `status` column name on the `sponsorships` table:

    ```ts
    protected override async _executeAdminSearch(params: { ... }): Promise<PaginatedListOutput<TEntity>> {
        const { entityFilters, ...rest } = params;
        // Rename sponsorshipStatus -> status for the DB column
        const { sponsorshipStatus, ...otherFilters } = entityFilters as { sponsorshipStatus?: string; [key: string]: unknown };
        const mappedFilters = { ...otherFilters };
        if (sponsorshipStatus) {
            mappedFilters.status = sponsorshipStatus;
        }
        return super._executeAdminSearch({ ...rest, entityFilters: mappedFilters });
    }
    ```

    **Note**: The `sponsorships` table has NO `lifecycleState` column. The base `status` filter from `AdminSearchBaseSchema` maps to `lifecycleState` which does not exist on this table, so it will be silently ignored by `buildWhereClause`. Only the `sponsorshipStatus` filter (mapped to the `status` column via this override) applies. This is intentional - the sponsorship lifecycle (pending/active/expired/cancelled) is a different model from the standard entity lifecycle (draft/active/archived).

### Phase 6: Routes - switch to adminList()

**All 16 admin list route files in `apps/api/src/routes/`**

55. Update each route handler to call `service.adminList(actor, query)` instead of `service.list(actor, { ...query })`:

**Before:**
```ts
handler: async (ctx, _params, _body, query) => {
    const actor = getActorFromContext(ctx);
    const { page, pageSize } = extractPaginationParams(query || {});
    const result = await accommodationService.list(actor, { ...query });
    // ...
}
```

**After:**
```ts
handler: async (ctx, _params, _body, query) => {
    const actor = getActorFromContext(ctx);
    const { page, pageSize } = extractPaginationParams(query || {});
    const result = await accommodationService.adminList(actor, query || {});
    // ...
}
```

The 16 route files to update:

| # | File Path | Service Call Change |
|---|-----------|-------------------|
| 1 | `apps/api/src/routes/accommodation/admin/list.ts` | `accommodationService.adminList(actor, query \|\| {})` |
| 2 | `apps/api/src/routes/user/admin/list.ts` | `userService.adminList(actor, query \|\| {})` |
| 3 | `apps/api/src/routes/destination/admin/list.ts` | `destinationService.adminList(actor, query \|\| {})` |
| 4 | `apps/api/src/routes/event/admin/list.ts` | `eventService.adminList(actor, query \|\| {})` |
| 5 | `apps/api/src/routes/post/admin/list.ts` | `postService.adminList(actor, query \|\| {})` |
| 6 | `apps/api/src/routes/amenity/admin/list.ts` | `amenityService.adminList(actor, query \|\| {})` |
| 7 | `apps/api/src/routes/feature/admin/list.ts` | `featureService.adminList(actor, query \|\| {})` |
| 8 | `apps/api/src/routes/tag/admin/list.ts` | `tagService.adminList(actor, query \|\| {})` |
| 9 | `apps/api/src/routes/attraction/admin/list.ts` | `attractionService.adminList(actor, query \|\| {})` |
| 10 | `apps/api/src/routes/event-location/admin/list.ts` | `eventLocationService.adminList(actor, query \|\| {})` |
| 11 | `apps/api/src/routes/event-organizer/admin/list.ts` | `eventOrganizerService.adminList(actor, query \|\| {})` |
| 12 | `apps/api/src/routes/owner-promotion/admin/list.ts` | `ownerPromotionService.adminList(actor, query \|\| {})` |
| 13 | `apps/api/src/routes/postSponsor/admin/list.ts` | `postSponsorService.adminList(actor, query \|\| {})` |
| 14 | `apps/api/src/routes/accommodation/reviews/admin/list.ts` | `accommodationReviewService.adminList(actor, query \|\| {})` |
| 15 | `apps/api/src/routes/destination/reviews/admin/list.ts` | `destinationReviewService.adminList(actor, query \|\| {})` |
| 16 | `apps/api/src/routes/sponsorship/admin/list.ts` | `sponsorshipService.adminList(actor, query \|\| {})` + change `requestQuery` to `SponsorshipAdminSearchSchema.omit({ page: true, pageSize: true }).shape` |

56. Sponsorship route: also update `requestQuery` from `SponsorshipSearchSchema.omit({ page: true, limit: true }).shape` to `SponsorshipAdminSearchSchema.omit({ page: true, pageSize: true }).shape` and add the import. All other admin list routes must also use the `.omit({ page: true, pageSize: true })` pattern on their entity AdminSearchSchema to avoid duplicate pagination params in OpenAPI (see Design Decision: page/pageSize overlap).

### Phase 7: Integration testing

57. Integration tests for accommodation admin list (`apps/api/test/routes/admin/accommodation-list.test.ts`):
    - Filter by `ownerId` returns only matching accommodations
    - Filter by `type=HOTEL` returns only hotels
    - Filter by `status=DRAFT` returns only drafts
    - `sort=name:asc` returns sorted results
    - `sort=invalidCol:asc` returns 400
    - `includeDeleted=true` includes soft-deleted
    - `includeDeleted=false` (default) excludes soft-deleted
    - `search=hotel` matches name OR description (OR logic)
    - `minPrice=50&maxPrice=200` filters by JSONB price field
    - Combined filters: `ownerId=X&type=HOTEL&status=ACTIVE` intersects all conditions
    - `createdAfter=date` + `createdBefore=date` filters by date range
    - Empty result when no matches (returns `{ items: [], pagination: { total: 0 } }`)

58. Integration tests for event admin list (`apps/api/test/routes/admin/event-list.test.ts`):
    - `startDateAfter`/`startDateBefore` JSONB date extraction (using `->>'start'` key)
    - `endDateAfter`/`endDateBefore` JSONB date extraction (using `->>'end'` key)
    - `organizerId` simple eq filter
    - `category` simple eq filter

59. Integration tests for user admin list (`apps/api/test/routes/admin/user-list.test.ts`):
    - `role` filter
    - `search` by name/email (OR)

60. Integration tests for simple entity admin list (`apps/api/test/routes/admin/amenity-list.test.ts`):
    - `category` simple eq filter (default _executeAdminSearch)
    - Verifies the default implementation works without override

61. Integration tests for accommodation review admin list:
    - `minRating`/`maxRating` using `averageRating` numeric column (gte/lte, not JSONB)
    - `accommodationId` simple eq filter

62. Integration tests for sponsorship admin list:
    - `sponsorshipStatus` filter (mapped to `status` column)
    - Base `status` filter silently ignored (no `lifecycleState` column)
    - `sponsorUserId`, `targetType` simple eq filters

63. Integration test for destination admin list (no override entity WITH relations):
    - `destinationType` simple eq filter via default `_executeAdminSearch`
    - `isFeatured` boolean filter
    - Verify response includes relations from `getDefaultListRelations()` (e.g., parent destination data)
    - This test validates that the default `_executeAdminSearch` correctly calls `findAllWithRelations` when `getDefaultListRelations()` returns a non-empty object

### Phase 8: Verification

64. Run full test suite: `pnpm test` (verify existing tests still pass)
65. Run typecheck: `pnpm typecheck`
66. Run lint: `pnpm lint`
67. Manual verification in admin panel:
    - Accommodations: filter by owner, type, status, sort, search, price range
    - Events: filter by date range, organizer
    - Users: filter by role, search by email
    - Amenities: filter by category
    - Accommodation reviews: filter by rating range (via averageRating column)
    - Sponsorships: filter by sponsorshipStatus

---

## Testing Strategy

### Unit Tests

| Component | Test File | What to Test |
|-----------|-----------|--------------|
| `ServiceErrorCode.CONFIGURATION_ERROR` | `packages/schemas/test/enums/service-error-code.test.ts` | New enum value exists and matches expected string |
| `TagAdminSearchSchema` (no `nameContains`) | `packages/schemas/test/entities/tag/admin-search.test.ts` | `nameContains` field rejected, `color` accepted, `search` from base works |
| `queryBooleanParam()` helper | `packages/schemas/test/common/query-helpers.test.ts` | `"true"` -> true, `"false"` -> false, `"1"` -> true, `"0"` -> false, `true` -> true, `false` -> false, `undefined` -> undefined, `""` -> undefined, `"yes"` -> false (strict matching) |
| `isVerified` boolean fix | `packages/schemas/test/entities/accommodation-review/admin-search.test.ts` | `"false"` string correctly coerces to `false` (not `true`) via `queryBooleanParam()` |
| `averageRating` computation | `packages/service-core/test/services/accommodationReview/helpers.test.ts` | Average of 6 dimensions computed correctly, stored on review |
| `buildWhereClause` `_gte`/`_lte` | `packages/db/test/utils/drizzle-helpers.test.ts` | New operators with dates, numbers, null values, missing columns (silently skipped) |
| `buildSearchCondition` | `packages/db/test/utils/drizzle-helpers.test.ts` | OR logic with 1 column, 2+ columns, empty term, non-existent columns, special characters in term |
| `BaseModel.findAll` with additionalConditions | `packages/db/test/models/base.model.test.ts` | Combining where clause + additional SQL conditions, empty additionalConditions, only additionalConditions |
| `BaseModel.count` with options object | `packages/db/test/models/base.model.test.ts` | Count respects additional conditions via `{ additionalConditions }`, backward compat with `count(where)`, migration from `count(where, tx)` to `count(where, { tx })` |
| `BaseModel.findAllWithRelations` with additionalConditions | `packages/db/test/models/base.model.test.ts` | Relations + additional conditions combined correctly |
| `adminList()` base behavior | `packages/service-core/test/base/crud/adminList.test.ts` | Sort parsing, invalid sort field (400), status mapping, includeDeleted, date ranges, search OR, permission check, missing schema error (CONFIGURATION_ERROR) |
| `_executeAdminSearch` default | Same file | Entity filter merging into where, pagination, sorting, search condition passed through |
| AccommodationService override | `packages/service-core/test/services/accommodation/adminList.test.ts` | minPrice/maxPrice JSONB SQL generation, simple filters pass through, VIP not filtered |
| EventService override | `packages/service-core/test/services/event/adminList.test.ts` | startDateAfter/Before, endDateAfter/Before JSONB SQL generation (using `->>'start'` and `->>'end'` keys) |
| AccommodationReviewService override | `packages/service-core/test/services/accommodationReview/adminList.test.ts` | minRating/maxRating using `averageRating` numeric column (gte/lte) |
| DestinationReviewService override | `packages/service-core/test/services/destinationReview/adminList.test.ts` | minRating/maxRating using `averageRating` numeric column (gte/lte) |
| UserService override | `packages/service-core/test/services/user/adminList.test.ts` | email partial match (ilike not eq), role simple eq, authProvider simple eq |
| SponsorshipService override | `packages/service-core/test/services/sponsorship/adminList.test.ts` | sponsorshipStatus -> status column rename, base status filter ignored |
| `list()` search fix | `packages/service-core/test/base/crud/list.test.ts` | Verify search uses OR across searchable columns (regression test) |

### Integration Tests

| Route | Test File | What to Test |
|-------|-----------|--------------|
| `GET /admin/accommodations` | `apps/api/test/routes/admin/accommodation-list.test.ts` | ownerId, type, status, sort (valid + invalid), includeDeleted, search (OR), minPrice/maxPrice (JSONB), combined filters, pagination, createdAfter/Before |
| `GET /admin/events` | `apps/api/test/routes/admin/event-list.test.ts` | Date range JSONB filters (start/end keys), organizerId, category |
| `GET /admin/users` | `apps/api/test/routes/admin/user-list.test.ts` | Role filter, email partial match (ilike), authProvider filter, search by name (OR) |
| `GET /admin/amenities` | `apps/api/test/routes/admin/amenity-list.test.ts` | Category filter (default implementation) |
| `GET /admin/accommodation-reviews` | `apps/api/test/routes/admin/accommodation-review-list.test.ts` | Rating range via averageRating column |
| `GET /admin/destination-reviews` | `apps/api/test/routes/admin/destination-review-list.test.ts` | Rating range via averageRating column |
| `GET /admin/destinations` | `apps/api/test/routes/admin/destination-list.test.ts` | destinationType filter, isFeatured boolean, default _executeAdminSearch with relations |
| `GET /admin/sponsorships` | `apps/api/test/routes/admin/sponsorship-list.test.ts` | sponsorshipStatus field rename, sponsorUserId, targetType, base status ignored |

### Regression Tests

- Verify `list()` method behavior unchanged for existing callers (public routes, cron jobs)
- Verify `search()` method behavior unchanged
- Verify public routes still work correctly
- Add a regression test for public `list()` with search after the OR fix: call a public route (e.g., `GET /api/v1/public/accommodations?search=hotel`) and verify it returns results matching name OR description (confirming the OR fix works for public routes too, not just admin)
- All existing test suites must pass without modification (except for search OR fix tests that may need updating if they relied on AND behavior)

### Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| `status=all` with `includeDeleted=true` | Returns everything including soft-deleted |
| `status=ACTIVE` with `includeDeleted=true` | Returns items where lifecycleState=ACTIVE, including those with non-null deletedAt |
| `status=ACTIVE` with `includeDeleted=false` (default) | Returns items where lifecycleState=ACTIVE AND deletedAt IS NULL |
| Empty `entityFilters` (no entity-specific params) | Returns all entities (with base filters applied) |
| Entity without `lifecycleState` column: `status=ACTIVE` | Status filter silently ignored by `buildWhereClause` (column not found). Applies to: `owner_promotions` (uses `isActive`), `sponsorships` (uses `status` enum). |
| Invalid sort field: `sort=bogusField:asc` | HTTP 400 with VALIDATION_ERROR, message includes field name |
| `sort=created_at:desc` (snake_case) | HTTP 400 VALIDATION_ERROR because Drizzle table uses camelCase `createdAt` |
| `createdAfter` > `createdBefore` (inverted range) | Returns empty result (no error, contradictory WHERE is valid SQL) |
| `minPrice` > `maxPrice` (inverted range) | Returns empty result (no error) |
| `search` with empty string | Search condition not applied (treated as no search) |
| `search` with special SQL characters (`%`, `_`) | `%` and `_` are LIKE wildcards and are NOT escaped. Drizzle parameterizes the value (preventing SQL injection), but `%` and `_` retain their wildcard meaning within ILIKE. See known limitation note in section 2.2. |
| Service without `adminSearchSchema` calling `adminList()` | Throws CONFIGURATION_ERROR with descriptive message |
| `includeDeleted=true` on entity without `deletedAt` column | `deletedAt=null` filter silently skipped by `buildWhereClause` (no column). Same as not filtering. |
| JSONB price column is `null` (no price set) | `(price->>'price')::numeric` returns NULL, comparison fails, row excluded from results |
| JSONB date column has missing `end` field | `(date->>'end')` returns NULL, comparison fails, row excluded |
| `averageRating` column is 0 (default) | `minRating=1` excludes reviews with default 0 average. Expected for newly migrated rows that haven't been backfilled. |
| `isVerified="false"` as query string | Correctly parsed as boolean `false` (not `true`) thanks to Phase 0 z.preprocess() fix |
| `owner_promotions` `status=ACTIVE` filter | Silently ignored (no `lifecycleState` column). Use `isActive=true` entity filter instead. |
| `sponsorships` `status=ACTIVE` base filter | Silently ignored (no `lifecycleState` column). Use `sponsorshipStatus=active` entity filter instead. |
| `event_locations` phantom fields (`minCapacity`, `maxCapacity`, `isVerified`) | Silently ignored by `buildWhereClause` (no matching DB columns). Only `city` filter works. |
