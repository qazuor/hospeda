---
spec-id: SPEC-260
title: AI Usage Dashboard
type: feature
complexity: high
status: in-progress
created: 2026-06-22
---

# SPEC-260: AI Usage Dashboard

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal.** Give platform administrators a dashboard in the admin panel to see AI
consumption (calls, tokens, and cost) broken down by **feature**, **model**,
**provider**, and the **feature × model** cross, over a selectable time window,
with both monthly rollups and a daily time-series, rendered as filterable tables
plus charts.

**Motivation.** The metering backend already records every AI call with **real
provider token counts** and a computed cost in micro-USD (`ai_usage` table,
`recordAiUsage`). Three admin endpoints already expose aggregates by month, by
user, and by feature, but there is **no UI** that consumes them, and there is **no
aggregation by model or by provider**. As a result the owner cannot answer the one
question that drives model-selection decisions: *"inside the `chat` feature, how
much did `gpt-4o-mini` cost versus `claude-3-5-haiku`?"*. This spec closes that gap.

**Success metrics.**

- An admin with `AI_SETTINGS_MANAGE` can open a single page and read, for any
  selected month, the total AI spend and its breakdown by feature, by model, by
  provider, and by feature × model.
- The numbers shown reconcile exactly (±0 micro-USD) with the existing
  `/admin/ai/usage/by-feature` endpoint for the same window (same source table).
- The owner can identify, per feature, which model is cheapest per call and per
  1k tokens, directly from the dashboard, with no SQL.

**Target users.** Platform super-admins (the `AI_SETTINGS_MANAGE` permission is
`SUPER_ADMIN`-only, identical to the existing AI settings/usage surface).

### 2. User Stories & Acceptance Criteria

#### US-1 — View total + per-dimension breakdown for a month

> As a super-admin, I want to select a calendar month and see total AI spend plus
> a breakdown by feature, model, and provider, so I understand where money goes.

- **AC-1.1** Given I am authenticated with `AI_SETTINGS_MANAGE`, when I open
  `/ai/usage`, then the page loads defaulting to the current calendar month (UTC)
  and shows a **totals** card (calls, tokensIn, tokensOut, cost in USD).
- **AC-1.2** Given the page is loaded, then a **By feature** table lists each
  feature with calls, tokensIn, tokensOut, and cost, ordered by cost descending.
- **AC-1.3** Given the page is loaded, then a **By model** table lists each model
  with calls, tokensIn, tokensOut, cost, and a derived **cost per 1k tokens**,
  ordered by cost descending.
- **AC-1.4** Given the page is loaded, then a **By provider** table lists each
  provider (`openai`, `anthropic`, `stub`) with calls, tokens, and cost.
- **AC-1.5** Given a month with zero `ai_usage` rows, then every table renders an
  explicit empty state ("No AI usage recorded for this period") and the totals
  card shows zeros, never a spinner stuck or a crash.

#### US-2 — Compare models within a feature (feature × model cross)

> As a super-admin, I want to see cost per model **within each feature**, so I can
> decide which model to assign to each feature.

- **AC-2.1** Given the page is loaded, then a **By feature × model** table lists
  one row per `(feature, model)` combination present in the window, with calls,
  tokensIn, tokensOut, cost, and cost per 1k tokens.
- **AC-2.2** Given the feature × model table, when I read a feature's rows, then I
  can compare two models used for the same feature side by side (e.g. `chat` +
  `gpt-4o-mini` vs `chat` + `claude-3-5-haiku`).
- **AC-2.3** Given the feature × model data, then a grouped bar chart renders cost
  per feature with one bar segment per model, so the comparison is visual.

#### US-3 — See the daily trend within the window

> As a super-admin, I want a daily time-series of cost, so I can spot spikes.

- **AC-3.1** Given the page is loaded, then a line/area chart shows daily total
  cost (one point per UTC day) across the selected window.
- **AC-3.2** Given a feature filter is applied, then the daily chart reflects only
  that feature's daily cost.
- **AC-3.3** Given days with no usage inside the window, then those days render as
  zero (continuous axis), not as gaps that distort the trend.

