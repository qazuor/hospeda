---
spec-id: SPEC-226
title: Admin Brevo email/newsletter dashboard
type: feature
complexity: medium
status: draft
created: 2026-06-13T12:00:00Z
---

# SPEC-226 — Admin Brevo email/newsletter dashboard

## Overview

**Goal.** Expose Brevo transactional-email and newsletter delivery statistics
inside the admin dashboard. Today Brevo is used for every outbound email (via
`HOSPEDA_EMAIL_API_KEY` + native `fetch`), but zero stats flow back into the
admin UI. This spec adds a server-side proxy endpoint on the API tier that
fetches metrics from the Brevo REST API and a datasource + widget in the admin
dashboard that renders them.

**Motivation.** Admins and editors (newsletter role) currently have no way to
answer "how many emails bounced last week?", "how many newsletter subscribers
do we have on the Brevo list?", or "how did the last campaign perform?" without
logging into the Brevo portal directly. Centralising these metrics in the
Hospeda admin dashboard improves operational visibility and reduces context
switching.

**Success criteria.**

- A new admin endpoint `GET /api/v1/admin/brevo/stats` proxies aggregated
  metrics from the Brevo API and returns a typed, versioned response.
- The admin dashboard (SUPER_ADMIN / ADMIN roles) shows a Brevo stats card
  with at minimum: emails sent / delivered / bounced / blocked in a rolling
  period, subscriber count (active on the primary newsletter list), and the
  last N campaigns with send + open counts.
- The integration is soft-opt-in: when `HOSPEDA_EMAIL_API_KEY` is absent (or
  Brevo returns an error), the card degrades to a "no disponible" deferred
  state — it never breaks the dashboard.
- Reuses the **existing** `HOSPEDA_EMAIL_API_KEY` env var (no new Brevo-specific
  key needed; the same key is already used for SMTP sends, contacts management,
  and webhook verification).

**Locked design decisions (2026-06-13).**

1. Auth: reuse `HOSPEDA_EMAIL_API_KEY` (the `api-key` header idiom already in
   use in `packages/notifications/src/transports/email/brevo-batch.ts` and
   `apps/api/src/routes/newsletter/submit.ts`).
2. Proxy tier: API-side (`apps/api/`) so the Brevo API key is never exposed to
   the browser.
3. Metrics scope (MVP): SMTP aggregate stats (`GET /v3/smtp/statistics/aggregatedReport`),
   contacts count on the prelaunch list (`GET /v3/contacts/lists/{listId}`),
   and recent campaigns (`GET /v3/emailCampaigns?status=sent&limit=5&sort=desc`).
4. Caching: response cached in-memory (server-side, TTL 15 min) to avoid
   hammering the Brevo API on every dashboard load. No DB persistence needed.
5. Admin permission gate: `PermissionEnum.ANALYTICS_VIEW` (already used for the
   views-analytics routes; ADMIN + SUPER_ADMIN roles hold this permission).
6. Common proxy helper: the "external-metrics proxy" pattern is shared with
   SPEC-224 (PostHog) and SPEC-225 (Sentry). A lightweight
   `createExternalMetricsProxy()` helper in
   `apps/api/src/utils/external-metrics-proxy.ts` should be introduced to
   avoid copy-pasting TTL cache + error-boundary logic across all three specs.
   This spec defines and introduces the helper; SPEC-224 and SPEC-225 consume it.

**Sibling specs.** SPEC-224 (PostHog analytics proxy) and SPEC-225 (Sentry
errors proxy) share the same proxy + datasource + widget pattern. Any helper
logic extracted here (see item 6 above) should be designed with all three
consumers in mind. Cross-reference these specs when deciding on the shared
utility surface.

**Baseline.** File refs verified against `origin/staging` on 2026-06-13.

---

## User Stories & Acceptance Criteria

### US-1 — Admin/SuperAdmin sees Brevo email delivery stats

GIVEN an admin or super-admin user with `ANALYTICS_VIEW` permission,
WHEN they open the admin dashboard,
THEN a "Estadísticas de email (Brevo)" card is visible showing: emails sent,
delivered, bounced, and blocked for the last 7 days (or a configurable period),
sourced from the Brevo SMTP aggregate report.

### US-2 — Admin/SuperAdmin sees newsletter subscriber count

GIVEN an admin user with `ANALYTICS_VIEW` permission,
WHEN the Brevo stats card loads,
THEN it shows the total subscriber count on the configured Brevo contact list
(`HOSPEDA_BREVO_PRELAUNCH_NEWSLETTER_LIST_ID`), including the breakdown that
Brevo provides (total subscribers, active, unsubscribed where available from
the list detail endpoint).

