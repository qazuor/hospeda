---
spec-id: SPEC-225
title: Admin Sentry errors dashboard
type: feature
complexity: medium
status: draft
created: 2026-06-13T12:00:00Z
---

# SPEC-225 — Admin Sentry errors dashboard

## Overview

**Goal.** Implement a read path for Sentry issues so the SUPER_ADMIN dashboard
can display recent errors and their 24-hour count in the admin panel. Today
Sentry is write-only from our backend: errors are _captured_ via the SDK but
there is no way to _query_ them from within the app. This spec adds a thin
server-side proxy to the Sentry Issues API, wires it as a registered
`dashboard-sources` resolver, and replaces the existing `DeferredWidget` slot
in Card H of the `superAdminOnlySection` with a real live widget.

**Motivation.** The placeholder already exists and is well-documented. Three
files have explicit comments tracking this gap:

- `apps/admin/src/lib/dashboard-sources/super.ts` (L183-186): commented-out
  `registerDataSource('super.audit.log.sentry', ...)` call with the note
  "Sentry write-only from our backend; needs a Sentry-API proxy".
- `apps/admin/src/config/ia/dashboards.ts` (L1132-1136): Card H sub-slot 3
  hard-codes `phaseSpec: 'SPEC-163'` and the description
  "Errores Sentry (últimas 24h) — disponible cuando se implemente la integración
  proxy con la API de Sentry." This spec delivers that integration.
- `apps/admin/src/lib/sentry/sentry.config.ts`: Sentry is initialised for
  error _capture_ only (`@sentry/react`); no API read path exists.

**Scope.** Initial metrics: list of recent unresolved issues (title, level,
event count, `lastSeen`) + total issue count in the last 24 hours. The feature
is SUPER_ADMIN-only, consistent with the rest of Card H.

**Sibling specs.** SPEC-224 (PostHog analytics dashboard) and SPEC-226 (Brevo
email dashboard) share the same proxy + datasource + widget pattern. The
implementation SHOULD extract a reusable `createExternalMetricsHandler` helper
(or equivalent) to avoid copy-paste across all three. This is strongly
recommended but may be deferred to a follow-up refactor spec if the team
prefers to land each integration independently first.

**Distinction from SPEC-180.** SPEC-180 ("Sentry Observability Hardening") is
about improving error _capture_ (source maps, environments, logger transport).
This spec is exclusively about _reading_ Sentry data and displaying it in the
admin UI. The two specs do not conflict and can be worked in any order.

**Locked design decisions (2026-06-13).**

1. Proxy approach: **server-side** API route under `/api/v1/admin/sentry/*`.
   The Sentry auth token is a server secret — it must never be exposed to the
   browser. The admin SPA calls the API proxy; the proxy calls Sentry.
2. Sentry Issues API: `GET https://sentry.io/api/0/projects/{org}/{project}/issues/`
   with `?query=is:unresolved&limit=10&sort=date` for recents, and
   `?query=is:unresolved&statsPeriod=24h&limit=1` (or the `stats` endpoint)
   for the 24-hour count. Verified at https://docs.sentry.io/api/events/ .
3. Auth: Bearer token via `HOSPEDA_SENTRY_API_TOKEN` (read-only, minimum
   scopes `event:read` + `project:read`). Distinct from `SENTRY_AUTH_TOKEN`
   (build-time source-map upload token).
4. New env vars: `HOSPEDA_SENTRY_API_TOKEN`, `HOSPEDA_SENTRY_ORG_SLUG`,
   `HOSPEDA_SENTRY_PROJECT_SLUG`. All server-side (`HOSPEDA_` prefix), optional
   — missing token degrades gracefully (widget shows "not configured" state).
5. Caching: HTTP-level `Cache-Control` on the proxy response (60 s). No
   additional DB cache layer — the data is ephemeral diagnostic info, not
   platform data.
6. Permission: `PermissionEnum.SYSTEM_MAINTENANCE_MODE` — consistent with the
   other Card H / system endpoints (`apps/api/src/routes/system/admin/health.ts`
   uses the same gate).

**Baseline.** File refs verified against `origin/staging` on 2026-06-13.

---

## User Stories & Acceptance Criteria

