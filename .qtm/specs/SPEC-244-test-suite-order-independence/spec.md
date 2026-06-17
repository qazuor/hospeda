---
spec-id: SPEC-244
title: Test suite order-independence hardening
type: improvement
complexity: high
status: draft
created: 2026-06-17T00:00:00Z
---

# SPEC-244 — Test suite order-independence hardening

## Overview

**Goal.** Make every test suite in the monorepo (`apps/api`, `apps/admin`,
`apps/web`, and `packages/*`) pass under **any file execution order**, and add a
CI guard that runs the suites with `--sequence.shuffle` so that re-introducing a
cross-file order dependency fails CI instead of silently lurking until a runner's
CPU topology changes.

**Motivation.** The `apps/api` vitest suite has a **systemic cross-file
order-dependency**. CI is green today only because it runs the deterministic
(non-shuffle) default order. The latent risk is real: vitest's `forks` pool
distributes test files across workers based on the available CPU count, so the
order in which files share a worker — and therefore which leaked global state a
given file observes — can differ between CI runners and between local machines.
A green CI run is not evidence that the suite is order-independent; it is only
evidence that *one* order passes.

**What this is NOT.** This is **test-infrastructure hardening only**. It does
NOT rewrite test assertions, change product/source code, alter test coverage, or
"fix" the symptom by pinning a single execution order. The fix is to remove the
shared mutable state that leaks across files, then prove order-independence with
a shuffle guard.

**Provenance.** SPEC-244 is a **follow-up discovered during SPEC-222**
(accommodation import from URL). While stabilizing
`apps/api/test/routes/accommodation-import.integration.test.ts`, that test was
found to be a *victim candidate*, not a cause — and the underlying systemic
order-dependency was diagnosed instead. The diagnosis below is the evidence base
for this spec; it has already been performed and does not need re-investigation.

> **The originally-reported test needs NO change.**
> `apps/api/test/routes/accommodation-import.integration.test.ts` is not flaky.
> It passed in **9/9** distinct execution orders (isolated; directory run ×3 with
> `maxForks=3`; full suite once; and 8 `--sequence.shuffle` seeds). It is a
> potential victim of leaked global state, not the source of it. SPEC-244 must
> not touch it.

---

## Problem statement & evidence (diagnosis already completed)

### The integration test is a victim, not the cause

The "flaky" report that triggered the investigation pointed at
`accommodation-import.integration.test.ts`. Direct reproduction attempts cleared
it: it passed in 9/9 different execution orders (isolated, directory ×3 with
`maxForks=3`, full suite once, and 8 `--sequence.shuffle` seeds). It is a
victim-candidate of cross-file leakage, not the cause.

### The api suite reliably fails under shuffled file order

Running the full api suite with
`npx vitest run --sequence.shuffle --sequence.seed=<N>` (which shuffles **file**
order, not tests within a file) reliably fails **6–16 tests per order**. Failing
files and their failure frequency across **10 shuffle orders**:

| File | Fail count (of 10 orders) |
| --- | --- |
| `test/services/addon-plan-change.service.test.ts` | 32 |
| `test/routes/conversations/public/guest-reply.test.ts` | 13 |
| `test/routes/conversations/public/guest-thread.test.ts` | 12 |
| `test/routes/user/protected/subscription-plan.cutover.test.ts` | 11 |
| `test/services/addon-entitlement.service.test.ts` | 6 |
| `test/routes/billing/plan-change-downgrade.test.ts` | 6 |
| `test/routes/content-moderation/admin-health.test.ts` | 5 |
| `test/middlewares/billing-customer.test.ts` | 5 |
| `test/routes/billing/admin/plans.test.ts` | 2 |
| `test/webhooks/mercadopago.test.ts` | 1 |

(The fail counts exceed 10 because a single shuffled order can fail multiple
assertions/tests inside the same file.)

### Confirmed root-cause mechanism