### US-3 — Admin/SuperAdmin sees recent campaign performance

GIVEN an admin user with `ANALYTICS_VIEW` permission,
WHEN the Brevo stats card loads,
THEN it shows the last 5 sent email campaigns with: campaign name/subject,
sent count, delivered count, and (if available from Brevo) open count and
click count.

### US-4 — Graceful degradation when Brevo is unavailable

GIVEN `HOSPEDA_EMAIL_API_KEY` is not configured, OR the Brevo API returns a
non-2xx response,
WHEN the dashboard renders the Brevo stats card,
THEN the card shows a "no disponible" deferred state (consistent with the
SPEC-155 `onMissing: 'hide'` / DeferredWidget pattern for optional external
integrations) and never throws or breaks the rest of the dashboard.

### US-5 — Stats are reasonably fresh (TTL cache)

GIVEN a dashboard load within the 15-minute TTL window,
WHEN the admin fetches the Brevo stats endpoint,
THEN the response is served from the in-memory cache (no Brevo API call) with
a `X-Cache: HIT` header for observability.
WHEN the cache is stale or absent,
THEN a fresh call to the Brevo API is made and the cache is updated.

---

## Technical Approach

### Part A — API: external-metrics proxy helper + Brevo proxy endpoint

**Shared proxy helper (`apps/api/src/utils/external-metrics-proxy.ts`).**

A generic `createExternalMetricsProxy<T>()` factory that encapsulates:
- In-memory TTL cache keyed by a string ID (e.g. `'brevo'`, `'posthog'`,
  `'sentry'`).
- An async `fetcher` function that calls the external API and returns `T`.
- Error boundary: if `fetcher` throws, return the last cached value (if any),
  or a typed `{ available: false, reason: string }` sentinel.
- Cache-HIT header injection (callers pass the Hono `Context` to stamp it).
- Configurable `ttlMs` (default 900 000 ms = 15 min).

This helper is consumed by all three sibling specs (SPEC-224/225/226). It must
not import from `@repo/db` — purely in-memory.

**Brevo stats client (`apps/api/src/lib/brevo-stats-client.ts`).**

A plain module (not a class, KISS) with three named functions wrapping native
`fetch` to the Brevo REST API v3. All calls use the `api-key` header idiom
(identical to `brevo-batch.ts`). Zod schemas validate every response at
the boundary.

```
fetchSmtpAggregatedReport({ apiKey, startDate, endDate })
  → GET https://api.brevo.com/v3/smtp/statistics/aggregatedReport
      ?startDate={YYYY-MM-DD}&endDate={YYYY-MM-DD}
  → BrevoSmtpReportSchema (requests, delivered, hardBounces, softBounces, clicks, opens, blocked)

fetchContactListStats({ apiKey, listId })
  → GET https://api.brevo.com/v3/contacts/lists/{listId}
  → BrevoContactListSchema (id, name, totalSubscribers, totalBlacklisted, totalHardBounces)

fetchRecentCampaigns({ apiKey, limit })
  → GET https://api.brevo.com/v3/emailCampaigns?status=sent&sort=desc&limit={limit}
  → BrevoEmailCampaignsSchema (campaigns[]: { id, subject, sentDate, statistics: { sent, delivered, opened, clicked } })
```

Zod schemas for these three response shapes live in
`packages/schemas/src/entities/brevo/brevo-stats.schema.ts` (new file;
follows the convention of `destination.climate.schema.ts` for subtypes).

**Admin route (`apps/api/src/routes/newsletter/admin/brevo-stats.ts` — new file).**

```
GET /api/v1/admin/brevo/stats?period=7d
```

- Handler in `apps/api/src/routes/newsletter/admin/brevo-stats.ts`.
  Mounted under the existing newsletter admin router
  (`apps/api/src/routes/newsletter/admin/index.ts`) via the path
  `/api/v1/admin/newsletter/brevo-stats` (or, if a dedicated `brevo/` sub-router
  is preferred for clarity, `apps/api/src/routes/brevo/admin/stats.ts` under
  `/api/v1/admin/brevo/stats`). Decision to confirm at impl.
