# SPEC-220 — Progress

## Origin (2026-06-12)

Created while working SPEC-219 (Dependabot CI hardening). SPEC-219 T-005 needs the
Dependabot `ignore` to reach `main`, which requires a `staging → main` promotion.
Promotion PR #1594 (253 commits) had `CI Pass = success` but **CodeQL = failure**:
the large diff surfaces pre-existing security debt that is invisible on `staging`
(CodeQL only runs against `main`). The promotion was paused and this spec opened
to clear that debt deliberately.

## Known findings inventory (to be completed by T-001)

| # | Finding | Location | Status |
| --- | --- | --- | --- |
| 1 | `js/polynomial-redos` | `packages/utils/src/string.ts` | Already fixed on staging (linear regex + cap); stale alert #68 clears on promotion |
| 2 | `js/polynomial-redos` | `packages/logger/src/redact.ts` (JWT) | Fixed on staging (#1596): single `eyJ` anchor + bounded `{1,2048}` + ReDoS guard test |
| 3 | DOM-based XSS | `apps/web/src/components/account/PreferenceToggles.client.tsx:282` | Open — likely FP (same-origin path rebuild); T-002 |

> T-001 must enumerate the FULL set from the promotion PR's CodeQL annotations,
> not one-at-a-time. CodeQL surfaced #1→#2→#3 sequentially during #1594.

## Already resolved on staging (clear automatically on promotion)

- **esbuild advisory** (`Security` gate): override tightened to `>=0.28.1` (#1589).
- **E2E babel `declare`-field toolchain**: staging's E2E config handles it; the
  promotion's E2E job passed. (Only a *config-only* PR to main failed E2E, because
  main lacks the toolchain fix.)
