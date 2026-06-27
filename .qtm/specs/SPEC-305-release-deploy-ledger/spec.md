---
specId: SPEC-305
title: Release Deploy Ledger (Env-Var + Merged-Spec Tracking)
type: chore
complexity: medium
status: draft
created: 2026-06-27
tags: [devops, deploy, env, release, tracking, devx]
---

# SPEC-305 — Release Deploy Ledger (Env-Var + Merged-Spec Tracking)

> Maintain a running artifact that tells you — at release time — exactly which env
> vars to touch on the VPS and which specs entered staging since the last deploy.
> No more hand-auditing 50 merged PRs and 30+ env changes per release.

## 1. Summary

Every time we release (staging → main → Coolify deploy), two questions must be
answered manually today:

1. Which env vars were added, removed, or modified since the last deploy? What are
   the exact `hops env-set` commands for staging and prod?
2. Which specs or changes merged to staging? What should be smoke-tested on the VPS
   before promoting to main?

There is no single artifact to consult. The answer is scattered across merged PRs,
`env-registry.*.ts` diffs, Coolify dashboards, individual spec docs, and tribal
memory. This spec introduces a **release/deploy ledger** — one or more maintained
artifacts that consolidate both tracks so that deploy prep is a read, not an
investigation.

## 2. Problem — why this is a real, repeated pain

### 2.1 Env-var gap

The env-registry (`packages/config/src/env-registry.*.ts`) is the canonical list of
all variables and their metadata. But **a registry diff alone is insufficient** for
deploy-prep:

- **Build-time Docker ARGs** can be newly wired in a Dockerfile without touching the
  registry (e.g. `SENTRY_AUTH_TOKEN` — registered early, `ARG` only added to the
  Dockerfile during SPEC-180, would have silently failed source-map upload without
  an audit of the Dockerfile diffs). Filed as **BETA-100**.
- **Direct `process.env.X` reads** bypass the registry entirely
  (`ALLOW_PLACEHOLDER_ENV_URLS`, `ANALYZE`, `CI` flags read in build scripts and
  `turbo.json` globalEnv).
- **Optional-to-required drift** in app Zod schemas (`apps/api/src/utils/env.ts`)
  where `required` metadata in the registry did not track a `.optional()` removal —
  `HOSPEDA_NEWSLETTER_HMAC_SECRET` is the documented case, which would have failed
  API boot unnoticed until deploy. Filed as **BETA-101**.
- **Admin `VITE_*` build-args** (e.g. `VITE_ADMIN_URL`) are baked into the bundle
  at Docker build time, not read at runtime — the registry categorizes them correctly
  but no tooling tells you "this must be set as a Coolify build-arg, not just a
  runtime env var". Open as **BETA-101**.

The documented mitigation today (engram `project_env_audit_for_deploy`) is to diff
`apps/*/env.ts` + all three `apps/*/Dockerfile` + build configs + `turbo.json`
globalEnv + `rg "process.env."` on every release. That is a 20-30 minute audit
that silently varies per engineer. The ledger replaces it with an incremental record
maintained at the point of change.

### 2.2 Merged-spec gap

Three artifacts already track spec status:

- `.qtm/specs/index.json` — source of truth for spec status
- `.qtm/tasks/index.json` — task progress mirror
- `specs-prioritization.csv` — owner-facing prioritization board

A spec's `status` flips to `completed`/`archived` when its work merges. But the
status flip says nothing about: what the spec changed, what to test on staging, or
what VPS operations it requires. Constructing a "what shipped this cycle" list means
diffing the JSON index against last-release state — doable, but not automatic, and
the test/smoke-test notes live nowhere consolidated.

### 2.3 Current workflow (missing the ledger layer)

The CLAUDE.md "Adding a new environment variable" workflow (5-8 steps: register →
Zod validate → `.env.example` → `pnpm env:check:registry` → set in Coolify via
`hops env-set <kind> KEY VALUE`) covers the **per-change** mechanical steps but has
no **accumulation** step. Nothing records "this PR adds `HOSPEDA_FOO` to `api`
(secret, required in prod)" in a cross-release ledger. Each release has to
reconstruct that list from scratch.

### 2.4 Key files (current system)

