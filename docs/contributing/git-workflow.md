# Git Workflow

For conventional commits format, commit types, and the "stage files individually" rule, see [CLAUDE.md](../../CLAUDE.md). This document covers branching strategy, the atomic commits policy, PR workflow, and working with remotes.

---

## Current Development Workflow

**Current status**: All development happens on the `main` branch.

1. Clone repository
2. Work on `main` branch
3. Make atomic commits for each task
4. Push to remote `main`
5. No pull requests currently required

**Future**: Feature branches and PRs will be introduced as the team grows.

---

## Branch Naming Conventions

For use when feature branches are introduced:

### Format

```text
<type>/<short-description>
```

### Branch Types

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/user-authentication` |
| `fix/` | Bug fixes | `fix/date-timezone-bug` |
| `hotfix/` | Critical production fixes | `hotfix/payment-processing-down` |
| `refactor/` | Code refactoring | `refactor/extract-booking-logic` |
| `docs/` | Documentation changes | `docs/update-api-documentation` |
| `chore/` | Maintenance tasks | `chore/update-dependencies` |

### Naming Rules

- Lowercase, kebab-case
- Descriptive but concise
- Include issue number if applicable

```bash
# Good
feature/user-authentication
fix/booking-date-validation

# Bad
feature/new_feature          # underscores
fix/bug                      # too vague
feature/implement-the-new-user-authentication-system-with-jwt  # too long
```

---

## Atomic Commits Policy

**CRITICAL**: Each commit must contain ONLY files modified for ONE specific task.

### Why

- **Precise rollback**: Revert a specific change without affecting others
- **Clear intent**: Each commit has a single purpose
- **Bisect-friendly**: Find bugs with `git bisect` reliably
- **Clean reviews**: Reviewers understand exactly what changed

### Example: Multiple Layers in One Task

A task like "Implement User CRUD" should produce multiple atomic commits, one per architectural layer:

```bash
# Commit 1: Schemas
git add packages/schemas/src/user.schema.ts
git add packages/schemas/test/user.schema.test.ts
git commit -m "feat(schemas): add user validation schemas

Part of PB-123"

# Commit 2: Model
git add packages/db/src/models/user.model.ts
git add packages/db/test/models/user.model.test.ts
git commit -m "feat(db): add User model

Part of PB-123"

# Commit 3: Service
git add packages/service-core/src/services/user.service.ts
git add packages/service-core/test/services/user.service.test.ts
git commit -m "feat(service): add UserService

Part of PB-123"

# Commit 4: API Routes
git add apps/api/src/routes/user.route.ts
git add apps/api/test/routes/user.route.test.ts
git commit -m "feat(api): add user CRUD endpoints

Closes PB-123"
```

### Dealing with Unrelated Modified Files

When you have unrelated changes in the working tree:

```bash
git status
# modified: packages/db/src/models/user.model.ts (current task)
# modified: apps/api/src/routes/health.route.ts (unrelated WIP)

# Commit only current task
git add packages/db/src/models/user.model.ts
git commit -m "feat(db): add User model"

# Handle unrelated file:
# Option 1: Stash for later
git stash push apps/api/src/routes/health.route.ts
# Option 2: Commit separately if complete
# Option 3: Leave unstaged and keep working
```

### Verifying Before Commit

```bash
# Review what will be committed
git diff --cached

# If you see unrelated changes, unstage them
git reset HEAD packages/db/src/models/accommodation.model.ts
```

---

## Commit Scopes

Scopes indicate which package is affected:

| Scope | Package |
|-------|---------|
| `db` | Database (models, schemas, migrations) |
| `api` | API application |
| `web` | Web application |
| `admin` | Admin application |
| `schemas` | Zod validation schemas |
| `service-core` | Business logic services |
| `logger` | Logging package |
| `utils` | Utility functions |
| `auth-ui` | Authentication UI components |
| `billing` | Billing/monetization |
| `i18n` | Internationalization |
| `deps` | Dependency updates |

---

## Commit Body and Footer

### Body (optional)

For context that does not fit in the 50-character subject:

```text
feat(api): add accommodation search endpoint

Implements full-text search using PostgreSQL tsvector.
Supports filtering by city, price range, and amenities.
Returns paginated results with 20 items per page.

Closes #123
```

- Separate from subject with a blank line
- Wrap at 72 characters
- Explain WHAT and WHY, not HOW

### Footer (optional)

For breaking changes and issue references:

```text
feat(api): change booking response format

BREAKING CHANGE: response now returns { booking, payment } instead of just booking
```

```text
fix(db): correct date timezone handling

Fixes #123
Closes #124
```

---

## Documentation Commits

Documentation commits can bypass pre-commit hooks:

```bash
git add docs/architecture/overview.md
git commit --no-verify -m "docs(architecture): update system diagram"
```

Use `--no-verify` only for `.md`, `.json`, `.yaml` files, and assets. Never for `.ts` or `.tsx` files.

---

## Working with Remotes

### Before Starting Work

```bash
git fetch origin
git checkout main
git pull origin main
```

### Rebase vs Merge

Prefer rebase for a linear history:

```bash
# DO: rebase
git pull --rebase origin main

# DON'T: merge (creates unnecessary merge commits)
git pull origin main
```

### Handling Push Rejection

```bash
$ git push origin main
# error: failed to push some refs

# Fetch and rebase
git pull --rebase origin main

# Resolve conflicts if any
# Edit conflicting files, then:
git add resolved-file.ts
git rebase --continue

# Push again
git push origin main
```

### Resolving Conflicts

```bash
# During rebase, conflict markers appear:
<<<<<<< HEAD
your changes
=======
their changes
>>>>>>> commit-hash

# 1. Edit file to resolve (remove markers, keep correct code)
# 2. Stage resolved file
git add packages/db/src/models/user.model.ts
# 3. Continue rebase
git rebase --continue
# 4. If stuck, abort and start over
git rebase --abort
```

---

## Pre-Commit Checklist

Before committing, verify:

- [ ] Completed ONE discrete unit of work
- [ ] All tests passing (`pnpm test`)
- [ ] Type checking passing (`pnpm typecheck`)
- [ ] Linting passing (`pnpm lint`)
- [ ] Staged ONLY task-related files
- [ ] Verified staged files (`git diff --cached`)
- [ ] No debug code (`console.log`, debugger)
- [ ] No commented-out code

---

## Further Reading

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Pull Request Process](./pull-request-process.md)
- [Code Standards](./code-standards.md)