Confirmed by drilling into
`test/routes/user/protected/subscription-plan.cutover.test.ts`: **global mocks
declared at module scope in `apps/api/test/setup.ts` leak across files / win over
a test's LOCAL mock under certain fork distributions.**

The concrete offender is the `PlanService` mock inside the
`vi.mock('@repo/service-core', ...)` block in `apps/api/test/setup.ts`, which
returns `{ name: 'Básico', status: 'active' }` for `getBySlug('owner-basico')`.
When a victim file defines its own local mock for the same dependency, the global
mock can take precedence depending on which files were loaded into the same fork
worker first. Observed failure shapes:

- `expected "spy" to be called once, but got 0 times` — the victim's local spy
  is bypassed because the global mock answered instead.
- `expected { name: 'Básico', status: 'active' } to be null` — the global mock's
  canned return value leaks into a test that expected its own (null) stub.

### vitest configuration context

- `pool: 'forks'`, `maxForks: 3`, `isolate` default (`true`),
  `setupFiles: ['./test/setup.ts']`.
- CI stays green **only** because it runs the deterministic (non-shuffle) order.
- The latent risk: fork distribution varies with CPU count between runners, so
  the passing order is not guaranteed across environments.

### Ruled out

`apps/api/test/setup.ts` sets env at **module scope**, so with `isolate: true`
it re-runs per file and `process.env` leakage was investigated and **ruled out**
as the cause for the integration test. The cause is **global-mock leakage**, not
env leakage.

---

## Goals

1. The `apps/api` test suite passes under **any** file execution order
   (verified across multiple `--sequence.shuffle` seeds).
2. Every other suite (`apps/admin`, `apps/web`, `packages/*`) is **audited the
   same way** and made order-independent where the same class of leakage exists.
3. A **CI guard** runs the suites with `--sequence.shuffle` so a re-introduced
   cross-file order dependency fails CI.
4. The fix removes shared mutable state (global mocks in `setup.ts`) — it does
   NOT pin a single deterministic order to hide the problem.

## Non-goals

- **Rewriting test assertions** or changing what the tests verify.
- **Changing product/source code.** This is test-infra hardening only. (If a
  test only passes because of a real product bug exposed by reordering, that is
  reported as a separate finding, not fixed here.)
- **Improving test performance / coverage** (that was SPEC-238; orthogonal).
- **Removing `pool: 'forks'` or changing `maxForks`** as the primary fix. The
  fix is to stop leaking state, not to constrain the scheduler so the leak never
  manifests.
- **Touching `accommodation-import.integration.test.ts`** — it needs no change.

---

## User Stories & Acceptance Criteria

### US-1 — The api suite passes under any file order

GIVEN the `apps/api` vitest suite,
WHEN it is run with `vitest run --sequence.shuffle --sequence.seed=<N>` for any
seed,
THEN all tests pass — no test depends on another file having run (or not run)
first.

- **AC-1.1** The 10 currently-failing files in the evidence table pass under all
  of the previously-failing shuffle seeds used in the diagnosis.
- **AC-1.2** A fresh batch of at least 10 new random shuffle seeds (not the
  diagnosis seeds) all pass — order-independence generalizes beyond the seeds
  that originally exposed it.
- **AC-1.3** The deterministic (default, non-shuffle) order still passes — the
  fix does not regress the baseline.

### US-2 — Global mock leakage is eliminated at the source

GIVEN `apps/api/test/setup.ts`,
WHEN broad `vi.mock(...)` declarations of shared packages (notably
`@repo/service-core` and its `PlanService`) are reviewed,
THEN any module-scoped mock that returns canned values which can leak across
files is either (a) moved out of global setup into opt-in per-file mocks, or
(b) made non-leaking (reset/restored per file so a victim's local mock always
wins).

- **AC-2.1** The `PlanService.getBySlug('owner-basico')` global mock no longer
  overrides a file's local mock for the same dependency under any fork
  distribution.
