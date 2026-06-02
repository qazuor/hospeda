# SPEC-178 — CI wiring handoff

**Status:** the CI artifacts are built and validated, but the **wiring into the workflows is
intentionally NOT done here** — a parallel effort is migrating CI to local runners, and wiring into
the current `.github/workflows/*.yml` would (a) risk a merge conflict and (b) be thrown away when
`ci.yml` is replaced. This file documents the exact, minimal wiring to apply **in the new CI system**
(local runners) once it lands.

Nothing below touches `.github/workflows/` or the integration-test setup — those edits are deferred.

---

## 1. Schema-drift guard (T-012)

**Artifact (DONE + validated):** `scripts/check-schema-drift.sh`. Runs `drizzle-kit generate` offline
and fails if the TS schema changed without a committed migration. Validated on both states (clean →
pass; uncommitted schema change → fail, exit 1, tree left clean).

**Wiring (TODO in new CI):** add one step to the `guards` job (or its local-runner equivalent),
mirroring the existing `bash scripts/check-*.sh` guards:

```yaml
- name: Schema drift check
  run: bash scripts/check-schema-drift.sh
```

Requires: the job must have `pnpm install` done and `@repo/db` deps buildable (the script runs
`drizzle-kit generate`). No database needed — the guard is fully offline.

---

## 2. env:check:registry gate (T-014)

`pnpm env:check:registry` is documented as a CI gate in the root CLAUDE.md but is **not actually
wired into `ci.yml`**. Add it to the `guards` job:

```yaml
- name: Env registry parity
  run: pnpm env:check:registry
```

(That script runs `bash scripts/check-env-registry.sh` → 3 vitest cross-validation suites.)

---

## 3. CI applies via migrate, not push (T-013)

So CI exercises the exact prod path (and a broken migration fails CI, not prod), switch the schema
sync from `drizzle-kit push` to the versioned `migrate` + extras in:

### 3a. E2E workflows — `.github/workflows/e2e-pr.yml` and `e2e-nightly.yml`

Current (both): the "Push Drizzle schema" step runs `pnpm --filter @repo/db db:push` against the E2E
DB. Replace the push with migrate + extras:

```yaml
# was: pnpm --filter @repo/db db:push
- name: Apply versioned schema to E2E DB
  run: |
    pnpm --filter @repo/db db:migrate
    pnpm db:apply-extras
  env:
    HOSPEDA_DATABASE_URL: ${{ env.HOSPEDA_E2E_DATABASE_URL }}
```

(The existing `apply-postgres-extras` step, if separate, can be folded in or kept — it now reads
`migrations/extras/`.)

### 3b. Integration test global-setup (NOT a workflow file, but deferred to avoid stepping on the

CI-runner migration since it governs how CI brings up the test DB):

`packages/db/test/integration/global-setup.ts` (and the equivalent in
`packages/service-core/test/integration/services/global-setup.ts`) currently create the DB, then run
`drizzle-kit push`, then `apply-postgres-extras.sh`. Switch the `push` to the migrate flow:

- run `drizzle-kit migrate` (or `pnpm --filter @repo/db db:migrate`) against the freshly-created test DB
- keep the `CREATE EXTENSION` calls (they already exist in global-setup — uuid-ossp/pgcrypto/unaccent)
- keep `apply-postgres-extras` afterward (now reads `migrations/extras/`)

Order, matching prod: CREATE EXTENSION → migrate → apply-extras.

---

## Why these are safe to defer

The drift guard, the env gate, and the migrate switch are all **single-line / single-step** additions.
They depend only on the artifacts already committed in this spec (the baseline, the extras, `db:migrate`
= real migrate, `apply-extras` reading `extras/`). Applying them is mechanical once the local-runner CI
exists; nothing in the SPEC-178 carril needs to change to support them.
