---
spec-id: SPEC-179
title: Self-Hosted Runner for PR CI (GitHub Actions cost/quota reduction)
type: infra
complexity: medium
status: approved
created: 2026-06-01T00:00:00Z
references:
  - .github/workflows/ci.yml (current PR + push CI, all ubuntu-latest)
  - .github/workflows/e2e-pr.yml (Playwright P0, PR-to-main only)
  - .github/workflows/e2e-nightly.yml (full E2E, workflow_dispatch only)
  - docs/guides/env-management.md
---

# SPEC-179 — Self-Hosted Runner for PR CI

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal.** Move the heavy **Pull-Request CI** of the `hospeda` monorepo off GitHub-hosted runners
and onto a **single self-hosted runner running on the owner's personal laptop**, so that PR CI
**stops consuming the private-repo GitHub Actions minute quota entirely**. Deploys, releases, and
push-to-`main`/`staging` CI stay on GitHub-hosted runners.

**Why.** The repo is **private**. On the GitHub Free plan a private repo gets **2000 Actions
minutes/month**. The owner confirms the quota **runs out fast**. Measured evidence: `ci.yml` fired
**185 runs in 4.5 days (~41/day)**, each with ~6 minute-consuming Linux jobs. Self-hosted runner
minutes are **free and unlimited on private repos** and do **not** count against the GitHub-hosted
quota. Moving PR CI to a self-hosted runner therefore removes PR CI from the billing equation
completely — it is not "cheaper", it is "off the meter".

**Non-goals.**
- NOT moving any deploy/release to self-hosted (there are none in Actions — deploys live in Coolify;
  the `deploy:*` npm scripts `process.exit(2)`).
- NOT running self-hosted CI for public repos (this repo is private; the policy is private-only).
- NOT fixing the pre-existing red CI baseline (the `Build all packages and apps` failure that forces
  admin-override merges) — that is a separate problem this spec does not address.
- NOT auto-triggering the E2E suite on `staging` PRs (would add NEW quota cost; see §4.3).

### 2. Current-state analysis (factual, measured 2026-06-01)

Repo: `qazuor/hospeda`, **private**, default branch `main`, `allow_forking: true`.

**Workflow inventory (5 files, zero deploy/release):**

| Workflow | Triggers | Jobs (all `ubuntu-latest`) | Class |
|---|---|---|---|
| `ci.yml` | `pull_request` [main,staging] + `push` [main,staging] + `workflow_call` | lint, security, guards, build, typecheck, 4× test-unit shards, test-integration, coverage-check, ci-pass (9 logical jobs) | CI-PR **+** CI-push mixed |
| `e2e-pr.yml` | `pull_request` [main] | e2e-p0 (Playwright + postgres/redis/mailpit services) | CI-PR, low volume |
| `e2e-nightly.yml` | `workflow_dispatch` (cron disabled) | e2e-full | On-demand |
| `docs.yml` | PR/push on `docs/**` paths | lint, check-links, validate-examples | CI-PR, light |
| `validate-docs.yml` | PR/push on `.claude/**` paths | validate-documentation | Light |

**Key facts:**
- All jobs use `ubuntu-latest`. No job is on self-hosted today.
- **No job has an explicit `permissions:` block** → all inherit repo defaults (too broad).
- Only `ci.yml` has workflow-level `concurrency` (cancels PR runs, not push runs).
- pnpm `9.12.3`, node `>=20`, `--frozen-lockfile` everywhere, pnpm store cache present, Turbo remote
  cache optional via `TURBO_TOKEN`/`TURBO_TEAM`.
- `ci.yml` **mixes** PR and push events in one file with `github.event_name`/`github.ref` conditionals
  (coverage jobs only run on push-to-main).
- **Consumption: NOT MEASURED.** Account-level Actions billing needs the `user` token scope (current
  token returns 404). The run-duration proxy is contaminated by PR concurrency cancellations and the
  red-baseline fast-fails, so it cannot be used as a billable-minute estimate. Owner's lived evidence
  (quota exhausts fast) + the ~41 runs/day volume make exhaustion plausible.

