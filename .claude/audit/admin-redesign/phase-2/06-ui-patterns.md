---
audit: ui-patterns
status: complete
date: 2026-05-21
agent: Explore
---

# Admin UI Patterns Audit

## Executive Summary

The Hospeda admin panel demonstrates **excellent component reuse** in its architecture layer (factory patterns, consolidated configs, error boundaries) but exhibits **moderate inconsistency at the feature/config level**. All 16 CRUD areas use the same underlying DataTable component and filter system, yet each entity defines its own pagination defaults, search debounce timings, and grid column layouts. No bulk operations are currently implemented in any CRUD area despite the infrastructure being ready. The **worst inconsistency** is variation in pagination defaults (10–50 rows) across entities without clear justification.

## 1. Data Tables: Consistency ✓✓

**Finding: Excellent consistency**

All 16 CRUD areas use the same `DataTable` component from `@/components/table/DataTable.tsx`. This provides:
- Unified sorting UI (▲/▼ indicators in header, clickable to cycle: none → asc → desc)
- Consistent column definitions via `DataTableColumn<TData>` type
- Shared pagination model (page index, page size, row count)
- Column visibility toggle via `columnVisibility` state
- Support for 14 column types (STRING, NUMBER, BADGE, ENTITY, PRICE, COMPOUND, IMAGE, GALLERY, etc.)
- Horizontal scrolling on mobile with min-w-max forced layout

**Inventory:**
- Accommodations: 6 columns (name, type, status, featured, created, actions)
- Destinations: 5 columns (name, type, status, featured, actions)
- Posts: 7 columns (title, category, status, featured, created, views, actions)
- Events: 6 columns
- Users: 6 columns (email, role, status, created, last login, actions)
- Sponsors: 5 columns
- Tags, Features, Amenities, Attractions: similar pattern

All tables render `<EmptyState message={t('ui.errors.noRecordsFound')} />` when data.length === 0. All show plain text "Loading..." during load (`loading ? 'Loading text' : data`).

---

## 2. Filters: Mostly Consistent, Minor Variations

**Finding: Good consistency with small customization**

All lists share the same `FilterBar` component and `useFilterState` hook. All filter configs define:
- `paramKey` (URL param name)
- `labelKey` (i18n translation key)
- `type` ('select' | 'boolean')
- `order` (sort order in UI)
- `options` (for select filters, with value + labelKey)
- `defaultValue` (optional, e.g., Destinations defaults to 'CITY')

**Shared Filter Pattern:**
- **Status**: ALL entities have it (DRAFT, ACTIVE, ARCHIVED). Order: 1–2.
- **includeDeleted**: ALL entities have it. Order: 99 (always last).
- **isFeatured**: Most entities have it (Accommodations, Destinations, Posts). Boolean toggle.

**Entity-Specific Filters:**
| Entity | Custom Filters | Notes |
|--------|---|---|
| Accommodations | type (APARTMENT, HOUSE, ...) | 10 options, order 2 |
| Destinations | destinationType (CITY, REGION, ...) | 7 options, *has defaultValue: 'CITY'*, order 1 |
| Posts | category (EVENTS, CULTURE, ...), isNews | 18 category options, order 2–4 |
| Events | category (MUSIC, CULTURE, ...) | 7 options, order 2 |
| Users | role (SUPER_ADMIN, ADMIN, ...) | 8 roles, order 1 |
| Sponsors | *No custom filters* | Only status + includeDeleted |

**Filter UI Implementation:**
- Controls row: flex-wrap, gap-2
- Chips row: rendered below controls when filters are active
- Clear all / Reset defaults buttons in FilterActions
- All use i18n keys; no hardcoded labels

**Inconsistency Found:**
- **Search minChars varies**: Accommodations (3), Posts (3), Destinations (5), Sponsors (2). No documented rationale.
- **Debounce timing varies**: Posts (400ms), Accommodations (400ms), Destinations (500ms), Sponsors (300ms). Ranges from 300–500ms without explanation.

