# SPEC-238 — Local measurement

> **Local proxy only.** The authoritative ~9% target (AC#1) is measured on the
> self-hosted CI runner, not this dev machine. Numbers below establish the
> relative effect of each lever, not an absolute CI figure.

## Method

- Command: `pnpm --filter hospeda-api test` (`vitest run`, api unit config,
  excludes e2e/integration). `maxForks: 3`, unchanged.
- 2 clean consecutive runs back-to-back (same machine load), one with the
  Sentry mock stashed out (BEFORE) and one with it applied (AFTER).
- Suite size: 385 test files passed / 2 skipped, 6648 tests passed.

## Cost profile (BEFORE)

`collect` (cold-import) dominates by ~12×:

```
collect 1914.6s   tests 156.3s   transform 14.2s   setup 7.7s   prepare 47.1s
```

The per-file cold-import is the suite's real cost; test execution is a rounding
error by comparison.

## Lever: Sentry mock (T-005)

| Metric  | BEFORE (no mock) | AFTER (mock) | Δ        |
| ------- | ---------------- | ------------ | -------- |
| Wall    | 742.37s          | 607.11s      | −18.2%   |
| Collect | 1914.60s         | 1526.29s     | −20.3%   |

Pass/skip counts identical before/after (385 / 2) — no test broken.

`@sentry/node` (native `.node` addon) + `@sentry/profiling-node`
(`nodeProfilingIntegration`) were loaded once per test file. Mocking both
removes that fixed per-file cost.

## Outcome

The Sentry mock alone delivers ~2× the spec's ~9% target, at low risk
(no source change, no test touched, faithful mock with `startSpan` running its
callback). The larger service-core `...actual` lever (≈80% of the theoretical
gain, but touches ~50 tests and risks masking real contracts — AC#3/AC#4) is
**not required to meet the spec goal** and is deferred unless CI shows the
Sentry mock underperforms the target on the runner.
