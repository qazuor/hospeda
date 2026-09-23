# Git Branch Workflow

> **Established**: 2026-05-12. Applies to ALL new work in this repo unless explicitly overridden.

## TL;DR

Every change follows this 6-step flow:

1. **Cut a worktree/branch from `develop`** by default (NOT from `main`). Use
   `--base staging` only for an explicitly urgent path.
2. Make changes in that branch.
3. Leave everything green on that branch (typecheck + lint + tests).
4. Open a PR to `develop` by default.
5. Promote `develop` into `staging` only after the requested integration gate.
6. Only AFTER the change has been observed in `staging` for a while AND the user explicitly says so, merge `staging` into `main`.

## The Branches

| Branch | Purpose | Who merges here |
|--------|---------|-----------------|
| `main` | Production-equivalent baseline. Stable. | Only `staging` → `main`, on user instruction |
| `staging` | Promotion and urgent integration line. | `develop` → `staging`, or an explicitly urgent PR |
| `develop` | Default integration line for completed issues. | Feature/fix branches via PR |
| `feature/*`, `fix/*`, `spec/SPEC-NNN-*`, etc. | Branched from `develop` by default. | N/A (this is where work happens) |

`main` is NOT the integration target. Treat it as "what production should look like once we've validated it in staging".

## The 6-Step Flow (Detailed)

### 1. Cut the branch from `develop`

Always start from a fresh `staging`:

```bash
git checkout develop
git pull origin develop

# Branch naming follows conventional commits prefix:
# feat/<slug>, fix/<slug>, refactor/<slug>, chore/<slug>, docs/<slug>, test/<slug>, ci/<slug>
# For formal specs: spec/SPEC-<NNN>-<slug>

# Worktree (preferred for substantial work):
git worktree add ../hospeda-<slug> -b <type>/<slug>

# Or in-place branch:
git checkout -b <type>/<slug>
```

If `.worktreeinclude` exists in the repo, copy the listed files into the new working tree manually — `git worktree add` does NOT honor `.worktreeinclude` (only `claude --worktree` does). Without this, `.env.local` and similar files are missing and apps fail to start.

### 2. Make changes in the branch

Do the work. Commit atomically (conventional commits, stage files individually, never `git add .`).

### 3. Leave everything green

Before opening a PR, the branch MUST be green:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

If you touched DB schema, also: `pnpm db:fresh-dev` and run the relevant integration suite.

### 4. Open a PR

```bash
gh pr create --base staging --title "..." --body "..."
```

PR target is `develop` by default. A direct `staging` target requires an urgent
intent; `main` is reserved for promotion or hotfixes.

### 5. Promote through `staging`

After review + CI green:

```bash
gh pr merge --merge   # or --squash depending on the change
```

Push `staging` if you merged locally:

```bash
git checkout staging
git pull origin staging
git merge --no-ff <type>/<slug>
git push origin staging
```

### 6. Wait, then merge `staging` → `main`

DO NOT merge `staging` into `main` automatically after every PR. The staging branch must be observed running for some time (manual smoke, soak time, the user's call). Only when the user explicitly says "merge staging to main", do:

```bash
git checkout main
git pull origin main
git merge --no-ff staging -m "chore: merge staging into main (<context>)"
git push origin main
```

If commitlint rejects the auto-generated merge message because `merge:` isn't in the allowed types, use `chore:` instead:

```bash
git commit --no-edit -m "chore: merge staging into main (<context>)"
```

## Cleanup After Merge

Once a feature/fix branch is merged into `staging` AND no longer needed locally:

```bash
# If it was a worktree:
git worktree remove ../hospeda-<slug>
git branch -d <type>/<slug>
git push origin --delete <type>/<slug>
```

NEVER use `--force` or `git branch -D` without explicit user confirmation for that specific branch.

If commits are unmerged or there are uncommitted changes in the worktree, STOP and ask — don't delete.

## Hotfix Exception

If `main` is broken in production and needs an immediate fix, the exception is allowed:

1. Branch `fix/hotfix-<slug>` directly from `main`.
2. Fix + green + PR to `main`.
3. After merging to `main`, IMMEDIATELY back-merge `main` → `staging` so the branches stay aligned.

This is the ONLY case where a branch is cut from `main` directly. Document the reason in the PR description.

## Worktree Policy Interaction

This workflow supersedes the "ask first" worktree policy for formal specs (which already default to worktree-on). For non-spec work, the global "ask first" rule from `AGENTS.md` still applies — but when a worktree IS created, the base branch is `develop`, not `main`.

## Why This Workflow

- **`develop` is the default integration line**: it absorbs normal issue work before a deliberate promotion to `staging`.
- **`staging` is the promotion and urgent line**: it can receive a deliberate bypass without dragging `main` along.
- **`main` represents validated state**: anything in `main` has soaked in `staging` first.
- **Hotfix path stays clean**: when production breaks, the fix goes to `main` first and is back-merged.
- **Worktree-from-develop keeps normal work aligned**: the branch starts from the default integration line.

## Anti-Patterns

- ❌ Branching `feature/*` from `main` — always branch from `develop` unless explicitly urgent.
- ❌ Opening ordinary PRs targeting `main` — target `develop`; use `staging` only for a documented bypass.
- ❌ Auto-merging `staging` → `main` after every PR — wait for user signal.
- ❌ Force-pushing to `main`, `staging` or `develop`.
- ❌ Skipping the green check before PR — CI will fail and waste cycles.
- ❌ Cutting hotfixes from `staging` — hotfixes go from `main` and back-merge through `staging` and `develop`.

## See Also

- [Development Workflow](development-workflow.md) — overall SDD + Test-Informed flow.
- [Worktree Policy](../../AGENTS.md) — when to use worktrees.
- [Worktree Dev Environments](../../docs/guides/worktree-dev-environments.md) — one-command `wt:up` / `wt:down` to run a worktree's full stack (isolated ports + DB, auto-heal).