- **AC-2.2** Files that genuinely need the previously-global mock opt into it
  explicitly (import a shared helper / call a setup function), so the dependency
  is visible per file rather than ambient.
- **AC-2.3** No new product code is changed to achieve this.

### US-3 — Per-suite audit (admin, web, packages)

GIVEN each non-api suite (`apps/admin`, `apps/web`, every `packages/*` with
tests),
WHEN it is run under `--sequence.shuffle` across multiple seeds,
THEN each suite is confirmed order-independent, OR the same class of leakage
(module-scoped global mock / shared mutable singleton in `setup.ts` or
equivalent) is found and remediated.

- **AC-3.1** For every suite, the audit result is recorded: either "already
  order-independent (N seeds green)" or "leak found in `<file>` → fixed by `<X>`".
- **AC-3.2** Every suite that had a leak passes the same multi-seed shuffle bar
  as US-1 after remediation.
- **AC-3.3** Suites with no test files are explicitly noted as N/A (not silently
  skipped).

### US-4 — CI guard fails on re-introduced order-dependency

GIVEN the CI pipeline,
WHEN a change re-introduces a cross-file order dependency in any guarded suite,
THEN a CI job that runs the suite(s) with `--sequence.shuffle` fails, blocking
the merge.

- **AC-4.1** A dedicated CI job (or step) runs each guarded suite with
  `--sequence.shuffle` and a defined seed strategy (see Open Questions Q3).
- **AC-4.2** The guard runs on pull requests targeting `staging` and `main`.
- **AC-4.3** The guard's failure output names the failing file(s) and the seed,
  so the dependency is reproducible locally with a single command.
- **AC-4.4** The guard is added **last** (after all suites are green under
  shuffle), so it does not block unrelated work while remediation is in flight.

### US-5 — Reproducible diagnosis is preserved

GIVEN a future developer who hits a shuffle failure,
WHEN they read the spec / docs,
THEN they can reproduce the original diagnosis and understand the mechanism
(global-mock leakage), the exact command
(`vitest run --sequence.shuffle --sequence.seed=<N>`), and the remediation
pattern.

- **AC-5.1** The evidence table and root-cause mechanism are captured in this
  spec (done) and referenced from the CI guard's failure message or a docs note.
- **AC-5.2** The remediation pattern (move global mocks to opt-in per-file) is
  documented so the same fix is applied consistently across suites.

---

## Approach (proposed direction — flag open questions, do not over-prescribe)

### (a) Isolate global mocks in each `setup.ts`

