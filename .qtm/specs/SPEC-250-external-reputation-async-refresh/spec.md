---
spec-id: "SPEC-250"
type: "improvement"
complexity: high
status: completed
created: "2026-06-20"
tags: ["external-reputation", "apify", "cron", "async", "accommodation", "SPEC-237-followup"]
---

# Asynchronous External Reputation Refresh (Apify Async API + Polling)

## Part 1: Functional Specification

### Overview & Goals

**Goal**: Eliminate the synchronous HTTP hang in the external reputation refresh endpoint by switching Apify-backed platform fetches (Booking fallback, Airbnb) from a blocking run-sync call to a two-phase async pattern: enqueue a run immediately, resolve results via a polling cron job.

**Motivation**: The current `AccommodationExternalReputationService.refresh()` runs in a serial `for...of` loop calling `runApifyActor()` — which uses Apify's `run-sync-get-dataset-items` endpoint that blocks until the actor finishes. The Booking actor alone takes 73-120 s, and a 3-platform refresh hangs the HTTP connection for ~100 s. This causes timeouts, poor UX in the owner panel, and wastes API server resources. The weekly background cron shares the same code path (it just runs detached, so the hang is invisible there today — but it still means 3+ actors run serially rather than in parallel).

**Success metrics**:

- The `POST /api/v1/protected/accommodations/:id/external-reputation/refresh` endpoint returns p95 < 1 s (target) and never blocks > ~2 s even under adversarial conditions.
- All 3 platforms resolve correctly and their data appears in the owner panel within the polling interval after the Apify run finishes (typically 2-5 min from enqueue).
- The weekly cron continues to refresh all accommodations (same code path, no regression).
- Zero broken existing tests on `runApifyActor` (SPEC-222 import adapters untouched).

**Target users**: Accommodation owners who manually trigger a reputation refresh from their configuration panel (web app), and the cron scheduler that runs the weekly batch.

---

### User Stories & Acceptance Criteria

#### US-1: Owner triggers refresh and gets immediate feedback

**As an** accommodation owner, **I want** the "refresh external reputation" action to return immediately with a status confirmation, **so that** I am not left waiting 60-120 s for the page to respond.

**Acceptance Criteria:**

- **Given** an accommodation with Airbnb and/or Booking listings (Apify-backed) plus a Google listing, **When** the owner triggers a refresh (POST endpoint), **Then** the endpoint responds with HTTP 202 within ~2 s, the response body indicates which platforms were enqueued asynchronously and which resolved inline, and the DB rows for enqueued platforms show `run_status = 'pending'`.

- **Given** an accommodation with ONLY a Google listing (no Apify platforms), **When** the owner triggers a refresh, **Then** the endpoint responds with HTTP 200 (all resolved inline), Google data is persisted immediately, and no DB rows have `run_status = 'pending'`.

- **Given** Google resolves inline and Airbnb is enqueued, **When** the endpoint responds, **Then** the response payload includes both: Google data immediately and Airbnb as pending (e.g. `{ inlineSucceeded: ['GOOGLE'], enqueuedAsync: ['AIRBNB'] }`).

- **Given** the owner's accommodation is under the rate limit (1 refresh per 600 s), **When** a second refresh is attempted within the window, **Then** HTTP 429 is returned with a `Retry-After` header, exactly as today.

- **Given** the actor calling the endpoint does not have `ACCOMMODATION_UPDATE_ANY` OR does not own the accommodation, **When** the refresh is called, **Then** HTTP 403 is returned and no run is started.

#### US-2: Asynchronous results appear in the owner panel automatically

**As an** accommodation owner, **I want** to see the reputation data update in my panel without having to manually reload the page, **so that** I know when the Apify runs have finished.

**Acceptance Criteria:**

- **Given** Apify runs are pending (`run_status = 'pending'` or `'running'`) for one or more platforms, **When** the owner views the reputation section of their config panel, **Then** the UI shows a per-platform "actualizando..." indicator.

- **Given** the polling cron has resolved all pending runs to `run_status = 'idle'` (either `fetch_status = 'ok'` or `'error'`), **When** the owner's panel polls the status endpoint, **Then** the indicators update: "listo" (ok) or "falló" (error), and any new rating/snippet data is displayed.

- **Given** the panel is showing "actualizando..." for a platform, **When** the status endpoint is polled (lightweight poll every ~10 s), **Then** the panel updates without a full page reload.

#### US-3: Polling cron resolves Apify runs and persists results

**As the** platform operator, **I want** a dedicated cron job to periodically check the status of queued Apify runs and persist their results, **so that** reputation data is eventually consistent without blocking any HTTP handler.

**Acceptance Criteria:**

- **Given** one or more `accommodation_external_reputation` rows with `run_status IN ('pending', 'running')`, **When** the `poll-apify-reputation-runs` cron fires, **Then** it calls `GET /v2/actor-runs/{runId}` on Apify for each, and:
  - If `status = 'SUCCEEDED'`: fetches dataset items, maps them through the adapter's `mapDatasetItems()`, upserts `rating`, `reviews_count`, `deep_link`, `fetch_status = 'ok'`, `run_status = 'idle'`, clears `apify_run_id` and `apify_dataset_id`, sets `aggregate_fetched_at = now()`.
  - If `status IN ('FAILED', 'ABORTED', 'TIMED-OUT')`: sets `fetch_status = 'error'`, `fetch_message` = Apify status, `run_status = 'idle'`, clears run IDs.
  - If `status IN ('READY', 'RUNNING')` and `run_started_at` is within the timeout window: sets `run_status = 'running'` (no other change), waits for next tick.
  - If `status IN ('READY', 'RUNNING')` and `run_started_at` is older than the configured timeout (env `HOSPEDA_EXTREP_APIFY_RUN_TIMEOUT_MS`, default 600 000 ms / 10 min): sets `fetch_status = 'error'`, `fetch_message = 'Apify run timed out'`, `run_status = 'idle'`, clears run IDs.
- **Given** the poller finds 0 pending rows, **When** it fires, **Then** it exits cleanly with `processed: 0, errors: 0`.
- **Given** the poller is called while a prior tick is still executing (e.g. Apify is slow to respond), **When** it processes the same run_id, **Then** it behaves idempotently — no duplicate upserts, no data corruption.

