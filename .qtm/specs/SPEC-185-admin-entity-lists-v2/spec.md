---
specId: SPEC-185
title: Admin Entity Lists v2 — filters, grid cards, host portfolio & tags migration
slug: admin-entity-lists-v2
type: feature
status: completed
complexity: high
owner: qazuor
created: 2026-06-02
base: staging
branch: spec/SPEC-185-admin-entity-lists-v2
worktree: /home/qazuor/projects/WEBS/hospeda-spec-185-admin-entity-lists-v2
linearIssues:
  - BETA-75
  - BETA-72
  - BETA-76
tags:
  - admin
  - entity-list
  - filters
  - grid
  - host
  - tags
  - refactor
---

# SPEC-185 — Admin Entity Lists v2

> Skeleton note: this is the formalized functional spec. Tasks and `index.json`
> updates are produced by the caller after this file lands — do not generate them here.

## 1. Origin & problem statement

Three Linear issues from the "Beta Feedback" backlog converge on the admin app's
generic entity-list system (`apps/admin`). They are independent symptoms of the same
underlying maturity gap: the generic list framework (`createEntityListPage`) is solid
for the entities that adopted it, but its filter vocabulary is thin, its grid mode is
under-polished, and several lists never migrated onto it at all.

### BETA-75 — "Mejorar filtros en tablas del admin" (better filters on admin tables)

The generic `FilterBar` (`apps/admin/src/components/entity-list/filters/FilterBar.tsx`)
implements only **two** control types today: `select` (`FilterSelect.tsx`) and
`boolean` (`FilterBoolean.tsx`). `filter-types.ts` declares the union as
`type FilterControlType = 'select' | 'boolean'` and a comment explicitly defers
`'relation' | 'number-range' | 'date-range'` to "future specs".

Two concrete consequences:

1. **Six lists have NO filter bar at all**: `sponsors`, `amenities`, `attractions`,
   `event-locations`, `event-organizers`, `features`. Operators cannot narrow these
   lists by anything except free-text search.
2. **No way to filter by a range.** There is no control for price, rating, capacity
   (number ranges) or for `createdAt` / event dates (date ranges). These are the
   highest-value missing filters per the beta feedback.

### BETA-72 — "Mejorar cards de modo grilla en listas del admin" (improve grid-mode cards)

The generic grid card (`apps/admin/src/components/grid/GridCard.tsx`) renders by
reusing the table `columns` array and `renderCellByType`. It works but is visually
flat: weak hierarchy, no dedicated action affordance, no per-entity tailoring, and an
empty state that does not match the web design system. There is currently **no way for
an entity config to supply its own card layout** — every entity gets the identical
generic card.

### BETA-76 — "Mostrar solo modo grilla para hosts en su lista de alojamientos" (host accommodations list grid-only)

The HOST's own accommodations portfolio at
`apps/admin/src/routes/_authed/me/accommodations/index.tsx` is a **hand-rolled Shadcn
`Card` grid** that calls `useAccommodationListQuery` directly. It is NOT built on
`createEntityListPage`, so it does not inherit the FilterBar, the peek drawer, the
shared cells, pagination, or sort. The beta ask is to give the host a clean, grid-only
portfolio view. Today this is bespoke code that drifts from the generic system.

> **Note on the rejected interpretation.** "Grid-only for hosts" could also have meant
> "force the admin `/accommodations` list into grid mode when the logged-in user is a
> HOST". That role-conditional behavior on the shared admin list is **explicitly
> rejected** (see §3 non-goals). BETA-76 targets the host's *own* portfolio route only.

### Collateral target — three hand-rolled `<table>` tag lists

Outside the three issues but in the same problem space, three tag lists are still
hand-rolled `<table>` markup with no FilterBar, no grid mode, and no peek drawer:

- post-tags: `apps/admin/src/routes/_authed/tags/post-tags/index.tsx`
- internal tags: `apps/admin/src/routes/_authed/platform/tags/internal/index.tsx`
- user-moderation tags: `apps/admin/src/routes/_authed/tags/user-moderation/index.tsx`

Migrating them onto `createEntityListPage` is in scope so they inherit the same UX as
every other list.

## 2. Current architecture (verified facts)

