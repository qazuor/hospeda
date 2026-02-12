# Atomic Commits Policy

## Overview

**Atomic commits** are focused, single-purpose commits that contain **only the changes related to one specific task**. This policy ensures clean git history, easier code review, and better debugging capabilities.

---

## Why Atomic Commits Matter

### Benefits

1. **Clear History**: Each commit represents one logical change
2. **Easy Revert**: Roll back specific features without affecting others
3. **Better Reviews**: Reviewers can understand changes in isolation
4. **Improved Debugging**: `git bisect` works more effectively
5. **Cleaner PRs**: Pull requests are focused and easier to understand

### Problems with Non-Atomic Commits

- Mixed changes make history confusing
- Cannot undo one change without affecting others
- Review complexity increases with unrelated changes
- Context for changes becomes unclear

---

## Critical Rules

### When Committing Code

1. **ONLY** commit files modified during THAT specific task
2. **NEVER** use `git add .` or `git add -A`
3. **ALWAYS** use `git add <specific-file>` for task-related files
4. **WARN** if unrelated modified files are detected

### Example Scenario

```bash
# Task: "Create User model"
# git status shows:
M src/models/user.model.ts         # Task file
M test/models/user.model.test.ts   # Task file
M src/routes/orders.ts             # NOT related
M .env.local                       # NOT related

# CORRECT:
git add src/models/user.model.ts
git add test/models/user.model.test.ts
# Only task-related files

# WRONG:
git add .   # Would include unrelated files!
```

### If Unrelated Files Exist

When `git status` shows modified files NOT part of current task:

1. **Inform** about unrelated files
2. **Confirm** proceeding with ONLY task files
3. **Allow override** if explicitly requested

---

## Commit Message Guidelines

Follow **Conventional Commits** format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes bug nor adds feature |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks (deps, config) |
| `perf` | Performance improvement |
| `style` | Code style changes (formatting, no logic change) |
| `ci` | CI/CD configuration changes |
| `build` | Build system or external dependency changes |

### Scopes

Use generic scopes relevant to your project layers:

- `db`, `api`, `ui`, `auth`
- `schemas`, `service`, `utils`
- `config`, `deps`, `ci`

### Examples

```bash
feat(db): add user availability tracking
fix(api): correct date validation logic
refactor(service): extract price calculation utilities
docs(api): update endpoint documentation
test(db): add edge cases for user model
chore(deps): update TypeScript to v5.4
```

---

## Common Patterns

### Pattern 1: Schema + Model + Test

```bash
git add src/schemas/user.schema.ts
git commit -m "feat(schemas): add user validation schema"

git add src/models/user.model.ts
git add test/models/user.model.test.ts
git commit -m "feat(db): implement user model with tests"
```

### Pattern 2: Service + API

```bash
git add src/services/order.service.ts
git add test/services/order.service.test.ts
git commit -m "feat(service): implement order service"

git add src/routes/orders.ts
git add test/routes/orders.test.ts
git commit -m "feat(api): add order endpoints"
```

### Pattern 3: Bug Fix

```bash
git add src/models/product.model.ts
git add test/models/product.model.test.ts
git commit -m "fix(db): correct price calculation for seasonal rates"
```

---

## Anti-Patterns to Avoid

### The "Everything" Commit

```bash
# DON'T
git add .
git commit -m "Updates"
```

### The "Mixed Concerns" Commit

```bash
# DON'T: Three unrelated features
git add src/models/user.ts
git add src/routes/orders.ts
git add src/pages/contact.tsx
git commit -m "Various updates"
```

### The "Config Leak" Commit

```bash
# DON'T: Personal config mixed with feature
git add src/models/product.ts
git add .env.local
git add .vscode/settings.json
git commit -m "Add product model"
```

### The "WIP" Commit

```bash
# DON'T
git add .
git commit -m "WIP"
```

---

## Useful Git Commands

### Staging Selectively

```bash
git add path/to/file.ts            # Stage specific file
git add path/to/file1.ts path/to/file2.ts  # Stage multiple files
git add -p path/to/file.ts         # Stage parts of a file
git restore --staged path/to/file.ts  # Unstage file
```

### Reviewing Before Commit

```bash
git diff --cached                   # Review staged changes
git diff --cached path/to/file.ts  # Review specific staged file
git status                          # Summary of staged/unstaged
```

### When Things Go Wrong

```bash
# Remove file from last commit (keep changes)
git restore --staged unwanted-file.ts
git commit --amend --no-edit

# Reset last commit entirely (keep changes)
git reset HEAD~1

# Stash unrelated changes
git stash push -m "Unrelated feature WIP" path/to/unrelated-file.ts
```

---

## Pre-commit Checklist

Before committing, verify:

- [ ] Only task-related files are staged
- [ ] No unrelated changes included
- [ ] No sensitive data (.env, credentials)
- [ ] No personal config files (.vscode/*, .idea/*)
- [ ] **Lint passes** with no errors
- [ ] **Typecheck passes** with no errors
- [ ] **Tests pass** with no failures
- [ ] Commit message follows Conventional Commits
- [ ] **No attribution lines** (no `Co-Authored-By`, `Generated by`, etc.)
- [ ] Changes can stand alone (atomic)

---

## Summary

**Golden Rules:**

1. Stage files individually with `git add <file>`
2. Never use `git add .` or `git add -A`
3. Warn about unrelated changes
4. One task = One focused commit (or logical group)
5. Clear, conventional commit messages
6. **NEVER add `Co-Authored-By`, `Generated by`, or any AI attribution to commits**
7. **Lint, typecheck, and tests MUST pass before committing**

Following atomic commits makes code review easier, debugging simpler, and git history clearer for the entire team.
