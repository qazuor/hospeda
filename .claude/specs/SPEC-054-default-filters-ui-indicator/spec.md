# SPEC-054: Admin Entity List Filter Bar & Default Filters Indicator

> **Status**: completed
> **Priority**: P2
> **Complexity**: High
> **Origin**: SPEC-049 GAP-049-046
> **Created**: 2026-03-21
> **Updated**: 2026-03-24 (reviewed: fixed hook name, integration code, dependency classification, cross-spec notes)
> **Estimated effort**: 3-5 days

## 1. Problem Statement

The admin entity list system (`EntityListPage`) has two critical UX gaps:

1. **Invisible default filters**: When `defaultFilters` are configured (currently only destinations with `destinationType: 'CITY'`), they are silently appended to every API request via `createEntityApi` (lines 64-69). The admin sees fewer results than expected with no visual explanation and no way to clear or override the filter.

2. **No entity-specific filter UI**: The backend supports rich filtering per entity via admin search schemas (status, type, category, boolean flags, etc.), but the frontend only exposes a text search input. The `filters` field in `EntityQueryParams` (types.ts:155) exists but is never populated from the UI. Admins must manually construct API URLs to use entity-specific filters.

### Current State (as of SPEC-049)

| Layer | Status |
|-------|--------|
| Backend admin search schemas | 16 entity schemas with entity-specific filter fields |
| `BaseCrudService.adminList()` | Parses and applies all filter fields from query params |
| `createEntityApi` | Supports `defaultFilters` (always applied) and `filters` param (never used) |
| `EntityQueryParams.filters` | Typed but never populated from UI |
| `EntityListPage` | Only passes `page`, `pageSize`, `q`, `sort` to query hook |
| `DataTableToolbar` | Only renders text search, view toggle, column visibility |
| URL search params | Only `page`, `pageSize`, `q`, `sort`, `view`, `cols` |
| Filter UI | None |

## 2. Proposed Solution

Build an extensible **Filter Bar** infrastructure for `EntityListPage` with two capabilities:

1. **Filter controls**: Dropdown selects for enum filters and toggle buttons for boolean filters, configured per entity via a declarative `filterConfig` in `EntityConfig`.
2. **Active filter indicator**: A chip bar showing all active filters (default and user-applied), with visual distinction between default-origin and user-applied filters, and the ability to clear individual filters or reset all.

Filter state is persisted as individual URL search params via TanStack Router (one param per filter, e.g., `?status=ACTIVE&destinationType=CITY`), making it bookmarkable, shareable, and preserved across navigation. This follows TanStack Router best practices where each filter is a first-class search param with native type safety.

### Architecture Overview

```
EntityConfig.filterConfig (declarative)
    |
    v
validateSearch() ── reads URL params ──> filter state
    |
    v
EntityListPage
    ├── DataTableToolbar (existing: search, view toggle, columns)
    ├── FilterBar (NEW: filter dropdowns + active filter chips)
    │     ├── FilterSelect (for enum filters)
    │     ├── FilterBoolean (for boolean filters)
    │     ├── ActiveFilterChips (shows active + default indicators)
    │     └── FilterActions (clear all, reset to defaults)
    └── DataTable / GridView
    |
    v
useEntityQuery({ ...params, filters }) ──> createEntityApi ──> API
```

## 3. Scope

### In Scope

- **FilterBar component**: Container for filter controls and active filter chips
- **FilterSelect component**: Dropdown for enum-type filters (status, type, category, etc.)
- **FilterBoolean component**: Toggle for boolean filters (isFeatured, isBuiltin, etc.)
- **ActiveFilterChips component**: Chip bar showing all active filters with clear buttons
- **Default filter indicator**: Visual distinction (badge/label) for filters originating from `defaultFilters`
- **Filter state in URL**: Persist all active filters as URL search params
- **filterConfig in EntityConfig**: Declarative per-entity filter configuration
- **Integration with EntityListPage**: Wire filter state into the existing query pipeline
- **Pagination reset**: Changing any filter resets to page 1
- **i18n**: Translation keys for all filter labels, option labels, and UI strings
- **Accessibility**: ARIA roles, keyboard navigation, screen reader support
- **Backward compatibility**: Entities without `filterConfig` continue working unchanged
- **Configure filterConfig for initial entities**: Destinations (has defaultFilters), Accommodations, Events, Posts, Users (highest filter value)
- **`includeDeleted` boolean filter**: Added to all 5 initial entity configs as a cross-cutting admin utility filter (already supported by `AdminSearchBaseSchema`, no backend changes needed). Uses `order: 99` to appear last in the filter bar.

### Out of Scope

- **Relation filters** (entity autocomplete for UUID fields like `destinationId`, `ownerId`): Future spec
- **Number range filters** (minPrice/maxPrice, minRating/maxRating): Future spec
- **Date range filters** (startDateAfter/Before, endDateAfter/Before): Future spec
- **Backend changes**: No changes to admin search schemas or `BaseCrudService`
- **Faceted counts**: No count badges on filter options (requires backend support)
- **Saved/preset filter configurations**: Future spec
- **Billing page filters** (PaymentFilters, SubscriptionFilters): These are standalone, not part of the generic system
- **Destination `level` and `parentDestinationId` filters**: `level` is a number-range type and `parentDestinationId` is a relation (UUID autocomplete) type.. both require filter types not yet implemented. Will be added when `number-range` and `relation` filter types are built in a future spec
- **Posts `isFeaturedInWebsite` filter**: Exists in `PostAdminSearchSchema` as a boolean field but omitted from the initial filter config. It is a low-value admin filter (rarely needed). Can be added trivially in a future iteration by appending to `posts.config.ts` filterBarConfig.
- **Users `email` and `authProvider` filters**: Exist in `UserAdminSearchSchema` as string fields. These require a text-input filter type (not yet implemented). The existing text search (`q` param) already covers email lookup. Will be added when a `text` filter type is built in a future spec.
- **Accommodation `destinationId` and `ownerId` filters**: Exist in `AccommodationAdminSearchSchema` as UUID fields requiring entity autocomplete (relation filter type, not yet implemented)
- **Events `locationId`, `organizerId`, `authorId` filters**: Same as above.. UUID relation filters deferred to future spec
- **Events date range filters** (`startDateAfter`, `startDateBefore`, `endDateAfter`, `endDateBefore`): Exist in `EventAdminSearchSchema` but require a date-range filter type not yet implemented. Deferred to the same future spec as number-range and date-range filter types.

### Filter Type Definitions (for extensibility)

Only `select` and `boolean` filter types are implemented in this spec. The type system uses a single `FilterControlConfig` type with a `type` discriminator. Future specs can add new filter types (e.g., `relation`, `number-range`, `date-range`) by:

1. Extending the `FilterControlType` union
2. Adding type-specific optional fields to `FilterControlConfig`
3. Adding a new `Filter<Type>` component
4. Adding a case to the `FilterBar` renderer
5. No changes to state management, URL persistence, or the indicator bar

## 4. Execution Order & Agent Safety Guide

> **For agents**: Read this section before implementing. If prerequisites are not met, STOP and report to the user.

### Prerequisites

**SPEC-049** (Admin List Filtering) must be implemented. As of 2026-04-04, SPEC-049 is **fully implemented and operational**: `adminList()`, `createAdminListRoute`, all 16 `AdminSearchSchema` definitions, `EntityListPage`, and 16 admin list routes are merged and working. **SPEC-054 can proceed immediately.**

### Position in the Dependency Graph

```
SPEC-049 ✅ (already done) ──► SPEC-054 (THIS SPEC) ── INDEPENDENT
                                    │
                                    └── Post-SPEC-063 follow-up task (add lifecycleState filters)
```

SPEC-054 is effectively **independent** since its only dependency (SPEC-049) is already complete. It can be implemented at any time, in parallel with any other spec.

### Post-SPEC-063 Follow-Up

After SPEC-063 (Lifecycle State Standardization) is implemented, 6 additional entities gain `lifecycleState` fields: PostSponsor, Tag, OwnerPromotion, Sponsorship, AccommodationReview, DestinationReview. A follow-up task should add `filterBarConfig` for these entities. This does NOT block SPEC-054 implementation.

### Parallel Safety

| Spec | Conflict Risk | Details |
|------|--------------|---------|
| SPEC-051 | None | Different layers (admin UI vs service permissions). |
| SPEC-052 | None | Different layers (admin UI vs service types). |
| SPEC-055 | None | Different layers (admin UI vs DB models). |
| SPEC-058-061 | None | Different layers (admin UI vs DB/service transaction chain). |
| SPEC-062 | None | SPEC-062 is API response layer. SPEC-054 is admin frontend. No shared files. |
| SPEC-063 | Low | SPEC-063 adds `lifecycleState` to entities. SPEC-054 may want to add filters for it. But this is a follow-up, not a conflict. |
| SPEC-066 | None | Different layers (admin UI vs service/model). |

### Agent Instructions

1. Verify `pnpm typecheck` passes on current `main` before starting
2. Verify `EntityListPage` component exists in `apps/admin/src/components/entity-list/`
3. Implement: filter components (9 new files), hook (`useFilterState`), i18n files (3 locales), entity configs (5 entities)
4. Run `pnpm typecheck && pnpm test`
5. This spec can be merged independently at any time

### Dependency Table (Legacy Reference)

| Spec | Type | Notes |
|------|------|-------|
| SPEC-049 | Hard (DONE) | Provides EntityListPage, adminList, admin search schemas. Already implemented. |
| SPEC-063 | Awareness | After SPEC-063, add `lifecycleState` filter to 6 entities (follow-up task). |
| SPEC-052 | Optional | `filterConfig` types could leverage `EntityFilters<TSchema>` for type safety. |

## 5. Type Definitions

Types are split between two files:

