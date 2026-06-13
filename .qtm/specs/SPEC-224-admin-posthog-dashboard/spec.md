---
spec-id: SPEC-224
title: Admin PostHog analytics dashboard
type: feature
complexity: medium
status: draft
created: 2026-06-13T12:00:00Z
---

# SPEC-224 — Admin PostHog analytics dashboard

## Overview

**Goal.** Expose PostHog product analytics data (pageviews, top events, active
users, key funnel) inside the admin dashboard via a server-side proxy to the
PostHog Query API, so ADMIN and SUPER_ADMIN users can monitor platform usage
without leaving the panel.

**Motivation.** PostHog is already instrumented in both the web app
(`PostHogScript.astro`, `PUBLIC_POSTHOG_KEY`) and the admin panel
(`apps/admin/src/lib/analytics/posthog-client.ts`, `VITE_POSTHOG_KEY`) for
write-side event capture. The API also has a server-side PostHog Node.js client
(`apps/api/src/lib/posthog.ts`) used exclusively for AI event analytics.
None of these paths **reads** analytics data back — there is no Query API
integration, no HogQL execution, and no admin dashboard widget for PostHog
metrics. The admin dashboard already reserves a deferred slot in
`superAdminOnlySection` for Sentry errors (card H, `phaseSpec: 'SPEC-163'`)
under a `DeferredWidget` pattern, which is the same pattern this spec follows.

**Success criteria.** The ADMIN and SUPER_ADMIN dashboards display a PostHog
analytics widget that shows (at minimum): pageviews per period, top events by
count, and DAU/WAU. Data is fetched server-side through an admin-only API
endpoint that proxies the PostHog Query API; the personal API key (read scope)
is never exposed to the browser. The widget degrades gracefully when the key is
unconfigured.

**Sibling specs.** SPEC-225 (Sentry error metrics proxy) and SPEC-226 (Brevo
email analytics proxy) follow the exact same architectural pattern:
`server-side proxy endpoint + datasource registration + dashboard widget`. During
implementation, evaluate extracting a shared `external-metrics-proxy` helper
(request forwarding, TTL caching, error normalisation) reusable by all three.
Decision to confirm at implementation start: shared helper vs. three independent
routes. Recommendation: shared helper if SPEC-225/226 are implemented in the same
sprint; independent otherwise (YAGNI).

**Locked design decisions (to confirm with user before impl).**

1. New env vars needed: `HOSPEDA_POSTHOG_PERSONAL_KEY` (PostHog personal API
   key with query scope) + optionally `HOSPEDA_POSTHOG_PROJECT_ID` (numeric
   project ID) — in addition to the existing `HOSPEDA_POSTHOG_KEY` (capture key,
   already registered).
2. Proxy lives in the Hono API (`apps/api`) under the admin tier, never in the
   browser bundle.
3. Short TTL server-side cache (5–15 min) to respect PostHog Query API rate
   limits (verified: 3 600 req/h for personal tokens as of 2026-06).
4. Widget visible only to ADMIN and SUPER_ADMIN (both have `ANALYTICS_VIEW`
   permission per seed — `packages/seed/src/required/rolePermissions.seed.ts`
   lines 222–224 and 545–547).
5. Initial metric set: pageviews (7d/30d), top 5 events (count, 7d), DAU + WAU.
   Funnel deferred to Phase 2.

**Baseline.** File refs verified against `origin/staging` on 2026-06-13.

---

## User Stories & Acceptance Criteria

### US-1 — Admin sees PostHog pageview metrics

GIVEN an ADMIN or SUPER_ADMIN logged in to the panel,
WHEN they open their dashboard,
THEN the PostHog analytics widget shows pageviews for the last 7 days and last
30 days, sourced from the PostHog Query API via the server-side proxy.

### US-2 — Admin sees top events

GIVEN an ADMIN or SUPER_ADMIN logged in,
WHEN the widget renders,
THEN it displays the top 5 captured events by count for the last 7 days, each
with its event name and count.

### US-3 — Admin sees active users (DAU / WAU)

GIVEN an ADMIN or SUPER_ADMIN logged in,
WHEN the widget renders,
THEN it displays DAU (daily active users, yesterday) and WAU (weekly active
users, last 7 days) as KPI tiles.

### US-4 — Graceful degradation when key is unconfigured

