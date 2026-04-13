# SPEC-055: LIKE Wildcard Character Escaping & Broken $ilike Refactor

> **Status**: completed
> **Priority**: P2
> **Complexity**: Medium-High
> **Origin**: SPEC-049 GAP-049-008
> **Created**: 2026-03-21
> **Updated**: 2026-03-24 (rev 3)

## Problem Statement

Two related problems exist in the codebase's search/filter infrastructure:

### Problem 1: Missing LIKE Wildcard Escaping

Multiple functions and services construct PostgreSQL `ILIKE` patterns by directly interpolating user-provided search terms into `%${term}%` without escaping LIKE wildcard metacharacters (`%`, `_`, `\`).

**Functional impact**:
- A user searching for `10%` matches any string containing "10" followed by **any character** (e.g., "10x", "100"), not literally "10%".
- A user searching for `test_data` matches "testXdata" or "test1data", not literally "test_data".
- A backslash `\` in a search term can disrupt the LIKE pattern because PostgreSQL uses `\` as its default escape character.

**Clarification**: This is NOT a SQL injection issue. Drizzle ORM parametrizes all values via `sql` template literals, so the search term is always passed as a bound parameter. The issue is purely **functional correctness** of LIKE pattern matching.

### Problem 2: Non-Functional `$ilike` Object Syntax

Three services use a `{ column: { $ilike: pattern } }` object syntax that `buildWhereClause()` does **NOT** support. When these objects reach `BaseModel.findAll()`, `buildWhereClause` passes them to Drizzle's `eq()` which produces incorrect SQL (comparing the column to a stringified object). Similarly, `$or`/`or` array keys are silently ignored (logged as warnings, skipped). These searches are **completely non-functional**.

## Technical Background

### How Drizzle ORM `ilike()` Works

The `ilike()` function from `drizzle-orm` (verified in source code `drizzle-orm@0.44.7`, `conditions.js` lines 115-126) is:

```ts
function ilike(column, value) {
  return sql`${column} ilike ${value}`;
}
```

It generates parameterized SQL: `"column" ILIKE $1` with the value as a bound parameter. It does **NOT** escape `%`, `_`, or `\` within the value. This is by design.. Drizzle expects the caller to include wildcards intentionally.

There is no built-in escape function in Drizzle ORM. GitHub Issue [#444](https://github.com/drizzle-team/drizzle-orm/issues/444) confirms this is a known gap, backlogged for v1.0.0.

> **Note**: The version reference (`drizzle-orm@0.44.7`) is for documentation purposes. The `ilike()` behavior has been unchanged since Drizzle's initial release and will remain so until Issue #444 is resolved. The community consensus (GitHub Discussion [#2339](https://github.com/drizzle-team/drizzle-orm/discussions/2339)) is to escape manually.

### PostgreSQL LIKE Escaping Rules

Per [PostgreSQL documentation](https://www.postgresql.org/docs/current/functions-matching.html):
- `%` matches zero or more characters
- `_` matches exactly one character
- `\` is the default escape character (when `ESCAPE` clause is omitted)
- To match a literal `%`, use `\%`; for `_`, use `\_`; for `\`, use `\\`
- Since PostgreSQL 9.1+, `standard_conforming_strings` is ON by default, so `'\%'` in a string literal works as expected.

### How `BaseModel.findAll()` and `BaseModel.count()` Work

Both methods accept an optional `additionalConditions?: SQL[]` parameter:

```ts
// BaseModel.findAll() signature (base.model.ts line 73)
async findAll(
    where: Record<string, unknown>,
    options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
    additionalConditions?: SQL[],
    tx?: NodePgDatabase<typeof schema>
): Promise<{ items: T[]; total: number }>

// BaseModel.count() signature (base.model.ts line 254)
async count(
    where: Record<string, unknown>,
    options?: { additionalConditions?: SQL[]; tx?: NodePgDatabase<typeof schema> }
): Promise<number>
```

Both methods pass `where` through `buildWhereClause()` for simple equality filters, then combine the result with `additionalConditions` via `and()`. This is the mechanism Category C services must use for `ilike()` conditions.

### Available Imports from `@repo/db`

The `packages/db/src/index.ts` barrel re-exports the following from `drizzle-orm`:

```ts
export { sql, eq, and, or, ilike, desc, asc, count, gt, gte, lt, lte, isNull, isNotNull } from 'drizzle-orm';
```

Plus all table schemas via `export * from './schemas/index.ts'` and all utilities via `export * from './utils/index.ts'`. So `escapeLikePattern`, `ilike`, `or`, and all table schemas (e.g., `eventLocations`, `eventOrganizers`, `postSponsors`) are importable from `@repo/db`.

## Audit of Affected Locations

### Category A: Centralized Functions (packages/db)

These are used by ALL services that extend `BaseCrudService` via `list()` and `adminList()`.

| # | File | Line | Function | Pattern |
|---|------|------|----------|---------|
| A1 | `packages/db/src/utils/drizzle-helpers.ts` | 56 | `buildWhereClause()` | ``ilike(column, `%${value}%`)`` |
| A2 | `packages/db/src/utils/drizzle-helpers.ts` | 159 | `buildSearchCondition()` | ``ilike(column, `%${trimmedTerm}%`)`` |

**Impact**: Every service that uses the `_like` suffix in filters (A1) or the `search` parameter (A2) is affected. This includes BaseCrudService's `list()` (line 194) and `adminList()` (line 382) in `packages/service-core/src/base/base.crud.read.ts`.

### Category B: Direct `ilike()` Calls in Services

These services bypass the centralized functions and call `ilike()` directly.

| # | File | Line | Method | Variable | Field |
|---|------|------|--------|----------|-------|
| B1 | `packages/service-core/src/services/user/user.service.ts` | 419 | `_executeAdminSearch()` | `email` | `userTable.email` |
| B2 | `packages/service-core/src/services/billing/promo-code/promo-code.crud.ts` | 370 | `listPromoCodes()` | `codeSearch` | `billingPromoCodes.code` |
| B3 | `packages/db/src/models/revalidation/revalidation-log.model.ts` | 88 | `findWithFilters()` | `filters.path` | `revalidationLog.path` |
| B4 | `apps/api/src/services/addon.admin.ts` | ~124 | Customer addons list | `customerEmail` | `billingCustomers.email` |
| B5 | `packages/db/src/models/destination/destination.model.ts` | 129, 293, 618 | `searchWithAttractions()`, `search()`, `countByFilters()` | `filters.q` | `destinations.name` |
| B6 | `packages/db/src/models/user/user.model.ts` | 57-59, 126-128, 180-182 | `findAll()`, `count()`, `findAllWithCounts()` | `q` | `users.displayName`, `users.firstName`, `users.lastName` |

### Category C: Broken `$ilike` Object Syntax (Refactor + Escape)

| # | File | Method | Lines | Issue |
|---|------|--------|-------|-------|
| C1 | `eventLocation.service.ts` | `_executeSearch()` | 130-142 | `where.or` with `$ilike` objects.. both ignored |
| C2 | `eventLocation.service.ts` | `_executeCount()` | 158-169 | Same `where.or` + `$ilike` pattern |
| C3 | `eventLocation.service.ts` | `searchForList()` | 192-212 | Individual `$ilike` on city/state/country + `$or` with `$ilike` |
| C4 | `eventOrganizer.service.ts` | `_executeSearch()` | 121-128 | `where.name = { $ilike: ... }` overwrites exact match |
| C5 | `eventOrganizer.service.ts` | `searchForList()` | 153-164 | `$ilike` on name + `$or` array |
| C6 | `postSponsor.service.ts` | `_executeSearch()` | 94-111 | `$ilike` on name + `$or` on name/description |
| C7 | `postSponsor.service.ts` | `_executeCount()` | 113-130 | Same pattern as C6 |
| C8 | `postSponsor.service.ts` | `searchForList()` | 138-162 | Same pattern as C6 |

Full file paths:
- `packages/service-core/src/services/eventLocation/eventLocation.service.ts`
- `packages/service-core/src/services/eventOrganizer/eventOrganizer.service.ts`
- `packages/service-core/src/services/postSponsor/postSponsor.service.ts`

#### Schema Mismatch in EventLocationService

The `event_locations` table schema (`packages/db/src/schemas/event/event_location.dbschema.ts`) contains these text columns:

| Column | Type | Nullable |
|--------|------|----------|
| `city` | text | NOT NULL |
| `placeName` | text | nullable |
| `neighborhood` | text | nullable |
| `department` | text | nullable |
| `street` | text | nullable |
| `number` | text | nullable |
| `floor` | text | nullable |
| `apartment` | text | nullable |
| `slug` | text | NOT NULL |

The service code references `state` and `country` columns that **do not exist** in the table. These were always silently ignored by `buildWhereClause`. The refactoring must:
- Remove `state` and `country` references from the search/filter logic.
- Remove `state` and `country` fields from ALL EventLocation search/list/admin query schemas in `@repo/schemas` (see "Schema Cleanup Required" section above for full list).
- Use only columns that exist in the actual table schema.

The before/after examples below use ONLY columns that exist in the schema.

#### Schema Cleanup Required

**Note**: Line numbers in the table below reflect the spec creation date (2026-03-21) and may have drifted due to ongoing codebase changes. Developers should search by **schema name** rather than relying on line numbers.

The `state` and `country` fields exist in multiple Zod schemas in `packages/schemas/src/entities/eventLocation/eventLocation.query.schema.ts`:

| Schema | Fields to Remove | Lines |
|--------|-----------------|-------|
| `EventLocationSearchInputSchema` | `state`, `country` | 31-32 |
| `EventLocationListInputSchema` | `state`, `country` | 85-86 |
| `EventLocationAdminSearchInputSchema` | `state`, `country` | 228-229 |
| `EventLocationAdminListInputSchema` | `state`, `country` | 275-276 |
| `EventLocationSearchOpenApiSchema` (fieldDescriptions) | `state`, `country` | 134-135 |
| `EventLocationListOpenApiSchema` (fieldDescriptions) | `state`, `country` | 181-182 |

These fields must be removed from ALL search/list/admin schemas since the underlying DB table does not have these columns.

**Out of scope**: The `state` and `country` fields in `eventLocation.http.schema.ts` (create/update schemas) and `eventLocation.access.schema.ts` (field access control) are NOT touched by this spec. Those schemas relate to entity creation/mutation, which is a separate concern (either the columns should be added to the DB table, or the HTTP schemas should be cleaned up.. but that's a different spec).

## Proposed Solution

### 1. Create `escapeLikePattern()` Utility

**Location**: `packages/db/src/utils/drizzle-helpers.ts` (same file as `buildSearchCondition` and `buildWhereClause`).

**Rationale**: The utility belongs in `@repo/db` because:
- Both consuming functions (`buildSearchCondition`, `buildWhereClause`) are in this file.
- Direct `ilike()` callers in `service-core` and `db/models` already import from `@repo/db`.
- It is a database-level concern, not a service-level concern.

**Implementation**:

```ts
/**
 * Escapes PostgreSQL LIKE/ILIKE wildcard metacharacters in a user-provided search term.
 *
 * PostgreSQL LIKE uses three metacharacters:
 * - `%` matches zero or more characters
 * - `_` matches exactly one character
 * - `\` is the default escape character
 *
 * This function escapes all three so the term is matched literally.
 * The backslash MUST be escaped first to avoid double-escaping.
 *
 * @param term - Raw user-provided search term
 * @returns Escaped term safe for interpolation into a LIKE/ILIKE pattern
 *
 * @example
 * ```ts
 * escapeLikePattern('10%')      // '10\\%'
 * escapeLikePattern('test_data') // 'test\\_data'
 * escapeLikePattern('C:\\Users') // 'C:\\\\Users'
 * escapeLikePattern('normal')    // 'normal' (unchanged)
 * ```
 */
export function escapeLikePattern(term: string): string {
    return term
        .replace(/\\/g, '\\\\')  // Escape backslash FIRST (order matters)
        .replace(/%/g, '\\%')    // Escape percent
        .replace(/_/g, '\\_');   // Escape underscore
}
```

**Critical**: The backslash must be replaced **first**. If `%` or `_` are replaced first, the newly introduced backslashes would be double-escaped in the subsequent `\\` replacement step.

### 2. Apply Escaping in `buildSearchCondition()`

**File**: `packages/db/src/utils/drizzle-helpers.ts`, line 159.

**Before**:
```ts
return ilike(column, `%${trimmedTerm}%`);
```

**After**:
```ts
const escapedTerm = escapeLikePattern(trimmedTerm);
return ilike(column, `%${escapedTerm}%`);
```

### 3. Apply Escaping in `buildWhereClause()` `_like` Handler

**File**: `packages/db/src/utils/drizzle-helpers.ts`, line 56.

**Before**:
```ts
return ilike(column as PgColumn, `%${value}%`);
```

**After**:
```ts
const escapedValue = escapeLikePattern(value);
return ilike(column as PgColumn, `%${escapedValue}%`);
```

### 4. Apply Escaping in Direct `ilike()` Calls (Category B)

#### B1: UserService `_executeAdminSearch()`

**File**: `packages/service-core/src/services/user/user.service.ts`, line 419.

**Before**:
```ts
additionalConditions.push(ilike(userTable.email, `%${email}%`));
```

**After**:
```ts
import { escapeLikePattern } from '@repo/db';
// ...
additionalConditions.push(ilike(userTable.email, `%${escapeLikePattern(email)}%`));
```

#### B2: `listPromoCodes()` (standalone function)

**File**: `packages/service-core/src/services/billing/promo-code/promo-code.crud.ts`, line 370.
**Note**: This is a standalone exported function, NOT a BaseCrudService method override.

**Before**:
```ts
conditions.push(ilike(billingPromoCodes.code, `%${codeSearch}%`));
```

**After**:
```ts
import { escapeLikePattern } from '@repo/db';
// ...
conditions.push(ilike(billingPromoCodes.code, `%${escapeLikePattern(codeSearch)}%`));
```

#### B3: RevalidationLogModel `findWithFilters()`

**File**: `packages/db/src/models/revalidation/revalidation-log.model.ts`, line 88.

**Before**:
```ts
clauses.push(ilike(revalidationLog.path, `%${filters.path}%`));
```

**After**:
```ts
import { escapeLikePattern } from '../../utils/drizzle-helpers.ts';
// ...
clauses.push(ilike(revalidationLog.path, `%${escapeLikePattern(filters.path)}%`));
```

#### B4: Addon Admin Service (Customer Addons List)

**File**: `apps/api/src/services/addon.admin.ts`, line ~124.

**Before**:
```ts
conditions.push(ilike(billingCustomers.email, `%${customerEmail}%`));
```

**After**:
```ts
import { escapeLikePattern } from '@repo/db';
// ...
conditions.push(ilike(billingCustomers.email, `%${escapeLikePattern(customerEmail)}%`));
```

#### B5: DestinationModel (3 methods)

**File**: `packages/db/src/models/destination/destination.model.ts`

**New import** (add alongside existing `drizzle-orm` imports):
```ts
import { escapeLikePattern } from '../../utils/drizzle-helpers.ts';
```

All three methods (`searchWithAttractions` line 129, `search` line 293, `countByFilters` line 618) use the same pattern:

**Before** (repeated in 3 methods):
```ts
const searchTerm = `%${filters.q}%`;
```

**After** (repeated in 3 methods):
```ts
const searchTerm = `%${escapeLikePattern(filters.q)}%`;
```

The rest of the code in each method remains unchanged.. only the `searchTerm` construction needs escaping.

#### B6: UserModel (3 methods)

**File**: `packages/db/src/models/user/user.model.ts`

**New import** (add to existing `../../utils/drizzle-helpers.ts` import which already imports `buildWhereClause`):
```ts
import { buildWhereClause, escapeLikePattern } from '../../utils/drizzle-helpers.ts';
```

All three methods (`findAll` lines 57-59, `count` lines 126-128, `findAllWithCounts` lines 180-182) use the same pattern:

**Before** (repeated in 3 methods):
```ts
const searchTerm = `%${q.trim()}%`;
```

**After** (repeated in 3 methods):
```ts
const searchTerm = `%${escapeLikePattern(q.trim())}%`;
```

The rest of the code in each method remains unchanged.. only the `searchTerm` construction needs escaping.

### 5. Refactor Category C Services: EventLocationService

**File**: `packages/service-core/src/services/eventLocation/eventLocation.service.ts`

**New imports** (add to existing imports from `@repo/db`):

```ts
import { EventLocationModel, escapeLikePattern, eventLocations, ilike, or } from '@repo/db';
import type { SQL } from 'drizzle-orm';
```

**Remove** the `WhereWithOr` type (line 20):
```ts
// DELETE: type WhereWithOr = Record<string, unknown> & { or?: Array<Record<string, unknown>> };
```

#### C1: `_executeSearch()` (lines 114-149)

**Before**:
```ts
protected async _executeSearch(
    params: EventLocationSearchInput,
    _actor: Actor
): Promise<PaginatedListOutput<EventLocation>> {
    try {
        const {
            page = 1,
            pageSize = 20,
            sortBy,
            sortOrder,
            q,
            city,
            state,
            country,
            ...otherFilters
        } = params;
        const where: WhereWithOr = { ...otherFilters };
        if (city) where.city = city;
        if (state) where.state = state;
        if (country) where.country = country;
        // Free text search (q): busca en city, state y country (case-insensitive)
        if (q) {
            where.or = [
                { city: { $ilike: `%${q}%` } },
                { state: { $ilike: `%${q}%` } },
                { country: { $ilike: `%${q}%` } }
            ];
        }
        return await this.model.findAll(where, { page, pageSize });
    } catch {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'An unexpected error occurred.'
        );
    }
}
```

**After**:
```ts
protected async _executeSearch(
    params: EventLocationSearchInput,
    _actor: Actor
): Promise<PaginatedListOutput<EventLocation>> {
    try {
        const {
            page = 1,
            pageSize = 20,
            sortBy,
            sortOrder,
            q,
            city,
            ...otherFilters
        } = params;
        const where: Record<string, unknown> = { ...otherFilters };
        if (city) where.city = city;

        const additionalConditions: SQL[] = [];
        if (q) {
            const escaped = escapeLikePattern(q);
            additionalConditions.push(
                or(
                    ilike(eventLocations.city, `%${escaped}%`),
                    ilike(eventLocations.placeName, `%${escaped}%`),
                    ilike(eventLocations.department, `%${escaped}%`)
                )!
            );
        }
        return await this.model.findAll(where, { page, pageSize, sortBy, sortOrder }, additionalConditions);
    } catch {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'An unexpected error occurred.'
        );
    }
}
```

**Notes**:
- Removed `state` and `country` (non-existent columns).
- Replaced `$ilike` object syntax with `ilike()` + `or()` function calls.
- Passed ILIKE conditions as `additionalConditions` (3rd arg to `findAll`).
- The `!` non-null assertion on `or()` is safe because we always pass at least one condition. Drizzle's `or()` returns `SQL | undefined` where `undefined` only occurs when called with zero arguments (variadic signature). Since we always pass 2-3 `ilike()` calls inside the `if (q)` block, `or()` always returns `SQL`.
- Replaced `WhereWithOr` with `Record<string, unknown>`.
- Fixed pre-existing issue: `sortBy`/`sortOrder` now passed to `findAll` options (were destructured but unused before).

#### C2: `_executeCount()` (lines 151-177)

**Before**:
```ts
protected async _executeCount(
    params: EventLocationSearchInput,
    _actor: Actor
): Promise<{ count: number }> {
    try {
        const { q, city, state, country, page, pageSize, sortBy, sortOrder, ...otherFilters } =
            params;
        const where: WhereWithOr = { ...otherFilters };
        if (city) where.city = city;
        if (state) where.state = state;
        if (country) where.country = country;
        if (q) {
            where.or = [
                { city: { $ilike: `%${q}%` } },
                { state: { $ilike: `%${q}%` } },
                { country: { $ilike: `%${q}%` } }
            ];
        }
        const count = await this.model.count(where);
        return { count };
    } catch {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'An unexpected error occurred.'
        );
    }
}
```

**After**:
```ts
protected async _executeCount(
    params: EventLocationSearchInput,
    _actor: Actor
): Promise<{ count: number }> {
    try {
        const { q, city, page: _page, pageSize: _pageSize, sortBy: _sortBy, sortOrder: _sortOrder, ...otherFilters } = params;
        const where: Record<string, unknown> = { ...otherFilters };
        if (city) where.city = city;

        const additionalConditions: SQL[] = [];
        if (q) {
            const escaped = escapeLikePattern(q);
            additionalConditions.push(
                or(
                    ilike(eventLocations.city, `%${escaped}%`),
                    ilike(eventLocations.placeName, `%${escaped}%`),
                    ilike(eventLocations.department, `%${escaped}%`)
                )!
            );
        }
        const count = await this.model.count(where, { additionalConditions });
        return { count };
    } catch {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'An unexpected error occurred.'
        );
    }
}
```

**Notes**:
- `model.count()` accepts `additionalConditions` inside the second `options` arg.
- Pagination/sort params prefixed with `_` since `count()` does not use them. They must be destructured to exclude them from `otherFilters` (which becomes the `where` clause).

#### C3: `searchForList()` (lines 185-217)

**Before**:
```ts
public async searchForList(
    actor: Actor,
    params: EventLocationSearchInput
): Promise<{ items: EventLocation[]; total: number }> {
    this._canSearch(actor);
    const { page = 1, pageSize = 10, q, city, state, country, ...otherFilters } = params;

    const where: Record<string, unknown> = { ...otherFilters };

    if (city) {
        where.city = { $ilike: `%${city}%` };
    }
    if (state) {
        where.state = { $ilike: `%${state}%` };
    }
    if (country) {
        where.country = { $ilike: `%${country}%` };
    }
    if (q) {
        where.$or = [
            { city: { $ilike: `%${q}%` } },
            { state: { $ilike: `%${q}%` } },
            { country: { $ilike: `%${q}%` } },
            { placeName: { $ilike: `%${q}%` } }
        ];
    }

    const result = await this.model.findAll(where, { page, pageSize });
    return {
        items: result.items,
        total: result.total
    };
}
```

**After**:
```ts
public async searchForList(
    actor: Actor,
    params: EventLocationSearchInput
): Promise<{ items: EventLocation[]; total: number }> {
    this._canSearch(actor);
    const { page = 1, pageSize = 10, q, city, ...otherFilters } = params;

    const where: Record<string, unknown> = { ...otherFilters };
    const additionalConditions: SQL[] = [];

    if (city) {
        additionalConditions.push(
            ilike(eventLocations.city, `%${escapeLikePattern(city)}%`)
        );
    }
    if (q) {
        const escaped = escapeLikePattern(q);
        additionalConditions.push(
            or(
                ilike(eventLocations.city, `%${escaped}%`),
                ilike(eventLocations.placeName, `%${escaped}%`),
                ilike(eventLocations.department, `%${escaped}%`),
                ilike(eventLocations.neighborhood, `%${escaped}%`)
            )!
        );
    }

    const result = await this.model.findAll(where, { page, pageSize }, additionalConditions);
    return {
        items: result.items,
        total: result.total
    };
}
```

**Notes**:
- `searchForList` uses PARTIAL matches (ilike) for individual filters, unlike `_executeSearch` which uses exact matches.
- Added `neighborhood` to the `or()` search since it's a valid column that makes sense for location search.

### 6. Refactor Category C Services: EventOrganizerService

**File**: `packages/service-core/src/services/eventOrganizer/eventOrganizer.service.ts`

**New imports** (add to existing imports from `@repo/db`):

```ts
import { EventOrganizerModel, escapeLikePattern, eventOrganizers, ilike } from '@repo/db';
import type { SQL } from 'drizzle-orm';
```

#### C4: `_executeSearch()` (lines 117-129)

**Before**:
```ts
protected async _executeSearch(
    params: EventOrganizerSearchInput,
    _actor: Actor
): Promise<PaginatedListOutput<EventOrganizer>> {
    const { page = 1, pageSize = 10, sortBy, sortOrder, q, name, ...otherFilters } = params;
    const where: Record<string, unknown> = { ...otherFilters };
    if (name) where.name = name;
    if (q) {
        // Partial search by name (case-insensitive)
        where.name = { $ilike: `%${q}%` };
    }
    return this.model.findAll(where, { page, pageSize });
}
```

**After**:
```ts
protected async _executeSearch(
    params: EventOrganizerSearchInput,
    _actor: Actor
): Promise<PaginatedListOutput<EventOrganizer>> {
    const { page = 1, pageSize = 10, sortBy, sortOrder, q, name, ...otherFilters } = params;
    const where: Record<string, unknown> = { ...otherFilters };
    if (name) where.name = name;

    const additionalConditions: SQL[] = [];
    if (q) {
        additionalConditions.push(
            ilike(eventOrganizers.name, `%${escapeLikePattern(q)}%`)
        );
    }
    return this.model.findAll(where, { page, pageSize, sortBy, sortOrder }, additionalConditions);
}
```

**Notes**:
- When `q` is provided, it should do partial search. When only `name` is provided, it does exact match. Previously `q` would overwrite `name` with the broken `$ilike` object.
- Now both can coexist: `name` exact match in `where`, `q` partial match in `additionalConditions`. They combine with `AND`.
- Fixed pre-existing issue: `sortBy`/`sortOrder` now passed to `findAll` options.

#### C5: `searchForList()` (lines 148-169)

**Before**:
```ts
public async searchForList(
    actor: Actor,
    params: EventOrganizerListInput
): Promise<{ items: EventOrganizer[]; total: number }> {
    this._canList(actor);
    const { page = 1, pageSize = 10, q, name, ...otherFilters } = params;

    const where: Record<string, unknown> = { ...otherFilters };

    if (name) {
        where.name = { $ilike: `%${name}%` };
    }
    if (q) {
        where.$or = [{ name: { $ilike: `%${q}%` } }];
    }

    const result = await this.model.findAll(where, { page, pageSize });
    return {
        items: result.items,
        total: result.total
    };
}
```

**After**:
```ts
public async searchForList(
    actor: Actor,
    params: EventOrganizerListInput
): Promise<{ items: EventOrganizer[]; total: number }> {
    this._canList(actor);
    const { page = 1, pageSize = 10, q, name, ...otherFilters } = params;

    const where: Record<string, unknown> = { ...otherFilters };
    const additionalConditions: SQL[] = [];

    if (name) {
        additionalConditions.push(
            ilike(eventOrganizers.name, `%${escapeLikePattern(name)}%`)
        );
    }
    if (q) {
        additionalConditions.push(
            ilike(eventOrganizers.name, `%${escapeLikePattern(q)}%`)
        );
    }

    const result = await this.model.findAll(where, { page, pageSize }, additionalConditions);
    return {
        items: result.items,
        total: result.total
    };
}
```

**Notes**:
- `searchForList` uses PARTIAL match for `name` (unlike `_executeSearch` which uses exact).
- If both `name` and `q` are provided, both conditions apply via AND (both must match).

### 7. Refactor Category C Services: PostSponsorService

**File**: `packages/service-core/src/services/postSponsor/postSponsor.service.ts`

**New imports** (add to existing imports from `@repo/db`):

```ts
import { PostSponsorModel as RealPostSponsorModel, escapeLikePattern, ilike, or, postSponsors } from '@repo/db';
import type { SQL } from 'drizzle-orm';
```

#### C6: `_executeSearch()` (lines 90-112)

**Before**:
```ts
protected async _executeSearch(
    params: PostSponsorSearchInput,
    _actor: Actor
): Promise<PaginatedListOutput<PostSponsor>> {
    const { name, type, q, ...pagination } = params;
    const where: Record<string, unknown> = {};

    if (type) {
        where.type = type;
    }
    if (name) {
        where.name = { $ilike: `%${name}%` };
    }
    if (q) {
        // Search by name or description (case-insensitive)
        where.$or = [{ name: { $ilike: `%${q}%` } }, { description: { $ilike: `%${q}%` } }];
    }

    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 20;
    const result = await this.model.findAll(where, { page, pageSize });
    return result;
}
```

**After**:
```ts
protected async _executeSearch(
    params: PostSponsorSearchInput,
    _actor: Actor
): Promise<PaginatedListOutput<PostSponsor>> {
    const { name, type, q, ...pagination } = params;
    const where: Record<string, unknown> = {};

    if (type) {
        where.type = type;
    }

    const additionalConditions: SQL[] = [];
    if (name) {
        additionalConditions.push(
            ilike(postSponsors.name, `%${escapeLikePattern(name)}%`)
        );
    }
    if (q) {
        const escaped = escapeLikePattern(q);
        additionalConditions.push(
            or(
                ilike(postSponsors.name, `%${escaped}%`),
                ilike(postSponsors.description, `%${escaped}%`)
            )!
        );
    }

    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 20;
    const result = await this.model.findAll(where, { page, pageSize }, additionalConditions);
    return result;
}
```

#### C7: `_executeCount()` (lines 113-130)

**Before**:
```ts
protected async _executeCount(
    params: PostSponsorSearchInput,
    _actor: Actor
): Promise<{ count: number }> {
    const { name, type, q } = params;
    const where: Record<string, unknown> = {};
    if (type) {
        where.type = type;
    }
    if (name) {
        where.name = { $ilike: `%${name}%` };
    }
    if (q) {
        where.$or = [{ name: { $ilike: `%${q}%` } }, { description: { $ilike: `%${q}%` } }];
    }
    const count = await this.model.count(where);
    return { count };
}
```

**After**:
```ts
protected async _executeCount(
    params: PostSponsorSearchInput,
    _actor: Actor
): Promise<{ count: number }> {
    const { name, type, q } = params;
    const where: Record<string, unknown> = {};
    if (type) {
        where.type = type;
    }

    const additionalConditions: SQL[] = [];
    if (name) {
        additionalConditions.push(
            ilike(postSponsors.name, `%${escapeLikePattern(name)}%`)
        );
    }
    if (q) {
        const escaped = escapeLikePattern(q);
        additionalConditions.push(
            or(
                ilike(postSponsors.name, `%${escaped}%`),
                ilike(postSponsors.description, `%${escaped}%`)
            )!
        );
    }
    const count = await this.model.count(where, { additionalConditions });
    return { count };
}
```

#### C8: `searchForList()` (lines 138-162)

**Before**:
```ts
public async searchForList(
    actor: Actor,
    params: PostSponsorSearchInput
): Promise<PostSponsorListOutput> {
    this._canSearch(actor);
    const { name, type, q, page = 1, pageSize = 10 } = params;

    const where: Record<string, unknown> = {};

    if (type) {
        where.type = type;
    }
    if (name) {
        where.name = { $ilike: `%${name}%` };
    }
    if (q) {
        where.$or = [{ name: { $ilike: `%${q}%` } }, { description: { $ilike: `%${q}%` } }];
    }

    const result = await this.model.findAll(where, { page, pageSize });
    return {
        items: result.items,
        total: result.total
    };
}
```

**After**:
```ts
public async searchForList(
    actor: Actor,
    params: PostSponsorSearchInput
): Promise<PostSponsorListOutput> {
    this._canSearch(actor);
    const { name, type, q, page = 1, pageSize = 10 } = params;

    const where: Record<string, unknown> = {};
    if (type) {
        where.type = type;
    }

    const additionalConditions: SQL[] = [];
    if (name) {
        additionalConditions.push(
            ilike(postSponsors.name, `%${escapeLikePattern(name)}%`)
        );
    }
    if (q) {
        const escaped = escapeLikePattern(q);
        additionalConditions.push(
            or(
                ilike(postSponsors.name, `%${escaped}%`),
                ilike(postSponsors.description, `%${escaped}%`)
            )!
        );
    }

    const result = await this.model.findAll(where, { page, pageSize }, additionalConditions);
    return {
        items: result.items,
        total: result.total
    };
}
```

### 8. Export from Barrel

**File**: `packages/db/src/utils/index.ts` already re-exports everything from `drizzle-helpers.ts`, so `escapeLikePattern` will be automatically available as `import { escapeLikePattern } from '@repo/db'`.

## Scope

### In Scope

**Utility creation**:
- Create `escapeLikePattern()` utility in `packages/db/src/utils/drizzle-helpers.ts`

**Category A - Centralized functions**:
- Apply escaping in `buildSearchCondition()` (line 159)
- Apply escaping in `buildWhereClause()` `_like` handler (line 56)

**Category B - Direct ilike calls**:
- Apply escaping in `user.service.ts` `_executeAdminSearch()` (line 419)
- Apply escaping in `promo-code.crud.ts` `listPromoCodes()` (line 370)
- Apply escaping in `revalidation-log.model.ts` (line 88)
- Apply escaping in `addon.admin.ts` customer addons list (line ~124)
- Apply escaping in `destination.model.ts` `searchWithAttractions()`, `search()`, `countByFilters()` (lines 129, 293, 618)
- Apply escaping in `user.model.ts` `findAll()`, `count()`, `findAllWithCounts()` (lines 57-59, 126-128, 180-182)

**Category C - Refactor broken $ilike services**:
- Refactor `eventLocation.service.ts`: 3 methods (`_executeSearch`, `_executeCount`, `searchForList`)
- Refactor `eventOrganizer.service.ts`: 2 methods (`_executeSearch`, `searchForList`)
- Refactor `postSponsor.service.ts`: 3 methods (`_executeSearch`, `_executeCount`, `searchForList`)
- Remove `WhereWithOr` type from `eventLocation.service.ts`
- Remove non-existent `state`/`country` column references from `eventLocation.service.ts`
- Remove `state`/`country` fields from all EventLocation query schemas in `eventLocation.query.schema.ts` (6 schemas affected)

**Testing**:
- Unit tests for `escapeLikePattern()` covering all edge cases
- Update existing `buildSearchCondition` and `buildWhereClause` tests to cover wildcard escaping
- Tests for refactored Category C service methods

### Out of Scope

- Full-text search migration (e.g., PostgreSQL `tsvector`)
- Search relevance ranking
- SQL injection vectors (already handled by Drizzle parametrization)
- Adding `state`/`country` columns to the `event_locations` table schema (migration)
- Cleaning up `state`/`country` in `eventLocation.http.schema.ts` (create/update schemas) or `eventLocation.access.schema.ts` (field access). These are mutation-related and need their own spec.
- Adding explicit `ESCAPE '\'` clause to ILIKE patterns (PostgreSQL uses `\` by default)
- `destination.model.ts` `findDescendants()` method (~line 400): Uses `like(destinations.pathIds, \`${descendantPathPrefix}%\`)` with an **intentional** `%` wildcard for hierarchical path prefix matching. The `descendantPathPrefix` is an internal value derived from the database (not user input), so escaping it would break the feature. This is NOT a bug.

