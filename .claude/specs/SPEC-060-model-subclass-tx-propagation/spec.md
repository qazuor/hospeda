# SPEC-060: Model Subclass Transaction Propagation

> **Status**: completed
> **Priority**: P1
> **Complexity**: High
> **Origin**: SPEC-053 gaps (GAP-023, GAP-024, GAP-032, GAP-067, GAP-068)
> **Created**: 2026-04-01
> **Updated**: 2026-04-02 (audit pass 8: FIXED incorrect Drizzle rollback behavior -- `db.transaction()` re-throws `TransactionRollbackError`, does NOT resolve to `undefined`; FIXED misleading "Recursive Methods" Pattern 5 -- `findDescendants`/`findAncestors` are iterative, not recursive; COMPLETED cross-spec overlap table -- added 9 missing specs (053, 054, 056, 057, 059, 061, 062, 065) for full 050-065 coverage; ADDED SPEC-058 class rename note -- `BaseModel` becomes `BaseModelImpl`; verified all 51 getDb() call sites, 7 delegates, 16 LSP violations against codebase; verified Drizzle ORM type hierarchy against v0.44.7 source; verified all sibling specs for overlaps/contradictions); 2026-04-02 (audit pass 7: added Pre-Implementation Checklist; added tx.rollback() and PgDatabase sibling-type notes to Drizzle Behavior section; added side-by-side count()/findAll() parameter contrast warning; clarified 20-file scope counting; added conditional EventOrganizerModel note for SPEC-058 deletion scenario; added isolation levels to Out of Scope; simplified grep verification command for narrowed relations type); 2026-04-02 (audit pass 6: CRITICAL FIX -- replaced ctx?: QueryContext with tx?: DrizzleClient throughout to match SPEC-058 actual output; SPEC-058 keeps positional tx on BaseModel, QueryContext is for service layer only; fixed all code examples, delegate patterns, acceptance criteria, and grep commands; removed incorrect SPEC-064 dependency; fixed grep regex for multiline relations type check); 2026-04-02 (audit pass 5: CRITICAL FIX -- findAll delegate pattern used wrong positional arg (ctx in options slot); added findAll positional parameter gotcha warning; fixed import template to use import type per project conventions; added Step 6 for QueryContext import addition; added Drizzle type precision note; updated delegate methods table with correct findAll threading; audit pass 4: fixed grep verification bug for narrowed relations type; added Coordination with Parallel Specs section; added getDb() call site reference with line numbers; added findAllWithRelations to out-of-scope; verified all counts, Drizzle claims, and cross-spec overlaps against codebase; audit pass 3: fixed updateStats misclassification as getDb() caller -- it is a pure delegate; removed updateDescendantPaths from DestinationModel getDb() list -- already uses getClient(tx); fixed EventOrganizerModel export description; added SPEC-055 merge conflict risk; added Step 5 for import cleanup; updated delegate counts; audit pass 2: added 6 missing delegate methods, fixed "15 base methods" → "13", added isDescendant, added findWithRelations fallback note, updated counts; audit pass 1: count corrections, missing sections, Drizzle verification; corrected SPEC-059 dependency scope -- only Phase 4 depends on this spec, not all phases)
> **Depends on**: SPEC-058 (BLOCKING .. QueryContext and DrizzleClient types must exist before work begins), SPEC-055 (BLOCKING .. both specs modify the same method signatures in `destination.model.ts` and `user.model.ts`; applying SPEC-060 first would cause significant merge conflicts when SPEC-055 later refactors the `$ilike` patterns in these same methods)
> **Enables**: SPEC-059 Phase 4 (cross-entity transaction wrapping), SPEC-061 (integration tests)

## Problem Statement

51 custom model methods across 18 entity model subclasses call `getDb()` directly, bypassing any transaction context. When these methods are called within a transaction, they silently escape to the main connection pool, violating ACID guarantees.

Additionally, 14 `findWithRelations` overrides drop the `tx` parameter entirely, and narrow the `relations` type from `Record<string, boolean | Record<string, unknown>>` to `Record<string, boolean>`, breaking Liskov Substitution Principle (LSP). Two more overrides (RRolePermissionModel, RUserPermissionModel) correctly accept `tx` but ALSO have the narrowed `relations` type .. totaling 16 overrides with the LSP violation.

## Prerequisites (BLOCKING)

SPEC-058 must be completed first. It provides:

1. **`DrizzleClient` type** in `packages/db/src/types.ts`:
   ```typescript
   export type DrizzleClient = PgDatabase<
     NodePgQueryResultHKT,
     typeof schema,
     ExtractTablesWithRelations<typeof schema>
   >;
   ```
   Accepts both `NodePgDatabase` and `NodePgTransaction` at runtime.

2. **`QueryContext` interface** in `packages/db/src/types.ts`:
   ```typescript
   export interface QueryContext {
     tx?: DrizzleClient;
   }
   ```

3. **Updated `BaseModel` signatures**: All 13 implementation methods will be updated from `tx?: NodePgDatabase<typeof schema>` to `tx?: DrizzleClient` with `this.getClient(tx)` (per SPEC-058 GAP-003: 9 methods lack tx + 4 methods already have tx = 13 total). Note: SPEC-058 keeps positional `tx` parameters on BaseModel methods. The `QueryContext` interface is exported for SPEC-059 service-layer use, not for model-layer methods.

4. **Class rename**: SPEC-058 renames the concrete class from `BaseModel` to `BaseModelImpl` and exports a `BaseModel<T>` interface. All subclasses extend `BaseModelImpl` (the concrete class). This does NOT affect SPEC-060's work (subclasses already use `extends BaseModel` which maps to the concrete class), but the implementer should be aware when reading the base class code.

