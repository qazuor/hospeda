---
specId: SPEC-189
title: Optimize Seed & App Builds — run seed from src (no build) + decouple @repo/schemas from @repo/feedback
slug: optimize-seed-and-app-builds
type: refactor
status: completed
complexity: medium
owner: qazuor
created: 2026-06-02
base: staging
branch: spec/SPEC-189-optimize-seed-and-app-builds
worktree: /home/qazuor/projects/WEBS/hospeda-spec-189-optimize-seed-and-app-builds
linearIssues:
  - BETA-54
tags:
  - seed
  - build
  - turbo
  - tsx
  - schemas
  - feedback
  - refactor
  - performance
---

# SPEC-189 — Optimize Seed & App Builds

> Skeleton note: this is the formalized functional spec. Tasks and `index.json`
> updates are produced by the caller after this file lands — do not generate them here.

## 1. Origin & problem statement

Linear **BETA-54** ("optimize the build required to run seed from hops") asks to make
`hops db-seed` cheaper. Today, before the seed can run, the command cold-builds a chain
of workspace packages — ~30-60s on a fresh VPS host. The owner expanded the scope after
analysis into **two independent fronts** that both attack build cost.

### The seed cold-build (Front A)

`hops db-seed` (`scripts/server-tools/src/commands/db-seed.ts`,
`buildSeedDependencies()`) runs:

```
pnpm turbo run build --filter=@repo/seed^...
```

`@repo/seed^...` means "every dependency of `@repo/seed` but not the seed itself". The
seed has **no build step** — its `package.json` points `main`/`exports` at
`./src/cli.ts` and `./src/index.ts`, and it runs via `tsx ./src/cli.ts` (tsx transpiles
TS at runtime). But every `@repo/*` workspace dependency declares its `exports."."` as
`./dist/index.js`. So when the seed's `tsx` process imports `@repo/db`, Node resolves the
workspace symlink to that package's `exports` field → `dist/` → which does not exist until
the package is built. Without the build the seed crashes with `ERR_MODULE_NOT_FOUND`.

That is the only reason the build exists: **dist-resolution of workspace deps**, not any
real codegen. Every one of the ten built packages uses a plain `tsup` build (pure
transpile, no schema/code generation) — verified in §2. Because `tsx` already transpiles
the seed's own TS at runtime, it can equally transpile the deps' TS **if pointed at their
`src/` instead of their `dist/`** via tsconfig `paths`. That eliminates the build.

### The schemas → feedback → icons smell (Front B)

`@repo/schemas` declares a runtime dependency on `@repo/feedback` for exactly one reason:
`packages/schemas/src/feedback.ts` is a pure re-export of the feedback Zod schemas
(`export * from './feedback.js'` is wired into `src/index.ts` line 6). `@repo/feedback`
in turn depends on `@repo/icons`, React, react-dom, tailwind-merge — a 434-component React
icon library. So **every server-side package that depends on `@repo/schemas`** (API, web,
admin, seed) drags the feedback package — and through it the icon/React subtree — into its
turbo build graph and node graph, even when it never renders an icon. The API is the
clearest victim: it consumes `@repo/schemas` everywhere and never uses icons, yet
`@repo/icons` sits in its transitive build chain solely because schemas re-exports
feedback's Zod schemas.

The fix is to **invert the dependency**: the Zod schema definitions belong in
`@repo/schemas` (the SSOT for types). Move them there; have `@repo/feedback` re-import
them from `@repo/schemas`; drop schemas' dependency on feedback. There is no circular risk
because feedback does not currently import anything from schemas (verified in §2).

### Why-built matrix (verified)

| Package | Why turbo builds it for the seed | Build kind | Needed by seed **at runtime** | Runs from `src/` under tsx? |
|---------|----------------------------------|-----------|-------------------------------|------------------------------|
| `@repo/config` | dep of db/billing/service-core/schemas | `tsup` (transpile) | yes | yes |
| `@repo/logger` | dep of db/service-core | `tsup` | yes | yes |
| `@repo/utils` | dep of schemas/service-core | `tsup` | yes | yes |
| `@repo/schemas` | direct dep of seed | `tsup --dts` | yes | yes |
| `@repo/feedback` | **transitive via schemas only** | `tsup` (4 entries, React/icons) | **no** (seed never touches feedback) | n/a — removed from chain by Front B |
| `@repo/icons` | transitive via feedback | `tsup` (React) | **no** | n/a — removed by Front B |
| `@repo/billing` | direct dep of seed | `tsup` | yes | yes |
| `@repo/media` | direct dep of seed | `tsup` | yes | yes |
| `@repo/db` | direct dep of seed | `tsup` (build is `tsup` only; drizzle-kit is a *separate* script, never invoked by build) | yes | yes |
| `@repo/service-core` | direct dep of seed | `tsup` | yes | yes |