## Affected Files

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/db/src/utils/drizzle-helpers.ts` | Modified | Add `escapeLikePattern()`, update `buildSearchCondition()` and `buildWhereClause()` |
| `packages/service-core/src/services/user/user.service.ts` | Modified | Import and use `escapeLikePattern` in `_executeAdminSearch()` |
| `packages/service-core/src/services/billing/promo-code/promo-code.crud.ts` | Modified | Import and use `escapeLikePattern` in `listPromoCodes()` |
| `packages/db/src/models/revalidation/revalidation-log.model.ts` | Modified | Import and use `escapeLikePattern` |
| `apps/api/src/services/addon.admin.ts` | Modified | Import and use `escapeLikePattern` for `customerEmail` ilike filter |
| `packages/db/src/models/destination/destination.model.ts` | Modified | Import and use `escapeLikePattern` in 3 methods (`searchWithAttractions`, `search`, `countByFilters`) |
| `packages/db/src/models/user/user.model.ts` | Modified | Add `escapeLikePattern` to existing drizzle-helpers import, apply in 3 methods (`findAll`, `count`, `findAllWithCounts`) |
| `packages/service-core/src/services/eventLocation/eventLocation.service.ts` | Modified | Refactor 3 methods: replace `$ilike`/`or` with `ilike()`/`or()` + `additionalConditions`, remove `WhereWithOr`, remove `state`/`country` refs |
| `packages/service-core/src/services/eventOrganizer/eventOrganizer.service.ts` | Modified | Refactor 2 methods: replace `$ilike`/`$or` with `ilike()` + `additionalConditions` |
| `packages/service-core/src/services/postSponsor/postSponsor.service.ts` | Modified | Refactor 3 methods: replace `$ilike`/`$or` with `ilike()`/`or()` + `additionalConditions` |
| `packages/db/test/utils/drizzle-helpers.test.ts` | Modified | Add tests for `escapeLikePattern()` and wildcard edge cases |
| `packages/service-core/test/services/eventLocation/search.test.ts` | Modified | Update search tests for new ilike behavior |
| `packages/service-core/test/services/eventLocation/count.test.ts` | Modified | Update count tests for new additionalConditions pattern |
| `packages/service-core/test/services/eventLocation/list.test.ts` | Modified | Update searchForList tests for new ilike behavior |
| `packages/service-core/test/services/eventOrganizer/search.test.ts` | Modified | Update search tests for new ilike behavior |
| `packages/service-core/test/services/eventOrganizer/list.test.ts` | Modified | Update searchForList tests for new ilike behavior |
| `packages/service-core/test/services/postSponsor/search.test.ts` | Modified | Update search tests for new ilike behavior |
| `packages/service-core/test/services/postSponsor/count.test.ts` | Modified | Update count tests for new additionalConditions pattern |
| `packages/service-core/test/services/postSponsor/list.test.ts` | Modified | Update searchForList tests for new ilike behavior |

| `packages/schemas/src/entities/eventLocation/eventLocation.query.schema.ts` | Modified | Remove `state`/`country` from 6 search/list/admin schemas and their fieldDescriptions |

## Testing Requirements

### Unit Tests for `escapeLikePattern()`

Add to `packages/db/test/utils/drizzle-helpers.test.ts`:

```ts
describe('escapeLikePattern', () => {
    // Basic escaping
    it('should escape percent character', () => {
        expect(escapeLikePattern('10%')).toBe('10\\%');
    });

    it('should escape underscore character', () => {
        expect(escapeLikePattern('test_data')).toBe('test\\_data');
    });

    it('should escape backslash character', () => {
        expect(escapeLikePattern('C:\\Users')).toBe('C:\\\\Users');
    });

    // Multiple metacharacters
    it('should escape multiple wildcards in same string', () => {
        expect(escapeLikePattern('100%_off')).toBe('100\\%\\_off');
    });

    it('should escape backslash before other metacharacters', () => {
        // Verifies correct replacement order: \ first, then % and _
        expect(escapeLikePattern('\\%')).toBe('\\\\\\%');
    });

    // Passthrough cases
    it('should return empty string unchanged', () => {
        expect(escapeLikePattern('')).toBe('');
    });

    it('should return normal text unchanged', () => {
        expect(escapeLikePattern('hotel paradise')).toBe('hotel paradise');
    });

    it('should preserve spaces and special non-LIKE characters', () => {
        expect(escapeLikePattern('cafe & resume')).toBe('cafe & resume');
    });

    it('should preserve unicode characters', () => {
        expect(escapeLikePattern('Concepción del Uruguay')).toBe('Concepción del Uruguay');
    });

    it('should preserve whitespace-only input', () => {
        expect(escapeLikePattern('   ')).toBe('   ');
    });

    // Edge cases
    it('should handle string that is only wildcards', () => {
        expect(escapeLikePattern('%_%')).toBe('\\%\\_\\%');
    });

    it('should handle consecutive identical wildcards', () => {
        expect(escapeLikePattern('%%')).toBe('\\%\\%');
        expect(escapeLikePattern('__')).toBe('\\_\\_');
    });
});
```

### Integration Tests for `buildSearchCondition` with Wildcards

Add to the existing `buildSearchCondition` describe block:

```ts
it('should escape % in search term', () => {
    const result = buildSearchCondition('10%', ['name'], mockTable);
    expect(result).toBeDefined();
});