- Registry: `packages/config/src/env-registry.*.ts` (split by category: hospeda,
  api-config, client, docker-system, mobile). Each entry has `name`, `apps`,
  `required`, `requiredScope`, `secret`, `type`, `defaultValue`, `deprecated`, etc.
- CI gate: `pnpm env:check:registry` (three per-app vitest suites in
  `packages/config/src/__tests__/`)
- VPS env ops: `hops env-set <kind> KEY VALUE`, `hops redeploy <kind>`,
  `hops env-list <kind>`; documented in `docs/guides/env-management.md`
- Coolify apps: `hospeda-{api,web,admin}-{staging,prod}` (6 total)
- Spec index: `.qtm/specs/index.json`, `.qtm/tasks/index.json`,
  `specs-prioritization.csv`
- App Zod schemas: `apps/api/src/utils/env.ts`, `apps/web/src/utils/env.ts`,
  `apps/admin/src/utils/env.ts`
- Dockerfiles: `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/admin/Dockerfile`

## 3. Goals (provisional — subject to OQ-1 decision)

- **G-1** A human-readable **env-var delta log**: for every change window (since last
  deploy), records each variable that was added, removed, modified, or had its
  `required`/`secret`/scope changed — including Docker ARG wiring and
  optional-to-required drift that the registry CI gate does not catch.
- **G-2** Each env delta entry carries enough information to execute the VPS action
  without re-investigation: app(s), kind (`add`/`remove`/`modify`/`required-flip`),
  whether secret, whether build-time vs runtime, the exact `hops env-set` command or
  Coolify build-arg instruction.
- **G-3** A **merged-to-staging log**: for every spec/change that entered staging since
  the last release, a record of what it touched, what to smoke-test on the VPS, and
  whether it requires Coolify env changes or migration steps.
- **G-4** At release time, reading ONE artifact (or a small set) is sufficient to
  produce the deploy runbook. The artifact should be actionable without cross-referencing
  half a dozen merged PRs.
- **G-5** The process must be **low-friction at write time**: a developer merging a PR
  that adds an env var should be able to update the ledger in under 2 minutes, without
  a ceremony that will be skipped under pressure.
- **G-6** The mechanism must capture **non-registry env changes** (Dockerfile ARGs,
  build-config reads, optional-to-required Zod drifts) — the registry diff is
  necessary but not sufficient.

## 4. Non-Goals