- **Types that extend `EntityConfig`** (like the `filterBarConfig` property on `EntityConfig`) go in `apps/admin/src/components/entity-list/types.ts`
- **Internal filter component types** (`FilterControlConfig`, `FilterBarConfig`, `FilterChipData`, `ActiveFilters`) go in `apps/admin/src/components/entity-list/filters/filter-types.ts`

### 5.1 Filter Configuration Types

The following types live in `apps/admin/src/components/entity-list/filters/filter-types.ts`:

```typescript
/**
 * Supported filter control types.
 * 'select' and 'boolean' are implemented in SPEC-054.
 * Additional types ('relation', 'number-range', 'date-range') will be
 * defined in future specs when implemented. No need to pre-define them.
 */
type FilterControlType = 'select' | 'boolean';

/**
 * Configuration for a single filter control in the filter bar.
 * Uses a flat type with optional fields per filter type,
 * discriminated by the `type` field.
 */
export type FilterControlConfig = {
  /** Unique key matching the API query parameter name (e.g., 'destinationType', 'status') */
  readonly paramKey: string;
  /** i18n key for the filter label */
  readonly labelKey: string;
  /** Type of filter control to render */
  readonly type: FilterControlType;
  /** For select type: list of available options. Required when type is 'select'. */
  readonly options?: ReadonlyArray<{
    readonly value: string;
    readonly labelKey: string;
    /** Optional icon identifier for the option */
    readonly icon?: string;
  }>;
  /** For select type: i18n key for the "all" option. Defaults to "admin-filters.allOption" */
  readonly allLabelKey?: string;
  /** Default value applied when no user selection exists. If set, this filter is a "default filter". */
  readonly defaultValue?: string;
  /** Display order (lower = first). Defaults to 0. */
  readonly order?: number;
};

/**
 * Configuration for the entire filter bar of an entity.
 */
export type FilterBarConfig = {
  /** List of filter controls to render */
  readonly filters: ReadonlyArray<FilterControlConfig>;
};
```

### 5.2 EntityConfig Extension

Add `filterBarConfig` to `EntityConfig`:

```typescript
// In EntityConfig<TData> (types.ts, around line 195):
export type EntityConfig<TData = unknown> = {
  // ... existing fields ...

  /** Default query parameters to always include in API requests (LEGACY - prefer filterBarConfig.filters[].defaultValue) */
  readonly defaultFilters?: Readonly<Record<string, string>>;

  /** Filter bar configuration. If undefined, no filter bar is shown */
  readonly filterBarConfig?: FilterBarConfig;

  // ... rest of existing fields ...
};
```

> **Note**: `defaultFilters` is kept for backward compatibility. When `filterBarConfig` is defined, `defaultFilters` is ignored (filterBarConfig takes precedence). When only `defaultFilters` is defined (legacy), the old behavior is preserved.

### 5.3 Filter State Types

```typescript
/**
 * Active filter values, keyed by paramKey.
 * Values are always strings (URL-serializable).
 * Boolean filters use 'true'/'false' strings.
 */
export type ActiveFilters = Readonly<Record<string, string>>;
```

> **Three-state filter semantics**: A filter param can be in one of three states:
>
> - **Present with value** (e.g., `status: 'ACTIVE'`): User-selected or default-applied filter
> - **Present with sentinel** (`status: '__cleared__'`): User explicitly cleared this filter (overrides default)
> - **Absent** (`status` not in URL): Use config default if available, otherwise no filter
>
> `ActiveFilters` only contains actual values (never the sentinel). The sentinel exists only in URL params.

```typescript
/**
 * Computed filter state with metadata for rendering.
 */
export type FilterChipData = {
  readonly paramKey: string;
  readonly labelKey: string;
  readonly value: string;
  /** Translated display value for the chip */
  readonly displayValue: string;
  /** Whether this filter value originated from a default */
  readonly isDefault: boolean;
};
```

### 5.4 URL Search Params Extension

Each filter becomes an individual first-class URL search param. This follows TanStack Router best practices: native type safety, zero custom serialization, and human-readable URLs.

Extend the existing `EntityListSearchParams` type:

```typescript
// Current (defined locally in EntityListPage.tsx validateSearch, not exported):
type EntityListSearchParams = {
  page: number;
  pageSize: number;
  q: string;
  sort?: string;
  view: 'table' | 'grid';
  cols?: string;
};

// Extended (SPEC-054) - filter params are dynamic, based on filterBarConfig:
type EntityListSearchParams = {
  page: number;
  pageSize: number;
  q: string;
  sort?: string;
  view: 'table' | 'grid';
  cols?: string;
  /** Individual filter params. Each key matches a FilterControlConfig.paramKey */
  [filterParamKey: string]: string | number | boolean | undefined;
};
```

> **Note**: `EntityListSearchParams` is currently defined inline in `EntityListPage.tsx`'s `validateSearch` function. For this spec, extract it as a named type in `types.ts` so it can be reused and extended cleanly.

**URL format**: Each filter is its own search param. Example URL:
`/destinations?page=1&pageSize=20&destinationType=CITY&status=ACTIVE&isFeatured=true`

**No collision risk**: Filter param names (`destinationType`, `status`, `isFeatured`, `type`, `category`, `role`, `isNews`, `includeDeleted`) do NOT collide with base params (`page`, `pageSize`, `q`, `sort`, `view`, `cols`). This was verified against all 5 entity admin search schemas.

**Advantages over serialized string approach**:

- Zero custom serialization/deserialization code
- Full TanStack Router type safety and native handling
- Human-readable URLs
- Deep linking works natively
- Each filter can be validated independently via `zodValidator`
- "Clear all filters" = remove all filter params from URL

**Three-state semantics for filter params**:

- **`undefined` (absent from URL)**: Use default value from `filterBarConfig` if one exists
- **`"__cleared__"` (sentinel value)**: User explicitly cleared this filter, do NOT apply default. This is a special string constant that signals "I want no filter here" vs "I haven't set anything"
- **`"ACTIVE"` / `"true"` / etc. (actual value)**: User-selected filter value

> **Why a sentinel instead of empty string?** TanStack Router strips empty-string params from the URL. Using `__cleared__` preserves the "explicitly no filter" state across navigation. The sentinel is never sent to the API.. `createEntityApi` maps it to "omit this param".

## 6. Component Architecture

### 6.1 Component Tree

```
EntityListPage
├── DataTableToolbar (unchanged)
├── FilterBar
│   ├── FilterControls (the dropdown/toggle area)
│   │   ├── FilterSelect (one per select-type filter)
│   │   └── FilterBoolean (one per boolean-type filter)
│   ├── ActiveFilterChips (rendered below controls when any filter is active)
│   │   └── FilterChip (one per active filter, removable)
│   └── FilterActions
│       ├── "Clear all" button (removes all filters including defaults)
│       └── "Reset to defaults" button (only visible when state differs from defaults)
└── DataTable / GridView
```

### 6.2 File Structure

```
apps/admin/src/components/entity-list/
├── filters/
│   ├── FilterBar.tsx              # Main container component
│   ├── FilterSelect.tsx           # Select dropdown filter control
│   ├── FilterBoolean.tsx          # Boolean toggle filter control
│   ├── ActiveFilterChips.tsx      # Chip bar showing active filters
│   ├── FilterChip.tsx             # Individual removable chip
│   ├── FilterActions.tsx          # Clear all / Reset to defaults buttons
│   ├── useFilterState.ts          # Hook: manages filter state + URL sync
│   ├── filter-utils.ts            # Default computation, chip building, filter state helpers
│   ├── filter-types.ts            # Internal filter types: FilterControlConfig, FilterBarConfig, FilterChipData, ActiveFilters
│   └── index.ts                   # Barrel exports
├── EntityListPage.tsx             # Modified: integrates FilterBar
├── types.ts                       # Modified: new filter types added
├── api/
│   └── createEntityApi.ts         # Modified: filter override logic
└── hooks/
    └── useEntityQuery.ts          # Unchanged (receives filters via params)
```

### 6.3 FilterBar Component

**File**: `apps/admin/src/components/entity-list/filters/FilterBar.tsx`

```typescript
type FilterBarProps = {
  readonly config: FilterBarConfig;
  readonly activeFilters: ActiveFilters;
  /** Computed default filter values from filterBarConfig (for "(default)" badge logic) */
  readonly computedDefaults: ActiveFilters;
  readonly onFilterChange: (paramKey: string, value: string | undefined) => void;
  readonly onClearAll: () => void;
  readonly onResetDefaults: () => void;
  readonly hasActiveFilters: boolean;
  readonly hasNonDefaultFilters: boolean;
};
```

**Behavior**:

- Renders `FilterControls` section with one control per `config.filters` entry (sorted by `order`)
- Only renders controls for implemented filter types (`select`, `boolean`). Skips `relation`, `number-range`, `date-range` silently.
- Below the controls, renders `ActiveFilterChips` when `hasActiveFilters` is true
- Renders `FilterActions` with conditional buttons

**Layout**:

- Controls row: `flex flex-wrap items-center gap-2`
- Chips row (below controls, only when active): `flex flex-wrap items-center gap-1.5 pt-2`
- Entire bar is wrapped in a `div` with subtle border-bottom and padding

**Responsive**:

- On mobile (`< sm`), filter controls wrap naturally via flex-wrap
- Chips also wrap

### 6.4 FilterSelect Component

**File**: `apps/admin/src/components/entity-list/filters/FilterSelect.tsx`

```typescript
type FilterSelectProps = {
  readonly config: FilterControlConfig;
  readonly value: string | undefined;
  readonly onChange: (value: string | undefined) => void;
};
```

**Implementation**: Composes over the existing shadcn `Select` component already available at `apps/admin/src/components/ui/select.tsx` (`SelectTrigger`, `SelectContent`, `SelectItem`). Does NOT create a new select primitive.. wraps the existing one with filter-specific behavior.