The core fix: broad `vi.mock(...)` of shared packages (e.g.
`@repo/service-core`'s `PlanService`) that live at module scope in a shared
`setup.ts` are the leak vector. Two candidate remediations, to be chosen
per-mock at implementation time:

1. **Move to opt-in per-file mocks.** Delete the broad mock from global setup;
   provide a shared helper (e.g. `mockPlanService(overrides)`) that files import
   and call explicitly. Pros: dependency is visible per file; no ambient leakage.
   Cons: touches every file that relied on the ambient mock (larger diff).
2. **Make the global mock non-leaking.** Keep it in setup but ensure it is
   reset/restored per file (e.g. via `vi.resetModules()` / `beforeEach` restore
   semantics) so a file's local mock always wins. Pros: smaller diff. Cons:
   fragile — relies on reset ordering and can mask future leaks; less explicit.

**Recommended default:** option 1 for the confirmed offender (`PlanService`),
because the diagnosis shows the *ambient* nature is the problem; option 2 only
where moving a mock would be disproportionately invasive and the reset semantics
are provably airtight. This is a decision per mock, made during Phase 1.

### (b) Per-suite audit via shuffle

For each suite: run `vitest run --sequence.shuffle` across several seeds, collect
failing files, drill into the first failure to identify the leaked state, apply
the (a) remediation, re-run until N seeds are green. Record the outcome per suite
(AC-3.1).

### (c) CI guard running shuffle

Add a CI job/step that runs each guarded suite under `--sequence.shuffle`. Seed
strategy and whether it runs per-PR vs nightly are open questions (Q3). The guard
lands **last**, after every suite is green under shuffle, so it never blocks
in-flight remediation.

---

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **Large blast radius**: `apps/api/test/setup.ts` is shared by the whole api suite; changing it can break many files at once. | High | Phase api first and in small steps; remediate one global mock at a time; re-run the full suite (deterministic + shuffle) after each change; keep changes test-infra-only. |
| Moving a global mock to opt-in misses a file that silently relied on it → that file now fails deterministically. | Medium | The deterministic baseline run (AC-1.3) catches files that lose their ambient mock immediately; fix by adding the opt-in helper call to that file. |
| Reordering exposes a **real product bug** (a test passed only due to leaked state masking a defect). | Medium | Report as a separate finding (new spec/issue); do NOT fix product code under SPEC-244 (non-goal). |
| Non-api suites have a *different* leak class (shared singleton, DB state, timers) not covered by the mock pattern. | Medium | The audit (US-3) is per-suite and open-ended; record the actual leak found rather than assuming the api pattern. |
| CI guard is flaky/slow (shuffle adds runtime; some seeds catch issues others miss). | Medium | Land the guard last; pick a seed strategy (Q3) that balances coverage vs runtime; emit reproducible seed on failure. |
| Fix that pins a single order (anti-pattern) sneaks in instead of removing leakage. | Medium | Explicit non-goal; reviewers reject order-pinning; the shuffle guard would defeat a pin anyway. |

## Phased rollout

The phasing deliberately tackles the **highest-evidence, highest-blast-radius**
suite first (api), proves the remediation pattern there, then propagates to the
other suites, and adds the CI guard **last** so it never blocks remediation.

- **Phase 1 — api audit + fix** (the confirmed offender; largest blast radius).
- **Phase 2 — admin audit + fix.**
- **Phase 3 — web audit + fix.**
- **Phase 4 — packages audit + fix.**
- **Phase 5 — CI shuffle guard** (added only once all suites are green under
  shuffle).

Each phase is a natural pause point: the suite it covers is fully order-
independent (multi-seed green) before the next phase starts.

## Out of Scope

- Any change to `accommodation-import.integration.test.ts` (it is already
  order-independent).
- Test performance / cold-import overhead (handled by SPEC-238).
- Changing product/source code, test assertions, or coverage targets.
- Replacing the `forks` pool or tuning `maxForks` as the remediation.
- Fixing real product bugs that reordering may surface (reported separately).
- Order-dependency *within* a single file (the diagnosed problem is cross-file;
  intra-file ordering is a test author's responsibility and out of scope here).

---

## Open Questions

1. **Per-mock remediation choice.** For each global mock in api `setup.ts`,
   option 1 (move to opt-in) vs option 2 (make non-leaking)? Default: option 1
   for `PlanService`; decide the rest in Phase 1 with the diff size in hand.
2. **Other global mocks.** Is `PlanService` the only leaking module-scoped mock
   in api `setup.ts`, or do other entries in the `vi.mock('@repo/service-core')`
   block also leak? Phase 1 audit confirms the full list.
3. **CI seed strategy.** Fixed seed set (reproducible, cheaper) vs rotating
   random seed per run (broader coverage, harder to reproduce) vs both
   (fixed-on-PR + random-on-nightly)? Affects guard runtime and flake profile.
4. **Per-suite vs single guard job.** One CI job that shuffles all suites, or a
   per-app matrix? Depends on runtime budget and whether all suites are
   guarded from day one or rolled in as each phase completes.
5. **Web suite specifics.** `apps/web` uses source-grep style tests and Astro
   islands; confirm whether `--sequence.shuffle` is meaningful there or whether
   its leakage class (if any) differs from the mock pattern.