| Concern | Location | State today |
|---------|----------|-------------|
| Generic list entry | `apps/admin/src/components/entity-list/EntityListPage.tsx` (`createEntityListPage<TData>(config)`) | Used by 11 of 13 lists |
| Config shape | `apps/admin/src/components/entity-list/types.ts` (`EntityConfig<TData>`) | Key fields: `filterBarConfig`, `viewConfig` (`defaultView`, `allowViewToggle`, `gridConfig`), `createColumns`, `peekFields`, `paginationConfig`, `searchConfig`, `layoutConfig`, `listItemSchema` |
| Filter bar | `apps/admin/src/components/entity-list/filters/FilterBar.tsx` | Renders only `select` + `boolean` |
| Filter type union | `apps/admin/src/components/entity-list/filters/filter-types.ts` | `'select' \| 'boolean'`; range/relation deferred in a comment |
| Filter controls | `filters/FilterSelect.tsx`, `filters/FilterBoolean.tsx` | The two existing controls |
| Filter state | `filters/useFilterState.ts` | URL-serialized, 3-state (default / `FILTER_CLEARED_SENTINEL` / user value) |
| API client | `apps/admin/src/components/entity-list/api/createEntityApi.ts` | Sends `page`, `pageSize`, `search`, `sort` (`"field:asc\|desc"`), and each active filter by its `paramKey` |
| Grid card | `apps/admin/src/components/grid/GridCard.tsx` | Generic `GridCard<TData>` reusing `columns` + `renderCellByType` |
| View toggle | `DataTableToolbar` | `defaultView: 'table'` and `allowViewToggle: true` everywhere today |
| Host portfolio | `apps/admin/src/routes/_authed/me/accommodations/index.tsx` | Hand-rolled Shadcn `Card` grid via `useAccommodationListQuery` |

### Reusable cells already available (build on these — do not reinvent)

In `apps/admin/src/components/entity-list/`: `InlineStateSelectCell`,
`InlineFeaturedCell`, `RatingCell`, `ReviewsCell`, `AttractionBadgesCell`,
`AttractionIconCell`, `IconNameCell`, `WeightBarCell`, `MailLinkCell`,
`WhatsAppLinkCell`, `SocialNetworksCell`, `BulkOperationsToolbar`, `DeleteRowButton`,
`EntitySummarySheet`, `columns.factory.ts`.

### Per-entity filter inventory TODAY

| Entity | Current filters |
|--------|-----------------|
| accommodations | `status`, `type`, `isFeatured`, `includeDeleted` |
| destinations | `destinationType` (default `CITY`), `status`, `isFeatured`, `includeDeleted` |
| events | `status`, `category`, `isFeatured`, `includeDeleted` |
| posts | `status`, `category`, `isFeatured`, `isNews`, `includeDeleted` |
| users | `role` (incl. HOST), `includeDeleted` |
| sponsors | none |
| amenities | none |
| attractions | none |
| event-locations | none |
| event-organizers | none |
| features | none |

### Config paths

The 11 framework lists live under
`apps/admin/src/features/<entity>/config/*.config.ts` + `*.columns.ts`
(`accommodations`, `destinations`, `events`, `event-locations`, `event-organizers`,
`posts`, `sponsors`, `users`, `amenities`, `features`, `attractions`). The 3 tag lists
are hand-rolled and have no config.

### Project rules that constrain this work

- Pagination uses `page` + `pageSize` (NEVER `limit`); admin list routes reject unknown
  query params (`createAdminListRoute`). New range params MUST be declared on the route.
- Zod schemas in `@repo/schemas` are the single source of truth for types.
- Business logic lives in `@repo/service-core` services returning `Result<T>`.
- Permission checks use `PermissionEnum` only (never roles directly).
- LIKE searches MUST use `safeIlike()` from `@repo/db`.
- Admin styling is Tailwind v4 (no CSS modules); forms use TanStack Form + Zod
  `safeParse()`.

## 3. Goals & non-goals

### Goals

1. Extend the generic filter vocabulary with two new control types — `number-range`
   and `date-range` — end-to-end (type, UI control, URL state, API client wiring,
   server-side param handling).
2. Give every one of the 13 lists a useful filter bar, adding select/boolean filters to
   the six lists that have none today.
