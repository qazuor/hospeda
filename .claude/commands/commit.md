---
name: commit
description: Generate conventional commit messages by analyzing git status and diff, grouping changes logically, and producing copy-paste ready git commands using the git-commit-helper skill
---

# Commit Command

## Purpose

Generate conventional commit messages following project standards, analyze
changed files, group changes logically, and provide copy-paste ready git
commands using the `git-commit-helper` skill.

## Usage

```bash
/commit
```

## Description

Uses the `git-commit-helper` skill to analyze staged/unstaged changes and
generate well-formatted conventional commits. Follows the project's commit
standards (e.g., `commitlint.config.js` or team conventions) and ensures
semantic versioning compatibility.

---

## Execution Flow

### Step 0: Pre-Commit Quality Checks

**MANDATORY — Do this before anything else:**

1. Run **lint** check (`pnpm lint`, `npm run lint`, or project equivalent)
2. Run **typecheck** (`pnpm typecheck`, `tsc --noEmit`, or project equivalent)
3. Run **tests** (`pnpm test`, `npm test`, or project equivalent)

If any check fails, **stop and fix the issues first**. Do NOT proceed to commit
with failing quality checks.

### Step 1: Analyze Git Status

**Actions:**

- Run `git status` to identify changed files
- Run `git diff` to see unstaged changes
- Run `git diff --staged` to see staged changes
- Run `git log -5 --oneline` to understand recent commit style

**Output:**

```text
Analyzing Git Status...

Modified files:
  - src/db/schemas/booking.schema.ts
  - src/models/booking.model.ts
  - src/services/booking/booking.service.ts
  - src/services/booking/booking.service.test.ts
  - src/routes/bookings/index.ts
```

### Step 2: Invoke git-commit-helper Skill

**Process:**

- Activate `git-commit-helper` skill
- Analyze changed files and group by logical units
- Identify appropriate commit types and scopes
- Generate conventional commit messages
- Format copy-paste ready git commands

### Step 3: Present Commit Strategy

**Analysis Provided:**

1. **Changed Areas Identification**
   - Backend: API, services, models
   - Frontend: components, pages, hooks
   - Shared: schemas, types, config
   - Infrastructure: CI, deploy, docs

2. **Commit Grouping Strategy**
   - Group by feature
   - Group by bug fix
   - Group by refactoring
   - Separate concerns properly

3. **Conventional Commit Format**
   - Type: feat, fix, refactor, docs, style, test, build, ci, chore
   - Scope: Affected area of codebase
   - Subject: Clear, imperative summary (max 72 chars)
   - Body: Detailed explanation (why, not what)
   - Footer: Issue references, breaking changes

### Step 4: Generate Commit Commands

**Output Format:**

```bash
# === Commit 1: Database Schema ===
git add src/db/schemas/booking/
git commit -m "feat(db): add booking schema

- Define booking table with required fields
- Add foreign keys to users and products
- Create indexes for common queries
- Add migration script"

# === Commit 2: Service Layer ===
git add src/services/booking/
git commit -m "feat(services): implement booking service

- Create BookingService with CRUD operations
- Add availability checking logic
- Implement booking validation
- Add 95% test coverage"

# === Commit 3: API Endpoints ===
git add src/routes/bookings/
git commit -m "feat(api): add booking endpoints

- POST /bookings - Create booking
- GET /bookings - List user bookings
- GET /bookings/:id - Get booking details
- PATCH /bookings/:id/cancel - Cancel booking
- Add authentication and authorization"
```

---

## Commit Standards

### Conventional Commit Format

```text
{type}({scope}): {subject}

{body}

{footer}
```

### Commit Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, no logic change)
- **refactor**: Code refactoring (no new feature or bug fix)
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **build**: Build system changes
- **ci**: CI/CD changes
- **chore**: Other changes (tooling, config, etc.)

### Common Scopes

**Backend:**

- `api` - API routes and endpoints
- `db` - Database schemas and models
- `services` - Business logic services
- `auth` - Authentication and authorization
- `validation` - Input validation

**Frontend:**

- `ui` - UI components
- `components` - Reusable components
- `hooks` - Custom hooks
- `pages` - Page components
- `forms` - Form components
- `styles` - Styling changes

**Cross-cutting:**

- `types` - TypeScript types
- `schemas` - Validation schemas
- `config` - Configuration
- `deps` - Dependencies
- `docs` - Documentation
- `tests` - Tests
- `ci` - CI/CD

---

## Examples

### Example 1: Single Feature Commit

**Scenario:** Small feature in single file

```bash
git add src/components/SearchBar.tsx
git commit -m "feat(ui): add city filter to search bar

- Add city dropdown component
- Filter results by selected city
- Update search results dynamically

Closes #45"
```

### Example 2: Bug Fix

**Scenario:** Fixed calculation bug

```bash
git add src/utils/price-calculator.ts
git add src/utils/price-calculator.test.ts
git commit -m "fix(pricing): correct weekend surcharge calculation

Weekend check was using day === 7 which is impossible.
Changed to correctly check for day === 0 (Sunday) or day === 6 (Saturday).

Added tests for all days of the week to prevent regression.

Fixes #123"
```

### Example 3: Multi-File Feature (Multiple Commits)

**Scenario:** New feature across multiple layers

