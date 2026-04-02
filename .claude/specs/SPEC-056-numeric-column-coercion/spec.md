# SPEC-056: Numeric Column String Coercion

> **Status**: completed
> **Priority**: P2
> **Complexity**: Low-Medium
> **Origin**: SPEC-049 GAP-049-050
> **Created**: 2026-03-21
> **Updated**: 2026-03-25 (revised: fixed DestinationSummaryExtendedSchema name and target, expanded audit-only table with parent service writes and cast removal, added cast review ACs)

## Problem Statement

PostgreSQL `numeric()` columns return **string** values in JavaScript via the `pg` driver and Drizzle ORM (e.g., `"3.50"` instead of `3.50`). This is by design in node-postgres because JavaScript `number` (IEEE 754 double) cannot represent all possible `numeric` values without precision loss.

### Current Impact

The codebase has **6 affected `numeric()` columns** across 5 tables:

| Table | Column | Definition | Has `$type<number>()`? | Runtime Type |
|-------|--------|-----------|------------------------|-------------|
| `accommodations` | `averageRating` | `numeric(3, 2)` | YES | `string` (lies to TS as `number`) |
| `destinations` | `averageRating` | `numeric(3, 2)` | YES | `string` (lies to TS as `number`) |
| `accommodation_reviews` | `averageRating` | `numeric(3, 2)` | NO | `string` |
| `destination_reviews` | `averageRating` | `numeric(3, 2)` | NO | `string` |
| `exchange_rates` | `rate` | `numeric(20, 10)` | NO | `string` |
| `exchange_rates` | `inverseRate` | `numeric(20, 10)` | NO | `string` |

**Note**: `r_accommodation_amenity.additionalCostPercent` uses `doublePrecision()` which returns a JavaScript `number` natively.. it is NOT affected by this issue.

### Why This Is a Bug

1. **`$type<number>()` is TypeScript-only**: It overrides the inferred TS type but has ZERO runtime effect. The `pg` driver still returns strings. This creates **false type safety** where TypeScript says `number` but runtime is `string`.
2. **String comparison semantics**: `"3.50" > "3.5"` uses lexicographic comparison in JavaScript, not numeric. Code like `if (review.averageRating > 3.5)` silently produces wrong results.
3. **Zod schema mismatches**: Review schemas use `z.number()` which will **reject** string values from the DB if validation is applied to raw DB results.

### Existing Utilities (Underutilized)

Two helpers already exist but are inconsistently used:

1. **`numericField()`** in `packages/schemas/src/utils/utils.ts:53`.. accepts `string | number`, transforms to `number` via `Number.parseFloat()`. **Currently has ZERO usages** in entity schemas.
2. **`createAverageRatingField()`** in `packages/schemas/src/common/helpers.schema.ts:33`.. same pattern but specific to 0-5 ratings. **Used in only 5 places**: `review.schema.ts` (1), `accommodation.query.schema.ts` (3), `apps/admin/.../accommodations.schemas.ts` (1). Missing from 13 other `averageRating` definitions that use plain `z.number()`, plus 4 inline duplications in `destination.query.schema.ts`.

## Proposed Solution

Use Drizzle's built-in **`mode: 'number'`** option on all `numeric()` column definitions. This performs real **runtime conversion** (`Number(value)` on read, `String(value)` on write) at the ORM layer, eliminating the problem at its source.

### Why `mode: 'number'` (not alternatives)

| Approach | Runtime? | Systematic? | Risk |
|----------|----------|-------------|------|
| **`numeric({ mode: 'number' })`** | YES | YES (ORM layer) | Precision loss for >15 digits |
| `$type<number>()` | NO (TS only) | NO | **Actively harmful** (lies to TS) |
| `mapWith()` on columns | N/A | N/A | **Does not exist** on column builders |
| `customType()` | YES | YES | Unnecessary complexity for this case |
| `parseNumeric()` utility | YES | NO (manual call sites) | Error-prone, easy to forget |

**Precision analysis**: `Number()` has ~15-17 significant digits of precision.

- `averageRating` with `numeric(3, 2)`: max value `9.99`.. **safe** (3 digits)
- Exchange rates with `numeric(20, 10)`: for ARS/USD/BRL rates, values are typically in the range of 0.001 to 10000 with up to 10 decimal places.. **safe** (practical values use < 15 digits)

### Migration Impact