#### US-4 — Filter the report

> As a super-admin, I want to filter by feature, model, provider, and time window.

- **AC-4.1** Given filter controls, when I pick a `feature`, then every table and
  chart re-queries and reflects only that feature.
- **AC-4.2** Given filter controls, when I pick a `provider` and/or `model`, then
  the by-model / daily / feature×model views reflect the filter; filters compose
  (logical AND).
- **AC-4.3** Given a date-range mode, when I set `since` and `until`, then all
  views use that explicit range instead of the month picker; invalid ranges
  (`since > until`) are rejected client-side and server-side (422).
- **AC-4.4** Given any filter change, then the URL search params update so the
  filtered view is shareable/bookmarkable (TanStack Router search params).

#### US-5 — Permission gate

- **AC-5.1** Given a user **without** `AI_SETTINGS_MANAGE`, when they request any
  `/admin/ai/usage/*` endpoint, then the API returns `403 FORBIDDEN`.
- **AC-5.2** Given a non-super-admin in the admin SPA, when they navigate to
  `/ai/usage`, then the route guard blocks access consistently with the existing
  `/ai/settings` route.

### 3. UX Considerations

- **Layout.** Single page under the existing AI admin section, sibling to
  `ai/settings.tsx`, `ai/playground.tsx`, `ai/prompts.tsx`. A nav link is added to
  the AI group.
- **Controls (top bar).** Month picker (default) OR date-range toggle; feature
  select; provider select; model select. "Reset filters" action. Selected filters
  serialize to URL search params.
- **Sections (top → bottom).** (1) Totals card. (2) Daily cost chart. (3) By
  feature (table + bar chart). (4) By model (table + bar chart). (5) By provider
  (table). (6) By feature × model (table + grouped bar chart).
- **Cost formatting.** All cost is stored as integer micro-USD (1e6 = $1). The UI
  converts to USD with a shared formatter (e.g. `$0.0123`), never floats in
  storage. Token counts use thousands separators per locale.
- **Loading / error states.** Each query block has its own skeleton and an error
  state with a retry; one failing block must not blank the whole page.
- **Empty state.** Explicit per-table copy (see AC-1.5).
- **i18n.** All labels/copy in `@repo/i18n` (es/en/pt). No hardcoded strings.
- **Accessibility.** Tables use semantic `<table>`; charts have an accessible
  text alternative (the adjacent table is the canonical data; charts are
  decorative/secondary). Color is not the only signal in charts (labels present).

### 4. Out of Scope

- **CSV / Excel export** (owner-deferred 2026-06-22 — can be a future spec).
- **Per-user drilldown UI** (the `/by-user` endpoint already exists; not surfaced
  here beyond an optional `userId` filter passthrough — no dedicated user table in
  this spec).
- **Real-time / streaming updates** — the dashboard is request-time, refreshed on
  load/filter change only.
- **New cost-ceiling configuration UI** — ceilings are configured in the existing
  `ai/settings` surface; this spec only *reads* usage, it does not change ceilings.
- **Changing how cost is computed or how tokens are captured** — the metering
  pipeline (`recordAiUsage`, `model-rates.ts`) is unchanged.
- **Per-provider cost ceilings** — explicitly out of scope in SPEC-173 and remain so.

## Part 2 — Technical Analysis

### 5. Architecture

The existing pipeline is layered DB → ai-core storage → ai-core reporting →
API route → admin UI. This spec extends each layer **following the established
pattern**, adding no new architectural concept.

```
ai_usage (table, unchanged)
   └─ packages/ai-core/src/storage/usage.queries.ts   (NEW: byModel, byProvider, byFeatureModel, daily)
        └─ packages/ai-core/src/usage/reporting/usage-reporting.ts  (NEW public wrappers)
             └─ apps/api/src/routes/ai/usage/index.ts  (NEW: GET /by-model, /by-provider, /by-feature-model, /daily)
                  └─ apps/admin/src/routes/_authed/ai/usage.tsx  (NEW page: tables + recharts)
```

