---
specId: SPEC-197
title: Admin View-Stats Surfaces
type: feature
complexity: high
status: draft
created: 2026-06-05
owner: qazuor
dependsOn:
  - SPEC-159
related:
  - SPEC-155
  - SPEC-145
tags:
  - admin
  - analytics
  - views
  - dashboard
  - entity-stats
  - recharts
  - backend
---

# SPEC-197 — Admin View-Stats Surfaces

> **Status**: DRAFT — locked scope defined 2026-06-05. All design decisions are
> pre-approved by the owner. This spec is the consumer of SPEC-159
> (cross-entity view tracking, already merged to staging).

## 1. Origin & Goal

SPEC-159 shipped the `entity_views` table, `EntityViewModel`, `EntityViewService`,
and the three protected read endpoints for HOST (accommodations/me) and EDITOR
(posts, events). Those endpoints are live but no admin surface consumes them.

SPEC-155's dashboards.ts has three `deferredSlots` pointing at `phaseSpec: 'SPEC-159'`
(HOST card G views slot, EDITOR card E views-per-post slot, EDITOR card F
views-per-event slot) that must now be filled. Beyond those widgets, the spec owner
identified five additional admin surfaces where view data has clear value:

- A platform-wide **admin dashboard summary card** (new card in `adminBaseDashboard`).
- Per-entity **view-stat chips** on the admin view pages for accommodation, post,
  and event.
- A **"Vistas (30d)" column** on the admin listing pages for all three entity types.
- A dedicated **`/analytics/views` page** with top-10 ranked entities and a 30d
  daily time-series chart by entity type.

**Goal**: deliver all six surfaces with minimal new backend (two new `EntityViewModel`
methods + four new admin-tier endpoints + admin service methods), reusing
SPEC-159's data and the existing dashboard, entity-list, and analytics page patterns.

### Success metrics

- All three `deferredSlots` for `phaseSpec: 'SPEC-159'` in `dashboards.ts` render
  live data (no `DeferredWidget`) after this spec ships.
- Admin dashboard (ADMIN + SUPER_ADMIN) shows platform-wide view totals per entity
  type with a 7d/30d toggle.
- Admin detail pages for accommodation, post, and event show unique + total chips for
  7d and 30d.
- Admin list pages for accommodations, posts, and events render a non-sortable
  "Vistas (30d)" column populated by batch stats for the visible page.
- `/analytics/views` page renders, passes all integration tests, and the recharts
  time-series line chart displays three lines (one per entity type) for the last 30d.

---

## 2. Scope

### IN

1. **Fill dashboard `deferredSlots`** — HOST card G views slot, EDITOR card E views
   slot, EDITOR card F views slot (source registrations + dashboard config updates).
2. **Admin dashboard summary card** — new card `admin-card-views` in
   `adminBaseDashboard` (platform-wide unique + total per entity type, 7d/30d toggle,
   visible to ADMIN + SUPER_ADMIN).
3. **Shared `WindowToggle` component** — a single reusable `7d / 30d` toggle used by
   all widgets and the analytics page.
4. **HOST locked state** — HOST dashboard view widget renders a LOCKED state with
   upsell copy + billing link when the host lacks `VIEW_BASIC_STATS` entitlement.
5. **View-stat chips on admin detail pages** — read-only chip group showing unique and
   total for 7d and 30d, mounted in view mode on `/accommodations/:id`, `/posts/:id`,
   `/events/:id`.
6. **"Vistas (30d)" column on admin list pages** — display-only derived column on
   `/accommodations`, `/posts`, `/events` admin lists; batch-fetched for the visible
   page's entity ids; NOT sortable.
7. **`/analytics/views` page** — sibling of `business.tsx` and `usage.tsx` in
   `apps/admin/src/routes/_authed/analytics/`; totals per entity type + top-10 most
   viewed per type (with resolved entity names) + 30d daily time-series recharts chart
   with three lines.
8. **New admin-tier API endpoints** (permission: `ANALYTICS_VIEW`):
   - `GET /api/v1/admin/views/summary` — platform-wide unique + total per entity type.
   - `GET /api/v1/admin/views/batch` — bulk stats for a caller-supplied list of
     entityIds (max 100) + entityType.
   - `GET /api/v1/admin/views/top` — top-N most-viewed entities per type.
   - `GET /api/v1/admin/views/daily-series` — date-bucketed counts grouped by day +
     entityType, last 30d.
9. **Two new `EntityViewModel` methods**:
   - `getTopViewedEntities({entityType, windowDays, limit})` — ranked by total.
   - `getDailySeries({windowDays})` — date-bucketed counts grouped by day + entityType.
10. **`EntityViewService` admin methods** — `getAdminSummary`, `getAdminBatch`,
    `getAdminTopEntities`, `getAdminDailySeries` (all gated by `ANALYTICS_VIEW`).
11. **New Zod schemas** in `@repo/schemas` entityView — top-N response,
    daily-series response, admin batch query.
12. **`endpoint-gate-matrix.md` rows** for all four new admin routes.
13. **i18n strings** in `@repo/i18n` (es/en/pt) for all new admin UI copy.
14. **zodError translation keys** for all new schemas (GAP-010 guard compliance) in
    `packages/i18n/src/locales/{es,en,pt}/validation.json`.
15. **Testing** — unit tests for new model methods, service permission tests, admin
    route integration tests, admin component tests (all detailed in §6).

### OUT (explicit exclusions)

- **Sortable views columns** — "Vistas (30d)" column is display-only. Implementing
  sort requires a database-level join that exceeds this spec's scope.
- **Web-app user-facing stats** — no public-tier endpoints; no changes to the web
  public pages or accommodation detail page for guests.
- **Pre-aggregation / materialized views** — SPEC-159 tech-analysis recommends
  query-time aggregation for V1. This spec keeps that choice. Escalation to a matview
  is a separate performance decision.
- **PostHog changes** — PostHog events keep firing unchanged (additive). No changes to
  the PostHog integration.
- **Time-series beyond 30d** — the daily-series endpoint is hardcoded to 30 days. A
  configurable window is deferred.
- **CSV export** — analytics export is out of scope.
- **Email/notification alerts** based on view counts — out of scope.
- **HOST-scoped `/analytics/views` access** — the analytics page is admin-only
  (`ANALYTICS_VIEW`). Hosts see views only via their dashboard widget.

---

## 3. User Stories & Acceptance Criteria

### 3.1 — HOST views widget (fill `deferredSlot`)

**Story**: As a HOST, I want to see how many unique visitors and total views my
accommodations received in the last 7 or 30 days, so that I can assess my listing's
reach without leaving my dashboard.

#### Acceptance Criteria

#### AC-1 (happy path — active plan)

- Given: an authenticated HOST with `VIEW_BASIC_STATS` entitlement (any active
  owner/host plan) AND at least one published accommodation.
