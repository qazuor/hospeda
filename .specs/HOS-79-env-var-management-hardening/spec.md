---
title: Env Var Management Hardening — Registry Completeness, Reconciliation, and Guided Setup
linear: HOS-79
statusSource: linear
created: 2026-07-03
type: chore
areas:
  - devops
  - api
  - web
  - admin
---

# Env Var Management Hardening — Registry Completeness, Reconciliation, and Guided Setup

## 1. Summary

Close three concrete gaps in the existing env-var management system (registry
in `packages/config/src/env-registry.*.ts` → per-app Zod schemas →
`.env.local`/Coolify values): the registry can silently miss real vars used by
shared packages; nothing reconciles "what should be set" against "what
actually is set" locally or in Coolify; and filling gaps in a fresh worktree
or after a spec merges is fully manual.

## 2. Problem

A real incident (a secret set via `hops env-set --target=prod` was suspected
of landing in the wrong place) led to a design review that surfaced three
gaps with concrete proof:

1. **Registry completeness**: `pnpm env:check:registry` only cross-validates
   each app's Zod schema against the registry. Several shared packages
   (`service-core`, `media`, `billing`) read `process.env.X` directly,
   bypassing every app schema. Proven with 3 real, currently-unregistered
   vars: `HOSPEDA_TAG_USER_QUOTA_PER_USER`
   (`packages/service-core/src/services/tag/tag.service.ts:241`),
   `HOSPEDA_DEPLOY_ENV` (`packages/media/src/server/environment.ts:43`),
   `HOSPEDA_QZPAY_TEST_CONTROL_ENABLED`
   (`packages/billing/src/adapters/qzpay-test-control.ts:77` — actively used
   by the worktree bootstrap, yet absent from the registry).
2. **Reconciliation**: nothing checks whether every registry-required var
   actually has a value, neither locally (`.env.local`) nor in Coolify
   (prod/staging) — today it's a fully manual quarterly spot-check. There is
   also no automated cross-app consistency check: `HOSPEDA_REVALIDATION_SECRET`
   is `z.string().min(32)` hard-required in `apps/api/src/utils/env.ts:369`,
   but `z.string().min(32).optional()` in `apps/web/src/env.ts:34` (enforced
   only in production via a `.refine` at lines 157-169) — both must hold the
   SAME VALUE for the revalidation webhook handshake to work, and nothing
   verifies that today.
3. **Guided setup**: setting up a fresh worktree or applying newly-registered
   vars to Coolify after a spec merges is fully manual.

## 3. Goals

- G-1: any `process.env.X` read anywhere in `apps/` or `packages/` that has no
  matching registry entry is caught automatically (CI + local).
- G-2: a single command reports exactly which registry-required vars are
  missing from a local `.env.local` set, or from Coolify for a given target.
- G-3: cross-app value-consistency rules (e.g. a shared secret) are checked
  automatically, both locally and against Coolify, without false-positiving
  on normal partial/dev-only configurations.
- G-4: an operator can be walked through exactly the missing vars (not the
  full ~224-entry registry) with contextual help for secrets.

## 4. Non-goals