### US-1 — SUPER_ADMIN sees recent Sentry errors

GIVEN a SUPER_ADMIN user on the admin dashboard,
WHEN Card H loads and `HOSPEDA_SENTRY_API_TOKEN` is configured,
THEN the "Errores Sentry" sub-slot shows: up to 10 recent unresolved issues
with title, severity level (error/warning/info/fatal), event count, and
`lastSeen` timestamp, and a headline KPI showing total issues in the last 24 h.

### US-2 — Widget degrades gracefully when token is absent

GIVEN `HOSPEDA_SENTRY_API_TOKEN` is not set (dev, staging without the token),
WHEN Card H loads,
THEN the "Errores Sentry" slot renders a neutral "no configurado" state — no
error is thrown, no broken layout appears, and other Card H slots are unaffected.

### US-3 — Widget degrades gracefully when Sentry API is unreachable

GIVEN the Sentry API returns an error or times out,
WHEN the datasource resolver fetches,
THEN the slot renders a neutral "servicio no disponible" state and logs the
failure server-side; the rest of the dashboard is unaffected.

### US-4 — API proxy is SUPER_ADMIN-only

GIVEN any request to `GET /api/v1/admin/sentry/issues`,
WHEN the caller does not have `SYSTEM_MAINTENANCE_MODE` permission,
THEN the API returns 403 Forbidden.

### US-5 — Data is stale-tolerant (short cache)

GIVEN the widget has loaded data,
WHEN the SUPER_ADMIN reloads within 60 seconds,
THEN the proxy returns the cached response (no redundant Sentry API call), and
TanStack Query's `staleTime` prevents a redundant client-side re-fetch.

---

## Technical Approach

### Part A — New env vars

Three new server-side env vars, all optional. Absence of
`HOSPEDA_SENTRY_API_TOKEN` is the "disabled" signal — the proxy returns a
typed `{ configured: false }` response instead of calling Sentry.

| Var | Description | Secret |
|-----|-------------|--------|
| `HOSPEDA_SENTRY_API_TOKEN` | Sentry user/org auth token with `event:read` + `project:read` scopes | yes |
| `HOSPEDA_SENTRY_ORG_SLUG` | Sentry organisation slug (e.g. `qazuor`) | no |
| `HOSPEDA_SENTRY_PROJECT_SLUG` | Sentry project slug (e.g. `hospeda-api`) | no |

**Touched files (env):**

- `packages/config/src/env-registry.hospeda.ts` — add three entries under the
  `// Monitoring` section (after the existing `HOSPEDA_SENTRY_ENVIRONMENT`
  entry, before `HOSPEDA_POSTHOG_KEY`). Use `apps: ['api']`.
- `apps/api/src/utils/env.ts` — add three optional Zod fields to
  `ApiEnvBaseSchema`.
- `apps/api/.env.example` — add placeholders for the three new vars.

**Coolify note (for the operator).** After merging, set
`HOSPEDA_SENTRY_API_TOKEN`, `HOSPEDA_SENTRY_ORG_SLUG`, and
`HOSPEDA_SENTRY_PROJECT_SLUG` in Coolify for `hospeda-api-prod` (and
`hospeda-api-staging` when testing). Use `hops env-set api KEY VALUE --secret`
for the token. The feature degrades to "not configured" until these are set.

### Part B — API proxy route

**New route:** `GET /api/v1/admin/sentry/issues`

Returns typed Sentry issues data (or a `{ configured: false }` payload when the
token is absent). Calls the Sentry Issues API server-side with a 5-second
timeout. Caches the response for 60 seconds.

**Touched files (API):**

- `apps/api/src/routes/sentry/` — new directory.
  - `apps/api/src/routes/sentry/admin/issues.ts` — route handler using
    `createAdminRoute` from `apps/api/src/utils/route-factory.ts`. Required
    permission: `PermissionEnum.SYSTEM_MAINTENANCE_MODE`. Zod response schema
    defined inline (endpoint-private, not a shared entity schema). Two fetch
    calls to Sentry API in parallel: recent issues list + 24-hour count.
  - `apps/api/src/routes/sentry/admin/index.ts` — sub-router.
  - `apps/api/src/routes/sentry/index.ts` — mounts admin sub-router.
