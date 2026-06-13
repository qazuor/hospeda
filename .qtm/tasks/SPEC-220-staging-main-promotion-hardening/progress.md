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

## T-001 — Authoritative inventory (2026-06-13)

Method: read the **last** CodeQL check run of the paused promotion #1594 instead
of re-running one-at-a-time. The PR's final analyzed commit was `b673715c8` (the
redact.ts ReDoS fix #1596). Findings do NOT persist as repo code-scanning alerts
for PRs (CodeQL does differential analysis and reports as PR check annotations);
the repo's only persisted open alerts are `#67`/`#68` (the two ReDoS, baseline
against `main`).

**Result — the promotion surfaces exactly ONE actionable finding:**

| # | Finding | Location | Verdict |
| --- | --- | --- | --- |
| 3 | `js/xss-through-dom` ("DOM text reinterpreted as HTML") | `apps/web/src/components/account/PreferenceToggles.client.tsx:282` | Real-as-a-finding; likely-FP for exploitability. **Fix (T-002).** |

- Findings #1 (`string.ts`) and #2 (`redact.ts`) were **already fixed on staging**
  and did NOT appear in #1594's last annotation set — they only linger as stale
  `main`-baseline alerts `#67`/`#68`, which clear automatically once the fix
  reaches `main`. No action.
- The long-tail risk ("more behind them") did **not** materialize: the last run
  reported "1 new alert".

**Caveat:** #1594's last analysis was on `b673715c8`; `staging` has since advanced
~105 commits. The promo PR (T-005) re-runs CodeQL on the current diff and is the
final authority — if those commits introduced anything new, it surfaces there.
The XSS file itself was untouched by the 105 commits.

## T-002 — DOM-XSS guard (done, on branch `fix/SPEC-220-preference-toggles-xss-guard`)

Extracted the navigation-target construction into a pure, same-origin-guarded
helper `buildLocaleSwitchTarget` in `apps/web/src/lib/urls.ts`; the component now
navigates only when it returns a same-origin path (defence-in-depth + clears the
CodeQL taint via the canonical `new URL(tainted, origin)` + origin-check sanitizer
pattern). 6 unit tests added; web typecheck/lint/tests green. Adversarial review:
no bypass found, APPROVE. PR → staging pending.

## Already resolved on staging (clear automatically on promotion)

- **esbuild advisory** (`Security` gate): override tightened to `>=0.28.1` (#1589).
- **E2E babel `declare`-field toolchain**: staging's E2E config handles it; the
  promotion's E2E job passed. (Only a *config-only* PR to main failed E2E, because
  main lacks the toolchain fix.)