- Permission gate: `PermissionEnum.ANALYTICS_VIEW`.
- Uses `createExternalMetricsProxy('brevo', brevoFetcher, { ttlMs: 900_000 })`.
- `brevoFetcher` calls the three `brevo-stats-client.ts` functions in parallel
  (`Promise.all`) and returns a `BrevoStatsResponseSchema`-typed aggregate.
- When `HOSPEDA_EMAIL_API_KEY` is absent: returns
  `{ available: false, reason: 'HOSPEDA_EMAIL_API_KEY not configured' }` with
  HTTP 200 (not 500) so the dashboard can degrade gracefully.
- Endpoint gate matrix row required (see Touched Files).

**Response shape (`BrevoStatsResponseSchema`).**

```ts
{
  available: true,
  period: { startDate: string, endDate: string },
  smtp: {
    sent: number,
    delivered: number,
    hardBounces: number,
    softBounces: number,
    blocked: number,
    opens: number,
    clicks: number
  },
  contacts: {
    listId: number,
    listName: string,
    totalSubscribers: number,
    totalBlacklisted: number
  } | null,  // null when HOSPEDA_BREVO_PRELAUNCH_NEWSLETTER_LIST_ID unset
  campaigns: Array<{
    id: number,
    subject: string,
    sentDate: string,
    sent: number,
    delivered: number,
    opened: number | null,
    clicked: number | null
  }>
} | { available: false, reason: string }
```

### Part B — Admin: datasource + dashboard widget

**Datasource (`apps/admin/src/lib/dashboard-sources/admin.ts` — add new source).**

```
registerDataSource('admin.brevo.stats', (ctx) => ({
  queryKey: buildDashboardQueryKey('admin.brevo.stats', ctx),
  queryFn: () => fetchApi({ path: '/api/v1/admin/newsletter/brevo-stats?period=7d' }),
  staleTime: 15 * 60 * 1000  // mirror server-side TTL
}))
```

Registered in `admin.ts` (available to ADMIN + SUPER_ADMIN). Does NOT go in
`super.ts` (SUPER_ADMIN-only) because ADMIN should see email platform health too.

**Dashboard card (`apps/admin/src/config/ia/dashboards.ts` — add to `adminBaseDashboard`).**

New card "J" (appended to `adminBaseDashboard.widgets`) — full-width or
half-width depending on grid balance:

- Label: `{ es: 'Email (Brevo)', en: 'Email (Brevo)', pt: 'Email (Brevo)' }`
- Type: `kpi-grid` for the SMTP aggregate numbers + a `list` sub-slot for
  recent campaigns. Pattern mirrors the existing billing stats card
  (`super.billing.stats`) in `superAdminOnlySection`.
- `onMissing: 'hide'` — card is invisible when the data source returns
  `{ available: false }` or when the user lacks `ANALYTICS_VIEW`.
- `scope: 'all'` — no per-accommodation-id scoping needed.

**Widget tiles (MVP).**

```
Row 1 (SMTP stats, 4 KPI tiles):
  Enviados | Entregados | Rebotes | Bloqueados

Row 2 (list of last 5 campaigns):
  Subject · sent date · delivered count · [open rate if available]

Row 3 (contacts KPI tile, 1 tile):
  Suscriptores Brevo (total on configured list)
```

### Env vars

No new env vars needed:
- `HOSPEDA_EMAIL_API_KEY` — already registered in `packages/config/` +
  `apps/api/src/utils/env.ts`. Reused as-is.
- `HOSPEDA_BREVO_PRELAUNCH_NEWSLETTER_LIST_ID` — already registered. Used to
  fetch list stats; if unset, the `contacts` field in the response is `null`.
- No additional Brevo scoping is needed: the existing key covers all Brevo REST
  API endpoints (account-level key with full access).

### Touched files

**New files:**
- `apps/api/src/utils/external-metrics-proxy.ts` — shared TTL cache + error
  boundary helper (consumed by SPEC-224/225/226).
- `apps/api/src/lib/brevo-stats-client.ts` — native `fetch` wrapper for the
  three Brevo stats endpoints.
- `apps/api/src/routes/newsletter/admin/brevo-stats.ts` (or
  `apps/api/src/routes/brevo/admin/stats.ts` — decision at impl) — Hono route
  handler + OpenAPI spec.
- `packages/schemas/src/entities/brevo/brevo-stats.schema.ts` — Zod schemas
  for Brevo API responses + the proxy response shape.

**Modified files:**
- `apps/api/src/routes/newsletter/admin/index.ts` (or a new `apps/api/src/routes/brevo/index.ts`)
  — mount the new route.