5. **`getClient()` semantics (added 2026-04-04, cross-spec conflict resolution MEDIUM-001)**: The `getClient(tx?: DrizzleClient)` method (inherited from BaseModelImpl) handles the `tx` parameter as follows:
   - `getClient()` or `getClient(undefined)` → returns `getDb()` (the global database connection)
   - `getClient(tx)` where `tx` is defined → returns `tx` directly
   - Implementation: `return tx ?? getDb()`
   - **This is safe to call with `undefined`**. Model subclass developers can always call `this.getClient(tx)` without checking if `tx` is defined first. The fallback to `getDb()` is automatic.
   - When migrating `getDb()` calls to `this.getClient(tx)` in SPEC-060, this is always a safe 1:1 replacement: if the caller has no `tx`, `getClient(undefined)` behaves identically to `getDb()`.

**Do NOT start SPEC-060 until both SPEC-058 and SPEC-055 are merged. SPEC-058 provides the types/signatures, and SPEC-055 must land first because both specs modify the same method signatures in `destination.model.ts` and `user.model.ts` .. applying SPEC-060 first would cause significant merge conflicts when SPEC-055 later refactors the `$ilike` patterns in these same methods.**

### Pre-Implementation Checklist

Before writing any code for SPEC-060, verify ALL of the following:

- [ ] SPEC-058 PR is merged and landed on `main` branch
- [ ] SPEC-055 PR is merged and landed on `main` branch
- [ ] `packages/db/src/types.ts` exports `DrizzleClient` type
- [ ] `@repo/db` package `index.ts` re-exports `DrizzleClient`
- [ ] `BaseModel` methods use `tx?: DrizzleClient` (not `NodePgDatabase<typeof schema>`)
- [ ] `pnpm typecheck` passes with zero errors on clean `main`

If any of these fail, STOP and resolve SPEC-058 and SPEC-055 first.

## Affected Models (20 files in scope: 18 with `getDb()` issues + 2 reference implementations with LSP-only violations)

| Model | File (relative to `packages/db/src/models/`) | Custom methods with bare `getDb()` | findWithRelations override (drops tx) |
|-------|------|-------------------------------------|---------------------------------------|
| AccommodationModel | `accommodation/accommodation.model.ts` | countByFilters, search, searchWithRelations, findTopRated, **updateStats**† | Yes |
| AmenityModel | `accommodation/amenity.model.ts` | (none) | Yes |
| RAccommodationAmenityModel | `accommodation/rAccommodationAmenity.model.ts` | countAccommodationsByAmenityIds | Yes |
| RAccommodationFeatureModel | `accommodation/rAccommodationFeature.model.ts` | countAccommodationsByFeatureIds | Yes |
| DestinationModel | `destination/destination.model.ts` | findAllByAttractionId, searchWithAttractions, getAttractionsMap, search, findChildren, findDescendants, findAncestors, findByPath, countByFilters, **isDescendant**† | Yes |
| RDestinationAttractionModel | `destination/rDestinationAttraction.model.ts` | (none) | Yes |
| EventModel | `event/event.model.ts` | (none) | Yes |
| EventOrganizerModel | `eventOrganizer.model.ts` | (none) | Yes |
| ExchangeRateModel | `exchange-rate/exchange-rate.model.ts` | findLatestRate, findLatestRates, findRateHistory, findManualOverrides, findAllWithDateRange | No |
| OwnerPromotionModel | `owner-promotion/ownerPromotion.model.ts` | findBySlug, findActiveByAccommodationId, findActiveByOwnerId, **findByOwnerId**† | Yes |
| PostModel | `post/post.model.ts` | incrementLikes, decrementLikes | No |
| PostSponsorshipModel | `post/postSponsorship.model.ts` | (none) | Yes |
| RevalidationConfigModel | `revalidation/revalidation-config.model.ts` | findByEntityType, findAllEnabled | No |
| RevalidationLogModel | `revalidation/revalidation-log.model.ts` | deleteOlderThan, findWithFilters, findLastCronEntry | No |
| REntityTagModel | `tag/rEntityTag.model.ts` | findAllWithTags, findAllWithEntities, findPopularTags | Yes |
| SponsorshipModel | `sponsorship/sponsorship.model.ts` | findBySlug, findActiveByTarget, **findBySponsorUserId**†, **findByStatus**† | Yes |
| SponsorshipLevelModel | `sponsorship/sponsorshipLevel.model.ts` | findBySlug, **findActiveByTargetType**† | Yes |
| SponsorshipPackageModel | `sponsorship/sponsorshipPackage.model.ts` | findBySlug, **findActive**† | Yes |