Adding `mode: 'number'` changes the Drizzle column definition in TypeScript only. It does NOT change the PostgreSQL column type. **No database migration is needed.** However, `drizzle-kit generate` may detect a "column changed" event.. if so, the generated migration file will be empty or a no-op and should be discarded.

## Scope

### In Scope

1. **Add `mode: 'number'` to all 6 `numeric()` columns** in 5 DB schema files
2. **Remove `$type<number>()`** from the 2 columns that have it (now redundant and misleading)
3. **Add JSDoc** to all 6 columns explaining the coercion behavior
4. **Fix ALL 17 Zod `averageRating` definitions** that use plain `z.number()` or inline union/transform:
   - Migrate to `createAverageRatingField()` across 8 files for full consistency
   - Eliminate 4 inline duplications in `destination.query.schema.ts`
   - This is a **defensive measure** in case any code path bypasses the ORM (raw queries, test fixtures)
5. **Fix exchange rate Zod schema** to use `numericField()` for `rate`/`inverseRate`, preserving i18n messages
6. **Remove 6 `.toString()` calls** in `destinationReview.service.ts` (4) and `accommodationReview.service.ts` (2) that become incorrect after `mode: 'number'`
7. **Full codebase audit** for remaining string-specific operations on numeric column values
8. **Unit tests** for DB coercion behavior and Zod helper functions

### Out of Scope

- Changing PostgreSQL column types (stays `numeric`)
- Migrating to integer-based storage (e.g., ratings as integers * 100)
- `doublePrecision()` columns (already return `number` natively)
- Billing/money columns (already use `integer` per ADR-006)
- Changes to `BaseModel` or `BaseCrudService` (the fix is at the Drizzle column definition level, no post-query transforms needed)

## Detailed Implementation Plan

### Phase 1: DB Schema Changes (5 files)

#### 1.1 `packages/db/src/schemas/accommodation/accommodation.dbschema.ts`

**Current** (line ~62):

```ts
averageRating: numeric('average_rating', { precision: 3, scale: 2 })
  .notNull()
  .default('0')
  .$type<number>(),
```

**Target**:

```ts
/** Average guest rating (0.00-5.00). Drizzle mode:'number' ensures runtime JS number type. */
averageRating: numeric('average_rating', { precision: 3, scale: 2, mode: 'number' })
  .notNull()
  .default(0),
```

Changes: add `mode: 'number'`, remove `.$type<number>()`, change default from `'0'` (string) to `0` (number), add JSDoc.

#### 1.2 `packages/db/src/schemas/destination/destination.dbschema.ts`

**Current** (line ~59):

```ts
averageRating: numeric('average_rating', { precision: 3, scale: 2 })
  .notNull()
  .default('0')
  .$type<number>(),
```

**Target**: Same pattern as 1.1.

#### 1.3 `packages/db/src/schemas/accommodation/accommodation_review.dbschema.ts`

**Current** (line ~30):

```ts
averageRating: numeric('average_rating', { precision: 3, scale: 2 })
  .notNull()
  .default('0'),
```

**Target**:

```ts
/** Computed average of all rating categories (0.00-5.00). Drizzle mode:'number' ensures runtime JS number type. */
averageRating: numeric('average_rating', { precision: 3, scale: 2, mode: 'number' })
  .notNull()
  .default(0),
```

Changes: add `mode: 'number'`, change default from `'0'` to `0`, add JSDoc.

#### 1.4 `packages/db/src/schemas/destination/destination_review.dbschema.ts`

**Current** (line ~20): Same pattern as 1.3.
**Target**: Same pattern as 1.3.

#### 1.5 `packages/db/src/schemas/exchange-rate/exchange-rate.dbschema.ts`

**Current** (line ~14-15):

```ts
rate: numeric('rate', { precision: 20, scale: 10 }).notNull(),
inverseRate: numeric('inverse_rate', { precision: 20, scale: 10 }).notNull(),
```

**Target**:

```ts
/** Conversion rate from source to target currency. Drizzle mode:'number' ensures runtime JS number type. */
rate: numeric('rate', { precision: 20, scale: 10, mode: 'number' }).notNull(),
/** Inverse conversion rate (1/rate). Drizzle mode:'number' ensures runtime JS number type. */
inverseRate: numeric('inverse_rate', { precision: 20, scale: 10, mode: 'number' }).notNull(),
```

Changes: add `mode: 'number'`, add JSDoc.

### Phase 2: Zod Schema Fixes (defensive layer)