- Trigger shows the translated label when no value selected (e.g., "Status")
- Trigger shows the translated selected value when active (e.g., "Active")
- First option is always "All" (the clear/unfilter option), using `allLabelKey` or fallback `admin-filters.allOption`
- When "All" is selected, calls `onChange(undefined)` (removes filter)
- When a value is selected, calls `onChange(value)`
- Trigger uses `className="h-8 border-dashed"` styling (shadcn filter pattern). Note: shadcn `SelectTrigger` does not have a `variant` prop.. use className directly
- When a value is selected (not "All"), trigger shows a subtle accent indicator (left border or dot) via conditional className (e.g., `border-solid border-primary` when active)

**Size**: `h-8 text-sm` (compact, matching DataTableToolbar height)

> When the user selects "All", the filter is **removed** from `activeFilters` (set to `undefined`). Only filters with a defined, non-empty value are included in the serialized URL and API request. This means an empty `activeFilters` object (`{}`) represents "no filters applied".

### 6.5 FilterBoolean Component

**File**: `apps/admin/src/components/entity-list/filters/FilterBoolean.tsx`

```typescript
type FilterBooleanProps = {
  readonly config: FilterControlConfig;
  readonly value: string | undefined;
  readonly onChange: (value: string | undefined) => void;
};
```

**Implementation**: Composes over the existing shadcn `Select` component (same as FilterSelect) with three fixed options:

- "All" → `onChange(undefined)`
- "Yes" → `onChange('true')`
- "No" → `onChange('false')`

**i18n keys**: `admin-filters.booleanYes` ("Yes" / "Si"), `admin-filters.booleanNo` ("No"), `admin-filters.allOption` ("All" / "Todos")

> When the user selects "All", the filter is **removed** from `activeFilters` (set to `undefined`). Only filters with a defined, non-empty value are included in the serialized URL and API request. This means an empty `activeFilters` object (`{}`) represents "no filters applied".

### 6.6 ActiveFilterChips Component

**File**: `apps/admin/src/components/entity-list/filters/ActiveFilterChips.tsx`

```typescript
type ActiveFilterChipsProps = {
  readonly chips: readonly FilterChipData[];
  readonly onRemove: (paramKey: string) => void;
};
```

**Renders**: A horizontal row of `FilterChip` components.

### 6.7 FilterChip Component

**File**: `apps/admin/src/components/entity-list/filters/FilterChip.tsx`

```typescript
type FilterChipProps = {
  readonly chip: FilterChipData;
  readonly onRemove: () => void;
};
```

**Implementation**: Composes over the existing wrapped `Badge` component at `apps/admin/src/components/ui-wrapped/Badge.tsx` which already supports `leftIcon`, `rightIcon`, `dot`, and `size` props. Uses `rightIcon` for the close/remove button.

- **Default-origin chip**: `variant="secondary"` with a small "default" text label appended
  - Example: `Status: Active (default) ✕`
  - Color: muted/secondary background
- **User-applied chip**: `variant="outline"` without the "default" label
  - Example: `Type: Apartment ✕`
  - Color: standard outline

Both include an `X` button (`CloseIcon` from `@repo/icons`, 14px) to remove the filter.

**Accessibility**:

- `role="status"` on the chip container
- `aria-label="Remove filter: Status Active"` on the X button
- `tabIndex={0}` and `onKeyDown` (Enter/Space) on the X button
- `aria-live="polite"` on the chips container so screen readers announce changes

### 6.8 FilterActions Component

**File**: `apps/admin/src/components/entity-list/filters/FilterActions.tsx`

```typescript
type FilterActionsProps = {
  readonly hasActiveFilters: boolean;
  readonly hasNonDefaultFilters: boolean;
  readonly onClearAll: () => void;
  readonly onResetDefaults: () => void;
};
```

**Renders**:

- **"Clear all"** button (`variant="ghost"`, `size="sm"`): Visible when `hasActiveFilters` is true. Removes ALL filters including defaults.. the API request will have NO filter params for these keys. This means the user sees ALL records without any filtering. Icon: `CloseIcon` from `@repo/icons`.
- **"Reset to defaults"** button (`variant="ghost"`, `size="sm"`): Visible when `hasNonDefaultFilters` is true (user has changed something from defaults OR cleared a default). Restores the default filter values defined in `filterBarConfig.filters[].defaultValue`. Icon: `RotateCcwIcon` from `@repo/icons`.

> **Clear all vs Reset to defaults**: These are intentionally distinct actions. "Clear all" removes every filter (including defaults), showing all records. "Reset to defaults" restores the config-defined default values. Example for Destinations: "Clear all" shows ALL destination types; "Reset to defaults" re-applies `destinationType: CITY`.

### 6.9 useFilterState Hook

**File**: `apps/admin/src/components/entity-list/filters/useFilterState.ts`

This is the core state management hook. It bridges URL search params with filter state.

```typescript
type UseFilterStateParams = {
  readonly filterBarConfig: FilterBarConfig | undefined;
  readonly searchParams: Record<string, unknown>;
  readonly onUpdateSearch: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
};

type UseFilterStateReturn = {
  /** Current active filters (merged defaults + user selections) */
  readonly activeFilters: ActiveFilters;
  /** Computed default filter values from filterBarConfig (only filters with defaultValue) */
  readonly computedDefaults: ActiveFilters;
  /** Whether any filter is currently active (including defaults) */
  readonly hasActiveFilters: boolean;
  /** Whether current filters differ from the default set */
  readonly hasNonDefaultFilters: boolean;
  /** Array of chip data for rendering ActiveFilterChips */
  readonly chips: ReadonlyArray<FilterChipData>;
  /** Handler for individual filter changes. Pass undefined to clear a filter. */
  readonly handleFilterChange: (paramKey: string, value: string | undefined) => void;
  /** Clears ALL filters including defaults */
  readonly handleClearAll: () => void;
  /** Resets filters to their default values */
  readonly handleResetDefaults: () => void;
};
```

