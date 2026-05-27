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

## 6. Next steps

Needs task atomization. DB change (new table) → coordinate with the push-only migration policy + `apply-postgres-extras.sh` if any trigger is involved.
