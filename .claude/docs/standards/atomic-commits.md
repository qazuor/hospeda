# Atomic Commits Policy

## Overview

**Atomic commits** are focused, single-purpose commits that contain **only the changes related to one specific task**. This is a **CRITICAL** policy in the Hospeda project that ensures clean git history, easier code review, and better debugging capabilities.

## Why Atomic Commits Matter

### Benefits

1. **Clear History**: Each commit represents one logical change
2. **Easy Revert**: Roll back specific features without affecting others
3. **Better Reviews**: Reviewers can understand changes in isolation
4. **Improved Debugging**: `git bisect` works more effectively
5. **Cleaner PRs**: Pull requests are focused and easier to understand
6. **Audit Trail**: Clear documentation of what changed and when

### Problems with Non-Atomic Commits

- **Mixed Changes**: Unrelated modifications in same commit make history confusing
- **Hard to Revert**: Can't undo one change without affecting others
- **Review Complexity**: Reviewers must parse multiple unrelated changes
- **Lost Context**: Why changes were made becomes unclear
- **Merge Conflicts**: More likely when commits contain unrelated changes

## 🔥 CRITICAL: Project Policy

When committing code after completing a task:

### Rules

1. **ONLY** commit files modified during THAT specific task
2. **NEVER** use `git add .` or `git add -A`
3. **ALWAYS** use `git add <specific-file>` for task-related files
4. **WARN** user if unrelated modified files are detected

### Example Scenario

```bash
# Task: "Create User model"
# git status shows:
M packages/db/src/models/user.model.ts      ← Task file ✅
M packages/db/test/models/user.model.test.ts ← Task file ✅
M packages/api/routes/booking.ts            ← NOT related ❌
M .env.local                                 ← NOT related ❌

# ✅ CORRECT:
git add packages/db/src/models/user.model.ts
git add packages/db/test/models/user.model.test.ts
# Only task-related files

# ❌ WRONG:
git add .  # Would include unrelated files!
git add -A # Would include unrelated files!
```

### If Unrelated Files Exist

When `git status` shows modified files NOT part of current task:

1. **Inform** user about unrelated files
2. **Confirm** proceeding with ONLY task files
3. **Allow override** if user explicitly requests including other files

#### Warning Template

```text
⚠️ Warning: I see modified files that are NOT part of this task:
- packages/api/routes/booking.ts
- .env.local

I will ONLY commit the files related to the current task:
- packages/db/src/models/user.model.ts
- packages/db/test/models/user.model.test.ts

The unrelated files will remain uncommitted. You can commit them separately
when their respective tasks are complete.

Do you want to proceed with committing only the task-related files? (yes/no)
```

### Exception

User can explicitly request including other files:

```bash
# User says: "Include the booking.ts file too"
# Then you can:
git add packages/db/src/models/user.model.ts
git add packages/db/test/models/user.model.test.ts
git add packages/api/routes/booking.ts
```

## Workflow by Level

### Level 1: Quick Fix Protocol

**Commits:** Single atomic commit

- All changes for the fix
- Documentation updates
- Test additions/modifications

**Example:**

```bash
# Fix typo in accommodation schema
git add packages/db/schemas/accommodation.schema.ts
git commit -m "fix(db): correct typo in accommodation description field"
```

### Level 2: Atomic Task Protocol

**Commits:** 1-3 logical commits

Organize files into logical groups:

1. **Schemas & Validation**

   ```bash
   git add packages/schemas/src/accommodation.schema.ts
   git commit -m "feat(schemas): add accommodation validation schema"
   ```

2. **Models & Tests**

   ```bash
   git add packages/db/src/models/accommodation.model.ts
   git add packages/db/test/models/accommodation.model.test.ts
   git commit -m "feat(db): implement accommodation model with tests"
   ```

3. **Services**

   ```bash
   git add packages/service-core/src/accommodation.service.ts
   git add packages/service-core/test/accommodation.service.test.ts
   git commit -m "feat(service): add accommodation CRUD service"
   ```

4. **API Routes**

   ```bash
   git add apps/api/src/routes/accommodations.ts
   git add apps/api/test/routes/accommodations.test.ts
   git commit -m "feat(api): expose accommodation endpoints"
   ```

