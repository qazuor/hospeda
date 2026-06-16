---
spec-id: SPEC-207
title: Host Analytics & KPIs — Business Dashboard in Web
type: epic
complexity: high
status: in-progress
created: 2026-06-07T00:00:00Z
parentSpec: SPEC-205
dependsOn: [SPEC-205, SPEC-206]
---

# SPEC-207 — Host Analytics & KPIs (Business Dashboard in Web)

## Overview

**Goal.** Give hosts a business dashboard in `apps/web` (`/mi-cuenta/host-dashboard`)
with KPI widgets backed by real analytics aggregation endpoints: accommodation
views, favorites, response rate, inquiry trend, and market comparison.

This is Phase 3 of the host migration (after SPEC-205 host web foundation and
SPEC-206). The dashboard shell and five widget components were built in an earlier
slice, but the wiring was never completed end-to-end. This spec tracks both what
was already shipped and what remains.

## Current state (as of 2026-06-13)

The host dashboard renders four summary widgets (properties / plan / unread
messages / quick actions) plus an `AnalyticsSection` containing five analytics
widgets. A 2nd-pass review of the page found the analytics section was fully
dead and several wiring bugs:

- **Entitlement gate case mismatch** — `AnalyticsSection` gated on the literal
  `'VIEW_BASIC_STATS'` while the backend emits `'view_basic_stats'`, so the
  section was **always** locked, even for entitled hosts.
- **All 5 analytics endpoints 404'd** — the frontend called
  `/api/v1/protected/host/analytics/*`, a prefix that does not exist. The real
  routes live under `/views/*`, `/conversations/*`, and `/accommodations/*`.
- **Transform shape mismatches** — several transforms read field paths the
  backend never returns.
- **Views design mismatch** — the `ViewsWidget` renders a daily time series
  (`{date, count}[]`), but no protected per-host daily-series endpoint exists.
  The backend only exposes a cumulative aggregate per accommodation
  (`{entityId, unique, total}[]`); the only daily-series endpoint is admin-only.
- **Favorites concept mismatch** — the `FavoritesWidget` renders "collections",
  a concept that does not exist in the bookmark model. The backend returns
  favorites per accommodation (`{accommodationId, slug, bookmarkCount}[]`).
- **Missing i18n keys** — `host.dashboard.{widgets,plan,quickActions,…}.*` were
  absent from all locales, degrading en/pt to Spanish fallbacks (and showing raw
  keys for quick actions).

### Shipped in the cabling pass (PR for `fix/web-mi-cuenta-host-dashboard`)

Web-only fixes that needed no backend work, landed ahead of this epic:

1. Fixed the entitlement gate to `'view_basic_stats'` (sourced as a documented
   client-safe literal, mirroring how `@repo/schemas` keeps entitlement keys as
   plain strings).
2. Re-pointed the wired endpoints to their real routes:
   `/conversations/me/response-rate`, `/conversations/me/monthly-inquiries`,
   `/accommodations/my/market-comparison`.
3. Fixed `transformMarketComparison` to read the backend `comparisons` wrapper.
4. Gated the market widget behind `'view_advanced_stats'` (it is only fetched
   and rendered when the host holds that entitlement; otherwise it is hidden,
   not shown as an error).
5. Added all missing `host.dashboard.*` i18n keys in es/en/pt.
6. **Mounted the Views widget as a per-property ranked list** — using the
   existing cumulative endpoint (`/views/accommodations/me?window=7d|30d`,
   `{entityId, unique, total}[]`) crossed with the host's accommodations list
   (`/accommodations?pageSize=50`) to resolve id→name. The widget shows the
   top accommodations by total views with a 7d/30d toggle (the toggle re-fetches
   ONLY views and re-crosses against the already-loaded names map — no full
   section re-fetch).
7. **Deferred the Favorites widget** — still not mounted: the backend returns
   favorites per accommodation, not "collections"; the widget needs a redesign.
   Its component, API method, transform, and type remain in the tree as the
   contract to fulfil, documented with SPEC-207 references.

## Remaining work (this spec)

### A. Accommodation views — daily-series chart — ✅ DONE (branch `spec/SPEC-207-analytics-completion`, 2026-06-15)

Implemented: a new protected per-host daily-series endpoint
`GET /api/v1/protected/views/accommodations/me/daily-series?window=7d|30d`
(`VIEW_BASIC_STATS`, owner-scoped via `findIdsByOwnerId`, gap-filled) plus a
recharts `LineChart` in `ViewsWidget` above the existing ranked list; the
7d/30d toggle drives both. Original optional-scope note kept below.