```bash
# Commit 1: Schema
git add src/schemas/booking/
git commit -m "feat(schemas): add booking validation schemas

- Create CreateBookingSchema
- Add UpdateBookingSchema
- Add SearchBookingSchema
- Add validation rules"

# Commit 2: Database
git add src/db/schemas/booking/ src/models/
git commit -m "feat(db): implement booking model and schema

- Define booking table structure
- Add relationships to users and products
- Create model with CRUD operations
- Add indexes for performance"

# Commit 3: Service
git add src/services/booking/
git commit -m "feat(services): implement booking service

- Create BookingService with CRUD operations
- Add availability checking
- Implement booking validation
- Add comprehensive tests with 95% coverage"

# Commit 4: API
git add src/routes/bookings/
git commit -m "feat(api): add booking endpoints

- POST /bookings - Create booking
- GET /bookings - List bookings
- GET /bookings/:id - Get details
- PATCH /bookings/:id/cancel - Cancel booking
- Add authentication and rate limiting"
```

### Example 4: Refactoring

**Scenario:** Extract common validation logic

```bash
git add src/validation/
git add src/services/*/
git commit -m "refactor(services): extract common validation logic

- Create shared ValidationService
- Extract duplicate validation code from services
- Update all services to use ValidationService
- No behavior changes - all tests passing"
```

---

## Best Practices

### Subject Line Guidelines

**DO:**

- Use imperative mood ("add" not "added" or "adds")
- Keep under 72 characters
- Be specific and descriptive
- Use lowercase for type and scope
- Do not end with period

**DO NOT:**

- Use vague messages ("fix stuff", "updates")
- Capitalize first letter of subject
- Add period at the end
- Exceed 72 characters

### Body Guidelines

**DO:**

- Explain **why**, not **what**
- Use bullet points for multiple changes
- Wrap at 72 characters
- Separate paragraphs with blank lines
- Include context for complex changes

**DO NOT:**

- Describe what the code does (code shows that)
- Skip body for complex changes
- Mix unrelated changes

### Footer Guidelines

**Use for:**

- Breaking changes: `BREAKING CHANGE: description`
- Issue references: `Closes #42`, `Fixes #123`
- PR references: `See #789`

---

## Commit Strategy Decision Tree

```text
1. Are all changes related to ONE logical unit?
     YES -> Single commit
     NO  -> Multiple commits

2. For multiple commits, group by:
     Layer (Schema -> Model -> Service -> API -> Frontend)
     Feature (if independent features)
     Type (feat, fix, refactor, etc.)

3. Commit order:
   1. Schema/validation changes
   2. Database changes
   3. Service/business logic changes
   4. API/route changes
   5. Frontend/component changes
   6. Documentation
   7. Configuration
```

---

## Output Deliverables

When `/commit` is executed, you receive:

1. **Git Status Analysis** - Current state of repository
2. **Changed Files Grouped** - Organized by logical units
3. **Commit Strategy** - Number of commits and rationale
4. **Conventional Commit Messages** - Properly formatted
5. **Copy-Paste Commands** - Ready-to-execute git commands
6. **Issue References** - Linked to relevant issues/PRs

---

## Important Notes

### DO NOT Stage Files Automatically

**CRITICAL:** This command generates commit suggestions but **DOES NOT execute
`git add`** automatically.

The user must:

1. Review the suggested commits
2. Manually stage files with `git add`
3. Execute the suggested `git commit` commands
4. Verify commits with `git log`

### NO Attribution Lines in Commit Messages

**CRITICAL:** NEVER add any of the following to commit messages:

- `Co-Authored-By: ...`
- `Generated by ...`
- `Generated with Claude Code`
- Any line attributing the commit to an AI tool or assistant

Commit messages must contain ONLY the conventional commit content: type, scope,
subject, body, and footer. Nothing else.

### Atomic Commits Are Mandatory

Every commit MUST be atomic — one logical change per commit. See the
`atomic-commits` doc for full rules. In summary:

- One feature, one fix, or one refactor per commit
- Never mix unrelated changes
- Never use `git add .` or `git add -A`
- Stage specific files with `git add <file>`

### Pre-Commit Quality Checks Are Mandatory

Before creating ANY commit, ensure:

1. **Lint passes** — no lint errors
2. **Typecheck passes** — no type errors
3. **Tests pass** — no failing tests

Do NOT commit code that fails any of these checks.

### Language Consistency

- All commit messages in **English**
- Follow conventional commits standard
- Use project-specific scopes where appropriate
- Reference issues when applicable

### When to Run

- After completing feature implementation
- After fixing bugs
- Before creating pull requests
- After passing `/quality-check`

---

## Related Commands

- `/quality-check` - Run before committing
- `/code-check` - Quick validation before committing
- `/run-tests` - Verify tests before committing
- `/format-markdown` - Format docs before committing

---

## Prerequisites

- Changes completed and saved
- Code passes `/code-check`
- Tests passing
- Clean working directory (or deliberate staged changes)

---

## Post-Command Actions

1. **Review Suggestions** - Verify commit messages make sense
2. **Stage Files** - Run suggested `git add` commands
3. **Commit Changes** - Execute suggested `git commit` commands
4. **Verify History** - Check `git log` to confirm
5. **Push Changes** - Push to remote when ready

---

## Error Prevention

### Common Mistakes to Avoid

**Do not commit:**

- Unrelated changes together
- Commented-out code
- Debug statements
- Broken code
- Secrets or credentials

**Do not:**

- Mix formatting with logic changes
- Skip lint, typecheck, or tests before committing
- Forget to reference issues
- Use vague commit messages
- Add `Co-Authored-By`, `Generated by`, or any AI attribution lines

**Always:**

- Run lint, typecheck, and tests before committing
- Run `/code-check` before committing
- Group related changes logically into atomic commits
- Write descriptive commit messages
- Reference issues in footer

---

**This command leverages the `git-commit-helper` skill to ensure professional,
consistent commit history that supports semantic versioning and makes project
evolution easy to understand.**