The last column is the Front-A verification: **no dependency needs a dist-only artifact**;
all are pure-transpile `tsup` packages whose `src/index.ts` is self-sufficient. The
feedback + icons rows show that Front B *also* shrinks the seed build (and every other
schemas consumer's build) by pruning the React/icons subtree from the schemas graph.

## 2. Current architecture (verified facts)

| Concern | Location | State today |
|---------|----------|-------------|
| Seed entrypoint | `packages/seed/package.json` | `main`/`exports` → `./src/cli.ts` / `./src/index.ts`; `seed` script = `tsx ./src/cli.ts`; **no `build` script** |
| Seed tsconfig | `packages/seed/tsconfig.json` | extends `../typescript-config/package-base.json` |
| Shared path map | `packages/typescript-config/package-base.json` | **already declares `paths` for every `@repo/*` → `../<pkg>/src/index.ts`** (incl. db, schemas, service-core, billing, media, logger, utils, config, feedback) |
| hops build step | `scripts/server-tools/src/commands/db-seed.ts` `buildSeedDependencies()` | runs `pnpm turbo run build --filter=@repo/seed^...`; gated by `parsed.build` (default ON); `--no-build` escape exists |
| Local seed | root `package.json` `db:seed` | `pnpm --filter @repo/seed seed --reset --required --example` — relies on deps' `dist/` already existing OR being built by turbo |
| Schemas re-export | `packages/schemas/src/feedback.ts` | pure re-export from `@repo/feedback/schemas`; wired in `src/index.ts:6` (`export * from './feedback.js'`) |
| Schemas deps | `packages/schemas/package.json` | `@repo/feedback`, `@repo/utils`, `@repo/config`, `zod` |
| Feedback schema source | `packages/feedback/src/schemas/feedback.schema.ts` | pure Zod (no React, no icons); defines all 4 schemas + 5 enum const arrays + types |
| Feedback server schema | `packages/feedback/src/schemas/feedback.schema.server.ts` | `feedbackApiSchema` = `feedbackFormSchema.extend({ attachments: z.array(z.instanceof(Buffer)) })`; **only Node global is `Buffer`** — no `ua-parser-js`, no other Node dep |
| Feedback schema barrels | `packages/feedback/src/schemas/index.ts`, `server.ts` | `index.ts` re-exports from `feedback.schema.js`; `server.ts` re-exports `feedbackApiSchema` from `feedback.schema.server.js` |
| Feedback exports | `packages/feedback/package.json` | subpaths `.`, `./schemas`, `./schemas/server`, `./config`, `./styles.css`; tsup builds 4 separate entries (`index`, `schemas/index`, `schemas/server`, `config/index`), `external: ['react']` |
| Feedback deps | `packages/feedback/package.json` | `@repo/icons`, `react`, `react-dom`, `clsx`, `tailwind-merge`, `ua-parser-js`, `zod` — **does NOT depend on `@repo/schemas`** (no circular) |
| App deps on schemas/feedback/icons | `apps/{api,web,admin}/package.json` | all three depend on `@repo/schemas` + `@repo/feedback`; **API has NO `@repo/icons` dep** (icons reach it only transitively via schemas→feedback); web + admin do depend on icons directly |

### Verified: no circular dependency for Front B

`grep -rl "@repo/schemas" packages/feedback/src` → **NONE**. Feedback can take a new
dependency on `@repo/schemas` with zero cycle risk.

### Verified: the server schema variant is safe to relocate

`feedback.schema.server.ts` extends the client schema with `z.array(z.instanceof(Buffer))`.
`Buffer` is a Node global, available wherever `@repo/schemas` already runs server-side. No
`ua-parser-js` or other Node-only package is imported by either schema file, so moving them
into `@repo/schemas` introduces no new Node-only dependency. (`ua-parser-js` lives in
feedback's *runtime/component* code, not its schemas.) We preserve the client/server split
inside schemas to keep `Buffer` out of browser bundles.

### Verified: tsx does not resolve tsconfig `paths` automatically

The seed's tsconfig already inherits the full `@repo/*` → `src/` path map, but plain `tsx`
resolves bare specifiers through Node's resolver (workspace symlink → `exports` → `dist/`),
**not** through tsconfig `paths`. So the path map exists but is inert at seed runtime today.
Front A must explicitly opt the seed's `tsx` run into path-based resolution (e.g. a
dedicated tsconfig pointed at via `--tsconfig` / `TSX_TSCONFIG_PATH`, or a tsx resolution
plugin), scoped to the seed only so other `tsx` invocations in the repo are unaffected.

### Project rules that constrain this work

- `@repo/schemas` is the single source of truth for types/validation; changes there must be
  **additive-only** (no removed/renamed exported symbols) so consumers keep compiling.
- `@repo/feedback/schemas` and `@repo/feedback/schemas/server` are public subpaths consumed
  elsewhere; their exported symbols must remain importable after the move.
- The two migration carriles, soft-delete, `safeIlike`, etc. are unaffected (no DB schema
  change here).
- The seed wipes/loads real data; its correctness is non-negotiable and is the integration
  test for Front A.

## 3. Goals & non-goals

### Goals

1. **Front A** — `hops db-seed` runs the seed with **no build step**: `tsx` resolves every
   `@repo/*` dependency from its `src/` via tsconfig `paths`. Target build time for the seed:
   ~0s (down from ~30-60s cold).
2. Keep a documented `--build` escape hatch (today's behavior) in `hops db-seed` for any
   dependency that turns out to need a real build artifact, and for CI parity.
3. Verify and document, per dependency, that it runs from `src/` under tsx (the §1 matrix).
4. **Front B** — move the feedback Zod schema definitions into `@repo/schemas`, invert the
   dependency (feedback imports from schemas), and **drop `@repo/feedback` from
   `@repo/schemas`'s dependencies**, so no server-side build that depends on schemas pulls
   feedback + icons + React into its build graph.
5. Preserve every currently-exported symbol from both `@repo/schemas` and
   `@repo/feedback/schemas` / `@repo/feedback/schemas/server` (additive-only; consumers
   unaffected — only the definition location changes).
6. Confirm (and where feasible measure) that `@repo/api`'s build graph no longer includes
   `@repo/feedback`/`@repo/icons` *via schemas*, and that web/admin/seed builds shrink too.

### Non-goals (explicitly out of scope)

1. **Turbo remote cache** — a separate infra concern; not configured here.
2. **Compiling/bundling the seed into a single artifact** — rejected in favor of
   tsx-from-src; introduces a build we are trying to remove.
3. **Moving `config/` to the repo root** — that was BETA-58 / SPEC-188, not this spec.
4. **Changing what the seed actually seeds** — no data, fixture, or seed-logic changes.
5. **Removing `@repo/feedback` from the apps** — apps that render the feedback UI still
   depend on feedback directly (web/admin) and the API keeps `@repo/feedback/config`. Front
   B only removes feedback from the **`@repo/schemas`** dependency graph.
6. **Touching `@repo/icons`** — icons are pruned from the schemas graph by Front B, but
   icons itself is unchanged.

## 4. Functional requirements & acceptance criteria

### FR-1 — Seed resolves `@repo/*` from `src/` via tsconfig paths (Front A)

Opt the seed's `tsx` run into tsconfig-path resolution so bare `@repo/*` imports resolve to
each package's `src/index.ts` instead of `dist/index.js`. The path map already exists in
`packages/typescript-config/package-base.json`; the work is wiring tsx to honor it,
**scoped to the seed only** (a dedicated tsconfig the seed's run points at, or a tsx
resolution plugin in the seed package), so other `tsx` invocations elsewhere in the repo are
not affected.

```
Given none of the @repo/* dependency packages have a dist/ build present
  When `pnpm --filter @repo/seed seed` runs with the path resolution wired
  Then every @repo/* import resolves to that package's src/index.ts
  And the seed runs to completion against a real database with zero build

Given a tsx invocation OUTSIDE the seed in the same repo
  When it runs
  Then it still uses the default Node resolution (the path config is scoped to the seed)
```

### FR-2 — `hops db-seed` drops the build by default, keeps `--build` fallback

Update `scripts/server-tools/src/commands/db-seed.ts` so the default path no longer runs
`buildSeedDependencies()`. The `build` flag flips to **default OFF**; passing `--build`
re-enables the turbo build (the current default behavior) as a documented escape hatch. The
HELP text, flag summary, and the inline comments that currently justify the mandatory build
are updated to reflect the new model.

```
Given the operator runs `hops db-seed --target=staging`
  When the command executes
  Then it does NOT run `pnpm turbo run build --filter=@repo/seed^...`
  And the seed runs directly via tsx-from-src
  And the elapsed time excludes any dependency build

Given the operator runs `hops db-seed --target=staging --build`
  When the command executes
  Then it runs the turbo build first (today's behavior) as a fallback
  And then runs the seed

Given `--help`
  When printed
  Then the HELP text documents the no-build default and the --build fallback
```

### FR-3 — Per-dependency verification documented

Each of the seed's runtime `@repo/*` deps (config, logger, utils, schemas, billing, media,
db, service-core) is verified to run from `src/` under tsx and recorded in the §1 matrix. Any
dependency found to need a real build artifact is flagged as a blocker, kept on `--build`,
and documented with the reason.

```
Given the per-dependency verification is complete
  When the spec/closeout doc is read
  Then each dep is marked "runs from src" OR flagged with a concrete dist-only reason
  And any flagged dep is covered by the --build fallback
```

### FR-4 — Move feedback Zod schemas into `@repo/schemas` (Front B)

Relocate the schema **definitions** — `feedbackFormSchema`, `feedbackEnvironmentSchema`,
`feedbackErrorInfoSchema`, `feedbackInteractionSchema`, the server-only `feedbackApiSchema`,
the const arrays `REPORT_TYPE_IDS` / `SEVERITY_IDS` / `APP_SOURCE_IDS` / `DEVICE_TYPE_IDS` /
`COLOR_SCHEME_IDS` / `INTERACTION_EVENT_IDS`, and all inferred types — from
`packages/feedback/src/schemas/*` into `@repo/schemas`. Preserve the client/server split so
the `Buffer`-using `feedbackApiSchema` stays out of any browser bundle (e.g. a
`schemas/src/feedback.ts` for client + a server-only entry for the API schema).

```
Given the feedback schema definitions now live in @repo/schemas
  When @repo/schemas is built/typechecked
  Then it compiles with no dependency on @repo/feedback
  And it still exports every previously-exported feedback symbol (client) by the same names
  And the server-only feedbackApiSchema is exported from a server-scoped path, not the browser bundle
```

### FR-5 — Invert the dependency (feedback imports from schemas; schemas drops feedback)

`@repo/feedback` re-exports the relocated symbols from `@repo/schemas` (its `./schemas` and
`./schemas/server` barrels now re-export from `@repo/schemas` instead of local files). Add
`@repo/schemas` to `@repo/feedback`'s dependencies. **Remove `@repo/feedback` from
`@repo/schemas`'s dependencies.**

```
Given the dependency is inverted
  When the workspace dependency graph is inspected
  Then @repo/schemas no longer lists @repo/feedback as a dependency
  And @repo/feedback lists @repo/schemas as a dependency
  And there is no cycle (feedback → schemas only, never schemas → feedback)
```

### FR-6 — Preserve exported symbols (additive-only; consumers unaffected)

`@repo/schemas` keeps exporting the same feedback symbol names it exports today (via the
relocated definitions). `@repo/feedback/schemas` and `@repo/feedback/schemas/server` keep
exporting the same symbol names (now re-exported from schemas). No consumer import path or
symbol name changes.

```
Given any existing consumer of `import { feedbackFormSchema } from '@repo/schemas'`
  When the repo typechecks after the move
  Then the import still resolves with the identical type

Given any existing consumer of `import { feedbackApiSchema } from '@repo/feedback/schemas/server'`
  When the repo typechecks after the move
  Then the import still resolves with the identical type
```

### FR-7 — Confirm server builds no longer pull feedback/icons via schemas

After the inversion, building/inspecting the dependency graph of `@repo/api` shows
`@repo/feedback` and `@repo/icons` are no longer reachable **through `@repo/schemas`**. Where
feasible, measure the build-time delta for a clean schemas/API build before vs after.

```
Given the inversion is complete
  When `pnpm turbo run build --filter=@repo/schemas^...` is run
  Then @repo/feedback and @repo/icons are NOT in the build set
  And the same packages drop out of the seed's `@repo/seed^...` build set
```

> **Honest scope note.** The API keeps a *direct* `@repo/feedback` dependency (for
> `@repo/feedback/config`), so feedback may still appear in the API graph via that path.
> Front B's guaranteed, verifiable win is the removal of feedback/icons from the
> **`@repo/schemas`** graph (and therefore from every package that depends on schemas but
> not on feedback directly — notably the seed). Any further pruning of feedback from the API
> (e.g. moving `@repo/feedback/config` consumption) is out of scope here.

## 5. Phased implementation plan

Front B lands first: it is lower-risk, benefits *every* schemas consumer's build (including
the seed's), and makes Front A's per-dependency verification cleaner because the React/icons
subtree is already out of the seed's build set.

### Phase 1 — Front B: decouple `@repo/schemas` from `@repo/feedback`

1. Add the feedback schema definitions (client + server split, all symbols in §FR-4) to
   `@repo/schemas`, preserving names and types.
2. Re-point `@repo/schemas`'s feedback re-export at the new local definitions; keep
   `src/index.ts` exporting the same symbols.
3. Re-wire `@repo/feedback/schemas` and `@repo/feedback/schemas/server` to re-export from
   `@repo/schemas`; add `@repo/schemas` to feedback deps.
4. Remove `@repo/feedback` from `@repo/schemas` deps.
5. Typecheck the repo; run `@repo/schemas` and `@repo/feedback` test suites.

**Pause point:** schemas no longer depends on feedback; all symbols preserved; repo green.

### Phase 2 — Front A: seed runs from `src/` (no build)

6. Wire tsx path-resolution for the seed (dedicated tsconfig / resolution plugin), scoped to
   the seed package only.
7. Run the per-dependency verification (§FR-3) and fill the §1 matrix; flag any blocker.
8. Update `scripts/server-tools/src/commands/db-seed.ts`: `build` default OFF, `--build`
   fallback retained; update HELP, flag summary, and comments.
9. Run the seed end-to-end from `src/` against a real database (with no dep builds present)
   to prove FR-1/FR-2.

**Pause point:** `hops db-seed` runs with no build by default; `--build` still works.

### Phase 3 — Closeout & measurement

10. Measure seed time before/after and the schemas/API build-set delta (FR-7); record in the
    closeout doc.
11. Update the operational docs for `hops db-seed` if the operator flow changed
    (`scripts/server-tools` docs, `packages/seed/CLAUDE.md`).
12. Flip spec + task index to completed.

## 6. Risk and rollback

| Risk | Mitigation |
|------|------------|
| **A dependency secretly needs a dist-only artifact** (Front A) — a `@repo/*` package does build-time codegen or relies on a generated file | Per-dependency verification (§FR-3) before flipping the default; the `--build` fallback (§FR-2) re-enables the turbo build for that dep; rollback = pass `--build` / revert the hops change. §1 matrix already shows all ten are plain `tsup` with no codegen |
| **tsconfig `paths` leaking into other tsx runs** (Front A) | Scope the path-resolution config to the seed package only (dedicated tsconfig / seed-local plugin); acceptance test FR-1 asserts other tsx runs are unaffected |
| **Circular dependency if mis-wired** (Front B) | Verified feedback does not import schemas today; the inversion is one-directional (feedback → schemas); FR-5 acceptance asserts no cycle in the graph |
| **Schema symbol drift breaking consumers** (Front B) | Additive-only policy; keep every exported symbol name and type; FR-6 acceptance typechecks both `@repo/schemas` and `@repo/feedback/schemas[/server]` consumer import paths |
| **Server-variant Node dependency** (Front B) | `feedbackApiSchema` uses only the `Buffer` Node global (no `ua-parser-js` etc.); preserve the client/server split inside schemas so `Buffer` stays out of browser bundles |
| **Seed correctness regression** (Front A) | The existing seed flow against a real DB is the integration test; a successful reset+required+example run is the gate |

## 7. Testing strategy

Per the project's Test-Informed Development rules (Vitest, AAA, ≥90% coverage where
logic-bearing):

