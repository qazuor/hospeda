# SPEC-090: Env-Var Schema SSOT — Eliminate the Manual Key-Mirror in Cross-Validation

> **Status**: draft
> **Priority**: P2
> **Complexity**: 5
> **Origin**: 2026-04-20 — drift discovered after commit `ad95ef97` added 4 Cloudinary vars that had been silently absent from both `API_SCHEMA_KEYS` and `ENV_REGISTRY`. Five additional vars (`HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS`, `HOSPEDA_AUTH_LOCKOUT_WINDOW_MS`, `HOSPEDA_ADDON_LIFECYCLE_ENABLED`, `HOSPEDA_REVALIDATION_SECRET`, `HOSPEDA_REVALIDATION_CRON_SCHEDULE`) are present in `ApiEnvSchema` but absent from `API_SCHEMA_KEYS`, making them invisible to the cross-validation test.
> **Depends on**: none
> **Related**: SPEC-078-GAPS (Cloudinary remediation — surfaced this gap), SPEC-063 (env-registry initial cross-validation test)

---

## Problem Statement

The Hospeda monorepo governs env vars through three distinct artifacts:

| Artifact | File | Role |
|----------|------|------|
| **Zod runtime schemas** | `apps/api/src/utils/env.ts` (`ApiEnvSchema`), `apps/admin/src/env.ts` (`AdminEnvSchema`), `apps/web/src/env.ts` (`serverEnvSchema`) | Authoritative — apps fail-fast at boot on any missing or malformed var. |
| **ENV_REGISTRY** | `packages/config/src/env-registry.ts` | Documentation and tooling artifact — lists all known vars, which app uses them, type, description, default. Powers `pnpm env:check`, IDE hints, docs generation. |
| **Cross-validation test** | `packages/config/src/__tests__/env-registry-schema-cross-validation.test.ts` | Asserts that every registry entry for app X exists in that app's Zod schema (and vice versa). Cannot import from `apps/*` directly (circular workspace dep), so it maintains STATIC `Set<string>` mirrors (`API_SCHEMA_KEYS`, `ADMIN_SCHEMA_KEYS`, `WEB_SCHEMA_KEYS`) of each schema's `.shape` keys. |

### The fragility

Adding or removing an env var correctly requires touching **three** files:

1. The Zod schema in the app.
2. The `ENV_REGISTRY` entry in `packages/config`.
3. The static `*_SCHEMA_KEYS` set in the cross-validation test.

The test is designed to catch drift between (1) and (2), but the static mirror in (3) is itself manually maintained. If a developer adds to (1) but forgets to update (3), the test silently fails to enforce the new var — exactly the class of bug it exists to prevent.

### Confirmed drift as of 2026-04-20

The following vars exist in `ApiEnvSchema` but are absent from `API_SCHEMA_KEYS` AND absent from `ENV_REGISTRY`. The cross-validation test cannot detect them:

```
HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS
HOSPEDA_AUTH_LOCKOUT_WINDOW_MS
HOSPEDA_ADDON_LIFECYCLE_ENABLED
HOSPEDA_REVALIDATION_SECRET
HOSPEDA_REVALIDATION_CRON_SCHEDULE
```

A parallel case: 4 Cloudinary vars (`HOSPEDA_CLOUDINARY_CLOUD_NAME`, `HOSPEDA_CLOUDINARY_API_KEY`, `HOSPEDA_CLOUDINARY_API_SECRET`, `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB`) were missing from BOTH the mirror AND the registry — discovered only because commit `ad95ef97` happened to add them to both simultaneously. Without that commit, they would have remained invisible indefinitely.

### Root cause

`@repo/config` cannot import from `apps/*` (that would create a circular workspace dependency). The static mirror was introduced as a pragmatic workaround. It works when updated, but there is no mechanical enforcement that it stays current — it depends entirely on developer vigilance at PR time.

---

## Goal

Define a single source of truth for env-var schemas such that:

- Each app validates its env vars at boot with fail-fast semantics (preserved).
- The registry's view of what vars exist is mechanically derived from or tied to the actual runtime schemas — not a hand-written mirror.
- Adding a var requires touching **at most one** file; registry/tooling/docs updates happen automatically or CI fails with a clear message pointing at the missing place.
- `pnpm env:check` and related tooling continue to work.
- No circular workspace dependencies are introduced.
- Adding a new app does not require modifying `packages/config` to register it in the cross-validation.

---

## Approach Options

The user must select one before task generation.