- `apps/api/src/routes/index.ts` (or the admin router barrel) — register the
  new `sentryRoutes` under `/api/v1/admin/sentry`.
- `docs/billing/endpoint-gate-matrix.md` — add row (see matrix entry below).

**Response schema (inline Zod, not in `@repo/schemas` — this is admin-internal
diagnostic data, not a platform entity):**

```ts
// Discriminated union: configured vs not
const SentryIssueSchema = z.object({
    id: z.string(),
    title: z.string(),
    level: z.enum(['fatal', 'error', 'warning', 'info', 'debug']),
    count: z.number(),         // total event count all-time
    lastSeen: z.string(),      // ISO 8601
    permalink: z.string().url().optional()
});

const SentryIssuesDataSchema = z.discriminatedUnion('configured', [
    z.object({
        configured: z.literal(true),
        issues: z.array(SentryIssueSchema),
        totalLast24h: z.number(),
        fetchedAt: z.string()  // ISO 8601
    }),
    z.object({
        configured: z.literal(false)
    })
]);
```

**Endpoint gate matrix row:**

```
| `GET /api/v1/admin/sentry/issues` | `sentry/admin/issues.ts` | none | - | n/a | Admin read; PermissionEnum.SYSTEM_MAINTENANCE_MODE — returns Sentry issues data or { configured: false } when token absent (SPEC-225) |
```

### Part C — Dashboard datasource registration

**Touched files (admin datasource):**

- `apps/admin/src/lib/dashboard-sources/super.ts` — uncomment and complete
  the `registerDataSource('super.audit.log.sentry', ...)` call (L183-186).
  The resolver calls `GET /api/v1/admin/sentry/issues` via `fetchApi`, maps
  the response to a KPI shape: headline = `totalLast24h`, list =
  `issues.slice(0, 5)` for a compact preview. Handle the `configured: false`
  discriminant by returning `null` (triggers `onMissing: 'hide'` on the slot).

```ts
registerDataSource('super.audit.log.sentry', (ctx) => ({
    queryKey: buildDashboardQueryKey('super.audit.log.sentry', ctx),
    queryFn: async () => {
        const result = await fetchApi<SentryIssuesApiResponse>({
            path: '/api/v1/admin/sentry/issues'
        });
        const data = result.data.data;
        if (!data?.configured) return null;
        return {
            totalLast24h: data.totalLast24h,
            issues: data.issues.slice(0, 5),
            fetchedAt: data.fetchedAt
        };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));
```

- Add `SentryIssuesApiResponse` interface in the same file (mirrors the
  route's response schema as a TypeScript interface — no Zod import in the
  admin datasource layer, only in the API route).

### Part D — Dashboard widget (Card H, sub-slot 3)

**Touched files (admin config):**

- `apps/admin/src/config/ia/dashboards.ts` — update the third `deferredSlots`
  entry in `super-card-h` (L1132-1136). Replace it with a real widget sub-slot
  entry that references `source: 'super.audit.log.sentry'`. The outer card
  (`super-card-h`) retains `onMissing: 'hide'` and `type: 'callout'`.

  Option A (simpler): keep Card H as a single `callout` card that now has one
  live sub-slot (Sentry) and two still-deferred sub-slots (SPEC-162). The
  `onMissing: 'hide'` on the Sentry sub-slot means it hides when the token is
  absent — the card only becomes visible when at least one slot has data.

  Option B: split Card H into a dedicated Sentry card (type `list` or `kpi`)
  separate from the audit-log card. Cleaner UX, slightly more config.

  **Recommended: Option A** to stay minimal and avoid card proliferation before
  SPEC-162 lands. The decision should be confirmed during implementation.

- If a new `SentryErrorsWidget` React component is needed (for custom list
  rendering of the issues table), add it to
  `apps/admin/src/components/dashboard/widgets/SentryErrorsWidget.tsx`.
  Styling: Tailwind CSS v4 utility classes (admin convention).

### Part E — i18n keys

- `packages/i18n/src/locales/{es,en,pt}/admin.json` (or equivalent dashboard
  locale file) — add keys for widget labels: `sentryErrors`, `last24h`,
  `noIssues`, `notConfigured`, `serviceUnavailable`, issue level labels
  (`fatal`, `error`, `warning`, `info`).