Even though `mode: 'number'` fixes the ORM layer, Zod schemas should accept `string | number` as a defensive measure for raw queries and test fixtures. **All 17 `averageRating` Zod definitions** that currently use plain `z.number()` or inline union/transform must be migrated to `createAverageRatingField()` for consistency.

#### Current state audit (26 occurrences total)

| Pattern | Count | Action |
|---------|-------|--------|
| Already uses `createAverageRatingField()` | 5 | No change needed |
| Plain `z.number().min(0).max(5)` | 13 | Migrate to `createAverageRatingField()` |
| Inline union/transform (duplicated logic) | 4 | Replace with `createAverageRatingField()` |
| Literal values / access flags (not Zod) | 4 | No change needed |

#### 2.1 `WithReviewStateSchema` in helpers

**File**: `packages/schemas/src/common/helpers.schema.ts`

**Current** (line ~25):

```ts
averageRating: z.number().min(0).max(5).optional()
```

**Target**:

```ts
averageRating: createAverageRatingField({ optional: true })
```

#### 2.2 Accommodation relation schemas (3 changes)

**File**: `packages/schemas/src/entities/accommodation/accommodation.relations.schema.ts`

**Schemas to change**:

- `AccommodationWithReviewsSchema` (line ~118)
- `AccommodationWithContentRelationsSchema` (line ~213)
- `AccommodationWithFullRelationsSchema` (line ~261)

**Current** (each): `averageRating: z.number().min(0).max(5).optional()`
**Target** (each): `averageRating: createAverageRatingField({ optional: true })`

Add import: `import { createAverageRatingField } from '../../common/helpers.schema';`

#### 2.3 Destination relation schemas (3 changes)

**File**: `packages/schemas/src/entities/destination/destination.relations.schema.ts`

**Schemas to change**:

- `DestinationWithReviewsSchema` (line ~188)
- `DestinationWithContentRelationsSchema` (line ~239)
- `DestinationWithFullRelationsSchema` (line ~277)

**Current** (each): `averageRating: z.number().min(0).max(5).optional()`
**Target** (each): `averageRating: createAverageRatingField({ optional: true })`

Add import: `import { createAverageRatingField } from '../../common/helpers.schema';`

#### 2.4 Destination query schemas - eliminate inline duplications (4 changes)

**File**: `packages/schemas/src/entities/destination/destination.query.schema.ts`

**Schemas to change**:

- `DestinationListItemSchema` (line ~140)
- `DestinationSummarySchema` (line ~205)
- `DestinationStatsSchema` (line ~220)
- `DestinationSummaryExtendedSchema` (line ~281)

**Current** (each, inline duplication):

```ts
averageRating: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === 'string' ? Number.parseFloat(val) : val))
    .pipe(z.number().min(0).max(5))
    .default(0)
    .optional()
```

**Note**: `DestinationStatsSchema` uses `.default(0)` without `.optional()`. All other three use `.default(0).optional()`.

**Target**: Replace each with the equivalent `createAverageRatingField()` call:

- `DestinationListItemSchema`: `averageRating: createAverageRatingField({ optional: true, default: 0 })`
- `DestinationSummarySchema`: `averageRating: createAverageRatingField({ optional: true, default: 0 })`
- `DestinationStatsSchema`: `averageRating: createAverageRatingField({ default: 0 })` (not optional)
- `DestinationSummaryExtendedSchema`: `averageRating: createAverageRatingField({ optional: true, default: 0 })`

**IMPORTANT**: Match the exact optional/default behavior of each inline version. The `DestinationSummaryExtendedSchema` current code uses `.default(0).optional()`, so the target MUST preserve both modifiers.

Add import: `import { createAverageRatingField } from '../../common/helpers.schema';`

#### 2.5 Review stats response schemas (2 changes)

**Files**:

- `packages/schemas/src/entities/accommodationReview/accommodationReview.query.schema.ts` (line ~260)
- `packages/schemas/src/entities/destinationReview/destinationReview.query.schema.ts` (line ~282)

**Current** (each): `averageRating: z.number().min(0).max(5).default(0)`
**Target** (each): `averageRating: createAverageRatingField({ default: 0 })`

Add import: `import { createAverageRatingField } from '../../common/helpers.schema';`

#### 2.6 User relation schemas (3 changes)

**File**: `packages/schemas/src/entities/user/user.relations.schema.ts`

**Schemas to change**:

- `UserWithReviewsSchema` (line ~169)
- `UserWithActivityRelationsSchema` (line ~212)
- `UserWithFullRelationsSchema` (line ~240)

