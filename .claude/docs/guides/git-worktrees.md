# Git Worktrees Guide

## Overview

Git worktrees allow you to work on multiple branches simultaneously in separate directories, without the overhead of cloning the repository multiple times. This is essential for working on multiple PRs in parallel.

## Why Worktrees?

### Without Worktrees (Traditional)

```bash
# Working on feature-1
git checkout feature-1
# Make changes...

# Need to work on feature-2
git stash  # or commit
git checkout feature-2
# Make changes...

# Switch back to feature-1
git checkout feature-1
git stash pop

# Problems:
# - Constant context switching
# - Risk of losing uncommitted work
# - Can't run both features simultaneously
# - IDE/build state resets on each switch
```

### With Worktrees

```bash
# Main worktree
~/projects/hospeda/              → main branch

# Additional worktrees
~/projects/hospeda-feature-1/    → feature-1 branch
~/projects/hospeda-feature-2/    → feature-2 branch
~/projects/hospeda-hotfix/       → hotfix/critical-bug branch

# Benefits:
# ✅ Work on multiple branches simultaneously
# ✅ No context switching
# ✅ Separate node_modules per worktree
# ✅ Run dev servers for multiple features
# ✅ Easy comparison between branches
# ✅ Shared git history (saves disk space)
```

## Core Concepts

### Repository Structure

```
hospeda/                          # Main worktree (bare or with branch)
├── .git/                         # Shared git directory
│   ├── worktrees/                # Worktree metadata
│   │   ├── feature-1/
│   │   ├── feature-2/
│   │   └── hotfix/
│   └── ...
├── apps/
├── packages/
└── ...

hospeda-feature-1/                # Linked worktree (feature-1 branch)
├── .git                          # File pointing to main .git
├── apps/
├── packages/
└── ...

hospeda-feature-2/                # Linked worktree (feature-2 branch)
├── .git                          # File pointing to main .git
├── apps/
├── packages/
└── ...
```

### Important Points

1. **Shared Git History**: All worktrees share the same `.git` directory
2. **Independent Working Directories**: Each worktree has its own files
3. **Branch Checkout**: Each worktree has a different branch checked out
4. **No Branch Conflicts**: Same branch can't be checked out in multiple worktrees

## Basic Commands

### Create a New Worktree

```bash
# From main worktree directory
cd ~/projects/hospeda

# Create worktree for new feature
git worktree add ../hospeda-feature-auth feature/user-auth

# This:
# 1. Creates directory ../hospeda-feature-auth
# 2. Creates and checks out branch feature/user-auth
# 3. Links worktree to main .git directory
```

### Create Worktree from Existing Branch

```bash
# For existing remote branch
git worktree add ../hospeda-hotfix hotfix/critical-bug

# For existing local branch
git worktree add ../hospeda-refactor refactor/service-layer
```

### Create Worktree with Custom Path

```bash
# You can use any path
git worktree add ~/code/hospeda-experiments feature/experiments
git worktree add /tmp/hospeda-test feature/test
```

### List All Worktrees

```bash
git worktree list

# Output:
# /home/user/projects/hospeda              abc1234 [main]
# /home/user/projects/hospeda-feature-1    def5678 [feature/user-auth]
# /home/user/projects/hospeda-feature-2    ghi9012 [feature/payment]
```

### List with Details

```bash
git worktree list --porcelain

# Output includes:
# - Full paths
# - Branch names
# - HEAD commits
# - Status (locked/prunable)
```

### Remove a Worktree

```bash
# Option 1: Delete directory first
rm -rf ../hospeda-feature-auth
git worktree prune

# Option 2: Use git worktree remove (Git 2.17+)
git worktree remove ../hospeda-feature-auth

# Option 3: Remove with force (if there are uncommitted changes)
git worktree remove --force ../hospeda-feature-auth
```

### Move a Worktree

```bash
# Git 2.17+
git worktree move ../hospeda-feature-auth ~/new-location/hospeda-feature-auth

# Older versions: manual move + prune + add
mv ../hospeda-feature-auth ~/new-location/
git worktree prune
git worktree add ~/new-location/hospeda-feature-auth feature/user-auth
```

### Lock/Unlock Worktrees

```bash
# Lock worktree (prevent removal)
git worktree lock ../hospeda-feature-auth --reason "Work in progress"

# Unlock
git worktree unlock ../hospeda-feature-auth

# List locked worktrees
git worktree list --porcelain | grep -A 3 "locked"
```