---

## 3. Bulk Actions: Infrastructure Ready, Not Used

**Finding: Bulk operations component exists but is unused**

Component available: `BulkOperationsToolbar` from `@/components/entity-list/BulkOperationsToolbar.tsx`
- `<SelectionCheckbox>` for row-level selection
- `<SelectAllCheckbox>` for header select-all with indeterminate state
- Toolbar shows: "X items selected", update/delete action buttons, clear/exit select mode
- Integrates with `BulkOperationFeedback` component for optimistic UI feedback

**Current Usage: NONE**
- No entity list page calls `BulkOperationsToolbar`
- No selection checkboxes in any table
- No bulk delete/update workflows implemented
- Feature is present but dormant

---

## 4. Empty States: Consistent Pattern ✓

**Component:** `EmptyState` from `@/components/feedback/EmptyState.tsx`

**Props:**
- `messageKey` (i18n key, preferred) or `message` (direct string)
- `icon` (optional ReactNode)
- `action` (optional CTA button)
- `className` (styling override)

**Usage Pattern (All 16 CRUDs):**
```tsx
<EmptyState message={t('ui.errors.noRecordsFound')} />
```

**Finding: Minimal, text-only**
- Styled as: rounded border, dashed border style, centered flex layout
- Message color: muted-foreground (gray)
- Fallback text if no messageKey: `'admin-common.emptyState.noData'`
- **No illustrations or CTAs currently used** (component supports both)

---

## 5. Loading States: Inconsistent Implementation

**Finding: Three different patterns**

### Pattern A: DataTable inline loading (8 tables)
```tsx
{loading ? (
    <tr><td colSpan={columns.length}>{t('ui.loading.text')}</td></tr>
) : data.length === 0 ? (
    <EmptyState />
) : (
    // rows
)}
```
Uses plain text "Loading..." in a table cell.

### Pattern B: Page-level skeleton (lazy loaded routes)
`PageSkeleton`, `EntityListSkeleton`, `EntityFormSkeleton` from `/loading/PageSkeleton.tsx`
- Renders animated gray box placeholders
- Simulates table structure (header + 8 row skeletons)
- Used with Suspense + lazy route loading

### Pattern C: Spinner (used in entity detail loads)
`LoaderIcon` (spinning SVG) from `@repo/icons` with spinner animation

**Inconsistency:**
- Table lists use text ("Loading...")
- Page skeletons use animated placeholders
- Detail pages use spinners
- No unified loading state component across all patterns

---

## 6. Error States: Solid Error Boundary Pattern ✓

**Component:** `EntityErrorBoundary` from `@/components/error-boundaries/EntityErrorBoundary.tsx`

**Features:**
- Catches React render errors (not network errors)
- Shows entity-specific error messages (404, 403, network, validation)
- Retry button (max 3 attempts) with attempt counter
- Go back button
- Optional error details (stack trace) if `showDetails={true}`
- Error reporting via `reportComponentError()`
- Fallback UI support

**Current Coverage:**
- Wraps entity detail/edit pages (optional via `EntityPageBase`)
- Does NOT wrap list pages
- Does NOT handle API/network errors at list level (only renders empty state if no data)

**Finding: Good for view/edit, incomplete for list errors**
- A fetch failure on the list page is silent (no error UI, just empty list)
- Network errors not distinguished from "no results"

---

## 7. Detail View Layout: Consistent Pattern ✓✓

All entity detail pages follow the same `EntityPageBase` structure:

### Layer 1: Top Header
- Page title (e.g., "Edit Accommodation #123")
- Save/Cancel buttons (edit mode)

### Layer 2: Breadcrumbs
- Static breadcrumb trail (e.g., "Admin > Accommodations > #123")

### Layer 3: Tabs (if multiple sections defined)
- Rendered by `EntityPageBase` from viewSections config
- Examples: General, Images, Metadata, Contact, etc.

### Layer 4: Main Content + Sidebar
- Main: Form sections (edit) or view sections (view)
- Sidebar: Status, metadata, dates, quick actions (configurable per entity)