- When: HOST card G on the "Mi negocio" dashboard loads.
- Then: the views slot renders a list of owned accommodations with, per row:
  accommodation name, unique visitor count, total view count, and the active window
  label ("7 días" or "30 días"). The default window is 30d. The slot does NOT render
  a `DeferredWidget`.

#### AC-2 (window toggle)

- Given: the HOST views widget is showing 30d data.
- When: the user clicks the 7d toggle.
- Then: the data re-fetches with `?window=7d` and the displayed counts update within
  the query stale time. Both window buttons are visible; the active one is visually
  distinct.

#### AC-3 (locked state — missing entitlement)

- Given: an authenticated HOST whose active entitlements do NOT include
  `VIEW_BASIC_STATS` (e.g. expired trial, no active subscription).
- When: HOST card G renders.
- Then: the views slot renders a LOCKED state that shows (a) a lock icon, (b) the
  i18n copy key `dashboard.host.views.locked.description` (Spanish default:
  "Disponible con un plan activo" — VIEW_BASIC_STATS is present on ALL active
  paid plans, so the locked state only applies to hosts without an active
  subscription or with an expired trial; owner-approved copy 2026-06-05), and (c) a CTA button linking to
  `/billing/plans` with the label from key `dashboard.host.views.locked.cta`.
  No view data is fetched.

#### AC-4 (empty accommodation)

- Given: a HOST with `VIEW_BASIC_STATS` but all their accommodations have zero views
  in the selected window.
- When: the views slot loads.
- Then: the slot renders an empty-state using the text from i18n key
  `dashboard.host.views.empty` ("Sin vistas en este período."). No error state is shown.

#### AC-5 (entitlement detection is proactive)

- Given: the HOST dashboard entitlements response already loaded (from
  `GET /api/v1/protected/users/me/entitlements` fetched by the existing `host.billing.plan`
  source resolver).
- When: the views source resolver runs.
- Then: it reads the cached entitlements result to determine whether to show the
  locked state WITHOUT making an additional API call for entitlements.
  Defensive: if a 403 is returned by the views endpoint despite the proactive check,
  the widget falls back to the locked state (same UI).

#### AC-6 (403 defensive fallback)

- Given: the views endpoint returns HTTP 403.
- When: the host views widget receives the error.
- Then: the widget renders the locked state (same UI as AC-3). The error is NOT
  shown as a red error callout — a 403 is expected behavior for unentitled hosts.

### 3.2 — EDITOR views widgets (fill `deferredSlots`)

**Story**: As an EDITOR, I want to see the view count per post and per event for the
last 7 or 30 days, so that I can identify which content is attracting the most traffic.

#### AC-7 (EDITOR post views — happy path)

- Given: an authenticated EDITOR with `POST_VIEW_ALL` permission AND posts with views
  in the selected window.
- When: EDITOR card E (Estadísticas blog) loads with the views slot visible.
- Then: the views slot renders a list of posts with unique and total counts per post.
  Default window is 30d. The `DeferredWidget` is no longer rendered for this slot.

#### AC-8 (EDITOR event views — happy path)

- Given: an authenticated EDITOR with `EVENT_VIEW_ALL` permission AND events with
  views in the selected window.
- When: EDITOR card F (Estadísticas eventos) loads with the views slot visible.
- Then: the views slot renders a list of events with unique and total counts per event.
  Default window is 30d.

#### AC-9 (EDITOR window toggle)

- Given: the EDITOR views widget for posts or events is showing 30d data.
- When: the user clicks the 7d toggle.
- Then: the data re-fetches with `?window=7d` and counts update. Both the post-views
  widget and the event-views widget share the SAME `WindowToggle` component but each
  maintains its own independent window selection.

#### AC-10 (EDITOR empty state)

- Given: no posts (or events) have any views in the selected window.
- When: the views slot loads.
- Then: an empty state is shown using the text from i18n key
  `dashboard.editor.views.empty`. No error state is shown.

### 3.3 — Admin dashboard summary card (new card)

**Story**: As an ADMIN or SUPER_ADMIN, I want a platform-wide overview of view counts
per entity type on my dashboard, so that I can monitor content reach without opening
the analytics page.

#### AC-11 (admin summary card — happy path)

- Given: an authenticated ADMIN or SUPER_ADMIN user.
- When: the admin base dashboard loads.
- Then: a new card "Vistas de plataforma" (i18n key `dashboard.admin.views.title`)
  is visible. It shows three rows — one per entity type (ACCOMMODATION, POST, EVENT)
  — each with: entity type label, unique count, total count, and the active window
  label. Default window is 30d.

#### AC-12 (admin summary card window toggle)

- Given: the admin summary card shows 30d data.
- When: the user clicks the 7d toggle.
- Then: the data re-fetches and counts update. The `WindowToggle` component used here
  is the same shared component from §3.1.

#### AC-13 (admin card placement)

- Given: the ADMIN base dashboard config (`adminBaseDashboard`) in `dashboards.ts`.
- When: the dashboard renders.
- Then: the new views card appears as a distinct card in `adminBaseDashboard`. Its
  `source` ID is `admin.views.summary`. The SPEC-155 card count test is updated to
  reflect the new count (was 7, becomes 8 — or the card is added to the "With WN"
  variant that is the actual export; verify and update the count assertion accordingly).

#### AC-14 (admin card scope)

- Given: a HOST user.
- When: their dashboard loads.
- Then: the HOST dashboard does NOT show the `admin.views.summary` card. The card is
  exclusive to `adminBaseDashboard`.

### 3.4 — Shared WindowToggle component

**Story**: As an admin user, I want a consistent 7d/30d window picker on every
view-stats widget and page, so that I can switch time ranges with a familiar UI.

#### AC-15 (shared component)

- Given: the `WindowToggle` component is implemented.
- When: it is rendered with a `value` prop of `'7d'` or `'30d'` and an `onChange`
  callback.
- Then: it renders two toggle buttons labeled "7 días" and "30 días" (i18n keys
  `common.window.7d` and `common.window.30d`). The active window button has a
  visually distinct active state. Clicking the inactive button calls `onChange` with
  the new window value.

#### AC-16 (single implementation)

- Given: all six view-stats surfaces in this spec.
- When: the codebase is inspected.
- Then: all six surfaces import and use the same `WindowToggle` component from a
  single location (e.g., `apps/admin/src/components/views/WindowToggle.tsx`). There
  is no duplicate implementation.

### 3.5 — View-stat chips on admin detail pages

**Story**: As an ADMIN or SUPER_ADMIN, I want to see quick view-count chips on the
accommodation, post, and event detail view pages, so that I can check traffic for a
specific entity without navigating to the analytics page.

#### AC-17 (accommodation detail chips — happy path)

- Given: an authenticated user with `ACCOMMODATION_VIEW_ALL` permission AND an
  accommodation with view data.
- When: the accommodation detail page (`/accommodations/:id`) is open in view mode.
- Then: a chip group is visible showing four chips: "7d únicos: N", "7d totales: N",
  "30d únicos: N", "30d totales: N". The chip group uses i18n keys
  `entity.stats.chips.unique` and `entity.stats.chips.total` with the window prefix.

