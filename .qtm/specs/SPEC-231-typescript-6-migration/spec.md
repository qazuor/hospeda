---
spec-id: SPEC-231
title: TypeScript 6 Migration
type: chore
complexity: high
status: draft
created: 2026-06-15
---

# SPEC-231 — TypeScript 6 Migration

## 1. Overview

### Goal

Migrate the monorepo from TypeScript 5.7 to TypeScript 6.0 across all workspaces,
resolving the new type errors and breaking changes so `pnpm typecheck`, `pnpm build`,
lint and the E2E suite pass cleanly.

### Motivation

Dependabot opened a major bump **typescript 5.7.2 → 6.0.3** ([PR #1643](https://github.com/qazuor/hospeda/pull/1643)),
which fails CI (Build, Lint, E2E P0). TypeScript 6 ships breaking changes (stricter
defaults, removed/renamed compiler options, lib.d.ts changes) that need a deliberate
migration rather than a blind bump. The PR was closed to keep the Dependabot queue
clean; this spec tracks the real work.

### Success Criteria

- `typescript@6` installed across all workspaces; `pnpm typecheck` green (incl. `astro check`).
- `pnpm build` and the full test + E2E suites green.
- No new `any` / `@ts-ignore` introduced to silence errors — fixes are real.
- `@types/node`, `tsconfig` base configs, and any TS-version-sensitive deps reconciled.

## 2. Scope

### In Scope

- Bump `typescript` to 6.x in root + every workspace that pins it.
- Fix type errors surfaced by the new compiler across `apps/*` and `packages/*`.
- Reconcile `@repo/typescript-config` base tsconfigs with any removed/changed options.

### Out of Scope

- Unrelated dependency majors (tracked separately: SPEC-232 Biome 2, SPEC-233 Vitest 4).
- Feature work; this is a toolchain migration only.

## 3. Tasks (suggested)

- T-001: Bump `typescript` to 6.x repo-wide; capture the FULL set of new type/build/lint
  errors per workspace (inventory before fixing).
- T-002: Update `@repo/typescript-config` for any removed/renamed compiler options.
- T-003: Fix the type errors per workspace (real fixes, no `any`/ignores).
- T-004: Validate `typecheck` + `build` + unit/integration + E2E green; open PR to `staging`.

## 4. References

- Dependabot PR #1643 (closed — superseded by this spec).
- Related toolchain majors: SPEC-232 (Biome 2), SPEC-233 (Vitest 4).