**Key constraint (AC-4 isolation).** Only `packages/ai-core/src/storage/` may
import `@repo/db`. New aggregation queries live there; reporting wrappers and
routes stay storage-agnostic. This mirrors the existing
`aggregateAiUsageByFeature` / `getUsageByFeature` split.

### 6. Data Model Changes

**None.** The `ai_usage` table already has every needed column: `feature`,
`provider`, `model`, `tokensIn`, `tokensOut`, `costEstimateMicroUsd`, `userId`,
`createdAt`, `status`. Existing indexes
`(userId, feature, createdAt desc)` and `(provider, feature, createdAt desc)`
cover the new group-bys adequately for the expected (low) row volume. No
migration, no `db:generate`, no extras carril.

> Performance note: the new `by-model` and `by-feature-model` group-bys are not
> directly index-covered on `model`. At Hospeda's volume this is a non-issue
> (sequential scan over a small, append-only table). If volume grows materially,
> a follow-up may add a `(model, createdAt)` index — flagged as a risk, not built now.

### 7. API Design

Four new read-only endpoints added to `apps/api/src/routes/ai/usage/index.ts`,
each a thin HTTP adapter over an `@repo/ai-core` reporting helper, guarded by
`AI_SETTINGS_MANAGE`, paginated with `page`+`pageSize` (NOT `limit`), validated
with Zod. Response rows validated against new schemas in `@repo/schemas`.

| Method | Path | Query params | Returns |
|---|---|---|---|
| GET | `/api/v1/admin/ai/usage/by-model` | `year`,`month` OR `since`,`until`; optional `feature`,`provider`; `page`,`pageSize` | rows `{ model, calls, tokensIn, tokensOut, costMicroUsd }` |
| GET | `/api/v1/admin/ai/usage/by-provider` | same window + optional `feature`; `page`,`pageSize` | rows `{ provider, calls, tokensIn, tokensOut, costMicroUsd }` |
| GET | `/api/v1/admin/ai/usage/by-feature-model` | window + `page`,`pageSize` | rows `{ feature, model, calls, tokensIn, tokensOut, costMicroUsd }` |
| GET | `/api/v1/admin/ai/usage/daily` | window + optional `feature`,`model`,`provider`; `page`,`pageSize` | rows `{ day: 'YYYY-MM-DD', calls, tokensIn, tokensOut, costMicroUsd }` |

**Window resolution** reuses the existing convention: `year`+`month` (calendar
month UTC) OR explicit `since`/`until` ISO dates with the existing
`since <= until` refine. The shared `YearSchema`/`MonthSchema` already in
`index.ts` are reused.

**Error responses.** `422 VALIDATION_ERROR` for bad params (existing factory);
`403 FORBIDDEN` without permission (existing guard). No new error codes.

Example response (`/by-feature-model`):

```json
{
  "success": true,
  "data": [
    { "feature": "chat", "model": "gpt-4o-mini", "calls": 120, "tokensIn": 240000, "tokensOut": 90000, "costMicroUsd": 90000 },
    { "feature": "chat", "model": "claude-3-5-haiku-20241022", "calls": 40, "tokensIn": 80000, "tokensOut": 30000, "costMicroUsd": 184000 }
  ],
  "pagination": { "page": 1, "pageSize": 50, "total": 2 }
}
```

### 8. Implementation Detail by Layer

#### 8.1 ai-core storage (`packages/ai-core/src/storage/usage.queries.ts`)

Add four functions mirroring `aggregateAiUsageByFeature` exactly (Drizzle select
with `count()` + `sql<string>\`sum(...)\``,`groupBy`, map to`Number`):

