# SPEC-184 — API Log Observability — Progress

**Status**: in-progress (3/16)
**Created**: 2026-06-02
**Linear**: BETA-82

## Phase Summary

| Phase | Tasks | Done |
|---|---|---|
| phase-1-log-format (LOG_FORMAT pretty/json toggle + env-registry) | T-001, T-002, T-003, T-004 | 3/4 |
| phase-2-sink-hook (registerHook shared infra, coordinate SPEC-180) | T-005, T-006 | 0/2 |
| phase-3-db-persistence (app_log_entries + purge cron + API sink) | T-007, T-008, T-009, T-010, T-011 | 0/5 |
| phase-4-admin-query (admin endpoint + UI page) | T-012, T-013, T-014 | 0/3 |
| phase-5-docs-closeout (log-management.md + index closeout) | T-015, T-016 | 0/2 |

## Critical Path

T-001 → T-002 → T-004
T-001 → T-003
T-005 → T-006
T-005 + T-009 → T-010 → T-011
T-007 → T-008 → T-009 → T-012 → T-013 → T-014 → T-015 → T-016
T-003 + T-004 + T-006 + T-011 + T-014 → T-015 → T-016

## Parallelism Notes

- Phase 1 (T-001..T-004) and Phase 2 (T-005..T-006) can start in parallel.
- Phase 3 (T-007..T-011) can start independently of Phase 1/2 (schema work has no
  logger dependency).
- Phase 2 T-005 is partially blocked: check SPEC-180 branch first before writing
  hooks.ts — if SPEC-180 already built the hook registry, extend it instead.

## Cross-Spec Coordination

### SPEC-180 (Sentry, in-progress) — BLOCKING for Phase 2

SPEC-180 is adding `registerCaptureHook` to `@repo/logger`. Before starting T-005,
the implementer MUST check the SPEC-180 branch for any existing hook infrastructure.
If `registerCaptureHook` already exists, extend it (shared `registerHook` API) rather
than building a parallel registry. The goal is ONE generic hook registry in
`packages/logger/src/hooks.ts` that both specs use.

### SPEC-162 (audit-log query, draft) — BOUNDARY

SPEC-162 owns domain-specific audit logs (user/resource context). SPEC-184 owns
general application WARN/ERROR logs. Do NOT conflate: `app_log_entries` is NOT an
audit log table. No overlap in data model or UI.

### SPEC-161 (cron_runs, shipped) — PRECEDENT

Use `cron_runs` / `CronRunModel` / `CronRunService` / `cron-run-purge` as the
template for `app_log_entries` / `AppLogEntryModel` / `AppLogEntryService` /
`app-log-purge`. Same append-only design, same purge pattern, same manifest
registration.

## Owner Decisions — ALL RESOLVED

| # | Decision | Resolution |
|---|----------|-----------|
| Q1 | File persistence or stdout? | Stdout → Coolify. File writes OUT OF SCOPE. |
| Q2 | Which levels to persist to DB? | WARN + ERROR only (volume guard). |
| Q3 | Log retention in DB? | 30 days uniform. Owner may revise before T-010. |
| Q4 | Loki integration? | Phase-2 note in docs only. NOT in this spec. |
| Q5 | Hook coordination with SPEC-180? | Shared hook registry. Whichever lands first builds it. |
| Q6 | Admin page location? | Co-locate with cron observability (Plataforma → Operaciones). |
| Q7 | Permission for admin log endpoint? | SYSTEM_MAINTENANCE_MODE (same as cron admin). |

## Owner Actions Required

- Before T-005 starts: check SPEC-180 branch for existing hook infra (or coordinate
  with SPEC-180 implementer directly).
- Before T-010/T-011: confirm 30-day retention value is acceptable.
- PR review + merge to staging after implementation completes.

## Notes

- No tasks started yet. Spec authored 2026-06-02.
- BETA-82 closes when Phase 4 ships (admin can query WARN/ERROR logs from UI).
- The `SAVE: boolean` config field remains dead (not wired, not removed) — file writes
  are permanently out of scope for Docker/Coolify deployments.
- `drizzle-kit push` is used (NOT generate); apply schema directly. No
  apply-postgres-extras step needed for app_log_entries (no updated_at trigger,
  no JSONB CHECK constraints).
- Admin route uses `createAdminListRoute` (page+pageSize). NEVER use `limit`.