The per-property ranked Views widget already shipped (see cabling pass #6),
using the cumulative endpoint. What remained was OPTIONAL polish, not a blocker:

- If a time-trend chart is wanted, build a **protected** per-host daily-series
  views endpoint returning `{ window: '7d'|'30d', items: { date, count }[] }`
  scoped to the host's own accommodations (gap-filled), gated by
  `VIEW_BASIC_STATS`. Reference the admin daily-series endpoint
  (`/api/v1/admin/views/daily-series`) and the `entityView` service, scoped to
  `actor.id`'s accommodations. Then add a chart view alongside the current list.

### B. Favorites widget redesign (per-accommodation) — ✅ DONE (branch `spec/SPEC-207-analytics-completion`, 2026-06-15)

Implemented (100% frontend — the backend endpoint already existed): fixed the
client URL to `/accommodations/my/favorites-breakdown`, reshaped the type and
transform to `{accommodationId, slug, bookmarkCount}`, redesigned the widget as
a per-property bar list, and mounted it in `AnalyticsSection` gated by
`VIEW_ADVANCED_STATS`. Original task note kept below.

- Redesign `FavoritesWidget` + `FavoritesBreakdownData` to the real backend
  shape: favorites per accommodation (`{accommodationId, slug, bookmarkCount}`),
  rendered as a per-property list/bar. Drop the non-existent "collections"
  concept. Gated by `VIEW_ADVANCED_STATS`.
- Re-mount it in `AnalyticsSection`, restore the `getFavoritesBreakdown` call and
  fix the transform.

### C. End-to-end verification — ✅ DONE (local smoke, 2026-06-15)

Smoke executed locally in a real browser (Chrome) as `host-pro@local.test`
(owner-pro). **Correction to the earlier "local always degrades to
owner-basico" note:** that is only true when billing is fully unconfigured.
Setting `HOSPEDA_QZPAY_TEST_CONTROL_ENABLED=true` marks billing as configured,
so `loadEntitlements()` reads the seeded `billing_subscriptions` row and the
host receives `view_advanced_stats`. With test data seeded (3 accommodations +
views over 30 days + bookmarks), the smoke confirmed:

- **Views**: daily-series chart renders with real data; 7d/30d toggle re-fetches
  both chart and ranked list (total 120 ↔ 23); endpoint `→ 200`.
- **Favorites**: per-property bars (3/2/1); endpoint `→ 200`.
- **Advanced gating** works (favorites + market shown, not locked).
- No console errors.

The smoke also surfaced an unrelated pre-existing bug, **fixed in this PR**:
the market-comparison widget 403'd for every real host because
`getHostMarketComparison` still gated on `ACCOMMODATION_VIEW_ALL` (removed from
HOST by SPEC-169). Changed to `ACCOMMODATION_VIEW_OWN` + regression test; widget
now renders the comparison table.

A staging smoke against production-like infra is still nice-to-have post-merge
but NOT a blocker — SPEC-207 touches no MercadoPago path, so test-control covers
the relevant surface. Original staging-oriented notes kept below.

## Out of scope

- **Plan resolution unification.** During the review we confirmed there are four
  divergent plan/entitlement resolution paths (DB-direct in `/users/me/stats`
  vs QZPay in `/host/dashboard` and `/entitlements`), and that when billing is
  unconfigured at init, HOST actors silently fall back to `owner-basico` limits
  without a 503 (entitlement middleware, by design — BETA-42). This is documented
  deliberate degradation, **not** a bug, and unifying the paths / adding
  init-failure observability belongs to a separate billing spec, not here.
- A "favorites collections" feature (a real collections model + management UI).
  Not planned.

## Decisions

- **D1 — Favorites are per-accommodation, not collections.** The bookmark model
  has no collection concept; the widget adapts to the real per-accommodation
  shape.
- **D2 — Views needs a new protected daily-series endpoint.** The cumulative
  aggregate the backend exposes today cannot drive the daily bar chart; rather
  than reshape the widget to aggregates, we build the endpoint the widget was
  designed for (per task A).
- **D3 — Entitlement keys in the web client are plain string literals** matching
  the backend wire values, never imported from `@repo/billing` (server-only
  deps must not enter the client bundle).

## Tasks (high level — to be atomized via task-master)

1. T-A1: protected per-host daily-series views service method + query.
2. T-A2: protected route `/views/accommodations/me/daily-series` (or equivalent) + response schema in `@repo/schemas`.
3. T-A3: re-wire `getViews` + `transformAccommodationViews` + re-mount `ViewsWidget`; tests.
4. T-B1: redesign `FavoritesWidget` + `FavoritesBreakdownData` to per-accommodation; tests.
5. T-B2: re-wire `getFavoritesBreakdown` + `transformFavoritesBreakdown` + re-mount; tests.
6. T-C1: staging smoke on `owner-pro` / `owner-premium`; sign-off.