**Configuration Source:**
- Each entity defines `viewSections` and `editSections` via consolidated config
- Example: `features/accommodations/config/sections/basic-info.consolidated.ts`
- Sections are either static or functions returning `SectionConfig`

**Consistency Finding: EXCELLENT**
- All entities follow the same wrapper and layout structure
- CSS grid: `grid-cols-1 lg:grid-cols-3` (main + sidebar)
- Spacing, padding, typography all aligned

---

## 8. Edit Form Pages: Consolidated Config Pattern ✓✓

**Finding: Strong reuse, single source of truth**

### The Pattern:
1. Entity defines consolidated config in `features/<entity>/config/sections/basic-info.consolidated.ts`:
   ```ts
   export function createConsolidatedConfig() {
       return {
           sections: [
               { id: 'basic-info', title: '...', mode: ['create', 'edit', 'view'], fields: [...] },
               { id: 'images', title: '...', mode: ['create', 'edit'], fields: [...] },
               // ...
           ],
           metadata: { entityName: '...', entityNamePlural: '...' },
       };
   }
   ```

2. Create page imports this config and wraps it in `EntityCreateContent`:
   ```tsx
   <EntityCreateContent
       config={{ entityType: '...', title: 'Create...', ... }}
       createConsolidatedConfig={createConsolidatedConfig}
       createMutation={createMutation}
       onNavigate={(path) => navigate({ to: path })}
   />
   ```

3. Edit page uses `EntityPageBase` with the same consolidated config

### Coverage:
- ✓ Accommodations, Destinations, Posts, Events, Users, Sponsors
- ✓ All nested entities (Event Locations, Event Organizers, Tags)
- ✓ Content entities (Features, Amenities, Attractions)

**Inconsistency: NONE**
- All create/edit pages use the same `EntityCreateContent` wrapper
- No duplication of form navigation/error handling logic
- Single config file per entity governs all three modes (create, edit, view)

---

## 9. Pagination: Most Inconsistent Setting

**Finding: No documented rationale for defaults**

| Entity | Default Page Size | Allowed Sizes |
|--------|---|---|
| Accommodations | 20 | [10, 20, 30, 50] |
| Destinations | 10 | [10, 20, 30, 50] |
| Posts | 15 | [10, 15, 30, 50] |
| Events | (inherits default 10) | [10, 20, 30, 50] |
| Users | (inherits default 10) | [10, 20, 30, 50] |
| Sponsors | 25 | [10, 25, 50, 100] |
| Tags | (inherits default 10) | [10, 20, 30, 50] |

**Inconsistency:**
- Sponsors allows 100 rows per page; all others max at 50
- Accommodations defaults to 20; Destinations defaults to 10 (same domain, different choices)
- Posts defaults to 15 (unique value not found elsewhere)
- No comments explaining why each entity chose its values

**WORST INCONSISTENCY IDENTIFIED:**
Users and Events both use "inherit defaults" (10 rows) but do NOT declare `paginationConfig`, making their choices invisible in code. New developers cannot discover why Events uses 10 without digging into defaults in `EntityListPage`.

---

## 10. View Toggle (Table/Grid): Standardized

All entities support both table and grid view (except Sponsors and some content entities which have `allowViewToggle: false`):

```tsx
viewConfig: {
    defaultView: 'table',
    allowViewToggle: true,
    gridConfig: {
        maxFields: 12,
        columns: { mobile: 1, tablet: 2, desktop: 3 }
    }
}
```

Grid layout uses consistent responsive breakpoints and spacing. Grid column counts vary (8–12 fields) but are reasonable per entity complexity.

---

## 11. Column Visibility: Supported but Unused

`DataTable` supports column visibility state management via `columnVisibility` prop and `onColumnVisibilityChange` callback. **NO entity currently implements a column picker UI**. The infrastructure is ready; UI is missing.

---

## 12. Search: Consistent Pattern, Minor Timing Variations