- `apps/api/src/routes/index.ts` — register the new router if a standalone
  `brevo/` router is chosen.
- `apps/admin/src/lib/dashboard-sources/admin.ts` — add
  `admin.brevo.stats` datasource registration.
- `apps/admin/src/config/ia/dashboards.ts` — add Brevo stats card to
  `adminBaseDashboard.widgets`.
- `docs/billing/endpoint-gate-matrix.md` — add row for the new admin endpoint.
- `packages/schemas/src/entities/brevo/index.ts` (new barrel) + update the
  schemas package barrel at `packages/schemas/src/index.ts` to re-export.

**Test files:**
- `apps/api/src/lib/__tests__/brevo-stats-client.test.ts` — unit tests with
  mocked `fetch`, covers happy path + error shapes for all three Brevo endpoints.
- `apps/api/src/utils/__tests__/external-metrics-proxy.test.ts` — unit tests
  for TTL cache hit/miss, error boundary, stale-value fallback.
- `apps/api/test/routes/newsletter/admin/brevo-stats.test.ts` (or equivalent)
  — integration test: route returns typed aggregate; missing key → 200
  `available: false`.

### Patterns / constraints

- No `any`; `import type`; named exports; RO-RO; Zod source of truth.
- All new routes follow `createSimpleRoute` / `createOpenApiRoute` pattern.
- Permission gate via `PermissionEnum.ANALYTICS_VIEW` (already defined;
  no new permission value needed).
- No DB writes — pure proxy + in-memory cache. No migration needed.
- Admin styling: Tailwind + TanStack Query + Shadcn widgets (existing pattern).
- The shared `external-metrics-proxy.ts` helper must have zero Drizzle / DB
  imports — it lives in `apps/api/src/utils/` and must remain import-light.
- Native `fetch` for Brevo calls (no third-party Brevo SDK — consistent with
  existing usage in `brevo-batch.ts` and `newsletter/submit.ts`).

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Brevo API rate limits | Low | 15-min server-side cache drastically reduces call frequency; each dashboard load at most 3 Brevo calls (not per-user) |
| Brevo API breaking change (v3) | Low | Zod schemas at boundary will surface shape mismatches immediately; stale cache serves last known values |
| `HOSPEDA_EMAIL_API_KEY` scope insufficient for stats endpoints | Low | Same key is used for SMTP send + contacts management — it is an account-level key; Brevo API docs confirm stats endpoints need the same key. Verify at impl smoke. |
| Cache stale on redeploy (in-memory) | Low | Acceptable; first request after deploy repopulates (Brevo API is fast, < 1s). |
| `HOSPEDA_BREVO_PRELAUNCH_NEWSLETTER_LIST_ID` not set in some envs | Low | API returns `contacts: null`; UI hides that tile via `onMissing: 'hide'` or null-guard |
| Open rate / click data availability | Low | Brevo campaign statistics object includes `openedBy` count — documented. If Brevo changes, field degrades to `null` gracefully |
| Three parallel Brevo API calls per uncached request | Low | `Promise.all` keeps wall-clock time to ~1 Brevo RTT; abort if any call exceeds 5s via `AbortController` timeout |

## Out of Scope

- Brevo transactional email *log* (per-message delivery trace, bounced email
  addresses) — high cardinality data; belongs in a dedicated transactional
  email audit view (different spec).
- Real-time webhook event counters (bounce counts derived from Brevo webhooks
  stored in DB) — that's a different data source than the API-level aggregate.
- Campaign creation / editing from admin (out of scope; existing newsletter
  campaign management covers that).
- Brevo contact segmentation details (beyond the primary newsletter list count).
- Exposing this data in the EDITOR dashboard (only ADMIN/SUPER_ADMIN for now).
  Could be added post-MVP if editors need visibility.
- PostHog (SPEC-224) and Sentry (SPEC-225) widgets — separate specs, but the
  shared `external-metrics-proxy.ts` helper is co-delivered here.

## Suggested Tasks (phased)

**Phase 1 — Foundation**
- Create `packages/schemas/src/entities/brevo/brevo-stats.schema.ts` with Zod
  schemas for all three Brevo API response shapes + the `BrevoStatsResponseSchema`
  proxy aggregate. Export via new barrel + schemas package barrel.
- Create `apps/api/src/utils/external-metrics-proxy.ts` — generic TTL cache +
  error boundary helper (designed for SPEC-224/225/226 reuse). Unit tests.

