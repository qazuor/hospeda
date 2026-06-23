# AI Usage Dashboard Guide

Guide for monitoring AI consumption via the admin dashboard (`/ai/usage`), introduced in SPEC-260.

## Overview

The AI Usage Dashboard gives SUPER_ADMIN operators a real-time view of how the platform
consumes AI across all features. It tracks:

- Estimated cost (in integer µUSD — see [Cost units](#cost-units))
- Call counts and token volumes
- Breakdowns by model, provider, feature, and day

All data is read-only. No mutations are performed from this page.

## Access

| Field | Value |
|-------|-------|
| Route | `/ai/usage` |
| Guard | `AI_SETTINGS_MANAGE` permission |
| Effective access | SUPER_ADMIN only |
| Sidebar location | AI section, next to AI Settings |

The `beforeLoad` guard delegates to `requireAiAccess()` in
`apps/admin/src/lib/ai-access.ts`. Any user without `AI_SETTINGS_MANAGE` is
redirected to `/403`.

## API Endpoints Consumed

All four endpoints are admin-tier and require a valid admin session.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/admin/ai/usage/by-model` | Aggregates by AI model, sorted by cost DESC |
| `GET /api/v1/admin/ai/usage/by-provider` | Aggregates by provider, sorted by cost DESC |
| `GET /api/v1/admin/ai/usage/by-feature-model` | Aggregates by (feature, model) pair, sorted by cost DESC |
| `GET /api/v1/admin/ai/usage/daily` | Day-by-day cost and call count time series |

There is no `/by-feature` endpoint. The "By Feature" table on the page is a
**client-side rollup** of the `by-feature-model` response: rows sharing the same
`feature` are summed. Because `AiUsageByFeatureTable` and `AiUsageByFeatureModelChart`
both request `by-feature-model` with `pageSize: 100`, TanStack Query de-duplicates the
network call — one request serves all three consumers.

## Filters

All filters are serialized to URL search params (`AiUsageDailySearchSchema` in
`apps/admin/src/features/ai-usage/types.ts`), so every filter combination produces
a shareable, bookmarkable URL.

### Time window

Two mutually exclusive modes:

- **Month mode** (default): select a year + optional month. If month is omitted,
  the full year is returned.
- **Date-range mode**: provide `since` and/or `until` as ISO dates (`YYYY-MM-DD`).
  Both are optional independently — omitting `since` means "from the beginning";
  omitting `until` means "up to now".

Switching between modes clears the other mode's params.

### Narrow filters

| Filter | Param | Accepted by endpoints |
|--------|-------|-----------------------|
| Feature | `feature` | `by-feature-model`, `daily` |
| Provider | `provider` | `by-provider`, `by-feature-model`, `daily` |
| Model | `model` | `by-model`, `by-feature-model`, `daily` |

Each API endpoint only accepts its own subset of params. The TanStack Query hooks
(`apps/admin/src/features/ai-usage/hooks.ts`) strip excess params before building
the request URL — passing an unexpected param results in a 422 from the API.

The Reset button clears all filters back to defaults while preserving `pageSize`.

## Dashboard Sections

### Totals Card

Displays four aggregate metrics for the selected window: total calls, tokens in,
tokens out, and estimated cost. These are computed by the admin client summing the
loaded `by-model` page (see [Known limitations](#known-limitations-mvp)).

### By Model Table

One row per AI model identifier (e.g. `gpt-4o-mini`, `claude-haiku`). Columns:
Model, Calls, Tokens In, Tokens Out, Est. Cost, Cost/1k tokens.

"Cost/1k tokens" is `costMicroUsd / (tokensIn + tokensOut) * 1000`, rendered as
`—` when total tokens is zero (avoids division-by-zero).

### By Provider Table

One row per provider (`openai`, `anthropic`, `stub`). Columns: Provider, Calls,
Tokens In, Tokens Out, Est. Cost.

### By Feature Table

Derived client-side from the `by-feature-model` data. One row per feature
identifier (e.g. `chat`, `text_improve`, `search`). Sorted by cost DESC.

### Feature x Model Chart

Grouped bar chart (one group per feature, one bar per model). Y-axis is cost in
USD; tooltip shows the formatted µUSD value. Uses a fixed 6-color palette cycling
for models beyond 6.

### Feature x Model Table

One row per (feature, model) pair from the `by-feature-model` endpoint. Shares the
same TanStack Query cache entry as the chart and the By Feature table.

### Daily Chart

Area chart (cost) + dashed line (calls) over time. Left Y-axis shows cost in USD;
right Y-axis shows call count. When the selected window produces more than 100 days,
only the first 100 are rendered and an on-screen notice is shown.

## Cost Units

All cost values in the database and API are **integer µUSD**
(micro-dollars: 1 USD = 1,000,000 µUSD). The admin client formats these via
`formatMicroUsd` from `@repo/utils`.

Examples:

- 100,000 µUSD = $0.10
- 1,500,000 µUSD = $1.50

Never store or display fractional µUSD — the DB column is integer.

## Known Limitations (MVP)

These are accepted MVP trade-offs. Both are candidates for follow-up work.

1. **Totals card is a client-side sum, not a server-side grand total.**
   The card sums the loaded `by-model` page (capped at `pageSize: 100`). For
   deployments with more than 100 distinct model identifiers this would
   under-count, but normal model cardinality is well under that ceiling.
   A dedicated `/totals` endpoint would be the correct long-term fix.

2. **Daily chart truncates at 100 days.**
   The `by-daily` endpoint uses `pageSize: 100`. Windows longer than 100 days
   (e.g. a full year in date-range mode) only render the first 100 days, with
   a truncation notice shown below the chart. Narrowing to a month or shorter
   range avoids truncation. Multi-page fetching or a larger cap is the follow-up.

## Reconciliation Invariant

The four aggregation endpoints all read the same `ai_usage` table rows. A
real-database integration test at:

```
packages/db/test/integration/spec-260-usage-reconciliation.integration.test.ts
```

seeds known rows and asserts that summing `by-model`, `by-provider`,
`by-feature-model`, and `daily` rows produces identical grand totals. If
any aggregation query diverges, the test fails. Run it with:

```bash
pnpm --filter @repo/db test:integration
```

## Feature Module Layout

The dashboard feature lives under `apps/admin/src/features/ai-usage/`:

```
features/ai-usage/
  index.ts                       # Barrel exports
  types.ts                       # AiUsageDailySearch, AiUsageDailySearchSchema
  hooks.ts                       # useAiUsageByModelQuery, useAiUsageByProviderQuery,
                                 #   useAiUsageByFeatureModelQuery, useAiUsageDailyQuery
  components/
    AiUsageBlockState.tsx        # Shared loading/error/empty state block (a11y: role=status/alert)
    AiUsageTotalsCard.tsx        # Totals summary metrics
    AiUsageByModelTable.tsx      # Per-model table
    AiUsageByProviderTable.tsx   # Per-provider table
    AiUsageByFeatureTable.tsx    # Per-feature table (client-side rollup)
    AiUsageByFeatureModelTable.tsx  # Feature x model table
    AiUsageFeatureModelChart.tsx # Grouped bar chart (recharts)
    AiUsageDailyChart.tsx        # Area + line dual-axis chart (recharts)
```

Route: `apps/admin/src/routes/_authed/ai/usage.tsx`

## i18n

All user-facing strings are under `admin-pages.ai.usage.*` in
`packages/i18n/src/locales/{es,en,pt}/admin-pages.json`. Accessibility
labels (aria-labels, table captions) live under `admin-pages.ai.usage.a11y.*`.

---

Back to [Admin Documentation](./README.md)