**Translation access**: The hook internally calls `useTranslations()` from `@/hooks/use-translations` (the project's translation hook) to obtain the `t` function. Keys use dot notation with the `admin-filters` namespace prefix, e.g., `t('admin-filters.allOption' as TranslationKey)`. This avoids requiring the caller to pass `t` as a parameter.

**Memoization strategy**:

- `computedDefaults`: `useMemo` over `[filterBarConfig]` (via `computeDefaultFilters`)
- `activeFilters`: `useMemo` over `[searchParams, filterBarConfig, computedDefaults]`
- `chips`: `useMemo` over `[activeFilters, filterBarConfig, computedDefaults, t]`
- `hasActiveFilters`: derived from `activeFilters` (inline, no separate memo needed)
- `hasNonDefaultFilters`: `useMemo` over `[activeFilters, computedDefaults]`
- `handleFilterChange`, `handleClearAll`, `handleResetDefaults`: `useCallback` over `[filterBarConfig, computedDefaults, onUpdateSearch]`

**Logic**:

1. **Compute active filters**:
   - Extract filter-relevant params from `searchParams` by matching against `filterBarConfig.filters[].paramKey`
   - For each filter in config:
     - If param value is `"__cleared__"` → filter is explicitly cleared (not active)
     - If param value is a valid string → use it (user-selected)
     - If param is `undefined` → use `defaultValue` from config (if any)
   - Result is the merged `ActiveFilters` record

2. **Compute chips**: For each active filter, look up its config to get `labelKey`, translate the value to a display string, and determine `isDefault` by comparing to the default value.

3. **handleFilterChange(paramKey, value)**:
   - If `value` is `undefined` and the filter has a `defaultValue` → set param to `"__cleared__"` (explicitly no filter)
   - If `value` is `undefined` and no default → remove param from URL
   - If `value` is defined → set param to value
   - Call `onUpdateSearch` with updated params and `page: 1`
   - **Page reset**: ALWAYS reset to page 1 when any filter changes

4. **handleClearAll()**:
   - For each filter in config:
     - If it has a `defaultValue` → set param to `"__cleared__"`
     - Otherwise → remove param from URL
   - Call `onUpdateSearch` with `page: 1`

5. **handleResetDefaults()**:
   - For each filter in config:
     - If it has a `defaultValue` → set param to that default value
     - Otherwise → remove param from URL
   - Call `onUpdateSearch` with `page: 1`

### 6.10 filter-utils.ts

**File**: `apps/admin/src/components/entity-list/filters/filter-utils.ts`

```typescript
/** Sentinel value indicating a filter was explicitly cleared by the user */
export const FILTER_CLEARED_SENTINEL = '__cleared__' as const;

/**
 * Extract active filters from URL search params based on filterBarConfig.
 * Handles three-state semantics: undefined (use default), sentinel (cleared), value (user-selected).
 *
 * Algorithm:
 * 1. For each filter in `filterBarConfig.filters`:
 *    a. Get the value from `searchParams[filter.paramKey]`
 *    b. If value is `FILTER_CLEARED_SENTINEL` → skip (explicitly cleared)
 *    c. If value is a non-empty string → add to result as `{ paramKey: value }`
 *    d. If value is undefined and filter has `defaultValue` → add `{ paramKey: defaultValue }`
 *    e. If value is undefined and no defaultValue → skip
 * 2. Return result as `ActiveFilters`
 */
export const extractActiveFilters = (params: {
  searchParams: Readonly<Record<string, unknown>>;
  filterBarConfig: FilterBarConfig;
}): ActiveFilters => { ... };

/**
 * Compute default filter values from filterBarConfig.
 * Returns only filters that have a `defaultValue` defined.
 */
export const computeDefaultFilters = (params: {
  filterBarConfig?: FilterBarConfig;
}): ActiveFilters => { ... };

/**
 * Compare two ActiveFilters objects for equality.
 */
export const filtersEqual = (a: ActiveFilters, b: ActiveFilters): boolean => { ... };

/**
 * Build FilterChipData array from active filters and config.
 *
 * Algorithm:
 * 1. For each entry in `activeFilters`:
 *    a. Find matching `FilterControlConfig` in `filterBarConfig.filters` by `paramKey`
 *    b. If no config found, skip (unknown filter, not shown as chip)
 *    c. Resolve `displayValue`:
 *       - If `type === 'select'`: find the option where `option.value === activeValue`,
 *         then `displayValue = t(option.labelKey)`. If no option matches, use raw value.
 *       - If `type === 'boolean'`: `displayValue = activeValue === 'true' ? t('admin-filters.booleanYes') : t('admin-filters.booleanNo')`
 *    d. Determine `isDefault`: `defaultFilters[paramKey] === activeValue`
 *    e. Build `FilterChipData` object
 * 2. Sort chips by `config.order` (ascending)
 * 3. Return readonly array
 */
export const buildFilterChips = (params: {
  activeFilters: ActiveFilters;
  filterBarConfig: FilterBarConfig;
  defaultFilters: ActiveFilters;
  t: (key: string) => string;
}): readonly FilterChipData[] => { ... };

/**
 * Build URL search param updates for a filter change.
 * Returns an object of param updates to merge into the URL.
 *
 * @param paramKey - The filter param to change
 * @param value - The new value, or undefined to clear
 * @param hasDefault - Whether this filter has a defaultValue in config
 * @returns Object with param updates (value, sentinel, or undefined to remove)
 */
export const buildFilterParamUpdate = (params: {
  paramKey: string;
  value: string | undefined;
  hasDefault: boolean;
}): Record<string, string | undefined> => { ... };
```

## 7. Integration with EntityListPage

### 7.1 Changes to validateSearch

**File**: `apps/admin/src/components/entity-list/EntityListPage.tsx`, `validateSearch` function.

The `validateSearch` function is updated to extract filter params from the URL. Since filter params are dynamic (based on `filterBarConfig`), the function passes through all unknown params to be processed by `useFilterState`.

```typescript
const validateSearch = (search: Record<string, unknown>) => {
  // ... existing num, page, pageSize, view, q, sort, cols parsing (unchanged) ...

  // Pass through all remaining params (filter params are extracted by useFilterState)
  // This avoids hardcoding filter param names in validateSearch
  const { page: _p, pageSize: _ps, view: _v, q: _q, sort: _s, cols: _c, ...filterParams } = search;

  return { page, pageSize, view, q, sort, cols, ...filterParams } as const;
};
```

> **Alternative (recommended if `@tanstack/zod-adapter` is installed)**: Build a dynamic Zod schema from `filterBarConfig` and use `zodValidator()` for full type-safe validation. This is a nice-to-have optimization that can be done as a follow-up after the core functionality works.

### 7.2 Changes to EntityListPageComponent

**File**: `apps/admin/src/components/entity-list/EntityListPage.tsx`, component body.

After the existing `DataTableToolbar`, render `FilterBar`:

```typescript
// Inside EntityListPageComponent:

const filterState = useFilterState({
  filterBarConfig: config.filterBarConfig,
  searchParams: search, // full validated search object; hook extracts filter params by matching filterBarConfig keys
  onUpdateSearch: updateSearch,
});

// In the query params passed to useEntityQuery:
const queryParams: EntityQueryParams = {
  page: search.page,
  pageSize: search.pageSize,
  q: debouncedQuery,
  sort: parsedSort,
  filters: filterState.activeFilters, // NEW
};
```

In the JSX, between `DataTableToolbar` and the table:

```tsx
{config.filterBarConfig && (
  <FilterBar
    config={config.filterBarConfig}
    activeFilters={filterState.activeFilters}
    computedDefaults={filterState.computedDefaults}
    onFilterChange={filterState.handleFilterChange}
    onClearAll={filterState.handleClearAll}
    onResetDefaults={filterState.handleResetDefaults}
    hasActiveFilters={filterState.hasActiveFilters}
    hasNonDefaultFilters={filterState.hasNonDefaultFilters}
  />
)}
```

### 7.3 Changes to createEntityApi

**File**: `apps/admin/src/components/entity-list/api/createEntityApi.ts`

The current logic always applies `defaultFilters`. The new logic uses the presence of `filterBarConfig` (passed to `createEntityApi`) as the signal for whether filter state is UI-managed or legacy.

```typescript
// Current (lines 64-78):
if (defaultFilters) {
  for (const [key, value] of Object.entries(defaultFilters)) {
    params.set(key, value);
  }
}
if (filters) {
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
}

// New:
if (filterBarConfig) {
  // UI-managed mode: filter state comes exclusively from useFilterState
  // An empty filters object means "user cleared all" - do NOT fall back to defaultFilters
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }
  }
} else if (defaultFilters) {
  // Legacy path: no filter UI, apply static defaults
  for (const [key, value] of Object.entries(defaultFilters)) {
    params.set(key, value);
  }
  // Also apply any programmatic filters passed through
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }
  }
}
```

The `createEntityApi` function signature is refactored to accept a configuration object (RO-RO pattern), and its filter logic is updated to distinguish between UI-managed filters (via `filterBarConfig`) and legacy static defaults:

```typescript
export type CreateEntityApiParams<TData> = {
  readonly endpoint: string;
  readonly itemSchema: z.ZodSchema<TData>;
  readonly defaultFilters?: Readonly<Record<string, string>>;
  /** When provided, UI manages all filter state. defaultFilters is ignored. */
  readonly filterBarConfig?: FilterBarConfig;
};

export const createEntityApi = <TData>(params: CreateEntityApiParams<TData>) => { ... };
```

> **Migration**: `createEntityApi` is called in exactly **1 place**: inside `createEntityListPage()` at `EntityListPage.tsx:108`. Entity config files do NOT call `createEntityApi` directly.. they pass the config to `createEntityListPage` which calls it internally. The migration is a single call-site change from `createEntityApi(endpoint, schema, defaultFilters)` to `createEntityApi({ endpoint, itemSchema: schema, defaultFilters, filterBarConfig })`. The 13 entity config files are unaffected by this refactor.

When `filterBarConfig` is provided in the entity config:

- `createEntityApi` ignores `defaultFilters` entirely
- Filter state comes exclusively from `useFilterState` (which handles defaults internally)
- An empty `activeFilters` object means "no filters" (user cleared all, including defaults)

When `filterBarConfig` is NOT provided (legacy entities):

- `createEntityApi` applies `defaultFilters` as before (backward compatible)

### 7.4 Changes to EntityQueryParams

**File**: `apps/admin/src/components/entity-list/types.ts`

The existing `filters` field type is already correct:

```typescript
export type EntityQueryParams = {
  readonly page: number;
  readonly pageSize: number;
  readonly q?: string;
  readonly sort?: readonly SortConfig[];
  readonly filters?: Readonly<Record<string, string | number | boolean | undefined>>;
};
```

No changes needed. The `filters` field is already typed and supported throughout the pipeline.

## 8. Entity Filter Configurations

### 8.1 Destinations

```typescript
// apps/admin/src/features/destinations/config/destinations.config.ts
filterBarConfig: {
  filters: [
    {
      paramKey: 'destinationType',
      labelKey: 'admin-filters.destinationType.label',
      type: 'select',
      defaultValue: 'CITY',
      order: 1,
      options: [
        { value: 'COUNTRY', labelKey: 'admin-filters.destinationType.country' },
        { value: 'REGION', labelKey: 'admin-filters.destinationType.region' },
        { value: 'PROVINCE', labelKey: 'admin-filters.destinationType.province' },
        { value: 'DEPARTMENT', labelKey: 'admin-filters.destinationType.department' },
        { value: 'CITY', labelKey: 'admin-filters.destinationType.city' },
        { value: 'TOWN', labelKey: 'admin-filters.destinationType.town' },
        { value: 'NEIGHBORHOOD', labelKey: 'admin-filters.destinationType.neighborhood' },
      ],
    },
    {
      paramKey: 'status',
      labelKey: 'admin-filters.status.label',
      type: 'select',
      order: 2,
      options: [
        { value: 'DRAFT', labelKey: 'admin-filters.status.draft' },
        { value: 'ACTIVE', labelKey: 'admin-filters.status.active' },
        { value: 'ARCHIVED', labelKey: 'admin-filters.status.archived' },
      ],
    },
    {
      paramKey: 'isFeatured',
      labelKey: 'admin-filters.isFeatured.label',
      type: 'boolean',
      order: 3,
    },
    {
      paramKey: 'includeDeleted',
      labelKey: 'admin-filters.includeDeleted.label',
      type: 'boolean',
      order: 99,
    },
  ],
},
// defaultFilters can be removed once filterBarConfig is in place
```

### 8.2 Accommodations

```typescript
// apps/admin/src/features/accommodations/config/accommodations.config.ts
filterBarConfig: {
  filters: [
    {
      paramKey: 'status',
      labelKey: 'admin-filters.status.label',
      type: 'select',
      order: 1,
      options: [
        { value: 'DRAFT', labelKey: 'admin-filters.status.draft' },
        { value: 'ACTIVE', labelKey: 'admin-filters.status.active' },
        { value: 'ARCHIVED', labelKey: 'admin-filters.status.archived' },
      ],
    },
    {
      paramKey: 'type',
      labelKey: 'admin-filters.accommodationType.label',
      type: 'select',
      order: 2,
      options: [
        { value: 'APARTMENT', labelKey: 'admin-filters.accommodationType.apartment' },
        { value: 'HOUSE', labelKey: 'admin-filters.accommodationType.house' },
        { value: 'COUNTRY_HOUSE', labelKey: 'admin-filters.accommodationType.countryHouse' },
        { value: 'CABIN', labelKey: 'admin-filters.accommodationType.cabin' },
        { value: 'HOTEL', labelKey: 'admin-filters.accommodationType.hotel' },
        { value: 'HOSTEL', labelKey: 'admin-filters.accommodationType.hostel' },
        { value: 'CAMPING', labelKey: 'admin-filters.accommodationType.camping' },
        { value: 'ROOM', labelKey: 'admin-filters.accommodationType.room' },
        { value: 'MOTEL', labelKey: 'admin-filters.accommodationType.motel' },
        { value: 'RESORT', labelKey: 'admin-filters.accommodationType.resort' },
      ],
    },
    {
      paramKey: 'isFeatured',
      labelKey: 'admin-filters.isFeatured.label',
      type: 'boolean',
      order: 3,
    },
    {
      paramKey: 'includeDeleted',
      labelKey: 'admin-filters.includeDeleted.label',
      type: 'boolean',
      order: 99,
    },
  ],
},
```

### 8.3 Events

```typescript
// apps/admin/src/features/events/config/events.config.ts
filterBarConfig: {
  filters: [
    {
      paramKey: 'status',
      labelKey: 'admin-filters.status.label',
      type: 'select',
      order: 1,
      options: [
        { value: 'DRAFT', labelKey: 'admin-filters.status.draft' },
        { value: 'ACTIVE', labelKey: 'admin-filters.status.active' },
        { value: 'ARCHIVED', labelKey: 'admin-filters.status.archived' },
      ],
    },
    {
      paramKey: 'category',
      labelKey: 'admin-filters.eventCategory.label',
      type: 'select',
      order: 2,
      options: [
        { value: 'MUSIC', labelKey: 'admin-filters.eventCategory.music' },
        { value: 'CULTURE', labelKey: 'admin-filters.eventCategory.culture' },
        { value: 'SPORTS', labelKey: 'admin-filters.eventCategory.sports' },
        { value: 'GASTRONOMY', labelKey: 'admin-filters.eventCategory.gastronomy' },
        { value: 'FESTIVAL', labelKey: 'admin-filters.eventCategory.festival' },
        { value: 'NATURE', labelKey: 'admin-filters.eventCategory.nature' },
        { value: 'THEATER', labelKey: 'admin-filters.eventCategory.theater' },
        { value: 'WORKSHOP', labelKey: 'admin-filters.eventCategory.workshop' },
        { value: 'OTHER', labelKey: 'admin-filters.eventCategory.other' },
      ],
    },
    {
      paramKey: 'isFeatured',
      labelKey: 'admin-filters.isFeatured.label',
      type: 'boolean',
      order: 3,
    },
    {
      paramKey: 'includeDeleted',
      labelKey: 'admin-filters.includeDeleted.label',
      type: 'boolean',
      order: 99,
    },
  ],
},
```

### 8.4 Posts

```typescript
// apps/admin/src/features/posts/config/posts.config.ts
filterBarConfig: {
  filters: [
    {
      paramKey: 'status',
      labelKey: 'admin-filters.status.label',
      type: 'select',
      order: 1,
      options: [
        { value: 'DRAFT', labelKey: 'admin-filters.status.draft' },
        { value: 'ACTIVE', labelKey: 'admin-filters.status.active' },
        { value: 'ARCHIVED', labelKey: 'admin-filters.status.archived' },
      ],
    },
    {
      paramKey: 'category',
      labelKey: 'admin-filters.postCategory.label',
      type: 'select',
      order: 2,
      options: [
        { value: 'EVENTS', labelKey: 'admin-filters.postCategory.events' },
        { value: 'CULTURE', labelKey: 'admin-filters.postCategory.culture' },
        { value: 'GASTRONOMY', labelKey: 'admin-filters.postCategory.gastronomy' },
        { value: 'NATURE', labelKey: 'admin-filters.postCategory.nature' },
        { value: 'TOURISM', labelKey: 'admin-filters.postCategory.tourism' },
        { value: 'GENERAL', labelKey: 'admin-filters.postCategory.general' },
        { value: 'SPORT', labelKey: 'admin-filters.postCategory.sport' },
        { value: 'CARNIVAL', labelKey: 'admin-filters.postCategory.carnival' },
        { value: 'NIGHTLIFE', labelKey: 'admin-filters.postCategory.nightlife' },
        { value: 'HISTORY', labelKey: 'admin-filters.postCategory.history' },
        { value: 'TRADITIONS', labelKey: 'admin-filters.postCategory.traditions' },
        { value: 'WELLNESS', labelKey: 'admin-filters.postCategory.wellness' },
        { value: 'FAMILY', labelKey: 'admin-filters.postCategory.family' },
        { value: 'TIPS', labelKey: 'admin-filters.postCategory.tips' },
        { value: 'ART', labelKey: 'admin-filters.postCategory.art' },
        { value: 'BEACH', labelKey: 'admin-filters.postCategory.beach' },
        { value: 'RURAL', labelKey: 'admin-filters.postCategory.rural' },
        { value: 'FESTIVALS', labelKey: 'admin-filters.postCategory.festivals' },
      ],
    },
    {
      paramKey: 'isFeatured',
      labelKey: 'admin-filters.isFeatured.label',
      type: 'boolean',
      order: 3,
    },
    {
      paramKey: 'isNews',
      labelKey: 'admin-filters.isNews.label',
      type: 'boolean',
      order: 4,
    },
    {
      paramKey: 'includeDeleted',
      labelKey: 'admin-filters.includeDeleted.label',
      type: 'boolean',
      order: 99,
    },
  ],
},
```

### 8.5 Users

```typescript
// apps/admin/src/features/users/config/users.config.ts
filterBarConfig: {
  filters: [
    {
      paramKey: 'role',
      labelKey: 'admin-filters.role.label',
      type: 'select',
      order: 1,
      options: [
        { value: 'SUPER_ADMIN', labelKey: 'admin-filters.role.superAdmin' },
        { value: 'ADMIN', labelKey: 'admin-filters.role.admin' },
        { value: 'CLIENT_MANAGER', labelKey: 'admin-filters.role.clientManager' },
        { value: 'EDITOR', labelKey: 'admin-filters.role.editor' },
        { value: 'HOST', labelKey: 'admin-filters.role.host' },
        { value: 'SPONSOR', labelKey: 'admin-filters.role.sponsor' },
        { value: 'USER', labelKey: 'admin-filters.role.user' },
        { value: 'GUEST', labelKey: 'admin-filters.role.guest' },
      ],
    },
    {
      paramKey: 'includeDeleted',
      labelKey: 'admin-filters.includeDeleted.label',
      type: 'boolean',
      order: 99,
    },
  ],
},
```

### 8.6 Entities WITHOUT filterBarConfig (no changes needed)

The following entities have no filterBarConfig and continue working exactly as before:

**Standard entities (can add filterBarConfig in future iterations):**

- Amenities, Attractions, Event Locations, Event Organizers, Features, Sponsors, Tags

**Entities with standard lifecycle filter (can add filterBarConfig in future iterations):**

- **OwnerPromotion**: Uses standard `lifecycleState` filter (DRAFT, ACTIVE, ARCHIVED). The old `isActive` boolean was removed by SPEC-063.
- **Sponsorship**: Uses standard `lifecycleState` filter PLUS a separate `sponsorshipStatus` dropdown (pending, active, expired, cancelled, lowercase).
- **DestinationReview**: Uses standard `lifecycleState` filter.

> **Current state of defaultFilters**: As of SPEC-049, only `destinations.config.ts` has `defaultFilters: { destinationType: 'CITY' }`. The other 4 entities being configured (Accommodations, Events, Posts, Users) do NOT have any `defaultFilters`. Adding `filterBarConfig` to them purely adds new UI capability without changing existing behavior.

## 9. i18n Keys

### 9.1 New Translation Namespace

Add a `filters` section to the admin i18n namespace. File: `packages/i18n/src/locales/{lang}/admin-filters.json` (new file per locale).

**English** (`en/admin-filters.json`):

```json
{
  "allOption": "All",
  "booleanYes": "Yes",
  "booleanNo": "No",
  "defaultBadge": "default",
  "clearAll": "Clear all",
  "resetDefaults": "Reset to defaults",
  "activeFilters": "Active filters",
  "noResults": "No results match the current filters",
  "status": {
    "label": "Status",
    "draft": "Draft",
    "active": "Active",
    "archived": "Archived"
  },
  "destinationType": {
    "label": "Destination type",
    "country": "Country",
    "region": "Region",
    "province": "Province",
    "department": "Department",
    "city": "City",
    "town": "Town",
    "neighborhood": "Neighborhood"
  },
  "accommodationType": {
    "label": "Type",
    "apartment": "Apartment",
    "house": "House",
    "countryHouse": "Country house",
    "cabin": "Cabin",
    "hotel": "Hotel",
    "hostel": "Hostel",
    "camping": "Camping",
    "room": "Room",
    "motel": "Motel",
    "resort": "Resort"
  },
  "eventCategory": {
    "label": "Category",
    "music": "Music",
    "culture": "Culture",
    "sports": "Sports",
    "gastronomy": "Gastronomy",
    "festival": "Festival",
    "nature": "Nature",
    "theater": "Theater",
    "workshop": "Workshop",
    "other": "Other"
  },
  "postCategory": {
    "label": "Category",
    "events": "Events",
    "culture": "Culture",
    "gastronomy": "Gastronomy",
    "nature": "Nature",
    "tourism": "Tourism",
    "general": "General",
    "sport": "Sport",
    "carnival": "Carnival",
    "nightlife": "Nightlife",
    "history": "History",
    "traditions": "Traditions",
    "wellness": "Wellness",
    "family": "Family",
    "tips": "Tips",
    "art": "Art",
    "beach": "Beach",
    "rural": "Rural",
    "festivals": "Festivals"
  },
  "role": {
    "label": "Role",
    "superAdmin": "Super Admin",
    "admin": "Admin",
    "clientManager": "Client Manager",
    "editor": "Editor",
    "host": "Host",
    "sponsor": "Sponsor",
    "user": "User",
    "guest": "Guest"
  },
  "isFeatured": {
    "label": "Featured"
  },
  "isNews": {
    "label": "News"
  },
  "includeDeleted": {
    "label": "Show deleted"
  }
}
```

**Spanish** (`es/admin-filters.json`):

```json
{
  "allOption": "Todos",
  "booleanYes": "Sí",
  "booleanNo": "No",
  "defaultBadge": "predeterminado",
  "clearAll": "Limpiar todo",
  "resetDefaults": "Restablecer predeterminados",
  "activeFilters": "Filtros activos",
  "noResults": "No hay resultados con los filtros actuales",
  "status": {
    "label": "Estado",
    "draft": "Borrador",
    "active": "Activo",
    "archived": "Archivado"
  },
  "destinationType": {
    "label": "Tipo de destino",
    "country": "País",
    "region": "Región",
    "province": "Provincia",
    "department": "Departamento",
    "city": "Ciudad",
    "town": "Pueblo",
    "neighborhood": "Barrio"
  },
  "accommodationType": {
    "label": "Tipo",
    "apartment": "Departamento",
    "house": "Casa",
    "countryHouse": "Casa de campo",
    "cabin": "Cabaña",
    "hotel": "Hotel",
    "hostel": "Hostel",
    "camping": "Camping",
    "room": "Habitación",
    "motel": "Motel",
    "resort": "Resort"
  },
  "eventCategory": {
    "label": "Categoría",
    "music": "Música",
    "culture": "Cultura",
    "sports": "Deportes",
    "gastronomy": "Gastronomía",
    "festival": "Festival",
    "nature": "Naturaleza",
    "theater": "Teatro",
    "workshop": "Taller",
    "other": "Otro"
  },
  "postCategory": {
    "label": "Categoría",
    "events": "Eventos",
    "culture": "Cultura",
    "gastronomy": "Gastronomía",
    "nature": "Naturaleza",
    "tourism": "Turismo",
    "general": "General",
    "sport": "Deporte",
    "carnival": "Carnaval",
    "nightlife": "Vida nocturna",
    "history": "Historia",
    "traditions": "Tradiciones",
    "wellness": "Bienestar",
    "family": "Familia",
    "tips": "Consejos",
    "art": "Arte",
    "beach": "Playa",
    "rural": "Rural",
    "festivals": "Festivales"
  },
  "role": {
    "label": "Rol",
    "superAdmin": "Super Admin",
    "admin": "Admin",
    "clientManager": "Gestor de clientes",
    "editor": "Editor",
    "host": "Anfitrión",
    "sponsor": "Patrocinador",
    "user": "Usuario",
    "guest": "Invitado"
  },
  "isFeatured": {
    "label": "Destacado"
  },
  "isNews": {
    "label": "Noticia"
  },
  "includeDeleted": {
    "label": "Mostrar eliminados"
  }
}
```

**Portuguese** (`pt/admin-filters.json`):

```json
{
  "allOption": "Todos",
  "booleanYes": "Sim",
  "booleanNo": "Não",
  "defaultBadge": "padrão",
  "clearAll": "Limpar tudo",
  "resetDefaults": "Restaurar padrões",
  "activeFilters": "Filtros ativos",
  "noResults": "Nenhum resultado com os filtros atuais",
  "status": {
    "label": "Estado",
    "draft": "Rascunho",
    "active": "Ativo",
    "archived": "Arquivado"
  },
  "destinationType": {
    "label": "Tipo de destino",
    "country": "País",
    "region": "Região",
    "province": "Província",
    "department": "Departamento",
    "city": "Cidade",
    "town": "Vila",
    "neighborhood": "Bairro"
  },
  "accommodationType": {
    "label": "Tipo",
    "apartment": "Apartamento",
    "house": "Casa",
    "countryHouse": "Casa de campo",
    "cabin": "Cabana",
    "hotel": "Hotel",
    "hostel": "Hostel",
    "camping": "Camping",
    "room": "Quarto",
    "motel": "Motel",
    "resort": "Resort"
  },
  "eventCategory": {
    "label": "Categoria",
    "music": "Música",
    "culture": "Cultura",
    "sports": "Esportes",
    "gastronomy": "Gastronomia",
    "festival": "Festival",
    "nature": "Natureza",
    "theater": "Teatro",
    "workshop": "Oficina",
    "other": "Outro"
  },
  "postCategory": {
    "label": "Categoria",
    "events": "Eventos",
    "culture": "Cultura",
    "gastronomy": "Gastronomia",
    "nature": "Natureza",
    "tourism": "Turismo",
    "general": "Geral",
    "sport": "Esporte",
    "carnival": "Carnaval",
    "nightlife": "Vida noturna",
    "history": "História",
    "traditions": "Tradições",
    "wellness": "Bem-estar",
    "family": "Família",
    "tips": "Dicas",
    "art": "Arte",
    "beach": "Praia",
    "rural": "Rural",
    "festivals": "Festivais"
  },
  "role": {
    "label": "Função",
    "superAdmin": "Super Admin",
    "admin": "Admin",
    "clientManager": "Gestor de clientes",
    "editor": "Editor",
    "host": "Anfitrião",
    "sponsor": "Patrocinador",
    "user": "Usuário",
    "guest": "Convidado"
  },
  "isFeatured": {
    "label": "Destaque"
  },
  "isNews": {
    "label": "Notícia"
  },
  "includeDeleted": {
    "label": "Mostrar excluídos"
  }
}
```

### 9.2 i18n Registration Steps

To register the new `admin-filters` namespace:

1. Create 3 JSON files:
   - `packages/i18n/src/locales/es/admin-filters.json`
   - `packages/i18n/src/locales/en/admin-filters.json`
   - `packages/i18n/src/locales/pt/admin-filters.json`

2. Add `'admin-filters'` to the `namespaces` array in `packages/i18n/src/config.ts`

3. Add static imports in `packages/i18n/src/config.ts`:

   ```typescript
   import adminFiltersEs from './locales/es/admin-filters.json';
   import adminFiltersEn from './locales/en/admin-filters.json';
   import adminFiltersPt from './locales/pt/admin-filters.json';
   ```

4. Add to `rawTranslations` object in `packages/i18n/src/config.ts`:

   ```typescript
   es: { 'admin-filters': adminFiltersEs, /* ... existing */ },
   en: { 'admin-filters': adminFiltersEn, /* ... existing */ },
   pt: { 'admin-filters': adminFiltersPt, /* ... existing */ },
   ```

5. Run `pnpm generate-types` to regenerate `TranslationKey` union type

6. (Optional) Install `@tanstack/zod-adapter` if using `zodValidator` for search param validation (see section 7.1 "Alternative" note). This is NOT required for the core functionality:

   ```bash
   pnpm add @tanstack/zod-adapter --filter admin
   ```

## 10. Accessibility Requirements

| Requirement | Implementation |
|-------------|---------------|
| **Keyboard navigation** | All filter controls (selects, toggles) must be keyboard-accessible via Tab/Enter/Space/Arrow keys. shadcn `Select` handles this natively. |
| **Screen reader labels** | Each `FilterSelect` trigger has `aria-label="{filterLabel}: {currentValue}"`. Each `FilterBoolean` has `aria-label="{filterLabel}: {Yes/No/All}"` |
| **Chip removal** | Each chip's X button has `aria-label="Remove filter {label}: {value}"` and is focusable |
| **Live region** | The `ActiveFilterChips` container has `aria-live="polite"` and `role="status"` so changes are announced |
| **Focus management** | After removing a filter chip, focus moves to the next chip, or to the "Clear all" button if no chips remain, or to the first filter control if no actions remain |
| **Color contrast** | Default badge uses sufficient contrast (WCAG AA). Do not rely solely on color to distinguish default vs user filters.. the "(default)" text label provides a non-color indicator |

## 11. Affected Files (Complete List)

### New Files

| File | Description |
|------|-------------|
| `apps/admin/src/components/entity-list/filters/FilterBar.tsx` | Main filter bar container |
| `apps/admin/src/components/entity-list/filters/FilterSelect.tsx` | Select dropdown filter |
| `apps/admin/src/components/entity-list/filters/FilterBoolean.tsx` | Boolean toggle filter |
| `apps/admin/src/components/entity-list/filters/ActiveFilterChips.tsx` | Active filter chips display |
| `apps/admin/src/components/entity-list/filters/FilterChip.tsx` | Individual removable chip |
| `apps/admin/src/components/entity-list/filters/FilterActions.tsx` | Clear all / Reset defaults buttons |
| `apps/admin/src/components/entity-list/filters/useFilterState.ts` | Filter state management hook |
| `apps/admin/src/components/entity-list/filters/filter-utils.ts` | Serialization and computation utilities |
| `apps/admin/src/components/entity-list/filters/index.ts` | Barrel exports |
| `packages/i18n/src/locales/en/admin-filters.json` | English filter translations |
| `packages/i18n/src/locales/es/admin-filters.json` | Spanish filter translations |
| `packages/i18n/src/locales/pt/admin-filters.json` | Portuguese filter translations |

### Modified Files

| File | Changes |
|------|---------|
| `apps/admin/src/components/entity-list/types.ts` | Add `filterBarConfig` property to `EntityConfig` (importing `FilterBarConfig` from `filters/filter-types.ts`). Add `filters` to `EntityListSearchParams`. |
| `apps/admin/src/components/entity-list/EntityListPage.tsx` | Add `filters` to `validateSearch`. Import and render `FilterBar`. Wire `useFilterState` hook. Pass `filters` to query params. |
| `apps/admin/src/components/entity-list/api/createEntityApi.ts` | Accept `filterBarConfig` param. Change filter application logic to support UI-managed filters vs legacy defaults. |
| `apps/admin/src/components/entity-list/index.ts` | Add filter exports |
| `apps/admin/src/features/destinations/config/destinations.config.ts` | Add `filterBarConfig` with destinationType, status, isFeatured filters. Keep `defaultFilters` for now (can be removed after migration verified). |
| `apps/admin/src/features/accommodations/config/accommodations.config.ts` | Add `filterBarConfig` with status, type, isFeatured filters |
| `apps/admin/src/features/events/config/events.config.ts` | Add `filterBarConfig` with status, category, isFeatured filters |
| `apps/admin/src/features/posts/config/posts.config.ts` | Add `filterBarConfig` with status, category, isFeatured, isNews filters |
| `apps/admin/src/features/users/config/users.config.ts` | Add `filterBarConfig` with role filter |
| `packages/i18n/src/config.ts` | Register `admin-filters` namespace, add imports, add to `rawTranslations` |
| `packages/i18n/src/types.ts` | Auto-regenerated by `pnpm generate-types` |
| `apps/admin/src/components/entity-list/EntityListPage.tsx` (createEntityApi call) | Single call-site migration from positional args to RO-RO object parameter (`createEntityApi({ endpoint, itemSchema, defaultFilters, filterBarConfig })`) |

### NOT Modified

| File | Reason |
|------|--------|
| `packages/service-core/` | No backend changes |
| `packages/schemas/` | No schema changes |
| `apps/admin/src/components/table/DataTableToolbar.tsx` | Unchanged.. filter bar is a separate component below the toolbar |
| `apps/admin/src/components/entity-list/hooks/useEntityQuery.ts` | Unchanged.. already receives params generically |

## 12. Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|------------------|
| Entity has `filterBarConfig` but all filters are future types (relation, date-range, etc.) | FilterBar renders empty (no controls). No error. No chips. |
| URL has filter params for a filter not in `filterBarConfig` | Ignored silently. Not passed to API, not shown as chip. |
| URL has invalid filter value (e.g., `status:INVALID_VALUE`) | Treated as the raw value. Passed to API (backend validates). No crash. Shown as chip with raw value. |
| User navigates to page with no URL params | Default filters from `filterBarConfig` apply. URL is NOT immediately updated with default values (no navigation loop). Defaults are computed in `useFilterState` from config, not from URL. |
| User bookmarks URL with `?status=ACTIVE&isFeatured=true` | On revisit, that exact filter state is restored from individual URL params. |
| Entity has both `defaultFilters` and `filterBarConfig` | `filterBarConfig` takes precedence. `defaultFilters` is ignored by `createEntityApi` when `filterBarConfig` is provided. |
| Entity has `defaultFilters` but NO `filterBarConfig` | Legacy behavior preserved. `defaultFilters` silently applied. No filter bar rendered. |
| User clears the only default filter | Chip bar shows empty. "Reset to defaults" button appears. API request has no filter for that key. |
| User clears all filters then navigates away and back | Filter params with `__cleared__` sentinel remain in URL during the session. On full page reload or fresh navigation (no sentinel in URL), defaults re-apply. This is intentional: "clear all" persists within the browsing session via URL state, but defaults are the starting point for fresh visits. |
| Filter value contains special characters | Each filter is its own URL param. TanStack Router handles URL encoding natively. No custom encoding needed. |
| URL has unknown params not in filterBarConfig | `extractActiveFilters` only reads params matching `filterBarConfig.filters[].paramKey`. Unknown params are ignored. No crash. |
| `FilterControlConfig` of `type: 'select'` has empty or undefined `options` | `FilterSelect` renders only the "All" option. In development mode, log a console warning: `[FilterBar] Select filter "${paramKey}" has no options configured`. No crash in production. |
| User manually types `__cleared__` as a filter value in URL | Treated as the sentinel.. the filter is considered explicitly cleared. This is by design and harmless (no data leaks, just means "no filter"). |
| Filtered query returns zero results | `EntityListPage` shows its existing empty state. Additionally, when `hasActiveFilters` is true and results are empty, show a contextual message using `t('admin-filters.noResults' as TranslationKey)` ("No results match the current filters") alongside the "Clear all" / "Reset to defaults" actions to guide the user. |

## 13. Test Plan

### 13.1 Unit Tests: filter-utils.ts

| Test | Input | Expected |
|------|-------|----------|
| `extractActiveFilters` with no URL params and no defaults | Empty searchParams, config with no defaults | `{}` |
| `extractActiveFilters` with no URL params and config defaults | Empty searchParams, config with `defaultValue: 'CITY'` | `{ destinationType: 'CITY' }` |
| `extractActiveFilters` with URL param overriding default | `{ destinationType: 'TOWN' }`, config with `defaultValue: 'CITY'` | `{ destinationType: 'TOWN' }` |
| `extractActiveFilters` with sentinel clears default | `{ destinationType: '__cleared__' }`, config with `defaultValue: 'CITY'` | `{}` |
| `extractActiveFilters` ignores params not in config | `{ unknownParam: 'value' }` | `{}` |
| `extractActiveFilters` handles multiple filters | `{ status: 'ACTIVE', isFeatured: 'true' }` | `{ status: 'ACTIVE', isFeatured: 'true' }` |
| `computeDefaultFilters` with no config | `undefined` | `{}` |
| `computeDefaultFilters` extracts defaults | Config with 1 default out of 3 filters | Only that 1 key in result |
| `filtersEqual` with identical objects | Same keys/values | `true` |
| `filtersEqual` with different values | Same keys, different values | `false` |
| `filtersEqual` with different keys | Different keys | `false` |
| `filtersEqual` with empty objects | Both `{}` | `true` |
| `buildFilterChips` marks default-origin chips | Active filter matches defaultValue | `isDefault: true` |
| `buildFilterChips` marks user-applied chips | Active filter differs from defaultValue | `isDefault: false` |
| `buildFilterChips` sorts by order | Filters with different order values | Sorted ascending |
| `buildFilterChips` skips unknown filters | Active filter not in config | Not included in chips |
| `buildFilterParamUpdate` sets value | `{ paramKey: 'status', value: 'ACTIVE', hasDefault: false }` | `{ status: 'ACTIVE' }` |
| `buildFilterParamUpdate` clears with sentinel when has default | `{ paramKey: 'destinationType', value: undefined, hasDefault: true }` | `{ destinationType: '__cleared__' }` |
| `buildFilterParamUpdate` removes when no default | `{ paramKey: 'status', value: undefined, hasDefault: false }` | `{ status: undefined }` |

### 13.2 Unit Tests: useFilterState hook

Use `renderHook` from `@testing-library/react`.

| Test | Setup | Expected |
|------|-------|----------|
| Returns defaults when no URL filters | `searchFilters: undefined`, config with defaults | `activeFilters` matches defaults |
| Returns URL filters when present | `searchParams: { status: 'ACTIVE' }` | `activeFilters: { status: 'ACTIVE' }` |
| Returns empty when all defaults cleared | `searchParams: { destinationType: '__cleared__' }`, config with default | `activeFilters: {}`, `hasActiveFilters: false` |
| `handleFilterChange` adds filter | Call with `('status', 'ACTIVE')` | `onUpdateSearch` called with serialized filters and `page: 1` |
| `handleFilterChange` removes filter | Call with `('status', undefined)` | `onUpdateSearch` called without that key |
| `handleClearAll` clears everything | Call `handleClearAll()` | `onUpdateSearch` called with sentinel values for defaults and undefined for non-defaults, plus `page: 1` |
| `handleResetDefaults` restores defaults | After clearing, call `handleResetDefaults()` | `onUpdateSearch` called with default values for each filter, plus `page: 1` |
| `hasActiveFilters` is true when filters exist | Any non-empty active filters | `true` |
| `hasActiveFilters` is false when empty | No active filters (cleared) | `false` |
| `hasNonDefaultFilters` is true when user changed | Active differs from defaults | `true` |
| `hasNonDefaultFilters` is false when at defaults | Active matches defaults | `false` |

### 13.3 Component Tests: FilterBar

| Test | Action | Expected |
|------|--------|----------|
| Renders select filters from config | Config with 2 select filters | 2 Select triggers visible |
| Renders boolean filters from config | Config with 1 boolean filter | 1 Select trigger with Yes/No/All |
| Skips unknown filter types | Config with `type: 'relation'` | No crash, no render for that filter |
| Shows chips when filters active | `activeFilters: { status: 'ACTIVE' }` | 1 chip visible |
| Chip shows "(default)" badge | `isDefault: true` chip | Badge text contains "default" |
| Chip click removes filter | Click X on chip | `onFilterChange` called with `(key, undefined)` |
| "Clear all" visible when filters active | `hasActiveFilters: true` | Button visible |
| "Clear all" hidden when no filters | `hasActiveFilters: false` | Button not in DOM |
| "Reset to defaults" visible when non-default | `hasNonDefaultFilters: true` | Button visible |
| Sort order respected | Filters with different `order` | Rendered in order sequence |

### 13.4 Component Tests: FilterSelect

| Test | Action | Expected |
|------|--------|----------|
| Shows label when no value | `value: undefined` | Trigger shows translated label |
| Shows selected value | `value: 'ACTIVE'` | Trigger shows translated "Active" |
| "All" option clears filter | Select "All" | `onChange(undefined)` called |
| Selecting value sets filter | Select "Draft" | `onChange('DRAFT')` called |
| All options from config rendered | Config with 3 options | 3 + "All" = 4 items in dropdown |

### 13.5 Component Tests: FilterBoolean

| Test | Action | Expected |
|------|--------|----------|
| Shows label when no value | `value: undefined` | Trigger shows filter label |
| Shows "Yes" when true | `value: 'true'` | Trigger shows "Yes" |
| Shows "No" when false | `value: 'false'` | Trigger shows "No" |
| All option clears | Select "All" | `onChange(undefined)` |
| Yes option sets true | Select "Yes" | `onChange('true')` |
| No option sets false | Select "No" | `onChange('false')` |

### 13.6 Integration Tests: EntityListPage with FilterBar

| Test | Action | Expected |
|------|--------|----------|
| FilterBar renders when config present | Entity with `filterBarConfig` | FilterBar in DOM |
| FilterBar absent when no config | Entity without `filterBarConfig` | No FilterBar in DOM |
| Selecting filter updates URL | Click status dropdown, select "Active" | URL contains `status=ACTIVE` as individual param |
| URL filter state restores on mount | Navigate with `?status=ACTIVE` | Status select shows "Active", chip visible |
| Filter change resets page to 1 | On page 3, change a filter | URL `page=1` |
| Default filters applied on first visit | Destinations page, no URL params | `destinationType=CITY` chip visible with "(default)" badge |
| Clear default filter sends unfiltered request | Clear destinationType chip | API request has no `destinationType` param |
| Legacy entities unaffected | Entity with only `defaultFilters`, no `filterBarConfig` | No FilterBar, defaults still silently applied |

### 13.7 Accessibility Tests

| Test | Expected |
|------|----------|
| All filter controls reachable via Tab | Keyboard navigation works through all selects and toggles |
| Chip removal via keyboard | Focus on X, press Enter → filter removed |
| Screen reader announces chip changes | `aria-live="polite"` container updates announced |
| Chip X button has descriptive `aria-label` | `"Remove filter Status: Active"` |

## 14. Implementation Order

The recommended implementation sequence (each step builds on the previous):

| Step | Files | Description | Blocked by |
|------|-------|-------------|------------|
| 1 | `filter-types.ts`, `types.ts` | Add all new types (`FilterControlConfig`, `FilterBarConfig`, `ActiveFilters`, `FilterChipData`) to `filter-types.ts`. Add `filterBarConfig` property to `EntityConfig` in `types.ts`. | Nothing |
| 2 | `filter-utils.ts` + tests | Serialization, deserialization, defaults computation, chip building | Step 1 |
| 3 | `useFilterState.ts` + tests | Hook for filter state management | Steps 1, 2 |
| 4 | `FilterChip.tsx` | Individual chip component | Step 1 |
| 5 | `ActiveFilterChips.tsx` | Chip container component | Step 4 |
| 6 | `FilterSelect.tsx` + tests | Select dropdown filter control | Step 1 |
| 7 | `FilterBoolean.tsx` + tests | Boolean toggle filter control | Step 1 |
| 8 | `FilterActions.tsx` | Clear all / Reset defaults buttons | Step 1 |
| 9 | `FilterBar.tsx` + tests | Main container assembling all sub-components | Steps 5, 6, 7, 8 |
| 10 | `index.ts` | Barrel exports | Step 9 |
| 11 | `createEntityApi.ts` | Add `filterBarConfig`-based filter logic | Nothing |
| 12 | `EntityListPage.tsx` | Integrate FilterBar, extend validateSearch, wire filters to query | Steps 3, 9, 11 |
| 13 | i18n files (en, es, pt) | Add admin-filters translations | Nothing |
| 14 | Entity configs (destinations, accommodations, events, posts, users) | Add `filterBarConfig` to each | Steps 1, 13 |
| 15 | Integration tests | Full E2E filter flow tests | Steps 12, 14 |

## 15. Acceptance Criteria (Comprehensive)

### Functional

- [ ] FilterBar renders between DataTableToolbar and DataTable when entity has `filterBarConfig`
- [ ] FilterBar does NOT render when entity has no `filterBarConfig`
- [ ] Select filters show all options from config plus "All" option
- [ ] Boolean filters show "All" / "Yes" / "No" options
- [ ] Selecting a filter value updates the URL search params
- [ ] Filter state persists across page navigation (URL-backed)
- [ ] Bookmarking a URL with filters restores the exact filter state
- [ ] Active filters show as removable chips below the filter controls
- [ ] Default-origin filter chips show a "(default)" badge
- [ ] User-applied filter chips do NOT show the "(default)" badge
- [ ] Clicking the X on a chip removes that filter
- [ ] "Clear all" button removes ALL active filters (including defaults)
- [ ] "Reset to defaults" button restores default filter values
- [ ] "Clear all" is visible only when any filter is active
- [ ] "Reset to defaults" is visible only when state differs from defaults
- [ ] Changing any filter resets pagination to page 1
- [ ] Destinations page shows `destinationType: City (default)` chip on first visit
- [ ] Clearing the destinationType default on destinations results in unfiltered API request
- [ ] Entities without `filterBarConfig` but with `defaultFilters` preserve legacy behavior
- [ ] Unknown filter types in config are silently skipped (no crash)

### i18n

- [ ] All filter labels, option labels, and UI strings use i18n keys
- [ ] Translations exist for all 3 locales (en, es, pt)
- [ ] Filter chips show translated values (not raw enum values)

### Accessibility

- [ ] All filter controls are keyboard-navigable (Tab, Enter, Space, Arrow keys)
- [ ] Chip removal works via keyboard (Enter/Space on X button)
- [ ] Screen readers announce filter changes (aria-live region)
- [ ] All interactive elements have descriptive aria-labels
- [ ] Color is not the sole indicator for default vs user filters (text badge provided)

### Performance

- [ ] No unnecessary re-renders when filter state hasn't changed
- [ ] Filter serialization/deserialization is memoized
- [ ] FilterBar components use React.memo where appropriate

### Testing

- [ ] filter-utils.ts has 100% line coverage
- [ ] useFilterState hook has >= 90% line coverage
- [ ] Each filter component (FilterSelect, FilterBoolean, FilterChip) has component tests
- [ ] FilterBar has component tests for rendering and interactions
- [ ] Integration test verifies URL persistence round-trip
- [ ] Integration test verifies default filter indicator on destinations

## 16. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Filter param names collide with future base params | Very Low | Medium | Verified no collision with current params (`page`, `pageSize`, `q`, `sort`, `view`, `cols`). Filter param names come from backend admin search schemas which use domain-specific names (e.g., `destinationType`, `isFeatured`). Future base params should avoid these names. |
| TanStack Router `validateSearch` type inference breaks with new param | Low | High | The existing `as const` pattern and `DynamicNavigateOptions` cast already handle dynamic types. Test early. |
| shadcn Select component behavior differs across versions | Low | Low | Pin shadcn/ui version. Use standard Select pattern from docs. |
| Performance regression with many filter controls | Very Low | Low | Only 3-4 filters per entity in practice. React.memo on components. |
| ~~SPEC-050~~ SPEC-063 changes status filter behavior | Low | Low | SPEC-063 standardized all entities to use `lifecycleState` with `LifecycleStatusEnum`. The 3 previously non-standard entities (OwnerPromotion, Sponsorship, DestinationReview) now use the same standard lifecycle filter as all other entities. No special handling needed. |
| i18n keys missing for some enum values | Medium | Low | Audit all enum values against i18n files during implementation. Missing keys fall back to raw value (no crash). |

## 17. Notes for Cross-Spec Coordination

### 17.1 ~~SPEC-050~~ SPEC-063 (Lifecycle State Standardization)

SPEC-050 (Lifecycle State Modeling) has been **deleted** and superseded by **SPEC-063** (Lifecycle State Standardization). SPEC-050 proposed a configurable `statusField` property to handle entities with non-standard status columns. SPEC-063 instead standardized ALL entities to use `lifecycleState: LifecycleStatusEnum`, making `statusField` unnecessary.

After SPEC-063, the 3 previously non-standard entities now use standard lifecycle state and can be included in the filter configuration rollout without waiting:

- **OwnerPromotion**: Has `lifecycleState` with `LifecycleStatusEnum` values (DRAFT, ACTIVE, ARCHIVED). The old `isActive` boolean was removed. Uses the same standard lifecycle status filter template as all other entities.
- **Sponsorship**: Has `lifecycleState` (standard lifecycle filter) AND `sponsorshipStatus` (domain-specific enum with lowercase values: `pending`, `active`, `expired`, `cancelled`). The old `status` column was renamed to `sponsorshipStatus`. Filter config should include both: a standard lifecycle status select AND a separate `sponsorshipStatus` select with `SponsorshipStatusEnum` values.
- **DestinationReview**: Has `lifecycleState` with `LifecycleStatusEnum` values. Uses the same standard lifecycle status filter template as all other entities.

> **No longer excluded**: These 3 entities can now use the standard `lifecycleState` filter (same as Destinations, Accommodations, Events, Posts, Users). They can be added to the filter configuration rollout at any time without additional coordination.

### 17.2 SPEC-052 (Type-Safe Entity Filters)

SPEC-052 introduces `EntityFilters<TSchema>` utility type in the backend. This spec's frontend `FilterControlConfig.paramKey` values are plain strings. Once SPEC-052 is implemented, a future enhancement could derive `paramKey` options from `EntityFilters<TSchema>` keys for additional compile-time safety. No conflict or coordination needed for initial implementation.

### 17.3 SPEC-057 (Response Schema Consistency)

SPEC-057 standardizes admin list response schemas. This spec's `createEntityApi` is schema-agnostic (receives `itemSchema` from entity config). If SPEC-057 changes which schema variant is correct, only the entity config files need updating.. no impact on the filter bar infrastructure.
