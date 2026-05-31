---
spec-id: SPEC-105
title: E2E Nightly Test Suite Repair
type: chore
complexity: high
status: draft
created: 2026-05-13T00:27:41Z
effort_estimate_hours: 6-30
tags: [e2e, testing, ci, investigation, test-infrastructure]
extracted_from: SPEC-103 §3.B.6 item 3 (T-034)
---

# SPEC-105: E2E Nightly Test Suite Repair

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Re-enable the E2E nightly cron in `.github/workflows/e2e-nightly.yml`. Currently commented out because every nightly run since the VPS migration sprint failed. The repair work has unbounded scope until investigation surfaces a root cause.

**Why now:** Without nightly regression coverage we lose visibility into P0+P1+RES path breakage between deploys. The longer the suite stays disabled, the more drift accumulates between tests and shipping code, making the eventual repair harder.

**Why a new spec (not part of SPEC-103):** The investigation is unbounded. Estimates range from 6 hours (single credential drift) to 30 hours (multi-day refactor because schema drift across SPEC-001/063/086 etc. broke many asserts). Honest risk assessment from SPEC-103 owner (2026-05-12):

| Probability | Outcome | Estimated effort |
|---|---|---|
| ~20% | Trivial — single missing/expired credential | 1-2 h |
| ~40% | Medium — credential + handful of test fixes for shifted comportamiento | 1-2 days |
| ~40% | Deep — schema drift broke many asserts; partial test rewrite needed | 3-5 days |

Wrapping this in SPEC-103 risks ballooning that spec; isolating it lets the work proceed at its own pace.

**Audience:** Solo developer (qazuor) with intermittent attention. The investigation may need to pause for context, resume after schema-drift assessments, etc.

---

### 2. Out of Scope

- Adding new E2E test coverage. This is REPAIR, not expansion.
- Migrating from the current E2E runner (Playwright per `apps/e2e/`) to a different framework.
- Improving E2E test infra (parallelism, fixtures, reporting). Tracked separately if needed.
- Building a replacement smoke suite. Auth + ops smokes live elsewhere (SPEC-103 §3.A.5).

---

### 3. Investigation Approach

The work is divided into **investigation phases** rather than rigid tasks. Each phase produces evidence that informs the next phase's scope.

#### Phase 0 — Read past run failure logs

- Query GitHub Actions API for the last ~10 E2E nightly runs (whatever exists pre-disable).
- Capture per-run failure summaries: which test files failed, which assertions, error types.
- Group failures by root cause hypothesis: credential, schema drift, env config, framework version.

**Output:** `docs/test/e2e-failure-audit-2026-05-13.md` with the per-failure taxonomy.

#### Phase 1 — Local repro

For each distinct failure category surfaced in Phase 0:
- Reproduce locally against either staging DB or a snapshot clone.
- Confirm the root cause matches the hypothesis from Phase 0.

**Output:** confirmed root-cause list, with file:line references and shift dates from git blame (so we can see e.g. "this test was written before SPEC-063 lifecycle change at commit XYZ").

#### Phase 2 — Fix each root cause

For each root cause:
- (a) credential drift → update env vars in repo secrets + workflow, document in `docs/security/secrets-runbook.md`.
- (b) schema/API drift → update the test assertions to match current behaviour; add a comment naming the spec that changed the behaviour.
- (c) infra drift (e.g., test runner assumed Vercel URLs, now needs Coolify) → update test runner config.

Each fix is a focused commit. Tests that can't be fixed in reasonable time get `it.skipIf(true)` + a follow-up task ID in this spec.

#### Phase 3 — Re-enable + observe

- Uncomment the cron schedule in `.github/workflows/e2e-nightly.yml`.
- Set the cron to run at 02:00 ART (4 hours before the daily backup, so failures show on the morning timeline).
- Observe 3 consecutive nightly runs. If any fail, regress to phase 2 for that failure.

---

### 4. Tasks (open until investigation produces concrete sub-tasks)

| Task | Title | Status |
|---|---|---|
| T-105-01 | Phase 0: audit past nightly failures and produce taxonomy | pending |
| T-105-02 | Phase 1: reproduce each failure category locally | pending, blocked by T-105-01 |
| T-105-03 | Phase 2a: fix credential drift (if surfaced) | pending, blocked by T-105-02 |
| T-105-04 | Phase 2b: fix schema/API drift (if surfaced) | pending, blocked by T-105-02 |
| T-105-05 | Phase 2c: fix infra drift (if surfaced) | pending, blocked by T-105-02 |
| T-105-06 | Phase 3: re-enable cron + observe 3 successful runs | pending, blocked by T-105-03..05 |

Subtasks expand under T-105-04 as schema drift surfaces (per-test fixes).

---

### 5. Risks

| Risk | Mitigation |
|---|---|
| Investigation takes longer than expected because every fix surfaces more drift | Time-box each phase. After Phase 1, if more than ~5 distinct root causes, escalate scope to user. |
| Tests for retired features (e.g., Vercel deploy assertions) need full deletion not fixing | Mark such tests `it.skipIf(true)` with a comment naming the retiring spec. Decide separately whether to delete. |
| New schema drift lands during the repair work, breaking the just-fixed tests | Keep the cron disabled until ALL Phase-2 fixes land in a single bundled PR. |
| Repair PR is large and risky to merge | Each phase ships its own PR if practical (target: ≤ 20 file changes per PR). |

---

### 6. Acceptance Criteria

This spec is "done" when:

- [ ] The E2E nightly cron is re-enabled in `.github/workflows/e2e-nightly.yml`.
- [ ] Three consecutive nightly runs have completed successfully (i.e., main branch as of that night actually passes E2E).
- [ ] `docs/test/e2e-failure-audit-2026-05-13.md` is committed and lists every fix made + every test still skipped with reasons.
- [ ] No `it.skipIf(true)` added without a follow-up task ID.

---

## Part 2 — Implementation Notes

### Source

Originally bullet T-034 in SPEC-103 §3.B.6 item 3. Extracted to its own spec on 2026-05-13 after the SPEC-103 owner concluded the scope is genuinely unbounded.

### When to start

Open question. Probably:
- Before public launch: medium priority. Nightly coverage helps catch ship-blocker regressions during pre-launch sprint.
- After public launch: low priority until first regression bites — at which point urgency spikes.

### Sequencing relative to SPEC-104

Independent. Beta migration (SPEC-104) doesn't touch E2E tests; E2E repair doesn't touch beta data. Either can land first.