#### US-4: Weekly cron continues to refresh all accommodations

**As the** platform operator, **I want** the existing weekly batch job to continue refreshing all enabled accommodations, **so that** reputation data stays fresh without owner action.

**Acceptance Criteria:**

- **Given** the weekly cron (`refresh-external-reputation`, schedule `HOSPEDA_EXTREP_CRON_SCHEDULE`, default `0 2 * * 1`) fires, **When** it processes accommodations, **Then** it enqueues Apify runs asynchronously (same code path as the owner endpoint), resolving inline only Google/fast JSON-LD platforms, exactly as in US-1.
- **Given** a per-accommodation refresh in the cron batch encounters an Apify error at the enqueue phase, **When** the batch continues, **Then** it logs the error, marks the platform `run_status = 'idle'` / `fetch_status = 'error'`, and moves to the next accommodation without aborting the batch.

#### US-5: Run failure surfaces in the owner panel

**As an** accommodation owner, **I want** to know when an external reputation fetch failed, **so that** I can decide whether to retry or investigate.

**Acceptance Criteria:**

- **Given** an Apify run fails or times out, **When** the polling cron sets `fetch_status = 'error'` and `run_status = 'idle'`, **Then** the owner's panel shows a "falló" indicator for that platform (not a perpetual spinner).
- **Given** a platform shows "falló", **When** the owner triggers another refresh, **Then** the process starts from the top (new Apify run is enqueued, `run_status = 'pending'` again).

---

### UX Considerations

**User flows**:

1. Owner opens accommodation config panel → clicks "Refresh reputation" button → button immediately shows "Refreshing..." → panel shows per-platform state chips (`actualizando...` / rating badge with cached data).
2. Panel polls GET status endpoint every ~10 s (only while at least one platform is `pending` or `running`).
3. As each platform settles, chip updates inline: either the new rating/review count (ok) or a "falló" error badge.
4. When all platforms are settled, polling stops.

**Loading states**:

- `pending` / `running`: show a spinner chip with text "actualizando..." and the previously cached rating (if any) in muted style to indicate it may be stale.
- `idle` + `fetch_status = 'ok'`: show rating/review count normally.
- `idle` + `fetch_status = 'error'` / `'blocked'` / `'not_found'`: show an error badge "falló" with the `fetch_message` as a tooltip.
- Initial load before any refresh: unchanged from current behavior (shows cached data).

**Edge cases**:

- If the owner navigates away during a pending refresh, the run continues in the background. On return to the panel, the status reflects the current DB state.
- If an accommodation has NO Apify platforms (e.g. Google only), the poll never fires for it and 202 is never returned — a 200 with inline data is the correct response.
- If Apify token is missing from credentials at enqueue time, the run is NOT enqueued; `fetch_status = 'error'`, `fetch_message = 'Apify token not configured'`, endpoint still returns 200/202 for other platforms.

**Error states**:

- `run_status = 'idle'` + `fetch_status = 'error'`: displayed as "falló" with tooltip.
- Network failure polling the status endpoint: silently retry next poll tick, do not show an error to the owner (transient).
- If the status endpoint itself returns a 4xx/5xx: stop polling, show a generic "no se pudo obtener el estado" message.

**Accessibility**:

- Status chips must include `aria-live="polite"` so screen-reader users hear state transitions without focus change.
- Spinner animation must respect `prefers-reduced-motion`.

**Styling**: web app uses vanilla CSS / CSS Modules (`*.module.css`) co-located with the component. No Tailwind. All user-facing text via `@repo/i18n` locale keys.

**i18n keys to add** (namespace `web` or `common`, confirm with existing convention):

- `externalReputation.status.pending` → "Actualizando..."
- `externalReputation.status.running` → "Procesando..."
- `externalReputation.status.ok` → (not shown directly — rating renders as normal)
- `externalReputation.status.error` → "Falló"
- `externalReputation.status.blocked` → "Bloqueado"
- `externalReputation.status.notFound` → "No encontrado"
- `externalReputation.refresh.enqueued` → "Actualizando en segundo plano..."
- `externalReputation.refresh.inlineSuccess` → "Actualizado"

---

### Out of Scope

- **Apify webhook receiver**: rejected in favor of polling. Webhooks require a public HTTPS endpoint, firewall changes, retry handling, and secret validation — all complexity avoidable with simple polling at low frequency. Polling is simpler, testable, and sufficient given Apify runs finish in 1-5 min.
- **Google going async**: Google Places API typically responds in ~1 s. Making it async adds complexity with zero user benefit.
- **Changing the public reputation read endpoint's response shape**: `run_status` is an internal coordination column. `buildExternalReputationBlock` and `ExternalReputationBlockSchema` are NOT modified. The public block never exposes `run_status`, `apify_run_id`, or `apify_dataset_id`.
- **SPEC-222 import adapters**: `runApifyActor()` in `apify-client.ts` is NOT changed. Import adapters (accommodation import from Airbnb/Booking) continue calling the sync endpoint. Out of scope.
- **Admin UI for run status**: admins can inspect `run_status` via direct DB query or Drizzle Studio. No admin panel view for run state is planned.
- **Parallel cron execution guard**: the polling cron runs every 2 min and each tick is short (HTTP status checks only); overlapping ticks are extremely unlikely and idempotent status checks make them safe. A mutex/lock is deferred.

---

## Part 2: Technical Analysis

### Architecture

**Pattern**: Event-driven async with DB-backed state machine. The refresh action splits into two phases separated in time by a cron tick.

**Components changed or created**:

| Component | Change type | File(s) |
|-----------|-------------|---------|
| DB schema (`accommodation_external_reputation`) | Modify — 4 new columns + 1 new pg enum | `packages/db/src/schemas/accommodation-external/accommodation_external_reputation.dbschema.ts`, `packages/db/src/schemas/enums.dbschema.ts` |
| Zod schema (`@repo/schemas`) | Modify — add `ExternalReputationRunStatusSchema`, new optional fields on `AccommodationExternalReputationSchema` | `packages/schemas/src/entities/accommodation-external/accommodation-external-reputation.schema.ts` |
| Apify async client | Create — 3 new functions in existing file | `packages/service-core/src/services/accommodation-import/adapters/apify-client.ts` |
| Booking adapter | Modify — split `fetch()` into `startRun()` + `mapDatasetItems()` (Phase A + B) | `packages/service-core/src/services/accommodation-external-reputation/adapters/booking-reputation.adapter.ts` |
| Airbnb adapter | Modify — same split | `packages/service-core/src/services/accommodation-external-reputation/adapters/airbnb-reputation.adapter.ts` |
| `ReputationAdapter` interface | Modify — add optional `startRun()` + `mapDatasetItems()` methods | `packages/service-core/src/services/accommodation-external-reputation/adapters/adapter.types.ts` |
| `AccommodationExternalReputationService.refresh()` | Modify — inline Google/fast paths, enqueue Apify paths | `packages/service-core/src/services/accommodation-external-reputation/accommodation-external-reputation.service.ts` |
| Protected refresh route | Modify — 202 response when async paths enqueued | `apps/api/src/routes/accommodation-external-reputation/protected/refresh.ts` |
| New status endpoint | Create — lightweight per-platform run_status read | `apps/api/src/routes/accommodation-external-reputation/protected/reputation-status.ts` |
| New polling cron job | Create | `apps/api/src/cron/jobs/poll-apify-reputation-runs.job.ts` |
| Cron registry | Modify | `apps/api/src/cron/registry.ts` |
| Cron manifest | Modify | `apps/api/src/cron/schedules.manifest.ts` |
| Owner panel UI component | Modify — add run_status states + polling hook | `apps/web/src/components/...` (locate existing reputation config component from SPEC-237) |
| Tests | Create/modify | various `test/` directories |

**Integration points**:

- Apify REST API (async endpoints — see External API section below).
- Existing `reputationModel.upsertReputation()` is the write path (unchanged interface, new fields added to payload).
- `getReputationAdapterCredentials()` in `apps/api/src/utils/reputation-credentials.ts` — unchanged, still supplies `apifyToken`, `apifyBookingActor`, `apifyAirbnbActor` to the service.
- Cron scheduler bootstrap (`apps/api/src/cron/bootstrap.ts`) — reads `recordCronRun()` automatically; new job added to registry only.

**Data flow**:

```
Owner clicks refresh
    → POST /protected/accommodations/:id/external-reputation/refresh
        → Service.refresh():
            Google/JSON-LD: fetch() inline → upsert immediately → run_status='idle'
            Airbnb/Booking: startRun() → persist apify_run_id + run_status='pending'
        → Route returns 202 { inlineSucceeded, enqueuedAsync }

Every 2 min: poll-apify-reputation-runs cron fires
    → SELECT rows WHERE run_status IN ('pending','running')
    → For each: getApifyRunStatus(runId)
        SUCCEEDED → getApifyDatasetItems(datasetId) → mapDatasetItems() → upsert fetch_status='ok', run_status='idle'
        FAILED/ABORTED/TIMED-OUT → upsert fetch_status='error', run_status='idle'
        READY/RUNNING within timeout → update run_status='running', skip
        READY/RUNNING past timeout → upsert fetch_status='error', run_status='idle'

Owner panel polls GET /protected/accommodations/:id/external-reputation/status every ~10 s
    → Returns { platforms: { GOOGLE: { runStatus, fetchStatus, rating, ... }, AIRBNB: {...} } }
    → UI updates chips; stops polling when all run_status='idle'
```

**State machine for each `accommodation_external_reputation` row**:

```
         startRun() called
[idle] ──────────────────→ [pending]
                                │
          Apify reports RUNNING │
                                ↓
                           [running]
                                │
          ┌─────────────────────┴─────────────────────┐
          │ SUCCEEDED                                  │ FAILED/ABORTED/TIMED-OUT/timeout sweep
          ↓                                            ↓
  mapDatasetItems()                          fetch_status='error'
  upsert ok data                                      │
          │                                            │
          └──────────────────────────────→ [idle] ←──┘

Transitions:
  idle    → pending  : startRun() persists apify_run_id, sets run_started_at
  pending → running  : poller sees READY→RUNNING, updates run_status
  running → idle     : poller sees terminal status, upserts result
  pending → idle     : poller sees terminal status before RUNNING (fast fail)
```

---

### Data Model Changes

#### New pg enum: `external_reputation_run_status_enum`

Values: `'idle'`, `'pending'`, `'running'`

This enum ships via the generated Drizzle migration (structural carril, `pnpm db:generate`). It is a Drizzle `pgEnum` defined in `packages/db/src/schemas/enums.dbschema.ts`:

```ts
// Add to packages/db/src/schemas/enums.dbschema.ts
export const ExternalReputationRunStatusPgEnum = pgEnum(
    'external_reputation_run_status_enum',
    ['idle', 'pending', 'running']
);
```

#### New columns on `accommodation_external_reputation`

| Column | Drizzle type | Nullable | Default | Purpose |
|--------|-------------|---------|---------|---------|
| `run_status` | `ExternalReputationRunStatusPgEnum` (new enum) | NOT NULL | `'idle'` | Current async run state. Separate from `fetch_status` so the public block builder never sees transient run state. |
| `apify_run_id` | `text` | nullable | `null` | Apify run ID returned by `POST /v2/acts/{actor}/runs`. Set when `run_status='pending'`; cleared on resolution. |
| `apify_dataset_id` | `text` | nullable | `null` | Default dataset ID for the run (returned by SUCCEEDED status). Set by poller before fetching items; cleared on resolution. |
| `run_started_at` | `timestamptz` | nullable | `null` | Wall-clock time when `startRun()` was called. Used by the timeout sweep: if `now() - run_started_at > HOSPEDA_EXTREP_APIFY_RUN_TIMEOUT_MS`, the poller marks it as error. |

**Drizzle schema additions** (`packages/db/src/schemas/accommodation-external/accommodation_external_reputation.dbschema.ts`):

```ts
// Add import at top:
import { ExternalReputationRunStatusPgEnum } from '../enums.dbschema.ts';

// Add to table definition inside accommodationExternalReputation:
runStatus: ExternalReputationRunStatusPgEnum('run_status').notNull().default('idle'),
apifyRunId: text('apify_run_id'),
apifyDatasetId: text('apify_dataset_id'),
runStartedAt: timestamp('run_started_at', { withTimezone: true }),
```