3. Polish the generic `GridCard` and make grid cards per-entity overridable.
4. Migrate the host accommodations portfolio onto `createEntityListPage`, grid-only.
5. Migrate the three hand-rolled tag lists onto `createEntityListPage`.

### Non-goals (explicitly out of scope)

1. **The `relation` filter control type is OUT of scope.** Only `number-range` and
   `date-range` are built here. `relation` stays deferred to a future spec.
2. **Role-conditional grid-only on the admin `/accommodations` list is OUT of scope.**
   The shared admin accommodations list keeps `defaultView: 'table'` and
   `allowViewToggle: true` for all roles. BETA-76 is satisfied by the host's *own*
   portfolio route (`/me/accommodations`), not by mutating the admin list per role.
   This was the rejected interpretation — do not implement it.
3. **No changes to the web app (`apps/web`).** This spec touches `apps/admin` and the
   admin-facing API routes/schemas/services only.
4. No new entity tables. The tag entities already exist; only their admin UI is
   migrated.
5. No virtualization changes (`VirtualizedEntityList*` stays as-is).

## 4. Functional requirements & acceptance criteria

### FR-1 — New filter control types: `number-range` and `date-range` (BETA-75)

Add two discriminants to `FilterControlType` and the full vertical slice for each.

**New type names and shapes (locked):**

- `FilterControlType` becomes `'select' | 'boolean' | 'number-range' | 'date-range'`.
- `NumberRangeFilterConfig` (in `filter-types.ts`): `type: 'number-range'`, plus
  `paramKeyMin: string` and `paramKeyMax: string` (e.g. `priceMin` / `priceMax`),
  optional `min?`, `max?`, `step?`, `unitLabelKey?`.
- `DateRangeFilterConfig` (in `filter-types.ts`): `type: 'date-range'`, plus
  `paramKeyFrom: string` and `paramKeyTo: string` (e.g. `createdAtFrom` /
  `createdAtTo`), values serialized as ISO `YYYY-MM-DD` date strings.
- New UI controls, siblings of `FilterSelect.tsx` / `FilterBoolean.tsx`:
  `filters/FilterNumberRange.tsx` and `filters/FilterDateRange.tsx`.
- `useFilterState.ts` serializes each range as **two** URL params (min/max or
  from/to), each independently clearable via the existing `FILTER_CLEARED_SENTINEL`
  3-state model; an empty bound is omitted from the query.
- `createEntityApi.ts` forwards each present bound by its `paramKey*` name.
- The admin list routes that adopt a range filter declare the new params on their
  Zod query schema in `@repo/schemas` (so `createAdminListRoute` does not reject them)
  and the corresponding `@repo/service-core` service applies the bound to its query
  (numeric comparison for number-range; `>=`/`<=` on the date column for date-range).

**Targets:** `number-range` targets price / rating / capacity; `date-range` targets
`createdAt` and event dates.

```
Given an entity config declares a number-range filter with paramKeyMin "priceMin" and paramKeyMax "priceMax"
  When the operator enters min=1000 and max=5000 and applies
  Then the URL gains priceMin=1000 and priceMax=5000
  And createEntityApi sends both params
  And the list returns only rows whose price is within [1000, 5000]

Given a number-range filter with only the min bound entered
  When the operator applies
  Then only priceMin is present in the URL and the request (no priceMax)
  And the list returns rows with price >= 1000

Given a date-range filter with paramKeyFrom "createdAtFrom" and paramKeyTo "createdAtTo"
  When the operator picks from=2026-01-01 and to=2026-03-31 and applies
  Then the URL gains createdAtFrom=2026-01-01 and createdAtTo=2026-03-31
  And the list returns only rows whose createdAt falls within that inclusive range

Given a range filter has values applied
  When the operator clears one bound via the active-filter chip
  Then only that bound is removed (sentinel logic) and the other bound persists in the URL

Given an admin list route receives a range param it does not declare
  When the request reaches createAdminListRoute
  Then the route rejects it as an unknown param (proves new params must be declared)
```

### FR-2 — Audit and backfill missing filters (BETA-75)

Audit all 13 lists. For the six with no filter bar, add appropriate `select`/`boolean`
filters using the existing two control types, matching the columns those entities
already expose:

- **sponsors** — `isFeatured` (boolean), `includeDeleted` (boolean); add a status/type
  select if the sponsor schema exposes one.
