# SPEC-178 — Versioned DB Migration Strategy Overhaul — TODOs

26 atomic tasks across 6 phase groups. Status: 0/26 (draft).

## Phase: foundations (migration artifacts)

- [ ] **T-001** Adopt drizzle-kit generate+migrate config; commit the journal
- [ ] **T-002** Generate the 0000 baseline (full schema incl. 29 billing tables) — *blockedBy T-001*
- [ ] **T-003** Build `migrations/extras/` — consolidate 21 cat-A extras (`NNN-name.kind.sql`) — *blockedBy T-001*
- [ ] **T-004** Delete 8 obsolete B/C/D + gh_refresh role + dead `verify-gh-refresh.mjs` — *blockedBy T-003*
- [ ] **T-005** Fix `db:migrate` alias to real `drizzle-kit migrate` — *blockedBy T-002*
- [ ] **T-006** Create extensions preflight + reset SQL artifacts

## Phase: tooling (hops + scripts)

- [ ] **T-007** Rewrite `migrate-production.sh` (real migrate + extras + abort-on-fail) — *blockedBy T-005*
- [ ] **T-008** Add `hops db-migrate --target` (migrate + extras, no push) — *blockedBy T-005*
- [ ] **T-009** Update apply-postgres-extras to read `migrations/extras/` (NNN sort) — *blockedBy T-003*
- [ ] **T-010** Split `hops db-seed` (keep data flags, add `--migrate`, swap push->migrate) — *blockedBy T-005, T-008*
- [ ] **T-011** Fold reset (DROP SCHEMA + DROP USER + extensions) into `hops db-migrate --reset` — *blockedBy T-006, T-008*

## Phase: ci (drift impossible)

- [ ] **T-012** `scripts/check-schema-drift.sh` wired into the `guards` job — *blockedBy T-002*
- [ ] **T-013** Switch CI from push to migrate+extras (integration + e2e) — *blockedBy T-002, T-009*
- [ ] **T-014** Wire `env:check:registry` into `ci.yml`

## Phase: testing

- [ ] **T-015** Round-trip test (empty -> migrate+extras -> introspect == TS schema) — *blockedBy T-002, T-003*
- [ ] **T-016** Idempotency test (migrate x2, apply-extras x2 = no-op) — *blockedBy T-002, T-009*
- [ ] **T-017** Conversion regression test (type change with USING preserves data) — *blockedBy T-002*
- [ ] **T-018** Drift-guard self-test — *blockedBy T-012*

## Phase: docs + agent-rules

- [ ] **T-019** Rewrite `packages/db/CLAUDE.md` (two carriles + golden rule + dev-vs-VPS) — *blockedBy T-005, T-009*
- [ ] **T-020** Fix root `CLAUDE.md` (db:migrate line + push-not-enough gotcha) — *blockedBy T-005*
- [ ] **T-021** New ADR (versioned migrations + two-carril + reset rationale)
- [ ] **T-022** Rewrite `docs/guides/migrations.md` (currently out of sync) — *blockedBy T-005*
- [ ] **T-023** "Rules for agents touching the schema" + db-drizzle-engineer surfacing — *blockedBy T-019*

## Phase: validation (execution + close-out)

- [ ] **T-024** Execute staging reset + rebuild + verify seed completes — *blockedBy T-010, T-011*
- [ ] **T-025** Execute prod reset + rebuild (after staging soak) — *blockedBy T-024*
- [ ] **T-026** Close-out: green verify + index sync (specs + tasks) — *blockedBy T-024, T-025*

## Critical path

T-001 -> T-002 -> T-005 -> T-008 -> {T-010, T-011} -> T-024 -> T-025 -> T-026