**Current** (each): `averageRatingGiven: z.number().min(0).max(5).optional()`
**Target** (each): `averageRatingGiven: createAverageRatingField({ optional: true })`

**Note**: Field name is `averageRatingGiven` (not `averageRating`). The `createAverageRatingField()` helper returns a Zod schema, not a named field, so it works regardless of the property name.

Add import: `import { createAverageRatingField } from '../../common/helpers.schema';`

#### 2.7 Amenity stats schema (1 change)

**File**: `packages/schemas/src/entities/amenity/amenity.query.schema.ts`

**Schema**: Nested accommodation object inside `AmenityStatsWrapperSchema` (line ~402)

**Current**: `averageRating: z.number().min(0).max(5).optional()`
**Target**: `averageRating: createAverageRatingField({ optional: true })`

Add import: `import { createAverageRatingField } from '../../common/helpers.schema';`

#### 2.8 Exchange rate entity schema

**File**: `packages/schemas/src/entities/exchange-rate/exchange-rate.schema.ts`

**Current** (lines ~23-37):

```ts
rate: z
    .number({
        message: 'zodError.exchangeRate.rate.required'
    })
    .positive({
        message: 'zodError.exchangeRate.rate.positive'
    }),

inverseRate: z
    .number({
        message: 'zodError.exchangeRate.inverseRate.required'
    })
    .positive({
        message: 'zodError.exchangeRate.inverseRate.positive'
    }),
```

**Target**:

```ts
rate: numericField(
    z.number({
        message: 'zodError.exchangeRate.rate.required'
    }).positive({
        message: 'zodError.exchangeRate.rate.positive'
    })
),

inverseRate: numericField(
    z.number({
        message: 'zodError.exchangeRate.inverseRate.required'
    }).positive({
        message: 'zodError.exchangeRate.inverseRate.positive'
    })
),
```

**Important**: Preserve the existing i18n error messages. The `numericField()` helper accepts an optional `z.ZodNumber` pipe that runs AFTER the string-to-number transform.

**Note on i18n `required` messages**: The `z.number({ message: 'zodError.exchangeRate.rate.required' })` message inside the pipe only triggers when the transformed value fails `z.number()` validation (e.g., NaN). If the field itself is missing (undefined), the outer `z.union([z.string(), z.number()])` fails first with a generic Zod error, NOT the custom `required` message. In practice, this is not an issue because these fields are always required at the parent object schema level, where Zod reports "required" from the object definition. The `.positive()` messages are preserved correctly.

Add import: `import { numericField } from '../../utils/utils';`

#### 2.9 Individual rating category schemas - NO CHANGE NEEDED

**Files**:

- `packages/schemas/src/entities/accommodation/subtypes/accommodation.rating.schema.ts`
- `packages/schemas/src/entities/destination/subtypes/destination.rating.schema.ts`

**Decision**: These fields (`cleanliness`, `hospitality`, `services`, etc.) are stored as **JSONB inside a single `rating` column**, NOT as individual `numeric()` DB columns. The rating breakdown is a JSON object, and its fields are plain numbers within the JSON. They use `z.number().min(0).max(5)` which is **correct** for JSONB sub-fields. **No change needed.**

### Phase 3: Audit and Fix JS Comparisons and `.toString()` Calls

After Phase 1, `numeric()` columns return actual JavaScript `number` values. Code that previously worked around the string behavior must be updated.

#### 3.1 CRITICAL: Remove `.toString()` in review services

**6 changes required across 2 files.**

##### 3.1.1 `packages/service-core/src/services/destinationReview/destinationReview.service.ts` (4 changes)

**Lines ~167, ~170 - SQL comparison `.toString()` calls:**

Current:

```ts
extraConditions.push(gte(destinationReviews.averageRating, minRating.toString()));
// ...
extraConditions.push(lte(destinationReviews.averageRating, maxRating.toString()));
```

Target:

```ts
extraConditions.push(gte(destinationReviews.averageRating, minRating));
// ...
extraConditions.push(lte(destinationReviews.averageRating, maxRating));
```

**Lines ~198, ~221 - DB write `.toString()` calls:**

Current:

```ts
await this.model.update({ id: entity.id }, {
    averageRating: reviewAvg.toString()
} as Partial<DestinationReview>);
```

Target:

```ts
await this.model.update({ id: entity.id }, {
    averageRating: reviewAvg
} as Partial<DestinationReview>);
```