- **amenities** — `includeDeleted` (boolean); category/group select if present.
- **attractions** — `includeDeleted` (boolean); category select if present.
- **event-locations** — `includeDeleted` (boolean); any city/state select available on
  the schema.
- **event-organizers** — `includeDeleted` (boolean).
- **features** — `includeDeleted` (boolean); category select if present.

Where the underlying admin list route does not yet accept a given param, add it to the
route's Zod query schema and wire it into the service filter (same rule as FR-1).

```
Given the sponsors list previously had no filter bar
  When the sponsors config gains a filterBarConfig with isFeatured and includeDeleted
  Then the FilterBar renders on the sponsors list
  And applying includeDeleted=true returns soft-deleted rows

Given any of the six previously-unfiltered lists
  When its config declares at least one filter and the route accepts it
  Then the filter narrows results and survives a page reload (URL state)
```

### FR-3 — Grid card polish + per-entity override (BETA-72)

Polish the generic `GridCard` (layout, visual hierarchy, action affordance, responsive
behavior, empty state aligned with the web design system, Tailwind v4 only). Add a
per-entity override hook to `EntityConfig`:

- New optional field on `EntityConfig` (in `types.ts`):
  `gridConfig.renderCard?: (props: GridCardRenderProps<TData>) => ReactNode`.
- `GridCardRenderProps<TData>` exposes the row data plus the standard action callbacks
  (peek / edit / delete) so a custom card has parity with the generic one.
- When `renderCard` is absent, the system uses the polished generic `GridCard`
  (backward compatible — no existing config breaks).

```
Given an entity config does NOT supply gridConfig.renderCard
  When the list is switched to grid view
  Then the polished generic GridCard renders for each row

Given an entity config supplies gridConfig.renderCard
  When the list is switched to grid view
  Then the custom renderer is used for each row, receiving row data and action callbacks

Given a grid view has zero rows
  When the list finishes loading
  Then the grid empty state renders (matching the web design-system styling), not a blank area

Given the viewport is narrow (mobile)
  When grid view is active
  Then cards reflow to a single column without horizontal overflow
```

### FR-4 — Host accommodations portfolio migration (BETA-76)

Migrate `apps/admin/src/routes/_authed/me/accommodations/index.tsx` from the
hand-rolled Shadcn `Card` grid onto `createEntityListPage`, configured **grid-only**:

- New config under `apps/admin/src/features/accommodations/config/` (e.g.
  `me-accommodations.config.ts` + reuse of the existing columns where sensible), kept
  separate from the admin `accommodations` config.
- `viewConfig.defaultView = 'grid'` and `viewConfig.allowViewToggle = false` (no toggle
  rendered; table mode never reachable).
- The data source remains the host's own accommodations (owner-scoped, same data the
  current route shows), routed through the generic API client.

```
Given a HOST opens /me/accommodations
  When the page loads
  Then it renders via createEntityListPage in grid mode
  And no table/grid toggle control is shown
  And only the host's own accommodations are listed (owner-scoped)

Given the migrated host portfolio
  When the host uses the peek drawer / shared cells / pagination
  Then they behave identically to other createEntityListPage lists
```

### FR-5 — Tag lists migration

Migrate the three hand-rolled `<table>` tag lists onto `createEntityListPage` so they
inherit FilterBar + grid view + peek drawer:

- post-tags: `apps/admin/src/routes/_authed/tags/post-tags/index.tsx`
- internal tags: `apps/admin/src/routes/_authed/platform/tags/internal/index.tsx`
- user-moderation: `apps/admin/src/routes/_authed/tags/user-moderation/index.tsx`

Each gets a config (`apps/admin/src/features/<tag-area>/config/*.config.ts` +
`*.columns.ts`), a `listItemSchema` sourced from `@repo/schemas`, and a sensible filter
bar (at minimum `includeDeleted`; plus any status/type select the tag entity exposes).

```
Given the post-tags list previously rendered as a hand-rolled table
  When it is migrated to createEntityListPage
  Then it renders with FilterBar, grid view, and the peek drawer
  And existing create/edit navigation (new.tsx, $id_.edit.tsx) still works

Given each migrated tag list
  When a filter is applied and the page reloads
  Then the filter state persists via the URL (no regression vs. other lists)
```

