# Git Workflow

This guide explains how we use Git at Hospeda, including branching strategy, commit guidelines, and the critical atomic commits policy.

## Table of Contents

- [Overview](#overview)
- [Current Development Workflow](#current-development-workflow)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Commit Guidelines](#commit-guidelines)
- [Atomic Commits Policy](#atomic-commits-policy)
- [Commit Process](#commit-process)
- [Commit Message Examples](#commit-message-examples)
- [When to Commit](#when-to-commit)
- [When NOT to Commit](#when-not-to-commit)
- [Working with Remotes](#working-with-remotes)
- [Git Commands Reference](#git-commands-reference)

## Overview

Our Git workflow is designed to:

- **Maintain clean history**: Easy to understand and navigate
- **Enable easy rollback**: Atomic commits allow precise rollbacks
- **Facilitate code review**: Small, focused commits are easier to review
- **Support collaboration**: Clear conventions reduce conflicts
- **Document changes**: Meaningful commit messages explain the "why"

## Current Development Workflow

**Current Status**: All development happens on the `main` branch.

**Process**:

1. Clone repository
2. Work on `main` branch
3. Make atomic commits for each task
4. Push to remote `main`
5. No pull requests currently required

**Future**: We'll introduce feature branches and PRs as the team grows.

### Working on Main

```bash
# Start work
git checkout main
git pull origin main

# Make changes
# ... edit files ...

# Commit changes (atomic commits!)
git add path/to/specific-file.ts
git commit -m "feat(db): add User model"

# Push to remote
git push origin main
```

## Branch Naming Conventions

**Note**: These conventions are for future reference when we introduce feature branches.

### Format

```text
<type>/<short-description>
```

### Branch Types

**Feature Branches**: `feature/*`

For new features or enhancements:

```bash
git checkout -b feature/user-authentication
git checkout -b feature/booking-search
git checkout -b feature/payment-integration
```

**Bug Fix Branches**: `fix/*`

For bug fixes:

```bash
git checkout -b fix/date-timezone-bug
git checkout -b fix/price-calculation-error
git checkout -b fix/image-upload-timeout
```

**Hotfix Branches**: `hotfix/*`

For critical production fixes:

```bash
git checkout -b hotfix/security-vulnerability
git checkout -b hotfix/payment-processing-down
```

**Refactor Branches**: `refactor/*`

For code refactoring (no behavior changes):

```bash
git checkout -b refactor/extract-booking-logic
git checkout -b refactor/simplify-user-service
```

**Documentation Branches**: `docs/*`

For documentation-only changes:

```bash
git checkout -b docs/update-api-documentation
git checkout -b docs/add-setup-guide
```

**Chore Branches**: `chore/*`

For maintenance tasks:

```bash
git checkout -b chore/update-dependencies
git checkout -b chore/configure-prettier
```

### Naming Guidelines

**DO**:

- Use lowercase
- Use hyphens (kebab-case)
- Be descriptive but concise
- Match issue number if applicable

```bash
✅ feature/user-authentication
✅ fix/booking-date-validation
✅ refactor/simplify-price-calculator
✅ docs/api-endpoint-examples
```

**DON'T**:

- Use spaces or underscores
- Use overly long names
- Use vague descriptions

```bash
❌ feature/new_feature
❌ fix/bug
❌ feature/implement-the-new-user-authentication-system-with-jwt-and-refresh-tokens
```

## Commit Guidelines

### Conventional Commits

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```text
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Commit Types

| Type | Usage | Example |
|------|-------|---------|
| `feat` | New feature | `feat(api): add user search endpoint` |
| `fix` | Bug fix | `fix(db): correct timezone in date queries` |
| `refactor` | Code refactoring | `refactor(service): extract price calculation` |
| `docs` | Documentation | `docs(api): update endpoint examples` |
| `test` | Tests only | `test(user): add edge case tests` |
| `chore` | Maintenance | `chore(deps): update hono to v4.1.0` |
| `style` | Formatting | `style(api): apply biome formatting` |
| `perf` | Performance | `perf(db): optimize booking query` |
| `build` | Build system | `build(docker): update node image` |
| `ci` | CI/CD | `ci(github): add test workflow` |

### Commit Scopes

Scopes indicate which package/area is affected:

**Packages**:

- `db` - Database (models, schemas, migrations)
- `api` - API application
- `web` - Web application
- `admin` - Admin application
- `schemas` - Zod validation schemas
- `service-core` - Business logic services
- `logger` - Logging package
- `utils` - Utility functions
- `auth-ui` - Authentication UI components

**Examples**:

```bash
feat(db): add Accommodation model
fix(api): handle missing user error
refactor(service-core): simplify booking logic
test(schemas): add validation tests
docs(web): update README setup instructions
```

### Description Guidelines

**Rules**:

- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter
- No period at the end
- Maximum 50 characters
- Be specific but concise

**DO**:

```bash
✅ feat(db): add User model with authentication
✅ fix(api): handle null values in booking response
✅ refactor(service): extract price calculation logic
✅ test(user): add edge cases for validation
```

**DON'T**:

```bash
❌ feat(db): Added user model.              # Past tense, capitalized, period
❌ fix(api): fixed bug                      # Vague
❌ Updated files                            # No type, no scope, vague
❌ feat(db): add the new user model that includes authentication fields and roles  # Too long
```

### Commit Body (Optional)

Use the body for additional context:

```text
feat(api): add accommodation search endpoint

Implements full-text search across title, description, and city.
Uses PostgreSQL tsvector for efficient searching.
Supports pagination and filtering by price range.

Closes #123
```

**Body Guidelines**:

- Separate from subject with blank line
- Wrap at 72 characters
- Explain WHAT and WHY, not HOW
- Reference issues/tickets

### Commit Footer (Optional)

**Breaking Changes**:

```text
feat(api): change booking response format

BREAKING CHANGE: response now returns { booking, payment } instead of just booking
```

**Issue References**:

```text
fix(db): correct date timezone handling

Fixes #123
Closes #124
Refs #125
```

## Atomic Commits Policy

🔥 **CRITICAL**: This is one of our most important development practices.

### Rule: ONLY Commit Files for THAT Specific Task

#### Each commit must contain ONLY the files modified for ONE specific task

### Why Atomic Commits?

- **Clean History**: Easy to understand what changed and why
- **Easy Rollback**: Revert specific changes without affecting others
- **Clear Intent**: Each commit has a single, clear purpose
- **Better Reviews**: Reviewers can understand changes easily
- **Bisect-Friendly**: Find bugs using `git bisect` reliably
- **Documentation**: History documents project evolution

### The Golden Rule

**NEVER use `git add .` or `git add -A`**

**ALWAYS use `git add <specific-file>`**

### Example: Task Completion

**Task**: "Create User model (PB-123)"

**Files Modified During Task**:

```bash
packages/db/src/models/user.model.ts        # Created for this task
packages/db/test/models/user.model.test.ts  # Created for this task
```

**Files Modified Previously (Unrelated)**:

```bash
packages/db/src/models/accommodation.model.ts  # Modified earlier, not committed yet
apps/api/src/routes/health.route.ts           # Modified earlier, not committed yet
```

**Correct Atomic Commit**:

```bash
# ✅ CORRECT: Stage only task-related files
git add packages/db/src/models/user.model.ts
git add packages/db/test/models/user.model.test.ts

git commit -m "feat(db): add User model with authentication

- Implement UserModel extending BaseModel
- Add findByEmail and findByUsername methods
- Include comprehensive tests with 95% coverage

Closes PB-123"

# Other modified files remain unstaged
```

**Incorrect Commit**:

```bash
# ❌ WRONG: Stage all modified files
git add .

git commit -m "feat(db): add User model"

# This would include:
# - user.model.ts (correct)
# - user.model.test.ts (correct)
# - accommodation.model.ts (WRONG - unrelated)
# - health.route.ts (WRONG - unrelated)
```

### Dealing with Unrelated Changes

**Scenario**: You have unrelated modified files when completing a task.

**Solution**: Stage only task-related files, commit them, then handle unrelated files separately.

```bash
# Check status
git status
# Shows:
#   modified: packages/db/src/models/user.model.ts (task PB-123)
#   modified: packages/db/test/models/user.model.test.ts (task PB-123)
#   modified: apps/api/src/routes/health.route.ts (unrelated WIP)

# Commit task PB-123
git add packages/db/src/models/user.model.ts
git add packages/db/test/models/user.model.test.ts
git commit -m "feat(db): add User model"

# Now handle unrelated file
# Option 1: Stash it for later
git stash push apps/api/src/routes/health.route.ts

# Option 2: Commit it separately (if complete)
git add apps/api/src/routes/health.route.ts
git commit -m "fix(api): update health check response"

# Option 3: Leave it unstaged for continued work
# (Do nothing - keep working on it)
```

### Verifying Before Commit

**Always review what you're about to commit:**

```bash
# See what will be committed
git diff --cached

# See which files are staged
git status

# Review specific file
git diff --cached packages/db/src/models/user.model.ts
```

If you see unrelated changes, **unstage them**:

```bash
# Unstage specific file
git reset HEAD packages/db/src/models/accommodation.model.ts

# Unstage all and start over
git reset HEAD

# Now stage only task-related files
git add packages/db/src/models/user.model.ts
git add packages/db/test/models/user.model.test.ts
```

### Multiple Logical Changes in One Task

**Scenario**: A task involves multiple logical changes (e.g., schema + model + service + API).

**Solution**: Make multiple atomic commits, one per layer.

**Task**: "Implement User CRUD (PB-123)"

```bash
# Commit 1: Schemas
git add packages/schemas/src/user.schema.ts
git add packages/schemas/test/user.schema.test.ts
git commit -m "feat(schemas): add user validation schemas

- Add CreateUserSchema, UpdateUserSchema
- Add comprehensive validation tests

Part of PB-123"

# Commit 2: Model
git add packages/db/src/models/user.model.ts
git add packages/db/test/models/user.model.test.ts
git commit -m "feat(db): add User model

- Implement UserModel extending BaseModel
- Add custom findByEmail method
- Add tests with 95% coverage

Part of PB-123"

# Commit 3: Service
git add packages/service-core/src/services/user.service.ts
git add packages/service-core/test/services/user.service.test.ts
git commit -m "feat(service): add UserService

- Implement CRUD operations
- Add business logic validation
- Add comprehensive tests

Part of PB-123"

# Commit 4: API Routes
git add apps/api/src/routes/user.route.ts
git add apps/api/test/routes/user.route.test.ts
git commit -m "feat(api): add user CRUD endpoints

- Add POST /users, GET /users/:id, PATCH /users/:id
- Add authentication middleware
- Add integration tests

Closes PB-123"
```

**Benefits**:

- Each commit is self-contained and testable
- Easy to review each layer separately
- Can rollback specific layer if needed
- Clear progression through architecture

## Commit Process

### Step-by-Step Process

**1. Complete a Discrete Unit of Work**

Focus on ONE task at a time:

- Implement ONE feature
- Fix ONE bug
- Refactor ONE component
- Add tests for ONE module

**2. Run Tests**

```bash
# Run tests for changed packages
cd packages/db && pnpm test
cd packages/service-core && pnpm test

# Or run all tests
pnpm test
```

**3. Run Quality Checks**

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Fix auto-fixable issues
pnpm lint --fix
```

**4. Review Changes**

```bash
# See all modified files
git status

# See detailed changes
git diff

# Review specific file
git diff packages/db/src/models/user.model.ts
```

**5. Stage ONLY Task-Related Files**

```bash
# Stage specific files
git add packages/db/src/models/user.model.ts
git add packages/db/test/models/user.model.test.ts

# Verify staged files
git status
git diff --cached
```

**6. Write Commit Message**

```bash
# Commit with message
git commit -m "feat(db): add User model with authentication

- Implement UserModel extending BaseModel
- Add findByEmail and findByUsername methods
- Include comprehensive tests with 95% coverage

Closes PB-123"
```

**7. Push to Remote**

```bash
git push origin main
```

### For Documentation Commits

Documentation commits can bypass pre-commit hooks (Biome):

```bash
git add docs/architecture/overview.md
git commit --no-verify -m "docs(architecture): update system diagram"
git push origin main
```

**When to use `--no-verify`**:

- Documentation-only changes (`.md` files)
- Configuration files (`.json`, `.yaml`)
- Assets (images, diagrams)

**When NOT to use `--no-verify`**:

- Code changes (`.ts`, `.tsx` files)
- Any changes that should be linted

## Commit Message Examples

### Good Examples

**Feature**:

```text
feat(api): add accommodation search endpoint

Implements full-text search using PostgreSQL tsvector.
Supports filtering by city, price range, and amenities.
Returns paginated results with 20 items per page.

Closes #123
```

**Bug Fix**:

```text
fix(db): correct timezone handling in booking dates

Previously used UTC for all dates, causing incorrect
check-in/check-out times for users in other timezones.
Now uses America/Argentina/Buenos_Aires timezone.

Fixes #456
```

**Refactoring**:

```text
refactor(service): extract price calculation to helper

Extracted calculateBookingPrice to separate module
for better testability and reusability.
No behavior changes.

Part of PB-789
```

**Tests**:

```text
test(user): add edge cases for email validation

- Test email with special characters
- Test maximum email length (254 chars)
- Test internationalized domain names
- Increases coverage from 87% to 95%
```

**Documentation**:

```text
docs(api): add examples for all endpoints

Added request/response examples for:
- User CRUD operations
- Booking flow
- Payment processing

Makes API easier to understand for new developers.
```

### Bad Examples

**Too Vague**:

```text
❌ fix: fixed bug
❌ update files
❌ changes
❌ work in progress
```

**Wrong Tense**:

```text
❌ feat(api): added new endpoint
❌ fix(db): fixing bug
❌ refactor(service): refactored code
```

**No Context**:

```text
❌ feat(api): add endpoint
   (Which endpoint? What does it do?)

❌ fix(db): fix error
   (What error? What was the cause?)
```

**Includes Unrelated Changes**:

```text
❌ feat(db): add User model, fix booking bug, update docs
   (Should be 3 separate commits)
```

## When to Commit

**Commit when**:

✅ You've completed a discrete unit of work
✅ All tests are passing
✅ All quality checks pass (typecheck, lint)
✅ Code is reviewed (if required)
✅ You have ONLY task-related files staged

**Examples of Committable Units**:

- Added a new model with tests
- Fixed a specific bug with tests
- Refactored a function with updated tests
- Added validation to an endpoint
- Updated documentation for a feature
- Implemented one API endpoint with tests

## When NOT to Commit

**DON'T commit when**:

❌ Tests are failing
❌ Linting errors exist
❌ Type checking fails
❌ Work is incomplete/broken
❌ You have unrelated files staged
❌ Code doesn't compile
❌ Debug code is still present (`console.log`, debugger)

**Bad Commit Scenarios**:

```bash
# ❌ DON'T: Commit failing tests
$ pnpm test
FAIL packages/db/test/user.model.test.ts
  UserModel
    ✗ should create user (15 ms)

# ❌ DON'T: Commit with linting errors
$ pnpm lint
Error: 'any' type is not allowed
  src/models/user.model.ts:15:18

# ❌ DON'T: Commit unrelated files
$ git status
modified: packages/db/src/models/user.model.ts (task PB-123)
modified: packages/db/src/models/accommodation.model.ts (WIP, different task)
```

**Fix issues first, then commit**:

```bash
# Fix tests
pnpm test

# Fix linting
pnpm lint --fix

# Stage only completed task files
git add packages/db/src/models/user.model.ts
git add packages/db/test/models/user.model.test.ts

# Now commit
git commit -m "feat(db): add User model"
```

## Working with Remotes

### Fetching and Pulling

**Before starting work**:

```bash
# Fetch latest changes
git fetch origin

# Update local main
git checkout main
git pull origin main
```

**Difference between fetch and pull**:

- `git fetch`: Downloads changes but doesn't apply them
- `git pull`: Downloads and applies changes (fetch + merge)

### Pushing Changes

**After committing**:

```bash
# Push to remote main
git push origin main
```

**If push is rejected**:

```bash
# Someone pushed before you
$ git push origin main
error: failed to push some refs

# Fetch and rebase
git pull --rebase origin main

# Resolve conflicts if any
# (Edit conflicting files)
git add resolved-file.ts
git rebase --continue

# Push again
git push origin main
```

### Rebase vs Merge

**Prefer rebase for clean history**:

```bash
# ✅ DO: Rebase to maintain linear history
git pull --rebase origin main

# ❌ DON'T: Merge (creates merge commits)
git pull origin main
```

**Why rebase?**

- Linear history (easier to understand)
- No merge commits cluttering history
- Cleaner `git log`

**When to merge**:

- Feature branches (when we introduce them)
- Pull requests

### Resolving Conflicts

**Conflict occurs during rebase**:

```bash
$ git pull --rebase origin main
CONFLICT (content): Merge conflict in packages/db/src/models/user.model.ts

# 1. Open conflicting file and resolve
# Look for conflict markers:
<<<<<<< HEAD
your changes
=======
their changes
>>>>>>> commit-hash

# 2. Edit file to resolve conflict
# Remove markers, keep correct code

# 3. Stage resolved file
git add packages/db/src/models/user.model.ts

# 4. Continue rebase
git rebase --continue

# 5. If needed, abort rebase
git rebase --abort
```

## Git Commands Reference

### Basic Commands

```bash
# Check status
git status

# See changes
git diff                    # Unstaged changes
git diff --cached           # Staged changes
git diff HEAD               # All changes

# Stage files
git add <file>              # Stage specific file
git add <file1> <file2>     # Stage multiple files

# Unstage files
git reset HEAD <file>       # Unstage specific file
git reset HEAD              # Unstage all

# Commit
git commit -m "message"     # Commit with message
git commit --amend          # Amend last commit

# Push/Pull
git push origin main        # Push to remote
git pull origin main        # Pull from remote
git fetch origin            # Fetch without merging
```

### Viewing History

```bash
# View commit history
git log                     # Full log
git log --oneline           # Compact log
git log --graph             # Visual graph
git log -n 5                # Last 5 commits

# View specific commit
git show <commit-hash>      # Show commit details
git show HEAD               # Show last commit

# Search commits
git log --grep="user"       # Search commit messages
git log --author="John"     # Filter by author
```

### Undoing Changes

```bash
# Discard unstaged changes
git checkout -- <file>      # Discard changes to file
git checkout .              # Discard all changes

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Revert a commit (creates new commit)
git revert <commit-hash>
```

### Stashing Changes

```bash
# Stash current changes
git stash                   # Stash all changes
git stash push <file>       # Stash specific file

# View stashes
git stash list

# Apply stash
git stash pop               # Apply and remove latest stash
git stash apply             # Apply but keep stash

# Drop stash
git stash drop              # Remove latest stash
git stash clear             # Remove all stashes
```

### Branches (Future Reference)

```bash
# Create branch
git checkout -b feature/my-feature

# Switch branch
git checkout main

# List branches
git branch                  # Local branches
git branch -r               # Remote branches
git branch -a               # All branches

# Delete branch
git branch -d feature/my-feature    # Delete if merged
git branch -D feature/my-feature    # Force delete

# Rename branch
git branch -m old-name new-name
```

### Advanced Commands

```bash
# Cherry-pick commit
git cherry-pick <commit-hash>

# Interactive rebase (cleanup history)
git rebase -i HEAD~5

# Find bug with bisect
git bisect start
git bisect bad              # Current commit is bad
git bisect good <commit>    # Known good commit
# Test each commit, mark good/bad
git bisect reset            # Done

# Blame (find who changed line)
git blame <file>
```

### Useful Aliases

Add to `~/.gitconfig`:

```ini
[alias]
  st = status
  co = checkout
  ci = commit
  br = branch
  unstage = reset HEAD --
  last = log -1 HEAD
  visual = log --graph --oneline --all
  amend = commit --amend --no-edit
```

Usage:

```bash
git st                      # Instead of git status
git co main                 # Instead of git checkout main
git last                    # Show last commit
```

---

## Summary Checklist

Before committing, verify:

- [ ] Completed ONE discrete unit of work
- [ ] All tests passing (`pnpm test`)
- [ ] Type checking passing (`pnpm typecheck`)
- [ ] Linting passing (`pnpm lint`)
- [ ] Reviewed all changes (`git diff`)
- [ ] Staged ONLY task-related files (no `git add .`)
- [ ] Verified staged files (`git diff --cached`)
- [ ] Written descriptive commit message (conventional commits)
- [ ] No debug code (`console.log`, debugger)
- [ ] No commented code

---

## Further Reading

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Atomic Commits Standards](.claude/docs/standards/atomic-commits.md)
- [Git Documentation](https://git-scm.com/doc)
- [Code Standards](./code-standards.md)
- [Pull Request Process](./pull-request-process.md)

---

*Last updated: 2025-01-15*