**Why**: With `mode: 'number'`, Drizzle expects a `number` for writes and internally calls `String(value)` before sending to PG. Passing a string manually would double-convert. The `as Partial<DestinationReview>` cast was also needed because TypeScript expected `string` but got `number`.. after Phase 1, the type is `number` natively. **Verify** whether the cast can be removed entirely.

##### 3.1.2 `packages/service-core/src/services/accommodationReview/accommodationReview.service.ts` (2 changes)

**Lines ~184, ~187 - SQL comparison `.toString()` calls:**

Current:

```ts
extraConditions.push(gte(accommodationReviews.averageRating, minRating.toString()));
// ...
extraConditions.push(lte(accommodationReviews.averageRating, maxRating.toString()));
```

Target:

```ts
extraConditions.push(gte(accommodationReviews.averageRating, minRating));
// ...
extraConditions.push(lte(accommodationReviews.averageRating, maxRating));
```

**Why**: Same as 3.1.1.. with `mode: 'number'`, Drizzle's `gte()`/`lte()` comparisons expect `number`, not `string`. The `.toString()` was a workaround for the column being typed as `string` without `mode: 'number'`.

**Note**: Unlike `destinationReview.service.ts`, `accommodationReview.service.ts` does NOT use `.toString()` for DB writes.. its `computeAndStoreReviewAverage()` method (line ~245) already passes `roundedAvg` as a `number` directly (with `as Partial<AccommodationReview>` cast). After Phase 1, the cast may become unnecessary.. **verify** during implementation.

#### 3.2 Full codebase audit

Search the entire codebase for remaining patterns that may need attention:

**Search patterns**:

- `averageRating` combined with `.toString()` — remove unnecessary conversions
- `averageRating` used in comparisons (`>`, `<`, `>=`, `<=`, `===`) — verify correct numeric semantics
- `rate` or `inverseRate` combined with `.toString()` — check if any exist
- `.padStart()`, `.includes('.')`, `.split('.')` on any of the 6 affected fields — these would break with `number` type

**Known safe patterns** (no changes needed):

- `exchange-rate.helpers.ts`: `input.rate` used in arithmetic with `Number()` and `.toFixed()`.. will work correctly with `number` type after Phase 1. The `Number()` call becomes a no-op (number-to-number) but is harmless.
- SQL `WHERE` clauses via Drizzle (`eq()`, `gte()`, `lte()`).. Drizzle handles type conversion via `mapToDriverValue`
- `apps/web/src/lib/api/transforms.ts`: Uses `Number(item.averageRating ?? 0)` pattern.. becomes a no-op but is harmless. Optional cleanup.

**Known patterns that MAY need cleanup** (verify during implementation):

- `accommodation.service.ts` line ~1183: `averageRating: stats.averageRating` — writes number to accommodation's `numeric()` column. Should work as-is with `mode: 'number'` since `stats.averageRating` is typed as `number`. Verify no cast needed.
- `destination.service.ts` line ~765: `averageRating: stats.averageRating` — same pattern as accommodation. Writes number to destination's `numeric()` column. Verify no cast needed.
- `accommodationReview.service.ts` line ~245: `averageRating: roundedAvg` with `as Partial<AccommodationReview>` cast — after Phase 1, the column type changes from `string` to `number` in TypeScript, so the cast may become unnecessary. Verify and remove if possible.
- `destinationReview.service.ts` lines ~198, ~221: after removing `.toString()` (Phase 3.1.1), the `as Partial<DestinationReview>` cast may also become unnecessary. Verify and remove if possible.
- Any test fixtures in `apps/api/test/helpers/mocks/` that set `averageRating` as string `"3.50"` — update to number `3.5` for consistency

### Phase 4: Verify No Migration Generated

After making Phase 1 changes:

1. Run `pnpm db:generate` to check if Drizzle generates a migration
2. If a migration is generated, inspect it. It should be empty or a no-op (column type in PG does not change)
3. If empty/no-op, discard the migration file
4. If it contains actual SQL changes, **STOP and report**.. this would indicate an unexpected Drizzle behavior

### Phase 5: Tests

#### 5.1 DB schema coercion tests

**File**: `packages/db/test/numeric-coercion.test.ts` (new)

Test that `numeric({ mode: 'number' })` columns return JavaScript `number` types:

```ts
describe('numeric column coercion', () => {
  it('averageRating returns number type from DB query', async () => {
    // Insert a record with averageRating, query it back, verify typeof === 'number'
  });

  it('exchange rate returns number type from DB query', async () => {
    // Insert an exchange rate, query it back, verify typeof === 'number'
  });

  it('averageRating default value is number 0, not string "0"', async () => {
    // Insert a record without setting averageRating, verify default is number 0
  });

  it('numeric precision is preserved for typical values', async () => {
    // Insert 3.50, verify it comes back as 3.5 (not "3.50")
    // Insert 4.99, verify it comes back as 4.99
  });

  it('exchange rate precision is preserved for typical ARS/USD values', async () => {
    // Insert rate like 0.0010234567, verify precision
    // Insert rate like 1234.5678901234, verify precision
  });
});
```

#### 5.2 Zod schema coercion tests

**File**: `packages/schemas/test/numeric-fields.test.ts` (new)

Test that Zod schemas accept both string and number inputs:

```ts
describe('numericField()', () => {
  it('accepts number input and returns number', () => {});
  it('accepts string input and returns number', () => {});
  it('rejects non-numeric string', () => {});
  it('rejects null and undefined', () => {});
  it('applies custom validation pipe', () => {});
});

describe('createAverageRatingField()', () => {
  it('accepts number 0-5 and returns number', () => {});
  it('accepts string "3.50" and returns 3.5', () => {});
  it('rejects values > 5', () => {});
  it('rejects values < 0', () => {});
  it('handles optional variant', () => {});
  it('applies default value', () => {});
});
```

## Affected Files (Complete List)

### DB Schemas (Phase 1) - 5 files

| File | Change |
|------|--------|
| `packages/db/src/schemas/accommodation/accommodation.dbschema.ts` | Add `mode: 'number'`, remove `$type<number>()`, fix default `'0'`→`0`, add JSDoc |
| `packages/db/src/schemas/destination/destination.dbschema.ts` | Add `mode: 'number'`, remove `$type<number>()`, fix default `'0'`→`0`, add JSDoc |
| `packages/db/src/schemas/accommodation/accommodation_review.dbschema.ts` | Add `mode: 'number'`, fix default `'0'`→`0`, add JSDoc |
| `packages/db/src/schemas/destination/destination_review.dbschema.ts` | Add `mode: 'number'`, fix default `'0'`→`0`, add JSDoc |
| `packages/db/src/schemas/exchange-rate/exchange-rate.dbschema.ts` | Add `mode: 'number'` to both columns, add JSDoc |

### Zod Schemas (Phase 2) - 8 files, 17 changes

| File | Changes | Count |
|------|---------|-------|
| `packages/schemas/src/common/helpers.schema.ts` | `WithReviewStateSchema.averageRating` → `createAverageRatingField({ optional: true })` | 1 |
| `packages/schemas/src/entities/accommodation/accommodation.relations.schema.ts` | 3 schemas: `averageRating` → `createAverageRatingField({ optional: true })` | 3 |
| `packages/schemas/src/entities/destination/destination.relations.schema.ts` | 3 schemas: `averageRating` → `createAverageRatingField({ optional: true })` | 3 |
| `packages/schemas/src/entities/destination/destination.query.schema.ts` | 4 schemas: replace inline union/transform with `createAverageRatingField()` | 4 |
| `packages/schemas/src/entities/accommodationReview/accommodationReview.query.schema.ts` | `StatsResponseSchema.averageRating` → `createAverageRatingField({ default: 0 })` | 1 |
| `packages/schemas/src/entities/destinationReview/destinationReview.query.schema.ts` | `StatsResponseSchema.averageRating` → `createAverageRatingField({ default: 0 })` | 1 |
| `packages/schemas/src/entities/user/user.relations.schema.ts` | 3 schemas: `averageRatingGiven` → `createAverageRatingField({ optional: true })` | 3 |
| `packages/schemas/src/entities/amenity/amenity.query.schema.ts` | Nested `averageRating` → `createAverageRatingField({ optional: true })` | 1 |

### Exchange Rate Schema (Phase 2) - 1 file, 2 changes

| File | Change |
|------|--------|
| `packages/schemas/src/entities/exchange-rate/exchange-rate.schema.ts` | `rate` and `inverseRate` → `numericField()` wrapper preserving i18n messages |

### Service Fixes (Phase 3) - 2 files, 6 changes

| File | Change |
|------|--------|
| `packages/service-core/src/services/destinationReview/destinationReview.service.ts` | Remove 4 `.toString()` calls (lines ~167, ~170, ~198, ~221) |
| `packages/service-core/src/services/accommodationReview/accommodationReview.service.ts` | Remove 2 `.toString()` calls (lines ~184, ~187) |