- **Front B — typecheck + existing suites:** `@repo/schemas` and `@repo/feedback` test
  suites still pass after the move; a repo-wide `pnpm typecheck` confirms no consumer broke
  (additive-only). If any schema parsing test lived in feedback, it moves with the
  definitions into schemas (regression-preserving).
- **Front B — graph assertion:** `pnpm turbo run build --filter=@repo/schemas^...` (or a
  graph dump) shows `@repo/feedback` / `@repo/icons` absent from the schemas build set
  (FR-7). A build of `@repo/api` is inspected to confirm feedback/icons are not reachable via
  schemas.
- **Front A — real seed run:** with no dependency `dist/` present, `pnpm --filter @repo/seed
  seed --reset --required --example` runs green against a real database (the canonical
  integration test for FR-1/FR-2).
- **Front A — hops behavior:** unit-level coverage of `parseArgs` / `formatFlagSummary` in
  `db-seed.ts` for the new default-OFF `build` flag and `--build` fallback; assert the build
  step is skipped by default and invoked with `--build`.
- **Regression:** any bug found while wiring path resolution or moving schemas gets a
  reproducing test before the fix.
- **Manual VPS smoke (Phase 3):** run `hops db-seed --target=staging` on the VPS and confirm
  it completes with no build and correct data, then `hops db-counts`.

