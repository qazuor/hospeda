# SPEC-250 — Asynchronous External Reputation Refresh (Apify Async API + Polling)

> Task breakdown generated 2026-06-20. Total: 39 tasks across 5 phases (setup:4, core:16, integration:13, testing:4, docs:2).
> Critical path (longest chain): T-001 → T-002 → T-003 + T-002 → T-018 → T-019 → T-021 → T-024 (depth 6 integration hops) plus the parallel model chain feeding T-025 → T-026 → T-028 → T-035 → T-036.

---

## Phase: setup — 4 tasks

- [ ] **T-001** `[complexity:1]` Add `ExternalReputationRunStatusPgEnum` to `enums.dbschema.ts`
  - File: `packages/db/src/schemas/enums.dbschema.ts`
  - Blocks: T-002, T-005

- [ ] **T-002** `[complexity:2]` Add 4 new columns + run_status index to `accommodation_external_reputation` Drizzle schema
  - File: `packages/db/src/schemas/accommodation-external/accommodation_external_reputation.dbschema.ts`
  - Blocked by: T-001
  - Blocks: T-003, T-016, T-017, T-018

- [ ] **T-003** `[complexity:2]` Generate Drizzle migration for new enum + columns and commit migration file
  - Run `pnpm --filter @repo/db db:generate`, review SQL, run `db:migrate` locally, commit
  - Blocked by: T-002
  - Blocks: T-036

- [ ] **T-004** `[complexity:1]` Register `HOSPEDA_EXTREP_POLL_SCHEDULE` and `HOSPEDA_EXTREP_APIFY_RUN_TIMEOUT_MS` in env registry + `apps/api/src/utils/env.ts` + `.env.example`
  - Files: `packages/config/src/env-registry.*.ts`, `apps/api/src/utils/env.ts`, `apps/api/.env.example`
  - Blocks: T-025, T-037

---

## Phase: core — 16 tasks

### Schema + Zod (2 tasks)

- [ ] **T-005** `[complexity:2]` Add `ExternalReputationRunStatusSchema` + additive run-state fields to `AccommodationExternalReputationSchema`
  - File: `packages/schemas/src/entities/accommodation-external/accommodation-external-reputation.schema.ts`
  - Blocked by: T-001
  - Blocks: T-006, T-011, T-019, T-022

- [ ] **T-006** `[complexity:1]` Verify `ExternalReputationBlockSchema` does NOT expose run-state columns + write isolation assertion test
  - File: `packages/schemas/src/entities/accommodation-external/accommodation-external.public.schema.ts`
  - Blocked by: T-005
  - Blocks: T-019

### Apify async client (4 tasks)

- [ ] **T-007** `[complexity:2]` Implement `startApifyRun()` in `apify-client.ts`
  - File: `packages/service-core/src/services/accommodation-import/adapters/apify-client.ts`
  - Blocks: T-010, T-012, T-013

- [ ] **T-008** `[complexity:2]` Implement `getApifyRunStatus()` in `apify-client.ts`
  - Same file as T-007
  - Blocks: T-010, T-025

- [ ] **T-009** `[complexity:1]` Implement `getApifyDatasetItems()` in `apify-client.ts`
  - Same file as T-007
  - Blocks: T-010, T-025

- [ ] **T-010** `[complexity:2]` Write unit tests for all three async Apify client functions
  - File: `packages/service-core/.../adapters/test/apify-client.test.ts`
  - Blocked by: T-007, T-008, T-009

### Adapter interface + refactor (5 tasks)

- [ ] **T-011** `[complexity:1]` Add optional `startRun()` + `mapDatasetItems()` to `ReputationAdapter` interface
  - File: `packages/service-core/src/services/accommodation-external-reputation/adapters/adapter.types.ts`
  - Blocked by: T-005
  - Blocks: T-012, T-013

- [ ] **T-012** `[complexity:3]` Refactor `BookingReputationAdapter`: retain JSON-LD fetch, add `startRun` + `mapDatasetItems`
  - File: `packages/service-core/.../adapters/booking-reputation.adapter.ts`
  - Blocked by: T-007, T-011
  - Blocks: T-014, T-019

- [ ] **T-013** `[complexity:3]` Refactor `AirbnbReputationAdapter`: `fetch()` returns empty, add `startRun` + `mapDatasetItems`
  - File: `packages/service-core/.../adapters/airbnb-reputation.adapter.ts`
  - Blocked by: T-007, T-011
  - Blocks: T-015, T-019