### Tests (Phase 5) - 2 new files

| File | Change |
|------|--------|
| `packages/db/test/numeric-coercion.test.ts` | New file: DB coercion integration tests |
| `packages/schemas/test/numeric-fields.test.ts` | New file: Zod helper unit tests |

### Audit-only (Phase 3) - verify, change only if needed

| File | Why |
|------|-----|
| `packages/service-core/src/services/exchange-rate/exchange-rate.helpers.ts` | Uses `rate` in arithmetic with `Number()` and `.toFixed()`.. verify still works (likely no-op, harmless) |
| `packages/service-core/src/services/accommodation/accommodation.service.ts` | Line ~1183: `updateStatsFromReview` writes `stats.averageRating` (number) to `numeric()` column. Verify works correctly with `mode: 'number'` |
| `packages/service-core/src/services/destination/destination.service.ts` | Line ~765: `updateStatsFromReview` writes `stats.averageRating` (number) to `numeric()` column. Verify works correctly with `mode: 'number'` |
| `packages/service-core/src/services/accommodationReview/accommodationReview.service.ts` | Line ~245: `computeAndStoreReviewAverage` passes number directly (no `.toString()`). Has `as Partial<AccommodationReview>` cast that may become unnecessary after Phase 1. Verify and remove cast if type-safe |
| `packages/service-core/src/services/destinationReview/destinationReview.service.ts` | Lines ~198, ~221: after removing `.toString()` (Phase 3.1.1), verify the `as Partial<DestinationReview>` cast can also be removed |
| `apps/web/src/lib/api/transforms.ts` | Uses `Number(item.averageRating ?? 0)` pattern.. becomes no-op but harmless. Optional cleanup |
| `apps/api/test/helpers/mocks/` | Test fixtures may set `averageRating` as string `"3.50"`.. update to number `3.5` for consistency |

## Acceptance Criteria

### Phase 1: DB Schema

- [ ] All 6 `numeric()` columns use `mode: 'number'` in their Drizzle definition
- [ ] `$type<number>()` removed from `accommodations.averageRating` and `destinations.averageRating`
- [ ] All 6 columns have JSDoc explaining the coercion behavior
- [ ] Default values changed from string `'0'` to number `0` on all 4 `averageRating` columns

### Phase 2: Zod Schemas

- [ ] All 17 `averageRating` Zod definitions use `createAverageRatingField()` (see Phase 2.1-2.7 for full list)
- [ ] All 4 inline union/transform duplications in `destination.query.schema.ts` replaced with helper
- [ ] Exchange rate schema uses `numericField()` for `rate` and `inverseRate`, preserving i18n messages
- [ ] `WithReviewStateSchema` uses `createAverageRatingField({ optional: true })`
- [ ] `averageRatingGiven` fields in user relation schemas use `createAverageRatingField({ optional: true })`
- [ ] No plain `z.number().min(0).max(5)` remains for any field backed by a `numeric()` DB column

### Phase 3: Service Fixes

- [ ] 4 `.toString()` calls removed from `destinationReview.service.ts` (lines ~167, ~170, ~198, ~221)
- [ ] 2 `.toString()` calls removed from `accommodationReview.service.ts` (lines ~184, ~187)
- [ ] `as Partial<DestinationReview>` casts at lines ~199, ~222 in `destinationReview.service.ts` reviewed and removed if now type-safe
- [ ] `as Partial<AccommodationReview>` cast at line ~246 in `accommodationReview.service.ts` reviewed and removed if now type-safe
- [ ] `updateStatsFromReview` in `accommodation.service.ts` (~1183) and `destination.service.ts` (~765) verified working with `mode: 'number'`
- [ ] Full codebase audit confirms no remaining string-specific operations on numeric column values
- [ ] No regressions in destination/accommodation review filtering or average rating calculation

### Phase 4: Migration Verification

- [ ] `pnpm db:generate` produces no meaningful migration (column type unchanged in PG)

### Phase 5: Tests

- [ ] DB coercion integration tests pass (`packages/db/test/numeric-coercion.test.ts`)
- [ ] Zod schema unit tests pass (`packages/schemas/test/numeric-fields.test.ts`)

### Quality Gates

- [ ] `pnpm typecheck` passes with no new errors
- [ ] `pnpm lint` passes
- [ ] Existing test suites pass with no regressions