**Phase 2 — Brevo client + route**
- Create `apps/api/src/lib/brevo-stats-client.ts` with `fetchSmtpAggregatedReport`,
  `fetchContactListStats`, `fetchRecentCampaigns`. Unit tests with mocked fetch.
- Create the Hono route handler for `GET /api/v1/admin/newsletter/brevo-stats`
  (or `/api/v1/admin/brevo/stats`), wire `createExternalMetricsProxy`, add
  `PermissionEnum.ANALYTICS_VIEW` gate. Integration test (missing key → 200
  available:false, happy path returns typed aggregate).
- Add row to `docs/billing/endpoint-gate-matrix.md`.

**Phase 3 — Admin UI**
- Register `admin.brevo.stats` datasource in
  `apps/admin/src/lib/dashboard-sources/admin.ts`.
- Add Brevo stats card to `adminBaseDashboard` in
  `apps/admin/src/config/ia/dashboards.ts` with `onMissing: 'hide'`.
- Implement the widget renderer for the Brevo stats card (KPI tiles + campaign
  list + contacts tile). Component test.

**Phase 4 — Polish + docs**
- Smoke-test against the real Brevo API with `HOSPEDA_EMAIL_API_KEY` set
  (staging env).
- Document the new endpoint in `apps/api/docs/route-architecture.md` (admin
  section).
- Cross-reference SPEC-224 and SPEC-225 — confirm `external-metrics-proxy.ts`
  helper is generic enough for both.

## Internal Review Notes

- **Verified on staging baseline (2026-06-13):**
  - `HOSPEDA_EMAIL_API_KEY` is already declared in `apps/api/src/utils/env.ts`
    (L456) as `z.string().optional()` and used in auth.ts, conversation-mailer.ts,
    newsletter/submit.ts, and newsletter/admin/_singletons.ts.
  - `HOSPEDA_BREVO_WEBHOOK_SECRET` and `HOSPEDA_BREVO_PRELAUNCH_NEWSLETTER_LIST_ID`
    are also already declared (env.ts L469/L477).
  - No Brevo SDK dependency in any package.json — all Brevo calls use native
    `fetch` with `api-key` header. This spec must stay consistent.
  - `brevo-batch.ts` (packages/notifications) uses `const BREVO_SMTP_URL = 'https://api.brevo.com/v3/smtp/email'`.
    `newsletter/submit.ts` uses `const BREVO_BASE_URL = 'https://api.brevo.com/v3'`.
    New `brevo-stats-client.ts` should also use a local `const BREVO_BASE_URL`
    constant (do NOT share it across packages — KISS, YAGNI).
  - `PermissionEnum.ANALYTICS_VIEW = 'analytics.view'` exists at L277 of
    `packages/schemas/src/enums/permission.enum.ts` and is used today by the
    views-admin routes (`views/admin/daily-series.ts`, `views/admin/batch.ts`,
    `views/admin/top.ts`). Reusing it is correct — no new permission value needed.
  - The existing `editor.newsletter.subscribers` and `editor.newsletter.campaigns`
    datasources in `apps/admin/src/lib/dashboard-sources/editor.ts` (L325/L402)
    pull from the internal DB (our newsletter tables). This spec adds a
    *complementary* Brevo-API-side view (delivery stats, contacts count, campaign
    send/open rates) — not a duplicate.
  - The super admin dashboard comment at L179–186 of `super.ts` explicitly
    notes "Sentry errors (24h): needs a Sentry-API proxy" as deferred. This
    spec's `external-metrics-proxy.ts` helper is the infrastructure that will
    unblock SPEC-224/225 too.
  - `superAdminOnlySection` already has a billing stats card (L90–168 of
    `super.ts`) that follows the kpi-grid pattern. Use it as the visual reference
    for the Brevo card layout.

- **Open questions for impl:**
  1. Route path — `/api/v1/admin/newsletter/brevo-stats` (extends existing
     newsletter admin router) vs `/api/v1/admin/brevo/stats` (new `brevo/`
     router). Recommend new router for separation of concerns; confirm at impl.
  2. `period` query parameter — MVP defaults to 7d; confirm whether the UI
     should allow the user to change the period (30d, 90d) or just show 7d fixed.
  3. Whether `contacts` data (list stats) is worth the extra Brevo call when
     the same count is available from internal DB (`editor.newsletter.subscribers`
     source). Brevo's count includes contacts added via other channels (e.g.
     Brevo's own form embeds); the internal DB count is Hospeda-only. Both have
     value — recommend keeping the Brevo-side count for discrepancy detection.