it('should escape _ in search term', () => {
    const result = buildSearchCondition('test_data', ['name'], mockTable);
    expect(result).toBeDefined();
});

it('should escape \\ in search term', () => {
    const result = buildSearchCondition('path\\to', ['name'], mockTable);
    expect(result).toBeDefined();
});
```

### Integration Tests for `buildWhereClause` with `_like` Suffix

Add to the existing `buildWhereClause` describe block:

```ts
it('should escape wildcards in _like values', () => {
    const result = buildWhereClause({ name_like: '10%' }, mockTable);
    expect(result).toBeDefined();
});
```

### Category C Service Tests

For each refactored service, verify the search method is called with correct `additionalConditions`:

```ts
// Example for PostSponsorService._executeSearch
it('should pass ilike conditions as additionalConditions for name filter', async () => {
    const params = { name: 'test', page: 1, pageSize: 10 };
    await service._executeSearch(params, mockActor);
    expect(mockModel.findAll).toHaveBeenCalledWith(
        {},
        { page: 1, pageSize: 10 },
        expect.arrayContaining([expect.any(Object)])  // SQL conditions
    );
});

it('should pass or() condition for q free-text search', async () => {
    const params = { q: 'test', page: 1, pageSize: 10 };
    await service._executeSearch(params, mockActor);
    expect(mockModel.findAll).toHaveBeenCalledWith(
        {},
        { page: 1, pageSize: 10 },
        expect.arrayContaining([expect.any(Object)])
    );
});
```

## Acceptance Criteria

**Utility**:
- [ ] `escapeLikePattern()` exists in `packages/db/src/utils/drizzle-helpers.ts` and is exported via barrel
- [ ] `escapeLikePattern()` escapes `\` before `%` and `_` (correct order verified by tests)

**Category A**:
- [ ] `buildSearchCondition()` calls `escapeLikePattern()` on the search term before ILIKE interpolation
- [ ] `buildWhereClause()` `_like` handler calls `escapeLikePattern()` on the value before ILIKE interpolation

**Category B**:
- [ ] `user.service.ts:_executeAdminSearch()` uses `escapeLikePattern()` for the email filter
- [ ] `promo-code.crud.ts:listPromoCodes()` uses `escapeLikePattern()` for the codeSearch filter
- [ ] `revalidation-log.model.ts` uses `escapeLikePattern()` for the path filter
- [ ] `addon.admin.ts` uses `escapeLikePattern()` for the customerEmail filter
- [ ] `destination.model.ts` uses `escapeLikePattern()` for the `searchTerm` construction in all 3 methods
- [ ] `user.model.ts` uses `escapeLikePattern()` for the `searchTerm` construction in all 3 methods

**Category C**:
- [ ] `eventLocation.service.ts` uses `ilike()` + `or()` + `escapeLikePattern()` via `additionalConditions`
- [ ] `eventLocation.service.ts` no longer references `state` or `country` columns
- [ ] `eventLocation.service.ts` no longer uses `WhereWithOr` type
- [ ] `eventLocation.query.schema.ts` no longer contains `state` or `country` fields in any search/list/admin schema
- [ ] `eventOrganizer.service.ts` uses `ilike()` + `escapeLikePattern()` via `additionalConditions`
- [ ] `postSponsor.service.ts` uses `ilike()` + `or()` + `escapeLikePattern()` via `additionalConditions`
- [ ] No `$ilike` or `$or` object syntax remains in any service file

**Functional**:
- [ ] Searching for "10%" via any search endpoint matches ONLY strings containing literal "10%" (not "10x")
- [ ] Searching for "test_data" matches ONLY "test_data" (not "testXdata")
- [ ] Existing search behavior is preserved for terms without wildcard metacharacters
- [ ] EventLocation, EventOrganizer, and PostSponsor search/list/count methods now return correct results

**Quality**:
- [ ] All new and modified code passes `pnpm typecheck` and `pnpm lint`
- [ ] Unit tests achieve >= 90% coverage for the new utility and modified functions
- [ ] No `.only()` or hard-coded `.skip()` in committed tests

## Implementation Order

### Phase 1: Utility + Centralized Functions
1. Add `escapeLikePattern()` function to `drizzle-helpers.ts` with JSDoc
2. Add unit tests for `escapeLikePattern()` in `drizzle-helpers.test.ts`.. verify they pass
3. Apply in `buildSearchCondition()` (line 159) and `buildWhereClause()` (line 56)
4. Add integration tests for wildcard escaping in both functions
5. Run: `pnpm typecheck && pnpm lint && pnpm test --filter=@repo/db`

### Phase 2: Direct ilike Calls (Category B)
6. Apply in `user.service.ts` (line 419) with import
7. Apply in `promo-code.crud.ts` (line 370) with import
8. Apply in `revalidation-log.model.ts` (line 88) with import
9. Apply in `addon.admin.ts` (line ~124) with import
10. Apply in `destination.model.ts` (lines 129, 293, 618) with import from `../utils/drizzle-helpers.ts`
11. Apply in `user.model.ts` (lines 57-59, 126-128, 180-182) by adding `escapeLikePattern` to existing drizzle-helpers import
12. Run: `pnpm typecheck && pnpm lint && pnpm test --filter=@repo/db --filter=@repo/service-core`

### Phase 3: Service Refactoring (Category C)
13. Refactor `eventLocation.service.ts`: remove `WhereWithOr`, remove `state`/`country`, convert 3 methods
14. Remove `state`/`country` from all 6 schemas in `eventLocation.query.schema.ts` (SearchInput, ListInput, AdminSearch, AdminList, and their OpenApi fieldDescriptions)
15. Update `eventLocation` search tests
16. Refactor `eventOrganizer.service.ts`: convert 2 methods
17. Update `eventOrganizer` search tests
18. Refactor `postSponsor.service.ts`: convert 3 methods
19. Update `postSponsor` search/count tests
20. Run full test suite: `pnpm typecheck && pnpm lint && pnpm test`

## Execution Order & Agent Safety Guide

> **For agents**: Read this section before implementing. If prerequisites are not met, STOP and report to the user.

### Prerequisites

**None.** SPEC-055 has no blocking dependencies. It can start immediately.

### Position in the Dependency Graph

```
SPEC-055 (THIS SPEC) ── INDEPENDENT, but MUST land before SPEC-060
    │
    └──► SPEC-060 (model tx propagation) ── BLOCKED until this spec is merged