### 3. Locked decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Only `ci.yml` PR-event jobs move to self-hosted. Push-to-main/staging jobs stay GitHub-hosted. | 95% of volume is `ci.yml`. Keeping the push gate on hosted infra keeps the validated baseline reliable even if the laptop is off. |
| D2 | When the laptop is off, PR jobs **queue and wait** (GitHub holds up to 24h). No fallback to hosted. | Solo dev; acceptable to wait. Zero added complexity, maximum saving. PR-to-staging/main merges are not blocked because the push gate is independent. |
| D3 | `e2e-pr.yml` is **left unchanged** (stays `pull_request` → `main`, effectively dormant). | Flipping it to `staging` would make the heaviest job fire on every staging PR → NEW quota cost, the opposite of the goal. |
| D4 | Add a **new `workflow_dispatch`-only** workflow that runs the E2E suite **on the self-hosted runner** on demand, with `branch` + `scope` (p0/full) inputs. | Owner wants a manual "run E2E locally before finalizing a spec, then promote to staging" gate — without spending any quota. |
| D5 | Baseline cost measurement is task 1 but **non-blocking**. | Confirms the before/after number; owner's evidence already justifies proceeding. |
| D6 | Single runner, max **1 heavy job at a time** on the laptop. | Owner's hardware constraint; enforced via concurrency + a single registered runner. |
| D7 | Runner labels: `self-hosted`, `linux`, `x64`, `leo-laptop`. The custom `leo-laptop` label pins jobs to this machine. | Explicit routing, future-proof for a second runner. |

### 4. Functional requirements

#### 4.1 PR CI on self-hosted
- Every `ci.yml` job, when triggered by a `pull_request` event, runs on `[self-hosted, linux, x64, leo-laptop]`.
- The same job, when triggered by `push` to `main`/`staging` (or `workflow_call`), runs on `ubuntu-latest`.
- Implemented via a per-job dynamic `runs-on` expression so the file stays single and existing logic is untouched.

#### 4.2 Draft + event hygiene
- PR jobs must NOT run on draft PRs: `if: github.event.pull_request.draft == false` guard at the
  self-hosted path.
- `pull_request` types restricted to `opened`, `synchronize`, `reopened`, `ready_for_review`.

#### 4.3 On-demand local E2E gate (new workflow)
- New file `.github/workflows/e2e-local.self-hosted.yml`, **`workflow_dispatch` only**, runs on
  `[self-hosted, linux, x64, leo-laptop]`.
- Inputs: `branch` (default: current), `scope` (`p0` | `full`, default `p0`).
- Reuses the existing E2E steps/scripts (`e2e:seed`, `e2e:test:p0` / `e2e:test`) + the postgres/redis/
  mailpit service containers (requires Docker on the runner).
- Triggerable via the Actions UI "Run workflow" button or `gh workflow run`.

#### 4.4 Security
- Add `permissions: contents: read` as the workflow-level default; elevate per-job only where strictly
  needed (none identified today).
- Fork guard: because `allow_forking: true`, the self-hosted path must only run for **same-repo** PRs:
  `github.event.pull_request.head.repo.full_name == github.repository`. Fork PRs (if any ever appear)
  fall back to `ubuntu-latest` or are skipped. Never use `pull_request_target` for these jobs.

#### 4.5 Concurrency / serialization
- Workflow-level concurrency group serializes self-hosted PR work so only one heavy run executes at a
  time on the laptop. `cancel-in-progress: true` for PR events (newer push supersedes older). The single
  registered runner is the hard backstop on parallelism (D6).

### 5. Acceptance criteria (BDD)

- **AC-1** GIVEN a non-draft PR to `staging`/`main`, WHEN CI runs, THEN all `ci.yml` jobs execute on the
  `leo-laptop` self-hosted runner and consume **zero** GitHub-hosted minutes.
- **AC-2** GIVEN a `push` to `main` or `staging`, WHEN `ci.yml` runs, THEN its jobs execute on
  `ubuntu-latest` (unchanged behavior, coverage gate intact).
- **AC-3** GIVEN a **draft** PR, WHEN it is opened/updated, THEN the self-hosted PR jobs do NOT run.
- **AC-4** GIVEN the laptop runner is offline, WHEN a PR is opened, THEN the PR jobs queue (do not fail
  immediately) and run once the runner is back; push-to-main/staging CI is unaffected.
