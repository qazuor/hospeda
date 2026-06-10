# Git Branch Workflow

> **Established**: 2026-05-12. Applies to ALL new work in this repo unless explicitly overridden.

## TL;DR

Every change follows this 6-step flow:

1. **Cut a worktree/branch from `staging`** (NOT from `main`).
2. Make changes in that branch.
3. Leave everything green on that branch (typecheck + lint + tests).
4. Open a PR.
5. Merge the PR into `staging`.
6. Only AFTER the change has been observed in `staging` for a while AND the user explicitly says so, merge `staging` into `main`.

## The Branches

| Branch | Purpose | Who merges here |
|--------|---------|-----------------|
| `main` | Production-equivalent baseline. Stable. | Only `staging` → `main`, on user instruction |
| `staging` | Integration line. CI green at all times. | All feature/fix branches via PR |
| `feature/*`, `fix/*`, `spec/SPEC-NNN-*`, etc. | Branched from `staging`. One change per branch. | N/A (this is where work happens) |

`main` is NOT the integration target. Treat it as "what production should look like once we've validated it in staging".

## The 6-Step Flow (Detailed)

### 1. Cut the branch from `staging`

Always start from a fresh `staging`:

```bash
git checkout staging
git pull origin staging

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

PR target is ALWAYS `staging`, never `main`.

### 5. Merge to `staging`

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

This workflow supersedes the "ask first" worktree policy for formal specs (which already default to worktree-on). For non-spec work, the global "ask first" rule from `~/.claude/CLAUDE.md` still applies — but when a worktree IS created, the base branch is `staging`, not `main`.

## Why This Workflow

- **`staging` is the integration line**: it absorbs the noise of integration (merge conflicts, accidental regressions) without dragging `main` along.
- **`main` represents validated state**: anything in `main` has soaked in `staging` first.
- **Hotfix path stays clean**: when production breaks, the fix goes to `main` first and is back-merged.
- **Worktree-from-staging means feature branches diverge LESS**: when you branch from `staging` (which already has recent integration), your branch is closer to its merge target than if you branched from a stale `main`.

## Anti-Patterns

- ❌ Branching `feature/*` from `main` — always branch from `staging`.
- ❌ Opening PRs targeting `main` — always target `staging`.
- ❌ Auto-merging `staging` → `main` after every PR — wait for user signal.
- ❌ Force-pushing to `main` or `staging` — both are protected by policy.
- ❌ Skipping the green check before PR — CI will fail and waste cycles.
- ❌ Cutting hotfixes from `staging` — hotfixes go from `main` and back-merge.

## See Also

- [Development Workflow](development-workflow.md) — overall SDD + Test-Informed flow.
- [Worktree Policy](~/.claude/CLAUDE.md#worktree-policy) — when to use worktrees.
- [Worktree Dev Environments](../../docs/guides/worktree-dev-environments.md) — one-command `wt:up` / `wt:down` to run a worktree's full stack (isolated ports + DB, auto-heal).
