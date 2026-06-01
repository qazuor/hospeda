# SPEC-178 — Versioned DB Migration Strategy Overhaul — TODOs

26 atomic tasks across 6 phase groups. Status: 21/26 (in-progress) — foundations + tooling + testing + docs DONE; CI wiring (T-013/14) deferred to local-runners migration; only the real staging/prod reset execution (T-024/025/026) remains.

## Phase: foundations (migration artifacts)

- [x] **T-001** Adopt drizzle-kit generate+migrate config; commit the journal — un-gitignored `migrations/meta/`, config confirmed
- [x] **T-002** Generate the 0000 baseline (full schema incl. 29 billing tables) — `0000_baseline.sql` + journal; validated clean apply (82 tables, 32 billing, 45 enums, exit 0) on ephemeral PG
- [x] **T-003** Build `migrations/extras/` — consolidate 21 cat-A extras (`NNN-name.kind.sql`) — 9 consolidated files, validated apply + idempotency on ephemeral PG
- [x] **T-004** Delete obsolete migrations — git rm'd entire `manual/` + `verify-gh-refresh.mjs`; apply-extras now reads `extras/`
- [x] **T-005** Fix `db:migrate` alias to real `drizzle-kit migrate` — validated (applied baseline from journal)
- [x] **T-006** Create extensions preflight + reset SQL — `reset/000-reset-schema.sql` + `001-extensions.sql`, validated end-to-end

## Phase: tooling (hops + scripts)

- [x] **T-007** Rewrite `migrate-production.sh` (real migrate + extras + abort-on-fail) — dead drizzle-kit-check removed
- [x] **T-008** Add `hops db-migrate --target` (migrate + extras, no push) — + shared `migrate-core.ts`; review caught backup-after-reset bug
- [x] **T-009** Update apply-postgres-extras to read `migrations/extras/` (NNN sort) — done in the foundations close-out (required by `manual/` removal)
- [x] **T-010** Split `hops db-seed` (keep data flags, add `--migrate`, swap push->migrate) — runDbPush removed
- [x] **T-011** Fold reset (DROP SCHEMA + DROP USER + extensions) into `hops db-migrate --reset` — backup→reset→migrate order

## Phase: ci (drift impossible)

- [x] **T-012** `scripts/check-schema-drift.sh` — script built + validated (both states). Guards-job wiring deferred → ci-wiring-handoff.md §1
- [~] **T-013** Switch CI from push to migrate+extras — BLOCKED: workflow + global-setup edits owned by CI-runner migration → handoff §3
- [~] **T-014** Wire `env:check:registry` into CI — BLOCKED: ci.yml edit owned by CI-runner migration → handoff §2

## Phase: testing

- [x] **T-015** Round-trip test — `t015-round-trip.sh`, re-run verified 10/10 (82 tables, matview, drift-clean)
- [x] **T-016** Idempotency test — `t016-idempotency.sh`, 7/7 (fingerprint identical, both passes exit 0)
- [x] **T-017** Conversion regression — `t017-conversion-regression.sh`, 13/13 (naive cast fails, USING preserves data)
- [x] **T-018** Drift-guard self-test — both states exercised (clean→pass, schema change→fail) during T-012 validation

## Phase: docs + agent-rules

- [x] **T-019** Rewrite `packages/db/CLAUDE.md` — two carriles + golden rule + dev-vs-VPS + 5-step protocol
- [x] **T-020** Fix root `CLAUDE.md` — db:migrate line + push-not-enough gotcha corrected
- [x] **T-021** New ADR — `ADR-029-versioned-migration-strategy.md`, supersedes ADR-017 push-only note
- [x] **T-022** Rewrite `docs/guides/migrations.md` — canonical how-to, common-mistakes table
- [x] **T-023** Agent protocol surfaced to `.claude/agents/db-drizzle-engineer.md`

## Phase: validation (execution + close-out)

- [ ] **T-024** Execute staging reset + rebuild + verify seed completes — *blockedBy T-010, T-011*
- [ ] **T-025** Execute prod reset + rebuild (after staging soak) — *blockedBy T-024*
- [ ] **T-026** Close-out: green verify + index sync (specs + tasks) — *blockedBy T-024, T-025*

## Critical path

T-001 -> T-002 -> T-005 -> T-008 -> {T-010, T-011} -> T-024 -> T-025 -> T-026