```ts
// GROUP BY model; optional feature/provider filters via buildConditions
export async function aggregateAiUsageByModel(input: {
  since?: Date; until?: Date; feature?: string; provider?: string; tx?: DrizzleClient;
}): Promise<ReadonlyArray<AiUsageByModelAggRow>> { /* groupBy(aiUsage.model) */ }

export async function aggregateAiUsageByProvider(input: {
  since?: Date; until?: Date; feature?: string; tx?: DrizzleClient;
}): Promise<ReadonlyArray<AiUsageByProviderAggRow>> { /* groupBy(aiUsage.provider) */ }

export async function aggregateAiUsageByFeatureModel(input: {
  since?: Date; until?: Date; tx?: DrizzleClient;
}): Promise<ReadonlyArray<AiUsageByFeatureModelAggRow>> { /* groupBy(aiUsage.feature, aiUsage.model) */ }

export async function aggregateAiUsageDaily(input: {
  since?: Date; until?: Date; feature?: string; model?: string; provider?: string; tx?: DrizzleClient;
}): Promise<ReadonlyArray<AiUsageDailyAggRow>> {
  // groupBy(sql`date_trunc('day', ${aiUsage.createdAt})`), order by day asc
  // return day as 'YYYY-MM-DD' (UTC)
}
```

`buildConditions` is extended (or a sibling added) to optionally filter by
`model` and `provider` in addition to the existing `since`/`until`/`userId`/`feature`.

> **Daily zero-fill** (AC-3.3) is done in the reporting/UI layer, not SQL: the
> query returns only days with rows; the wrapper fills missing days in the window
> with zeros so the chart axis is continuous.

#### 8.2 ai-core reporting (`packages/ai-core/src/usage/reporting/usage-reporting.ts`)

Add public wrappers `getUsageByModel`, `getUsageByProvider`,
`getUsageByFeatureModel`, `getDailyUsage` mirroring `getUsageByFeature`
(resolve window via `getUtcMonthRange` when `year`+`month` given; pass through to
the storage aggregator; validate output rows against the new schemas). Export them
from `usage/reporting/index.ts` and `usage/index.ts` and the package root, exactly
like `getUsageByFeature`.

#### 8.3 schemas (`@repo/schemas`)

Add row schemas next to `AiUsageByFeatureRowSchema`:
`AiUsageByModelRowSchema`, `AiUsageByProviderRowSchema`,
`AiUsageByFeatureModelRowSchema`, `AiUsageDailyRowSchema`, plus the inferred types.
These are the single source of truth for both the API response validation and the
admin client types.

#### 8.4 API (`apps/api/src/routes/ai/usage/index.ts`)

Add the four routes using `createAdminListRoute` + `extractPaginationParams` +
`getPaginationResponse`, reusing `YearSchema`/`MonthSchema` and the `since<=until`
refine. Permission `PermissionEnum.AI_SETTINGS_MANAGE`. Each route calls its
ai-core reporting helper and maps to the paginated envelope.

#### 8.5 admin UI (`apps/admin/src/routes/_authed/ai/usage.tsx`)

- New file-based route, `beforeLoad` guard identical to `ai/settings.tsx`.
- TanStack Query hooks (one per endpoint) keyed by the resolved filters.
- Filters serialized to TanStack Router search params (AC-4.4).
- Tables via the existing admin table conventions; charts via **recharts**
  (already a dependency): bar chart per feature/model, grouped bar for
  feature × model, line/area for daily.
- Shared `formatMicroUsd(micro: number): string` helper (new, in admin utils or
  `@repo/utils` if a money formatter exists there — prefer reuse).
- A nav entry added to the AI section of the admin sidebar.
- i18n keys under an `ai.usage.*` namespace in es/en/pt.

### 9. Dependencies

- **External:** none new. `recharts` already present in `apps/admin`.
- **Internal:** `@repo/ai-core` (reporting), `@repo/schemas` (row schemas),
  `@repo/i18n` (copy), existing admin route-factory / TanStack Query / TanStack
  Router. No new packages.

### 10. Testing Strategy

**No tests = not done.** Coverage target ≥ 90% on new code.

**Unit — ai-core storage (real DB or seeded fixtures):**

- `aggregateAiUsageByModel` groups and sums correctly; respects `feature`/`provider`
  filters; respects window; empty → `[]`.
- `aggregateAiUsageByProvider` likewise.
- `aggregateAiUsageByFeatureModel` produces one row per `(feature, model)`.
- `aggregateAiUsageDaily` buckets by UTC day; boundary rows (month edges) land in
  the correct day; ordering ascending.
