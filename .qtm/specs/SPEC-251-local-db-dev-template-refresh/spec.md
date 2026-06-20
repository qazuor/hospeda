---
specId: SPEC-251
title: Local DB dev/template refresh + worktree DB auto-heal correctness
slug: local-db-dev-template-refresh
type: chore
complexity: small
status: draft
created: 2026-06-20
base: staging
dependsOn: []
tags:
  - db
  - dev-infra
  - worktree
  - seed
  - tooling
---

# SPEC-251 — Local DB dev/template refresh

## 1. Origin

During the SPEC-249 close-out (2026-06-20), bringing up the worktree dev environment
(`pnpm cli wt:up`) produced a **stale database**:

- The worktree DB is cloned from `hospeda_template`, which predated SPEC-239 — it had
  **no `gastronomies`/`experiences` tables and no `COMMERCE_OWNER` enum value**.
- The template's source, `hospeda_dev`, was **also partially stale**: it had
  `gastronomies` but was missing the `experiences` table (SPEC-240) — so even rebuilding
  the template from `hospeda_dev` would not yield a current schema.

Net effect: every new worktree starts with a broken DB and must be repaired by hand
(`db:push` + `apply-extras` + seed), which is error-prone and easy to miss.

## 2. Goals

- Make the local DB story reliable so a fresh worktree comes up with a **current schema
  - commerce seed data** with no manual repair.
- Refresh `hospeda_dev` to the current schema and rebuild `hospeda_template` from it.
- Make `wt:up` / `wt-db` detect a **schema-stale** clone (not just a missing DB) and
  auto-heal it (push/migrate to current) instead of silently cloning an old template.

## 3. Scope

- Document + script the canonical refresh: `db:fresh-dev` on `hospeda_dev` →
  `wt-db build-template` → worktree clones are current.
- Add a schema-version / drift check to the worktree DB ensure-ready step so a stale
  clone is detected and healed (apply pending migrations + extras) rather than used as-is.
- Ensure the template includes (or the worktree seed adds) the commerce example data
  (gastronomy + experience listings, commerce owners).

## 4. Out of scope

- The seed-content fixes themselves (logueable experience owner, `profile_completed`) —
  those live in SPEC-252 (E2E fixtures). This spec is about the DB lifecycle/tooling.
- Production / staging DB (this is local dev only).

## 5. Acceptance criteria (outline)

- AC-1: A brand-new worktree via `wt:up` comes up with a schema matching the current TS
  schema (commerce tables, `COMMERCE_OWNER`, latest migrations incl. extras) — no manual
  `db:push` needed.
- AC-2: `wt-db`/`wt:up` detects a stale template clone and heals it (logged), instead of
  serving an outdated DB.
- AC-3: Documented one-command refresh for `hospeda_dev` + template.

## 6. Tasks (outline — atomize at start)

1. Refresh `hospeda_dev` to current schema + rebuild `hospeda_template`.
2. Add schema-drift detection + auto-heal to the worktree DB ensure-ready path.
3. Docs: worktree DB lifecycle + refresh runbook.

## 7. Dependencies

None (infra/tooling). Coordinates with SPEC-252 (which consumes a correct local DB).
