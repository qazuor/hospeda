---
spec-id: SPEC-220
title: Staging→Main Promotion Hardening — clear CodeQL security debt blocking the promotion
type: infrastructure
complexity: medium
status: completed
created: 2026-06-12
---

# SPEC-220 — Staging→Main Promotion Hardening

## 1. Overview

### Goal

Make a `staging → main` promotion pass CI **and CodeQL** cleanly, by cataloguing
and resolving the pre-existing code-scanning debt that the large promotion diff
surfaces. The immediate driver is SPEC-219 T-005 (the Dependabot `ignore` only
activates once `.github/dependabot.yml` reaches `main`), but the underlying
problem is general: promotions to `main` have become un-mergeable because CodeQL
findings accumulate invisibly on `staging`.

### Motivation

While promoting `staging → main` (PR #1594, 253 commits ahead), the `CI Pass`
aggregator was green but the **CodeQL** check failed. Investigation showed:

- **CodeQL only runs against `main`** (push + PR to `main`). It does **not** run
  on `staging` (no CodeQL runs on the branch; `staging` PRs carry zero CodeQL
  checks). So security findings introduced on `staging` are invisible until a
  promotion to `main` is attempted, where the whole accumulated diff is analysed
  at once. CodeQL even annotates: *"Alerts not introduced by this pull request
  might have been detected because the code changes were too large."*
- The promotion surfaced findings **one layer at a time** (fix one, the next
  appears): an E2E toolchain break, then 2 ReDoS, then a DOM-XSS — and possibly
  more behind them.

This is not SPEC-219; it is the cost of `main` lagging `staging` by a large diff
with no CodeQL gate in between.

### Success Criteria

- A `staging → main` promotion PR reaches **CodeQL = success** (0 new high/critical
  alerts) and `CI Pass = success`.
- Every CodeQL finding the promotion surfaces is either **fixed** (real issue) or
  **dismissed with a documented justification** (false positive), with the
  rationale recorded.
- The promotion can be merged, which (as a side effect) lands the SPEC-219
  Dependabot `ignore` on `main` and unblocks **SPEC-219 T-005**.
- A preventive measure is decided (and, if adopted, implemented) so this debt
  does not silently re-accumulate before the next promotion.

## 2. Scope

### In Scope

1. **Full CodeQL inventory** for the `staging → main` diff — collect the complete
   set of findings in one pass (not one-at-a-time), classify real vs false
   positive.
2. **Fix real findings** in `staging` (so they clear when promoted).
3. **Dismiss/justify false positives** (GitHub code-scanning dismissal and/or
   inline `codeql[...]`-style suppression where supported), each with a written
   reason.
4. **Re-validate** a promotion PR goes fully green (CI Pass + CodeQL).
5. **Preventive decision**: whether to run CodeQL on `staging` PRs/pushes (or on
   a cadence) so findings surface continuously instead of piling up for the
   promotion. Decide and, if adopted, wire it.

### Out of Scope

- The Dependabot config/CI work itself (SPEC-219 — done).
- The actual `staging → main` promotion merge decision/timing (owner-driven; this
  spec makes it *possible*, the owner decides *when*).
- Broad refactors of the flagged code beyond what each finding requires.
- Non-CodeQL promotion concerns already resolved on `staging` (e.g. the esbuild
  advisory #1589, the E2E babel `declare`-field toolchain fix — both already on
  `staging`; they clear automatically when promoted).

## 3. Known Findings (as of 2026-06-12)

Captured during the paused promotion #1594. The inventory task (T-001) must
confirm these are the complete set and add any not yet seen.

| # | Finding | Location | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | `js/polynomial-redos` (ReDoS) | `packages/utils/src/string.ts` | **Already fixed on staging** | `/<[^<>]*>/g` linear + length cap. Repo alert #68 is stale; clears when the fix reaches `main`. No action. |
| 2 | `js/polynomial-redos` (ReDoS) | `packages/logger/src/redact.ts` (JWT pattern) | **Fixed on staging (#1596)** | Single `eyJ` anchor + bounded `{1,2048}` runs; ReDoS regression test added. Clears when promoted. |
| 3 | DOM-based XSS (`js/...`) | `apps/web/src/components/account/PreferenceToggles.client.tsx:282` | **Open — likely false positive** | `window.location.assign(...)` of a path rebuilt from `location` segments with a validated locale; always a same-origin `/...` path, never a `javascript:` URI. Needs a defensive same-origin guard (also silences CodeQL) OR a documented dismissal. |
| … | (to be completed by T-001) | | | CodeQL surfaced findings one at a time; the full set must be enumerated. |

## 4. Technical Approach

### 4.1 Enumerate the full finding set (not one-at-a-time)

Open a throwaway `staging → main` PR (or reuse a draft) and read the **complete**
CodeQL annotation set from the check run, plus the repo's open code-scanning
alerts, rather than fixing/re-running iteratively. Build the authoritative list
in `progress.md`.

### 4.2 Classify and resolve

For each finding: **real** → fix in `staging` (with a regression test where it
makes sense, e.g. the ReDoS guard). **False positive** → dismiss via GitHub
code-scanning with a written justification, or add the supported inline
suppression, and record why. Same-origin/url-rebuild XSS patterns (finding #3)
should prefer a small defensive guard (e.g. assert the constructed target starts
with `/` and has no scheme) — it both satisfies CodeQL and is genuine
defence-in-depth.

### 4.3 Prevent re-accumulation (decision)

Today CodeQL runs only against `main`, so `staging` accrues invisible debt.
Options to evaluate in T-00x:

- **A — Run CodeQL on `staging`** (push and/or PR) so findings surface at the
  source. Pro: no more promotion surprises. Con: adds CI time to every `staging`
  change; may need `paths`/scheduling tuning.
- **B — Scheduled CodeQL on `staging`** (e.g. nightly). Pro: cheaper than per-PR.
  Con: findings lag by up to a day.
- **C — Promote more often** so the diff stays small and findings are few per
  promotion. Process change, no CI cost.

Decision deferred to implementation; record the rationale.

## 5. Risks

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Finding set is larger than the 3 seen; long tail | Medium | Medium | T-001 enumerates the FULL set up front instead of one-at-a-time, so effort is known before committing. |
| A "false positive" is actually exploitable | High | Low | Require a written justification per dismissal; prefer a defensive code guard over a bare dismissal when feasible. |
| Running CodeQL on staging slows every PR | Medium | Medium | Evaluate scheduled vs per-PR (4.3); tune `paths`/concurrency. |
| Promotion diff keeps growing while this is open | Medium | Medium | Land fixes on `staging` continuously; they clear as soon as the promotion runs. |

## 6. Tasks (Suggested)

### Setup

- T-001: Enumerate the **complete** CodeQL finding set for the `staging → main`
  diff (annotations + open alerts). Classify each real vs false positive. Record
  the authoritative inventory in `progress.md`.

### Core

- T-002: Resolve finding #3 (PreferenceToggles DOM-XSS) — add a same-origin guard
  on the constructed navigation target (defence-in-depth that also clears CodeQL),
  or dismiss with justification if confirmed inert.
- T-003: Resolve any remaining **real** findings from T-001 (fix in `staging`,
  with regression tests where applicable).
- T-004: Dismiss/justify the confirmed **false positives** from T-001 (documented
  GitHub dismissals or supported inline suppressions).

### Verification

- T-005: Open a `staging → main` promotion PR and confirm **CodeQL = success** and
  `CI Pass = success`. (Verifies #1/#2 ReDoS alerts also clear once on `main`.)

### Prevention

- T-006: Decide and (if adopted) implement the preventive measure from §4.3 so
  CodeQL debt does not silently re-accumulate on `staging` before the next
  promotion.

### Cleanup

- T-007: On a green promotion, hand off to the owner to merge `staging → main`.
  Note that this also activates the SPEC-219 Dependabot `ignore` on `main` →
  unblocks **SPEC-219 T-005** (then `@dependabot recreate` #1588 to regenerate the
  group without zod / @tanstack/react-router).

## 7. References

- Paused promotion PR #1594; SPEC-219 (the driver) and its `progress.md` closeout.
- ReDoS fix PR #1596; esbuild advisory fix #1589.
- `docs/guides/dependabot-policy.md` — the "config read from default branch" gotcha.
- CodeQL workflow (`.github/workflows/codeql*.yml`) — confirm triggers in T-006.
