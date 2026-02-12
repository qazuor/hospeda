---
name: git-commit-helper
description: Conventional commit message generation. Use when creating commit messages, analyzing changed files, or formatting git commands.
---

# Git Commit Helper

## Purpose

Generate well-structured conventional commit messages by analyzing changed files, grouping changes logically, detecting appropriate commit types and scopes, and formatting copy-paste-ready git commands. This skill ensures a consistent, professional commit history that supports semantic versioning and makes project history easy to understand.

## When to Use

- When preparing to commit code changes
- When reviewing staged changes before commit
- When splitting a large changeset into logical commits
- When unsure about commit type or scope
- When generating release notes from commit history

## Conventional Commits Format

```text
{type}({scope}): {subject}

{body}

{footer}
```

**Components:**

- **type**: Category of change (required)
- **scope**: Area of codebase affected (optional but recommended)
- **subject**: Short summary in imperative mood (required, max 72 characters)
- **body**: Detailed description explaining why, not what (optional)
- **footer**: Breaking changes, issue references (optional)

## Commit Types

### feat -- New Feature

```text
feat(auth): add two-factor authentication

- Implement TOTP-based 2FA enrollment
- Add QR code generation for authenticator apps
- Store encrypted backup codes
- Add 2FA verification to login flow

Closes #42
```

### fix -- Bug Fix

```text
fix(pricing): correct discount calculation for bulk orders

Discount percentage was applied before tax instead of after.
This caused overcharges of 2-5% on orders over 100 units.

Fixes #123
```

### docs -- Documentation

```text
docs(api): add authentication endpoint documentation

- Document login, logout, and refresh endpoints
- Add request/response examples
- Include error codes and descriptions
```

### style -- Code Formatting

```text
style(components): format files with prettier

- Apply consistent indentation
- Fix trailing whitespace
- No functional changes
```

### refactor -- Code Refactoring

```text
refactor(services): extract shared validation logic

- Create BaseValidator class
- Move duplicate validation to shared methods
- Update all services to use BaseValidator
- No behavior changes, all tests passing
```

### perf -- Performance Improvement

```text
perf(search): optimize database query with index

- Add composite index on (status, created_at)
- Rewrite query to use index scan
- Reduce average query time from 450ms to 12ms
```

### test -- Tests

```text
test(orders): add integration tests for order creation

- Test happy path for all order types
- Test validation edge cases
- Test error handling scenarios
- Achieve 95% coverage on order module
```

### build -- Build System

```text
build(deps): update TypeScript to 5.3

- Update typescript and related packages
- Fix new strict mode violations
- Update tsconfig for new features
```

### ci -- CI/CD

```text
ci(github-actions): add E2E test workflow

- Configure Playwright in CI
- Add test database setup step
- Run E2E tests on pull requests
```

### chore -- Maintenance

```text
chore(config): update ESLint rules

- Enable new TypeScript-specific rules
- Update ignore patterns for generated files
- Fix existing violations
```

### Breaking Changes

Add `BREAKING CHANGE:` in the footer:

```text
feat(api): change pagination response format

BREAKING CHANGE: API now returns { items, total, page, pageSize }
instead of { data, count, offset, limit }.
Clients must update their pagination handling logic.

Migration guide: docs/migrations/v3-pagination.md
```

## Process

### Step 1: Analyze Changes

```bash
# View changed files
git status

# View detailed diff
git diff
git diff --staged
```

### Step 2: Group Changes Logically

Group related changes into separate commits:

- One feature per commit
- One bug fix per commit
- Related changes together (schema + service + test)
- Separate formatting from logic changes

**Instead of one large commit:**

```bash
# Bad: everything in one commit
git add .
git commit -m "add user feature"
```

**Split into logical units:**

```bash
# Good: separate commits by layer/concern
# 1. Database schema
git add src/db/schemas/user/
git commit -m "feat(db): add user schema

- Define user table with all fields
- Add indexes for email and username
- Create migration script"

# 2. Service layer
git add src/services/user/
git commit -m "feat(services): implement user service

- Add UserService with CRUD operations
- Implement email validation
- Add comprehensive tests"

# 3. API routes
git add src/routes/users/
git commit -m "feat(api): add user endpoints

- POST /users - Create user
- GET /users/:id - Get user details
- PATCH /users/:id - Update user
- DELETE /users/:id - Deactivate user"
```

### Step 3: Write the Commit Message

**Subject line rules:**