## 5. Phased implementation plan

Ordered so foundational, low-risk infrastructure lands first; the higher-risk
migrations (per-entity overrides, host portfolio, tags) land last, each at a natural
pause point.

### Phase 1 — Filter type infrastructure (`number-range` + `date-range`)

Foundational, additive, zero behavior change to existing lists.

1. Extend `FilterControlType` union and add `NumberRangeFilterConfig` /
   `DateRangeFilterConfig` in `filter-types.ts`.
2. Build `FilterNumberRange.tsx` and `FilterDateRange.tsx` controls; register them in
   `FilterBar.tsx`.
3. Extend `useFilterState.ts` for two-param-per-range URL serialization with the
   existing sentinel 3-state model.
4. Extend `createEntityApi.ts` to forward range bounds by `paramKey*`.
5. Add range params to the relevant Zod query schemas in `@repo/schemas` and the
   matching service filters in `@repo/service-core`; declare them on the admin routes.
6. Unit tests for serialization + control rendering; service tests for range filtering.

**Pause point:** new types exist and are testable in isolation; no list uses them yet.

### Phase 2 — Audit + add missing filters (FR-1 targets + FR-2)

7. Wire `number-range` (price/rating/capacity) and `date-range` (createdAt / event
   dates) into the configs that should expose them (accommodations, events, etc.).
8. Add filter bars to the six unfiltered lists (sponsors, amenities, attractions,
   event-locations, event-organizers, features), adding route/service params where
   missing.
9. Tests per touched config + route.

**Pause point:** every list has a useful filter bar.

### Phase 3 — GridCard polish + per-entity override

10. Polish generic `GridCard` (hierarchy, actions, responsive, empty state).
11. Add `gridConfig.renderCard` + `GridCardRenderProps<TData>` to `EntityConfig` and
    wire the fallback in the grid renderer.
12. Tests: generic card renders by default; custom renderer used when provided; empty
    state; responsive snapshot/behavior.

**Pause point:** grid mode is polished and overridable; defaults unchanged.

### Phase 4 — Host portfolio migration (BETA-76)

13. Create the grid-only host config and migrate `/me/accommodations/index.tsx` onto
    `createEntityListPage`; remove the hand-rolled Shadcn `Card` grid.
14. Verify owner-scoping, peek drawer, pagination; tests for grid-only (no toggle).

**Pause point:** host portfolio runs on the generic system, grid-only.

### Phase 5 — Tags migration (highest regression risk)

15. Migrate post-tags, internal tags, user-moderation onto `createEntityListPage` one
    at a time (each its own commit), preserving existing create/edit navigation.
16. Tests per migrated list; verify FilterBar + grid + peek + URL state.

**Pause point:** all three tag lists on the generic system; hand-rolled tables removed.

### Phase 6 — Closeout

17. Flip spec + task index to completed; manual admin smoke of every touched list.

## 6. Risk and rollback

| Risk | Mitigation |
|------|------------|
| **Tags migration regression** (Phase 5) — losing create/edit nav, column data, or moderation actions when replacing bespoke tables | Migrate one tag list per commit; keep `new.tsx`/`$id_.edit.tsx` routes intact; manual smoke each before the next; rollback = revert the single commit |
| **API contract change for range params** — adding params to routes/schemas could reject existing callers or mis-filter | Range params are additive and optional; `createAdminListRoute` only rejects *unknown* params, so undeclared callers are unaffected; service-level range filtering covered by unit tests with boundary cases (inclusive bounds, single-bound, empty) |
| **Visual regression in grid** (Phase 3) — polishing `GridCard` could break the entities already using grid view | `renderCard` defaults to the generic card so configs are untouched; responsive + empty-state tests; manual smoke of a grid-capable list before/after |
| **Host portfolio data scope** — migration could leak non-owned accommodations | Reuse the existing owner-scoped data path; acceptance test asserts only the host's own rows appear |
| **`number-range` on money columns** — money is stored as integer centavos | Number-range UI/service operate on the stored integer unit; `unitLabelKey` documents the unit; tests assert centavo-correct boundaries |

## 7. Testing strategy

Per the project's Test-Informed Development rules (Vitest, AAA, ≥90% coverage):

