# ADR-024: Env-Var Schema as Single Source of Truth (Per-App Cross-Validation)

**Status**: Accepted
**Date**: 2026-04-29
**Spec**: SPEC-090

## Context

Hospeda governs env vars through three artifacts:

| Artifact | Location | Role |
|----------|----------|------|
| **Zod runtime schemas** | `apps/api/src/utils/env.ts` (`ApiEnvBaseSchema`), `apps/admin/src/env.ts` (`AdminEnvSchema`), `apps/web/src/env.ts` (`serverEnvBaseSchema`) | Authoritative — apps fail-fast at boot on any missing or malformed var. |
| **`ENV_REGISTRY`** | `packages/config/src/env-registry.*.ts` | Documentation/tooling — drives `.env.example` generation, audits, and dev hints. |
| **Cross-validation test** | (formerly) `packages/config/src/__tests__/env-registry-schema-cross-validation.test.ts` | Asserted that registry entries existed in each app's schema (and vice-versa). |

The cross-validation test could not import from `apps/*` because that
would create a circular workspace dependency. The workaround was a
manually-maintained mirror — three `Set<string>` constants
(`API_SCHEMA_KEYS`, `ADMIN_SCHEMA_KEYS`, `WEB_SCHEMA_KEYS`) that listed
every key in each schema. The test compared mirror-vs-registry, never
schema-vs-registry directly.

### Failure mode

When a developer added an env var to a Zod schema and forgot to update
the static mirror, the test silently passed even though the new var was
absent from the registry. This was not theoretical:

- 4 Cloudinary vars (`HOSPEDA_CLOUDINARY_*`, `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB`)
  lived in `ApiEnvSchema` for an unknown duration without being registered.
  Discovered by chance when a single commit happened to add them to both.
- 5 vars (`HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS`, `HOSPEDA_AUTH_LOCKOUT_WINDOW_MS`,
  `HOSPEDA_ADDON_LIFECYCLE_ENABLED`, `HOSPEDA_REVALIDATION_SECRET`,
  `HOSPEDA_REVALIDATION_CRON_SCHEDULE`) were validated by the schema
  but absent from both the mirror and the registry until SPEC-090.

### Goal

Make adding an env var require touching at most one file (the schema),
with mechanical drift detection that fails CI when registry/schema
disagree. No circular dependencies.

## Considered Options

### Option A — Move schemas to a shared package (rejected)

Create `packages/env-schemas` exporting `ApiEnvSchema`, `AdminEnvSchema`,
`ServerEnvSchema`. The cross-validation test imports them directly.

- True SSOT; the schema IS the mirror.
- **Blocker**: `apps/admin/src/env.ts` is tightly coupled to Vite's
  `import.meta.env` at validation time (`validateAdminEnv` reads each
  key explicitly to bridge Vite's static replacement). Moving the schema
  out of the app requires a non-trivial factory refactor.
- Rejected: cost of extracting the admin schema is not justified.

### Option B — Codegen the mirror at build time (rejected)

A script reads each schema's source via TypeScript AST and emits the
`*_SCHEMA_KEYS` sets as a generated TypeScript file. CI fails on diff.

- Schema files unchanged; CI mechanically enforces freshness.
- **Cons**: AST parser must handle `.merge`, `.extend`, `.superRefine`,
  `.refine` patterns correctly. Generated artifact clutters PRs. Still
  carries the *concept* of a mirror.
- Rejected: complexity not warranted when Option C exists.

### Option C — Move cross-validation into each app (adopted)

Each app gets its own test that imports its schema directly and
cross-checks against `ENV_REGISTRY` from `@repo/config`. Apps already
depend on `@repo/config`, so the import direction (apps → packages)
respects the dependency graph. The mirror is gone — the test reads
`Object.keys(Schema.shape)` at runtime.

- Zero refactor of app schemas.
- True schema-vs-registry comparison; no manual mirror.
- New apps just add their own test; `packages/config` is untouched.
- Per-service cross-app inconsistencies (e.g., a registry entry that
  claims `apps: ['api', 'admin']` but only `api` validates it) require
  running both app tests together — accepted tradeoff because boot-time
  validation already enforces presence per-app.

### Option D — Hybrid A + adapter (rejected)

Same end state as A with a transitional adapter for the admin schema.
Same blocker as A; the adapter is the additional cost without an
intermediate benefit.

## Decision

Adopt **Option C**:

1. **Per-app cross-validation tests**:
   - `apps/api/test/utils/env-registry-cross-validation.test.ts`
   - `apps/admin/test/env-registry-cross-validation.test.ts`
   - `apps/web/test/lib/env-registry-cross-validation.test.ts`

   Each test:
   - Imports its app's schema directly (`ApiEnvBaseSchema`,
     `AdminEnvSchema`, `serverEnvBaseSchema`).
   - Enumerates `Object.keys(Schema.shape)` to get the live key set.
   - Filters `ENV_REGISTRY` by the app id.
   - Asserts mutual coverage, with two named gap sets per app:
     `KNOWN_GAPS_REGISTRY_NOT_IN_SCHEMA` (registry entries that are
     intentionally not validated, e.g., HOSPEDA→VITE renames) and
     `KNOWN_GAPS_SCHEMA_NOT_IN_REGISTRY` (schema keys not part of the
     public registry, e.g., Vite-internal `DEV`/`PROD`).
   - Cross-checks the gap sets themselves so that a var moved INTO the
     schema fails the test until removed from the gap set.

