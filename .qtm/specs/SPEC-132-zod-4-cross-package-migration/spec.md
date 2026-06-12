---
spec-id: SPEC-132
title: Migrate shared packages to Zod 4 top-level format validators
type: cleanup
complexity: medium
status: draft
created: 2026-05-15T22:00:00Z
effort_estimate_hours: 3-6
tags: [cleanup, zod, schemas, service-core, validation, follow-up, spec-111]
extracted_from: SPEC-111 Astro 6 impact analysis
---

# SPEC-132: Zod 4 cross-package migration

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Migrate all uses of Zod 3's `.string().url()`, `.string().email()`, `.string().uuid()`, `.string().datetime()`, `.string().cuid()`, etc. in `@repo/schemas`, `@repo/service-core`, and any consuming apps to the Zod 4 top-level format validators (`z.url()`, `z.email()`, `z.uuid()`, `z.datetime()`, ...).

**Why now:** SPEC-111 brought Zod 4 into the monorepo transitively via Astro 6 (`apps/web`). The web app's own `src/env.ts` was already migrated as part of SPEC-111. The shared packages still use the legacy Zod 3 API. The legacy API emits a deprecation warning on every parse — including during tests that load Zod 4 via Vitest. While runtime behavior is unchanged today, the legacy methods are scheduled for removal in Zod 5, so this is on the upgrade path.

**Why a separate spec:** Touching `@repo/schemas` and `@repo/service-core` is cross-cutting (consumed by `apps/api`, `apps/admin`, `apps/web`, `packages/seed`, `packages/billing`). Bundling it into SPEC-111's PR would balloon scope and risk surface. Independent PR with its own focused review is safer.

> **Dependabot gating (SPEC-219):** `zod` is pinned via `ignore` in `.github/dependabot.yml` because its breaking changes land in MINOR bumps (e.g. 4.4 made `.merge()` throw on schemas with refinements — use `.safeExtend()`), which Dependabot's update-type grouping cannot isolate. **Lifting that `ignore` entry is part of THIS spec's completion:** once the migration lands and CI is green, remove the `zod` entry so Dependabot resumes bumping it. See [Dependabot Policy](../../../docs/guides/dependabot-policy.md).

### 2. Out of Scope

- Astro 6 bump or any `apps/web` changes (handled in SPEC-111).
- Zod 5 readiness audits beyond the format validator migration.
- Schema refactors / restructuring beyond the API surface change.
- Changes to validation semantics (output types must be identical to today).

### 3. Migration Mapping

Legacy → Zod 4 equivalent:

| Legacy | Zod 4 | Note |
|---|---|---|
| `z.string().url()` | `z.url()` | Returns `ZodString` in 3, `ZodURL` in 4 — both narrow to `string` |
| `z.string().email()` | `z.email()` | Same — narrows to `string` |
| `z.string().uuid()` | `z.uuid()` | Same |
| `z.string().datetime()` | `z.iso.datetime()` | New namespace under `z.iso` |
| `z.string().date()` | `z.iso.date()` | Same |
| `z.string().time()` | `z.iso.time()` | Same |
| `z.string().cuid()` | `z.cuid()` | Same |
| `z.string().cuid2()` | `z.cuid2()` | Same |
| `z.string().ulid()` | `z.ulid()` | Same |
| `z.string().regex(...)` | `z.string().regex(...)` | UNCHANGED — only format validators moved |
| `z.string().min(N)` / `.max(N)` / `.length(N)` | UNCHANGED | Length constraints stay on `z.string()` |

### 4. Investigation Approach

#### Phase 0 — Audit

1. `rg -tts -ttsx 'z\.string\(\)\.(url|email|uuid|datetime|date|time|cuid2?|ulid)\(\)' packages/ apps/` from repo root.
2. Generate a CSV/markdown table with `file:line | pattern | category` to plan in chunks.
3. Identify any custom regex-based validators that map to a Zod 4 native (e.g. an `.regex(/^[0-9a-f-]+$/).optional()` that's really a UUID).

#### Phase 1 — `@repo/schemas` migration

Apply find+replace via codemod or scripted regex. After each subdirectory of schemas, run `pnpm --filter @repo/schemas test` and `pnpm --filter @repo/schemas typecheck`. Commit per directory if possible (audit, bookings, billing, etc.).

#### Phase 2 — `@repo/service-core` migration

Same pattern. Service-core has fewer schemas (mostly DTOs), but its tests are integration-level and slower.

#### Phase 3 — Consumer apps spot-check

For each app that consumes schemas (`apps/api`, `apps/admin`, `apps/web`, `packages/seed`, `packages/billing`):

- Run typecheck + tests.
- If any custom Zod schema in the app's own source uses legacy validators, migrate.

#### Phase 4 — Drop deprecation warning suppression

Search `vitest.config.*` / `tsconfig.*` / `biome.json` for any `--silent` flags or warning filters that hide Zod deprecations. Remove them so a future regression surfaces immediately.

### 5. Tasks

| Task | Title | Phase | Status |
|---|---|---|---|
| T-132-01 | Audit: enumerate all legacy Zod format validator usages | 0 | pending |
| T-132-02 | Migrate `@repo/schemas` | 1 | pending |
| T-132-03 | Migrate `@repo/service-core` | 2 | pending |
| T-132-04 | Spot-check consumer apps for in-app schema usages | 3 | pending |
| T-132-05 | Re-enable deprecation warning visibility | 4 | pending |
| T-132-06 | PR to staging + verify full test suite green | - | pending |

### 6. Acceptance Criteria

- [ ] Zero `z.string().(url|email|uuid|datetime|date|time|cuid|cuid2|ulid)()` patterns remaining in `packages/` and `apps/` (excluding archived spec docs and historical references).
- [ ] All test suites pass with zero "deprecation" warnings in the output.
- [ ] No runtime behavior change confirmed by full integration test suite green.
- [ ] PR merged to staging.

### 7. Risks

| Risk | Mitigation |
|---|---|
| Zod 4's `z.email()` is strict by default and may reject email shapes accepted by Zod 3 | The `.email({ message: '...' })` API still works; behavior change documented in Zod CHANGELOG — read it before assuming "drop-in replacement" |
| Test fixtures use literal datetime strings that Zod 3 accepted loosely; `z.iso.datetime()` may be stricter | Inspect each test that uses datetime/date fixtures during phase audit |
| Find+replace regex hits a false positive (e.g. a string literal containing `.url()`) | Use AST-based codemod via `ts-morph` or manual review of each replacement |

---

## Part 2 — Implementation Notes

### Source

Discovered during SPEC-111 Astro 6 impact analysis. The web app's `apps/web/src/env.ts` had 9 `z.string().url()` uses migrated in SPEC-111 commit `600282674`. The remaining usages in `@repo/schemas` and `@repo/service-core` were intentionally deferred since those packages have cross-app consumers and warrant a focused PR.

### Pre-migration audit script

```bash
# Quick estimate of scope:
rg --no-heading -c 'z\.string\(\)\.(url|email|uuid|datetime|date|time|cuid2?|ulid)\(\)' packages/ apps/ | sort -t: -k2 -n -r
```

### Tracking

Once started, link the SPEC-132 task progress through the engram registry as the formal protocol.

### Cross-spec dependencies

- SPEC-111 (Astro 6 bump) — closed; brought Zod 4 in; surfaced this debt.
- Future Zod 5 spec — none open yet; SPEC-132 is the prerequisite.
