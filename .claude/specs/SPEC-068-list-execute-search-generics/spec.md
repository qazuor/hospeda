# SPEC-068: Type-Safe `list()` Options via Generics

> **Status**: draft
> **Type**: refactor
> **Priority**: P3
> **Complexity**: Medium
> **Origin**: SPEC-052 deferred scope
> **Created**: 2026-04-08

## Problem Statement

In `list()` (defined in `BaseCrudRead`, file `packages/service-core/src/base/base.crud.read.ts`),
the validated options object is repeatedly cast to `Record<string, unknown>` to extract individual
fields after the `_beforeList` hook returns:

```ts
// Line 184
const whereClause =
    ((processedOptions as Record<string, unknown>).where as
        | Record<string, unknown>
        | undefined) ?? {};

// Line 188
const search = (processedOptions as Record<string, unknown>).search as
    | string
    | undefined;

// Line 203
const sortBy = (processedOptions as Record<string, unknown>).sortBy as
    | string
    | undefined;

// Line 206
const sortOrder = (processedOptions as Record<string, unknown>).sortOrder as
    | 'asc'
    | 'desc'
    | undefined;
```

There are **4 `as` casts** in `list()` alone. The root cause is the same pattern SPEC-052 solved
for `adminList()`: the hook `_beforeList` returns `typeof normalizedParams` (inferred from the
inline `z.object({...})` schema inside `list()`), but after the hook call the inferred type is
partially opaque to TypeScript because the hook signature in the base class uses a looser type.

This is the exact parallel to the cast chain that existed in `adminList()` before SPEC-052.

## Goal

Apply the same structural fix from SPEC-052 to `list()`:

1. Define a standalone `ListOptions` type that names the options object explicitly — this is the
   "public" type that routes and callers already use implicitly, but without a name.
2. Ensure `_beforeList` has an explicit typed signature so `processedOptions` retains its type
   after the hook call.
3. Eliminate the 4 `as Record<string, unknown>` casts in `list()`.
4. Service overrides of `_beforeList` can use the typed parameter without any `as` casts.

> **Note**: `_executeSearch()` already receives `z.infer<TSearchSchema>` directly via the class
> generic `TSearchSchema extends ZodObject`, so it is already type-safe. The problem is
> exclusively in `list()` and `_beforeList`.

## Current State

### Location of Casts

All 4 casts are in `packages/service-core/src/base/base.crud.read.ts`, inside the `execute`
callback of `list()` (lines ~184–208):

| Line | Cast | Purpose |
|------|------|---------|
| 184–186 | `(processedOptions as Record<string, unknown>).where as Record<string, unknown> \| undefined` | Extract `where` filter |
| 188–190 | `(processedOptions as Record<string, unknown>).search as string \| undefined` | Extract text search |
| 203–205 | `(processedOptions as Record<string, unknown>).sortBy as string \| undefined` | Extract sort field |
| 206–208 | `(processedOptions as Record<string, unknown>).sortOrder as 'asc' \| 'desc' \| undefined` | Extract sort direction |

### Root Cause

`list()` validates its input with an inline anonymous `z.object({...})` schema. The result is
correctly typed inside `execute`. However, the `_beforeList` hook in `BaseCrudHooks` is declared
with a broader signature (likely returning `typeof params` where `params` is typed as the
validated object). When the return is assigned to `processedOptions`, TypeScript narrows or widens
the type depending on how the hook is declared in the abstract base — causing the property
accesses below to require explicit casts.

### Services with `_beforeList` Overrides

A search across `packages/service-core/src/services/` finds the following services that override
`_beforeList`:

- `packages/service-core/src/services/accommodation/accommodation.service.ts`

(Additional overrides may exist — implementation must search for `_beforeList` across all service
files before beginning work.)

### Services with `_executeSearch` Overrides (already type-safe, listed for context)

There are **22 services** that override `_executeSearch()`, all of which already receive
`z.infer<TSearchSchema>` directly. No changes are needed for those overrides.

## Proposed Solution

### Option A: Named `ListOptions` Type + Typed Hook Signature (recommended)

1. **Export a `ListOptions` type** from `packages/service-core/src/types/index.ts`:

```ts
/**
 * Options accepted by `BaseCrudRead.list()`.
 * Used as the parameter type for `_beforeList` hooks and to eliminate
 * `as Record<string, unknown>` casts inside `list()`.
 */
export type ListOptions = {
    readonly page?: number;
    readonly pageSize?: number;
    readonly search?: string;
    readonly relations?: ListRelationsConfig;
    readonly where?: Record<string, unknown>;
    readonly sortBy?: string;
    readonly sortOrder?: 'asc' | 'desc';
};
```

