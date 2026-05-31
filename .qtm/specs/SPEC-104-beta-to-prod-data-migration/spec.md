---
spec-id: SPEC-104
title: Beta-to-Prod Data Migration Script
type: feature
complexity: high
status: draft
created: 2026-05-13T00:27:41Z
effort_estimate_hours: 12-18
tags: [data-migration, beta-launch, ops, db, scripts]
extracted_from: SPEC-103 §3.E.1 (T-060..T-071)
source_docs: docs/migration/staging-prod-db-separation.md §10
---

# SPEC-104: Beta-to-Prod Data Migration Script

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Implement `scripts/migrate-staging-to-prod.ts` that migrates beta-tester users + all their related data (accounts, accommodations, posts, events, reviews, bookmarks) from the staging PostgreSQL instance to the production PostgreSQL instance, on the day the beta closes.

**Why now:** Beta testers populate staging with real accounts and listings during the beta period (started 2026-05-11 per engram `vps-migration/staging-environment-complete`). Prod stays at the bare seed (required users + 23 curated destinations). When beta closes, the beta tester rows must be moved to prod cleanly without losing data or duplicating system rows.

**Why a new spec (not part of SPEC-103):** SPEC-103 is repo hygiene + ops cleanup. This is a feature with delicate FK ordering, idempotency, dry-run discipline, and operational consequences (a wrong run on a real DB is catastrophic). It deserves its own design + testing artifacts.

**Audience:** Solo operator (qazuor) running this once when beta closes. Worst case: re-run after fixing a bug surfaced by a previous attempt.

---

### 2. Out of Scope

- Schema changes (drizzle migrations). Both DBs must already be on the same schema version before this script runs.
- Two-way sync (prod → staging). That is SPEC-103 T-072 (deferred).
- Anonymizing data before the move. Beta testers signed up knowing the data would move.
- Migrating Better Auth `sessions` table — sessions are short-lived and will expire naturally; beta testers re-auth on first prod visit.
- Migrating `billing_*` tables. Beta is free-tier only; no billing rows are created during beta.

---

### 3. Dependencies (must be done BEFORE running the script)

1. **SPEC-103 T-008** identify the 4 destination slugs that exist in staging (required+example seed = 27) but not in prod (required seed only = 23).
2. **SPEC-103 T-009** add those 4 destinations to prod via admin UI with real curated content.
3. **SPEC-103 T-010** verify slug parity: `SELECT slug FROM destinations` returns identical sets across the two DBs.

Without slug parity, accommodations whose `destination_id` points at staging-only seeds get silently dropped (FK constraint) — the script must hard-fail in that case rather than partially migrate.

---

### 4. User Stories

#### US-1: Dry-run before execute

As the operator, when I run `scripts/migrate-staging-to-prod.ts` without flags, I want to see a preview of the migration plan (counts per entity, rows that would be skipped, rows that would conflict) without writing anything to prod. This lets me sanity-check before committing.

**Acceptance:**
- Default mode is dry-run.
- Output lists, per entity: `<N> rows would be inserted`, `<M> rows would be skipped (conflict)`, `<K> rows would error (FK violation)`.
- Exit 0 when the plan looks safe, exit non-zero when there are errors that would block execution.

#### US-2: Execute mode with explicit confirmation

As the operator, when I want to actually write to prod, I pass `--execute` and the script asks `Type EXECUTE to confirm` (typed string match, not a yes/no toggle). This makes accidental destructive runs significantly harder.

**Acceptance:**
- `--execute` without typing `EXECUTE` exits without writing.
- `--execute` with confirmation runs the actual INSERTs.
- A summary at the end prints counts inserted per entity and total time.

#### US-3: Filter by created_at timestamp

As the operator, I want the script to only migrate rows that beta testers created (i.e., `created_at > SEED_TIMESTAMP`), so seeded system rows (super-admin, required destinations, etc.) are never duplicated into prod.

**Acceptance:**
- `SEED_TIMESTAMP` is configurable via `--seed-timestamp '2026-05-11 21:00:00+00'` flag or `SEED_TIMESTAMP` env var.
- Default value is captured from engram `vps-migration/staging-seed-timestamp` (`2026-05-11 21:00:00.490193+00`).
- Rows with `created_at <= SEED_TIMESTAMP` are skipped silently.

#### US-4: Snapshot pair test before real run

As the operator, before I run this against the real staging→prod DBs, I want to test it against snapshot clones (loaded from R2 backups) to verify the script behaves correctly.

**Acceptance:**
- Documented runbook walks through: take R2 snapshot of staging+prod → load into local docker postgres → run migration → verify counts.
- Time budget for the snapshot test: ≤ 30 minutes from R2 download to verification report.

#### US-5: FK-safe ordering + idempotency

As the operator, if a previous migration attempt failed mid-run, I want to re-run the script and have it pick up where it left off without duplicating already-migrated rows.

**Acceptance:**
- Each INSERT uses `ON CONFLICT (id) DO NOTHING` (idempotent).
- Order respects FK constraints (users before accounts; users before accommodations; accommodations before reviews + bookmarks).
- A re-run after a partial migration completes without error and reports `0 inserted` for already-done entities.

#### US-6: Verifiable count summary

As the operator, after the migration completes, I want to see a side-by-side count of rows per entity in staging vs prod to confirm the migration was complete.

**Acceptance:**
- Final report includes: `users: staging=N+seeded, prod=N+seeded (delta: N)` per migrated entity.
- Delta should equal the expected migration count for each entity.

---

### 5. Technical Design

#### 5.1 Architecture

