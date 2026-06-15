---
spec-id: SPEC-232
title: Biome 2 Migration
type: chore
complexity: medium
status: draft
created: 2026-06-15
---

# SPEC-232 — Biome 2 Migration

## 1. Overview

### Goal

Migrate the monorepo linter/formatter from Biome 1.9 to Biome 2.x, including the
shared `@repo/biome-config`, so `pnpm lint` / `pnpm check` and the pre-commit hooks
pass under the new engine and config schema.

### Motivation

Dependabot opened a major bump **@biomejs/biome 1.9.4 → 2.5.0** ([PR #1642](https://github.com/qazuor/hospeda/pull/1642)),
which fails CI (Lint, E2E P0). Biome 2 changed the configuration schema and rule set
(renamed/added rules, new defaults, `biome migrate`-required config), so a blind bump
breaks the lint gate. The PR was closed to keep the queue clean; this spec tracks the
real migration.

### Success Criteria

- `@biomejs/biome@2` installed; `biome migrate` applied to the shared config + any
  per-package overrides.
- `pnpm lint` / `pnpm check` green with no rule suppressions added purely to pass.
- Pre-commit (husky + lint-staged + biome) works on staged files.
- New/changed Biome 2 rules triaged: adopt, configure, or document why disabled.

## 2. Scope

### In Scope

- Bump `@biomejs/biome` to 2.x in root + `@repo/biome-config`.
- Run `biome migrate` and reconcile the schema (`biome.json` / shared config).
- Fix or consciously configure the lint errors the new ruleset surfaces.

### Out of Scope

- TypeScript 6 (SPEC-231) and Vitest 4 (SPEC-233) majors.
- Re-formatting churn beyond what Biome 2 requires.

## 3. Tasks (suggested)

- T-001: Bump Biome to 2.x; run `biome migrate`; capture the full set of new lint/format
  diffs and rule changes (inventory).
- T-002: Update `@repo/biome-config` + per-package overrides to the 2.x schema.
- T-003: Resolve the surfaced lint errors (fix or justified config); verify pre-commit.
- T-004: Validate `lint`/`check` + E2E green; open PR to `staging`.

## 4. References

- Dependabot PR #1642 (closed — superseded by this spec).
- Related toolchain majors: SPEC-231 (TypeScript 6), SPEC-233 (Vitest 4).
