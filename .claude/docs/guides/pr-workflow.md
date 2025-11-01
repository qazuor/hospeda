# Pull Request Workflow with Git Worktrees

## Overview

This guide describes the complete workflow for working with Pull Requests (PRs) using Git Worktrees in the Hospeda project. This approach enables parallel development of multiple features while maintaining code quality through automated checks.

## Prerequisites

- Read [Git Worktrees Guide](./git-worktrees.md) first
- GitHub CLI installed (`gh` command)
- Project cloned and setup complete

## Branch Strategy

### Branch Types

```
main                          # Production-ready code
├── feature/*                 # New features
├── fix/*                     # Bug fixes
├── hotfix/*                  # Critical production fixes
├── refactor/*                # Code refactoring
├── docs/*                    # Documentation updates
└── chore/*                   # Maintenance tasks
```

### Branch Naming Convention

```bash
# Features
feature/user-authentication
feature/search-filters
feature/payment-integration

# Bug fixes
fix/login-validation
fix/database-connection

# Hotfixes
hotfix/critical-payment-bug
hotfix/security-vulnerability

# Refactoring
refactor/service-layer
refactor/api-routes

# Documentation
docs/api-documentation
docs/setup-guide

# Chores
chore/update-dependencies
chore/configure-ci
```

## Complete PR Workflow

### Step 1: Create Feature Branch & Worktree

```bash
# Navigate to main worktree
cd ~/projects/hospeda

# Ensure main is up to date
git checkout main
git pull origin main

# Create feature branch and worktree
git worktree add ../hospeda-feat-auth feature/user-auth

# Navigate to new worktree
cd ../hospeda-feat-auth

# Verify branch
git branch  # Should show: * feature/user-auth
```

### Step 2: Install Dependencies

```bash
# In the new worktree
pnpm install

# Verify everything works
pnpm typecheck
pnpm lint
pnpm test
```

### Step 3: Develop Feature

Follow the appropriate workflow level:

#### For Simple Changes (Level 1: Quick Fix)

```bash
# Make changes
# Run checks
pnpm lint
pnpm typecheck
pnpm test

# Commit
git add <specific-files>
git commit -m "fix: correct typo in documentation"
```

#### For Medium Changes (Level 2: Atomic Task)

```bash
# Follow TDD cycle
# 1. Write tests (Red)
pnpm test -- --watch

# 2. Implement feature (Green)
# Write code...

# 3. Refactor
# Improve code...

# Run all checks
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage

# Commit atomically
git add <task-related-files-only>
git commit -m "feat(auth): implement user login endpoint"
```

#### For Complex Changes (Level 3: Feature Planning)

```bash
# Follow Phase 1-4 workflow
# See: .claude/docs/workflows/phase-1-planning.md

# Create planning session
# Implement tasks incrementally
# Commit after each completed task

git add <task-files>
git commit -m "feat(auth): implement JWT token generation [T-001-001]"
```

### Step 4: Keep Branch Updated

```bash
# Regularly sync with main to avoid conflicts
cd ~/projects/hospeda-feat-auth

# Fetch latest changes
git fetch origin main

# Rebase on main (preferred)
git rebase origin/main

# Or merge (if rebase is complex)
git merge origin/main

# Push updated branch
git push origin feature/user-auth --force-with-lease  # if rebased
# or
git push origin feature/user-auth  # if merged
```

### Step 5: Run Pre-PR Checks

Before creating PR, ensure all checks pass:

```bash
# Full quality check
pnpm typecheck    # TypeScript errors
pnpm lint         # Code style
pnpm test         # All tests
pnpm test:coverage  # Coverage >= 90%

# Format markdown docs
pnpm format:md

# Build to verify no build errors
pnpm build

# Check for uncommitted changes
git status

# Verify commit history is clean
git log --oneline -10
```

### Step 6: Push Branch

```bash
# First time push
git push -u origin feature/user-auth

# Subsequent pushes
git push origin feature/user-auth

# If you rebased
git push origin feature/user-auth --force-with-lease
```

### Step 7: Create Pull Request

#### Option A: Using GitHub CLI (Recommended)

```bash
# Create PR with title and body
gh pr create \
  --title "feat(auth): implement user authentication" \
  --body "
## Summary
Implements user authentication with JWT tokens.

## Changes
- Add login endpoint
- Add JWT generation
- Add authentication middleware
- Add tests for auth flows

## Testing
- [ ] Unit tests pass (90%+ coverage)
- [ ] Integration tests pass
- [ ] Manual testing completed

## Related Issues
Closes #123
" \
  --base main \
  --head feature/user-auth

# Create draft PR (work in progress)
gh pr create --draft \
  --title "WIP: feat(auth): implement user authentication" \
  --body "Work in progress, not ready for review"

# Add labels
gh pr edit --add-label "feature" --add-label "authentication"

# Request reviewers
gh pr edit --add-reviewer @teammate

# Assign yourself
gh pr edit --add-assignee @me
```