**Bad Example:**

```bash
# ❌ Don't do this - mixing unrelated changes
git add packages/schemas/src/accommodation.schema.ts
git add packages/schemas/src/booking.schema.ts  # Different feature!
git add packages/db/src/models/accommodation.model.ts
git add .env.local  # Config file!
git commit -m "Add stuff"
```

### Level 3: Feature Planning (4 Phases)

**Phase 2 - Implementation:**

Multiple atomic commits, each for a specific subtask (PB-XXX):

```bash
# PB-001: Database Schema
git add packages/db/schemas/accommodations.ts
git commit -m "feat(db): add accommodations table schema [PB-001]"

# PB-002: Model Layer
git add packages/db/src/models/accommodation.model.ts
git add packages/db/test/models/accommodation.model.test.ts
git commit -m "feat(db): implement accommodation model [PB-002]"

# PB-003: Service Layer
git add packages/service-core/src/accommodation.service.ts
git add packages/service-core/test/accommodation.service.test.ts
git commit -m "feat(service): add accommodation CRUD service [PB-003]"
```

**Phase 4 - Finalization:**

Separate commits for documentation:

```bash
# Update documentation
git add docs/api/accommodations.md
git commit -m "docs: add accommodation API documentation"

# Update changelog
git add CHANGELOG.md
git commit -m "docs: update changelog for accommodation feature"
```

## Common Patterns

### Pattern 1: Schema + Model + Test

```bash
# Zod schema
git add packages/schemas/src/user.schema.ts
git commit -m "feat(schemas): add user validation schema"

# Drizzle model + tests together
git add packages/db/src/models/user.model.ts
git add packages/db/test/models/user.model.test.ts
git commit -m "feat(db): implement user model with tests"
```

### Pattern 2: Service + API

```bash
# Service layer with tests
git add packages/service-core/src/booking.service.ts
git add packages/service-core/test/booking.service.test.ts
git commit -m "feat(service): implement booking service"

# API routes with tests
git add apps/api/src/routes/bookings.ts
git add apps/api/test/routes/bookings.test.ts
git commit -m "feat(api): add booking endpoints"
```

### Pattern 3: Refactoring

```bash
# Extract utility function
git add packages/utils/src/date-helpers.ts
git add packages/utils/test/date-helpers.test.ts
git commit -m "refactor(utils): extract date calculation utilities"

# Update services to use new utilities
git add packages/service-core/src/booking.service.ts
git add packages/service-core/test/booking.service.test.ts
git commit -m "refactor(service): use shared date utilities"
```

### Pattern 4: Bug Fix

```bash
# Fix + regression test
git add packages/db/src/models/accommodation.model.ts
git add packages/db/test/models/accommodation.model.test.ts
git commit -m "fix(db): correct price calculation for seasonal rates"
```

## Anti-Patterns to Avoid

### ❌ The "Everything" Commit

```bash
# DON'T do this
git add .
git commit -m "Updates"
```

**Why it's bad:**

- Includes unrelated changes
- No clear purpose
- Hard to review
- Impossible to revert selectively

### ❌ The "Mixed Concerns" Commit

```bash
# DON'T do this
git add packages/db/src/models/user.model.ts
git add packages/api/routes/bookings.ts
git add apps/web/pages/contact.tsx
git commit -m "Various updates"
```

**Why it's bad:**

- Three unrelated features
- Can't track individual changes
- Review is confusing

### ❌ The "Config Leak" Commit

```bash
# DON'T do this
git add packages/db/src/models/accommodation.model.ts
git add .env.local
git add .vscode/settings.json
git commit -m "Add accommodation model"
```

**Why it's bad:**

- Personal config files mixed with feature
- May leak sensitive data
- Pollutes shared history

### ❌ The "WIP" Commit

```bash
# DON'T do this
git add .
git commit -m "WIP"
```

**Why it's bad:**

- No context for changes
- Likely includes unrelated files
- Creates noise in history

## Tools and Commands

### Checking Status

```bash
# See what files are modified
git status

# See detailed changes
git diff

# See staged changes
git diff --cached
```

### Staging Selectively