## Dependencies and Implementation Order

### Prerequisites

- **None required before starting**. This spec has no blocking dependencies.

### Relationship with SPEC-057 (Admin Response Schema Consistency)

**SPEC-056 SHOULD be completed BEFORE SPEC-057.** Here is why and what each spec owns:

| Concern | SPEC-056 (this spec) | SPEC-057 |
|---------|---------------------|----------|
| DB column runtime type | Fixes at ORM layer (`mode: 'number'`) | Does NOT touch DB schemas |
| Zod entity schemas | Migrates to `createAverageRatingField()` / `numericField()` | Does NOT touch entity-level Zod schemas |
| Admin response schemas | Does NOT create new admin schemas | Creates `*AdminSchema` variants with audit metadata |
| `averageRating` type in responses | Ensures it's `number` at source | Inherits correct `number` type from entity schemas |

**What happens if SPEC-057 goes first**: The new `*AdminSchema` variants would inherit the current broken `z.number()` definitions and would need to be changed again when SPEC-056 is applied. Double work.

**What happens if SPEC-056 goes first** (recommended): All entity schemas already have correct `string | number` coercion. When SPEC-057 creates admin response schemas that extend or reference these entities, they automatically get correct numeric types. Zero rework.

### Relationship with other specs (SPEC-050 through SPEC-055)

| Spec | Overlap with SPEC-056? | Notes |
|------|----------------------|-------|
| SPEC-050 (Lifecycle State Modeling) | None | Deals with status/lifecycle columns (varchar), not numeric |
| SPEC-051 (Admin Permission Hook) | None | Deals with permission checking logic, not data types |
| SPEC-052 (Type-Safe Entity Filters) | None | Deals with generic type propagation for filter params, not column types |
| SPEC-053 (findAllWithRelations tx) | None | Deals with transaction parameter threading, not column types |
| SPEC-054 (Default Filters UI) | None | Frontend-only (admin filter bar UI), does not touch DB or schemas |
| SPEC-055 (LIKE Wildcard Escaping) | None | Deals with string search patterns, not numeric columns |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `drizzle-kit generate` produces unexpected migration | Low | Medium | Inspect generated SQL. If it changes column type, discard and investigate |
| Precision loss on exchange rates | Very Low | Low | `numeric(20,10)` values for ARS/USD/BRL use < 15 significant digits. `Number()` handles ~15-17 digits |
| Code expects string type after change | Low | Low | Phase 3 audit catches these. TypeScript will flag type mismatches |
| Test fixtures pass string values | Low | Low | Zod defensive layer (Phase 2) handles string inputs gracefully |
| Review service `.toString()` removal breaks filtering | Very Low | Medium | Phase 3 removes `.toString()` in SQL comparisons for both `destinationReview` and `accommodationReview` services. Drizzle's `gte()`/`lte()` handle `number` natively with `mode: 'number'` columns. Regression test required |
| Scope creep from Phase 2 Zod changes (17 changes across 8 files) | Low | Low | All changes are mechanical (one-line replacements). No logic changes, only Zod helper substitution |

## Technical Notes

### Why not `mapWith()`?

`mapWith()` does **not exist** on Drizzle column builders. It only exists on `sql` template tag expressions (e.g., `sql\`count(*)\`.mapWith(Number)`). Any documentation suggesting`mapWith()` for column definitions is incorrect.

### Why not `customType()`?

Drizzle's `customType()` API allows full control over serialization/deserialization. However, `numeric({ mode: 'number' })` achieves the same result with zero boilerplate. `customType()` would only be needed if we required custom parsing logic (e.g., `Number.parseFloat` instead of `Number`, or NaN validation). For our use case, `Number()` is sufficient.

### Why defensive Zod schemas if ORM handles it?

The `mode: 'number'` fix covers all standard Drizzle query paths. However, there are edge cases where raw DB values might bypass the ORM:

- Raw SQL queries via `db.execute(sql\`...\`)`
- Test fixtures that construct objects manually
- Data imported from external sources

Using `numericField()` / `createAverageRatingField()` in Zod schemas provides a second safety net at the validation boundary.

### `doublePrecision()` vs `numeric()` behavior

- `numeric()`: PG driver returns `string` (preserves arbitrary precision)
- `doublePrecision()`: PG driver returns `number` (IEEE 754 double, ~15-17 digits)
- `integer()` / `bigint()`: PG driver returns `number` / `bigint`

Only `numeric()` / `decimal()` columns have the string coercion issue.
