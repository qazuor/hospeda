---
specId: SPEC-289
title: Search History
type: feat
complexity: medium
status: in-progress
created: 2026-06-26
tags: [tourist, search-history, entitlements, web]
---

# SPEC-289 — Search History

> Builds a feature that today is only a **phantom gate**. Surfaced during the
> SPEC-282 review. Open questions resolved by the owner on 2026-06-29.

## 1. Summary

The entitlement `CAN_VIEW_SEARCH_HISTORY` is granted on paid tourist plans, but the
feature **does not exist**: `gateSearchHistory()` in
`apps/api/src/middlewares/tourist-entitlements.ts` is a
`// PHANTOM-GATE (SPEC-145): route not built yet`. No storage, no route, no UI.

This spec builds search history: persist an authenticated tourist's past searches
and let them view, re-run, and manage them, with **per-plan entry-count limits**
(Free = no access, Plus = last 50, VIP = last 200).

## 2. Context (verified 2026-06-29)

- **Phantom gate, fully shaped:** `gateSearchHistory()` (`tourist-entitlements.ts:344`)
  is a complete entitlement-only gate. It just needs a route to mount it, and a
  second limit-check step (OQ-1).
- **Entitlement already wired:** `CAN_VIEW_SEARCH_HISTORY` exists in the enum
  (`packages/billing/src/types/entitlement.types.ts:43`), in the definitions array
  (`entitlements.config.ts:195`), and is granted to `tourist-plus`, `tourist-vip`,
  and all `owner-*`/`complex-*` plans (via `TOURIST_VIP_ENTITLEMENTS`). `tourist-free`
  gets nothing. **No billing change needed for access.**
- **No `LimitKey` for search history** exists yet — this spec adds one.
- **SPEC-282 table** already has a `searchHistory` row with `status: 'upcoming'` and
  hardcoded `['no','yes','yes']` (`PlanComparisonTable.astro:96`).
- **SPEC-284** imposes no read contract today → OQ-3 is unblocked.

## 3. Goals

- **G-1** Persist authenticated users' searches (query + filters + timestamp).
- **G-2** A web surface (dedicated page under `mi-cuenta`) to view, re-run, and
  manage past searches.
- **G-3** Mount `CAN_VIEW_SEARCH_HISTORY` + a new per-plan entry-count limit.

## 4. Non-Goals

- No analytics/recommendation use of history in v1 (that feeds SPEC-284 later).
- No anonymous (pre-login) history persistence.
- No cross-device "resume search" beyond re-running a stored query.

## 5. Resolved Decisions (was Open Questions)

- **OQ-1 — per-plan differences → RESOLVED: entry-count limit.**
  New `LimitKey.MAX_SEARCH_HISTORY_ENTRIES`. Free = no access (entitlement-gated),
  Plus = 50, VIP = 200 (owner/complex inherit VIP via `TOURIST_VIP_LIMITS`). The
  gate becomes two-step (entitlement + limit), mirroring `gateAlerts()`. The
  SPEC-282 comparison cell changes from `literals` to a `limit`-kind cell so it
  renders the real numbers (50 / 200).
- **OQ-2 — privacy → RESOLVED: full self-service.**
  Users can (a) delete an individual entry, (b) clear all history, and (c) opt out
  (pause recording) via a persisted preference. Deletion is a **hard delete**
  (privacy: "delete" means gone), diverging from the soft-delete default — this is a
  deliberate, documented deviation for a privacy-sensitive log.
- **OQ-3 — SPEC-284 relationship → RESOLVED: no coupling in v1.**
  Schema is conservative and readable (`userId + queryText + filtersJson + createdAt`)
  so SPEC-284 can later declare its own read pattern without a migration.

## 6. Technical Design

### 6.1 Persistence (`@repo/db`)

New table `user_search_history` (Carril 1, Drizzle migration via `pnpm db:generate`).
Reference model: `user_bookmarks` (`userBookmark.model.ts`).

Columns:

- `id` uuid PK default random
- `userId` uuid NOT NULL, FK → `users.id` `onDelete: 'cascade'`
- `queryText` text (nullable; the free-text `q`)
- `filtersJson` jsonb `$type<AccommodationSearchFilters>()` — the storable subset of
  `AccommodationSearchHttpSchema` (destination, price, guests, dates, amenities, etc.)
