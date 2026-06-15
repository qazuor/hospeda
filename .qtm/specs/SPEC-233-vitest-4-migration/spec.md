---
spec-id: SPEC-233
title: Vitest 4 Migration
type: chore
complexity: high
status: draft
created: 2026-06-15
---

# SPEC-233 — Vitest 4 Migration

## 1. Overview

### Goal

Migrate the test toolchain from Vitest 3.2 to Vitest 4.x across all workspaces —
`vitest`, `@vitest/ui`, `@vitest/coverage-*`, and any `vite`/plugin coupling — so the
unit + integration suites run green on the new major.

### Motivation

Dependabot opened a major bump **@vitest/ui 3.2.6 → 4.1.8** ([PR #1639](https://github.com/qazuor/hospeda/pull/1639)),
which fails CI broadly (Build, Lint, Security, E2E). `@vitest/ui` cannot move alone: it
must match the `vitest` core major (still 3.2.x). Vitest 4 has breaking changes (config,
APIs, coverage provider, possibly a Vite version floor), so the whole family must migrate
together. The single-package PR was closed; this spec tracks the coordinated migration.

### Success Criteria

- `vitest@4` + `@vitest/ui@4` + matching coverage provider installed repo-wide (versions aligned).
- `pnpm test` (all shards), integration tests, and coverage thresholds green.
- Any required `vite` / config / plugin changes applied; no test silently skipped.
- SPEC-188 concurrency/perf settings reconciled with Vitest 4 defaults.

## 2. Scope

### In Scope

- Bump `vitest`, `@vitest/ui`, and `@vitest/coverage-*` to 4.x together across workspaces.
- Migrate vitest config(s) and any breaking API usages.
- Reconcile with the Vite version Vitest 4 requires.

### Out of Scope

- TypeScript 6 (SPEC-231) and Biome 2 (SPEC-232) majors.
- The Vite 7 / TanStack Start migration (SPEC-045) — coordinate if version floors overlap.

## 3. Tasks (suggested)

- T-001: Bump the full vitest family to 4.x; capture breaking changes + failing suites (inventory).
- T-002: Migrate vitest config + API usages; reconcile the Vite floor.
- T-003: Fix failing/flaky suites; restore coverage thresholds; re-check SPEC-188 perf knobs.
- T-004: Validate all test shards + integration + coverage green; open PR to `staging`.

## 4. References

- Dependabot PR #1639 (closed — superseded by this spec).
- Related: SPEC-188 (vitest perf), SPEC-045 (Vite 7), SPEC-231/232 (TS 6 / Biome 2).