- Use imperative mood ("add" not "added" or "adds")
- Do not capitalize the first letter after the colon
- No period at the end
- Maximum 72 characters
- Be specific and descriptive

**Body rules:**

- Explain **why**, not just **what**
- Use bullet points for multiple changes
- Wrap lines at 72 characters
- Separate from subject with a blank line

**Footer rules:**

- Reference issues: `Closes #42`, `Fixes #123`
- Note breaking changes: `BREAKING CHANGE: description`
- Reference related PRs: `See: #789`

### Step 4: Verify

```bash
# View the last commit
git log -1

# View the commit with its diff
git show

# Amend if needed (only before pushing)
git commit --amend
```

## Scope Reference

### Common Backend Scopes

```text
api         - API routes and endpoints
db          - Database schemas, migrations, models
services    - Business logic services
auth        - Authentication and authorization
validation  - Input validation logic
middleware  - Express/Hono middleware
```

### Common Frontend Scopes

```text
ui          - UI components
pages       - Page-level components
hooks       - Custom hooks
forms       - Form components and validation
state       - State management
layout      - Layout components
```

### Cross-Cutting Scopes

```text
types       - TypeScript type definitions
schemas     - Validation schemas
config      - Configuration files
deps        - Dependencies
docs        - Documentation
tests       - Test infrastructure
ci          - CI/CD configuration
```

## Examples by Scenario

### Bug Fix (single file)

```bash
git add src/utils/price-calculator.ts src/utils/price-calculator.test.ts
git commit -m "fix(pricing): correct weekend surcharge calculation

Weekend check used day === 7 which is invalid.
Changed to day === 0 (Sunday) and day === 6 (Saturday).

Added tests for all days of the week to prevent regression.

Fixes #123"
```

### Multi-File Feature

```bash
# Commit 1: Schema
git add src/schemas/search.ts
git commit -m "feat(schemas): add amenity filter to search schema

- Add amenities array field with validation
- Support filtering by multiple amenity types"

# Commit 2: Service
git add src/services/search/
git commit -m "feat(services): implement amenity filtering in search

- Filter results by matching amenities
- Add tests for single and multiple amenity queries"

# Commit 3: API
git add src/routes/search/
git commit -m "feat(api): accept amenities query parameter

- Parse amenities[] from query string
- Validate against known amenity values
- Return filtered results"
```

### Pure Refactoring

```bash
git add src/services/ src/validation/
git commit -m "refactor(services): extract common validation into shared module

- Create ValidationService with reusable methods
- Remove duplicate validation code from 4 services
- No behavior changes, all existing tests pass"
```

## Best Practices

1. **Use imperative mood** -- "add feature" not "added feature"
2. **Keep subject under 72 characters** -- short and scannable
3. **Explain why in the body** -- the diff shows what changed
4. **Reference issues** -- link commits to issue trackers
5. **Group related changes** -- one logical unit per commit
6. **Commit frequently** -- small, focused commits
7. **Verify before committing** -- review staged changes
8. **Do not commit unrelated changes together** -- separate concerns
9. **Do not use vague messages** -- "fix stuff" or "updates" are not helpful
10. **Do not mix formatting with logic** -- keep them in separate commits
11. **Do not commit debug code** -- remove console.log and breakpoints
12. **Do not commit broken code** -- every commit should be buildable
13. **NEVER add attribution lines** -- no `Co-Authored-By`, `Generated by`, or any AI-related footer
14. **Run quality checks first** -- lint, typecheck, and tests must all pass before committing

## Critical Rules

### No Attribution in Commit Messages

**NEVER** include any of the following in generated commit messages:

- `Co-Authored-By: ...` (any variant)
- `Generated by ...`
- `Generated with Claude Code`
- `🤖 Generated with [Claude Code](...)`
- Any line attributing the commit to an AI, assistant, or tool

Commit messages must contain ONLY: type, scope, subject, body, and footer
(issue references, breaking changes). Nothing else.

### Pre-Commit Quality Gate

Before generating commit commands, remind the user to verify:

1. **Lint** passes with no errors
2. **Typecheck** passes with no errors
3. **Tests** pass with no failures

Do NOT generate commits for code that fails quality checks.

## Output

When applying this skill, produce:

1. **Change analysis** -- list of modified files grouped by purpose
2. **Commit strategy** -- how many commits and what each includes
3. **Commit messages** -- well-formatted conventional commit messages (NO attribution lines)
4. **Copy-paste commands** -- ready-to-use git add and git commit commands
5. **Issue references** -- linked to relevant issues or pull requests