**Index addition**: Add an index on `run_status` to make the poller's `WHERE run_status IN ('pending', 'running')` efficient (this table will have at most tens of rows in pending state at any time, but the table may grow to thousands of rows across all accommodations and platforms):

```ts
// Add to table's index configuration object:
accommodation_external_reputation_runStatus_idx: index(
    'accommodation_external_reputation_runStatus_idx'
).on(table.runStatus),
```

**Migration carril**: structural changes → `pnpm db:generate` + `pnpm db:migrate`. The new pg enum requires a `CREATE TYPE ... AS ENUM (...)` statement before the `ALTER TABLE` — Drizzle generates this correctly. No extras SQL needed (no triggers, no materialized views).

**Zod schema additions** (`packages/schemas/src/entities/accommodation-external/accommodation-external-reputation.schema.ts`):

```ts
// Add new schema (exported):
export const ExternalReputationRunStatusSchema = z.enum(['idle', 'pending', 'running']);
export type ExternalReputationRunStatus = z.infer<typeof ExternalReputationRunStatusSchema>;

// Add optional fields to AccommodationExternalReputationSchema:
runStatus: ExternalReputationRunStatusSchema.default('idle'),
apifyRunId: z.string().nullish(),
apifyDatasetId: z.string().nullish(),
runStartedAt: z.coerce.date().nullish(),
```

These fields are additive (`.default()` or `.nullish()`). Historic parse fixtures remain valid per the schema compat policy.

---

### API Design

#### Existing: `POST /api/v1/protected/accommodations/:id/external-reputation/refresh`

**File**: `apps/api/src/routes/accommodation-external-reputation/protected/refresh.ts`

**Changes**:

- Return HTTP **202** when at least one platform was enqueued asynchronously. Return **200** when all platforms resolved inline.
- Response body changes:

```ts
// New response shape (202):
{
  success: true,
  data: {
    inlineSucceeded: ExternalPlatformEnum[],   // e.g. ['GOOGLE']
    enqueuedAsync: ExternalPlatformEnum[],      // e.g. ['AIRBNB', 'BOOKING']
    inlineFailed: { platform: ExternalPlatformEnum; error: string }[]
  }
}

// Existing response shape (200, no async platforms):
{
  success: true,
  data: {
    succeeded: ExternalPlatformEnum[],
    failed: { platform: ExternalPlatformEnum; error: string }[]
  }
}
```

- Auth: unchanged — `createProtectedRoute`, ownership enforced in service (`ACCOMMODATION_UPDATE_ANY` OR own accommodation).
- Error codes: unchanged — 429 rate-limited, 403 forbidden, 404 not found.

#### New: `GET /api/v1/protected/accommodations/:id/external-reputation/status`

**File**: `apps/api/src/routes/accommodation-external-reputation/protected/reputation-status.ts`

**Purpose**: Lightweight poll endpoint. Returns per-platform `run_status` and cached `fetch_status` + rating. Does NOT trigger any Apify calls.

- **Auth**: `createProtectedRoute`, same ownership enforcement as refresh.
- **Request params**: `{ id: string (UUID) }` — the accommodation ID.
- **Response (200)**:

```ts
{
  success: true,
  data: {
    platforms: {
      [platform: ExternalPlatformEnum]: {
        runStatus: ExternalReputationRunStatus,   // 'idle' | 'pending' | 'running'
        fetchStatus: ExternalFetchStatus,          // 'ok' | 'error' | 'blocked' | 'not_found'
        rating: number | null,
        reviewsCount: number | null,
        aggregateFetchedAt: string | null          // ISO 8601 or null
      }
    },
    allSettled: boolean   // true when every platform has run_status='idle'
  }
}
```

- **Errors**: 403 if not owner, 404 if accommodation not found.
- **Note for UI implementers**: poll this endpoint every ~10 s while `allSettled = false`. Stop polling when `allSettled = true`.

---

### Adapter Refactor (core technical work)

The adapter interface (`adapter.types.ts`) gains two new optional methods. Adapters that do NOT use Apify (Google, Generic) do not implement them — the service checks for their presence before calling.

#### Updated `ReputationAdapter` interface

```ts
// In adapter.types.ts — add to interface:

/**
 * Phase A: enqueue an Apify actor run for this listing.
 * Implemented ONLY by adapters that use Apify (Booking fallback, Airbnb).
 * Returns the run ID + dataset ID on success, or null on failure (degrade gracefully).
 */
startRun?(listing: AccommodationExternalListing): Promise<{ runId: string; datasetId: string } | null>;

/**
 * Phase B: map raw dataset items returned by a completed Apify run to a reputation result.
 * Pure function — no HTTP calls. Called by the poller after getApifyDatasetItems().
 * Implemented by the same adapters that implement startRun().
 */
mapDatasetItems?(items: unknown[], listing: AccommodationExternalListing): ReputationFetchResult;
```

#### Booking adapter changes

`packages/service-core/src/services/accommodation-external-reputation/adapters/booking-reputation.adapter.ts`

Current `fetch()` flow:

1. Try `safeExternalFetch` + JSON-LD aggregate rating parse (fast, ~1 s).
2. If that fails, fall back to `runApifyActor()` (blocks 73-120 s).

New flow:

- `fetch()` retains ONLY Phase 1 (JSON-LD fast path). If JSON-LD succeeds, returns result as before (still inline, `run_status='idle'`).
- If JSON-LD fails/blocked, `fetch()` returns a sentinel: `{ rating: null, reviewsCount: null, deepLink: null, snippets: null, _needsApify: true }` — or the service simply checks if `startRun` is callable and JSON-LD result was null.

  **Preferred design** (cleaner): the service calls `fetch()` for the JSON-LD attempt first. If the result has all-null aggregates AND the adapter has `startRun`, the service falls through to the async path. The adapter does NOT return a sentinel — `fetch()` returns its best inline result (possibly all-null), and the service decides whether to go async.

- `startRun(listing)`: POSTs to `POST /v2/acts/{apifyBookingActor}/runs` via `startApifyRun()`, returns `{ runId, datasetId }` or null.
- `mapDatasetItems(items, listing)`: extracts `reviews` array item(s) from Booking actor output (count under `item.reviews`, rating from `item.rating` or similar — verify against actual actor output format documented in SPEC-237).

