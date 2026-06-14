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

## T-005 round 1 — promo #1618 surfaced 2 findings (2026-06-13)

Opened the `staging → main` promotion PR **#1618** (the T-005 validation). On the
current diff (373 commits) it ran: `CI Pass = SUCCESS`, but `CodeQL = FAILURE`
with **2** findings — the 105 new commits changed the picture vs #1594:

1. `js/xss-through-dom` — **still** at `PreferenceToggles.client.tsx`. The T-002
   `new URL` + origin-check guard did NOT clear it: CodeQL re-taints the
   reconstructed `pathname+search+hash` string and traces it to
   `window.location.assign`, which it treats as a `javascript:`-capable sink.
2. `js/insecure-randomness` — **new**, at `apps/e2e/fixtures/api-helpers.ts`
   (`Math.random()` feeding test passwords/emails = a security context).

## T-003 — clear both findings (done, PR #1622 → merged to staging)

- **XSS**: pivoted from `location.assign(string)` to the **`window.location.pathname`
  setter**. The pathname setter can only replace the path component (no scheme/
  authority), so it is inherently same-origin and is not modelled as an
  xss-through-dom sink — the safe API is the guard. Helper renamed
  `buildLocaleSwitchPathname` (path-only; browser preserves query/hash). The
  `new URL`/origin machinery was dropped.
- **insecure-randomness**: replaced the three `Math.random()` uses with a
  `randomToken` helper backed by `node:crypto` `randomBytes`.
- Verified: web typecheck 0 errors, biome clean, web tests 25/25, e2e `tsc` clean.

## T-005 round 2 — promo #1618 GREEN ✅ (2026-06-13)

After #1622 merged to `staging`, #1618 re-ran on the new staging HEAD and is
**fully green: `CodeQL = SUCCESS` + `CI Pass = SUCCESS`, 0 failures**. The
pathname-setter cleared the XSS and crypto cleared the randomness. T-005 met.
PR #1618 is **owner-merge-only** (protected `main`) — that's T-007.

## T-006 — prevention: scheduled CodeQL on staging (prepared, PR pending)

Owner chose **option B** (scheduled scan of staging). Repo uses GitHub **default
setup** today (no committed codeql workflow), which only scans `main` + PRs to
`main` — the root cause of invisible staging debt. Migrating to **advanced setup**
on branch `chore/SPEC-220-codeql-staging-scanning`:

- `.github/workflows/codeql.yml` — replaces default setup; scans `main` on
  push + PR for `javascript-typescript` + `actions` (preserves current coverage).
- `.github/workflows/codeql-staging.yml` — nightly (02:15 UTC) + `workflow_dispatch`;
  checks out `staging`, sets the analyze `ref`/`sha` so results attribute to
  `staging`, distinct `/staging` category.
- Runbook: `docs/codeql-advanced-setup-runbook.md` (in this spec dir).

**Rollout (see runbook):** these files are inert on `staging` (schedule fires only
from `main`; push/PR triggers are `main`-scoped). They reach `main` via a promotion
**after** #1618 is merged (do not entangle). The owner must **disable default setup
in the GitHub UI** at the moment that promotion lands `codeql.yml` on `main`
(default + advanced cannot coexist). Uses `github/codeql-action@v4` (current latest).

## Already resolved on staging (clear automatically on promotion)

- **esbuild advisory** (`Security` gate): override tightened to `>=0.28.1` (#1589).
- **E2E babel `declare`-field toolchain**: staging's E2E config handles it; the
  promotion's E2E job passed. (Only a *config-only* PR to main failed E2E, because
  main lacks the toolchain fix.)