```

### Critical: SPEC-060 Depends on This Spec

SPEC-060 is **BLOCKED** until SPEC-055 is merged. Both specs modify the same method signatures in:
- `destination.model.ts`: `search()`, `countByFilters()`
- `user.model.ts`: methods with `ilike()` calls

SPEC-055 refactors `$ilike` object syntax → `ilike()` function calls and adds wildcard escaping. SPEC-060 adds `tx?: DrizzleClient` parameter and replaces `getDb()` → `this.getClient(tx)`. If SPEC-060 goes first, these changes would conflict heavily.

**If an agent asks to implement SPEC-060 before SPEC-055 is merged: REFUSE. Explain that SPEC-055 must land first.**

### Parallel Safety

| Spec | Conflict Risk | Details |
|------|--------------|---------|
| SPEC-051 | None | Different layers (DB models vs service permissions). |
| SPEC-052 | None | Different layers (DB models vs schemas/service types). |
| SPEC-054 | None | Different layers (DB models vs admin UI). |
| SPEC-058 | None | SPEC-058 touches base class and import lines. SPEC-055 touches model subclass method bodies. No overlap. |
| SPEC-059 | None | Different packages (`@repo/db` vs `@repo/service-core`). |
| SPEC-060 | **BLOCKING** | SPEC-055 MUST merge before SPEC-060 starts. See above. |

### Agent Instructions

1. Verify `pnpm typecheck` passes on current `main` before starting
2. Implement in order: (a) `escapeLikePattern()` utility, (b) Category A centralized functions, (c) Category B direct `ilike()` calls, (d) Category C broken `$ilike` refactors
3. Run `pnpm typecheck && pnpm test`
4. Merge to `main` promptly -- SPEC-060 is waiting on this

## Biome Compliance Notes

The "After" code examples in this spec are designed to pass Biome's `noUnusedVariables` rule:

- **`_executeSearch` methods**: `sortBy`/`sortOrder` are passed to `findAll()` options (fixing a pre-existing issue where they were destructured but dropped).
- **`_executeCount` methods**: Pagination/sort params are prefixed with `_` (e.g., `_page`, `_sortBy`) since `count()` doesn't use them, but they must be destructured separately to prevent them from leaking into `otherFilters` via rest spread.
- **`searchForList` methods**: Only destructure what's actually used; pagination/sort params either used or omitted from destructuring.

## Risks

- **Low**: The escaping change is purely additive. For search terms without `%`, `_`, or `\`, the `escapeLikePattern()` function returns the input unchanged, so existing behavior is preserved.
- **Low**: If a service intentionally uses wildcards in a `_like` filter value, the wildcards would now be escaped. However, no current code does this.. `_like` values always come from user-provided search terms.
- **Medium**: The Category C refactoring fixes BROKEN searches that currently return incorrect results. This means the behavior WILL change (from broken to correct). If any frontend code accidentally depends on the broken behavior (e.g., receiving more results than expected), it may need adjustment. However, since the current searches are non-functional, this is a net improvement.
- **Low**: Removing `state`/`country` from `EventLocationService` search logic removes filters that never worked. No behavioral regression possible.