### Patterns / constraints

- No `any`; `import type`; named exports; RO-RO; Zod inline schema in route
  (not `@repo/schemas` — this is diagnostic, not platform data).
- Admin routes: `createAdminRoute` from `route-factory.ts`; permission via
  `PermissionEnum.SYSTEM_MAINTENANCE_MODE` (same as system health endpoint).
- Admin styling: Tailwind CSS v4 utility classes (no CSS Modules).
- TanStack Query for server state in admin.
- Sentry API base URL hardcoded as `https://sentry.io/api/0` (config constant,
  overridable in tests via env or DI).
- `AbortSignal.timeout(5000)` for the Sentry API fetch (5 s hard timeout).
- New env vars follow the full 5-step workflow: registry + `env.ts` + `.env.example`
  + docs + Coolify note.
- Every new admin route needs a row in `docs/billing/endpoint-gate-matrix.md`
  (SPEC-145 guard, CI blocks PRs without it).

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sentry API rate limits | Low | 60-second server-side cache + `staleTime` on TanStack Query; Sentry's free tier is generous for admin polling |
| Token scope misconfiguration | Low | Proxy returns a typed error shape; widget shows "not configured"; admin can fix via Coolify without a deploy |
| Sentry API response shape changes | Low | Route validates response with inline Zod schema; unexpected shapes return a typed error rather than crashing |
| `configured: false` UX confusion | Low | Widget copy clearly says "Sentry no configurado — configurar token en Coolify"; not an error state |
| Multi-project Sentry org | Medium | Initial scope: single `HOSPEDA_SENTRY_PROJECT_SLUG`. Multi-project support (comma-separated slugs, merged results) is out of scope for v1; tracked as a follow-up |
| Conflation with SPEC-180 | Low | Explicit Out of Scope section; code review should flag any overlap |
| Pattern divergence from SPEC-224/226 | Medium | Establish shared `createExternalMetricsHandler` helper early; all three specs (224/225/226) should share the proxy+datasource pattern |

---

## Out of Scope

- **SPEC-180 (Sentry Observability Hardening)**: source maps, structured logger
  transport to Sentry, sampling configuration. SPEC-180 is about error
  _capture_; this spec is about error _read_. They are orthogonal.
- **SPEC-162/163 (Audit log / Security log)**: the other two Card H sub-slots
  remain deferred. This spec only delivers the Sentry sub-slot.
- **Multi-project aggregation**: initial scope is one project slug. Querying
  multiple Sentry projects and merging results is a future enhancement.
- **Issue detail / drill-down**: the widget shows a summary list with
  `permalink` links that open in Sentry directly. In-app issue detail is out
  of scope.
- **Sentry performance data**: traces, web vitals, transaction durations. This
  spec is limited to _issues_ (errors/exceptions).
- **Sentry alert rules / notifications**: this is read-only display, no write
  operations against the Sentry API.
- **Cron-based pre-fetch**: unlike SPEC-215 (weather), Sentry errors are
  pulled on-demand via the proxy with a short HTTP cache. No DB caching or
  cron job is needed at v1.
- **Real-time push / WebSockets**: the widget refreshes on TanStack Query's
  normal stale/refetch cycle. Live push is out of scope.

---

## Suggested Tasks (phased)

### Phase 0 — Setup

- T-01: Register three new env vars in `packages/config/src/env-registry.hospeda.ts`
  (under Monitoring, after `HOSPEDA_SENTRY_ENVIRONMENT`) + add optional Zod
  fields in `apps/api/src/utils/env.ts` + update `apps/api/.env.example`.

### Phase 1 — API proxy

- T-02: Create `apps/api/src/routes/sentry/admin/issues.ts` — `createAdminRoute`,
  `SYSTEM_MAINTENANCE_MODE` permission, inline Zod schemas, parallel Sentry API
  fetches with 5 s timeout, `configured: false` fast-path, 60 s cache.
- T-03: Create `apps/api/src/routes/sentry/admin/index.ts` + `sentry/index.ts`
  barrel; register in the API admin router.
