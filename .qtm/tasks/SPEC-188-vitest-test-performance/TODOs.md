# TODOs: Vitest Test-Suite Performance (SPEC-188)

Spec: SPEC-188 | Status: in-progress | Progress: 0/15

## Setup

- [ ] T-001: Establish baseline — per-package + per-shard timings, local peak memory & safe-concurrency observation (run sequentially, machine-safe) (complexity: 4)
- [ ] T-002: Lock SC-2 speed target + SC-3 local concurrency ceiling from baseline (needs leo-laptop cores/RAM) (complexity: 2) [blocked by T-001]

## Core

- [ ] T-003: Spike pool:'threads' vs tuned 'forks' on a node package; measure + 3x green; audit global/native state (complexity: 5) [blocked by T-001]
- [ ] T-004: Spike isolate:false on a pure schema/util package; measure + 3x green; verify no pollution (complexity: 4) [blocked by T-001]
- [ ] T-005: Spike environment split (environmentMatchGlobs / happy-dom) on apps/admin; measure + 3x green (complexity: 6) [blocked by T-001]
- [ ] T-006: Decide per-package winning lever combination (keep only no-flake, no-concurrency-increase gains) (complexity: 3) [blocked by T-003, T-004, T-005]

## Integration

- [ ] T-007: Add vitest.shared.config.ts with env-driven concurrency knob (complexity: 5) [blocked by T-006]
- [ ] T-008: Migrate node packages to extend shared config (package-by-package, green after each) (complexity: 6) [blocked by T-007]
- [ ] T-009: Migrate the 5 jsdom packages with the environment split (complexity: 6) [blocked by T-007]
- [ ] T-010: Wire concurrency cap — turbo --concurrency + vitest forks/threads env, separate local vs CI (complexity: 4) [blocked by T-007, T-002]

## Testing

- [ ] T-011: Determinism — >=2 full CI runs match; >=3 green per changed package (AC-3.1) (complexity: 3) [blocked by T-008, T-009, T-010]
- [ ] T-012: Machine-safety gate (SC-3) — local full-suite completes without hang; sign-off (complexity: 2) [blocked by T-010]
- [ ] T-013: Confirm coverage thresholds + .only/.skip guard still pass (AC-3.2) (complexity: 2) [blocked by T-008, T-009]

## Docs

- [ ] T-014: Write docs/guides/test-performance.md (knobs, caps, re-measure procedure) (complexity: 2) [blocked by T-011]

## Cleanup

- [ ] T-015: Update ci.yml test-unit comment with new baseline; decide whether to lower the 30 min cap (complexity: 2) [blocked by T-011, T-012]