- NG-1: making `hops` (the VPS ops CLI) laptop-portable in general — a
  separate, valuable change (replacing `container-lookup.ts`'s local-docker
  UUID resolution with Coolify's `listApplications()` API) affecting every
  existing hops command, not scoped to env tooling. Candidate follow-up.
- NG-2: changing `requiredScope`/`requiredWhen` semantics or any existing
  registry entry beyond what's needed to register the 3 known-missing vars
  and support the new cross-check rules.
- NG-3: generating Zod schemas FROM the registry (the inverse direction) —
  only read-only introspection of existing schemas is in scope.
- NG-4: migrating `apps/web` to `astro:env` — tracked separately in Linear
  (draft evaluation, not yet decided; see Open Questions).

## 5. Current baseline

Three layers: **Registry** (`packages/config/src/env-registry.*.ts`, typed by
`env-registry-types.ts` — fields include `requiredScope`, `requiredWhen`,
`secret`, `howToObtain`, `helpUrl`, already sufficient for a wizard's
secret-hint needs, no new field required); **Schema** (per-app Zod, each app's
`env.ts` splits a plain `*BaseSchema` from a `.superRefine`/`.refine`-wrapped
schema so `.shape` stays enumerable for the existing cross-validation tests);
**Values** (`.env.local` locally, Coolify env vars in prod/staging).

Existing tooling: `pnpm env:check:registry` (3 vitest suites comparing each
app's `*BaseSchema.shape` keys against the registry), and `pnpm env:check:examples`
plus `pnpm gen:env-examples` (generates the 4 `.env.example` files from the
registry, with a guard test that re-implements the generator's logic inline
rather than importing it — the generator's `main()` runs unconditionally at
module load with no guard). `hops env-list/env-set/env-delete/env-pull`
(VPS ops CLI, `scripts/server-tools` — a standalone bun package, explicitly
NOT in `pnpm-workspace.yaml`, cannot import `@repo/config` directly). `hops`
only works when run ON the VPS today (confirmed via `runner.ts`'s documented
V1-LocalRunner-only limitation — container resolution needs local `docker
inspect`); `hops update` confirms a full monorepo checkout exists at
`~/hospeda` on the VPS via `git pull`.

## 6. Proposed design

Two execution contexts, split by dependency profile:

**A. Local/CI world** (`packages/config`, pnpm, vitest — zero network):

| Command | Purpose |
|---|---|
| `pnpm env:check:usage` | Scans `apps/**/src` + `packages/**/src` (excl. `test/dist/docs/scripts`) for `process.env.X`, diffs vs registry both directions. |
| `pnpm env:check:local` | Reads each app's `.env.local`, diffs vs registry filtered by `apps` + `requiredScope` (production-scoped vars not required locally). |
| `pnpm env:check:rules` | Evaluates cross-check rules against local `.env.local` values, filtered to `appliesTo` including `'local'`. |
| `pnpm env:doctor` | Umbrella: runs the three above. |
| `pnpm env:set [--review-all]` | Interactive wizard over `.env.local`, gaps-only by default. |

**B. VPS world** (`hops`, bun, Coolify API — existing V1 docker-bound
limitation, unchanged):

| Command | Purpose |
|---|---|
| `hops env-reconcile <api\|web\|admin> --target=<prod\|staging>` | Diffs registry (requiredScope-aware per target) vs live Coolify env vars, reusing the existing `coolify.ts` client + `container-lookup.ts`. |
| `hops env-check-rules --target=<prod\|staging> [--app=<api\|web\|admin>]` | Same rule engine against live Coolify values, filtered to `appliesTo` including `'coolify'`. No mandatory app positional — `--app` is an optional filter, since a rule can span 2 apps. |
| `hops env-doctor <api\|web\|admin> --target=<prod\|staging>` | Umbrella: reconcile + check-rules. |
| `hops env-set --wizard [--review-all]` | VPS wizard variant, extends the existing `env-set` command. |

**C. Shared JSON bridge** — `packages/config/generated/env-registry.json`,
committed to git, generated by a NEW sibling script
`scripts/generate-env-registry-json.ts` (kept separate from
`generate-env-examples.ts`'s `main()`, which has unconditional side effects
at module load). Contains the full registry, hand-authored cross-check rules
(`packages/config/src/env-cross-checks.ts`), and Zod-introspected constraint
shapes (enum options, boolean, numeric min/max) for the wizard's prompts.
`hops` reads this JSON as plain data from the VPS's `~/hospeda` checkout —
zero TypeScript parsing, zero pnpm/node_modules dependency there.

**Blocker found and resolved**: introspecting each app's real Zod schema
requires importing it, but 3 of 4 apps' `env.ts` are unsafe to import from a
plain root script (`apps/api`'s runs `dotenv.config()` with cwd-guessing at
module top level; `apps/admin/src/env.ts:7` imports `adminLogger` via the
Vite-only `@/` path alias — confirmed unresolvable outside Vite;
`apps/mobile/src/lib/env.ts:21` imports `expo-constants`, unsafe under plain
Node/tsx). **Fix**: extract a pure, zero-non-zod-import schema file per app
(`apps/api/src/utils/env-schema.ts`, `apps/web/src/env-schema.ts`,
`apps/admin/src/env-schema.ts`, `apps/mobile/src/lib/env-schema.ts`); each
app's `env.ts` re-exports from it. `apps/web/src/env.ts` is already clean.

## 7. Data model / contracts

Cross-check rule shape (`packages/config/src/env-cross-checks.ts`):

```ts
interface CrossCheckRule {
  readonly id: string;
  readonly description: string;
  readonly appliesTo: readonly ('local' | 'coolify')[];
  readonly comparator: 'equals'; // explicit literal — the bun consumer has no TS comments
  readonly compare: readonly { app: AppId; key: string }[];
}
```

Evaluation produces a three-state result — `'pass' | 'fail' | 'partial'`,
never a boolean. `'partial'` (at least one side unset) is non-failing
everywhere, including Coolify+prod — presence gaps are `env:check:local`'s /
`env-reconcile`'s job, not this check's. First seeded rule:
`HOSPEDA_REVALIDATION_SECRET` must match between `api` and `web`.

Generated JSON shape (`packages/config/generated/env-registry.json`):

```ts
{
  registry: EnvVarDefinition[],
  crossChecks: CrossCheckRule[],
  constraints: Record<string, { enumValues?: string[]; boolean?: true; numeric?: { min?: number; max?: number } }>
}
```

No database migrations. No new external dependencies (`@clack/prompts`,
`zod`, `vitest` are all already used in the workspace).

## 8. UX / UI behavior

CLI-only, no UI surface. Every check exits non-zero on failure with an
actionable message (file:line for usage gaps, app+key for local/Coolify gaps,
rule id + which side is missing for rule failures). A missing `.env.local`
is treated as "everything required is absent," never a crash. The wizard
(`pnpm env:set` / `hops env-set --wizard`) prompts ONLY for flagged gaps by
default; `--review-all` walks every entry with keep/change, redacting secret
current values. Enum entries get a select; numeric entries with introspected
bounds get input validation; secret entries show `howToObtain`/`helpUrl`
before prompting.

## 9. Acceptance criteria

- AC-1: `pnpm env:check:usage` fails, naming file:line, for any
  `process.env.X` used in scope with no matching registry entry; passes
  once `HOSPEDA_TAG_USER_QUOTA_PER_USER`, `HOSPEDA_DEPLOY_ENV`,
  `HOSPEDA_QZPAY_TEST_CONTROL_ENABLED` are registered (regression test for
  the bug that motivated this spec).
- AC-2: `pnpm env:check:local` fails naming app+key when an
  `requiredScope: 'always'` var is missing from that app's `.env.local`;
  does NOT fail when a `requiredScope: 'production'` var is missing locally.
- AC-3: `pnpm env:check:rules` / `hops env-check-rules` report `fail` when
  `HOSPEDA_REVALIDATION_SECRET` differs between api and web, `partial`
  (non-failing) when only one side is set, `pass` when equal.
- AC-4: `hops env-reconcile <app> --target=<env>` reports every
  registry-required-for-that-target var missing from live Coolify env vars
  for that app.
- AC-5: if one app's container is unreachable, `hops env-check-rules`
  reports that specific rule as `skipped: container unreachable` and still
  evaluates every other rule — one broken app never blanks the whole report.
- AC-6: the default wizard invocation (no flags) prompts ONLY for entries
  flagged as gaps — never all ~224 registry entries; `--review-all` walks
  every entry with keep/change.

## 10. Risks

- R-1: a Linear item (draft evaluation, not yet decided) proposes migrating
  `apps/web` off its custom Zod layer to `astro:env`. Low impact — it
  explicitly keeps the `@repo/config` registry valuable regardless of
  outcome; only `apps/web/src/env-schema.ts`'s introspection source would
  need rework if it proceeds.
- R-2: implementing the cross-check rule engine as a boolean instead of the
  required 3-state result would false-positive on every fresh dev checkout
  where an optional secret is legitimately unset. Mitigation: AC-3 mandates
  the 3-state result with a dedicated test case.
- R-3: `env-check-rules` on the VPS could crash the whole run if one
  referenced app's container is unreachable. Mitigation: AC-5, per-rule
  try/catch + `(app,target)→uuid` memoization within a run.
- R-4: a future edit could silently re-import a non-pure dependency into one
  of the 4 `*-env-schema.ts` files, breaking VPS-side generation. Mitigation:
  a guard test asserts zero non-`zod` imports in those 4 files.

## 11. Open questions

- OQ-1: should the Sentry-environment-tagging manual check (documented in
  `docs/guides/env-management.md`) be added as a `hops env-check-rules` rule
  within this spec's scope, or tracked as an immediate follow-up? Leaning
  follow-up unless implementation time allows.
- OQ-2: does CI need `env:check:local`/`env:check:rules` wired in with
  placeholder `.env.local`-equivalents, or does `env:check:usage` alone
  suffice as the CI gate (current lean: usage-only, since CI has no real
  `.env.local`)?

## 12. Implementation notes

Phased breakdown (see `tasks/` for the full atomic task list, 25 tasks,
complexity ≤3 each, critical path `T-003 → T-011 → T-015 → T-017 → T-022`):

1. **Setup** — spike on registry type completeness (expected: none needed);
   register the 3 known-missing vars; extract the 4 pure `*-env-schema.ts`
   files.
2. **Core** — `env:check:usage`, `env:check:local`, `env-cross-checks.ts`,
   `env:check:rules`, the JSON generator + guard test, `env:doctor` wiring.
3. **Integration** — extract `lib/repo-root.ts`; `hops env-reconcile`,
   `env-check-rules`, `env-doctor`; the local + VPS wizard variants.
4. **Testing & docs** — regression test for the 3 known-missing vars; full
   test/typecheck passes across `packages/config`, `scripts/server-tools`,
   and the 4 apps; wire CI; update `docs/guides/env-management.md`.

Testing strategy: fixture-driven unit tests per check (see AC-1 through
AC-6 above, each maps to at least one test case); a mocked `coolify.ts`
client for the VPS-side commands (reusing whatever mock pattern the existing
`env-list`/`env-set` tests already use, if any); the JSON guard test follows
the exact re-implementation convention `env-examples.guard.test.ts` already
uses (duplicate logic inline, don't import the generator).