- [ ] **T-014** `[complexity:2]` Write unit tests for `BookingReputationAdapter` (7 cases incl. JSON-LD hit/miss, startRun, mapDatasetItems)
  - Blocked by: T-012

- [ ] **T-015** `[complexity:2]` Write unit tests for `AirbnbReputationAdapter` (7 cases incl. empty fetch, startRun, mapDatasetItems)
  - Blocked by: T-013

### Model methods (3 tasks)

- [ ] **T-016** `[complexity:2]` Add `findPendingRuns()` to `AccommodationExternalReputationModel`
  - File: `packages/db/src/models/accommodation-external/accommodation-external-reputation.model.ts`
  - Blocked by: T-002
  - Blocks: T-025

- [ ] **T-017** `[complexity:1]` Add `updateRunStatus()` to `AccommodationExternalReputationModel`
  - Same file as T-016
  - Blocked by: T-002
  - Blocks: T-025

- [ ] **T-018** `[complexity:1]` Extend `upsertReputation()` payload type to accept new run-state columns (additive, all optional)
  - Same file as T-016
  - Blocked by: T-002
  - Blocks: T-019, T-025

### Service refactor (2 tasks)

- [ ] **T-019** `[complexity:3]` Refactor `AccommodationExternalReputationService.refresh()` to inline/async split + new return type
  - File: `packages/service-core/src/services/accommodation-external-reputation/accommodation-external-reputation.service.ts`
  - Blocked by: T-005, T-006, T-012, T-013, T-018
  - Blocks: T-020, T-021

- [ ] **T-020** `[complexity:3]` Write unit tests for `refresh()` (7 cases: all-inline, mixed, all-async, startRun failure, rate limit, Booking hit/miss)
  - Blocked by: T-019

---

## Phase: integration — 13 tasks

### API endpoints (4 tasks)

- [ ] **T-021** `[complexity:2]` Modify protected refresh route to return HTTP 202 when `enqueuedAsync.length > 0`
  - File: `apps/api/src/routes/accommodation-external-reputation/protected/refresh.ts`
  - Blocked by: T-019
  - Blocks: T-024

- [ ] **T-022** `[complexity:2]` Create `GET /protected/accommodations/:id/external-reputation/status` route
  - File: `apps/api/src/routes/accommodation-external-reputation/protected/reputation-status.ts` (new)
  - Blocked by: T-005
  - Blocks: T-023, T-024

- [ ] **T-023** `[complexity:1]` Register reputation-status route in the protected router index
  - File: `apps/api/src/routes/accommodation-external-reputation/protected/index.ts`
  - Blocked by: T-022
  - Blocks: T-024

- [ ] **T-024** `[complexity:3]` Write integration tests for refresh (202/200/429/403/404) and status (200/403/404) routes
  - Blocked by: T-021, T-023

### Polling cron (4 tasks)

- [ ] **T-025** `[complexity:3]` Create `poll-apify-reputation-runs.job.ts` cron handler (5 paths: SUCCEEDED/FAILED/RUNNING-within-timeout/timeout-sweep/0-rows)
  - File: `apps/api/src/cron/jobs/poll-apify-reputation-runs.job.ts` (new)
  - Blocked by: T-004, T-008, T-009, T-016, T-017, T-018
  - Blocks: T-026, T-027

- [ ] **T-026** `[complexity:1]` Register `poll-apify-reputation-runs` in `registry.ts` AND `schedules.manifest.ts` (same commit — or schedules-manifest test fails)
  - Files: `apps/api/src/cron/registry.ts`, `apps/api/src/cron/schedules.manifest.ts`
  - Blocked by: T-025
  - Blocks: T-028

- [ ] **T-027** `[complexity:3]` Write unit tests for polling cron (9 cases: SUCCEEDED/FAILED/TIMED-OUT/ABORTED/RUNNING-within-timeout/timeout-sweep/0-rows/unreachable-API/per-row-error-isolation)
  - Blocked by: T-025

- [ ] **T-028** `[complexity:1]` Verify `schedules-manifest.test.ts` sync test passes
  - Blocked by: T-026
  - Blocks: T-035

### Owner UI + i18n (5 tasks)