```bash
# Stage specific file
git add path/to/file.ts

# Stage multiple specific files
git add path/to/file1.ts path/to/file2.ts

# Stage parts of a file (interactive)
git add -p path/to/file.ts

# Unstage file
git restore --staged path/to/file.ts
```

### Reviewing Before Commit

```bash
# Review what's staged
git diff --cached

# Review specific file changes
git diff --cached path/to/file.ts

# See summary of staged changes
git status
```

### Amending Commits

```bash
# Amend last commit (add forgotten file)
git add path/to/forgotten/file.ts
git commit --amend --no-edit

# Amend last commit (change message)
git commit --amend -m "Better commit message"
```

**⚠️ Warning:** Only amend commits that haven't been pushed!

## Commit Message Guidelines

Follow **Conventional Commits** format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code change that neither fixes bug nor adds feature
- `docs`: Documentation only
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvement
- `style`: Code style changes (formatting, no logic change)

### Scope

Package or area affected:

- `db`, `api`, `web`, `admin`
- `schemas`, `service`, `utils`
- `auth`, `payments`, `i18n`

### Examples

```bash
feat(db): add accommodation availability tracking
fix(api): correct booking date validation logic
refactor(service): extract price calculation utilities
docs(api): update accommodation endpoint documentation
test(db): add edge cases for booking model
chore(deps): update Drizzle to v0.29.0
```

## Integration with Workflows

### Quick Fix Protocol (Level 1)

1. Make the fix
2. Add tests
3. **Single atomic commit** with all changes
4. Run quality checks
5. Commit

### Atomic Task Protocol (Level 2)

1. Complete subtask (TDD)
2. **Commit only files for that subtask**
3. Move to next subtask
4. Repeat until task complete
5. Create PR with 1-3 focused commits

### Feature Planning (Level 3)

1. Phase 2: **One commit per PB-XXX subtask**
2. Each commit is atomic to its subtask
3. Task codes in commit messages
4. Phase 4: Separate commits for docs
5. Create PR with clear commit history

## Pre-commit Checklist

Before committing, verify:

- [ ] Only task-related files are staged
- [ ] No unrelated changes included
- [ ] No sensitive data (`.env`, credentials)
- [ ] No personal config files (`.vscode/*`)
- [ ] Tests pass
- [ ] Linting passes
- [ ] Commit message follows conventions
- [ ] Changes can stand alone (atomic)

## When Things Go Wrong

### Committed Wrong Files

```bash
# Remove file from last commit (keep changes)
git restore --staged unwanted-file.ts
git commit --amend --no-edit

# OR: Reset last commit entirely (keep changes)
git reset HEAD~1
# Then stage correct files and commit again
```

### Mixed Changes in Working Directory

```bash
# Stash unrelated changes
git stash push -m "Booking feature WIP" packages/api/routes/booking.ts

# Commit task-related files
git add packages/db/src/models/user.model.ts
git commit -m "feat(db): add user model"

# Restore unrelated changes
git stash pop
```

### Need to Split Changes

```bash
# Interactive staging
git add -p packages/db/src/models/user.model.ts
# Select only related hunks

# Or: Stash everything, restore selectively
git stash
git stash show -p | git apply
git restore <files-to-exclude>
```

## References

- **Main Documentation**: [CLAUDE.md](../../../CLAUDE.md#git--commit-rules)
- **Task Completion**: [task-completion-protocol.md](../workflows/task-completion-protocol.md)
- **Quick Fix**: [quick-fix-protocol.md](../workflows/quick-fix-protocol.md)
- **Atomic Task**: [atomic-task-protocol.md](../workflows/atomic-task-protocol.md)
- **Git Worktrees**: [git-worktrees.md](../guides/git-worktrees.md)
- **PR Workflow**: [pr-workflow.md](../guides/pr-workflow.md)

## Summary

**Key Takeaway:** Commits should be **atomic** - one logical change per commit, including only files modified for that specific task.

**Golden Rules:**

1. ✅ Stage files individually with `git add <file>`
2. ❌ Never use `git add .` or `git add -A`
3. ⚠️ Warn user about unrelated changes
4. 🎯 One task = One focused commit (or logical group)
5. 📝 Clear, conventional commit messages

Following atomic commits makes code review easier, debugging simpler, and git history clearer for the entire team.

---

*Last updated: 2025-11-03*