2. **Schema base export pattern**: schemas with `.superRefine` /
   `.refine` (api, web) export the inner `z.object({...})` separately
   (`ApiEnvBaseSchema`, `serverEnvBaseSchema`) so the test can read
   `.shape`. The wrapped schema (with cross-field validation) remains
   the runtime entrypoint.

3. **Old mirror removed**: `packages/config/src/__tests__/env-registry-schema-cross-validation.test.ts`
   and its 9 `*_SCHEMA_KEYS` / `*_KNOWN_GAPS` mirror sets are deleted.
   `packages/config/src/__tests__/env-registry.test.ts` keeps the
   registry-internal coherence checks (uniqueness, types, categories,
   exampleValues, secret-flag heuristics).

4. **`pnpm env:check:registry`**: aggregator script
   (`scripts/check-env-registry.sh`) runs the three per-app tests
   sequentially. Wired into `pnpm check:guards` so any pre-merge
   guard run catches drift.

5. **Existing `pnpm env:check`** (Vercel audit) is unchanged. The new
   `:registry` suffix names the new responsibility explicitly.

## Drift fixed at adoption

5 vars added to `ENV_REGISTRY` to clear pre-existing schema-only drift:

- `HOSPEDA_REVALIDATION_SECRET` (api, web)
- `HOSPEDA_REVALIDATION_CRON_SCHEDULE` (api)
- `HOSPEDA_ADDON_LIFECYCLE_ENABLED` (api)
- `HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS` (api)
- `HOSPEDA_AUTH_LOCKOUT_WINDOW_MS` (api)
- `PUBLIC_ADMIN_URL` (web) — present in schema, missing from registry
- `HOSPEDA_ADMIN_URL` `apps` field expanded to include `'web'` — already
  present in registry but not advertised for the web app despite living
  in `serverEnvSchema`.

Total registry size: 185 → 191 entries.

## Smoke test (verification)

A bogus var added to `ApiEnvBaseSchema` immediately fails the API test:

```
ApiEnvSchema vars missing from ENV_REGISTRY (apps: ['api', ...]):
  - HOSPEDA_SMOKE_TEST_BOGUS_VAR
Add the var to packages/config/src/env-registry.*.ts with the appropriate metadata.
```

The failure message names the file to edit. Removing the bogus var
restores the test to green.

## Consequences

### Positive

- One file to touch when adding an env var (the schema). The cross-
  validation test fails with an actionable message until the registry
  catches up.
- No circular dependency. `packages/config` exposes only types and the
  registry; apps consume both.
- New apps add their own test without modifying `packages/config`.
- Old mirror (~270 lines) removed; replaced by ~110 lines per app —
  net surface decreases because the redundant snapshot tests are gone.

### Negative

- Three test files instead of one. A change to the validation logic
  (e.g., adding a new gap-set rule) must be replicated.
- Cross-app consistency is not enforced by a single test run. Mitigated
  by `pnpm env:check:registry` running all three sequentially and the
  guard being part of `pnpm check:guards`.

### Neutral

- Each app's `KNOWN_GAPS_*` sets are tracked per-app. A var that is
  intentionally not validated in two apps appears in two gap sets — the
  test on each side ensures the documentation stays current locally.

## References

- `apps/api/src/utils/env.ts` — `ApiEnvBaseSchema` + `ApiEnvSchema`
- `apps/web/src/env.ts` — `serverEnvBaseSchema` + `serverEnvSchema`
- `apps/admin/src/env.ts` — `AdminEnvSchema`
- `apps/{api,admin,web}/test/**/env-registry-cross-validation.test.ts`
- `packages/config/src/env-registry.hospeda.ts` (5 new entries)
- `packages/config/src/env-registry.client.ts` (1 new entry)
- `scripts/check-env-registry.sh`
- `package.json`: `env:check:registry`, `check:guards`
- SPEC-090 — Env-Var Schema SSOT