### Repair Worktrees

```bash
# If worktree links are broken (after moving main repo)
git worktree repair

# Repair specific worktree
git worktree repair ../hospeda-feature-auth
```

## Workflow Patterns

### Pattern 1: Feature Branch PR

```bash
# 1. Create feature branch worktree
cd ~/projects/hospeda
git worktree add ../hospeda-feat-search feature/search-filters

# 2. Work on feature
cd ../hospeda-feat-search
pnpm install
pnpm dev

# 3. Make changes, commit, push
git add .
git commit -m "feat: add search filters"
git push origin feature/search-filters

# 4. Create PR on GitHub

# 5. After PR merged, cleanup
cd ~/projects/hospeda
git worktree remove ../hospeda-feat-search
git branch -d feature/search-filters
```

### Pattern 2: Multiple PRs in Parallel

```bash
# Main worktree
cd ~/projects/hospeda  # main branch

# Feature 1: Authentication
git worktree add ../hospeda-auth feature/auth
cd ../hospeda-auth
pnpm install
pnpm dev --filter=api  # Port 3001

# Feature 2: Payment integration (in another terminal)
cd ~/projects/hospeda
git worktree add ../hospeda-payment feature/payment
cd ../hospeda-payment
pnpm install
pnpm dev --filter=web  # Port 4321

# Feature 3: Admin dashboard (in another terminal)
cd ~/projects/hospeda
git worktree add ../hospeda-admin feature/admin-refactor
cd ../hospeda-admin
pnpm install
pnpm dev --filter=admin  # Port 3000

# Now you can:
# - Test auth API while developing payment UI
# - Compare implementations
# - Run tests in parallel
# - No context switching needed
```

### Pattern 3: Hotfix on Production

```bash
# Critical bug found in production
cd ~/projects/hospeda
git worktree add ../hospeda-hotfix hotfix/payment-error

cd ../hospeda-hotfix
git checkout main  # or production branch
git checkout -b hotfix/payment-error

# Fix bug, test, commit
pnpm test
git commit -m "fix: payment gateway timeout"
git push origin hotfix/payment-error

# Create PR for immediate merge
# After merge, cleanup
cd ~/projects/hospeda
git worktree remove ../hospeda-hotfix
```

### Pattern 4: Code Review / Testing PRs

```bash
# Reviewing teammate's PR #123
cd ~/projects/hospeda
git fetch origin pull/123/head:pr-123
git worktree add ../hospeda-review-123 pr-123

cd ../hospeda-review-123
pnpm install
pnpm test
pnpm dev

# Test changes, leave feedback
# After review, cleanup
cd ~/projects/hospeda
git worktree remove ../hospeda-review-123
git branch -d pr-123
```

### Pattern 5: Comparison Testing

```bash
# Compare old vs new implementation
cd ~/projects/hospeda

# Current main
git worktree add ../hospeda-main-compare main

# Feature branch
git worktree add ../hospeda-feature-compare feature/new-search

# Terminal 1: Run old version
cd ../hospeda-main-compare
pnpm dev

# Terminal 2: Run new version
cd ../hospeda-feature-compare
pnpm dev --port 4322

# Compare performance, behavior, etc.
```

## Best Practices

### Naming Conventions

```bash
# Pattern: {project}-{type}-{description}

# Feature branches
hospeda-feat-auth
hospeda-feat-search
hospeda-feat-payment

# Bug fixes
hospeda-fix-login
hospeda-fix-validation

# Hotfixes
hospeda-hotfix-critical

# Refactoring
hospeda-refactor-services

# Code reviews
hospeda-review-123  # PR number
hospeda-review-auth  # by topic

# Experiments
hospeda-exp-react19
hospeda-exp-performance
```

### Directory Structure

```bash
# Option 1: Sibling directories (recommended)
~/projects/
├── hospeda/              # main
├── hospeda-feat-auth/
├── hospeda-feat-search/
└── hospeda-hotfix/

# Option 2: Parent directory
~/projects/hospeda/
├── main/                 # main worktree
├── feat-auth/
├── feat-search/
└── hotfix/

# Option 3: By type
~/projects/hospeda/
├── main/
├── features/
│   ├── auth/
│   └── search/
├── bugfixes/
└── hotfixes/
```

### Cleanup Strategy