All lists use the same `<SearchInput>` inside `FilterBar`. Debounce and minChars vary slightly (documented in section 2), but the pattern is consistent:
- Params: `?search=<query>`
- Filters combined with search (AND logic)
- Placeholder text generated from entity name
- "Clear search" chip shown when active

---

## Detailed Findings Summary

### Strong Points ✓✓
1. **Shared DataTable component** ensures sort, pagination, column typing are unified
2. **Factory pattern** (createEntityListPage) eliminates page-level boilerplate
3. **Consolidated configs** force create/edit/view to share one definition
4. **Error boundary** provides entity-specific error messages
5. **Filter Bar** component is reusable; all entities use it
6. **EmptyState** component used consistently
7. **Detail page layout** (header + tabs + sidebar) is identical across all entities

### Weak Points (Inconsistencies) ⚠️
1. **Pagination defaults** vary without documented justification (10, 15, 20, 25 rows)
2. **Search config** (minChars, debounceMs) varies: 2–5 chars, 300–500ms (no pattern)
3. **Loading states** use three different UX patterns (text, skeleton, spinner)
4. **Bulk operations** infrastructure exists but is completely unused
5. **Column visibility picker** UI is missing (state management is ready)
6. **List-level error handling** is silent (no error UI if fetch fails)
7. **Grid maxFields** and column counts vary (8–12 fields) without clear rationale

### Unused Patterns
- `BulkOperationsToolbar`, `SelectionCheckbox`, `SelectAllCheckbox` (ready, not integrated)
- Column visibility picker UI (state supported, no UI)
- Illustration/CTA in empty states (component supports, never used)

---

## Recommendations

### Priority 1: Justify and Document Pagination
Create a `PAGINATION_STRATEGY.md` file explaining:
- Why Sponsors can show 100 rows but others max at 50
- Why Posts defaults to 15 (unique value)
- Whether defaults should follow entity size/complexity heuristic

### Priority 2: Unify Loading States
Choose one pattern (likely skeleton + spinner combo) and apply consistently:
- Lists should use animated skeletons (already coded in PageSkeleton)
- Detail pages already use spinners correctly
- Avoid plain "Loading..." text in tables

### Priority 3: Add List-Level Error Boundaries
Wrap list pages with a boundary that handles network errors (not just render errors). Show an error card instead of empty state if the fetch failed.

### Priority 4: Implement Bulk Operations
- Add checkbox column to DataTable when in "select mode"
- Integrate BulkOperationsToolbar into EntityListPage
- Implement bulk delete/archive/change-status workflows
- Test checkbox behavior on table/grid views

### Priority 5: Add Column Visibility Picker
Wire up the columnVisibility state management to a UI control (e.g., settings icon → popover with checkboxes).

---

## Metrics

- **Total CRUD areas:** 16 (Accommodations, Destinations, Events, Posts, Users, Sponsors, Tags, Features, Amenities, Attractions, Event Locations, Event Organizers, Conversations, Billing, Content, Newsletter)
- **Shared components:** DataTable, FilterBar, EmptyState, EntityPageBase, EntityCreateContent, EntityErrorBoundary
- **Config duplication:** 0 (all use factory + consolidated pattern)
- **Unused component sets:** 1 (bulk operations toolbar + checkboxes)
- **Inconsistent settings:** Pagination (4 different defaults), Search config (2 dimensions), Grid layouts (4 variants)
- **Error handling coverage:** 100% for render errors (boundary), ~20% for API errors (list pages)

---

## Conclusion

The Hospeda admin codebase has **excellent architectural consistency** (components, factories, configs) but **moderate UX/feature-level inconsistency** (pagination, search timing, loading states, missing features). The codebase is well-positioned for consolidation: the gaps are mostly about configuration standardization and UI completion, not refactoring architecture.

Most inconsistencies are cosmetic and would be caught by a design system audit or feature checklist. The worst is pagination defaults varying without documentation—fixing this requires 2 hours of decision-making and 1 hour of implementation.
