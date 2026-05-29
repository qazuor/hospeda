---
specId: SPEC-161
title: Cron Run History
status: draft
complexity: medium
owner: qazuor
created: 2026-05-26
parent: (none)
related:
  - SPEC-155 (admin-dashboards-v1 — consumer of failed/last-run)
tags:
  - cron
  - observability
  - admin
  - run-history
  - backend
  - phase-2
---

# SPEC-161 — Cron Run History

> **Status**: DRAFT — extracted from the 2026-05-26 dashboard redefinition session as "heavy backend". See `.claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md` (ADMIN card D).

## 1. Origin

The ADMIN dashboard wants "crons fallidos / último run". Today the cron-admin endpoint lists jobs + supports manual trigger, but the **result of each execution is NOT persisted** — there is no run history, no last-run timestamp, no failure record. So a "failed crons" widget has nothing to read.

## 2. Goal

Persist the outcome of each cron execution (status, started/finished timestamps, duration, error if any) and expose: last run per job + recently failed runs.

## 3. Scope

### IN
- New `cron_runs` table (or equivalent) capturing per-execution result.
- Hook into the cron runner to record each execution (success/failure, timing, error message).
- Read endpoint: last run per job + recent failures.

### OUT
- Retry orchestration / alerting (just record + expose).
- Log streaming of cron output.

## 4. Enables (SPEC-155 widgets)

- ADMIN · Card D · "Crons fallidos / último run".
- (The static cron list + enabled/total in the same card is already 🟢 and stays in SPEC-155.)

## 5. Dependencies

- SPEC-155 is the CONSUMER.

## 6. Design decisions (locked 2026-05-29)

Approved by owner before implementation:

1. **Single hook point.** All 21 cron jobs go through the same `CronJobHandler → CronJobResult` contract. Recording is wired at the two real execution sites only — `apps/api/src/cron/bootstrap.ts` (scheduled runs) and `apps/api/src/routes/cron-admin/index.ts` (manual trigger) — NOT per job.
2. **Fire-and-forget recording.** The run-history write is wrapped in try/catch. If the insert fails it is logged (logger + Sentry) but the job result is NOT altered. Observability must never tip over a cron.
3. **Read scope: full navigable history.** Admin-tier endpoints:
   - `GET /api/v1/admin/cron/runs` — paginated + filters (jobName, status, date range).
   - `GET /api/v1/admin/cron/runs/{id}` — single run detail.
   - `GET /api/v1/admin/cron/runs/summary` — last run per job + recent failures (feeds SPEC-155 card D).
4. **Retention: differentiated purge.** A new purge cron deletes `success` runs older than **60 days** and `failed`/`timeout` runs older than **180 days**. With ~2,330 rows/day (subscription-poll alone = 62%), the table stabilizes around ~140k rows.
5. **Append-only.** `cron_runs` is a log: NO soft-delete (no `deletedAt`); rows are hard-deleted only by the purge job.
6. **Captured fields.** `jobName`, `status` (success|failed|timeout), `startedAt`, `finishedAt`, `durationMs`, `processed`, `errors`, `executionMode` (scheduled|manual), `dryRun`, `errorMessage`, `details` (jsonb), `createdAt`. Indexes: `(jobName, startedAt desc)` and `(status, createdAt desc)`.

## 7. Next steps

Needs task atomization. DB change (new table) → coordinate with the push-only migration policy + `apply-postgres-extras.sh` if any trigger is involved.