- `resultCount` integer (nullable; number of hits at search time, cheap signal)
- `createdAt` timestamptz default now

No soft-delete columns (append-only + hard delete). Index on `(userId, createdAt desc)`
for the "last N" read. Optional partial dedup is a non-goal for v1.

Opt-out preference: store on the existing user/profile preferences (locate the
current preferences carrier during T-002; if none fits cleanly, add a single
`searchHistoryEnabled boolean default true` column on the users/profile table).

### 6.2 Billing limit (`@repo/billing`)

Add `MAX_SEARCH_HISTORY_ENTRIES` in the three required places:

1. `packages/billing/src/types/plan.types.ts` (enum)
2. `packages/billing/src/config/limits.config.ts` (`LIMIT_METADATA`)
3. `apps/api/src/utils/limit-check.ts` (`RESOURCE_NAMES`)

Plan values in `plans.config.ts`: Plus = 50, VIP = 200, via `TOURIST_VIP_LIMITS` so
owner/complex inherit. Free gets no entitlement, so no limit entry needed.

**Trim semantics:** on each record, after insert, hard-delete this user's rows beyond
the largest plan cap (200) to bound storage; the *read* endpoint returns the last
`min(plan limit, stored)` rows. This keeps storage bounded and makes plan up/downgrade
behave intuitively (a downgraded VIP→Plus user sees the most recent 50).

### 6.3 API (`apps/api`)

- **Write hook:** in `accommodation/public/list.ts` after a successful
  `accommodationService.search()` (line ~164), fire-and-forget record when
  `actor.isAuthenticated && actor has CAN_VIEW_SEARCH_HISTORY && searchHistoryEnabled`.
  Must never block or fail the search response (wrap in try/catch, log on error).
- **Read/manage routes** (protected tier, `/api/v1/protected/search-history`):
  - `GET /` — list last N (gated by `gateSearchHistory()` two-step).
  - `DELETE /:id` — delete one entry (owner-scoped).
  - `DELETE /` — clear all.
  - `PATCH /preferences` (or reuse existing preferences route) — toggle opt-out.
- Service in `@repo/service-core` (`SearchHistoryService`), thin routes.
- Schemas in `@repo/schemas` (entity + http), single source of truth.
- Add an `endpoint-gate-matrix.md` row per new route (SPEC-145 CI guard).

### 6.4 Web (`apps/web`)

- Dedicated page under `mi-cuenta` (e.g. `/[lang]/mi-cuenta/historial-busquedas`),
  protected. Lists entries with: query summary, "re-run" (rebuilds the search URL and
  navigates), delete-one, clear-all, and an opt-out toggle.
- Vanilla CSS / CSS Modules + native HTML form + small hook (web conventions).
- i18n keys (es/en/pt) for all copy.

### 6.5 SPEC-282 comparison table

Flip the `searchHistory` row in `PlanComparisonTable.astro:96` from
`status: 'upcoming'` literal to an available `limit`-kind cell keyed on
`MAX_SEARCH_HISTORY_ENTRIES` (Free shows "—"/No, Plus 50, VIP 200).

## 7. Phasing

- **P1 — Data + billing:** schema/migration, model, `LimitKey` (3 files), plan values,
  schemas. Tests for model + limit config.
- **P2 — API:** service, write-hook, read/manage routes, two-step gate wiring,
  gate-matrix rows. Route + service tests.
- **P3 — Web:** mi-cuenta page, re-run, manage actions, opt-out, i18n. Component tests.
- **P4 — SPEC-282 + polish:** flip comparison row, docs, manual smoke.

## 8. Acceptance Criteria

- AC-1 Authenticated Plus/VIP search → entry appears in history; Free → no entry.
- AC-2 History capped at plan limit (50/200); downgrade shows most recent N.
- AC-3 Re-run reproduces the original search results.
- AC-4 Delete-one and clear-all remove rows (hard delete); opt-out stops recording.
- AC-5 Unauthenticated search records nothing; search latency unaffected (fire-and-forget).
- AC-6 SPEC-282 table shows real per-plan numbers.