- **Pure logic — tests first:** `useFilterState` range serialization (two params,
  sentinel clearing, single-bound), `createEntityApi` param forwarding, the
  `@repo/service-core` range filter functions (boundary cases: inclusive min/max,
  only-min, only-max, none, inverted range guarded).
- **Components — tests alongside:** `FilterNumberRange` / `FilterDateRange` rendering
  and apply/clear; polished `GridCard` default render; `gridConfig.renderCard` override
  path; grid empty state.
- **Config/route integration:** each newly-filtered list (the six) and each migrated
  list (host portfolio + 3 tags) gets a smoke test asserting FilterBar presence, filter
  application, and URL persistence; admin route tests assert range params are accepted
  when declared and rejected when not.
- **Regression:** any bug found during migration gets a reproducing test before the fix.
- **Manual admin smoke (Phase 6):** every touched list verified in the browser
  (superadmin + a HOST for `/me/accommodations`), since visual grid polish and
  hand-rolled-table replacement are not fully captured by unit tests.

## 8. Out-of-scope / future work

- `relation` filter control type (deferred; only `number-range` + `date-range` here).
- Role-conditional grid-only on the admin `/accommodations` list (rejected
  interpretation of BETA-76).
- Any `apps/web` changes.
- Virtualized-list grid mode (`VirtualizedEntityList*`).
- A generic saved-filters / filter-presets feature.

## 9. Key file pointers

| File | Relevance |
|------|-----------|
| `apps/admin/src/components/entity-list/filters/filter-types.ts` | Add `number-range` / `date-range` discriminants + config types |
| `apps/admin/src/components/entity-list/filters/FilterBar.tsx` | Register the two new controls |
| `apps/admin/src/components/entity-list/filters/FilterNumberRange.tsx` | NEW number-range control |
| `apps/admin/src/components/entity-list/filters/FilterDateRange.tsx` | NEW date-range control |
| `apps/admin/src/components/entity-list/filters/useFilterState.ts` | Two-param range URL serialization |
| `apps/admin/src/components/entity-list/api/createEntityApi.ts` | Forward range bounds by `paramKey*` |
| `apps/admin/src/components/entity-list/types.ts` | Add `gridConfig.renderCard` + `GridCardRenderProps<TData>` |
| `apps/admin/src/components/grid/GridCard.tsx` | Polish generic card; wire override fallback |
| `apps/admin/src/features/{sponsors,amenities,attractions,event-locations,event-organizers,features}/config/*.config.ts` | Add filter bars |
| `apps/admin/src/features/accommodations/config/me-accommodations.config.ts` | NEW grid-only host config |
| `apps/admin/src/routes/_authed/me/accommodations/index.tsx` | Migrate onto `createEntityListPage` |
| `apps/admin/src/routes/_authed/tags/post-tags/index.tsx` | Migrate onto `createEntityListPage` |
| `apps/admin/src/routes/_authed/platform/tags/internal/index.tsx` | Migrate onto `createEntityListPage` |
| `apps/admin/src/routes/_authed/tags/user-moderation/index.tsx` | Migrate onto `createEntityListPage` |
| `packages/schemas/...` (admin list query schemas) | Declare new range/filter params |
| `packages/service-core/...` (entity services) | Apply range/filter bounds to queries |

## 10. Design decisions (locked)

1. **Only `number-range` + `date-range`** are added to `FilterControlType`. `relation`
   stays deferred.
2. **Each range filter serializes as two independent URL params** (min/max or from/to),
   reusing the existing `FILTER_CLEARED_SENTINEL` 3-state model — no new state machine.
3. **New range params must be declared** on the admin route's Zod query schema in
   `@repo/schemas` and applied in the `@repo/service-core` service. No silent acceptance
   (`createAdminListRoute` rejects unknown params by design).
4. **Per-entity grid override is opt-in** via `gridConfig.renderCard`; absent → polished
   generic `GridCard`. Backward compatible.
5. **BETA-76 = host's own portfolio route only.** The admin `/accommodations` list is
   not made role-conditional. Host portfolio is `defaultView: 'grid'`,
   `allowViewToggle: false`.
6. **Tags migrate one list per commit** to bound regression blast radius.
7. **Date-range values are ISO `YYYY-MM-DD` strings**; number-range operates on the
   stored unit (integer centavos for money).