#### Airbnb adapter changes

`packages/service-core/src/services/accommodation-external-reputation/adapters/airbnb-reputation.adapter.ts`

Current `fetch()`: always calls `runApifyActor()` (blocks).

New flow:

- `fetch()`: removed Apify call. Returns `emptyReputationResult()` (all null). The service will always go async for Airbnb.
- `startRun(listing)`: POSTs to Apify async API for the Airbnb actor, returns `{ runId, datasetId }` or null.
- `mapDatasetItems(items, listing)`: extracts `guestSatisfaction` (0-5 scale → rescale to 0-10 or keep raw, consistent with current mapping), `reviewsCount`. Returns `ReputationFetchResult`.

#### Service logic in `refresh()`

```
for each enabled listing:
  adapter = getReputationAdapter(platform, creds)
  inlineResult = await adapter.fetch(listing)

  if inlineResult has non-null rating OR no startRun available:
    // Fast path resolved inline (Google, Generic, Booking JSON-LD success)
    upsert(inlineResult, run_status='idle')
    inlineSucceeded.push(platform)

  else if adapter.startRun is defined:
    // Slow path — enqueue async
    runResult = await adapter.startRun(listing)
    if runResult:
      upsert({ run_status='pending', apify_run_id=runResult.runId,
               apify_dataset_id=runResult.datasetId, run_started_at=now() })
      enqueuedAsync.push(platform)
    else:
      upsert({ fetch_status='error', fetch_message='startRun failed', run_status='idle' })
      inlineFailed.push({ platform, error: 'startRun failed' })

return { inlineSucceeded, enqueuedAsync, inlineFailed }
```

---

### New Apify Async Client Methods

**File**: `packages/service-core/src/services/accommodation-import/adapters/apify-client.ts`

Add three new exported functions alongside the existing `runApifyActor()`. Same module, same auth pattern (`Authorization: Bearer`), same trusted-host exemption, same degrade-to-null contract.

#### `startApifyRun`

```ts
export interface StartApifyRunInput {
    readonly token: string;
    readonly actor: string;           // 'owner/actor-name' form
    readonly actorInput: Record<string, unknown>;
}

export interface StartApifyRunResult {
    readonly runId: string;
    readonly defaultDatasetId: string;
}

/**
 * Starts an Apify actor run asynchronously.
 * POST /v2/acts/{actor}/runs
 * Returns { runId, defaultDatasetId } or null on failure.
 * Never throws.
 */
export async function startApifyRun(input: StartApifyRunInput): Promise<StartApifyRunResult | null>
```

Apify API: `POST https://api.apify.com/v2/acts/{actor}/runs`

- Request: JSON body = actorInput; headers: `Authorization: Bearer {token}`, `Content-Type: application/json`
- Response (201): `{ data: { id: string, defaultDatasetId: string, status: string, ... } }`
- Returns `{ runId: data.id, defaultDatasetId: data.defaultDatasetId }` on 201; `null` on any other status or fetch error.

#### `getApifyRunStatus`

```ts
export type ApifyRunStatus =
    | 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED';

export interface GetApifyRunStatusResult {
    readonly status: ApifyRunStatus;
    readonly defaultDatasetId: string;
}

/**
 * Gets the current status of an Apify actor run.
 * GET /v2/actor-runs/{runId}
 * Returns { status, defaultDatasetId } or null on failure.
 * Never throws.
 */
export async function getApifyRunStatus(input: {
    token: string;
    runId: string;
}): Promise<GetApifyRunStatusResult | null>
```

Apify API: `GET https://api.apify.com/v2/actor-runs/{runId}`

- Headers: `Authorization: Bearer {token}`
- Response (200): `{ data: { id, status, defaultDatasetId, ... } }`
- Returns `{ status: data.status, defaultDatasetId: data.defaultDatasetId }`.

#### `getApifyDatasetItems`

```ts
/**
 * Fetches all items from an Apify dataset.
 * GET /v2/datasets/{datasetId}/items
 * Returns unknown[] or [] on failure.
 * Never throws.
 */
export async function getApifyDatasetItems(input: {
    token: string;
    datasetId: string;
}): Promise<unknown[]>
```

Apify API: `GET https://api.apify.com/v2/datasets/{datasetId}/items`

- Headers: `Authorization: Bearer {token}`
- Response (200): JSON array of dataset items.
- Returns the array on 200; `[]` on failure.

**External API verification note**: All three endpoint shapes were verified against the Apify REST API v2 reference at <https://docs.apify.com/api/v2> on 2026-06-20. Key references:

- Actor runs: <https://docs.apify.com/api/v2#tag/Actor-runs/operation/act_runs_post> (POST — starts run)
- Run status: <https://docs.apify.com/api/v2#tag/Actor-runs/operation/act_run_get> (GET by runId)
- Dataset items: <https://docs.apify.com/api/v2#tag/Datasets/operation/dataset_items_get> (GET items)

---

### New Polling Cron Job

**File**: `apps/api/src/cron/jobs/poll-apify-reputation-runs.job.ts`

**Name**: `poll-apify-reputation-runs`
**Schedule env**: `HOSPEDA_EXTREP_POLL_SCHEDULE` (default `'*/2 * * * *'` — every 2 min)
**Category**: `'content'` (same as `refresh-external-reputation`)
**Timeout**: `60_000` ms (1 min — each tick should complete well within 1 min; Apify status checks are fast HTTP calls)

**Manifest entry** (add to `apps/api/src/cron/schedules.manifest.ts`):

```ts
{
    name: 'poll-apify-reputation-runs',
    displayName: 'Sondeo de runs de Apify (reputación)',
    category: 'content',
    schedule: '*/2 * * * *',
    description:
        'Checks the status of pending/running Apify actor runs for external reputation data and persists results when runs complete.'
}
```

**Handler pseudocode**:

```ts
handler: async (ctx) => {
    const { logger, startedAt } = ctx;

    const timeoutMs = parseInt(process.env.HOSPEDA_EXTREP_APIFY_RUN_TIMEOUT_MS ?? '600000', 10);
    const creds = getReputationAdapterCredentials(); // existing helper

    // 1. Fetch all pending/running rows
    const pendingRows = await reputationModel.findPendingRuns();
    // SELECT * FROM accommodation_external_reputation
    // WHERE run_status IN ('pending', 'running') AND apify_run_id IS NOT NULL

    if (pendingRows.length === 0) {
        return { success: true, message: 'No pending runs', processed: 0, errors: 0, durationMs: ... };
    }

    let processed = 0, errors = 0;

    for (const row of pendingRows) {
        try {
            const status = await getApifyRunStatus({ token: creds.apifyToken, runId: row.apifyRunId });

            if (!status) {
                // Apify API unreachable — skip this tick, try again next
                logger.warn('Could not get run status', { runId: row.apifyRunId });
                continue;
            }

            if (status.status === 'SUCCEEDED') {
                const items = await getApifyDatasetItems({ token: creds.apifyToken, datasetId: status.defaultDatasetId });
                const adapter = getReputationAdapter(row.platform, creds);
                const result = adapter.mapDatasetItems?.(items, row.listing) ?? emptyReputationResult();
                await reputationModel.upsertReputation(row.accommodationId, row.platform, {
                    ...result,
                    fetchStatus: 'ok',
                    runStatus: 'idle',
                    apifyRunId: null,
                    apifyDatasetId: null,
                    aggregateFetchedAt: new Date()
                });
                processed++;

            } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status.status)) {
                await reputationModel.upsertReputation(row.accommodationId, row.platform, {
                    fetchStatus: 'error',
                    fetchMessage: `Apify run ${status.status.toLowerCase()}`,
                    runStatus: 'idle',
                    apifyRunId: null,
                    apifyDatasetId: null
                });
                errors++;

            } else {
                // READY or RUNNING — check timeout
                const age = Date.now() - (row.runStartedAt?.getTime() ?? 0);
                if (age > timeoutMs) {
                    await reputationModel.upsertReputation(row.accommodationId, row.platform, {
                        fetchStatus: 'error',
                        fetchMessage: 'Apify run timed out',
                        runStatus: 'idle',
                        apifyRunId: null,
                        apifyDatasetId: null
                    });
                    errors++;
                } else {
                    // Still running — update run_status to 'running' if not already
                    if (row.runStatus !== 'running') {
                        await reputationModel.updateRunStatus(row.id, 'running');
                    }
                }
            }
        } catch (err) {
            logger.error('Error processing pending run', { runId: row.apifyRunId, error: err });
            errors++;
        }
    }

    return {
        success: errors === 0,
        message: `Processed ${processed} completed run(s) — ${errors} error(s)`,
        processed,
        errors,
        durationMs: Date.now() - startedAt.getTime()
    };
}
```

**Model methods to add** on `AccommodationExternalReputationModel` (in `packages/db/src/...`):