#### Option B: Using GitHub Web Interface

1. Go to `https://github.com/qazuor/hospeda`
2. Click "Compare & pull request" button
3. Fill in title and description
4. Select reviewers, labels, assignees
5. Click "Create pull request"

### Step 8: Wait for CI/CD Checks

GitHub Actions will automatically run:

1. ✅ **Lighthouse CI** - Performance, A11y, SEO checks
2. ✅ **Bundle Size** - Check for bundle size regressions
3. ✅ **CodeQL** - Security analysis
4. ✅ **Tests** - Run all tests
5. ✅ **Lint** - Code style checks
6. ✅ **Typecheck** - TypeScript validation
7. ✅ **Build** - Verify build succeeds

Monitor checks:

```bash
# View PR status
gh pr view

# View checks
gh pr checks

# View detailed CI logs
gh run view --log

# Rerun failed checks
gh run rerun
```

### Step 9: Address Review Comments

```bash
# Still in worktree: ~/projects/hospeda-feat-auth

# Make requested changes
# ... edit files ...

# Commit changes
git add <files>
git commit -m "refactor(auth): address PR review comments"

# Push updates
git push origin feature/user-auth

# Respond to comments on GitHub
gh pr comment --body "Fixed the validation logic as requested"

# Mark conversations as resolved (on GitHub web)
```

### Step 10: Handle CI Failures

#### Lighthouse CI Failure

```bash
# Check Lighthouse report
gh pr view --web  # View PR on GitHub, check Lighthouse comment

# Fix performance issues
# - Optimize images
# - Reduce bundle size
# - Improve loading strategy

# Re-run checks
git push origin feature/user-auth
```

#### Bundle Size Failure

```bash
# Analyze bundle
pnpm build
pnpm analyze  # if script exists

# Solutions:
# - Use dynamic imports
# - Remove unused dependencies
# - Split large components

# Commit fix
git add <files>
git commit -m "perf: reduce bundle size with code splitting"
git push origin feature/user-auth
```

#### CodeQL Security Issues

```bash
# View CodeQL alerts
gh pr checks

# Fix security vulnerabilities
# - SQL injection → use parameterized queries
# - XSS → sanitize inputs
# - Sensitive data exposure → use environment variables

# Commit fix
git add <files>
git commit -m "security: fix SQL injection vulnerability"
git push origin feature/user-auth
```

#### Test Failures

```bash
# Run failed tests locally
pnpm test -- --reporter=verbose

# Fix tests or code
# ... make changes ...

# Verify fix
pnpm test

# Commit fix
git add <files>
git commit -m "test: fix failing authentication tests"
git push origin feature/user-auth
```

### Step 11: Merge PR

#### Auto-merge (if configured)

```bash
# Enable auto-merge when all checks pass
gh pr merge --auto --squash
# or
gh pr merge --auto --merge
# or
gh pr merge --auto --rebase
```

#### Manual Merge

```bash
# Merge PR (squash recommended for clean history)
gh pr merge --squash

# Or merge with separate commits
gh pr merge --merge

# Or rebase (keep all commits)
gh pr merge --rebase

# Delete branch after merge
gh pr merge --delete-branch
```

### Step 12: Cleanup Worktree

```bash
# Navigate to main worktree
cd ~/projects/hospeda

# Update main branch
git checkout main
git pull origin main

# Remove worktree
git worktree remove ../hospeda-feat-auth

# Delete local branch
git branch -D feature/user-auth

# Verify cleanup
git worktree list
git branch -a
```

## Parallel Development Workflow

### Working on Multiple PRs

```bash
# Main worktree - always on main branch
cd ~/projects/hospeda

# Feature 1: User Authentication
git worktree add ../hospeda-feat-auth feature/user-auth
cd ../hospeda-feat-auth
pnpm install
pnpm dev --filter=api
# Open terminal 1, start working...

# Feature 2: Search Filters (NEW TERMINAL)
cd ~/projects/hospeda
git worktree add ../hospeda-feat-search feature/search-filters
cd ../hospeda-feat-search
pnpm install
pnpm dev --filter=web --port 4322
# Open terminal 2, start working...

# Hotfix: Critical Bug (NEW TERMINAL)
cd ~/projects/hospeda
git worktree add ../hospeda-hotfix-payment hotfix/payment-timeout
cd ../hospeda-hotfix-payment
pnpm install
pnpm test --filter=@repo/payments
# Open terminal 3, fix urgently...

# Now you have:
# - Terminal 1: Working on auth feature
# - Terminal 2: Working on search feature
# - Terminal 3: Fixing critical bug
# All independently, no context switching!
```