## 8. Out-of-scope / future work

- Turbo remote cache (separate infra concern).
- Bundling/compiling the seed into a single artifact (rejected — reintroduces a build).
- Moving `config/` to the repo root (BETA-58 / SPEC-188).
- Any change to what the seed seeds.
- Further pruning of `@repo/feedback` from the API graph (the API keeps a direct
  `@repo/feedback/config` dependency).
- Touching `@repo/icons` internals.

## 9. Key file pointers

| File | Relevance |
|------|-----------|
| `scripts/server-tools/src/commands/db-seed.ts` | `buildSeedDependencies()`, `parseArgs`, `formatFlagSummary`, HELP — flip build default OFF, keep `--build` fallback |
| `packages/seed/package.json` | `seed` script (`tsx ./src/cli.ts`); add seed-scoped path-resolution wiring |
| `packages/seed/tsconfig.json` | extends `package-base.json` (already has the `@repo/*` → `src` path map) |
| `packages/typescript-config/package-base.json` | the shared `paths` map tsx must be made to honor for the seed |
| `packages/schemas/src/feedback.ts` | today re-exports from `@repo/feedback/schemas`; becomes the new home (client split) for the relocated definitions |
| `packages/schemas/src/index.ts` | line 6 `export * from './feedback.js'` — keep exporting the same symbols; add server-scoped export for `feedbackApiSchema` |
| `packages/schemas/package.json` | **remove** `@repo/feedback` from dependencies |
| `packages/feedback/src/schemas/feedback.schema.ts` | source of the relocated client schemas/enums/types |
| `packages/feedback/src/schemas/feedback.schema.server.ts` | source of the relocated `feedbackApiSchema` (Buffer) |
| `packages/feedback/src/schemas/index.ts` / `server.ts` | re-wire to re-export from `@repo/schemas` |
| `packages/feedback/package.json` | **add** `@repo/schemas` to dependencies |
| `packages/feedback/tsup.config.ts` | 4 entry points (`index`, `schemas/index`, `schemas/server`, `config/index`); confirm schemas entries still build after re-export |
| root `tsconfig.json` / `turbo.json` | verify build-graph / path behavior unaffected outside the seed scope |
| `apps/api/package.json` | consumer to inspect for FR-7 (icons reach it only via schemas today) |

## 10. Design decisions (locked)

1. **Seed runs from `src/` via tsx + tsconfig `paths`** (no build). The path map already
   exists in `package-base.json`; tsx is wired to honor it, **scoped to the seed only**.
2. **`hops db-seed` build flag flips to default OFF** with a retained `--build` escape
   hatch (today's behavior) for any dep that needs a real artifact and for CI parity.
3. **Front B inverts the dependency**: feedback Zod schema *definitions* move into
   `@repo/schemas`; `@repo/feedback` re-imports them; `@repo/schemas` drops its
   `@repo/feedback` dependency. No cycle (verified feedback never imports schemas).
4. **Additive-only**: every exported symbol from `@repo/schemas` and
   `@repo/feedback/schemas[/server]` is preserved by name and type; only the definition
   location changes — consumers are untouched.
5. **Client/server split preserved inside schemas**: `feedbackApiSchema` (uses the `Buffer`
   Node global) is exported from a server-scoped path so it never enters a browser bundle.
6. **Front B lands before Front A**: lower risk, benefits all schemas consumers, and removes
   the React/icons subtree from the seed's build set before Front A's verification.
7. **No seed-data, no DB-schema, no app-feedback-UI changes** — pure build/dependency
   refactor.