- `findPendingRuns(): Promise<PendingRunRow[]>` — SELECT rows WHERE `run_status IN ('pending','running')` AND `apify_run_id IS NOT NULL`. Join or sub-select to include the listing data needed by `mapDatasetItems`.
- `updateRunStatus(id: string, status: 'running' | 'idle'): Promise<void>` — lightweight UPDATE for the status-only transition.
- Existing `upsertReputation()` must accept the new columns in its payload type (additive — existing callers that don't pass the new fields get `undefined`, which leaves those columns unchanged or uses their DB default).

---

### Owner UI Status Component (Web App)

**Context**: The owner web panel already has a reputation configuration component introduced in SPEC-237. Locate its file path by searching for the pattern in `apps/web/src/`:

```bash
# From the worktree root:
grep -rn "external-reputation\|externalReputation\|ExternalReputation" apps/web/src/ --include="*.astro" --include="*.tsx" -l
```

**Changes needed**:

- Add a `useReputationStatus` custom hook (native `fetch` + `setInterval`, stops when `allSettled = true`).
- Pass `runStatus` to each platform's display chip component.
- Render spinner / "actualizando..." when `runStatus IN ('pending', 'running')`.
- Render rating badge when `runStatus = 'idle' && fetchStatus = 'ok'`.
- Render error badge when `runStatus = 'idle' && fetchStatus IN ('error', 'blocked', 'not_found')`.
- Co-locate CSS module `ReputationStatus.module.css` with the component.
- All strings via `@repo/i18n` (add keys listed in UX section above).

**Hook signature**:

```ts
// apps/web/src/hooks/use-reputation-status.ts (new file)
export interface ReputationPlatformStatus {
    runStatus: 'idle' | 'pending' | 'running';
    fetchStatus: 'ok' | 'error' | 'blocked' | 'not_found';
    rating: number | null;
    reviewsCount: number | null;
    aggregateFetchedAt: string | null;
}

export interface UseReputationStatusResult {
    platforms: Partial<Record<string, ReputationPlatformStatus>>;
    allSettled: boolean;
    loading: boolean;
    error: string | null;
}

export function useReputationStatus(accommodationId: string, enabled: boolean): UseReputationStatusResult
```

The hook polls every 10 s when `enabled = true` and `allSettled = false`. Uses `native fetch` only (no TanStack Query — that's admin-only).

---

### Dependencies

**External packages**: None new. All work reuses `fetch` (Node 18+), Drizzle ORM, existing cron infrastructure, and the existing `@repo/schemas`/`@repo/db`/`@repo/service-core` packages.

**Internal packages affected**:

| Package | How affected |
|---------|-------------|
| `@repo/db` | New pg enum + 4 new columns on `accommodation_external_reputation`; new model methods |
| `@repo/schemas` | New `ExternalReputationRunStatusSchema` + additive fields on `AccommodationExternalReputationSchema` |
| `@repo/service-core` | New async client methods; adapter interface additions; `refresh()` service method refactor |
| `apps/api` | New route `reputation-status.ts`; modified `refresh.ts`; new polling cron job; registry + manifest |
| `apps/web` | Modified owner panel component + new polling hook + i18n keys |

---

### Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Apify run stuck in READY/RUNNING indefinitely | M | M | Timeout sweep: if `run_started_at` > `HOSPEDA_EXTREP_APIFY_RUN_TIMEOUT_MS` (default 10 min), mark error. Owner can retry. |
| Polling cron tick overlaps with a prior tick (Apify API slow) | L | L | Status check is idempotent — reading the same run twice produces the same result. Upsert on the row is safe. |
| Orphaned runs on API deploy/restart | M | L | `run_started_at` timeout sweep catches any rows stuck pending from a deploy. Runs are retried next refresh. |
| Apify changes API response shape | L | M | Defensive destructuring in `startApifyRun` / `getApifyRunStatus` — check `data?.id`, `data?.defaultDatasetId`, return null if missing. Add a smoke test that validates response parsing. |
| `run_status='pending'` rows visible to public block builder | L → mitigated to zero | H | `run_status` column is NEVER read by `buildExternalReputationBlock` or any public schema. The public block reads only `fetchStatus`, `rating`, `reviewsCount`, etc. Enforced by keeping run columns out of public schema types. |
| DB migration adds enum + columns to production table | L | M | Standard structural migration via `db:generate` + `db:migrate`. The enum creation and column `ADD` are safe online operations in PostgreSQL (no table lock beyond milliseconds). Adding columns with a default is instant in modern Postgres. |
| Missing `apifyToken` env at enqueue time | M | M | `startRun()` returns `null` on credential absence; service upserts `fetch_status='error'`, `fetch_message='Apify token not configured'`, `run_status='idle'`. No crash. |
| Booking JSON-LD keeps succeeding (no regression) | L | L | `fetch()` JSON-LD path is UNTOUCHED. Only the Apify fallback in `fetch()` is extracted into `startRun()`. If JSON-LD resolves, the inline path executes as today. |

---

### Performance Considerations

**Expected load**:

- Owner refresh: sporadic, ~1-5 per minute at peak (owner-level trigger).
- Polling cron: every 2 min, queries 1 table with a WHERE on an indexed column. In steady state (no active refreshes), the SELECT returns 0 rows and the cron exits in < 50 ms.
- During an active owner refresh: ~2-10 rows in pending state. The poller makes 1 HTTP call per row to Apify (status check, ~200 ms each), all serial. Total tick: ~2 s for 10 rows. Well within the 60 s timeout.

**Bottlenecks**: Apify API rate limits apply to dataset item fetches. Apify's free/paid tiers allow many concurrent runs; the poller runs them serially (for simplicity), so there is no risk of exceeding per-second API limits.

**Optimization**:

- Index on `(run_status)` for the poller's WHERE clause (added in schema).
- The poller does NOT run Apify actors — it only checks status and fetches dataset items after a run has already completed. Dataset items for reputation are small (1-10 review items max).
- Poll interval is env-configurable (`HOSPEDA_EXTREP_POLL_SCHEDULE`) so it can be tuned without a deploy.

**Monitoring**:

- `CronJobResult.processed` / `errors` emitted to `cron_runs` table (existing observability via SPEC-161 cron run history).
- Stuck rows (run_status='pending' for > timeout) are cleared by the timeout sweep; alerts can be set up on `fetch_status='error'` counts.

---

## Implementation Approach

### Phase 1: Database schema + migration

1. Add `ExternalReputationRunStatusPgEnum` to `packages/db/src/schemas/enums.dbschema.ts`.
2. Add 4 new columns + run_status index to `accommodation_external_reputation.dbschema.ts`.
3. Run `pnpm --filter @repo/db db:generate`; review generated migration; commit migration file.
4. Add `ExternalReputationRunStatusSchema` and optional fields to `packages/schemas/src/entities/accommodation-external/accommodation-external-reputation.schema.ts`.
5. Run `pnpm --filter @repo/schemas typecheck`; run `pnpm --filter @repo/db typecheck`.

### Phase 2: Apify async client

6. Implement `startApifyRun`, `getApifyRunStatus`, `getApifyDatasetItems` in `packages/service-core/src/services/accommodation-import/adapters/apify-client.ts`.
7. Write unit tests for all three functions (mock `fetch`; test: 201 happy path, non-2xx degrades to null/[], network error degrades, bad response shape degrades).

### Phase 3: Adapter interface + two-phase adapter refactor

8. Add optional `startRun()` + `mapDatasetItems()` to `ReputationAdapter` interface in `adapter.types.ts`.
9. Refactor `BookingReputationAdapter`: retain JSON-LD fast path in `fetch()`; implement `startRun()` (calls `startApifyRun`) and `mapDatasetItems()` (pure mapping, no HTTP).
10. Refactor `AirbnbReputationAdapter`: `fetch()` returns `emptyReputationResult()`; implement `startRun()` + `mapDatasetItems()`.
11. Write unit tests for both adapters: JSON-LD success (Booking inline), Booking JSON-LD miss → `startRun()` called, Airbnb always async, `mapDatasetItems()` pure mapping tests.

### Phase 4: Service refactor

12. Refactor `AccommodationExternalReputationService.refresh()` to the inline/async split logic described in the architecture section.
13. Return the new `{ inlineSucceeded, enqueuedAsync, inlineFailed }` shape from `refresh()`.
14. Add `findPendingRuns()` and `updateRunStatus()` methods to the reputation model.
15. Write service unit tests: all-inline path (Google only), mixed inline+async, all-async (Airbnb only), startRun failure degrades to error, rate limit still enforced.

### Phase 5: API endpoint changes

16. Modify `apps/api/src/routes/accommodation-external-reputation/protected/refresh.ts` to return 202 when `enqueuedAsync.length > 0`, 200 otherwise.
17. Create `apps/api/src/routes/accommodation-external-reputation/protected/reputation-status.ts` (GET endpoint).
18. Register the new route in the protected router index.
19. Write route integration tests: 202 on async enqueue, 200 on all-inline, 429 rate limit, 403 ownership, status endpoint 200.

### Phase 6: Polling cron

20. Create `apps/api/src/cron/jobs/poll-apify-reputation-runs.job.ts` with the handler described in the Technical section.
21. Register in `apps/api/src/cron/registry.ts` and add to `apps/api/src/cron/schedules.manifest.ts`.
22. Write unit tests for the polling cron: SUCCEEDED path (mock `getApifyRunStatus` + `getApifyDatasetItems`), FAILED path, TIMED-OUT path, timeout sweep, 0 pending rows noop.
23. Verify the `test/cron/schedules-manifest.test.ts` sync test passes (it checks registry vs manifest parity).

### Phase 7: Owner UI + i18n

24. Add i18n keys to `packages/i18n/src/locales/es.json` (and en.json / pt.json) for reputation status strings.
25. Create `apps/web/src/hooks/use-reputation-status.ts` polling hook.
26. Modify the existing SPEC-237 owner reputation panel component to use the new hook and render per-platform status chips.
27. Write hook unit tests: polling starts when `enabled=true`, stops when `allSettled=true`, handles fetch errors gracefully.

### Phase 8: Tests + CI

28. Run full test suite: `pnpm test` from repo root. Fix any regressions.
29. Run `pnpm typecheck` across all affected packages.
30. Run `pnpm lint` (Biome) — fix any issues before committing.
31. Confirm `test/cron/schedules-manifest.test.ts` passes.
32. Confirm schema drift guard (`scripts/check-schema-drift.sh`) passes (migration committed in Phase 1).

### Phase 9: Documentation

33. Update `apps/api/docs/route-architecture.md` if needed to note the new status endpoint.
34. Add env var `HOSPEDA_EXTREP_POLL_SCHEDULE` and `HOSPEDA_EXTREP_APIFY_RUN_TIMEOUT_MS` to registry (`packages/config/src/env-registry.*.ts`) and to `apps/api/.env.example`.
35. Run `pnpm env:check:registry` to verify registry sync.

---

## Internal Review Notes

### Strengthened during spec writing

1. **Booking inline fast path preserved**: the spec is explicit that Booking's JSON-LD attempt stays in `fetch()` inline. Only the Apify fallback is extracted into `startRun()`. This avoids regressing Booking's common case (most Booking listings resolve via JSON-LD in ~1 s).

2. **Public block isolation**: the spec explicitly states that `run_status`, `apify_run_id`, `apify_dataset_id`, and `run_started_at` MUST NOT appear in `ExternalReputationBlockSchema` or any public schema type. This is a hard invariant — if broken, internal run state leaks to unauthenticated callers.

3. **`runApifyActor` unchanged**: SPEC-222 import adapters (`airbnb-listing.adapter.ts`, `booking-listing.adapter.ts`) call `runApifyActor()`. This function must NOT be modified. The new async functions are additions alongside it.

4. **Schema compat**: all new fields on `AccommodationExternalReputationSchema` use `.default()` or `.nullish()`. Historic parse fixtures remain valid. The new `ExternalReputationRunStatusSchema` is a separate export and does not affect existing consumers.

5. **Cron manifest sync test**: the existing `test/cron/schedules-manifest.test.ts` will FAIL if the new job is added to only one of `registry.ts` or `schedules.manifest.ts`. Both must be updated in Phase 6 together.

6. **upsertReputation payload type**: the model's `upsertReputation()` must accept the new run-state columns. Review the model's insert type — the new columns have DB defaults (`run_status DEFAULT 'idle'`, others nullable), so passing `undefined` for them in existing call sites is safe.

7. **`getReputationAdapterCredentials()` called from poller**: the poller cron needs credentials (Apify token) to call `getApifyRunStatus` and `getApifyDatasetItems`. It should call `getReputationAdapterCredentials()` from `apps/api/src/utils/reputation-credentials.ts` at the start of each tick, not cached, so runtime env changes take effect without restart.

### Open questions for owner input — RESOLVED (2026-06-22)

**OQ-1 — RESOLVED: option (a), atomic upsert.** `startRun()`'s success path persists `run_status='pending'` AND `apify_run_id` (+ `apify_dataset_id`, `run_started_at`) in a single atomic upsert, eliminating the partial-state window at the source. No null-runId cron sweep is added. The poller's `findPendingRuns()` therefore safely assumes `apify_run_id IS NOT NULL`.
Original question: Should the polling cron also handle rows where `apify_run_id IS NULL` and `run_status = 'pending'` (orphan rows from a `startRun()` failure that set pending but didn't persist a run ID)? Mitigation options: (a) set `run_status='pending'` and `apify_run_id` in a single atomic upsert (preferred); (b) add a cron sweep for null-runId pending rows older than N minutes.

**OQ-2 — to verify during implementation (technical, not an owner decision).** Confirm the Apify async endpoint (`POST /v2/acts/{actor}/runs`) accepts the same `actorInput` body as the sync endpoint (`run-sync-get-dataset-items`). Reuse the SPEC-237 input construction logic from the existing Booking/Airbnb adapters. Verified against the Apify REST API v2 reference during Phase 2.

**OQ-3 — RESOLVED: no throttle for the initial implementation.** At typical Hospeda scale (< 20 pending rows at a time) the poller fires its status checks serially with no batching or sleep. Add a throttle only if Apify starts returning 429s. KISS/YAGNI.
Original question: should the poller process rows in batches (max 20/tick) or sleep between status checks?

**OQ-4 — RESOLVED: option (a), block the button until `allSettled = true`.** While any platform has `run_status IN ('pending','running')`, the owner panel's refresh button is disabled, preventing a second run from being enqueued for an in-flight platform. Simplest and safest UX; avoids the orphaned-dataset-id problem of option (b).

---

## Key Learnings

1. The existing `runApifyActor()` uses the SYNC Apify endpoint (`run-sync-get-dataset-items`), which blocks the HTTP connection for the entire actor duration — this is the root cause of the ~100 s hang.
2. The `fetch_status` and `run_status` columns serve fundamentally different concerns: `fetch_status` is the data quality signal (consumed by public block builder), while `run_status` is the async coordination signal (internal only). They must stay separate.
3. Booking has a fast inline path (JSON-LD) that succeeds for most listings — only the fallback goes to Apify. Preserving this avoids regressing a fast common case.
4. The `schedules.manifest.ts` + `registry.ts` sync is enforced by an existing test (`test/cron/schedules-manifest.test.ts`) — any new cron job must be added to BOTH in the same change.
5. The web app (Astro) uses vanilla CSS + native fetch, NOT TanStack Query — the polling hook must use `setInterval` + native `fetch`, not any React data-fetching library.
6. `getReputationAdapterCredentials()` already centralizes credential access — the new polling cron should call it rather than re-reading env vars directly.
7. The schema compat policy requires all new `AccommodationExternalReputationSchema` fields to be additive (`.default()` or `.nullish()`) so historic JSONB stored in the DB or cached responses remain parseable.