### Managing Multiple PRs

```bash
# View all your PRs
gh pr list --author "@me"

# View all open PRs
gh pr list --state open

# View specific PR
gh pr view 123

# Check status of multiple PRs
for pr in $(gh pr list --author "@me" --json number -q '.[].number'); do
  echo "PR #$pr:"
  gh pr checks $pr
  echo ""
done
```

### Worktree-PR Mapping

Keep track of worktrees and their PRs:

```bash
# List all worktrees with branches
git worktree list

# Output:
# /home/user/projects/hospeda                    abc1234 [main]
# /home/user/projects/hospeda-feat-auth          def5678 [feature/user-auth]
# /home/user/projects/hospeda-feat-search        ghi9012 [feature/search-filters]
# /home/user/projects/hospeda-hotfix-payment     jkl3456 [hotfix/payment-timeout]

# For each worktree, check PR status
cd ~/projects/hospeda-feat-auth
gh pr view  # Shows PR details if exists

cd ~/projects/hospeda-feat-search
gh pr view

cd ~/projects/hospeda-hotfix-payment
gh pr view
```

## Reviewing PRs

### Review Someone Else's PR

```bash
# From main worktree
cd ~/projects/hospeda

# Fetch PR branch
gh pr checkout 123  # Creates temporary branch

# Or create worktree for review
git fetch origin pull/123/head:pr-123-review
git worktree add ../hospeda-review-123 pr-123-review

cd ../hospeda-review-123

# Install and test
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm dev

# Leave review comments
gh pr review 123 --comment --body "LGTM! Just a minor suggestion on line 45."

# Request changes
gh pr review 123 --request-changes --body "Please add error handling for edge cases."

# Approve
gh pr review 123 --approve --body "Excellent work! Approved."

# Cleanup after review
cd ~/projects/hospeda
git worktree remove ../hospeda-review-123
git branch -D pr-123-review
```

### Review Your Own PR

```bash
# View PR diff
gh pr diff 123

# View PR on web
gh pr view 123 --web

# Check review comments
gh pr view 123

# See CI status
gh pr checks 123
```

## Advanced Patterns

### Stacked PRs (Dependent PRs)

```bash
# PR 1: Base feature
cd ~/projects/hospeda
git worktree add ../hospeda-feat-base feature/base-auth
cd ../hospeda-feat-base
# Implement base...
git push origin feature/base-auth
gh pr create --title "feat: base authentication"

# PR 2: Depends on PR 1
cd ~/projects/hospeda
git worktree add ../hospeda-feat-advanced feature/advanced-auth
cd ../hospeda-feat-advanced
git merge feature/base-auth  # Base on PR 1
# Implement advanced...
git push origin feature/advanced-auth
gh pr create \
  --title "feat: advanced authentication" \
  --body "Depends on #123" \
  --base feature/base-auth  # Base on PR 1, not main

# After PR 1 merges:
cd ../hospeda-feat-advanced
git rebase main
git push origin feature/advanced-auth --force-with-lease
gh pr edit 124 --base main  # Change base to main
```

### Draft PRs for Feedback

```bash
# Create draft PR early
gh pr create --draft \
  --title "WIP: feat(auth): implement authentication" \
  --body "Early draft for feedback. Not ready for review yet."

# Continue working...
# Push updates regularly...

# When ready, mark as ready for review
gh pr ready
```

### PR Templates

Create `.github/pull_request_template.md`:

```markdown
## Summary

<!-- Brief description of changes -->

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Dependency update

## Changes

<!-- List main changes -->

-
-
-

## Testing

- [ ] Unit tests added/updated (90%+ coverage)
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] All tests pass locally

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated (if needed)
- [ ] No console.log or debugging code
- [ ] Committed only task-related files

## Screenshots (if applicable)

<!-- Add screenshots for UI changes -->

## Related Issues

<!-- Link related issues -->
Closes #

## Additional Notes

<!-- Any other context -->
```

### Hot Fix Workflow