- Cost/token sums match hand-computed expectations from fixture rows (reconciles
  with `aggregateAiUsageByFeature` totals for the same window).

**Unit — reporting wrappers:** window resolution from `year`+`month`; daily
zero-fill produces a continuous day series; output validates against schemas.

**Unit — formatter:** `formatMicroUsd` rounds/format correctly (e.g. `90000 → $0.09`,
`184000 → $0.184`); zero and large values.

**Integration — API (apps/api):** for each of the 4 endpoints — success (200 +
shape), `403` without `AI_SETTINGS_MANAGE`, `422` on invalid params
(`since > until`, bad year/month), pagination (`page`/`pageSize`), and rejection of
unknown params (admin list factory).

**Component — admin page:** renders totals + tables from mocked query data; empty
state (AC-1.5); filter change updates query keys; one block error does not blank
the page.

**i18n:** all new `ai.usage.*` keys present in es/en/pt (i18n completeness test).

### 11. Risks & Mitigations

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| `model`/`feature×model` group-bys not index-covered → slow at scale | Low | Med | Volume is low + table append-only; flag `(model, createdAt)` index as follow-up if needed |
| Daily zero-fill logic off-by-one at month/window edges (UTC) | Med | Med | Dedicated boundary unit tests; reuse `getUtcMonthRange` |
| Cost formatting drift (micro-USD → USD) across UI | Med | Low | Single shared `formatMicroUsd` helper + unit tests; never format inline |
| Numbers don't reconcile with existing `/by-feature` | Low | High | Reconciliation test asserts equal totals for same window; same source table/conditions |
| New page leaks to non-super-admin | Low | High | Reuse exact `beforeLoad` guard + permission as `ai/settings`; explicit `403` integration test |
| Scope creep (CSV, user drilldown) | Med | Low | Explicitly out of scope (§4) |

### 12. Performance Considerations

- All queries are single-table aggregates over an append-only, low-cardinality
  table; expected sub-millisecond at current volume.
- The page issues ~5 parallel queries on load; acceptable, each is small and
  cached by TanStack Query keyed on filters.
- No N+1: every view is one aggregate query, not per-row fetches.
- Charts render client-side from already-fetched aggregate rows (no extra calls).

## Implementation Approach (Phased)

- **Phase 1 — Setup:** confirm `recharts` usage pattern; add new row schemas in
  `@repo/schemas` (the contract everything else depends on).
- **Phase 2 — Core (ai-core):** storage aggregators (byModel, byProvider,
  byFeatureModel, daily) + reporting wrappers + daily zero-fill, with unit tests.
- **Phase 3 — Integration (API):** four endpoints + validation + permission guard
  - integration tests.
- **Phase 4 — Frontend (admin):** page, hooks, filters, tables, charts, formatter,
  nav link, i18n keys, component tests.
- **Phase 5 — Testing/Polish:** reconciliation test, empty/error states, i18n
  completeness, accessibility pass.
- **Phase 6 — Docs:** short admin doc / CLAUDE note on the new usage surface.

## Internal Review Notes

**Strengthened during review.**

- Pinned the AC-4 storage-isolation constraint so new queries land in
  `storage/` only (consistent with `aggregateAiUsageByFeature`).
- Added an explicit reconciliation test (numbers must equal `/by-feature` totals)
  to catch aggregation drift.
- Moved daily zero-fill out of SQL into the wrapper/UI to keep queries simple and
  testable.

**Open questions for the user (pre-implementation).**

1. The `userId` filter: pass it through on the new endpoints for completeness, or
   leave per-user out entirely (current §4 says no dedicated user table)? Default
   assumption: pass `userId` through as an optional filter only, no UI control.
2. `formatMicroUsd` location: new admin util vs adding to `@repo/utils`. Default
   assumption: check `@repo/utils` for an existing money formatter and reuse;
   otherwise local admin util.

**External docs verified.** None required — no external API involved; `recharts`
is already an in-repo dependency.