---

### Option A: Extract schemas to a shared package

Create a new package `packages/env-schemas` (or extend `packages/schemas`) that exports `ApiEnvSchema`, `AdminEnvSchema`, and `ServerEnvSchema`. Both the apps and `packages/config` import from this shared package. The cross-validation test reads `.shape` directly from the imported schemas — no static mirror needed.

**Dependency graph after change:**

```
apps/api      → packages/env-schemas (runtime import)
apps/admin    → packages/env-schemas (runtime import)
apps/web      → packages/env-schemas (runtime import)
packages/config → packages/env-schemas (test import only, or also runtime for registry derive)
```

No cycles. `packages/env-schemas` has no workspace dependencies.

**Pros:**

- True SSOT: the schema IS the mirror. Adding a var to `ApiEnvSchema` is immediately visible to the cross-validation test on the next run — no set to update.
- Native Zod inference continues to work (`z.infer<typeof ApiEnvSchema>`).
- The registry can derive its key list programmatically: `Object.keys(ApiEnvSchema.shape)` at test time.
- AC-5 (new app discovery) is solvable: new apps just export their schema from `packages/env-schemas`.
- Least ongoing maintenance burden.

**Cons:**

- Requires moving schema definitions out of the apps. Some schemas have app-specific quirks:
  - `serverEnvSchema` in `apps/web/src/env.ts` does runtime substitution of `PUBLIC_*` / `VITE_*` vars using Astro's `import.meta.env` — this logic may resist extraction without a thin adapter.
  - `AdminEnvSchema` validates `VITE_*` names, not `HOSPEDA_*` originals. The schema definition is straightforward; only the consumption context differs.
- Migration effort: 3 schema definitions + all import sites in the apps + cross-validation rewrite.
- New package to maintain (`packages/env-schemas`), even if small.
- If any schema uses framework-specific primitives (Astro's `AstroConfig`, Vite's `ImportMetaEnv`), extraction may require interface shims.

