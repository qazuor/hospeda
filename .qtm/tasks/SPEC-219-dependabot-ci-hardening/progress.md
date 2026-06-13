# SPEC-219 — Progress

## T-001 — Dependabot CI Build failure baseline (absent secrets)

**Status:** done · **Date:** 2026-06-12

### Symptom

Every Dependabot PR fails the **Build** job (and therefore **CI Pass**). Observed on:

- **PR #1548** (`ci: bump the github-actions group with 6 updates`) — run `27259493749`, job `80501485501`.
- **PR #1570** (`chore(deps): bump the production-minor-patch group, 66 updates`) — run `27307983100`, job `80670726251` (plus Guards + E2E failures from real breaking changes; out of scope here).

### Exact failing step (verified from the #1548 Build job log)

The `admin#build` Turbo task fails during `vite build`:

```
> admin@ build /home/runner/work/hospeda/hospeda/apps/admin
> vite build

Admin App environment validation FAILED
Environment validation failed for Admin App:
  - VITE_API_URL: Must be a valid API URL
  - VITE_SITE_URL: Must be a valid site URL
  - HOSPEDA_API_URL: Must be a valid API URL for server-side requests
 ELIFECYCLE  Command failed with exit code 1.

 Tasks:    12 successful, 15 total
Failed:    admin#build
##[error]Process completed with exit code 1.
```

### Root cause

The failing validation is in **`apps/admin/vite.config.ts`** (`AdminViteEnvSchema`), NOT
`src/env.ts`. The config parses `process.env` against `z.string().url()` for `VITE_API_URL`,
`VITE_SITE_URL`, `HOSPEDA_API_URL` (and `min(1)` for `VITE_BETTER_AUTH_URL`) as the config
loads — `process.exit(1)` on failure — which is exactly the `Must be a valid …` message text in
the log. It runs at the very start of `vite build`, before any SSR render. (`src/env.ts`'s
`AdminEnvSchema` / `validateAdminEnv()`, invoked from `src/routes/__root.tsx`, is a SECOND,
runtime-side validation; it also covers `VITE_ADMIN_URL`, which `vite.config.ts` does not.)

In `.github/workflows/ci.yml` the build URLs are injected from repository secrets:

```yaml
HOSPEDA_API_URL: ${{ secrets.HOSPEDA_API_URL }}
VITE_API_URL:    ${{ secrets.HOSPEDA_API_URL }}
VITE_SITE_URL:   ${{ secrets.HOSPEDA_SITE_URL }}
```

**Dependabot-triggered workflow runs execute without access to repository secrets**, so these
arrive as empty strings, fail `z.string().url()`, and abort the build. This is NOT a defect in
any bump — it fails on every Dependabot PR regardless of what it changes.

### Why it fails *only* on Dependabot PRs (not on push to staging)

Verified against the latest successful staging push run (`27432444812`, Build job `81085921192`):

```
 Tasks:    19 successful, 19 total
Cached:    19 cached, 19 total
```

On push runs, `admin#build` is a **Turbo remote-cache HIT** (admin source unchanged), so
`vite build` never re-executes and env validation never runs. Dependabot PRs change
dependency versions → the Turbo cache key changes → `admin#build` is a **cache MISS** →
`vite build` re-runs → validation runs against empty secret values → fail.

### Latent hole discovered (informs the fix)

`VITE_ADMIN_URL` (added by SPEC-182, commit `57b8d1ed7`) is a `z.string().url()` **required**
field in `src/env.ts` but is NOT present in the `ci.yml` Build job env (it only appears in
`e2e-pr.yml` and `apps/admin/.env.example`). The build-time gate (`vite.config.ts`) does NOT
validate it, so it is the runtime gate (`validateAdminEnv` in `__root.tsx`) that would reject an
empty `VITE_ADMIN_URL` if that gate executes during the SSR pre-render of `vite build`. To close
this regardless, the T-002 fix adds `VITE_ADMIN_URL` to the workflow env (placeholder fallback)
so the var is always present, not only the secret-derived URLs.

### Baseline to verify the fix against

- Before fix: Dependabot PR Build job → `admin#build` fails at `vite.config.ts` validation with
  the three URL errors (`VITE_API_URL`, `VITE_SITE_URL`, `HOSPEDA_API_URL`).
- After fix (T-002): the same Build job must succeed with placeholder URLs when secrets are
  empty (placeholders accepted because the Build step sets `ALLOW_PLACEHOLDER_ENV_URLS=true`),
  while push/branch runs still use real secret values and deploy builds reject placeholders
  (build-time guard in `vite.config.ts`, runtime guard in `src/env.ts` — T-006).

## Closeout (2026-06-12) — 7/8, T-005 deferred to promotion

- **T-002/T-006 follow-up (#1587):** `ALLOW_PLACEHOLDER_ENV_URLS` had to move from the
  Build step to **workflow-level env**. It is in Turbo `globalEnv`, so it is part of the
  `admin#build` cache key; downstream jobs (typecheck, test-unit via `dependsOn: build`) ran
  without it, re-ran `vite build`, and the guard rejected the placeholders in a secret-less
  Dependabot run. Only surfaced on #1548 (T-004), not on the SPEC-219 PR (#1585, which had
  real secrets). Also note the real build gate is `apps/admin/vite.config.ts`
  (`AdminViteEnvSchema`, `process.exit` on load), not `src/env.ts`.
- **esbuild advisory (#1589):** an out-of-cycle high-severity advisory for `esbuild <0.28.1`
  (RCE) failed the `Security` gate on every PR/staging push. Tightened the existing override to
  `>=0.28.1`. Orthogonal to SPEC-219 but blocked all merges; fixed separately.
- **T-004:** ✅ confirmed end-to-end — #1548 (github-actions bump) went fully green after rebase
  and was merged.
- **T-005:** ⏳ deferred. The `ignore` is correct but Dependabot reads config from `main`
  (default branch), so it only activates on a `staging → main` promotion. Promotion #1594 was
  **paused** — its large diff surfaces pre-existing CodeQL security debt (E2E babel toolchain
  already fixed on staging; 2 ReDoS fixed in #1596; 1 false-positive DOM-XSS; possibly more).
  That cleanup is tracked in a dedicated follow-up spec. T-005 closes when the promotion lands.