- Not a user-facing changelog (that is the `generate-changelog` skill's domain).
- Not an automated deploy pipeline (Coolify deploy remains a manual button click per
  policy; this ledger is the input to the human who clicks).
- Not replacing `pnpm env:check:registry` (that CI gate stays; the ledger complements
  it for deploy-time ops, not for build-time correctness).
- Not implementing `hops` commands to auto-apply the ledger to Coolify (possible
  follow-up; out of scope here).
- Not auto-detecting Dockerfile ARG diffs via CI (possible Phase 2; Phase 0 is
  discovery, not implementation).

## 5. First Steps / Discovery Plan

This is a **discovery-first** spec. The implementation is intentionally open until
the owner reviews the options in Section 6 and the open questions. Phase 0 is
research and process decision; no code is written until the owner picks an approach.

### Phase 0 — Research and process decision (owner input required)

1. **Audit existing sources**: map every location where env-var changes can originate
   today that the registry CI gate does NOT catch (Dockerfiles, build configs,
   `process.env` direct reads, Zod optional-to-required flips). Quantify how many
   "invisible" changes happened in the last 10 merged specs.
2. **Explore auto-derivation feasibility**: can a script diff `env-registry.*.ts` +
   Dockerfiles + `apps/*/env.ts` between two git refs (last-deploy tag/SHA and HEAD)
   and produce a draft ledger automatically? Assess accuracy and blind spots.
3. **Review existing tooling**: the `generate-changelog` skill and any existing
   release-note scripts. Confirm there is no partial solution already in place.
4. **Owner decision**: present two or three approaches (manual, auto-derived, hybrid)
   with friction and reliability tradeoffs (OQ-1). Owner picks the mechanism and the
   artifact location before implementation starts.

### Phase 1 — Implementation (after owner decision on OQ-1 to OQ-4)

Implement the chosen mechanism and integrate it into the PR workflow / CLAUDE.md
add-env-var procedure and the spec close-out workflow.

## 6. Design Options (to be decided — see Open Questions)

Three approaches to maintaining the ledger:

### Option A — Manual, incremental, per-PR

The developer who opens a PR that changes an env var (or closes a spec) writes a
short entry to a tracked `DEPLOY-LEDGER.md` (or `docs/deploy-ledger/`) as part of
the same PR. A CLAUDE.md rule and possibly a CI lint check enforce the discipline.

- **Pro**: captures everything, including non-registry changes; zero tooling to build.
- **Con**: relies on discipline; forgettable under deadline pressure; no CI to enforce
  env-change entries; maintenance burden grows with team size.

### Option B — Auto-derived at release time

A script (`scripts/gen-deploy-ledger.sh`) diffs two git refs, scanning
`env-registry.*.ts`, `apps/*/env.ts` (Zod schema), and all three Dockerfiles to
produce a draft ledger on demand. The spec-track derives from spec-index JSON diffs.
The draft is reviewed and annotated by the owner before the deploy.

- **Pro**: zero per-PR friction; nothing to forget during development.
- **Con**: misses `process.env` direct reads and logic-conditional requires; the
  "last deploy" ref must be tracked (a git tag or a `LAST_DEPLOY_SHA` file); draft
  still needs human annotation before use.

### Option C — Hybrid (recommended starting point)

Auto-derive a draft from git diffs (Option B) for the structural sources, AND add a
lightweight per-PR `[ledger]` section to the PR description (or a small YAML/JSON
append file) for the non-derivable cases (Dockerfile-only changes, `process.env`
reads, optional-to-required Zod flips). The `gen-deploy-ledger` script merges both
sources into a final artifact when the release is cut.

- **Pro**: structural changes are never missed; non-structural changes have a captured
  signal; less per-PR overhead than full manual.
- **Con**: two maintenance points; the append-file discipline still requires rigor.

## 7. Risks

- **R-1** — **Process discipline gap**: any manual step in the ledger (Option A or C)
  can be skipped. Without a CI gate that BLOCKS merge on a missing ledger entry, the
  record will have holes. Designing such a gate for "env var was added" is non-trivial.
- **R-2** — **Non-registry blind spots persist**: even Option B auto-derivation misses
  `process.env.X` direct reads in build scripts. If those are rare, tolerable; if they
  accumulate, a secondary `rg "process.env\."` diff step needs to be scripted.
- **R-3** — **Last-deploy ref tracking**: auto-derivation requires knowing the exact
  git SHA or tag of the last deploy. If Coolify deployments are not tagged in git,
  this must be inferred (last merge to main? a manually-created `LAST_DEPLOY` file?
  a git tag the release step creates?).
- **R-4** — **Two-environment complexity** (staging / prod): env vars may differ
  between staging and prod (different secrets, different `SENTRY_ENVIRONMENT` values).
  The ledger must represent per-environment actions, not just per-var changes.
- **R-5** — **Scope creep into full deploy-automation**: the ledger is an ops document,
  not a deploy runner. If it starts driving `hops env-set` calls directly, it crosses
  into deploy automation (a different, larger scope).

## 8. Open Questions

- **OQ-1** — **Manual vs auto-derived vs hybrid** (owner decision): which Option (A/B/C)
  fits the team's discipline and tooling appetite? This is the primary architectural
  fork — nothing else can be decided until OQ-1 is answered.
- **OQ-2** — **Where does the ledger live?** A rolling `docs/release-ledger/` directory
  with one file per release? A single `DEPLOY-LEDGER.md` at the repo root? A
  section appended to each spec's `spec.md` at close-out? Outside the repo (like
  SPEC-304's standalone tracker)? In Coolify as release notes? The location affects
  who can read it, whether it survives branch switches, and how it is versioned.
- **OQ-3** — **Granularity of the env-var action**: is it enough to record "add
  `HOSPEDA_FOO` to `api` (secret)" or does each entry need the literal `hops env-set`
  command pre-filled, including per-environment values? The latter is more actionable
  but requires the developer to know the prod value at write time (which may not
  happen until deploy day).
- **OQ-4** — **When is the ledger "cut" / reset?** Options: (a) per merge to staging
  (rolling window); (b) per promotion staging → main; (c) per Coolify deploy trigger
  (requires a git tag at deploy time); (d) manually, when the owner decides. Each
  changes who maintains the "window start" and how far back the diff must reach.
- **OQ-5** — **How is the merged-to-staging track produced?** Deriving it from
  `specs/index.json` status flips (automated) vs a hand-kept release note per spec
  close-out (manual) vs a GitHub API query for merged PRs into staging since a date.
  The automated option only works if every relevant change goes through the spec
  workflow, which is not always true for `[NOSPEC:*]` PRs.
- **OQ-6** — **What does "what to smoke-test" link to?** The existing billing
  staging-smoke checklist (`.qtm/specs/SPEC-143.../staging-smoke-checklist.md`)?
  A per-spec `smoke-notes` field in `spec.md`? A generic "changed: billing/auth/
  web/admin/api" tag that maps to a checklist? The answer affects whether smoke-test
  notes are written by spec authors or inferred.
- **OQ-7** — **Can a CI check enforce that a registry diff triggers a ledger update?**
  The `pnpm env:check:registry` gate catches schema-registry drift, but there is no
  gate that says "you changed `env-registry.hospeda.ts` without updating the ledger".
  Is such a gate feasible and worth the implementation cost, or is process/review
  discipline the answer?
- **OQ-8** — **Relationship to `hops`**: should a Phase-2 follow-up add a
  `hops release-apply-ledger` command that reads the artifact and executes the
  `env-set` / `redeploy` calls? Or is the ledger always human-executed?
- **OQ-9** — **Two-environment entries**: staging and prod often need different values
  (different secrets, different SENTRY env tags). Should the ledger have separate
  `staging:` and `prod:` entries per var, or a single entry with a "repeat for prod"
  note?

## 9. Relationship to Existing Systems

- **`packages/config/src/env-registry.*.ts` + `pnpm env:check:registry`**: the
  registry is the struct-level source of truth for env vars. The ledger adds a
  temporal dimension: "what changed since the last deploy". The CI gate catches
  schema-registry drift but not deploy-ops implications. Both coexist.
- **CLAUDE.md "Adding a new env var" workflow**: the existing 8-step add-env-var
  process covers the per-change mechanics. SPEC-305 adds a step 9 (or integrates a
  ledger-append into step 3/4): record the change in the ledger at the time of the
  PR, not at deploy time.
- **`hops env-set` / Coolify**: the ledger's output is the input to `hops env-set`.
  The ledger does not replace `hops`; it replaces the ad-hoc investigation of what
  to pass to `hops`.
- **`.qtm/specs/index.json` / `.qtm/tasks/index.json` / `specs-prioritization.csv`**:
  the three spec-sync artifacts track spec status but not deploy implications. The
  merged-to-staging track in the ledger can derive its spec list from these sources
  (status flips to `completed`/`archived`) but adds the "what to test / what env
  actions" dimension that the index files do not carry.
- **`generate-changelog` skill**: that skill generates a user-facing changelog from
  git history (Keep-a-Changelog format, semantic version bumps). The deploy ledger is
  an **ops document** aimed at the person clicking the Coolify deploy button — it is
  not a user-facing release note. The two artifacts are complementary and should not
  be merged.
- **SPEC-304 (Standalone Spec-Prioritization Tracker)**: SPEC-304 extracts the
  spec-prioritization board to survive branch switches. The deploy ledger is a
  different artifact (release-scoped, env-ops-focused) but may benefit from the same
  "lives outside the repo" consideration (OQ-2). Coordinate with SPEC-304 on the
  external-file pattern if OQ-2 resolves to "outside the repo".
- **Engram `project_env_audit_for_deploy` memory**: the current documented mitigation
  (audit Dockerfiles + `env.ts` + build configs + `rg process.env`) is exactly what
  SPEC-305 aims to replace with a maintained artifact. That memory entry is the
  evidence baseline for why the registry diff alone fails.

## 10. Revision History

- 2026-06-27 — Initial draft (allocated SPEC-305). Discovery-first: three design
  options laid out (manual / auto-derived / hybrid); nine open questions deferred to
  owner review; primary fork is OQ-1 (mechanism choice). Env-gap evidence anchored to
  BETA-100/101/102 and engram `project_env_audit_for_deploy`. No implementation until
  Phase 0 research + owner decision on OQ-1.