```bash
# Weekly cleanup of merged branches
git worktree list | grep -v "main" | while read path commit branch; do
  cd "$path"

  # Check if branch is merged
  if git branch -r --merged main | grep -q "${branch#\[}"; then
    echo "Removing merged worktree: $path"
    cd ~/projects/hospeda
    git worktree remove "$path"
    git branch -d "${branch#\[}"
  fi
done
```

### Git Aliases

Add to `~/.gitconfig`:

```ini
[alias]
  # Create worktree with conventional naming
  wt-add = "!f() { \
    git worktree add ../${PWD##*/}-$1 $1; \
  }; f"

  # List worktrees nicely
  wt-list = worktree list

  # Remove worktree and branch
  wt-remove = "!f() { \
    git worktree remove $1 && \
    git branch -d $(git worktree list | grep $1 | awk '{print $3}' | tr -d '[]'); \
  }; f"

  # Cleanup merged worktrees
  wt-clean = "!git worktree prune"
```

Usage:

```bash
git wt-add feature/auth
git wt-list
git wt-remove ../hospeda-feature-auth
git wt-clean
```

## Common Issues & Solutions

### Issue 1: Branch Already Checked Out

```bash
# Error: 'feature/auth' is already checked out at '/path/to/other/worktree'

# Solution 1: Use different branch
git worktree add ../hospeda-auth-2 feature/auth-v2

# Solution 2: Remove old worktree first
git worktree remove /path/to/other/worktree
git worktree add ../hospeda-auth feature/auth

# Solution 3: Use --detach (not recommended)
git worktree add --detach ../hospeda-auth-detached
```

### Issue 2: Broken Worktree Links

```bash
# After moving main repository

# Repair all worktrees
git worktree repair

# Or repair specific
git worktree repair ../hospeda-feature-auth

# If still broken, recreate
git worktree remove ../hospeda-feature-auth
git worktree add ../hospeda-feature-auth feature/auth
```

### Issue 3: Disk Space

```bash
# Each worktree has separate node_modules

# Check disk usage
du -sh ../hospeda-*/node_modules

# Solution 1: Use pnpm (shares packages across worktrees)
# Already configured in project!

# Solution 2: Symlink node_modules (not recommended)
# Can cause issues with different branches

# Solution 3: Cleanup unused worktrees
git worktree prune
```

### Issue 4: Can't Delete Worktree

```bash
# Uncommitted changes

# Option 1: Commit or stash
cd ../hospeda-feature-auth
git stash
cd ~/projects/hospeda
git worktree remove ../hospeda-feature-auth

# Option 2: Force remove
git worktree remove --force ../hospeda-feature-auth
```

### Issue 5: Branch Tracking

```bash
# Create worktree with remote tracking
git worktree add ../hospeda-feature-auth -b feature/auth origin/feature/auth

# Set upstream after creation
cd ../hospeda-feature-auth
git branch --set-upstream-to=origin/feature/auth
```

## Integration with Hospeda Project

### Setup Script

Create `.claude/scripts/worktree-create.sh`:

```bash
#!/bin/bash
# Create worktree with project conventions

set -e

if [ -z "$1" ]; then
  echo "Usage: ./worktree-create.sh <branch-name> [base-branch]"
  echo "Example: ./worktree-create.sh feature/auth main"
  exit 1
fi

BRANCH=$1
BASE_BRANCH=${2:-main}
WORKTREE_NAME="hospeda-${BRANCH//\//-}"
WORKTREE_PATH="../${WORKTREE_NAME}"

echo "Creating worktree for branch: $BRANCH"
echo "Base branch: $BASE_BRANCH"
echo "Path: $WORKTREE_PATH"

# Create worktree
git worktree add "$WORKTREE_PATH" -b "$BRANCH" "$BASE_BRANCH"

# Install dependencies
cd "$WORKTREE_PATH"
echo "Installing dependencies..."
pnpm install

echo ""
echo "✅ Worktree created successfully!"
echo "📁 Path: $WORKTREE_PATH"
echo "🌿 Branch: $BRANCH"
echo ""
echo "Next steps:"
echo "  cd $WORKTREE_PATH"
echo "  pnpm dev"
```

### Cleanup Script

Create `.claude/scripts/worktree-cleanup.sh`:

```bash
#!/bin/bash
# Cleanup merged worktrees

set -e

echo "🧹 Cleaning up merged worktrees..."

git worktree list --porcelain | grep -A 3 "^worktree" | while read -r line; do
  if [[ $line == worktree* ]]; then
    WORKTREE_PATH=${line#worktree }
  elif [[ $line == branch* ]]; then
    BRANCH=${line#branch refs/heads/}

    # Skip main branch
    if [[ $BRANCH == "main" ]]; then
      continue
    fi

    # Check if merged
    if git branch --merged main | grep -q "^  $BRANCH\$"; then
      echo "Removing merged worktree: $WORKTREE_PATH ($BRANCH)"
      git worktree remove "$WORKTREE_PATH" || true
      git branch -d "$BRANCH" || true
    fi
  fi
done

# Prune deleted worktrees
git worktree prune

echo "✅ Cleanup complete!"
```

### VS Code Multi-root Workspace

Create `hospeda-worktrees.code-workspace`:

```json
{
  "folders": [
    {
      "name": "Main (main)",
      "path": "."
    },
    {
      "name": "Feature: Auth",
      "path": "../hospeda-feat-auth"
    },
    {
      "name": "Feature: Payment",
      "path": "../hospeda-feat-payment"
    }
  ],
  "settings": {
    "files.exclude": {
      "**/node_modules": true,
      "**/.git": true
    }
  }
}
```

Open with: `code hospeda-worktrees.code-workspace`

### Shell Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
# Navigate to worktrees
alias wt-main='cd ~/projects/hospeda'
alias wt-list='cd ~/projects/hospeda && git worktree list'

# Create feature worktree
wt-feature() {
  cd ~/projects/hospeda
  ./.claude/scripts/worktree-create.sh "feature/$1" main
  cd "../hospeda-feature-$1"
}

# Create hotfix worktree
wt-hotfix() {
  cd ~/projects/hospeda
  ./.claude/scripts/worktree-create.sh "hotfix/$1" main
  cd "../hospeda-hotfix-$1"
}

# Cleanup merged worktrees
wt-clean() {
  cd ~/projects/hospeda
  ./.claude/scripts/worktree-cleanup.sh
}
```

Usage:

```bash
wt-feature auth        # Creates hospeda-feat-auth
wt-hotfix critical     # Creates hospeda-hotfix-critical
wt-list               # List all worktrees
wt-clean              # Cleanup merged
```

## Advanced Patterns

### Worktree Per Package

```bash
# For large monorepo changes
git worktree add ../hospeda-pkg-db packages/db
cd ../hospeda-pkg-db

# Work only on db package
pnpm --filter @repo/db test
pnpm --filter @repo/db typecheck
```

### Temporary Worktree for Quick Tests

```bash
# Test a hypothesis quickly
git worktree add /tmp/hospeda-test-$(date +%s) -b temp/test
cd /tmp/hospeda-test-*
# Experiment...
cd ~/projects/hospeda
git worktree remove --force /tmp/hospeda-test-*
```

### Worktree for Bisect

```bash
# Binary search for bug introduction
git worktree add ../hospeda-bisect-test
cd ../hospeda-bisect-test
git bisect start HEAD main
git bisect run pnpm test

# After finding bad commit
cd ~/projects/hospeda
git worktree remove ../hospeda-bisect-test
```

## References

- [Official Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [Git Worktree Tutorial](https://spin.atomicobject.com/2016/06/26/parallelize-development-git-worktrees/)
- [Monorepo with Git Worktrees](https://morgan.cugerone.com/blog/workarounds-to-git-worktree-using-bare-repository-and-cannot-fetch-remote-branches/)

## Summary

### Key Takeaways

1. ✅ **One branch per worktree** - parallel development without switching
2. ✅ **Shared git history** - efficient disk usage
3. ✅ **Independent environments** - separate node_modules, configs
4. ✅ **Perfect for PRs** - work on multiple PRs simultaneously
5. ✅ **Easy cleanup** - remove worktree, delete branch, done

### When to Use Worktrees

- ✅ Multiple PRs in parallel
- ✅ Code review without losing current work
- ✅ Comparing implementations
- ✅ Urgent hotfix while working on feature
- ✅ Testing different branches simultaneously

### When NOT to Use Worktrees

- ❌ Quick branch switches (just use `git checkout`)
- ❌ Very large repos with slow installs
- ❌ Limited disk space
- ❌ Single-branch workflow

---

**Next:** See [PR Workflow Guide](./pr-workflow.md) for how to integrate worktrees with PRs.