#### AC-18 (post detail chips)

- Given: an authenticated user with `POST_VIEW_ALL` permission.
- When: the post detail page (`/posts/:id`) is open in view mode.
- Then: the same four-chip group from AC-17 is visible with view counts for that post.

#### AC-19 (event detail chips)

- Given: an authenticated user with `EVENT_VIEW_ALL` permission.
- When: the event detail page (`/events/:id`) is open in view mode.
- Then: the same four-chip group is visible with view counts for that event.

#### AC-20 (chips loading state)

- Given: the chip data is still loading.
- When: the detail page first renders.
- Then: each chip shows a skeleton placeholder (not "—" or "0"). The rest of the page
  is not blocked.

#### AC-21 (chips zero state)

- Given: the entity has no views in any window.
- When: the chips load.
- Then: the chips show "0" for all four values. They are NOT hidden when zero.

#### AC-22 (chips mount point — view mode only)

- Given: the entity detail page.
- When: the user is in EDIT mode.
- Then: the chip group is NOT visible. The chips are exclusive to view mode. The chips
  are rendered via a dedicated `EntityViewStatChips` component injected into the detail
  page layout (see UX considerations §5 for the exact mount point).

#### AC-23 (chips permission guard)

- Given: an authenticated user who does NOT have `ANALYTICS_VIEW` permission.
- When: they open the accommodation, post, or event detail page.
- Then: the chip group is NOT rendered. No API call to the admin batch endpoint is made.
  Condition: the admin batch endpoint (`/admin/views/batch`) requires `ANALYTICS_VIEW`.
  The chip component guards its fetch on the user's permissions.

### 3.6 — "Vistas (30d)" column on admin list pages

**Story**: As an ADMIN or SUPER_ADMIN, I want to see a view count column on the
accommodation, post, and event list pages, so that I can identify high-traffic
entities at a glance.

#### AC-24 (column renders — accommodations)

- Given: an authenticated ADMIN user is on the `/accommodations` admin list page.
- When: the page loads.
- Then: a column labeled "Vistas (30d)" (i18n key `list.column.views30d`) is visible
  at the right side of the table/grid. Each row shows the total view count for that
  accommodation over the last 30 days.

#### AC-25 (column renders — posts and events)

- Given: the `/posts` and `/events` admin list pages.
- When: they load.
- Then: the same "Vistas (30d)" column is present on each, following the same
  pattern as AC-24.

#### AC-26 (batch fetch — page-level)

- Given: the list page is showing N entities (where N ≤ the current `pageSize`, max 100).
- When: the page data loads.
- Then: a single call is made to `GET /api/v1/admin/views/batch` with the
  `entityType` and the array of `entityIds` from the current page. The column populates
  after this call resolves. Entities with zero views show "0" (not blank).

#### AC-27 (column is NOT sortable)

- Given: the "Vistas (30d)" column header.
- When: the user clicks it.
- Then: nothing happens. The column header renders without a sort indicator and is
  not clickable as a sort trigger. The table remains sorted by whatever was active.

#### AC-28 (column loading state)

- Given: the batch stats call is in-flight.
- When: the list row renders.
- Then: the column shows a skeleton placeholder or "…" — not "0". The rest of the
  row is NOT blocked.

#### AC-29 (column error state)

- Given: the batch stats call fails (network error or 5xx).
- When: the column receives the error.
- Then: the column shows "—" for all affected rows. No toast or full-page error is
  shown — the list remains functional without the column data.

#### AC-30 (column permission guard)

- Given: a user without `ANALYTICS_VIEW` permission views the list page.
- When: the list renders.
- Then: the "Vistas (30d)" column is NOT rendered. No batch API call is made.

### 3.7 — `/analytics/views` page

**Story**: As an ADMIN or SUPER_ADMIN, I want a dedicated views analytics page that
shows totals, top-10 entities, and a 30d time-series chart, so that I can understand
view-traffic trends across the platform.

#### AC-31 (page exists and is accessible)

- Given: an authenticated user with `ANALYTICS_VIEW` permission.
- When: they navigate to `/analytics/views`.
- Then: the page renders without error. The page uses `SidebarPageLayout` with title
  key `admin-pages.titles.analyticsViews` and follows the same pattern as
  `business.tsx` and `usage.tsx`.

#### AC-32 (page is NOT accessible without permission)

- Given: an authenticated user without `ANALYTICS_VIEW` permission.
- When: they navigate to `/analytics/views`.
- Then: a 403/forbidden state is shown (handled by the existing `beforeLoad` guard
  pattern used on other analytics routes — verify the guard exists on
  `analytics/business.tsx` and `analytics/usage.tsx` and apply the same).

#### AC-33 (summary totals section)

- Given: the page loads.
- When: the summary section renders.
- Then: three KPI tiles are shown — one per entity type (ACCOMMODATION, POST, EVENT)
  — each displaying: entity type label, unique count, total count, and the 7d/30d
  toggle. The `WindowToggle` component from §3.4 is used.

#### AC-34 (top-10 per entity type)