- T-04: Add row to `docs/billing/endpoint-gate-matrix.md`.
- T-05: Unit tests for the proxy handler — mock `fetch`, verify: (a) token
  absent → `{ configured: false }`; (b) Sentry 200 → mapped response; (c)
  Sentry timeout → error shape; (d) permission gate (403 without
  `SYSTEM_MAINTENANCE_MODE`).

### Phase 2 — Admin datasource

- T-06: Uncomment and complete `registerDataSource('super.audit.log.sentry', ...)`
  in `apps/admin/src/lib/dashboard-sources/super.ts`. Add
  `SentryIssuesApiResponse` interface. Handle `configured: false` → `null`.
- T-07: Unit test the resolver — mock `fetchApi`, verify `null` on
  `configured: false`, mapped shape on success.

### Phase 3 — Dashboard widget

- T-08: Update Card H (`super-card-h`) in
  `apps/admin/src/config/ia/dashboards.ts` — replace deferred slot 3 with a
  live sub-slot referencing `source: 'super.audit.log.sentry'` (decision:
  Option A or B, confirm with user before coding).
- T-09: (Optional) Create `SentryErrorsWidget.tsx` component if the generic
  widget renderer cannot display the issues list adequately.
- T-10: Add i18n keys (`es`, `en`, `pt`) for Sentry widget labels.

### Phase 4 — QA / polish

- T-11: Manual smoke on staging with a real `HOSPEDA_SENTRY_API_TOKEN` — verify
  issues appear, count is correct, and `configured: false` state renders cleanly
  without the token.
- T-12: Verify `onMissing: 'hide'` hides the slot (and the card if all slots
  are null) when token is absent.
- T-13: Update `apps/api/docs/route-architecture.md` if needed; no billing docs
  changes required (admin-only diagnostic endpoint).

---

## Internal Review Notes

- **Verified on staging (origin/staging, 2026-06-13):**
  - `apps/admin/src/lib/sentry/sentry.config.ts`: confirms Sentry is
    write-only (`@sentry/react`); exports `initSentry`, `captureError`,
    `captureMessage`, etc. — no read/query functionality.
  - `apps/admin/src/lib/dashboard-sources/super.ts` (L172-186): Card H
    comment block explicitly lists `registerDataSource('super.audit.log.sentry',
    ...)` as the pending registration — exactly the placeholder this spec fills.
    Source ID confirmed: `'super.audit.log.sentry'`.
  - `apps/admin/src/config/ia/dashboards.ts` (L1099-1139): `super-card-h`
    with three `deferredSlots`; slot 3 references `phaseSpec: 'SPEC-163'` and
    the Sentry integration description. This spec supersedes SPEC-163 for this
    slot.
  - `apps/api/src/routes/system/admin/health.ts`: confirms `createAdminRoute`
    pattern + `PermissionEnum.SYSTEM_MAINTENANCE_MODE` as the system-ops
    permission gate. This spec follows the same pattern.
  - Existing env-registry monitoring section (L1217-1330): four `HOSPEDA_SENTRY_*`
    vars exist (`DSN`, `RELEASE`, `PROJECT`, `ENVIRONMENT`) — all write/ingestion
    scoped, none for API read. `SENTRY_AUTH_TOKEN` also exists but is build-time
    source-map upload only. The three new vars (`API_TOKEN`, `ORG_SLUG`,
    `PROJECT_SLUG`) are genuinely new and do not collide.
  - No existing `apps/api/src/routes/sentry/` directory — the route directory
    is entirely new.
- **Sentry Issues API confirmed:** `GET https://sentry.io/api/0/projects/{org}/{project}/issues/`
  documented at https://docs.sentry.io/api/events/list-a-projects-issues/ .
  Auth: `Authorization: Bearer <token>`. Required scopes: `event:read`.
- **Open questions for impl:**
  1. Option A vs B for Card H widget structure — confirm with user before T-08.
  2. `HOSPEDA_SENTRY_PROJECT_SLUG` as a single slug vs comma-separated list —
     start with single slug for v1, document the limitation.
  3. Whether to extract a shared `createExternalMetricsHandler` helper before
     landing SPEC-224/225/226 — recommended yes, but may be a post-v1 refactor.
  4. `staleTime` value for the datasource — propose
     `DASHBOARD_STALE_TIME_MS` (existing constant) and allow override.