- [ ] **T-029** `[complexity:1]` Add reputation status i18n keys to es/en/pt locale files (`externalReputation.status.*`, `externalReputation.refresh.*`)
  - Files: `packages/i18n/src/locales/es.json`, `en.json`, `pt.json`
  - Blocks: T-031

- [ ] **T-030** `[complexity:2]` Create `useReputationStatus` polling hook in `apps/web/src/hooks/use-reputation-status.ts`
  - Polls every 10 s with native `fetch` + `setInterval`; stops when `allSettled=true`; handles 4xx/5xx vs network errors differently
  - Blocks: T-031, T-033

- [ ] **T-031** `[complexity:3]` Modify SPEC-237 owner reputation panel to use `useReputationStatus` and render per-platform status chips
  - Locate component via: `grep -rn "external-reputation\|externalReputation" apps/web/src/ -l`
  - Blocked by: T-029, T-030
  - Blocks: T-032

- [ ] **T-032** `[complexity:1]` Create `ReputationStatus.module.css` co-located with the reputation panel (spinner + `prefers-reduced-motion` + status states)
  - Blocked by: T-031

- [ ] **T-033** `[complexity:2]` Write unit tests for `useReputationStatus` hook (8 cases: enabled/disabled, polling cadence, allSettled stop, 4xx/5xx errors, network error retry, unmount cleanup)
  - Blocked by: T-030

---

## Phase: testing — 4 tasks

- [ ] **T-034** `[complexity:2]` Regression test: weekly cron enqueues via `startRun()`, NOT `runApifyActor()` (spy assert)
  - Blocked by: T-019, T-025
  - Blocks: T-035

- [ ] **T-035** `[complexity:2]` Run full `pnpm test` + `pnpm typecheck` + `pnpm lint` suite; fix any regressions
  - Blocked by: T-028, T-034
  - Blocks: T-036, T-037

- [ ] **T-036** `[complexity:1]` Verify schema drift guard passes (`pnpm --filter @repo/db db:generate` produces no new migration)
  - Blocked by: T-003, T-035

- [ ] **T-037** `[complexity:1]` Verify `pnpm env:check:registry` passes for the two new env vars
  - Blocked by: T-004, T-035

---

## Phase: docs — 2 tasks

- [ ] **T-038** `[complexity:1]` Update `apps/api/docs/route-architecture.md` to document the new status endpoint
  - Blocked by: T-022

- [ ] **T-039** `[complexity:1]` Document owner ops requirements: set `HOSPEDA_EXTREP_POLL_SCHEDULE` + `HOSPEDA_EXTREP_APIFY_RUN_TIMEOUT_MS` in Coolify; note existing `HOSPEDA_APIFY_TOKEN` must be set
  - Blocked by: T-004

---

## Parallel Tracks

```
Track A (DB + migration):    T-001 → T-002 → T-003
                                       └─ T-016, T-017, T-018

Track B (Schemas + Zod):     T-001 → T-005 → T-006

Track C (Apify client):      T-007, T-008, T-009 (all independent)
                              → T-010 (unit tests, after all three)

Track D (Config/env):        T-004 (independent)

Track E (Adapter interface): T-005, T-007 → T-011 → T-012, T-013

Track F (UI + i18n):         T-029, T-030 (both independent)

Merge points:
  Service (T-019): needs T-005, T-006, T-012, T-013, T-018
  Cron (T-025): needs T-004, T-008, T-009, T-016, T-017, T-018
  Route 202 (T-021): needs T-019
  Route status (T-022): needs T-005
  UI panel (T-031): needs T-029, T-030
  Full suite (T-035): needs T-028, T-034
```

## Critical Path (longest chain)

```
T-001 → T-002 → T-018 → T-019 → T-021 → T-024
                T-002 → T-016 ┐
                T-002 → T-017 ├→ T-025 → T-026 → T-028 → T-035 → T-036
                T-004         ┘
```

Depth: 8 hops (T-001 → T-002 → T-016/T-017/T-018 → T-025 → T-026 → T-028 → T-035 → T-036).
Start T-001, T-004, T-007, T-008, T-009, T-029, T-030 in parallel on day 1.

---

## Statistics

| Phase | Tasks | Sum complexity |
|-------|-------|----------------|
| setup | 4 | 6 |
| core | 16 | 28 |
| integration | 13 | 25 |
| testing | 4 | 6 |
| docs | 2 | 2 |
| cleanup | 0 | 0 |
| **Total** | **39** | **70** |

Average complexity: 1.79 / 3.0