- **AC-5** GIVEN the owner is finishing a spec, WHEN they dispatch `e2e-local.self-hosted.yml` with a
  branch + scope, THEN the E2E suite runs on the laptop and reports pass/fail, consuming zero quota.
- **AC-6** No deploy/release workflow uses `runs-on: self-hosted` (validated; none exist).
- **AC-7** Every modified/new workflow declares `permissions: contents: read` (or narrower) at the top.
- **AC-8** `actionlint`/YAML validation passes on all modified workflows; every pnpm/turbo script
  referenced exists in `package.json`.
- **AC-9** A same-repo check prevents fork PRs from executing on the self-hosted runner.

### 6. Manual steps (owner, GitHub UI + laptop)

These are documented in the spec but executed by the owner (cannot be automated by the agent):

1. **Measure baseline (optional, task 1):** `gh auth refresh -h github.com -s user` then
   `gh api /users/qazuor/settings/billing/actions` → record minutes used this cycle.
2. **Register the runner:** GitHub → repo Settings → Actions → Runners → New self-hosted runner →
   Linux x64. Run the provided `./config.sh` with `--labels leo-laptop` and `./run.sh`.
3. **Dedicated user:** install/run the runner under a separate Linux user (e.g. `github-runner`), NOT
   the primary account. Manual `./run.sh` mode first; promote to a systemd service only if desired later.
4. **Docker** must be available to `github-runner` for the E2E service containers (D4/§4.3).

### 7. Risks

| Risk | Mitigation |
|---|---|
| Self-hosted runner can run untrusted code from fork PRs (RCE on the laptop). | §4.4 same-repo guard + private repo + `pull_request` (not `_target`). |
| Laptop off → PRs blocked. | D2 accepts queueing; push gate independent; D4 dispatch always available. |
| Runner toolchain drift (node/pnpm/docker versions) vs hosted. | Document required toolchain; pin node 20 + pnpm 9.12.3 on the runner. |
| Over-broad default `GITHUB_TOKEN` permissions. | §4.4 `contents: read` default. |
| Adding E2E-on-staging by mistake reintroduces cost. | D3 explicitly forbids; only D4 dispatch path. |

---

## Part 2 — Technical Approach

### Dynamic `runs-on` (single-file, minimal diff)

`runs-on` accepts expressions. Per job:

```yaml
runs-on: >-
  ${{ (github.event_name == 'pull_request'
       && github.event.pull_request.draft == false
       && github.event.pull_request.head.repo.full_name == github.repository)
      && fromJSON('["self-hosted","linux","x64","leo-laptop"]')
      || 'ubuntu-latest' }}
```

- PR (non-draft, same-repo) → laptop. Everything else (push, fork PR, draft) → `ubuntu-latest`.
- Applied to each `ci.yml` job to preserve the existing `needs:`/conditional structure untouched.
- Trade-off vs splitting into two files: the expression is more compact and keeps one source of truth,
  matching the "preserve structure, don't break workflows" constraint. Alternative (two files) is
  documented but rejected for higher duplication.

### Tasks (high-level — to be atomized via task-master)

- T-001 Measure GitHub Actions billing baseline (non-blocking) + record in spec.
- T-002 Add workflow-level `permissions: contents: read` to `ci.yml` + restrict `pull_request` types.
- T-003 Add dynamic per-job `runs-on` (PR→self-hosted, push→hosted) with draft + same-repo guards.
- T-004 Verify concurrency group serializes self-hosted PR work; adjust if needed.
- T-005 New `e2e-local.self-hosted.yml` (workflow_dispatch, branch+scope inputs, self-hosted).
- T-006 Runner registration + hardening docs (`docs/guides/self-hosted-runner.md`): dedicated user,
  labels, Docker requirement, manual-then-service.
- T-007 Validate: actionlint/YAML, script existence, no self-hosted in deploy, permissions minimal,
  drafts excluded, fork guard present, `leo-laptop` label present.
- T-008 Update `.github/workflows` README/inline comments explaining why PR CI is self-hosted.

### Revision History

- 2026-06-01 — Initial draft from DevOps analysis session. Scope locked via 4 owner decisions
  (only ci.yml self-hosted; queue-and-wait fallback; measure-first non-blocking; e2e-pr untouched +
  new workflow_dispatch local E2E gate).
