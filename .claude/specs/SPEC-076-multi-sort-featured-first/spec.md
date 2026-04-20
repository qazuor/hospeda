# SPEC-076: Multi-Column Sort + `featuredFirst` for Accommodation Search

> **Status**: draft
> **Type**: feature
> **Priority**: P2
> **Complexity**: Medium
> **Origin**: Product requirement — featured accommodations must always appear before non-featured ones in public listing, while respecting the user's chosen sort order within each group. Admin requires arbitrary multi-column sorting.
> **Created**: 2026-04-13
> **Last revision**: 2026-04-20 (pass #5 — see Revision History)

## Revision History

| Pass | Date | Reviewer | Summary |
|------|------|----------|---------|
| #1 | 2026-04-19 | Claude (exhaustive review) | Verified every file/line reference against current repo state. Tightened 6 design decisions (dedup rule, stable tiebreaker, max sorts, dup HTTP schema handling, opt-out policy, service.searchWithRelations fix). Added edge-case behavior table, missing `.describe()`, integration test criterion, and documented pre-existing `features` orphan bug. See section "Pass #1 Changes Summary" at the end of this document. |
| #2 | 2026-04-20 | Claude (exhaustive review, pass #2) | Re-verified every line reference against current repo; fixed 2 incorrect line numbers (`227` for search `orderBy`, `314-368` for compile-time checks). Re-characterized `HttpAccommodationSearchSchema` (not a "duplicate" — verified dead alt schema with zero external consumers; now deprecated via JSDoc). Reformulated the "DoS via huge ORDER BY" justification to correct technical rationale (index-degradation + `work_mem` spills). Added cross-reference to canonical `createArrayQueryParam` helper so implementers know NOT to reinvent it. Added Zod v4 `z.stringbool()` future-refactor note and Zod v4 issue-shape caveat for test authors. Pulled in the pre-existing `features` orphan fix (scope expansion per user decision). Added integration-test criterion for the forced `featuredFirst` rule (client opt-out ignored). See "Pass #2 Changes Summary" at the end of this document. |
| #3 | 2026-04-20 | Claude (exhaustive review, pass #3) | Ground-truth re-verification of every file/line reference; corrected 3 line-ranges that had drifted (`314-368` → `314-399`, `689-705` → `687-703`, `154-185` → `152-189`). **Added critical Drizzle `orderBy(...spread)` warning** — passing a bare array silently breaks SQL generation. Applied 4 user decisions: (1) `NULLS LAST` for numeric-nullable fields (`averageRating`, `reviewsCount`, `minPrice`, `maxPrice`) via raw `sql` template; (2) i18n integration for `.max(5)` error message using existing `zodError.*` key pattern and `resolveValidationMessage` helper; (3) dedup rule extended to legacy `sortBy` path (not just `sorts[]`); (4) OpenAPI `example` metadata for `sorts` query param. Clarified that `searchWithRelations` already has `sortBy`/`sortOrder` (verified lines 691-692) — only `sorts`/`featuredFirst`/`features` need to be added. Enriched Zod v4 issue-shape example with `input` field and noted `ZodIssueCode` enum removal. Added official Zod docs link for `z.coerce.boolean()`. Documented `sorts[]` duplicate-field edge case. See "Pass #3 Changes Summary" at the end of this document. |
| #4 | 2026-04-20 | Claude (exhaustive review, pass #4) | Ground-truth re-verification against the live repo and official docs (Zod `^4.0.8`, Drizzle `^0.44.7`, `@hono/zod-openapi ^1.2.2`). **Flipped OpenAPI recommendation** `.meta()` → `.openapi()` after verifying 10+ existing uses of `.openapi({...})` in `apps/api/src/schemas/base-schemas.ts` and zero uses of `.meta()` across `packages/schemas/src`. **Corrected `_executeSearch` line range** `608-621` → `606-619` (function now verified at lines 606-619 of `accommodation.service.ts`). **Softened Drizzle source-file line citation** (was `select.ts:883-917`, now a version-independent pointer — internal file line numbers drift between patch releases). **Added explicit acceptance criterion** that the pre-existing `sanitizeSortBy()` helper (`list.ts:46`) must remain in place as the guard for the legacy fallback path — previously only implicit in the code example. No scope changes, no new decisions required. See "Pass #4 Changes Summary" at the end of this document. |
| #5 | 2026-04-20 | Claude (exhaustive review, pass #5) | Ground-truth re-verification (every line reference still accurate — no drift since pass #4). **CRITICAL FIX**: the "Drizzle `orderBy(...)` invocation" warning was split by API shape. `search()` uses the chained select builder → spread `orderBy(...orderBy)` required. `searchWithRelations()` uses `db.query.accommodations.findMany({ orderBy, ... })` (Relational Query Builder API) → bare array as object property; spread is a syntax error there. Previous pass conflated both APIs. **Corrected 3 path references** `apps/api/src/create-app.ts` → `apps/api/src/utils/create-app.ts`. **Softened `z.ZodIssueCode` claim** — still exported as compat in 4.0.8 (verified at `apps/api/src/utils/env.ts:331`), not removed. **Corrected `input`-field claim** — only present when `reportInput` is enabled (not default; verified against zod.dev/error-customization). **Added transformer-pipeline note** pointing at `apps/api/src/utils/zod-error-transformer.ts` (`transformZodError` line 243) so test authors debugging locale keys know where the `message → messageKey` promotion happens. **Added `{ message }` vs `{ error }` compat note** acknowledging v4-canonical is `{ error }` but codebase consistently uses `{ message }` (20+ call sites on Zod 4.0.8); do NOT switch here. No scope changes, no new product decisions. See "Pass #5 Changes Summary" at the end of this document. |

## Problem Statement

The current accommodation search supports only **single-column sorting** (`sortBy` + `sortOrder`).
This causes two problems:

1. **Public listing**: Featured accommodations are interleaved with non-featured ones regardless of
   sort order. The business requirement is that featured ones always appear first within any given
   sort (e.g., featured sorted by rating → non-featured sorted by rating).

2. **Admin panel**: There is no way to express compound sorts like
   `averageRating DESC, name ASC` without multiple round-trips or in-memory sorting (which breaks
   pagination).

In-memory sorting is **not a valid solution** because it breaks pagination: page 1 could return
non-featured accommodations that should appear on page 3 after the featured block.

## Goal

1. Add a `featuredFirst?: boolean` parameter to `AccommodationSearch` (domain) and expose it via
   HTTP. When `true`, the DB query prepends `isFeatured DESC` as the primary sort key.

2. Replace the single `sortBy`/`sortOrder` pair with a `sorts` array that supports up to **5** sort
   fields in order of precedence. Backward compatibility with `sortBy`/`sortOrder` is preserved as
   a fallback.

3. The solution is implemented at the DB level (Drizzle `orderBy` clause) — no in-memory sorting.

4. The public route enforces a whitelist on all fields present in `sorts[]`, just as it currently
   does for the single `sortBy`.

5. The query always ends with a **stable tiebreaker** (`id DESC`) to guarantee deterministic
   pagination when multiple rows share the leading sort values.

## Current State

### Sorting today (single-column)

**Schema** (`packages/schemas/src/common/pagination.schema.ts:36`):
```typescript
export const BaseSearchSchema = z.object({
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(10),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc').optional(),
    q: z.string().optional()
});
```

**HTTP schema** (`packages/schemas/src/api/http/base-http.schema.ts:33`):
```typescript
export const HttpSortingSchema = z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc').optional()
});
```

**Model** (`packages/db/src/models/accommodation/accommodation.model.ts:227` for `search`,
`:374` for `searchWithRelations` — both methods have the identical single-column `orderBy`
construction):
```typescript
const orderBy = [];
if (params.sortBy) {
    const column = accommodations[params.sortBy as keyof typeof accommodations];
    if (column && typeof column === 'object' && 'name' in column) {
        orderBy.push(
            params.sortOrder === 'desc'
                ? desc(column as AnyColumn)
                : asc(column as AnyColumn)
        );
    }
}
```

Issues with this approach:
- `orderBy` is always single-element maximum.
- `isFeatured` ordering can only be the sole sort key, not prepended to another.
- No multi-column support.
- No stable tiebreaker → pagination can repeat / skip rows when the sort column has ties.

### Public route whitelist (`apps/api/src/routes/accommodation/public/list.ts:33`):
```typescript
const ALLOWED_SORT_FIELDS = new Set([
    'name', 'createdAt', 'averageRating', 'reviewsCount', 'isFeatured'
]);
```

### Service-layer param flow (important)

The public route calls `accommodationService.search(actor, {...})`, which goes through
`BaseCrudRead.search()` (`packages/service-core/src/base/base.crud.read.ts:305-332`). That base
method forwards `processedParams` to `_executeSearch()`, and `AccommodationService._executeSearch`
(`packages/service-core/src/services/accommodation/accommodation.service.ts:606-619`) uses
`{...params}` **spread**, so new fields like `sorts` / `featuredFirst` will reach
`model.searchWithRelations()` automatically.

However, `AccommodationService.searchWithRelations()` at
`packages/service-core/src/services/accommodation/accommodation.service.ts:655-735` is a separate
public method that **cherry-picks params manually** (lines 687-703). It has no callers in `apps/`
today, but if anyone ever calls it, `sorts` and `featuredFirst` would be silently dropped. This
spec updates that method too for consistency (see "Affected Files").

> **Pass #3 correction**: the current `modelParams` cherry-pick ALREADY includes `sortBy` and
> `sortOrder` (lines 691-692, verified against current file state). What it is missing is `sorts`,
> `featuredFirst`, and the orphan `features` field. Do NOT re-add `sortBy`/`sortOrder` — they are
> already there. Only add the three new/orphan fields.

### Compile-time checks

`packages/schemas/src/entities/accommodation/accommodation.http.schema.ts` (lines 314-399)
contains 6 TypeScript compile-time assertions that verify `httpToDomainAccommodationSearch`
covers every field of `AccommodationSearch`. Adding new fields to the domain schema without
mapping them in the conversion function **will cause a TypeScript build error**. This is
intentional and must be respected.

> **Pre-existing bug folded into this spec (pass #2)**: the domain schema
> `AccommodationSearchSchema` (`accommodation.query.schema.ts:115`) has a `features` field
> (UUID array) that is NOT mapped by `httpToDomainAccommodationSearch` and is not exposed
> on the current HTTP schema. The compile-time `_searchFieldsCheck` fails to catch this
> because it only enforces `DomainSearchFields ⊆ HttpConversionFields` — so a domain field
> that the HTTP schema simply never carried goes undetected. Per user decision on pass #2,
> this spec now folds in the 3-line fix alongside the `sorts`/`featuredFirst` additions:
>
> 1. Add `features: z.array(z.string().uuid()).optional().describe(...)` to
>    `AccommodationSearchHttpSchema` (reuse the comma-separated UUID pattern that `amenities`
>    already uses, see `accommodation.http.schema.ts` around the `amenities` field).
> 2. Map `features: httpParams.features` in `httpToDomainAccommodationSearch`.
> 3. Forward `features: processedParams.features` in
>    `AccommodationService.searchWithRelations()`'s manual `modelParams` (lines 689-705),
>    same block we already have to edit for `sorts`/`featuredFirst`.
>
> No model changes needed — `features` is already a valid filter in `AccommodationModel`.

### Dead alternate HTTP schema (deprecate via JSDoc)

`packages/schemas/src/entities/accommodation/accommodation.query.schema.ts:142` exports
`HttpAccommodationSearchSchema`, an older HTTP search schema that is NOT wired to the current
public route (which uses `AccommodationSearchHttpSchema` from `accommodation.http.schema.ts`).
It is NOT a strict duplicate — it has a different field set (e.g., no `features`) and different
defaults — just an older, abandoned alternative.

Verified usage (pass #2, grep across monorepo):
- Only internal consumer: `AccommodationSearchSchemaWithMetadata` (same file, line 203), which
  is itself exported but imported by **zero** files outside this file.
- `HttpAccommodationSearch` inferred type (line 194): imported by **zero** files.

It is effectively dead code. This spec **does NOT mirror the new fields into it** (scope creep),
but adds a `@deprecated` JSDoc directive on both `HttpAccommodationSearchSchema` (line 142) and
`AccommodationSearchSchemaWithMetadata` (line 203) pointing at `AccommodationSearchHttpSchema`
so future readers don't mistakenly extend it.

> **Cross-reference with SPEC-077**: the draft spec `SPEC-077-accommodation-detail-page-rebuild`
> mentions `HttpAccommodationSearchSchema` as the source for the `ownerId` filter. That is
> incorrect — SPEC-077 should use `AccommodationSearchHttpSchema`. Flag it when SPEC-077 moves
> from draft to implementation so the deprecation does not block that work.

## Proposed Solution

### New type: `SortField`

```typescript
// packages/schemas/src/common/pagination.schema.ts
export const SortFieldSchema = z.object({
    field: z.string().min(1),
    order: z.enum(['asc', 'desc'])
});
export type SortField = z.infer<typeof SortFieldSchema>;
```

### Domain schema changes (`BaseSearchSchema`)

```typescript
export const BaseSearchSchema = z.object({
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(10),
    // Legacy single-sort — kept for backward compat, lower precedence than 'sorts'
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc').optional(),
    // Multi-sort — takes precedence over sortBy/sortOrder when present.
    // Max 5 entries to cap ORDER BY complexity. PostgreSQL has no hardcoded limit, but
    // every extra key reduces the chance of matching a pre-ordered composite index
    // (PG requires exact column-order + asc/desc + nulls-positioning match) and risks
    // spilling the sort to disk via `work_mem` on large resultsets. 5 is a pragmatic
    // product cap, not a security boundary.
    sorts: z
        .array(SortFieldSchema)
        .max(5, { message: 'zodError.common.sort.maxFields' })
        .optional(),
    // Featured-first flag (public listing forces this to true on the server)
    featuredFirst: z.boolean().optional(),
    q: z.string().optional()
});
```

> **i18n for the `.max(5)` error message (pass #3)**. The project convention is to pass a
> `zodError.*` key as the Zod `message`, not a hardcoded English string. The HTTP `defaultHook`
> in `apps/api/src/utils/create-app.ts` already forwards these keys to the client as `messageKey`, and
> the resolver `resolveValidationMessage()` (in `packages/i18n/src/utils/resolve-validation-message.ts`)
> translates them on the consumer side. For this spec, add the new key to each locale:
>
> `packages/i18n/src/locales/es/validation.json`:
> ```json
> "common": {
>   "sort": {
>     "maxFields": "No se pueden especificar más de 5 campos de ordenamiento"
>   }
> }
> ```
> `packages/i18n/src/locales/en/validation.json`:
> ```json
> "common": {
>   "sort": {
>     "maxFields": "A maximum of 5 sort fields is allowed"
>   }
> }
> ```
> `packages/i18n/src/locales/pt/validation.json`:
> ```json
> "common": {
>   "sort": {
>     "maxFields": "Um máximo de 5 campos de ordenação é permitido"
>   }
> }
> ```
>
> The `common.sort.*` namespace was chosen because `sorts` lives in `BaseSearchSchema`
> (not an entity-specific schema), matching the convention used for other `common.*` keys.
>
> **Error-transform pipeline (pass #5)**. The Zod `message` field does NOT reach the HTTP
> response directly. It goes through this pipeline:
>
> ```
> raw ZodError
>   → apps/api/src/utils/zod-error-transformer.ts  (transformZodError at line 243)
>       - for each issue, promotes issue.message → messageKey on the result
>       - extracts params, formats summary, userFriendlyMessage
>   → apps/api/src/utils/create-app.ts  (defaultHook at ~line 79)
>       - c.json({ success: false, error: { messageKey, details, summary, ... } }, 400)
>   → client receives messageKey and resolves via resolveValidationMessage() in @repo/i18n
> ```
>
> Test authors debugging a locale key that "doesn't surface" should break the bug down by
> layer: unit-test the Zod schema (raw `message` on the issue), integration-test the
> transformer (`transformZodError`), and route-test the full HTTP response
> (`response.error.messageKey`). The three layers are independently verifiable.
>
> **`{ message }` vs `{ error }` Zod v4 compat note (pass #5)**. The v4-canonical form
> is `.max(5, { error: 'zodError.key' })`; `{ message }` is legacy-compat retained via a
> v4 shim. The codebase uses `{ message }` consistently — 20+ call sites in
> `packages/schemas/src`, all green on Zod `^4.0.8`. This spec keeps `{ message }` to match
> the convention; do NOT switch to `{ error }` as part of this change (it would be
> cross-cutting scope creep unrelated to the multi-sort feature). A future migration to
> `{ error }` is a separate refactor candidate alongside the `z.stringbool()` one.

### HTTP schema changes (`HttpSortingSchema`)

HTTP format for `sorts`: comma-separated `field:order` pairs, consistent with the existing
`amenities=uuid1,uuid2` pattern already used in this codebase.

> **Note on the CSV query-param pattern**: the codebase exposes a canonical helper
> `createArrayQueryParam(description)` at `packages/schemas/src/api/http/base-http.schema.ts:83`
> that handles plain CSV arrays of strings. `sorts` requires a richer transform (parsing
> `field:order` pairs into objects), so we inline a custom `.transform(...)` below instead
> of reusing the helper. This is intentional — do NOT generalize `createArrayQueryParam` to
> cover this case; keep it simple for its current 10+ call sites.

Use `createBooleanQueryParam` for `featuredFirst` (not `z.coerce.boolean()`, which accepts any
non-empty string as `true` — including the literal string `'false'`). This is documented at
https://zod.dev/api#coerce (Zod v4, "Boolean coercion" section) which explicitly states:
`schema.parse("false") // => true`. Identical semantics in v3. `createBooleanQueryParam` is
defined in `packages/schemas/src/api/http/base-http.schema.ts:60` and only accepts the literal
strings `'true'` and `'false'`.

> **Future-refactor note (do NOT apply in this spec)**: Zod v4 ships `z.stringbool()` which
> natively parses the strings `'true'` / `'false'` to booleans and is the canonical v4
> replacement for the `createBooleanQueryParam` helper. Migrating is out of scope here because
> it would touch 27+ existing call sites across the schema package. If a future cleanup wants
> to consolidate, `z.stringbool().optional().describe(...)` is the direct drop-in.

```typescript
// packages/schemas/src/api/http/base-http.schema.ts
export const HttpSortingSchema = z.object({
    sortBy: z.string().optional().describe('Field name to sort by (legacy single-sort)'),
    sortOrder: z
        .enum(['asc', 'desc'])
        .default('asc')
        .optional()
        .describe('Sort direction (ascending or descending)'),
    // Example: sorts=averageRating:desc,name:asc
    sorts: z
        .string()
        .transform((val) =>
            val
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((s) => {
                    const [field, order] = s.split(':');
                    return {
                        field: (field ?? '').trim(),
                        order: order === 'desc' ? ('desc' as const) : ('asc' as const)
                    };
                })
                // Drop entries whose `field` is empty after parsing (e.g. ":desc" or "")
                .filter((sf) => sf.field.length > 0)
                .slice(0, 5) // hard cap matches the domain schema
        )
        .optional()
        .describe(
            'Comma-separated sort fields in precedence order: `field:order,field:order`. ' +
                'Max 5 entries. Unknown/empty fields are silently dropped.'
        )
        // OpenAPI example — rendered by `@hono/zod-openapi` in the Swagger UI so API consumers
        // see a ready-to-copy query string. The project uses `.openapi({...})` consistently
        // (10+ call sites in `apps/api/src/schemas/base-schemas.ts`); do NOT use Zod v4's
        // native `.meta()` here, even though it is technically available — it is not how
        // this codebase registers OpenAPI metadata (zero `.meta()` usage in `packages/schemas/src`).
        .openapi({ example: 'averageRating:desc,name:asc' }),
    featuredFirst: createBooleanQueryParam(
        'When true, featured accommodations appear before non-featured within any sort.'
    )
});
```

#### Edge-case table for `sorts` parsing

| Input query string | Parsed value | Notes |
|--------------------|--------------|-------|
| `sorts=averageRating:desc,name:asc` | `[{field:'averageRating',order:'desc'},{field:'name',order:'asc'}]` | Happy path |
| `sorts=name` | `[{field:'name',order:'asc'}]` | Missing order defaults to `asc` |
| `sorts=name:invalid` | `[{field:'name',order:'asc'}]` | Unknown order coerced to `asc` (only `desc` triggers desc) |
| `sorts=:desc` | `[]` | Empty field dropped |
| `sorts=` (empty) | `[]` → transform returns `[]`, route's `sanitizeSorts` returns `undefined` | Falls back to `sortBy`/`sortOrder` |
| `sorts=unknown` (field not in whitelist) | `[{field:'unknown',order:'asc'}]` then stripped by `sanitizeSorts` → `undefined` | Falls back to `sortBy`/`sortOrder` |
| `sorts=a:asc,b:asc,c:asc,d:asc,e:asc,f:asc` (6 entries) | first 5 kept, 6th truncated | Enforced by `.slice(0, 5)` + Zod `.max(5)` |

#### Zod v4 error-shape caveat (for test authors)

The project uses Zod `^4.0.8` (see `packages/schemas/package.json`). Zod v4 changed the
error-issue shape from v3:

1. Array-size violations now carry `origin: 'array'` instead of `type: 'array'`. The `origin`
   field now applies to more than just arrays (`'string'`, `'number'`, `'set'`, `'file'`, etc.).
2. `z.ZodIssueCode` is still exported in 4.0.8 as a compat shim (verified: `env.ts:331` uses
   `z.ZodIssueCode.custom` at runtime without issue), but it is NOT the v4-idiomatic form.
   New tests should compare against the literal string (e.g. `'too_big'`) — do NOT rely on
   `ZodIssueCode.too_big` in new code, even though it still resolves.
3. v4 issues MAY carry an `input` field (the offending raw value), but **only when the
   consumer opts in**: pass `{ reportInput: true }` to `safeParse` / `parse`, or set it
   globally. By default it is absent. The Hospeda API currently does NOT enable `reportInput`,
   so assume `input` is missing unless the test explicitly opts in. Shape-equality assertions
   should use `if ('input' in issue)` or explicitly ignore the field.

Tests asserting the shape of the `.max(5)` error on `sorts` MUST use the v4 format.
Note: the `message` string in the issue is now the **i18n key** (`'zodError.common.sort.maxFields'`),
not the translated text — translation happens client-side via `resolveValidationMessage()`.
Example v4 issue:

```json
{
  "code": "too_big",
  "maximum": 5,
  "origin": "array",
  "inclusive": true,
  "message": "zodError.common.sort.maxFields",
  "path": ["sorts"],
  "input": [/* the rejected array */]
}
```

Do NOT assume `type: 'array'` or `ZodIssueCode.too_big`; CI will reject legacy v3 assertions.

### Precedence and dedup rules in the model

```
ORDER BY:
  1. isFeatured DESC           ← if featuredFirst === true (always first when set)
  2. sorts[0].field ordered    ← if sorts[] present, iterate in declared order.
     sorts[1].field ordered      If featuredFirst === true, any entry with
     ...                         field === 'isFeatured' is removed before iteration
                                 (prevents duplicated ORDER BY on is_featured).
  OR (fallback when sorts is absent/empty):
  2. sortBy sortOrder           ← legacy path (ALSO subject to isFeatured dedup, see below)
  3. id DESC                    ← STABLE TIEBREAKER, always appended
```

Notes:
- The tiebreaker uses `id DESC` because the primary key index is already present and cheap. This
  guarantees that when multiple rows share values for the preceding sort keys (very common for
  `averageRating`, `reviewsCount`), pagination is deterministic across pages.
- The tiebreaker is appended unconditionally, even when no other sort is specified. That means
  the query with zero sorts becomes `ORDER BY id DESC`, which is still deterministic.
- `featuredFirst` dedup removes `isFeatured` entries only when `featuredFirst === true`. If
  `featuredFirst` is absent / false, an explicit `isFeatured` entry in `sorts[]` is respected.
- **Legacy-path dedup (pass #3)**: the same dedup applies to the fallback `sortBy` path. If
  `featuredFirst === true` AND `sortBy === 'isFeatured'`, the legacy pair is dropped and the
  query relies solely on the primary `isFeatured DESC` (step 1) followed by the tiebreaker.
  Without this, the ORDER BY would duplicate `is_featured` twice.
- **Duplicate field names within `sorts[]`** (e.g., `sorts=name:asc,name:desc`) are accepted
  as-is. Postgres parses and honors the order declared, but the second appearance of a column
  has no additional discriminating effect (it only affects rows tied on the first). This is
  correct behavior; the spec does NOT deduplicate by `field` name within `sorts[]`.

### Model implementation (`accommodation.model.ts`)

Replace the single-column `orderBy` construction in both `search()` and `searchWithRelations()`:

```typescript
import { sql } from 'drizzle-orm';

// --- Helpers (put at module top, after imports) ---

/**
 * Nullable numeric columns where Postgres' default NULLS handling causes UX surprises.
 * With `DESC`, PG places NULLs FIRST by default — so "sort by rating desc" would put
 * accommodations WITHOUT rating at the top. We force NULLS LAST for these fields.
 */
const NUMERIC_NULLABLE_FIELDS = new Set<string>([
    'averageRating',
    'reviewsCount',
    'minPrice',
    'maxPrice'
]);

/**
 * Build a Drizzle-compatible sort expression that forces NULLS LAST for nullable
 * numeric fields, and defers to stock asc()/desc() for everything else.
 *
 * Drizzle core asc()/desc() do NOT expose NULLS FIRST/LAST, so we fall back to raw
 * sql`` template for the numeric-nullable case.
 */
function buildSortExpr(column: AnyColumn, order: 'asc' | 'desc', field: string) {
    if (NUMERIC_NULLABLE_FIELDS.has(field)) {
        return order === 'desc'
            ? sql`${column} DESC NULLS LAST`
            : sql`${column} ASC NULLS LAST`;
    }
    return order === 'desc' ? desc(column) : asc(column);
}

// --- orderBy construction (inside both search() and searchWithRelations()) ---

const orderBy: (SQL | AnyColumn)[] = [];

// 1. Featured always first when requested
if (params.featuredFirst) {
    orderBy.push(desc(accommodations.isFeatured));
}

// 2. Multi-sort: 'sorts' takes precedence over legacy 'sortBy'
//    Legacy-path dedup: drop sortBy='isFeatured' when featuredFirst is already pinned.
const legacyFallback: SortField[] =
    params.sortBy && !(params.featuredFirst && params.sortBy === 'isFeatured')
        ? [{ field: params.sortBy, order: params.sortOrder ?? 'asc' }]
        : [];
const rawSortFields: SortField[] = params.sorts ?? legacyFallback;

//    Multi-sort dedup: drop any isFeatured entry when featuredFirst is pinned as primary.
const sortFields = params.featuredFirst
    ? rawSortFields.filter((s) => s.field !== 'isFeatured')
    : rawSortFields;

for (const sort of sortFields) {
    const column = accommodations[sort.field as keyof typeof accommodations];
    if (column && typeof column === 'object' && 'name' in column) {
        orderBy.push(buildSortExpr(column as AnyColumn, sort.order, sort.field));
    }
}

// 3. Stable tiebreaker — always last, guarantees deterministic pagination
orderBy.push(desc(accommodations.id));
```

### CRITICAL — Drizzle `orderBy` invocation: two DIFFERENT APIs, do NOT conflate

The two methods we're editing use **different Drizzle APIs**. The `orderBy` call shape is
NOT the same in both places — passing the array the wrong way is a silent-breakage trap.

#### Case A — `AccommodationModel.search()` uses the SELECT BUILDER (chained)

The select builder's `.orderBy()` method is **variadic**: it accepts `...columns` (or a
callback returning an array). Passing a bare array as a single argument compiles (TS
widens it to `any`/overload resolves loosely) but emits broken SQL at runtime.

```typescript
// ✅ CORRECT — spread the dynamically built array
return await db
    .select(...)
    .from(accommodations)
    .where(and(...whereClauses))
    .orderBy(...orderBy)          // ← SPREAD, not bare array
    .limit(pageSize)
    .offset(offset);

// ❌ WRONG — compiles, emits broken SQL
.orderBy(orderBy)
```

The existing code at `accommodation.model.ts:246` already uses spread (`.orderBy(...orderBy)`);
the multi-sort edit preserves that pattern.

Source: Drizzle's `PgSelect.orderBy()` is variadic — see the `orderBy` method in
`drizzle-orm/src/pg-core/query-builders/select.ts` (applies to `drizzle-orm ≥ 0.30`; this
repo is on `^0.44.7`, verified via `apps/api/package.json`). The signature is
`orderBy(...columns: (PgColumn | SQL | SQL.Aliased)[])` (variadic) or a callback.

#### Case B — `AccommodationModel.searchWithRelations()` uses the RQB `findMany` API (object)

This method does NOT use the chained select builder — it uses the **Relational Query
Builder** (RQB) via `db.query.accommodations.findMany({ ... })`. Here `orderBy` is an
**object property**, not a method call. Its type is `SQL | SQL[] | ((...)=>...)` — so a
bare array IS valid as the property value, and spread is a **syntax error** inside an
object literal.

```typescript
// ✅ CORRECT for RQB — bare array as an object property
const results = await db.query.accommodations.findMany({
    where,
    with: { ... },
    orderBy,                      // ← bare array (the new multi-sort array)
    limit: pageSize,
    offset: (page - 1) * pageSize
});

// ❌ WRONG — `...orderBy` inside an object literal is a SyntaxError
// orderBy: ...orderBy
```

The existing code at `accommodation.model.ts:420` already uses the bare-array form; the
multi-sort edit preserves that form.

#### Summary of where each form applies

| Method | API used | `orderBy` form | Spec file line (current) |
|--------|----------|----------------|---------------------------|
| `AccommodationModel.search()` | `db.select().from().orderBy(...)` chained builder | `.orderBy(...orderBy)` (spread) | line 246 |
| `AccommodationModel.searchWithRelations()` | `db.query.X.findMany({ orderBy, ... })` RQB | `orderBy,` (bare array property) | line 420 |

**Empty array behavior**: in BOTH APIs, an empty `orderBy` array emits no `ORDER BY`
clause. The stable tiebreaker (`desc(accommodations.id)`) guarantees the array is never
empty, so in practice the query always has at least `ORDER BY id DESC`.

> **Note**: `countByFilters()` does NOT need changes. Counting is order-independent.

### Public route: whitelist enforcement for `sorts`

```typescript
// apps/api/src/routes/accommodation/public/list.ts

/**
 * Sanitize a sorts[] array against the public allow-list.
 * Returns undefined if the array is empty after filtering, so the route falls
 * back to sortBy/sortOrder (and then to the stable tiebreaker in the model).
 */
function sanitizeSorts(sorts: SortField[] | undefined): SortField[] | undefined {
    if (!sorts) return undefined;
    const filtered = sorts.filter((s) => ALLOWED_SORT_FIELDS.has(s.field));
    return filtered.length > 0 ? filtered : undefined;
}
```

The route handler passes `featuredFirst: true` explicitly (forced, no client opt-out):

```typescript
const result = await accommodationService.search(actor, {
    ...domainParams,
    page,
    pageSize,
    sortBy: safeSortBy,
    sortOrder: safeSortBy ? (domainParams.sortOrder ?? 'asc') : undefined,
    sorts: sanitizeSorts(domainParams.sorts),
    featuredFirst: true  // ← ALWAYS forced; client cannot opt out on public listing
});
```

Update the file's header JSDoc (lines 5-17) to mention `sorts` and the forced `featuredFirst`.

### HTTP → Domain conversion

Update `httpToDomainAccommodationSearch` in `accommodation.http.schema.ts` to map the two new
fields. The existing compile-time checks will fail at build time if this mapping is omitted — use
them as a guard.

```typescript
export const httpToDomainAccommodationSearch = (
    httpParams: AccommodationSearchHttp
): AccommodationSearch => ({
    // ... existing fields unchanged ...
    sorts: httpParams.sorts,        // ← new
    featuredFirst: httpParams.featuredFirst  // ← new
});
```

### Service layer update (`accommodation.service.ts`)

`AccommodationService._executeSearch()` (lines 606-619) already forwards all params via spread,
so that path is fine without changes.

**However**, `AccommodationService.searchWithRelations()` (lines 655-735) cherry-picks fields
into a manual `modelParams` object (lines 687-703). Even though no route currently calls this
method, it is a public API and will drop the new fields silently if anyone uses it.

The current object already forwards `sortBy`, `sortOrder`, `page`, `pageSize`, `q`, `type`,
`types`, `minPrice`, `maxPrice`, `destinationId`, `destinationIds`, `amenities`, `isFeatured`,
`isAvailable`, and `excludeRestricted`. It is **missing** three fields: `sorts`, `featuredFirst`,
and the pre-existing-orphan `features`. Add exactly those three:

```typescript
const modelParams = {
    page,
    pageSize,
    sortBy: processedParams.sortBy,
    sortOrder: processedParams.sortOrder,
    sorts: processedParams.sorts,                    // ← new
    featuredFirst: processedParams.featuredFirst,    // ← new
    features: processedParams.features,              // ← orphan fix (pass #2 scope expansion)
    q: processedParams.q,
    type: processedParams.type,
    types: processedParams.types,
    minPrice: processedParams.minPrice,
    maxPrice: processedParams.maxPrice,
    destinationId: processedParams.destinationId,
    destinationIds: processedParams.destinationIds,
    amenities: processedParams.amenities,
    isFeatured: processedParams.isFeatured,
    isAvailable: processedParams.isAvailable,
    excludeRestricted: !hasVipAccess
};
```

## End-to-End Flow

```
GET /api/v1/public/accommodations?sorts=averageRating:desc,name:asc

HTTP parse    → sorts: [{ field: 'averageRating', order: 'desc' }, { field: 'name', order: 'asc' }]
              → featuredFirst: undefined (not sent by client)

httpToDomain  → AccommodationSearch { sorts: [...], featuredFirst: undefined }

Public route  → sanitizeSorts() filters any non-whitelisted fields
              → injects featuredFirst: true

Service       → `search` path: spreads params to `_executeSearch` unchanged

Model         → ORDER BY is_featured DESC, average_rating DESC, name ASC, id DESC
                                                                            ^^^^^^^^
                                                                            stable tiebreaker
```

## Out of Scope

- Applying `featuredFirst` to any entity other than accommodations.
- Adding `sorts`/`featuredFirst` to admin search schemas (admin already has raw SQL access and
  can express arbitrary sorts; this can be added later per need).
- Frontend UI for multi-sort (the web listing page will not expose `sorts` to the user; it always
  uses `featuredFirst: true` implicitly via the API).
- Changing the behaviour of admin routes — they continue using `sortBy`/`sortOrder` as-is.
- Migrating / structurally changing `HttpAccommodationSearchSchema` (query.schema.ts:142)
  or `AccommodationSearchSchemaWithMetadata` (line 203). This spec only adds `@deprecated`
  JSDoc on both; structural deletion is a follow-up task after SPEC-077 is reconciled.
- Migrating `createBooleanQueryParam` call sites to `z.stringbool()` (Zod v4's canonical
  replacement). Out of scope due to 27+ call sites; tracked as a future refactor.
- Generalizing `NULLS LAST` handling to every search model across the repo. This spec only
  applies it to accommodation. If the pattern proves valuable, extract `buildSortExpr` to a
  shared helper in `@repo/db` in a follow-up.
- Full Zod v4 error-shape migration across the codebase (`ZodIssueCode` enum removal, etc.)
  — tracked separately in SPEC-036.

## Acceptance Criteria

### Schema layer

- [ ] `SortFieldSchema` and `SortField` type are exported from
      `packages/schemas/src/common/pagination.schema.ts`. The Zod object requires
      `field` (non-empty string) and `order` (enum `'asc' | 'desc'`).
- [ ] `BaseSearchSchema` includes `sorts?: SortField[]` with `.max(5)` and
      `featuredFirst?: boolean`.
- [ ] `HttpSortingSchema` and `BaseHttpSearchSchema` include the HTTP-coerced equivalents of both
      fields. `sorts` is transformed from the comma-separated string format and hard-capped at 5.
      `featuredFirst` uses `createBooleanQueryParam()`, NOT `z.coerce.boolean()`.
- [ ] The `sorts` HTTP query param has an OpenAPI example attached via
      `.openapi({ example: 'averageRating:desc,name:asc' })` (the project's convention —
      do NOT use Zod v4's native `.meta()` here; see the note in "HTTP schema changes").
      Verify it renders in the Swagger UI.
- [ ] The domain `sorts.max(5)` error message uses the i18n key
      `'zodError.common.sort.maxFields'` (not a hardcoded English string). Keys exist in
      `packages/i18n/src/locales/{es,en,pt}/validation.json` under `common.sort.maxFields`.
- [ ] `AccommodationSearchHttpSchema` inherits `sorts` and `featuredFirst` from
      `BaseHttpSearchSchema` without additional changes.
- [ ] `httpToDomainAccommodationSearch` maps both new fields; the existing compile-time assertions
      pass (`pnpm typecheck` in `packages/schemas` is green).
- [ ] `AccommodationSearchHttpSchema` gains a `features` field (comma-separated UUID list,
      using the same pattern as `amenities`), and `httpToDomainAccommodationSearch` maps it.
      Resolves a pre-existing orphan (see "Current State" → "Pre-existing bug folded into
      this spec").
- [ ] All new HTTP fields (`sorts`, `featuredFirst`, `features`) have `.describe(...)`
      metadata for OpenAPI.
- [ ] `HttpAccommodationSearchSchema` (query.schema.ts:142) and
      `AccommodationSearchSchemaWithMetadata` (query.schema.ts:203) both have an
      `@deprecated` JSDoc directive pointing at `AccommodationSearchHttpSchema`. No
      structural change to either.

### Model layer

- [ ] `AccommodationModel.search()` and `AccommodationModel.searchWithRelations()` both implement
      the precedence rule: `featuredFirst` → `sorts[]` (dedup of `isFeatured` when
      `featuredFirst` is true) → fallback `sortBy`/`sortOrder` (also subject to `isFeatured` dedup
      when `featuredFirst` is true).
- [ ] Both methods append a stable `desc(accommodations.id)` tiebreaker to `orderBy`
      unconditionally.
- [ ] When `sorts` is an empty array or undefined, behavior degrades to legacy single-sort with
      the tiebreaker appended (no regression for pre-existing callers that only used `sortBy`).
- [ ] Invalid column names in `sorts[]` are silently ignored (same behavior as the current
      `sortBy` with an unknown field).
- [ ] `countByFilters()` is left unchanged (counts are order-independent).
- [ ] `AccommodationModel.search()` invokes the select builder with **spread**:
      `.orderBy(...orderBy)` — NOT `.orderBy(orderBy)`. Passing a bare array to the variadic
      select-builder method compiles but emits broken SQL at runtime.
- [ ] `AccommodationModel.searchWithRelations()` invokes the RQB with a **bare array** as the
      `orderBy` property of the `findMany({ ... })` object — `orderBy,` (or `orderBy: orderBy`).
      Do NOT use spread here; `...orderBy` inside an object literal is a SyntaxError. The two
      APIs are NOT interchangeable — see "CRITICAL — Drizzle `orderBy` invocation" for the
      full explanation.
- [ ] Nullable numeric fields (`averageRating`, `reviewsCount`, `minPrice`, `maxPrice`) are
      sorted with `NULLS LAST` regardless of direction, via raw `sql`` template. A test with
      a seeded null-rating row asserts that `?sorts=averageRating:desc` places the null row
      LAST (not first, which is the Postgres default for `DESC`).
- [ ] `NUMERIC_NULLABLE_FIELDS` and `buildSortExpr()` are declared once at module scope and
      reused in both `search()` and `searchWithRelations()` (no code duplication).
- [ ] Legacy-path dedup is covered by a test: `{ featuredFirst: true, sortBy: 'isFeatured' }`
      produces `ORDER BY is_featured DESC, id DESC` — NOT `ORDER BY is_featured DESC,
      is_featured ASC, id DESC`.

### Service layer

- [ ] `AccommodationService._executeSearch()` continues to pass-through via spread (no change
      needed).
- [ ] `AccommodationService.searchWithRelations()` (service.ts:655) is updated to include
      `sorts`, `featuredFirst`, **and** `features` in its `modelParams` object. (The
      `features` addition closes the pre-existing orphan; confirmed as a valid filter in
      `AccommodationModel.searchWithRelations()` at accommodation.model.ts:348.)

### API layer

- [ ] `sanitizeSorts()` is added to the public list route and correctly filters `sorts` entries
      whose `field` is not in `ALLOWED_SORT_FIELDS`. Returns `undefined` when the resulting array
      is empty.
- [ ] The public list route always injects `featuredFirst: true`, regardless of query params sent
      by the client. The client CANNOT opt out.
- [ ] `ALLOWED_SORT_FIELDS` remains unchanged: `name`, `createdAt`, `averageRating`,
      `reviewsCount`, `isFeatured`.
- [ ] The pre-existing `sanitizeSortBy()` helper (`apps/api/src/routes/accommodation/public/list.ts:46`)
      is preserved verbatim. It continues to guard the legacy `sortBy`/`sortOrder` fallback
      path. `sanitizeSorts()` (new) guards `sorts[]`; neither helper replaces the other —
      both coexist and share `ALLOWED_SORT_FIELDS` as the single source of truth for the
      public allow-list.
- [ ] The file header JSDoc (lines 1-17) is updated to document `sorts` and the forced
      `featuredFirst`.

### Backward compatibility

- [ ] Existing calls using only `sortBy` + `sortOrder` (no `sorts`) produce the same results as
      before this change, **except** that the ORDER BY now has a trailing `id DESC` tiebreaker.
      This is considered a non-breaking improvement (deterministic pagination).
- [ ] Existing calls with no sort params at all produce `ORDER BY id DESC` (instead of empty
      orderBy). Featured items appear first on the public route (intended behavioral change).

### Quality

- [ ] `pnpm typecheck` passes with zero new errors across all packages.
- [ ] `pnpm lint` passes with zero new Biome violations.
- [ ] Unit tests are added for `sanitizeSorts()` covering: whitelist pass/fail, empty input,
      mixed valid+invalid, and post-filter empty collapse to `undefined`.
- [ ] Unit tests are added for the model's `orderBy` construction logic covering:
      - `featuredFirst: true` only
      - `sorts[]` only
      - `featuredFirst: true` + `sorts[]` including an explicit `isFeatured` entry (verify dedup)
      - legacy `sortBy`/`sortOrder` fallback
      - empty / undefined inputs (verify `id DESC` tiebreaker is present)
      - `sorts[]` with exactly 5 entries (boundary check)
- [ ] Unit tests are added for the `sorts` HTTP transform covering every row of the
      "Edge-case table for `sorts` parsing" above.
- [ ] At least one **integration test** (`apps/api/test/integration/accommodation/list.test.ts`
      or a new sibling file) exercises `GET /api/v1/public/accommodations?sorts=...` end-to-end,
      asserting that (a) featured items come first, (b) the secondary sort order is applied, and
      (c) pagination across two pages does not repeat rows (proves the tiebreaker works).
- [ ] Integration test asserts the **client-opt-out rule**: a request
      `GET /api/v1/public/accommodations?featuredFirst=false` MUST still return featured
      items first (the public route forces `featuredFirst: true` regardless of the query
      value — there is no legitimate way to disable it from the client).
- [ ] Existing accommodation search tests continue to pass.

## Affected Files

| File | Change |
|------|--------|
| `packages/schemas/src/common/pagination.schema.ts` | Add `SortFieldSchema`, extend `BaseSearchSchema` with `sorts` (max 5) and `featuredFirst` |
| `packages/schemas/src/api/http/base-http.schema.ts` | Extend `HttpSortingSchema` with `sorts` (HTTP coercion + `.slice(0,5)`) and `featuredFirst` (`createBooleanQueryParam`). Both with `.describe()` |
| `packages/schemas/src/entities/accommodation/accommodation.http.schema.ts` | (a) Add a `features` field to `AccommodationSearchHttpSchema` using `createArrayQueryParam('Filter by required feature IDs')` (same pattern as `amenities`); (b) update `httpToDomainAccommodationSearch` (lines 152-189) to map `sorts`, `featuredFirst`, AND the previously-orphan `features`; compile-time checks (lines 314-399) must remain green |
| `packages/schemas/src/entities/accommodation/accommodation.query.schema.ts` | **JSDoc-only change**: add `@deprecated` directives on `HttpAccommodationSearchSchema` (line 142) and `AccommodationSearchSchemaWithMetadata` (line 203) pointing at `AccommodationSearchHttpSchema`. NO structural change; both are effectively dead (zero external consumers verified on pass #2) |
| `packages/db/src/models/accommodation/accommodation.model.ts` | Add `NUMERIC_NULLABLE_FIELDS` set + `buildSortExpr()` helper. Rewrite `orderBy` construction in both `search()` (line 227) and `searchWithRelations()` (line 374): featuredFirst → dedup-filtered sorts (with legacy-path dedup) → `id DESC` tiebreaker → spread via `orderBy(...orderBy)` in the query call |
| `packages/service-core/src/services/accommodation/accommodation.service.ts` | Extend manual `modelParams` in `searchWithRelations()` (lines 687-703) to add `sorts`, `featuredFirst`, and the pre-existing-orphan `features`. Do NOT re-add `sortBy`/`sortOrder` — they are already present (lines 691-692) |
| `packages/i18n/src/locales/{es,en,pt}/validation.json` | Add `common.sort.maxFields` key in each locale with the translated message (see i18n section under "HTTP schema changes") |
| `apps/api/src/routes/accommodation/public/list.ts` | Add `sanitizeSorts()`, inject `featuredFirst: true` (forced; client cannot opt out), update file-header JSDoc (lines 1-17) to document `sorts`, `featuredFirst`, and `features` |

> **Note**: `AccommodationSearchSchema` (`accommodation.query.schema.ts:89`) extends
> `BaseSearchSchema` and inherits the new fields automatically; no structural change needed
> in that file. The `@deprecated` JSDoc additions on the dead alt schema are purely
> documentary — no runtime behavior changes.

## Dependencies

- No blocking dependencies on other open specs.
- **SPEC-068** (Type-Safe `list()` Options) may touch `BaseSearchSchema` if it adds `sorts` to
  `ListOptions`. Coordinate to avoid conflicts if both are in-progress simultaneously.

---

## Pass #1 Changes Summary (2026-04-19)

### Added

- **Revision History** section at the top of the spec.
- **Stable tiebreaker** requirement (`id DESC` always appended). Avoids non-deterministic
  pagination across pages when sort values tie.
- **`sorts` max length** of 5 entries, enforced both in the Zod domain schema (`.max(5)`) and in
  the HTTP transform (`.slice(0, 5)`), to cap ORDER BY complexity.
- **Dedup rule**: when `featuredFirst === true`, any `sorts[]` entry with `field === 'isFeatured'`
  is removed before iteration to avoid a duplicated `ORDER BY is_featured` clause.
- **Edge-case parsing table** for `sorts` documenting malformed / partial inputs and their
  deterministic outcomes.
- **Service layer update** for `AccommodationService.searchWithRelations()` (lines 655-735) — the
  manual `modelParams` cherry-pick would silently drop new fields. Now required to forward
  `sorts` and `featuredFirst`.
- **Integration test** acceptance criterion: an end-to-end assertion on the public route with
  pagination verifying featured-first behavior + tiebreaker stability.
- **Edge-case unit tests** for the HTTP transform and for the 5-entry boundary.
- Notes documenting (a) the pre-existing `features` orphan in `httpToDomainAccommodationSearch`,
  (b) the deprecation-candidate `HttpAccommodationSearchSchema` duplicate in `query.schema.ts`,
  and (c) that `countByFilters()` intentionally needs no changes.
- `.describe(...)` on both new HTTP fields (OpenAPI).

### Modified

- **`featuredFirst` HTTP coercion** switched from `z.coerce.boolean()` (accepts non-empty strings
  including `'false'`) to `createBooleanQueryParam(...)` (accepts only the literal strings
  `'true'` / `'false'`). Fixes a real coercion bug and aligns with existing codebase pattern.
- **Public route `featuredFirst` policy** confirmed: server forces `true` always, client
  cannot opt out. Moved from implicit to explicit in acceptance criteria.
- **`SortFieldSchema.field`** tightened from `z.string()` to `z.string().min(1)` (reject empty).
- **Backward-compat section** rewritten: the added `id DESC` tiebreaker technically changes the
  ORDER BY of every pre-existing call, but is a non-breaking improvement (stricter determinism).
  Documented explicitly so reviewers don't flag it.
- **"Current State"** section expanded with a dedicated subsection explaining the two service
  methods (`_executeSearch` vs `searchWithRelations`) and why only one needs spread-vs-cherrypick
  awareness.
- **Affected Files** table updated: added `accommodation.service.ts` row, expanded the model row
  to mention both `search()` and `searchWithRelations()`, expanded the route row to include
  JSDoc update.

### Removed

- None. Nothing in the original spec was factually wrong enough to remove — all existing content
  remained correct after verification; additions and tightening sufficed.

---

## Pass #2 Changes Summary (2026-04-20)

Pass #2 is a ground-truth re-verification of every claim in the spec against the live repo
and against official Zod / Drizzle documentation. Focus was on catching any stale line
reference, incorrect characterization, or technically-misleading justification that could
confuse the implementing dev.

### Added

- **Pass #2 row** in the Revision History table.
- **`createArrayQueryParam` cross-reference** so implementers know the canonical CSV helper
  exists but is intentionally NOT reused for `sorts` (which needs a richer `field:order`
  transform).
- **Zod v4 `z.stringbool()` future-refactor note** — canonical v4 replacement for
  `createBooleanQueryParam`, intentionally out of scope here (27+ existing call sites).
- **Zod v4 error-shape caveat** for test authors (v4 uses `origin: 'array'` instead of
  `type: 'array'`; `ZodIssueCode.too_big` no longer exported). Prevents stale v3-style
  error assertions in the tests this spec requires.
- **`features` orphan fix** folded into scope (per user decision on pass #2). Adds the
  missing HTTP field, maps it in `httpToDomainAccommodationSearch`, forwards it in the
  service's manual `modelParams` cherry-pick. Model already accepts `features` as a valid
  filter (verified at accommodation.model.ts:201 and :348).
- **Integration-test criterion** for the forced `featuredFirst` rule: a request with
  `?featuredFirst=false` must still return featured-first. Proves the client cannot opt out.
- **JSDoc @deprecated plan** on `HttpAccommodationSearchSchema` and
  `AccommodationSearchSchemaWithMetadata` — verified both are zero-consumer dead exports
  outside their own file.

### Modified

- **`accommodation.model.ts` line reference** fixed: `:215` → `:227` for the `search()`
  `orderBy` block. (`:374` for `searchWithRelations()` was already correct.)
- **Compile-time checks line range** fixed: `306-399` → `314-368` (verified by reading the
  file directly).
- **`HttpAccommodationSearchSchema` characterization** refined: not a strict "duplicate" but
  an older alt schema with a different field set (e.g., no `features`) that has drifted.
  Verified as effectively dead code (only consumer is another dead export in the same file).
- **"DoS via huge ORDER BY" justification** reformulated. There is no CWE/OWASP vector with
  that name; the cap of 5 is a pragmatic product limit tied to PG index-usage degradation
  and `work_mem` spill risk. Gives the implementer the correct mental model for why the cap
  exists (and why it is safe to loosen later if a product need appears).
- **Zod `z.coerce.boolean()` claim** confirmed explicitly ("verified against the official
  Zod docs for v3/v4 coercion behavior"). Removes any doubt for a dev who double-checks.
- **Out-of-Scope section** rewritten: removed the "fix `features` orphan" line (now in
  scope) and sharpened the `HttpAccommodationSearchSchema` line (JSDoc-only change, not
  structural).
- **Affected Files table** updated:
  - `accommodation.http.schema.ts` row now includes the `features` field addition.
  - `accommodation.service.ts` row now includes forwarding `features`.
  - New row for `accommodation.query.schema.ts` (JSDoc-only).
  - `accommodation.model.ts` row now references the corrected line numbers.
  - `public/list.ts` row now references JSDoc lines `1-17` (the full header) and mentions
    documenting `features` in addition to `sorts` / `featuredFirst`.

### Removed

- None. All original content remained factually defensible after re-verification; the
  pass #2 changes are exclusively corrections of wording, additions to scope, and
  fold-ins of a pre-existing orphan.

---

## Pass #3 Changes Summary (2026-04-20)

Pass #3 is a second ground-truth re-verification, focused on closing gaps that would leave
room for interpretation by the implementing developer. Four product/style decisions were
confirmed with the user and folded into the spec.

### Added

- **Pass #3 row** in the Revision History table.
- **CRITICAL "Drizzle `orderBy` invocation" section** warning against passing a bare array
  to `.orderBy()`. Drizzle's signature requires variadic args (`orderBy(...orderBy)`) or a
  callback. Passing a bare array compiles but emits broken SQL. This is the single biggest
  trap for a dev following the spec literally.
- **`NULLS LAST` for nullable numeric fields** (`averageRating`, `reviewsCount`, `minPrice`,
  `maxPrice`). Introduces a `NUMERIC_NULLABLE_FIELDS` set and a `buildSortExpr()` helper
  that uses raw `sql`` template to force `NULLS LAST` regardless of direction. Fixes a UX
  surprise where Postgres' default (`DESC` → `NULLS FIRST`) places rows-without-rating at
  the top of `?sorts=averageRating:desc`. Decision D1 with user, 2026-04-20.
- **i18n integration** for the `.max(5)` error message. Replaced the hardcoded English
  string with the key `'zodError.common.sort.maxFields'`, following the project convention
  used in 90%+ of existing schemas. Includes a block with the JSON to add to each locale
  file (`es`/`en`/`pt`). Decision D2 with user, 2026-04-20.
- **Legacy-path dedup** rule. When `featuredFirst === true` AND `sortBy === 'isFeatured'`,
  the legacy fallback is dropped — otherwise the ORDER BY would duplicate `is_featured`.
  Decision D3 with user, 2026-04-20.
- **OpenAPI `example` metadata** on the `sorts` query param. Decision D4 with user,
  2026-04-20. (Pass #4 correction: flipped recommendation to `.openapi({ example: ... })`
  after verifying codebase convention — see Pass #4 summary.)
- **Documentation of `sorts[]` duplicate-field edge case** (e.g., `name:asc,name:desc`):
  accepted as-is; Postgres honors the declared order but the second appearance has no
  discriminating effect. Spec does NOT deduplicate within `sorts[]`.
- **`input` field** in the Zod v4 error-shape example (every v4 issue carries it).
- **Official Zod docs link** for `z.coerce.boolean()` behavior
  (https://zod.dev/api#coerce).
- **`@hono/zod-openapi` caveat** note near the OpenAPI example.
- **Acceptance criteria** for the 4 new behaviors (spread invocation, NULLS LAST, legacy
  dedup, i18n key, OpenAPI example).
- **Affected Files** row for `packages/i18n/src/locales/{es,en,pt}/validation.json`.

### Modified

- **Compile-time checks range** fixed: `314-368` → `314-399` (line drift since pass #2).
  Verified by reading the file directly.
- **`modelParams` range** fixed: `689-705` → `687-703`. Verified by reading the file directly.
- **`httpToDomainAccommodationSearch` line range**: added `152-189` where previously absent.
- **Service-layer update** reformulated: the current `modelParams` already includes
  `sortBy`/`sortOrder` (lines 691-692). The spec previously implied these needed to be
  added — now explicitly states they are already there and only the three new/orphan fields
  (`sorts`, `featuredFirst`, `features`) must be appended.
- **Precedence / dedup documentation** extended to cover both the multi-sort path and the
  legacy single-sort path.
- **Zod v4 error-shape section** expanded to cover:
  (1) the `input` field always present in v4 issues;
  (2) the `ZodIssueCode` enum no longer being exported — compare against the literal
  string `'too_big'`;
  (3) the `message` in the issue is now the i18n key, not the translated text.
- **Affected Files table** updated: model row now mentions `NUMERIC_NULLABLE_FIELDS`,
  `buildSortExpr()`, and the spread invocation; schema row references `createArrayQueryParam`
  helper for the `features` field; service row clarifies sortBy/sortOrder are already present.
- **Out of Scope** extended with three explicit non-goals (z.stringbool migration,
  NULLS LAST generalization across repo, full Zod v4 error migration — tracked by SPEC-036).

### Removed

- The hardcoded English `.max(5)` error string in favor of the i18n key. Minor, but noted
  here for completeness.

### Total review passes: 3

---

## Pass #4 Changes Summary (2026-04-20)

Pass #4 is another ground-truth re-verification against the live repo and official
documentation (Zod `^4.0.8`, Drizzle `^0.44.7`, `@hono/zod-openapi ^1.2.2`). No scope
changes, no new product decisions — purely factual corrections and a clarifying
acceptance criterion. All 4 findings are low-risk edits that tighten the spec without
touching the proposed behavior.

### Added

- **Pass #4 row** in the Revision History table.
- **Explicit acceptance criterion** requiring the pre-existing `sanitizeSortBy()` helper
  (`apps/api/src/routes/accommodation/public/list.ts:46`) to remain in place. Previously
  only implicit in the code example. Both `sanitizeSortBy()` (legacy path guard) and
  `sanitizeSorts()` (multi-sort guard) must coexist and share `ALLOWED_SORT_FIELDS`.
- **Codebase-convention note** in the HTTP schema section explaining WHY we use
  `.openapi({...})` and NOT `.meta({...})` for the OpenAPI example on `sorts`
  (ten `.openapi()` call sites exist in `apps/api/src/schemas/base-schemas.ts`;
  zero `.meta()` uses exist across `packages/schemas/src`).

### Modified

- **OpenAPI recommendation flipped**: `.meta({ example: ... })` is NO LONGER the primary
  recommendation. `.openapi({ example: 'averageRating:desc,name:asc' })` is now the
  single canonical form, matching the project's existing convention. The previous
  "fallback" note has been replaced with a directive explaining why `.meta()` is
  intentionally avoided here (consistency with the existing `@hono/zod-openapi ^1.2.2`
  integration).
- **`_executeSearch` line range**: `608-621` → `606-619`. Verified by reading
  `accommodation.service.ts` directly — the function now starts on line 606 and closes
  on line 619. Applied to both mentions ("Service-layer param flow" and "Service layer
  update").
- **Drizzle source-file citation softened**: the previous `select.ts:883-917` line
  pointer was too specific — internal Drizzle source-file line numbers drift between
  patch releases even when the public API is stable. Now cited as a version-independent
  reference with a concrete `drizzle-orm ≥ 0.30` compatibility floor and an explicit
  reminder that this repo is on `^0.44.7`. The behavioral warning itself (spread the
  array, do not pass a bare array) is unchanged — this correction is purely about the
  brittleness of the line citation.

### Removed

- Nothing structural. The `.meta()` fallback wording was replaced in place, not deleted
  — the intent of documenting the Zod v4 alternative is preserved but reframed as
  "do not use" rather than "use if supported".

### Total review passes: 4

---

## Pass #5 Changes Summary (2026-04-20)

Pass #5 is another ground-truth re-verification against the live repo and against official
documentation (Zod `^4.0.8` via zod.dev/error-customization, Drizzle `^0.44.7`,
`@hono/zod-openapi ^1.2.2`). All line references from pass #4 were re-verified and remain
accurate — no drift. The 6 findings below are factual tightenings; no product decisions
required.

### Added

- **Pass #5 row** in the Revision History table.
- **Transformer-pipeline note** in the i18n section. Documents the 3-layer flow
  `raw ZodError → transformZodError → defaultHook` and points at
  `apps/api/src/utils/zod-error-transformer.ts` (line 243). Gives test authors a clear
  three-layer breakdown for debugging locale keys that "don't surface".
- **`{ message }` vs `{ error }` Zod v4 compat note**. Acknowledges that `{ error }` is the
  v4-canonical form but documents that the codebase uses `{ message }` consistently
  (20+ call sites, all green on Zod 4.0.8). Keeps the spec in lockstep with codebase
  convention; flags `{ error }` migration as future refactor scope alongside
  `z.stringbool()`.
- **Split summary table** in the new "CRITICAL — Drizzle `orderBy` invocation" section
  listing which API each method uses and which `orderBy` form applies (spread vs bare
  array property).

### Modified

- **"CRITICAL — Drizzle `orderBy(...)` invocation" section rewritten** to distinguish the
  two Drizzle APIs in use:
  - Case A (select builder, used by `search()`): requires spread
    `.orderBy(...orderBy)`.
  - Case B (RQB `findMany` object, used by `searchWithRelations()`): requires a bare
    array as an object property `orderBy,` — spread inside an object literal is a
    SyntaxError.
  Previous wording implied spread applies to both methods, which is factually wrong for
  the RQB path. A dev following the old wording literally would either not compile or
  deviate silently.
- **Matching acceptance criterion split into two**, one per API.
- **`z.ZodIssueCode` claim softened**. Previous wording asserted the enum was "no longer
  exported as an enum object in v4". Verified against `apps/api/src/utils/env.ts:331`:
  `z.ZodIssueCode.custom` is used there and resolves at runtime on Zod 4.0.8 (compat
  shim). Reworded to: the enum is still present as a compat shim but is NOT v4-idiomatic
  — new code should compare against the literal string.
- **`input`-field claim corrected**. Previous wording claimed "every v4 issue now carries
  an `input` field". Per zod.dev/error-customization, `input` is only present when the
  consumer opts in via `{ reportInput: true }` or the global config. The Hospeda API does
  not enable `reportInput`; tests should not assume `input` presence.
- **Path references corrected**: `apps/api/src/create-app.ts` → `apps/api/src/utils/create-app.ts`
  (actual location; previous references would send the implementer to a nonexistent path).

### Removed

- Nothing. The `{ message }` vs `{ error }` discussion was ADDED, not replaced — both
  forms coexist via the v4 compat shim.

### Total review passes: 5