```bash
# Critical bug in production!

# 1. Create hotfix worktree immediately
cd ~/projects/hospeda
git worktree add ../hospeda-hotfix-critical hotfix/payment-processing
cd ../hospeda-hotfix-critical

# 2. Create branch from main (or production tag)
git checkout main
git checkout -b hotfix/payment-processing

# 3. Fix the bug
# ... make minimal changes ...

# 4. Test thoroughly
pnpm test --filter=@repo/payments
pnpm test:coverage

# 5. Commit and push
git add <fix-files-only>
git commit -m "hotfix: fix payment processing timeout"
git push -u origin hotfix/payment-processing

# 6. Create PR with priority
gh pr create \
  --title "HOTFIX: Fix payment processing timeout" \
  --body "Critical fix for production bug" \
  --label "hotfix" \
  --label "priority:critical"

# 7. Get immediate review and merge
# After merge, cleanup
cd ~/projects/hospeda
git worktree remove ../hospeda-hotfix-critical
```

## Troubleshooting

### PR Conflicts with Main

```bash
cd ~/projects/hospeda-feat-auth

# Update from main
git fetch origin main

# Try rebase first (cleaner history)
git rebase origin/main

# If conflicts occur
# 1. Fix conflicts in files
# 2. git add <resolved-files>
# 3. git rebase --continue

# If rebase gets messy, abort and merge instead
git rebase --abort
git merge origin/main
# Fix conflicts, commit

# Push updated branch
git push origin feature/user-auth --force-with-lease  # if rebased
# or
git push origin feature/user-auth  # if merged
```

### CI Checks Stuck or Failed

```bash
# View detailed logs
gh run view --log

# Rerun failed jobs
gh run rerun

# Cancel stuck workflow
gh run cancel

# Push empty commit to retrigger
git commit --allow-empty -m "chore: retrigger CI"
git push origin feature/user-auth
```

### Accidental Commit to Wrong Branch

```bash
# Oh no! Committed to main instead of feature branch

# 1. Create branch from current commit
git branch feature/my-feature

# 2. Reset main to previous state
git checkout main
git reset --hard origin/main

# 3. Switch to feature branch
git checkout feature/my-feature

# 4. Push feature branch
git push -u origin feature/my-feature
```

### Need to Split Large PR

```bash
# PR is too large, split into multiple PRs

cd ~/projects/hospeda-feat-large

# Create branches for each part
git checkout -b feature/part-1
git cherry-pick <commits-for-part-1>
git push -u origin feature/part-1
gh pr create --title "feat: part 1 of feature"

git checkout feature/large-feature
git checkout -b feature/part-2
git cherry-pick <commits-for-part-2>
git push -u origin feature/part-2
gh pr create --title "feat: part 2 of feature" --base feature/part-1

# Close original large PR
gh pr close <original-pr-number>
```

## Best Practices

### DO ✅

- ✅ Create worktree per PR
- ✅ Keep PRs small and focused (< 500 lines)
- ✅ Write descriptive PR titles and descriptions
- ✅ Link related issues
- ✅ Run all checks before pushing
- ✅ Respond to review comments promptly
- ✅ Update branch regularly from main
- ✅ Use draft PRs for early feedback
- ✅ Clean up worktrees after merge
- ✅ Use atomic commits

### DON'T ❌

- ❌ Create PRs with failing tests
- ❌ Mix unrelated changes in one PR
- ❌ Use `git add .` (only add task-related files)
- ❌ Force push without `--force-with-lease`
- ❌ Ignore CI failures
- ❌ Merge without approval (unless auto-merge configured)
- ❌ Leave stale worktrees around
- ❌ Commit directly to main

## Quick Reference

```bash
# Create PR workflow
git worktree add ../hospeda-feat-{name} feature/{name}
cd ../hospeda-feat-{name}
pnpm install
# ... develop ...
git push -u origin feature/{name}
gh pr create

# Update PR
# ... make changes ...
git commit -m "feat: updates"
git push origin feature/{name}

# Cleanup after merge
cd ~/projects/hospeda
git pull origin main
git worktree remove ../hospeda-feat-{name}
git branch -D feature/{name}
```

## Related Documentation

- [Git Worktrees Guide](./git-worktrees.md)
- [Workflow Decision Tree](../workflows/decision-tree.md)
- [Atomic Task Protocol](../workflows/atomic-task-protocol.md)
- [Feature Planning](../workflows/phase-1-planning.md)

---

**Next Steps:**

1. Practice creating a worktree for a small PR
2. Familiarize yourself with `gh` CLI commands
3. Set up shell aliases for common operations
4. Review PR template and customize if needed