- Given: the page loads.
- When: the top-10 section renders.
- Then: three ranked lists are shown — one per entity type (ACCOMMODATION, POST, EVENT)
  — each showing up to 10 rows. Each row displays: rank number, entity name (resolved
  from the entity's own name/title field — see §5 for name resolution), unique count,
  total count. The top-10 list uses the 30d window (fixed, not toggleable).

#### AC-35 (entity name resolution in top-10)

- Given: the `GET /api/v1/admin/views/top` endpoint returns an array of
  `{ entityId, unique, total }`.
- When: the admin app renders the top-10 list.
- Then: the entity name (accommodation name, post title, or event title) is resolved
  by an additional API call: `GET /api/v1/admin/{accommodations|posts|events}?ids=id1,id2,...`
  (or individual GET calls per entity if a batch-by-ids endpoint does not exist).
  The rendering uses the resolved name. If the name cannot be resolved, the entityId
  is shown in its place.

#### AC-36 (30d daily time-series chart)

- Given: the page loads.
- When: the chart section renders.
- Then: a recharts `LineChart` (component: `recharts.LineChart`) renders three lines,
  one per entity type (ACCOMMODATION, POST, EVENT). The X-axis is the date (last 30
  calendar days). The Y-axis is total view count per day. Each line has a distinct
  color and a legend label. The chart is responsive (uses `ResponsiveContainer`).

#### AC-37 (chart zero-data tolerance)

- Given: one entity type has zero views on some days.
- When: the chart renders.
- Then: the line for that entity type shows "0" for those days (the daily series
  response gap-fills missing days with 0 — see §4 backend spec). The chart does
  NOT skip or break the line at zero-data days.

#### AC-38 (chart loading state)

- Given: the daily-series call is in-flight.
- When: the chart section renders.
- Then: a skeleton or spinner is shown in place of the chart area. The summary tiles
  and top-10 lists are NOT blocked by the chart loading state.

---

## 4. Backend Specification

### 4.1 New `EntityViewModel` methods

Both new methods are added to the existing `EntityViewModel` class in
`packages/db/src/models/entity-view/entity-view.model.ts`. They follow the same
patterns as `getStatsForEntities` (raw SQL via Drizzle `sql` tag, typed return,
lazy `getClient`, PG reserved-word quoting — the `AS "unique"` lesson from SPEC-159
applies: all aliases with reserved PG words MUST be quoted).

**Method A: `getTopViewedEntities`**

```
Input type:
  {
    entityType: TrackableEntityType;
    windowDays: number;    // 7 or 30
    limit: number;         // typically 10
  }

Output: EntityViewStats[]  — array ordered by total DESC, length ≤ limit.
         (same EntityViewStats shape: { entityId, unique, total })

SQL sketch:
  SELECT entity_id AS "entityId",
         COUNT(DISTINCT visitor_hash)::int AS "unique",
         COUNT(DISTINCT (visitor_hash, FLOOR(EXTRACT(EPOCH FROM viewed_at) / 1800)))::int AS "total"
  FROM entity_views
  WHERE entity_type = $entityType::entity_type_enum
    AND viewed_at > NOW() - interval '$windowDays days'
  GROUP BY entity_id
  ORDER BY "total" DESC
  LIMIT $limit
```

- Entities with zero views in the window are NOT returned (SQL GROUP BY omits them
  naturally).
- `$limit` MUST be bound as a parameterized value — do NOT string-interpolate.
- Uses `entityType` cast (`::entity_type_enum`) following the existing precedent in
  `getStatsForEntities`.

**Method B: `getDailySeries`**

```
Input type: { windowDays: number }  // always 30 for V1

Output:
  Array<{
    date: string;          // 'YYYY-MM-DD'
    entityType: TrackableEntityType;
    total: number;         // daily deduplicated total (30-min bucket dedup)
  }>

SQL sketch:
  SELECT
    to_char(DATE_TRUNC('day', viewed_at), 'YYYY-MM-DD') AS "date",
    entity_type                                          AS "entityType",
    COUNT(DISTINCT (visitor_hash, FLOOR(EXTRACT(EPOCH FROM viewed_at) / 1800)))::int AS "total"
  FROM entity_views
  WHERE viewed_at > NOW() - interval '$windowDays days'
  GROUP BY DATE_TRUNC('day', viewed_at), entity_type
  ORDER BY "date" ASC, entity_type ASC
```

- Returns ONLY days with at least one view (no gap-filling at the model layer).
- Gap-filling to ensure every day in the 30d window appears (even as 0) is done
  by the **service layer** (`getAdminDailySeries`) to keep the model query lean.
- The service iterates the 30 days in the window and merges model rows with
  zero-padded placeholders for missing days + entity types.

### 4.2 New `EntityViewService` admin methods

Added to `packages/service-core/src/services/entityView/entityView.service.ts`.

All four methods use `runWithLoggingAndValidation` with `actor` + `ANALYTICS_VIEW`
permission check (via `hasPermission(actor, PermissionEnum.ANALYTICS_VIEW)`).
The service MUST NOT dereference `@repo/db` exports in the constructor —
the existing lazy getter pattern (`protected get model()`) already handles this
and must be preserved.

**`getAdminSummary({ actor, window })`**

- Calls `model.getStatsForEntities` three times in parallel (one per entity type:
  ACCOMMODATION, POST, EVENT) with `entityIds` = all entity IDs in the platform.

  > Implementation note: calling `getStatsForEntities` with "all entity IDs" is not
  > practical. Instead, write a new SQL variant (or a model-level `getSummaryByType`
  > helper) that aggregates totals by entity type WITHOUT an `entityIds` filter.
  > The spec owner decision: implement this as a direct model call
  > `getAdminSummaryTotals({windowDays})` that groups by `entity_type` without an
  > IN-list — the model already does raw sql, one more variant is acceptable.
  > Add this as a third method to `EntityViewModel` at the same time as A and B
  > above (effectively three new model methods total).

  Revised model method C: `getAdminSummaryTotals`:

  ```
  Input: { windowDays: number }
  Output: Array<{ entityType: TrackableEntityType; unique: number; total: number }>

  SQL:
    SELECT
      entity_type AS "entityType",
      COUNT(DISTINCT visitor_hash)::int AS "unique",
      COUNT(DISTINCT (visitor_hash, FLOOR(EXTRACT(EPOCH FROM viewed_at) / 1800)))::int AS "total"
    FROM entity_views
    WHERE viewed_at > NOW() - interval '$windowDays days'
    GROUP BY entity_type
  ```

- Returns the merged result normalizing to `{ entityType, unique, total }` for all
  three types (zero-fills missing entity types in service layer).

**`getAdminBatch({ actor, entityType, entityIds, window })`**

- Validates: `entityIds.length ≤ 100`. Rejects with `ServiceErrorCode.VALIDATION_ERROR`
  if exceeded.
- Calls `model.getStatsForEntities({ entityType, entityIds, windowDays })`.
- Returns the same `EntityViewStats[]` shape. Entities absent from the result (zero
  views) are zero-filled by the service so that the caller always gets one entry per
  requested id.

**`getAdminTopEntities({ actor, entityType, windowDays, limit })`**

- Validates: `limit ≤ 50`. Default: 10.
- Calls `model.getTopViewedEntities({ entityType, windowDays, limit })`.
- Returns `EntityViewStats[]` ordered by `total DESC`.

**`getAdminDailySeries({ actor, windowDays })`**

- `windowDays` is fixed at 30 for V1 (schema allows only 30 for now — enforced by Zod).
- Calls `model.getDailySeries({ windowDays })`.
- Gap-fills: for each of the 30 days in the window, for each of the three entity types
  (ACCOMMODATION, POST, EVENT), if the model returned no row, emits
  `{ date, entityType, total: 0 }`.
- Returns the gap-filled array (3 entity types × 30 days = 90 rows maximum).

### 4.3 New admin API endpoints

All four routes live in a new directory:
`apps/api/src/routes/views/admin/`

A new `index.ts` in that directory registers all four routes and is mounted in the
main API router at `/api/v1/admin/views/`.

All routes:

- Use `createSimpleRoute` (or the appropriate admin route factory — verify which
  factory is used by existing admin analytics routes such as `app-logs/list.ts` which
  uses `createAdminListRoute`).
- Require `PermissionEnum.ANALYTICS_VIEW`.
- Follow the existing response envelope: `{ success: true, data: <payload> }`.
- Are added to `endpoint-gate-matrix.md` with `Decision = none` (admin staff routes
  are permission-gated by the route factory, not by billing entitlement) and
  `Reason = "admin-tier route; gated by ANALYTICS_VIEW permission, no billing gate needed"`.

**`GET /api/v1/admin/views/summary`**

```
Query params: window=7d|30d  (Zod: EntityViewWindowSchema, default '30d')
Permission:   ANALYTICS_VIEW
Response:
  {
    data: Array<{
      entityType: 'ACCOMMODATION' | 'POST' | 'EVENT';
      unique: number;
      total: number;
    }>
  }
```

**`GET /api/v1/admin/views/batch`**

```
Query params:
  entityType: 'ACCOMMODATION' | 'POST' | 'EVENT'  (Zod: TrackableEntityTypeSchema)
  entityIds:  comma-separated UUIDs, e.g. "uuid1,uuid2,..."
              (Zod: split by comma, validate each as UUID, max 100 items)
  window:     7d|30d  (default '30d')
Permission:   ANALYTICS_VIEW
Response:
  { data: EntityViewStats[] }
  (EntityViewStats: { entityId, unique, total } — one entry per requested id,
   zero-view entities included as { unique: 0, total: 0 })
```

**`GET /api/v1/admin/views/top`**

```
Query params:
  entityType: TrackableEntityType
  window:     7d|30d  (default '30d')
  limit:      integer 1–50  (default 10)
Permission:   ANALYTICS_VIEW
Response:
  { data: EntityViewStats[] }   — ordered by total DESC, length ≤ limit
```

**`GET /api/v1/admin/views/daily-series`**

```
Query params:  (none — hardcoded 30d for V1)
Permission:    ANALYTICS_VIEW
Response:
  {
    data: Array<{
      date: string;         // 'YYYY-MM-DD'
      entityType: 'ACCOMMODATION' | 'POST' | 'EVENT';
      total: number;
    }>
  }
  — always 90 rows (3 types × 30 days), zero-filled for missing days
```

### 4.4 New Zod schemas in `@repo/schemas`

Added to `packages/schemas/src/entities/entityView/` and exported from the
`entityView/index.ts` barrel:

**`AdminViewSummaryItemSchema`**

```ts
z.object({
  entityType: TrackableEntityTypeSchema,
  unique: z.number().int().nonnegative(),
  total:  z.number().int().nonnegative(),
})
```

**`AdminViewSummaryResponseSchema`**

```ts
z.object({ data: z.array(AdminViewSummaryItemSchema) })
```

**`AdminViewBatchQuerySchema`**

```ts
z.object({
  entityType: TrackableEntityTypeSchema,
  entityIds:  z.string()
                .transform(s => s.split(','))
                .pipe(z.array(z.string().uuid({ message: 'zodError.entityView.entityId.invalidUuid' }))
                        .min(1, { message: 'zodError.adminView.batch.entityIds.empty' })
                        .max(100, { message: 'zodError.adminView.batch.entityIds.tooMany' })),
  window:     EntityViewWindowSchema.default('30d'),
})
```

**`AdminViewTopQuerySchema`**

```ts
z.object({
  entityType: TrackableEntityTypeSchema,
  window:     EntityViewWindowSchema.default('30d'),
  limit:      z.coerce.number().int().min(1).max(50).default(10),
})
```

**`AdminViewDailySeriesItemSchema`**

```ts
z.object({
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'zodError.adminView.dailySeries.date.invalid' }),
  entityType: TrackableEntityTypeSchema,
  total:      z.number().int().nonnegative(),
})
```

**`AdminViewDailySeriesResponseSchema`**

```ts
z.object({ data: z.array(AdminViewDailySeriesItemSchema) })
```

All new `zodError.*` message keys MUST be added to
`packages/i18n/src/locales/{es,en,pt}/validation.json` before any route that uses
these schemas ships (GAP-010 guard enforcement).

New zodError keys to add:

- `zodError.adminView.batch.entityIds.empty`
- `zodError.adminView.batch.entityIds.tooMany`
- `zodError.adminView.dailySeries.date.invalid`

---

## 5. UX Considerations

### 5.1 WindowToggle component

A single `WindowToggle` React component (`apps/admin/src/components/views/WindowToggle.tsx`)
is the ONLY implementation of the 7d/30d picker. All six surfaces import it.

Props interface:

```ts
interface WindowToggleProps {
  value: '7d' | '30d';
  onChange: (window: '7d' | '30d') => void;
  disabled?: boolean;
}
```

The component renders as a compact two-button toggle group using Shadcn
`ToggleGroup` / `ToggleGroupItem`. Active button has the `data-state="on"` visual.
Disabled state disables both buttons (used during loading).

### 5.2 HOST locked state

The LOCKED state is a sub-component within the HOST views source resolver output.
Detection is proactive: the `host.stats.views` source resolver reads the cached
`host.billing.plan` query data (which already fetches
`GET /api/v1/protected/users/me/entitlements`) to check for `view_basic_stats` in
the entitlements array BEFORE deciding whether to fetch view data.

If `view_basic_stats` is absent from the entitlements:

- The source resolver returns a special `{ locked: true }` payload instead of view data.
- The widget renderer detects `locked: true` and renders the locked UI.
- No request is made to `GET /api/v1/protected/views/accommodations/me`.

If the endpoint subsequently returns HTTP 403 despite the entitlement check passing:

- The widget renders the locked UI (same as above).
- The 403 is NOT logged as an error — it is an expected defensive case.

Locked UI required elements (all via i18n):

- Lock icon (from `@repo/icons`).
- Copy: i18n key `dashboard.host.views.locked.description`.
- CTA button: i18n key `dashboard.host.views.locked.cta`, href `/billing/plans`.

### 5.3 Detail page chip mount point

The `EntityViewStatChips` component is injected into the entity detail pages via the
existing section/card system — NOT by modifying the route component directly.

Preferred approach: add a new section config entry of type `'stats-chips'` in
the accommodation/post/event consolidated config
(`apps/admin/src/features/{accommodations|posts|events}/config/`).
The `EntityViewContent` component already renders section configs via `SectionConfig`.
The stats-chips section:

- Has `viewOnly: true` (not rendered in edit mode).
- Is positioned near the top of the accordion (before the main info section).
- Is hidden when the user lacks `ANALYTICS_VIEW` permission.

If the `SectionConfig` type does not natively support a `'stats-chips'` variant, add
`'stats-chips'` to the `SectionConfig` union type and add a case in the section
renderer — this is additive and does not break existing sections.

### 5.4 "Vistas (30d)" derived column

The column is a **derived column** — it is NOT part of the entity's primary API
response. It is populated by a secondary `useQuery` call inside the list page that:

1. Fires AFTER the main entity list query resolves (triggered by a `useEffect` or
   `enabled: !!entityIds.length` in TanStack Query).
2. Calls `GET /api/v1/admin/views/batch?entityType=ACCOMMODATION&entityIds=...&window=30d`.
3. The result is stored in a local `Map<entityId, number>` (keyed by total views).
4. The column cell renderer reads from this map.

The column definition in the entity config must be added as a `ColumnDef` entry of type
`'derived'` (or an equivalent custom column type). The column header does NOT include
sort functionality — `enableSorting: false` (TanStack Table flag, or equivalent in
the entity list framework).

The batch query `staleTime` is set to 5 minutes (`5 * 60 * 1000`) — the same as
`business.tsx` entity count queries — since view counts are not real-time.

### 5.5 `/analytics/views` page structure

The page follows the exact structural pattern of `business.tsx`:

- Imports `SidebarPageLayout`, `Card`, `CardHeader`, `CardTitle`, `CardContent`.
- Uses `useQueries` or multiple `useQuery` hooks for parallel data fetching.
- Route: `createFileRoute('/_authed/analytics/views')`.

Three sections rendered in order:

1. **Summary tiles** — `useQuery(['admin-views-summary', window])` →
   `GET /api/v1/admin/views/summary?window={window}`.
   Three `Card` components (one per entity type) with `WindowToggle` above them.
2. **Top-10 ranked lists** — Three side-by-side tables, one per entity type.
   `useQuery(['admin-views-top', type])` → `GET /api/v1/admin/views/top?entityType={type}&window=30d&limit=10`.
   Entity name resolution: after the top-10 ids are known, a second query batch-fetches
   entity names from the existing admin list endpoints filtered by id. The name is then
   joined in-component.
3. **30d time-series chart** — `useQuery(['admin-views-daily-series'])` →
   `GET /api/v1/admin/views/daily-series`.
   Rendered as a `ResponsiveContainer > LineChart` with three `Line` components:
   - ACCOMMODATION: `stroke="#2563eb"` (blue-600, or design token equivalent).
   - POST: `stroke="#16a34a"` (green-600).
   - EVENT: `stroke="#d97706"` (amber-600).
   The `XAxis` uses the `date` field (format: 'DD/MM' abbreviated). The `YAxis` is
   auto-scaled. A `Tooltip` shows exact values on hover. A `Legend` identifies the
   three lines.
   recharts is already a dependency — no new package needed.

### 5.6 Empty states, loading states, error states

| Surface | Loading | Empty | Error |
|---|---|---|---|
| HOST views widget | Skeleton rows | i18n `dashboard.host.views.empty` | If 403 → locked state; otherwise error callout with retry |
| EDITOR views widgets | Skeleton rows | i18n `dashboard.editor.views.empty` | Error callout with retry |
| Admin summary card | Skeleton tiles | Three tiles with "0" | Error callout with retry |
| Detail chips | Skeleton chips | Show "0" chips | Show "—" chips |
| List column | "…" per cell | "0" | "—" per cell |
| Analytics page chart | Chart skeleton | Zero-filled lines (no empty state needed) | Error callout |
| Analytics page top-10 | Skeleton rows | "Sin vistas en este período" | Error callout |

### 5.7 Accessibility

- All chip labels include `aria-label` with the full description (e.g., "7 días:
  42 visitantes únicos").
- The `WindowToggle` component uses `role="group"` with an `aria-label` ("Período de
  tiempo").
- The recharts chart includes a `title` element (set via recharts `title` prop) and
  the `Legend` component for screen-reader identification.
- The locked state CTA button is keyboard-focusable and has a descriptive `aria-label`.

---

## 6. Testing Strategy

### 6.1 Unit tests — new model methods

File: `packages/db/src/models/entity-view/__tests__/entity-view-admin.model.test.ts`

- `getTopViewedEntities`: mock `db.execute`; seed a fixture array of raw rows with
  varying totals; assert returned array is ordered by `total DESC` and length ≤ `limit`.
- `getTopViewedEntities`: given an empty fixture, assert empty array returned.
- `getDailySeries`: mock `db.execute`; seed rows for 3 entity types across a 10-day
  window; assert all returned rows have valid `date` strings in `'YYYY-MM-DD'` format.
- `getDailySeries`: SQL semantics note — the GAP-FILL logic (ensuring zero-count days
  appear) is a SERVICE concern, not a MODEL concern; assert the model does NOT
  gap-fill (only returns days with data).
- `getAdminSummaryTotals`: mock `db.execute`; verify grouped result normalized to
  per-entityType shape.

> SQL semantic edge cases (uniqueness, dedup window correctness) are validated in the
> **real-DB smoke task** (T-016, final phase) — unit tests use mocks and focus on
> shape and ordering only.

### 6.2 Service permission tests

File: `packages/service-core/src/services/entityView/__tests__/entityView-admin.service.test.ts`

- `getAdminSummary` called without `ANALYTICS_VIEW` → returns `ServiceError` with
  code `PERMISSION_DENIED`.
- `getAdminBatch` with `entityIds.length > 100` → returns `ServiceError` with code
  `VALIDATION_ERROR`.
- `getAdminTopEntities` with `limit > 50` → returns `ServiceError` with code
  `VALIDATION_ERROR`.
- `getAdminDailySeries` with a valid actor → calls `model.getDailySeries` and
  gap-fills the result to 90 rows (3 types × 30 days).
- `getAdminDailySeries` gap-fill: given model returns 5 rows, the service returns
  exactly 90 rows with missing days filled with `total: 0`.

### 6.3 Admin route integration tests

File: `apps/api/src/routes/views/admin/__tests__/views-admin.routes.test.ts`

For each of the four endpoints:

- Without `ANALYTICS_VIEW` permission → 403.
- With `ANALYTICS_VIEW` permission → 200 with correct response shape (validated
  against the Zod response schema).
- `GET /admin/views/batch` with `entityIds` containing 101 items → 400 validation error.
- `GET /admin/views/batch` with invalid UUID in `entityIds` → 400 validation error.
- `GET /admin/views/top` with `limit=0` → 400 validation error.
- `GET /admin/views/top` with `limit=51` → 400 validation error.
- `GET /admin/views/daily-series` → 200; response has exactly 90 rows (3×30);
  every row has a valid `date` string.

### 6.4 Admin component tests

**WindowToggle**:
`apps/admin/src/components/views/__tests__/WindowToggle.test.tsx`

- Renders with `value='30d'`; 30d button has active state; 7d button does not.
- Clicking 7d button calls `onChange('7d')`.
- When `disabled=true`, clicking either button does NOT call `onChange`.

**HOST locked state**:
`apps/admin/src/lib/dashboard-sources/__tests__/host-views.test.ts`

- Given entitlements that do NOT include `view_basic_stats`, the resolver returns
  `{ locked: true }` and does NOT call `fetchApi` for the views endpoint.
- Given entitlements that DO include `view_basic_stats`, the resolver calls
  `fetchApi` with the correct path and `window` param.

**"Vistas (30d)" column**:
`apps/admin/src/features/accommodations/__tests__/views-column.test.tsx`
(and equivalent for posts, events)

- Column is present in the rendered table when user has `ANALYTICS_VIEW`.
- Column is absent when user lacks `ANALYTICS_VIEW`.
- Column shows skeleton during batch-stats loading.
- Column shows "—" when batch stats call fails.

**Analytics page — chart renders**:
`apps/admin/src/routes/_authed/analytics/__tests__/views.test.tsx`

- Given mocked `daily-series` response with 90 rows, the chart renders without
  error (smoke test — does not assert exact pixel positions).
- Three `Line` components are present in the recharts tree.

### 6.5 Full-suite and build gate

Following the SPEC-159 lesson: before opening the PR, run:

1. `pnpm typecheck` across all affected packages.
2. `pnpm test` for the full suite (`packages/db`, `packages/service-core`,
   `apps/api`, `apps/admin`).
3. `pnpm build` — cross-package import errors only surface at build time.
   The build must be green before the PR is opened.

### 6.6 Real-DB smoke task (T-016)

After all unit and integration tests pass, run a real-DB smoke against a
local seeded database:

1. `pnpm db:fresh-dev` to reset and seed the database.
2. Fire 10–20 view beacon requests via `POST /api/v1/public/views` for a mix of
   entity types and entity IDs (can use `curl` or a seed script).
3. Call `GET /api/v1/admin/views/summary?window=30d` and verify the counts are
   non-zero and match expectations.
4. Call `GET /api/v1/admin/views/daily-series` and verify today's row is non-zero.
5. Call `GET /api/v1/admin/views/top?entityType=ACCOMMODATION&limit=10` and verify
   the ranked order is correct.
This task must be completed and sign-off noted in the PR description.

---

## 7. Suggested Tasks

### Phase 0 — Setup and verification (unblocks all phases)

| # | Task | Complexity | Blocks |
|---|------|:---:|---|
| T-001 | Verify `ANALYTICS_VIEW` permission is assigned to ADMIN and SUPER_ADMIN roles in `rolePermissions.seed.ts`. Verify `VIEW_BASIC_STATS` is in `EntitlementKey` (confirmed in `packages/billing/src/types/entitlement.types.ts`). Document findings. | 1 | T-004, T-007, T-008, T-013 |
| T-002 | Verify the `TrackableEntityTypeSchema` and existing `EntityViewStatsSchema` exports are accessible from `@repo/schemas/entityView`. Confirm `EntityViewWindowSchema` accepts `'7d'` and `'30d'`. Document. | 1 | T-005, T-006 |
| T-003 | Add `zodError` translation keys for new schemas (`zodError.adminView.batch.entityIds.empty`, `zodError.adminView.batch.entityIds.tooMany`, `zodError.adminView.dailySeries.date.invalid`) to `packages/i18n/src/locales/{es,en,pt}/validation.json`. | 1 | T-006 |

### Phase 1 — Core backend: new model methods and schemas

| # | Task | Complexity | Blocks |
|---|------|:---:|---|
| T-004 | Add `getTopViewedEntities` to `EntityViewModel` in `entity-view.model.ts` (§4.1 method A). Add unit tests in `entity-view-admin.model.test.ts`. | 3 | T-007 |
| T-005 | Add `getDailySeries` to `EntityViewModel` (§4.1 method B). Add unit tests. | 3 | T-007 |
| T-006 | Add `getAdminSummaryTotals` to `EntityViewModel` (§4.1 method C — groups by entityType without IN-list). Add new Zod schemas to `@repo/schemas/entityView` (§4.4). Add unit tests. | 3 | T-007 |
| T-007 | Add `getAdminSummary`, `getAdminBatch`, `getAdminTopEntities`, `getAdminDailySeries` to `EntityViewService` (§4.2). Add service permission tests. Preserve lazy getter pattern — no constructor dereference of `@repo/db` exports. | 3 | T-008 |

### Phase 2 — Admin API routes

| # | Task | Complexity | Blocks |
|---|------|:---:|---|
| T-008 | Create `apps/api/src/routes/views/admin/index.ts` and `summary.ts` implementing `GET /admin/views/summary` (§4.3). Add route integration tests. Add `endpoint-gate-matrix.md` row. | 2 | T-013 |
| T-009 | Create `apps/api/src/routes/views/admin/batch.ts` implementing `GET /admin/views/batch` (§4.3). Add route integration tests (including the 101-item and invalid-UUID cases). Add gate-matrix row. | 2 | T-014, T-015 |
| T-010 | Create `apps/api/src/routes/views/admin/top.ts` implementing `GET /admin/views/top` (§4.3). Add route integration tests. Add gate-matrix row. | 2 | T-015 |
| T-011 | Create `apps/api/src/routes/views/admin/daily-series.ts` implementing `GET /admin/views/daily-series` (§4.3). Add route integration tests (90-row invariant). Add gate-matrix row. | 2 | T-015 |

### Phase 3 — Admin frontend: shared component and dashboard

| # | Task | Complexity | Blocks |
|---|------|:---:|---|
| T-012 | Implement `WindowToggle` component in `apps/admin/src/components/views/WindowToggle.tsx` (§5.1). Add component tests (`WindowToggle.test.tsx`). | 1 | T-013, T-014, T-015 |
| T-013 | Register `host.stats.views` source in `apps/admin/src/lib/dashboard-sources/host.ts` with locked-state detection logic (§5.2). Add i18n keys for locked state (es/en/pt). Update `dashboards.ts` HOST card G to replace the `deferredSlot` with a live `source`. Add component tests for locked-state behavior. | 3 | — |
| T-014 | Register `editor.posts.views` and `editor.events.views` sources in `apps/admin/src/lib/dashboard-sources/editor.ts`. Update `dashboards.ts` EDITOR cards E and F to replace their `deferredSlots` with live sources. Add component tests. | 2 | — |
| T-015 | Register `admin.views.summary` source in `apps/admin/src/lib/dashboard-sources/admin.ts`. Add new card `admin-card-views` to `adminBaseDashboard` in `dashboards.ts` (update the SPEC-155 card-count test accordingly). Add component tests. | 2 | — |

### Phase 4 — Entity detail page chips

| # | Task | Complexity | Blocks |
|---|------|:---:|---|
| T-016 (number re-used from smoke — rename to T-017 for chip task, T-016 goes to smoke at the end — see note) | Implement `EntityViewStatChips` component (`apps/admin/src/components/views/EntityViewStatChips.tsx`). Add it to the accommodation, post, and event entity view configs as a `'stats-chips'` section (§5.3). Gate on `ANALYTICS_VIEW` permission. Add component tests (loading/zero/error states, permission guard). | 3 | — |

> **Task numbering note**: T-016 was originally assigned to the real-DB smoke. To avoid
> renumbering, the chip task is T-016a and the smoke remains T-016 at the end of Phase 6.
> In the actual task state file, use sequential IDs T-016 (chips), T-017 (column), etc.;
> the smoke becomes the final task in the last phase.

### Phase 5 — List page derived column

| # | Task | Complexity | Blocks |
|---|------|:---:|---|
| T-017 | Add "Vistas (30d)" derived column to the accommodations entity config (§5.4). Implement the secondary `useQuery` batch-stats call. Add column tests (permission guard, loading state, error state, "0" for zero-view entities). | 3 | — |
| T-018 | Add "Vistas (30d)" column to posts and events entity configs following the same pattern as T-017. | 2 | — |

### Phase 6 — Analytics page and final smoke

| # | Task | Complexity | Blocks |
|---|------|:---:|---|
| T-019 | Create `apps/admin/src/routes/_authed/analytics/views.tsx` (§5.5). Implement summary tiles + `WindowToggle` + top-10 lists (with entity name resolution) + recharts 3-line daily series chart. Add i18n keys and page title. | 3 | T-020 |
| T-020 | Add component/page tests for `views.tsx` (§6.4 analytics page tests). Run full `pnpm typecheck + test + build` gate (§6.5). | 2 | T-016-smoke |
| T-016-smoke | Real-DB smoke (§6.6): seed DB, fire beacon requests, verify all four new admin endpoints return correct data, sign off in PR description. | 2 | PR open |

**Total: 20 tasks (T-001..T-020 + T-016-smoke = 21 entries; T-001..T-003 are setup/verification at complexity 1; core work T-004..T-019 at complexity 2–3).**

**Hard-gate dependencies**:

- T-003 (i18n keys) BLOCKS T-006 (schemas reference these keys).
- T-004, T-005, T-006 BLOCK T-007 (service needs all three model methods).
- T-007 BLOCKS T-008..T-011 (routes call the service).
- T-008..T-011 BLOCK T-013..T-015 (sources call the routes).
- T-012 (`WindowToggle`) BLOCKS T-013, T-014, T-015, T-019 (all use the component).
- T-020 (tests + build gate) BLOCKS T-016-smoke (no point running smoke if tests are red).

---

## 8. Risks

| Risk | Likelihood | Mitigation |
|---|:---:|---|
| `ANALYTICS_VIEW` NOT assigned to ADMIN/SUPER_ADMIN in seed | Low | T-001 explicit verification step before any code is written. |
| `COUNT(DISTINCT)` with no IN-list filter (`getAdminSummaryTotals`) scans the full `entity_views` table — could be slow at high volume | Medium | The existing compound index `idx_entity_views_entity_time` on `(entity_type, entity_id, viewed_at)` partially covers the query. For a platform of Hospeda's current scale this is acceptable; escalate to a covering index or matview if p95 > 200ms. |
| Entity name resolution for top-10 (second API call) adds latency | Medium | Use `useQuery` with `enabled: !!topEntityIds.length` so it fires after the top-10 ids are known. Cache with 5-minute `staleTime`. If the admin list endpoint does not support `?ids=...` filter, fetch entities individually with `Promise.all` (max 10 calls). |
| Dashboard card count test (SPEC-155 T-033) fails after adding `admin-card-views` | Low | T-015 explicitly updates the count assertion. The test file is `apps/admin/src/config/ia/__tests__/dashboards.config.test.ts`. |
| `DeferredWidget` removal from dashboards.ts breaks the config validation test | Low | T-013 / T-014 update the dashboard configs atomically — the deferred slot is removed and the live source is registered in the same commit so the config test never sees an intermediate state with a missing source. |
| recharts line chart with 90 rows renders slowly | Low | 90 data points is trivial for recharts. `ResponsiveContainer` with `debounce={200}` on resize avoids reflow jank. |
| HOST locked-state detection race: entitlements cache stale when views widget mounts | Low | The views resolver depends on the `host.billing.plan` query result. If that query has not resolved yet, the resolver should return `{ locked: false, loading: true }` (optimistic assumption, pending real data). Once entitlements resolve and `view_basic_stats` is absent, the resolver re-evaluates and switches to locked state. |

---

## 9. Internal Review Notes

### Strengthened items

1. **`getAdminSummaryTotals` as a third model method**: the context from SPEC-159
   shows `getStatsForEntities` requires an `entityIds` IN-list. A platform-wide
   summary cannot supply "all entity IDs". Rather than calling the model three times
   with a prohibitively large id list, a new model method (`getAdminSummaryTotals`)
   that groups by `entity_type` without an IN-list is the correct design — specified
   explicitly in §4.1 and §4.2.

2. **Locked-state detection is proactive**: the spec explicitly states that
   entitlement detection reads from the already-cached `host.billing.plan` query
   result. This avoids a double API call and is consistent with the existing
   dashboard source pattern (the `host.billing.plan` resolver already fetches
   `GET /api/v1/protected/users/me/entitlements`).

3. **Dashboard card count test**: the SPEC-155 config validation test in
   `dashboards.config.test.ts` asserts exact card counts. Adding `admin-card-views`
   increments the ADMIN count. T-015 explicitly updates this test to prevent CI
   breakage.

4. **`zodError` translation keys (GAP-010)**: all new Zod schema error message keys
   are listed in §4.4 and their addition to `validation.json` is an explicit task
   (T-003). This is the most commonly overlooked step in new schema work.

5. **recharts already in dependencies**: confirmed from the locked context. No new
   package installation needed.

6. **`ANALYTICS_VIEW` permission exists**: confirmed in
   `packages/schemas/src/enums/permission.enum.ts` as `analytics.view`. Confirmed
   assigned to ADMIN and SUPER_ADMIN in `rolePermissions.seed.ts`.

7. **`VIEW_BASIC_STATS` entitlement exists**: confirmed in
   `packages/billing/src/types/entitlement.types.ts` as
   `EntitlementKey.VIEW_BASIC_STATS = 'view_basic_stats'`. Present on all 6 active
   host/owner plan definitions (`owner-basico`, `owner-pro`, `complex-basico`,
   `complex-pro`, `complex-premium`, and the premium/trial plan at line 213 of
   `plans.config.ts`). The locked state triggers for hosts with no active plan
   or an expired trial.

8. **`AS "unique"` quoting rule enforced**: both new SQL methods (`getTopViewedEntities`,
   `getDailySeries`) use `::int` cast aliases with double-quoted reserved words where
   applicable. The spec text calls this out explicitly in §4.1.

9. **`EntityViewService` constructor lazy-getter pattern preserved**: the spec
   explicitly states the constructor MUST NOT dereference `@repo/db` exports, and
   T-007 calls this out as a task constraint. The service file's existing comment
   (`IMPORTANT: do NOT dereference @repo/db exports here`) is the reference.

10. **`endpoint-gate-matrix.md` rows for all four admin routes**: the matrix format
    requires a row per route. §4.3 specifies `Decision = none` with a clear Reason for
    all four new admin routes (admin-tier routes are permission-gated by the route
    factory, not by billing entitlement).

### Open questions

None. All design decisions were pre-approved by the owner and are encoded in this spec.
The only "verify before building" item is T-001 (confirm seed assignment of
`ANALYTICS_VIEW`) and T-002 (confirm schema exports) — both are low-risk verifications,
not architectural forks.