**Impact on existing code:** 3 schema files move; all `import { ApiEnvSchema }` sites in `apps/api` update their import path. The cross-validation test is rewritten (~100 lines removed, ~30 added). `ENV_REGISTRY` itself is unchanged. `pnpm env:check` is unchanged or improved (can read `.shape` directly instead of the registry's app list).

---

### Option B: Keep schemas in apps, generate the mirror at build time

A small build-time script (e.g., `packages/config/scripts/generate-schema-keys.ts`) reads each app's schema source via the TypeScript compiler API or AST parse, extracts the `.object({...})` key literals, and emits the `*_SCHEMA_KEYS` sets as a generated TypeScript file. CI runs the script and fails if the committed generated file differs from the freshly generated output (`git diff --exit-code`).

**Pros:**

- Zero refactor of app code. Schema definitions stay where they are.
- No new packages.
- CI gate mechanically enforces freshness — drift is caught at PR time, not by developer memory.

**Cons:**

- Codegen complexity: the script must parse TypeScript AST correctly. Schema definitions that use `.merge()`, `.extend()`, `.superRefine()`, or computed keys would defeat a naive key extractor and require custom handling.
- Two-phase process: devs must remember to run `pnpm generate:schema-keys` (or rely on CI to catch the miss). A pre-commit hook could help but adds friction.
- The generated file is a committed artifact — PRs touching schemas will always have a generated-file diff, which clutters reviews.
- Still adds complexity proportional to the number of schema composition patterns in use.
- Does not eliminate the concept of a mirror — it automates its generation rather than eliminating it.

**Impact on existing code:** Schema files unchanged. Cross-validation test imports from a generated file instead of defining the sets inline. CI job added. Developers must learn the codegen step.

---

### Option C: Move cross-validation into each app

Each app gets its own test that imports its own schema directly (no mirror) and cross-checks it against the registry. The `packages/config` cross-validation test is reduced to verifying the registry's internal consistency (no schema cross-check).

**Pros:**

- Minimal new code. Each app's test runs against the fresh schema.
- No new packages, no codegen.
- Circular dependency concern disappears entirely for the per-app tests (app tests can import from `packages/config` freely).
- Easy to implement incrementally: add one app's test at a time.

**Cons:**

- Drift coverage is now spread across 3 (or more) app test suites. A developer touching only `packages/config` (e.g., editing the registry) must know to check all three app test results to see the full picture.
- Test near-duplication: 3 files with near-identical structure. Any improvement to the cross-validation logic must be replicated.
- Cross-app consistency (a registry entry that claims `apps: ['api', 'admin']` but only `api` validates it) is not caught by any single test — requires running all app tests together.
- AC-5 (new app bootstrap without touching `packages/config`) is partially met: the app can add its own test, but if the registry also needs to know about the new app's vars, `packages/config` still changes.
- Does not address the `HOSPEDA_*` → `VITE_*` ambiguity documented in `ADMIN_KNOWN_GAPS`.

**Impact on existing code:** `packages/config` cross-validation test shrinks to registry-internal checks. Three new test files added (one per app). Each app's test suite gains a dependency on `packages/config`.

---

### Option D (hybrid): Shared schema package for new vars, codegen bridge for legacy — transitional period

Implement Option A for schemas that are straightforward to extract (e.g., `ApiEnvSchema`, `AdminEnvSchema`) and use a thin adapter pattern for `serverEnvSchema` (keep the Astro-coupled runtime instantiation in the web app; extract only the shape definition to `packages/env-schemas` as a plain `z.object({...})` const that the web app extends with framework-specific overrides).

During a transition period (e.g., one sprint), `apps/web` still keeps a local adapter that wraps the shared shape with Astro's `import.meta.env` logic. Once the shape is extracted, the cross-validation test reads shapes directly and no static mirror exists for any app.

**Pros:**

- Unblocks the two simpler schemas (API, Admin) immediately without waiting on the Astro adapter design.
- Provides a defined migration path for the trickiest case (web) without blocking progress.
- Produces the same end state as Option A.

**Cons:**

- Adds a transitional intermediate state that must be cleaned up.
- Requires agreeing on the adapter pattern before work starts — adds design overhead.
- The transition period carries partial-SSOT risk: during the transition, the web schema is still a manual mirror.

**Impact on existing code:** Same as Option A ultimately; adds a short-lived adapter in `apps/web`. Transitional complexity is bounded to one sprint.

---

## Acceptance Criteria

**AC-090-01**: Adding a new env var to an app's Zod schema requires changes in at most 1 file (the schema itself). The registry entry and the cross-validation are updated automatically or CI fails with a message that explicitly names the missing file and action required.

**AC-090-02**: The 5 currently-undetected drift vars — `HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS`, `HOSPEDA_AUTH_LOCKOUT_WINDOW_MS`, `HOSPEDA_ADDON_LIFECYCLE_ENABLED`, `HOSPEDA_REVALIDATION_SECRET`, `HOSPEDA_REVALIDATION_CRON_SCHEDULE` — are all detected by the new system (i.e., the new test fails before the registry is updated to include them, giving developers an actionable failure message).

**AC-090-03**: `pnpm env:check` continues to work with equivalent or improved output. If its internals change (e.g., it reads schema shapes instead of a static list), the user-visible behavior and output format are unchanged.

**AC-090-04**: No circular workspace dependency is introduced. `pnpm ls --filter @repo/config --depth 1` does not show `apps/*` as a dependency.

**AC-090-05**: Bootstrapping a new app with its own env schema does not require modifying `packages/config` to register the app in the cross-validation infrastructure. The system discovers the app's schema via convention (shared package membership, file-path registration, or explicit export from `packages/env-schemas`).

**AC-090-06**: Migration is incremental. The old `API_SCHEMA_KEYS`, `ADMIN_SCHEMA_KEYS`, `WEB_SCHEMA_KEYS` static sets remain in place (possibly deprecated but not deleted) until all three apps are migrated. CI does not break between migration steps for partially-migrated states.

**AC-090-07**: The 5 drift vars identified in AC-090-02 are added to `ENV_REGISTRY` with correct metadata (app, type, description, default) as part of this SPEC. The new system then confirms they are no longer missing.

**AC-090-08**: `pnpm typecheck && pnpm lint && pnpm test` passes across all touched packages after migration.

---

## Out of Scope

- Changing env-var names, prefixes (`HOSPEDA_`, `PUBLIC_`, `VITE_`), or their runtime semantics.
- Migrating from Zod to another validator.
- Changing the boot-time validation strategy — apps continue to fail-fast on missing vars.
- Changing individual env var types, defaults, or descriptions (except those added to the registry for AC-090-07).
- The dependency-policy documentation or any unrelated config refactoring.
- Implementing env vars whose values are currently missing (the 5 drift vars are being registered, not implemented).
- Linting the `.env.example` files or adding new ones.

---

## Risks and Open Questions

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `serverEnvSchema` uses Astro `import.meta.env` at definition time, making extraction non-trivial | Medium | Medium | Extract only the shape as a plain `z.object({...})`; keep the Astro-coupled instantiation in the app as an adapter layer. If extraction proves impossible, fall back to Option C for the web app and Option A for api/admin. |
| Some `ApiEnvSchema` fields use `.superRefine()` or `.transform()` — keys may not be enumerable via `.shape` | Low | High | Verify before coding: `z.object(...).superRefine(...)` still exposes `.shape` from the inner object. If not, the schema must be split: a plain `.shape`-enumerable base plus a validated wrapper. |
| Moving schemas to a shared package breaks tree-shaking or bundler assumptions in apps | Low | Low | The schemas are small (~2KB each) and already imported at app startup. No meaningful bundle impact expected. |
| The 5 drift vars may have been intentionally excluded from `ENV_REGISTRY` for a reason not documented | Low | Medium | Before adding them in AC-090-07, verify each var is actually used in production code (grep), not just a leftover from a branch. |

### Open Questions (must be answered before task generation)

1. **Approach selection**: Which option (A, B, C, or D) does the user want to implement? The entire task breakdown depends on this choice.

2. **`serverEnvSchema` Astro coupling**: Does `apps/web/src/env.ts` use `import.meta.env` at the point where the schema is defined, or only at the point where it is parsed/instantiated? If the schema definition is a pure `z.object({...})` literal, extraction to a shared package is straightforward. If Astro substitution happens at definition time, Option A requires an adapter pattern (see Option D).

3. **`packages/env-schemas` vs extending `packages/schemas`**: If Option A or D is chosen, should the schemas live in a new dedicated package (`packages/env-schemas`) or be added to the existing `@repo/schemas` package? Adding to `@repo/schemas` avoids a new package but mixes env-var validation with data schema validation.

4. **`pnpm env:check` internals**: Does the tool read from `ENV_REGISTRY` exclusively, or does it also read the static `*_SCHEMA_KEYS` sets? If it reads the registry only, the migration is transparent to tooling. If it reads the static sets, those must be updated or replaced as part of the migration.

5. **Transition gate**: Should the transition period (Option D) have a hard deadline (e.g., must complete within 2 sprints), or is it acceptable to leave the web schema as a partial mirror indefinitely if the Astro coupling is complex?

---

## Implementation Phases (high-level, approach-agnostic)

These phases apply regardless of which option is chosen. Phase 1 is common to all options; later phases differ by approach.

1. **P1 — Remediate current drift**: Add the 5 undetected vars to `ENV_REGISTRY` AND to the current static `API_SCHEMA_KEYS`. This makes the current test accurate immediately and unblocks AC-090-02 even before the architectural change lands.
2. **P2 — Implement chosen approach**: See individual approach sections above.
3. **P3 — Migrate apps**: Update import sites in apps to reference the new schema location (if Option A/D).
4. **P4 — Remove the static mirror**: Delete or deprecate `API_SCHEMA_KEYS`, `ADMIN_SCHEMA_KEYS`, `WEB_SCHEMA_KEYS`. Rewrite the cross-validation test to use schema shapes or per-app tests.
5. **P5 — Verify tooling**: Confirm `pnpm env:check`, IDE hints, and docs generation work correctly end-to-end.

Detailed task breakdown to follow in `.claude/tasks/SPEC-090-env-schema-ssot/state.json` via `/task-master:task-from-spec` once the approach is selected.

---

## References

- `packages/config/src/env-registry.ts` — current registry definition (assembled from category-specific modules).
- `packages/config/src/__tests__/env-registry-schema-cross-validation.test.ts` — the test that maintains the manual mirror; lines 30-50 document the known-gaps rationale and the static-mirror workaround.
- `apps/api/src/utils/env.ts` — `ApiEnvSchema` (authoritative runtime validator for the API).
- `apps/admin/src/env.ts` — `AdminEnvSchema` (authoritative runtime validator for the Admin app).
- `apps/web/src/env.ts` — `serverEnvSchema` (authoritative runtime validator for the Web app).
- Discovery commit: `ad95ef97 fix(config): register 4 Cloudinary env vars in ApiEnvSchema` (2026-04-20) — the most recent drift fix that surfaced this problem.
- SPEC-078-GAPS Known Follow-ups: `.claude/tasks/SPEC-078-GAPS/TODOs.md` — where this gap was first recorded as a non-actionable observation.