> **†** = Delegate method (does NOT call `getDb()` directly but calls inherited BaseModel methods without passing `tx`). See [Delegate Methods](#delegate-methods-no-getdb-but-need-tx) section below.

### Summary Counts

- **Total models affected**: 18
- **Total custom methods with `getDb()`**: 37 (across custom methods, not counting findWithRelations)
- **Total `getDb()` call sites**: 51 (37 in custom methods + 14 in findWithRelations overrides)
- **Delegate methods (no `getDb()` but need `tx`)**: 7 (isDescendant, findByOwnerId, findBySponsorUserId, findByStatus, findActiveByTargetType, findActive, updateStats)
- **findWithRelations overrides dropping tx**: 14
- **findWithRelations overrides with correct tx but narrowed relations type**: 2 (RRolePermissionModel, RUserPermissionModel .. see Reference Implementations)
- **Total findWithRelations overrides needing relations type fix (LSP)**: 16 (all 14 above + the 2 reference implementations)
- **findWithRelations fallback `this.findOne()` calls needing `tx` threading**: 14 (all overrides that drop tx have an internal `this.findOne()` call)

> **Note**: `updateStats` in AccommodationModel does NOT call `getDb()` directly. It only calls `this.update()` (inherited). It is a pure delegate method needing `tx` for transaction safety.

> **Note**: `updateDescendantPaths` in DestinationModel already uses `this.getClient(tx)` correctly and is NOT in scope for `getDb()` replacement. It is the only custom method in DestinationModel that already handles transactions properly.

### Models Already Correct (NOT in scope)

These model subclasses already use `this.getClient(tx)` correctly and do NOT need changes:

| Model | File | Notes |
|-------|------|-------|
| UserModel | `user/user.model.ts` | `findAll`, `count`, `findAllWithCounts` all use `this.getClient(tx)` |
| DestinationReviewModel | `destination/destinationReview.model.ts` | `findAllWithUser` uses `this.getClient(tx)` |
| AccommodationReviewModel | `accommodation/accommodationReview.model.ts` | `findAllWithUser` uses `this.getClient(tx)` |
| ExchangeRateConfigModel | `exchange-rate/exchange-rate-config.model.ts` | Delegates to inherited BaseModel methods with tx passthrough |

### Known Duplication: EventOrganizerModel

There are TWO EventOrganizerModel files:
- `models/eventOrganizer.model.ts` (root-level, has `findWithRelations` override + `getDb()`) .. **this is the file to fix**
- `models/event/eventOrganizer.model.ts` (subfolder, thin wrapper with no custom methods) .. no changes needed

**Important**: The canonical export path is `models/index.ts` → `event/index.ts` → `event/eventOrganizer.model.ts` (the stub). The root-level file with `findWithRelations` is **orphaned** .. it is NOT re-exported through `models/index.ts`. This means:
1. The `findWithRelations` override in the root-level file is currently unreachable via normal `@repo/db` imports
2. The implementer MUST still fix the root-level file (to prevent future reuse of broken code)
3. The duplication itself should be resolved separately (out of scope for this spec, but the implementer should flag it)

> **Conditional note (SPEC-058 coordination)**: If SPEC-058 deletes the orphaned root-level `eventOrganizer.model.ts` as part of its consolidation, adjust SPEC-060 counts: 17 models (not 18), 50 `getDb()` calls (not 51), and Phase 1 = 4 items (not 5). All other counts and guidance remain unchanged.

## Reference Implementations

Two models in the user domain ALREADY implement the correct pattern. Use these as templates:

### RRolePermissionModel (`models/user/rRolePermission.model.ts`)
```typescript
// CURRENT CODE (partially correct .. has tx, but narrows relations type)
async findWithRelations(
    where: Record<string, unknown>,
    relations: Record<string, boolean>,  // NARROWED - needs fix to Record<string, boolean | Record<string, unknown>>
    tx?: NodePgDatabase<typeof schema>   // Will become tx?: DrizzleClient after SPEC-058
): Promise<RolePermission | null> {
    const db = this.getClient(tx);       // CORRECT - uses getClient, not getDb()
    // ... uses db for queries
    // ... passes tx to internal calls: await this.findOne(where, tx)
}
```

### RUserPermissionModel (`models/user/rUserPermission.model.ts`)
Same pattern. Both correctly:
1. Accept `tx` parameter in findWithRelations
2. Use `this.getClient(tx)` instead of `getDb()`
3. Pass `tx` through to internal model method calls

> **Important caveat**: Both reference implementations still use the narrowed `relations: Record<string, boolean>` type instead of the base class's `Record<string, boolean | Record<string, unknown>>`. SPEC-060 MUST also fix the relations type in these two files for full LSP compliance.

## Proposed Solution

For EACH of the 51 `getDb()` call sites:

### Step 1: Add `tx?: DrizzleClient` as last parameter

```typescript
// BEFORE
async findBySlug(slug: string): Promise<T | null> {

// AFTER
async findBySlug(slug: string, tx?: DrizzleClient): Promise<T | null> {
```

Import using type-only import per project conventions:
```typescript
import type { DrizzleClient } from '@repo/db';
```
The package re-exports it; do NOT import from internal paths like `@repo/db/src/types`.

### Step 2: Replace `getDb()` with `this.getClient(tx)`

```typescript
// BEFORE
const db = getDb();

// AFTER
const db = this.getClient(tx);
```

### Step 3: For `findWithRelations` overrides

a. Fix signature to match base class (after SPEC-058):
```typescript
// BEFORE (14 models .. drops tx, narrows relations)
async findWithRelations(
    where: Record<string, unknown>,
    relations: Record<string, boolean>  // NARROWED - LSP violation
): Promise<T | null> {

// BEFORE (2 reference models .. has tx, but narrows relations)
async findWithRelations(
    where: Record<string, unknown>,
    relations: Record<string, boolean>,  // STILL NARROWED - LSP violation
    tx?: NodePgDatabase<typeof schema>
): Promise<T | null> {

// AFTER (all 16 overrides)
async findWithRelations(
    where: Record<string, unknown>,
    relations: Record<string, boolean | Record<string, unknown>>,  // MATCHES base
    tx?: DrizzleClient  // SPEC-058 defines this as the base signature
): Promise<T | null> {
```

b. Replace `getDb()` with `this.getClient(tx)` (for the 14 that use `getDb()`)

c. The 2 reference implementations (RRolePermissionModel, RUserPermissionModel) already use `this.getClient(tx)`. After SPEC-058 changes the type from `NodePgDatabase<typeof schema>` to `DrizzleClient`, no code change is needed for the client call .. only the parameter type annotation and relations type need updating.

d. Pass tx to any internal calls (e.g., `this.findOne(where, tx)`)

### Step 4: Thread tx through internal method calls

When a model method calls another model method internally, it MUST pass `tx`:

```typescript
// BEFORE
async searchWithRelations(params) {
    const db = getDb();
    const items = await db.query.accommodations.findMany({...});
    const total = await this.count(where);  // LOSES tx context!
}

// AFTER
async searchWithRelations(params, tx?: DrizzleClient) {
    const db = this.getClient(tx);
    const items = await db.query.accommodations.findMany({...});
    const total = await this.count(where, { tx });  // PRESERVES tx context
}
```

> **`count()` special case**: Unlike all other BaseModel methods that take positional `tx`, the `count()` method uses an options object: `count(where, { additionalConditions?, tx? })`. The implementer MUST thread tx via the options object: `this.count(where, { tx })`. Current pattern after SPEC-058: `this.count(where, { tx })`.

### Step 5: Remove `getDb` imports from fixed files

After replacing ALL `getDb()` calls in a model file, remove the `getDb` import:

```typescript
// BEFORE
import { getDb } from '../../client';
// or
import { getDb, withTransaction } from '../../client';

// AFTER (remove getDb entirely; keep other imports if present)
import { withTransaction } from '../../client';
```

Only `BaseModel` (in `base.model.ts`) should retain the `getDb` import. All subclass files should import `DrizzleClient` from `@repo/db` instead.

### Step 6: Add `DrizzleClient` import to each fixed file

Every model subclass file that receives `tx?: DrizzleClient` needs the type import:

```typescript
// ADD to each model file (use type-only import per project convention)
import type { DrizzleClient } from '@repo/db';
```

If the file already imports from `@repo/db`, add `DrizzleClient` to the existing import:
```typescript
// BEFORE
import type { Destination } from '@repo/db';

// AFTER
import type { Destination, DrizzleClient } from '@repo/db';
```

## Complex Patterns Requiring Special Attention

### Pattern 1: Subquery + Join (ExchangeRateModel.findLatestRates)

Two separate `db` references used for subquery and main query. Both MUST use the same client:

```typescript
// BEFORE
const db = getDb();
const subquery = db.select({...}).from(exchangeRates).groupBy(...).as('latest');
const results = await db.select().from(exchangeRates).innerJoin(subquery, ...);

// AFTER
const db = this.getClient(tx);
const subquery = db.select({...}).from(exchangeRates).groupBy(...).as('latest');
const results = await db.select().from(exchangeRates).innerJoin(subquery, ...);
// Works correctly because both use same db reference
```

**Risk**: Low. Same `db` variable is reused, so replacing the source is sufficient.

### Pattern 2: N+1 Loop (DestinationModel.searchWithAttractions)

Multiple `db` calls inside `Promise.all` + per-item queries + separate count query. Three distinct `db` references:

```typescript
// BEFORE
const db = getDb();
const items = await db.select().from(destinations)...;
const withAttractions = await Promise.all(items.map(async (item) => {
    const attractions = await db.select().from(rDestinationAttraction)...;  // Same db ref
    return {...item, attractions};
}));
const totalResult = await db.select({count: count()}).from(destinations)...;

// AFTER
const db = this.getClient(tx);
// Same pattern works because all queries share the same db variable
```

**Risk**: Low. All queries already use the same `db` variable.

### Pattern 3: Aggregation with Join (REntityTagModel.findPopularTags)

Complex query with innerJoin, groupBy, and count aggregation:

```typescript
// Straightforward replacement - single db reference
const db = this.getClient(tx);
```

**Risk**: None. Standard replacement.

### Pattern 4: Count Queries Separate from Main Query

Common pattern where `findAll`-style methods have a separate `db.select({count})` call:

```typescript
// Ensure BOTH the main query and the count query use the same db reference
const db = this.getClient(tx);
const items = await db.select().from(table).where(where).limit(limit);
const totalResult = await db.select({count: count()}).from(table).where(where);
```

**Risk**: None, as long as both use the same `db` variable.

### Pattern 5: Iterative Hierarchy Methods (DestinationModel.findDescendants, findAncestors)

Despite the names, these methods are NOT actually recursive. `findDescendants` uses SQL `LIKE` pattern matching on path strings, and `findAncestors` fetches by an array of parent IDs extracted from the path. Both are single-query or iterative (while-loop) patterns, not self-calling recursive methods.

```typescript
// AFTER
async findDescendants(parentId: string, tx?: DrizzleClient): Promise<Destination[]> {
    const db = this.getClient(tx);
    // Uses LIKE '%/parentId/%' pattern matching (single query, not recursive)
    // Also calls this.findOne() internally -- MUST pass tx
}
```

**Risk**: Low. No recursive calls to lose `tx`. Standard `getDb()` replacement + `tx` threading to internal `this.findOne()` calls.

## Delegate Methods (No `getDb()` But Need `tx`)

These 7 methods do NOT call `getDb()` directly but call inherited BaseModel methods (like `this.findOne()`, `this.findAll()`, `this.update()`) without passing a transaction context. After SPEC-058, these inherited methods will accept `tx?: DrizzleClient`. For transaction safety, these delegate methods MUST also accept `tx` and forward it.

### Pattern: Simple delegation to `this.findOne()` or `this.update()`

For methods with only `(where, tx?)` like `findOne`, `findById`, `update`, `softDelete`:
```typescript
// BEFORE
async isDescendant(potentialDescendantId: string, ancestorId: string): Promise<boolean> {
    const descendant = await this.findOne({ id: potentialDescendantId });
}

// AFTER
async isDescendant(potentialDescendantId: string, ancestorId: string, tx?: DrizzleClient): Promise<boolean> {
    const descendant = await this.findOne({ id: potentialDescendantId }, tx);
}
```

### Pattern: Delegation to `this.findAll()` (POSITIONAL PARAMETER GOTCHA)

> **WARNING**: `findAll()` has 4 positional parameters: `findAll(where, options?, additionalConditions?, tx?)`. You CANNOT just pass `tx` as the second argument .. it would land in the `options` slot and cause silent type errors or unexpected behavior. You MUST pass `undefined` for the intermediate optional parameters.

```typescript
// BEFORE
async findBySponsorUserId(sponsorUserId: string): Promise<{ items: Sponsorship[]; total: number }> {
    return this.findAll({ sponsorUserId, deletedAt: null });
}

// AFTER (CORRECT -- tx in position 4)
async findBySponsorUserId(sponsorUserId: string, tx?: DrizzleClient): Promise<{ items: Sponsorship[]; total: number }> {
    return this.findAll({ sponsorUserId, deletedAt: null }, undefined, undefined, tx);
}

// WRONG -- DO NOT DO THIS (tx lands in options slot!)
//  return this.findAll({ sponsorUserId, deletedAt: null }, tx);
```

This applies to ALL 5 delegate methods that call `this.findAll()`: `findByOwnerId`, `findBySponsorUserId`, `findByStatus`, `findActiveByTargetType`, `findActive`.

### Complete list of delegate methods

| Model | Method | Calls | Fix |
|-------|--------|-------|-----|
| DestinationModel | `isDescendant` | `this.findOne()` | Add `tx`, pass to `this.findOne(where, tx)` |
| DestinationModel | `findDescendants` (also has `getDb()`) | `this.findOne()` | Already gets `tx` for `getDb()` fix; also pass `tx` to `this.findOne(where, tx)` |
| DestinationModel | `findAncestors` (also has `getDb()`) | `this.findOne()` | Already gets `tx` for `getDb()` fix; also pass `tx` to `this.findOne(where, tx)` |
| AccommodationModel | `updateStats` | `this.update()` | Add `tx`, pass to `this.update(where, data, tx)` |
| OwnerPromotionModel | `findByOwnerId` | `this.findAll()` | Add `tx`, pass to `this.findAll(where, undefined, undefined, tx)` .. see positional gotcha above |
| SponsorshipModel | `findBySponsorUserId` | `this.findAll()` | Add `tx`, pass to `this.findAll(where, undefined, undefined, tx)` .. see positional gotcha above |
| SponsorshipModel | `findByStatus` | `this.findAll()` | Add `tx`, pass to `this.findAll(where, undefined, undefined, tx)` .. see positional gotcha above |
| SponsorshipLevelModel | `findActiveByTargetType` | `this.findAll()` | Add `tx`, pass to `this.findAll(where, undefined, undefined, tx)` .. see positional gotcha above |
| SponsorshipPackageModel | `findActive` | `this.findAll()` | Add `tx`, pass to `this.findAll(where, undefined, undefined, tx)` .. see positional gotcha above |

> **Note**: `findDescendants` and `findAncestors` are already in scope because they also call `getDb()`. They appear here to remind the implementer to ALSO thread `tx` to their inherited method calls (e.g., `this.findOne()`), not just replace `getDb()`.

### CRITICAL: `count()` vs `findAll()` parameter contrast

These two inherited methods use DIFFERENT patterns for `tx`. Mixing them up causes silent bugs:

```typescript
// findAll() -- POSITIONAL (tx is 4th argument)
this.findAll(where, undefined, undefined, tx)    // CORRECT
this.findAll(where, tx)                           // WRONG -- tx lands in options slot!

// count() -- OPTIONS OBJECT (tx is nested in 2nd argument)
this.count(where, { tx })                         // CORRECT
this.count(where, undefined, tx)                  // WRONG -- count() only takes 2 params!
```

The implementer MUST check which inherited method is being called and use the corresponding pattern. Do NOT assume all methods use the same convention.

### `findWithRelations` fallback pattern

All 14 `findWithRelations` overrides that drop `tx` have an internal fallback path that calls `this.findOne()`:

```typescript
// Inside findWithRelations override - COMMON PATTERN
if (!hasRelations) {
    return this.findOne(where);  // BEFORE - loses tx
    return this.findOne(where, tx);  // AFTER - preserves tx
}
```

When adding `tx` to `findWithRelations`, the implementer MUST also pass `tx` to ANY `this.findOne()` or `this.findById()` calls inside the method body.

### Drizzle Transaction Behavior Notes

For the implementer's reference:

1. **Savepoints**: Drizzle supports nested transactions via savepoints. Calling `tx.transaction()` inside an existing transaction creates a savepoint, not a new top-level transaction. This is relevant if any model method internally calls `withTransaction()` .. within an already-transactional context, it becomes a savepoint.

2. **Relational query API**: `tx.query.tableName.findMany()` works correctly within transactions. The `query` property is inherited from `PgDatabase` (the common base of both `NodePgDatabase` and `NodePgTransaction`).

3. **Type safety**: After SPEC-058, `DrizzleClient = PgDatabase<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>`. Both `NodePgDatabase` and `NodePgTransaction` extend `PgDatabase`, so the type correctly accepts both. This is verified against drizzle-orm@0.44.7. Implementation note: `NodePgDatabase` passes only 2 of 3 type parameters to `PgDatabase` (the third defaults to `ExtractTablesWithRelations<TFullSchema>`), which is why the explicit `DrizzleClient` alias with all 3 params (defined in SPEC-058) is preferred over using `NodePgDatabase` directly. **Important**: `NodePgDatabase` and `NodePgTransaction` are **sibling types** (both extend `PgDatabase`), NOT parent-child. They are structurally compatible via duck typing but nominally distinct. Using `PgDatabase` as the common base (via `DrizzleClient`) is the correct approach.

4. **Manual rollback**: `tx.rollback()` is available for explicit rollback. It has return type `never` (throws internally via `TransactionRollbackError`). After `tx.rollback()`, no code in the callback executes. When manual rollback is used, `db.transaction()` catches the error, issues SQL `ROLLBACK`, then **re-throws the `TransactionRollbackError`** to the caller. Callers must catch `TransactionRollbackError` if they want to handle intentional rollbacks gracefully. Note: this is a service-layer concern (SPEC-059), not a model-layer concern. Model methods should simply throw on errors and let the transaction wrapper handle rollback.

## Implementation Order

Work through models in this order to minimize risk:

### Phase 0: Reference implementations (< 1 hour)
Fix the 2 models that already have tx but need relations type + type annotation migration:
0a. RRolePermissionModel (relations type fix + `tx?: NodePgDatabase<typeof schema>` → `tx?: DrizzleClient`)
0b. RUserPermissionModel (relations type fix + `tx?: NodePgDatabase<typeof schema>` → `tx?: DrizzleClient`)

### Phase 1: Simple models (1 day)
Models with only a findWithRelations override and no custom methods:
1. AmenityModel
2. RDestinationAttractionModel
3. EventModel
4. EventOrganizerModel
5. PostSponsorshipModel

### Phase 2: Models with few custom methods (1 day)
6. PostModel (2 methods: incrementLikes, decrementLikes)
7. SponsorshipLevelModel (1 method + 1 delegate + findWithRelations)
8. SponsorshipPackageModel (1 method + 1 delegate + findWithRelations)
9. OwnerPromotionModel (3 methods + 1 delegate + findWithRelations)
10. SponsorshipModel (2 methods + 2 delegates + findWithRelations)
11. RevalidationConfigModel (2 methods)

### Phase 3: Models with moderate complexity (1 day)
12. RAccommodationAmenityModel (1 method + findWithRelations)
13. RAccommodationFeatureModel (1 method + findWithRelations)
14. REntityTagModel (3 methods + findWithRelations)
15. RevalidationLogModel (3 methods)
16. ExchangeRateModel (5 methods, includes subquery pattern)

### Phase 4: Complex models (1-2 days)
17. AccommodationModel (4 methods + 1 delegate [updateStats] + findWithRelations, includes searchWithRelations)
18. DestinationModel (9 methods + 1 delegate [isDescendant] + findWithRelations, includes N+1 loop and recursive patterns; note: `updateDescendantPaths` already correct)

## Acceptance Criteria

### Completeness
- [ ] ALL 18 model files are updated (see Affected Models table)
- [ ] ALL 51 `getDb()` call sites replaced with `this.getClient(tx)`
- [ ] ALL 14 `findWithRelations` overrides that drop `tx` now accept `tx?: DrizzleClient`
- [ ] ALL 14 `findWithRelations` fallback `this.findOne()` calls pass `tx` through
- [ ] ALL 16 `findWithRelations` overrides (14 broken + 2 reference) use `relations: Record<string, boolean | Record<string, unknown>>` (LSP compliance)
- [ ] The 2 reference implementations (RRolePermissionModel, RUserPermissionModel) updated from `tx?: NodePgDatabase<typeof schema>` to `tx?: DrizzleClient`
- [ ] ALL 7 pure delegate methods updated to accept and forward `tx` (isDescendant, updateStats, findByOwnerId, findBySponsorUserId, findByStatus, findActiveByTargetType, findActive)
- [ ] ALL internal model-to-model calls pass `tx` through (including `count()` with `{ tx }` and `this.update()` in updateStats)
- [ ] ALL 5 `findAll()` delegate methods thread `tx` as 4th positional param: `this.findAll(where, undefined, undefined, tx)` (NOT `this.findAll(where, tx)` which would corrupt the options slot)

### Backward Compatibility
- [ ] `tx` parameter is optional in ALL signatures (existing callers compile without changes)
- [ ] Default behavior (no tx) falls back to `getDb()` via `this.getClient(undefined)`
- [ ] No breaking changes to service layer (services don't pass tx yet .. that's SPEC-059 Phase 4)

### Verification
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm test` passes with zero failures
- [ ] `pnpm lint` passes
- [ ] Zero remaining `getDb()` calls in model subclass files (grep verification)
- [ ] Zero `findWithRelations` overrides with `relations: Record<string, boolean>` (grep verification)
- [ ] Zero remaining `import { getDb }` in model subclass files (only BaseModel should import it)

### Grep Verification Commands
```bash
# Should return ZERO results after implementation (no bare getDb in subclasses):
rg "getDb\(\)" packages/db/src/models/ --type ts --glob '!base.model.ts'

# Should return ZERO results (no narrowed relations type anywhere in models/):
# Finds Record<string, boolean> and excludes lines that also contain the union type
rg "relations: Record<string, boolean>" packages/db/src/models/ --type ts | rg -v "Record<string, unknown>"

# Should return 16 results (all findWithRelations overrides with correct type):
rg "relations: Record<string, boolean \| Record<string, unknown>>" packages/db/src/models/ --type ts

# Should return ZERO results (no getDb import in subclass files):
rg "import.*getDb.*from" packages/db/src/models/ --type ts --glob '!base.model.ts'

# Should return 18+ results (tx parameter with DrizzleClient type in subclass methods):
rg "tx\?: DrizzleClient" packages/db/src/models/ --type ts

# Post-implementation: verify no inherited method calls without tx (spot check):
# Look for this.findOne/findAll/findById/update/count calls and verify tx is passed
rg "this\.(findOne|findAll|findById|update|count)\(" packages/db/src/models/ --type ts

# CRITICAL: verify no findAll delegates pass tx in wrong position (should be 4th arg):
# This should return ZERO results (delegates must use undefined placeholders):
rg "this\.findAll\(\{[^}]+\},\s*tx\)" packages/db/src/models/ --type ts
```

## Estimated Effort

3-5 days (mechanical but large scope: 51 `getDb()` call sites + 7 delegate methods + 14 fallback paths across 20 files).

- Phase 0: < 1 hour (2 reference implementations: relations type fix + `NodePgDatabase` → `DrizzleClient`)
- Phase 1: 1 day (5 simple models with only findWithRelations override)
- Phase 2: 1 day (6 models with few methods, includes delegate methods)
- Phase 3: 1 day (5 models with moderate complexity)
- Phase 4: 1-2 days (2 complex models with special patterns, includes isDescendant)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Large number of files touched | High | Medium | Use search-and-replace with manual verification per phase |
| Missing `tx` threading in internal calls | Medium | High | Grep for `this.method(` calls within model files to ensure tx is passed |
| `count()` uses different parameter pattern (options object) | Medium | Medium | Documented in Step 4. `count()` takes `{ tx }` not positional `tx`. Verify after SPEC-058 final signature |
| Reference implementations need relations type fix too | Low | Low | Easy to miss since they already have tx. Include rRolePermission + rUserPermission in LSP fix pass |
| Complex `getDb()` patterns (subqueries, N+1) | Low | Medium | All complex patterns documented above with conversion examples |
| Delegate methods missed (no `getDb()` but call inherited methods) | Medium | High | 7 pure delegates + 14 findWithRelations fallbacks documented in "Delegate Methods" section. Grep for `this.findOne\|this.findAll\|this.update\|this.count` in model files after fixing `getDb()` |
| SPEC-058 not complete | High | Blocking | Cannot start until SPEC-058 types exist |
| Merge conflicts with SPEC-055 | **High** | **Blocking** | SPEC-055 (LIKE wildcard escaping) MUST be applied before SPEC-060. Both specs modify the same method signatures in `destination.model.ts` and `user.model.ts`. Applying SPEC-060 first would cause significant merge conflicts when SPEC-055 later refactors the `$ilike` patterns in these same methods. Do NOT start SPEC-060 until SPEC-055 is merged |
| `findAll()` positional parameter misuse | **High** | **High** | `findAll(where, options?, additionalConditions?, tx?)` has 4 params. Delegates MUST use `this.findAll(where, undefined, undefined, tx)`, NOT `this.findAll(where, tx)`. Documented in "Delegate Methods" section with explicit warning |
| Merge conflicts with other parallel specs | Low | Low | Beyond SPEC-055, SPEC-060 only touches `packages/db/src/models/` .. no other spec modifies these files |

## Out of Scope

- Transaction creation options (isolation level, access mode, deferrable) .. these are service-layer concerns handled by SPEC-059 where `db.transaction()` is called. Model methods only receive an already-created `tx`
- Service-layer tx propagation Phase 4 (SPEC-059 Phase 4 -- depends on this spec for tx propagation to models)
- BaseModel interface changes (SPEC-058 .. prerequisite for this spec)
- Billing model tx propagation (SPEC-064 .. depends on this spec). Note: current billing models (`billingSettings`, `billingSubscriptionEvent`, `billingDunningAttempt`, `billingAddonPurchase`, `billingNotificationLog`) are pure BaseModel wrappers with zero custom methods and zero `getDb()` calls. They inherit tx support from BaseModel. SPEC-064 addresses billing SERVICE-layer code, not models.
- Integration tests for tx propagation (SPEC-061 .. validates this spec)
- `findAllWithRelations` overrides .. already handled by SPEC-053 (which established the tx pattern). No subclass overrides `findAllWithRelations`, only `findWithRelations`
- Refactoring N+1 patterns (e.g., DestinationModel.searchWithAttractions) .. only adding tx support, not optimizing query patterns
- Resolving EventOrganizerModel file duplication (`models/eventOrganizer.model.ts` vs `models/event/eventOrganizer.model.ts`) .. flagged for future cleanup
- Models already using `this.getClient(tx)` correctly (UserModel, DestinationReviewModel, AccommodationReviewModel, ExchangeRateConfigModel) .. see "Models Already Correct" section

## Dependency Chain

```
SPEC-053 (completed) .. established the pattern
    |
SPEC-058 (BLOCKING prerequisite) .. defines DrizzleClient type, updates BaseModel to tx?: DrizzleClient
    |
SPEC-060 (THIS SPEC) .. propagates tx?: DrizzleClient to all model subclass methods
    |
    +-- SPEC-059 Phase 4 .. service-layer cross-entity tx wrapping (uses model methods with tx)
    +-- SPEC-061 .. integration tests (validates tx propagation works)
```

## Parallel Execution Guide for Agents

> **CRITICAL**: This section is the authoritative reference for any agent implementing SPEC-058, SPEC-059, SPEC-060, or SPEC-061. Read this ENTIRELY before starting work.

### SPEC-060's Position in the Transaction Safety Chain

```
SPEC-055 ── MUST complete first (LIKE escaping in shared files)
SPEC-058 ── MUST complete first (provides DrizzleClient, getClient() semantics)
    │
    ├──► SPEC-060 (THIS SPEC)       ┐
    │                               ├─ CAN RUN IN PARALLEL
    └──► SPEC-059 Phases 1-3 ◄─────┘
                │
                │   THIS SPEC must be merged
                │          │
                ▼          ▼
         SPEC-059 Phase 4 (needs BOTH done)
                │
                ▼
         SPEC-061 (integration tests, validates this spec)
```

### Pre-Conditions (MUST verify before starting)

- [ ] SPEC-058 PR is **merged to `main`**
- [ ] SPEC-055 PR is **merged to `main`**
- [ ] `DrizzleClient` type is exported from `@repo/db`
- [ ] `getClient(tx?: DrizzleClient)` method exists on `BaseModelImpl`
- [ ] `pnpm typecheck` passes on clean `main`

**If ANY of these fail, STOP. Do not start SPEC-060.**

### Why SPEC-055 Must Land First (BLOCKING)

Both SPEC-055 and SPEC-060 modify the **same method signatures** in:
- `destination.model.ts`: `search()` (line ~293), `countByFilters()` (line ~618)
- `user.model.ts`: methods with `ilike()` calls

SPEC-055 refactors `$ilike` object syntax → `ilike()` function calls and adds wildcard escaping. SPEC-060 adds `tx?: DrizzleClient` parameter and replaces `getDb()` → `this.getClient(tx)`.

If SPEC-060 goes first, SPEC-055 would have to refactor methods that already have the new `tx` parameter, causing complex merge conflicts. If SPEC-055 goes first, SPEC-060 simply adds `tx` on top of the already-refactored methods. **Always apply SPEC-055 first.**

### Parallel Execution with SPEC-059

SPEC-060 and SPEC-059 Phases 1-3 can run **in parallel on separate branches** because:
- SPEC-060 modifies `@repo/db` (model layer)
- SPEC-059 Phases 1-3 modify `@repo/service-core` (service layer)
- **Zero shared files** between these two scopes
- No merge conflicts possible

However, **SPEC-059 Phase 4 depends on SPEC-060 being merged**. Phase 4 passes `ctx.tx` to model methods, which requires those methods to accept `tx` (which this spec adds).

### What SPEC-060 Produces (Other Specs Consume These)

| Artifact | Consumer |
|----------|----------|
| `tx?: DrizzleClient` on 51 custom model methods | SPEC-059 Phase 4 (hooks pass `ctx.tx` to these methods) |
| `tx?: DrizzleClient` on 16 `findWithRelations` overrides | SPEC-059 Phase 4, SPEC-066 (getById relations) |
| Fixed `relations` type on `findWithRelations` (LSP fix) | SPEC-066 (new `findOneWithRelations` follows same pattern) |
| All `getDb()` calls replaced with `this.getClient(tx)` | SPEC-061 (integration tests verify tx propagation) |

### What SPEC-060 Does NOT Do (Boundaries)

- Does NOT define `DrizzleClient` type (that's SPEC-058)
- Does NOT touch the base class `BaseModelImpl` (that's SPEC-058)
- Does NOT touch any service-layer files in `@repo/service-core` (that's SPEC-059)
- Does NOT create integration test infrastructure (that's SPEC-061)
- Does NOT touch billing files (that's SPEC-064)
- Does NOT add `findOneWithRelations()` method (that's SPEC-066)

### Completion Signal

When SPEC-060 is done, verify:

1. `pnpm typecheck` passes
2. `pnpm test` passes
3. `rg "getDb\(\)" packages/db/src/models/ --type ts --glob '!base.model.ts'` returns **ZERO results**
4. `rg "relations: Record<string, boolean>" packages/db/src/models/ --type ts` returns **ZERO results** (all fixed to include `Record<string, unknown>`)
5. PR is merged to `main`

**After SPEC-060 is merged**: SPEC-059 Phase 4 can proceed (if SPEC-059 Phases 1-3 are also merged).

### Cross-Spec Merge Conflict Risk

| Spec | Risk | Details |
|------|------|---------|
| SPEC-055 | **BLOCKING** | MUST land before SPEC-060. Both modify `destination.model.ts` method signatures. |
| SPEC-058 | **BLOCKING** | MUST land before SPEC-060. Provides `DrizzleClient` type and `getClient()` method. |
| SPEC-059 | None | Different packages (`@repo/db` vs `@repo/service-core`). Parallel-safe. |
| SPEC-051 | None | Service-layer only. No shared files. |
| SPEC-052 | None | Schemas + service-layer only. No shared files. |
| SPEC-053 | None | Already completed. Established the `tx` pattern this spec extends. |
| SPEC-061 | None | Test infrastructure only. Validates this spec after completion. |
| SPEC-063 | None | Sponsorship schemas only, not model methods. |
| SPEC-066 | None | Will follow this spec's `findWithRelations` pattern. No conflict. |

### Communication Protocol for Parallel Agents

If SPEC-059 and SPEC-060 agents are running in parallel:

1. **SPEC-060 agent (this spec)**: Implement all phases. Merge to `main`. Then CHECK if SPEC-059 Phases 1-3 are merged.
   - If YES → a new agent can start SPEC-059 Phase 4
   - If NO → nothing to do. SPEC-060 is complete. Phase 4 will be picked up later.
2. **SPEC-059 agent**: Implements Phases 1-3 independently. After merge, checks if SPEC-060 is merged.
   - If YES → proceeds with Phase 4
   - If NO → stops after Phase 3
3. **Phase 4 pickup**: Whichever spec merges SECOND should trigger Phase 4 (or a new agent is launched).

## Appendix: getDb() Call Sites by File (Line Reference)

Quick reference for the implementer. Line numbers are approximate (may shift after SPEC-055 or other changes).

| File (relative to `packages/db/src/models/`) | getDb() calls | Lines (approx) |
|----------------------------------------------|---------------|-----------------|
| `destination/destination.model.ts` | 10 | 45, 92, 122, 229, 286, 355, 390, 445, 482, 592 |
| `exchange-rate/exchange-rate.model.ts` | 5 | (5 methods: findLatestRate, findLatestRates, findRateHistory, findManualOverrides, findAllWithDateRange) |
| `accommodation/accommodation.model.ts` | 5 | 27, 59, 130, 233, 291 |
| `tag/rEntityTag.model.ts` | 4 | (3 custom methods + findWithRelations) |
| `owner-promotion/ownerPromotion.model.ts` | 4 | (3 custom methods + findWithRelations) |
| `sponsorship/sponsorship.model.ts` | 3 | (2 custom methods + findWithRelations) |
| `revalidation/revalidation-log.model.ts` | 3 | (3 custom methods) |
| `sponsorship/sponsorshipPackage.model.ts` | 2 | (1 custom method + findWithRelations) |
| `sponsorship/sponsorshipLevel.model.ts` | 2 | (1 custom method + findWithRelations) |
| `revalidation/revalidation-config.model.ts` | 2 | (2 custom methods) |
| `post/post.model.ts` | 2 | (incrementLikes, decrementLikes) |
| `accommodation/rAccommodationFeature.model.ts` | 2 | (1 custom method + findWithRelations) |
| `accommodation/rAccommodationAmenity.model.ts` | 2 | (1 custom method + findWithRelations) |
| `post/postSponsorship.model.ts` | 1 | 26 |
| `eventOrganizer.model.ts` | 1 | 36 |
| `event/event.model.ts` | 1 | (findWithRelations) |
| `destination/rDestinationAttraction.model.ts` | 1 | (findWithRelations) |
| `accommodation/amenity.model.ts` | 1 | (findWithRelations) |
| **Total** | **51** | |

> These line numbers were verified against the codebase as of 2026-04-02. Since SPEC-055 and SPEC-058 MUST both land before SPEC-060, line numbers in `destination.model.ts` and `accommodation.model.ts` will have shifted. Re-verify before implementing.
