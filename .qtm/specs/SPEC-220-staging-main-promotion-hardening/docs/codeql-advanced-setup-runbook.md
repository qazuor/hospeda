# CodeQL Advanced Setup — Runbook (SPEC-220 T-006)

## Why this change exists

GitHub CodeQL **default setup** only scans the **default branch** (`main`) on
push and on pull requests targeting `main`. It does not run on `staging`. This
means every security finding introduced on `staging` is invisible until a
`staging → main` promotion is attempted, at which point the entire accumulated
diff is analysed at once. CodeQL itself annotates large promotions with:

> "Alerts not introduced by this pull request might have been detected because
> the code changes were too large."

The concrete cost: promotion PR #1594 (253 commits ahead) surfaced ReDoS and
DOM-XSS findings one-at-a-time, making the promotion impossible to merge until
each was resolved — a slow, disorienting process.

**SPEC-220 T-006** resolves this by switching to **advanced setup** (committed
workflow files) and adding a **nightly scheduled scan of `staging`** so findings
surface continuously, at their source, instead of piling up.

---

## Files introduced

| File | Purpose |
|------|---------|
| `.github/workflows/codeql.yml` | Replaces default setup. Scans `main` on push + PR (same coverage as before). |
| `.github/workflows/codeql-staging.yml` | New. Scans `staging` nightly (02:15 UTC) + on `workflow_dispatch`. |

---

## One-time manual step: disable default setup

**Advanced setup and default setup cannot coexist.** If default setup is still
active when `codeql.yml` reaches `main`, GitHub will report conflicting SARIF
uploads and the Security tab will show duplicate or confusing results.

### When to do it

Disable default setup **at the moment the promotion PR that lands `codeql.yml`
on `main` is merged** (or immediately before merging). Do not disable it earlier
(it would leave `main` unscanned during the gap).

### How to disable

1. Go to the repository on GitHub.
2. Navigate to **Settings** → **Code security and analysis**.
3. Find the **"Code scanning"** section.
4. Next to **"CodeQL analysis"**, click **"..."** (three-dot menu) or the
   **"Disable"** / **"Switch to advanced"** button.
5. Confirm the disablement.

After disabling, the advanced setup workflow (`codeql.yml`) takes over on the
next push to `main` or PR targeting `main`.

---

## Sequencing with the current promotion (PR #1618)

These workflow files are being authored on branch
`chore/SPEC-220-codeql-staging-scanning`, based on `staging`.

**Do NOT entangle with PR #1618** (the current green `staging → main` promotion).
The correct sequence is:

1. PR #1618 merges `staging → main` (the current promotion). This does NOT
   include the CodeQL workflow files — they are on a separate branch.
2. After #1618 is merged and `main` is stable, open a new PR from
   `chore/SPEC-220-codeql-staging-scanning` (or from `staging` after this
   branch is merged into it) targeting `main`.
3. When that PR merges, disable default setup in the GitHub UI (step above).
4. Verify (see section below).

### Why the files are inert on `staging` right now

- `on: push: branches: [main]` — push trigger only fires for `main`. Pushing
  to `staging` does nothing.
- `on: pull_request: branches: [main]` — PR trigger fires only on PRs targeting
  `main`. PRs targeting `staging` are unaffected.
- `on: schedule` — GitHub only executes scheduled workflows from the file on
  the **default branch** (`main`). The nightly `codeql-staging.yml` is
  completely inert until it reaches `main`.

These files reaching `staging` first is safe and intentional — they follow
the standard branch workflow (feature → staging → main).

---

## How the staging scan works (technical detail)

The `codeql-staging.yml` workflow runs from `main` (where schedules execute)
but checks out `refs/heads/staging` explicitly:

```yaml
- uses: actions/checkout@v4
  with:
    ref: staging
```

Because Code Scanning would normally attribute results to the `main` ref
(the GITHUB_REF at runtime), the `analyze` action's `ref` and `sha` inputs
are used to override attribution:

```yaml
- uses: github/codeql-action/analyze@v4
  with:
    ref: refs/heads/staging
    sha: ${{ steps.staging-ref.outputs.sha }}   # resolved via git rev-parse HEAD
    category: /language:${{ matrix.language }}/staging
```

The SHA is resolved by running `git rev-parse HEAD` after the checkout — it
reflects the actual staging HEAD at scan time, not a user-controlled expression.
The distinct `category` (`/staging` suffix) keeps staging results in a separate
Code Scanning bucket so they do not overwrite or interfere with the `main`
baseline.

Source for `ref`/`sha` inputs:
`https://github.com/github/codeql-action/blob/main/analyze/action.yml`

---

## Verifying the rollout

After the promotion PR (with the workflow files) merges into `main` and default
setup is disabled:

### 1. Trigger a manual staging scan

Go to **Actions** → **"CodeQL (staging)"** → **"Run workflow"** → select
branch `main` → **"Run workflow"**.

Wait for the run to complete (typically 5-15 minutes for a JS/TS repo of this
size).

### 2. Check results appear under staging

Go to **Security** → **Code scanning**. In the branch/ref filter, select
`staging`. You should see analysis results attributed to the `staging` ref from
the run you just triggered.

If results only appear under `main`, the `ref`/`sha` override did not take
effect — check the workflow logs for the "Perform CodeQL Analysis" step.

### 3. Verify main coverage is preserved

Open a test PR targeting `main` (or push a trivial commit to `main`). Confirm
the "Analyze (javascript-typescript)" and "Analyze (actions)" checks appear as
required status checks on the PR. Their names come from the `name:` field of
the `analyze` job (`Analyze (${{ matrix.language }})`), which matches the
previous default-setup check names.

---

## Rollback

If something goes wrong and you need to revert to default setup:

1. Delete `.github/workflows/codeql.yml` and `.github/workflows/codeql-staging.yml`
   from `main` (via a PR — do not push directly to `main`).
2. Go to **Settings** → **Code security and analysis** → **CodeQL analysis** →
   **"Set up"** → **"Default"**.
3. Follow the GitHub UI to re-enable default setup.

Default setup will resume scanning `main` on push and PRs as before. Staging
will again be unscanned (the original situation).

---

## codeql-action version

Both workflows use **`github/codeql-action@v4`** (current latest major version
as of 2026-06). The README confirms v4 is the latest supported version:
`https://github.com/github/codeql-action/blob/main/README.md`

Using the major version tag (not a pinned SHA or patch tag) means Dependabot
or manual updates will keep it current within v4 automatically.

---

## Schedule

The staging scan runs at **02:15 UTC daily**. This time is:

- Low-traffic for the Argentina-based team (late night / early morning ARST,
  which is UTC-3).
- Staggered from the top of the hour to avoid GitHub's scheduled-workflow
  load spikes (many repos schedule at `:00`).
- Early enough that findings from the overnight period appear in the Security
  tab before the start of the working day.