Single TypeScript file at `scripts/migrate-staging-to-prod.ts` invoked via `pnpm exec tsx scripts/migrate-staging-to-prod.ts [flags]`. No new dependencies — uses `pg`/`drizzle` already in the workspace.

#### 5.2 Configuration

- `--staging-url <postgres://...>` (default: read from staging connection env)
- `--prod-url <postgres://...>` (default: read from prod connection env)
- `--seed-timestamp '<ISO>'` (default: 2026-05-11 21:00:00+00)
- `--execute` (default: dry-run)
- `--only <entity>` (optional: migrate just one entity for debugging)
- `--verify-only` (skip migration, just print count comparison)

Connection strings come from explicit flags / env vars, never from `.env.local` — accidentally pointing at prod from a dev shell is unacceptable.

#### 5.3 Migration order (per FK graph)

1. **users** — filter by `created_at > SEED_TIMESTAMP` AND `email_verified = true`. Skip super-admin / system rows by role/email allow-list.
2. **accounts** (Better Auth) — copy rows where `user_id IN migrated_users`. Preserve provider, provider_account_id, etc.
3. **accommodations** — copy rows owned by migrated users; for each, remap `destination_id` from staging-slug to prod-slug. If a slug doesn't exist in prod → ABORT with a clear error.
4. **posts** — copy rows authored by migrated users.
5. **events** — copy rows owned by migrated users.
6. **reviews** — copy rows authored by migrated users; FK to migrated accommodations.
7. **bookmarks** — copy rows owned by migrated users; FK to migrated accommodations.

#### 5.4 Conflict handling

- Email duplicate (user with same email exists in prod with `created_at < SEED_TIMESTAMP`): skip with a warning that names the user_id. Operator decides separately whether to merge.
- Slug conflict (accommodation slug already taken in prod): skip with warning; operator can rename in staging and re-run.
- ID conflict: `ON CONFLICT (id) DO NOTHING` — idempotent.

#### 5.5 Schemas + queries

Use Drizzle schemas from `@repo/db`. Two `getDb()`-style factories: one for staging, one for prod. Migration runs entirely outside transactions on the prod side (no single transaction can wrap GB of data; instead use per-entity batches with idempotent INSERT … ON CONFLICT).

#### 5.6 Testing

- **Snapshot test runbook** in `docs/migration/beta-to-prod-runbook.md` — covers the dry-run on real snapshots.
- **Unit tests** for pure helpers (slug-remap, conflict detection, count-comparison formatter).
- **No integration test in CI** — too risky to run against live DBs; the snapshot runbook is the gate.

---

### 6. Tasks (T-104-NN, ~12 atomic tasks)

> Same decomposition as SPEC-103 T-060..T-071, renumbered as part of SPEC-104.

| Task | Title | Notes |
|---|---|---|
| T-104-01 | Scaffold `scripts/migrate-staging-to-prod.ts` (CLI + DB conns + SEED_TIMESTAMP filter) | depends on nothing |
| T-104-02 | Migrate users (filter by created_at) | blocked by T-104-01 |
| T-104-03 | Migrate Better Auth `accounts` linked to migrated users | blocked by T-104-02 |
| T-104-04 | Migrate accommodations with slug remap | blocked by T-104-02 + SPEC-103 T-010 |
| T-104-05 | Migrate posts | blocked by T-104-02 |
| T-104-06 | Migrate events | blocked by T-104-02 |
| T-104-07 | Migrate reviews | blocked by T-104-02 + T-104-04 |
| T-104-08 | Migrate bookmarks | blocked by T-104-02 + T-104-04 |
| T-104-09 | Add dry-run (default) + `--execute` + confirmation | blocked by T-104-04..08 |
| T-104-10 | Add count verification + post-migration summary report | blocked by T-104-09 |
| T-104-11 | Test against snapshot pair (clone staging into clone prod) | blocked by T-104-10 |
| T-104-12 | Document runbook (`docs/migration/beta-to-prod-runbook.md`) | blocked by T-104-11 |

---

### 7. Risks

| Risk | Mitigation |
|---|---|
| Wrong DB URL points at live prod during dry-run | Connection URLs come only from explicit flags/env, never `.env.local`. Dry-run mode never writes. |
| Schema drift between staging and prod | Pre-flight check compares `pg_dump --schema-only` from both DBs; fail-fast if they differ. |
| Migration takes longer than expected during cutover | Run snapshot test (T-104-11) ahead of time to measure. |
| Beta tester's email collides with a seeded user | Conflict detection skips with a warning; operator manually resolves. |
| FK violation mid-run (slug not in prod) | Hard-fail before any INSERT (slug parity precheck in T-104-04). |
| Wrong SEED_TIMESTAMP migrates seeded rows | Default value captured from engram; flag is documented; dry-run output makes the boundary visible. |

---

### 8. Acceptance Criteria (spec-level)

This spec is "done" when:

- [ ] `scripts/migrate-staging-to-prod.ts` exists and accepts the documented flags.
- [ ] Dry-run mode produces an accurate plan without writing.
- [ ] Execute mode performs the migration idempotently.
- [ ] Snapshot test runbook is documented and was followed at least once against real R2 backups.
- [ ] An actual beta-close migration completes without manual SQL intervention (validates the whole pipeline).

---

## Part 2 — Implementation Notes

### Source material

The original design lives in `docs/migration/staging-prod-db-separation.md §10`. This spec extracts + formalizes the task decomposition from that doc + SPEC-103 §3.E.1.

### When to start

Don't start coding until the beta cutoff date is ~2 weeks away. Spec status stays `draft` until then. Bumping to `in-progress` is the trigger for serious development.

### When to archive

Archive immediately after the real cutover runs successfully — the script will only be useful for that one beta-close moment, plus any post-mortem analysis.