GIVEN `HOSPEDA_POSTHOG_PERSONAL_KEY` is not set in the environment,
WHEN the dashboard loads,
THEN the PostHog widget renders a `DeferredWidget`-style placeholder ("Analytics
no configurado — contactar al equipo de infra") instead of an error, and the
rest of the dashboard works normally.

### US-5 — Graceful degradation when PostHog API is unavailable

GIVEN the PostHog Query API returns an error or times out,
WHEN the widget polls the proxy endpoint,
THEN it shows the last cached data (if available) or a neutral "no disponible"
state — never an unhandled error that breaks the widget renderer.

### US-6 — Widget is invisible to non-admin roles

GIVEN a HOST, TOURIST, or EDITOR logged in,
WHEN they open their dashboard,
THEN the PostHog analytics widget is not present and no request is made to the
proxy endpoint.

---

## Technical Approach

### Part A — Server-side PostHog Query API proxy (Hono, admin tier)

**New env vars.** Two new vars needed (neither exists today):

- `HOSPEDA_POSTHOG_PERSONAL_KEY` — PostHog personal API key with
  `query:read` scope (distinct from the capture key `HOSPEDA_POSTHOG_KEY` which
  is already registered in `packages/config/src/env-registry.hospeda.ts`).
- `HOSPEDA_POSTHOG_PROJECT_ID` — numeric PostHog project ID (available in
  PostHog → Project Settings → Project ID). Needed to build the HogQL endpoint
  URL: `https://us.posthog.com/api/projects/{PROJECT_ID}/query/`.

Both must follow the full env-var workflow: register in
`packages/config/src/env-registry.hospeda.ts`, add Zod validation to
`apps/api/src/utils/env.ts`, update `apps/api/.env.example`, document in
`docs/guides/environment-variables.md`, and set in Coolify for both staging and
production environments.

**PostHog Query API surface.** HogQL queries are executed via:

```
POST https://us.posthog.com/api/projects/{PROJECT_ID}/query/
Authorization: Bearer {PERSONAL_KEY}
Content-Type: application/json

{ "query": { "kind": "HogQLQuery", "query": "SELECT ..." } }
```

Three queries needed for the MVP metric set:

1. **Pageviews** — `SELECT count() FROM events WHERE event = '$pageview' AND timestamp >= now() - INTERVAL {N} DAY`.
2. **Top events** — `SELECT event, count() as cnt FROM events WHERE timestamp >= now() - INTERVAL 7 DAY GROUP BY event ORDER BY cnt DESC LIMIT 5`.
3. **Active users** — `SELECT uniq(distinct_id) FROM events WHERE timestamp >= now() - INTERVAL 1 DAY` (DAU) and `... INTERVAL 7 DAY` (WAU).

**Caching.** Results are cached in-process (a simple `Map<string, { data; expiresAt }>` or the exchange-rate-fetch pattern of persisting to DB). Recommendation: in-process TTL cache (5 min default) to avoid a DB migration. Key = query fingerprint. This is appropriate for PostHog's 3 600 req/h personal-token limit at our traffic levels.

**Touched files — API:**

- `packages/config/src/env-registry.hospeda.ts` — register `HOSPEDA_POSTHOG_PERSONAL_KEY` + `HOSPEDA_POSTHOG_PROJECT_ID`.
- `apps/api/src/utils/env.ts` — add both vars to `ApiEnvBaseSchema` (Zod, optional, string).
- `apps/api/.env.example` — add placeholder lines.
- `apps/api/src/lib/posthog-query.ts` — **new**. Thin wrapper around `fetch` that:
  - Builds the HogQL POST body.
  - Adds `Authorization: Bearer {PERSONAL_KEY}` header.
  - Returns typed `PostHogQueryResult<T>`.
  - Is a no-op (returns `null`) when `HOSPEDA_POSTHOG_PERSONAL_KEY` is not set.
  - Has a configurable `timeoutMs` (default 10 s).
- `apps/api/src/lib/posthog-metrics-cache.ts` — **new**. In-process TTL cache for query results. Exports `getCached<T>(key, ttlMs, loader)`.
- `apps/api/src/routes/metrics/admin/posthog-metrics.route.ts` — **new** admin-tier route:
  - `GET /api/v1/admin/analytics/posthog` — requires `ANALYTICS_VIEW` permission via `adminAuthMiddleware`.
  - Runs the three HogQL queries in parallel (using the cache wrapper).
  - Returns typed `PostHogMetricsResponseSchema` (pageviews 7d, pageviews 30d, topEvents, dau, wau).
  - Returns `{ available: false, reason: 'not_configured' }` when key is missing.
  - Returns `{ available: false, reason: 'api_error', lastUpdated }` on PostHog API failure (serves cached data when stale-but-usable).
- `apps/api/src/routes/metrics/admin/index.ts` — **new** (or extend existing). Wire `posthog-metrics.route.ts`.
- `apps/api/src/routes/index.ts` — register `/api/v1/admin/analytics` prefix (verify existing routing structure first — may already exist under `apps/api/src/routes/metrics/index.ts`).
- `docs/billing/endpoint-gate-matrix.md` — **mandatory row** for `GET /api/v1/admin/analytics/posthog` (tier: admin, auth: ANALYTICS_VIEW, consumer: admin panel).

**Response schema** (Zod, `@repo/schemas`):

- `packages/schemas/src/api/admin/posthog-metrics.schema.ts` — **new**.
  Exports `PostHogMetricsResponseSchema` with fields: `available: boolean`,
  `pageviews7d: number | null`, `pageviews30d: number | null`,
  `topEvents: Array<{ event: string; count: number }>`,
  `dau: number | null`, `wau: number | null`,
  `lastUpdatedAt: string | null`, `reason?: string`.

### Part B — Dashboard datasource registration (admin panel)

**Touched files — admin:**

- `apps/admin/src/lib/dashboard-sources/admin.ts` — register new source ID
  `'admin.analytics.posthog'`. Resolver calls `GET /api/v1/admin/analytics/posthog`
  via `fetchApi`. Normalises to the KPI shape used by the dashboard renderer.
  `staleTime`: `5 * 60 * 1000` (5 min, aligned with server-side cache TTL).
- `apps/admin/src/config/ia/dashboards.ts` — add a new widget to
  `adminBaseDashboard.widgets` (visible to ADMIN and SUPER_ADMIN):
  - `id: 'admin-card-posthog'`
  - `type: 'kpi'` (multi-tile: pageviews 7d / pageviews 30d / DAU / WAU) with a
    companion list for top events.
  - `source: 'admin.analytics.posthog'`
  - `onMissing: 'hide'` — invisible until the backend is configured; does not
    break the dashboard if `HOSPEDA_POSTHOG_PERSONAL_KEY` is unset.
  - `scope: 'all'` (platform-level metrics, not user-scoped).

### Part C — Sibling spec helper (optional, confirm at impl)

If SPEC-225 and SPEC-226 are implemented in the same sprint, extract:

- `apps/api/src/lib/external-metrics-proxy.ts` — generic TTL-cached external
  API proxy factory. Parameterised by: `baseUrl`, `authHeader`, `timeoutMs`,
  `ttlMs`, `onUnavailable`. PostHog, Sentry (SPEC-225), and Brevo (SPEC-226)
  each instantiate it with their own credentials and query logic.

If implemented separately, skip this file and let each route own its cache logic
(YAGNI wins when specs ship months apart).

### Permissions

`ANALYTICS_VIEW` (`PermissionEnum.ANALYTICS_VIEW = 'analytics.view'`) is already
granted to ADMIN, SUPER_ADMIN, and EDITOR roles
(`packages/seed/src/required/rolePermissions.seed.ts`). No new permission or DB
migration needed. The admin-auth middleware enforces it on the new endpoint.

### Patterns / constraints

- No `any`; `import type`; named exports; RO-RO; Zod source of truth.
- Admin styling: Tailwind CSS v4 utility classes. Widget built on existing widget
  renderers (KpiWidget + ListWidget) — no new widget component unless the shape
  doesn't fit (decision to confirm during impl).
- Admin data fetching: TanStack Query via `registerDataSource` pattern (matches
  all existing dashboard source files).
- API key `HOSPEDA_POSTHOG_PERSONAL_KEY` is **server-only** — it must never
  reach the browser bundle or be included in any client-facing env var.
- PostHog Query API base URL should be a configurable constant (overridable for
  EU cloud: `https://eu.posthog.com`), derived from `HOSPEDA_POSTHOG_HOST` if
  set, else `https://us.posthog.com`.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| PostHog personal API key rate limit (3 600 req/h for personal tokens) | Medium | Server-side TTL cache (5 min default) keeps requests well under the limit even at high admin-panel refresh rates |
| PostHog API latency (HogQL queries can be slow on large event sets) | Medium | Async / non-blocking: widget uses TanStack Query with `staleTime`; stale data served from cache; 10 s timeout on the proxy fetch |
| PostHog EU vs US region mismatch | Low | `HOSPEDA_POSTHOG_HOST` already in registry; derive proxy base URL from it |
| Dashboard widget breaks when key is unconfigured (staging, new envs) | Low | `available: false` response shape + `onMissing: 'hide'` on the widget config — widget is invisible, not an error |
| Personal API key accidentally exposed to client | High | Key is `HOSPEDA_`-prefixed (server-only by policy), only used in `apps/api/src/lib/posthog-query.ts`, never passed to admin env vars |
| HogQL query shape changes (PostHog API contract) | Low | Typed response schema + integration test with mocked HTTP; HogQL is stable since PostHog 1.x |
| PostHog project ID misconfiguration | Low | Startup validation in `apps/api/src/utils/env.ts`; proxy returns `not_configured` rather than 500 when ID is missing |

## Out of Scope

- Funnel metrics (e.g. sign-up → subscription conversion) — Phase 2.
- Per-user or per-accommodation analytics drill-down.
- Writing events from the proxy (capture path already exists in `posthog.ts`).
- PostHog session replays or feature flags surfaced in the admin.
- Real-time streaming of events (widget polls at TanStack Query staleTime).
- Brevo or Sentry integration (SPEC-225 and SPEC-226 respectively).
- A new dashboard role or new permission (ANALYTICS_VIEW already covers this).

## Suggested Tasks (phased)

**Phase 1 — Backend proxy**

- Register `HOSPEDA_POSTHOG_PERSONAL_KEY` + `HOSPEDA_POSTHOG_PROJECT_ID` in
  `packages/config/src/env-registry.hospeda.ts` and `apps/api/src/utils/env.ts`.
- Implement `apps/api/src/lib/posthog-query.ts` (HogQL fetch wrapper, typed,
  graceful no-op when key absent).
- Implement `apps/api/src/lib/posthog-metrics-cache.ts` (in-process TTL cache).
- Implement `POST`→`GET` proxy route `GET /api/v1/admin/analytics/posthog` with
  `ANALYTICS_VIEW` guard.
- Define `PostHogMetricsResponseSchema` in `@repo/schemas`.
- Add mandatory row to `docs/billing/endpoint-gate-matrix.md`.
- Unit tests: `posthog-query.ts` (mocked fetch), cache module, route (mocked lib).

**Phase 2 — Dashboard integration**

- Register `'admin.analytics.posthog'` datasource in
  `apps/admin/src/lib/dashboard-sources/admin.ts`.
- Add `admin-card-posthog` widget to `adminBaseDashboard` in
  `apps/admin/src/config/ia/dashboards.ts`.
- Verify widget renders correctly in all states: loaded, loading, `not_configured`
  (DeferredWidget fallback), `api_error` (error state).
- Component test: widget renders KPI tiles and companion event list.

**Phase 3 — Polish + docs (optional shared helper)**

- If SPEC-225/226 are in-sprint: extract `external-metrics-proxy.ts` and
  refactor all three routes to use it.
- Update `docs/guides/environment-variables.md` with the two new vars.
- Update `apps/api/.env.example`.
- E2E smoke: admin panel loads, PostHog widget appears, tiles are non-zero.

## Internal Review Notes

- **Verified on staging:** `apps/api/src/lib/posthog.ts` is a write-only Node.js
  client (`posthog-node ^5.36.2`); no read/query path exists. `HOSPEDA_POSTHOG_KEY`
  and `HOSPEDA_POSTHOG_HOST` are registered in `env-registry.hospeda.ts` and used
  by the API for AI event capture only. No `HOSPEDA_POSTHOG_PERSONAL_KEY` or
  `HOSPEDA_POSTHOG_PROJECT_ID` registered anywhere — both are net-new.
- **Verified on staging:** `ANALYTICS_VIEW` (`analytics.view`) is already seeded
  for ADMIN (line 224), SUPER_ADMIN (line 547), and EDITOR (line 669) roles in
  `packages/seed/src/required/rolePermissions.seed.ts`. No new permission or seed
  change needed.
- **Verified on staging:** The dashboard `DeferredWidget` pattern is documented
  in `apps/admin/src/config/ia/dashboards.ts` (see `superAdminOnlySection` card H
  for Sentry/SPEC-163, identical shape). Widget `onMissing: 'hide'` is the correct
  fallback.
- **Verified on staging:** `host.ts` comment at ~L30 ("view tracking not yet built,
  PostHog client-side only") refers to the HOST card G views slot (SPEC-197
  `host.stats.views`), not an admin-side gap. SPEC-224 is distinct from that.
- **Verified on staging:** `registerDataSource` + `buildDashboardQueryKey` +
  `DASHBOARD_STALE_TIME_MS` are exported from
  `apps/admin/src/lib/dashboard-sources.ts` — the exact imports the new datasource
  file will use.
- **Open questions for impl:**
  1. Shared `external-metrics-proxy.ts` helper vs. three independent routes —
     confirm whether SPEC-225/226 are in the same sprint before deciding.
  2. In-process `Map`-based cache vs. DB persistence for query results — recommend
     in-process (simpler, no migration) given 5 min TTL and single-replica staging.
  3. Exact `HOSPEDA_POSTHOG_HOST` derivation: the existing var points to the
     ingestion endpoint (`https://us.i.posthog.com`); the Query API lives at
     `https://us.posthog.com` (without the `.i.` subdomain). Confirm whether to
     reuse, add a separate `HOSPEDA_POSTHOG_QUERY_HOST`, or derive automatically.
  4. Which dashboard (adminBaseDashboard only, or also superAdminDashboard via
     the inherited widgets) — confirm with user; recommendation: `adminBaseDashboard`
     (SUPER_ADMIN inherits it automatically).