2. **Update `_beforeList` in `BaseCrudHooks`** (`packages/service-core/src/base/base.crud.hooks.ts`)
   to use `ListOptions` explicitly so the return type is preserved:

```ts
protected async _beforeList(
    params: ListOptions,
    _actor: Actor
): Promise<ListOptions> {
    return params;
}
```

3. **Update `list()` in `BaseCrudRead`** to use `ListOptions` in the inline schema validation
   result type annotation (or replace the inline schema with a `listOptionsSchema` constant that
   is typed as `z.ZodType<ListOptions>`), then access fields directly without casts:

```ts
// Before (4 casts):
const whereClause = ((processedOptions as Record<string, unknown>).where as ...) ?? {};
const search = (processedOptions as Record<string, unknown>).search as string | undefined;
const sortBy = (processedOptions as Record<string, unknown>).sortBy as string | undefined;
const sortOrder = (processedOptions as Record<string, unknown>).sortOrder as ... | undefined;

// After (0 casts):
const whereClause = processedOptions.where ?? {};
const search = processedOptions.search;
const sortBy = processedOptions.sortBy;
const sortOrder = processedOptions.sortOrder;
```

### Why This Works

The inline `z.object({...})` in `list()` already validates the correct shape. The issue is not
at validation time, but at usage time after `_beforeList`. By giving the hook an explicit typed
signature (`ListOptions -> ListOptions`), TypeScript propagates the type through the hook call
and the `processedOptions` variable retains full type information.

### Backward Compatibility

- The **public signature of `list()`** does not change. Callers continue to pass the same plain
  object.
- Services that override `_beforeList` will need to update their parameter type from the implicit
  type to `ListOptions`. This is a compile-time only change — no behavior change.
- The default `_beforeList` implementation (`return params`) is unaffected by the type annotation
  change.

## Out of Scope

- Modifying `adminList()` or `_executeAdminSearch()` — already covered by SPEC-052.
- Modifying `_executeSearch()` or `_executeCount()` — already type-safe via `TSearchSchema`.
- Changing runtime behavior of `list()` in any way.
- Changing the public API surface of `BaseCrudService` or its 5-generic class hierarchy.
- Exhaustive field handling enforcement (TypeScript does not error on unused properties).
- The `search()` and `count()` methods — they use `z.infer<TSearchSchema>` directly, no casts.

## Acceptance Criteria

- [ ] A `ListOptions` type is exported from `packages/service-core/src/types/index.ts` with the
      exact fields validated by `list()` (page, pageSize, search, relations, where, sortBy, sortOrder).
- [ ] `_beforeList` in `BaseCrudHooks` (`base.crud.hooks.ts`) is typed with `ListOptions` for
      both parameter and return type.
- [ ] All 4 `as Record<string, unknown>` casts inside `list()` are removed.
- [ ] `processedOptions.where`, `.search`, `.sortBy`, `.sortOrder` are accessed directly without
      any `as` cast.
- [ ] All services that override `_beforeList` are updated to use `ListOptions` as the parameter
      type (verify with a codebase search before implementation).
- [ ] `pnpm typecheck` passes with zero new errors after the change.
- [ ] `pnpm lint` passes with zero new Biome violations after the change.
- [ ] No test changes are required (this is a types-only refactor with identical runtime behavior).
      Existing tests continue to pass without modification.
- [ ] The exported `ListOptions` type is documented with a JSDoc comment explaining its purpose
      and relationship to `_beforeList`.

## Dependencies

- **SPEC-052** (Type-Safe Entity Filters via Generics) — **completed**. This spec is a direct
  continuation of that work, applying the same philosophy to the parallel `list()` path.
- **SPEC-049** (Admin List Filtering) — **in-progress**. No blocking dependency, but if
  `_beforeList` is touched during SPEC-049 work, coordinate to avoid conflicts.

## Affected Files

Based on codebase analysis, the following files are expected to change:

| File | Change |
|------|--------|
| `packages/service-core/src/types/index.ts` | Add `ListOptions` type export |
| `packages/service-core/src/base/base.crud.hooks.ts` | Update `_beforeList` signature to use `ListOptions` |
| `packages/service-core/src/base/base.crud.read.ts` | Remove 4 `as` casts in `list()` |
| `packages/service-core/src/services/accommodation/accommodation.service.ts` | Update `_beforeList` override param type (confirmed override exists) |

> **Pre-implementation step**: Run a search for `_beforeList` across all service files in
> `packages/service-core/src/services/` to find all overrides. Update the file list above
> before starting implementation.
