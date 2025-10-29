# Git Commit Helper Skill

## Purpose

Generate conventional commit messages that follow the project's commit standards, analyze changed files, group changes logically, and format copy-paste ready git commands for efficient version control workflow.

---

## Capabilities

- Analyze changed files and git status
- Group changes logically by feature/type
- Generate commit messages per `commitlint.config.js`
- Format copy-paste ready commands
- Ensure semantic versioning compatibility
- Follow conventional commits standard
- Suggest appropriate commit types and scopes

---

## Conventional Commits Format

### Standard Format

```text
{type}({scope}): {subject}

{body}

{footer}
```text

**Components:**

- **type**: Category of change (required)
- **scope**: Area of codebase affected (optional)
- **subject**: Short summary (required, max 72 chars)
- **body**: Detailed description (optional)
- **footer**: Breaking changes, issues (optional)

### Example

```text
feat(accommodations): add search by amenities

- Implement amenity filter in search query
- Add amenity checkboxes to search form
- Update AccommodationService.search() method
- Add tests for amenity filtering

Closes #42
```text

---

## Commit Types

### Primary Types

**feat**: New feature

```bash
git commit -m "feat(bookings): add cancellation feature

- Implement booking cancellation endpoint
- Add cancellation UI in user dashboard
- Send cancellation confirmation email
- Update booking status in database"

```text

**fix**: Bug fix

```bash
git commit -m "fix(pricing): correct weekend surcharge calculation

Weekend check was using incorrect day values.
Saturday is 6, Sunday is 0 (not 7).

Fixes #123"
```text

**docs**: Documentation changes

```bash
git commit -m "docs(api): add endpoint documentation

- Document authentication endpoints
- Add request/response examples
- Include error codes table"

```text

**style**: Code style changes (formatting, no logic change)

```bash
git commit -m "style(components): format with Biome

- Run biome format on all React components
- Fix indentation and spacing
- No functional changes"

```text

**refactor**: Code refactoring (no new feature or bug fix)

```bash
git commit -m "refactor(services): extract common validation logic

- Create BaseValidator class
- Move validation to dedicated methods
- Reduce code duplication
- No behavior changes"

```text

**perf**: Performance improvements

```bash
git commit -m "perf(search): optimize accommodation query

- Add database indexes on city and price_per_night
- Implement query result caching
- Reduce query execution time by 60%"

```text

**test**: Adding or updating tests

```bash
git commit -m "test(bookings): add integration tests

- Test booking creation flow
- Test validation edge cases
- Test error handling
- Achieve 95% coverage"

```text

**build**: Build system changes

```bash
git commit -m "build(deps): update Drizzle ORM to v0.29.0

- Update @drizzle-orm packages
- Update migration scripts
- Test compatibility"

```text

**ci**: CI/CD changes

```bash
git commit -m "ci(github-actions): add E2E test workflow

- Configure Playwright in CI
- Add test database setup
- Run E2E tests on PR"

```text

**chore**: Other changes (tooling, config, etc.)

```bash
git commit -m "chore(eslint): update eslint config

- Enable new TypeScript rules
- Update ignore patterns
- Fix existing violations"

```text

### Breaking Changes

Add `BREAKING CHANGE:` in footer:

```bash
git commit -m "feat(api): change booking response format

BREAKING CHANGE: API now returns ISO 8601 dates instead of timestamps.
Clients must update date parsing logic.

Migration guide: docs/migrations/v2.md"
```text

---

## Scopes

### Backend Scopes

```text
api           - API routes and endpoints
db            - Database schemas and models
services      - Business logic services
auth          - Authentication and authorization
validation    - Input validation
```text

### Frontend Scopes

```text
web           - Web application (Astro)
admin         - Admin dashboard (TanStack Start)
components    - React components
hooks         - Custom React hooks
pages         - Page components
forms         - Form components
ui            - UI components (Shadcn)
```text

### Cross-cutting Scopes

```text
types         - TypeScript types
schemas       - Zod schemas
config        - Configuration
deps          - Dependencies
docs          - Documentation
tests         - Tests
ci            - CI/CD
```text

---

## Commit Message Guidelines

### Subject Line

** GOOD:**

```text
feat(search): add full-text search
fix(pricing): handle zero price edge case
refactor(models): simplify BaseModel interface
```text

**L BAD:**

```text
feat: added some search stuff
FIX - pricing bug
Refactoring
```text

**Rules:**

- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter
- No period at the end
- Max 72 characters
- Be specific and descriptive

### Body

** GOOD:**

```text
fix(bookings): prevent double booking

Check availability before creating booking by:

- Querying existing bookings for date range
- Ensuring no overlap with check-in/check-out
- Adding unique constraint on date ranges
- Returning clear error message

This prevents race conditions where two users
could book the same dates simultaneously.

Fixes #156
```text

**L BAD:**

```text
fix: fixed the bug

Made some changes to fix the issue.
```text

**Rules:**

- Explain **why**, not just **what**
- Use bullet points for multiple changes
- Wrap at 72 characters
- Separate paragraphs with blank lines

### Footer

**Use for:**

- Breaking changes
- Issue references
- PR references

**Examples:**

```text
Closes #42
Fixes #123, #456
BREAKING CHANGE: Changed API response format
See: #789
```text

---

## Workflow

### Step 1: Check Status

```bash

# View changed files

git status

# View diff

git diff
git diff --staged
```text

### Step 2: Group Changes

**Group by logical units:**

- One feature per commit
- One bug fix per commit
- Related changes together

**Example: Instead of one large commit**

```bash

# L BAD: Everything in one commit

git add .
git commit -m "feat: add booking feature"
```text

**Split into logical commits:**

```bash

#  GOOD: Separate commits

# 1. Database schema

git add packages/db/src/schemas/booking/
git commit -m "feat(db): add booking schema

- Define booking table structure
- Add relationships to accommodations and users
- Create indexes for common queries"

# 2. Service layer

git add packages/service-core/src/services/booking/
git commit -m "feat(services): implement booking service

- Add BookingService with CRUD operations
- Implement availability checking
- Add booking validation logic
- Add tests with 95% coverage"

# 3. API routes

git add apps/api/src/routes/bookings/
git commit -m "feat(api): add booking endpoints

- POST /bookings - Create booking
- GET /bookings/:id - Get booking details
- PATCH /bookings/:id - Update booking
- DELETE /bookings/:id - Cancel booking
- Add authentication middleware"

# 4. Frontend UI

git add apps/web/src/components/BookingForm*
git commit -m "feat(web): add booking form component

- Create BookingForm with date selection
- Add guest count selector
- Display pricing breakdown
- Handle form validation
- Show success/error states"

```text

### Step 3: Stage Changes

```bash

# Stage specific files

git add path/to/file1 path/to/file2

# Stage by patch (interactive)

git add -p

# Stage all changes in directory

git add packages/db/

# Stage all changes (use cautiously)

git add .
```text

### Step 4: Write Commit

```bash

# Simple commit

git commit -m "feat(search): add city filter"

# Multi-line commit

git commit -m "feat(search): add city filter

- Add city dropdown to search form
- Filter accommodations by selected city
- Update search results dynamically

Closes #45"

# Or use editor for longer messages

git commit
```text

### Step 5: Verify

```bash

# View last commit

git log -1

# View last commit with diff

git show

# Amend if needed (before pushing)

git commit --amend
```text

---

## Interactive Commit Helper

### Analyzing Changes

When user requests commit help:

1. **Run git status**

   ```bash
   git status
   git diff --stat
   ```

2. **Identify changed areas**
   - Backend: API, services, models
   - Frontend: components, pages, hooks
   - Shared: schemas, types, config
   - Infrastructure: CI, deploy, docs

3. **Group related changes**
   - Same feature
   - Same bug fix
   - Same refactoring

4. **Suggest commit messages**

### Example Analysis

**Changed Files:**

```text
packages/db/src/schemas/accommodation/accommodation.schema.ts
packages/db/src/models/accommodation.model.ts
packages/service-core/src/services/accommodation/accommodation.service.ts
packages/service-core/src/services/accommodation/accommodation.service.test.ts
apps/api/src/routes/accommodations/search.ts
```text

**Analysis:**
All changes related to adding featured accommodations functionality.

**Suggested Commits:**

```bash

# Option 1: Single commit (if changes are tightly coupled)

git add packages/db/ packages/service-core/ apps/api/
git commit -m "feat(accommodations): add featured accommodation support

- Add featured_until column to accommodation schema
- Update AccommodationModel with featured methods
- Add featured filter to AccommodationService.search()
- Create API endpoint GET /accommodations/featured
- Add tests for featured functionality

Closes #89"

# Option 2: Separate commits (if changes are independent)

# Commit 1: Schema

git add packages/db/src/schemas/accommodation/
git commit -m "feat(db): add featured accommodation schema

- Add featured_until timestamp column
- Add index for featured queries
- Update migration"

# Commit 2: Model & Service

git add packages/db/src/models/ packages/service-core/
git commit -m "feat(services): implement featured accommodation logic

- Add setFeatured() method to model
- Add featured filter to service search
- Add validation for featured dates
- Add comprehensive tests"

# Commit 3: API

git add apps/api/src/routes/accommodations/
git commit -m "feat(api): add featured accommodations endpoint

- Create GET /accommodations/featured route
- Add query param for featured filter
- Add authentication for setting featured
- Add rate limiting"

```text

---

## Copy-Paste Ready Commands

### Template

When providing commit suggestions, format as:

```bash

# === Commit 1: {Description} ===

git add {files}
git commit -m "{type}({scope}): {subject}

{body}"

# === Commit 2: {Description} ===

git add {files}
git commit -m "{type}({scope}): {subject}

{body}"
```text

### Real Example

```bash

# === Commit 1: Database Schema ===

git add packages/db/src/schemas/booking/
git commit -m "feat(db): add booking schema

- Define booking table with all required fields
- Add foreign keys to accommodations and users
- Create indexes for common queries
- Add migration script"

# === Commit 2: Service Layer ===

git add packages/service-core/src/services/booking/
git commit -m "feat(services): implement booking service

- Create BookingService with CRUD operations
- Add availability checking logic
- Implement booking validation
- Add 95% test coverage"

# === Commit 3: API Endpoints ===

git add apps/api/src/routes/bookings/
git commit -m "feat(api): add booking endpoints

- POST /bookings - Create booking
- GET /bookings - List user bookings
- GET /bookings/:id - Get booking details
- PATCH /bookings/:id/cancel - Cancel booking
- Add authentication and authorization"

```text

---

## Common Scenarios

### Scenario 1: Bug Fix

**Changes**: Fixed price calculation bug in one file

```bash
git add packages/service-core/src/utils/price-calculator.ts
git add packages/service-core/src/utils/price-calculator.test.ts
git commit -m "fix(pricing): correct weekend surcharge calculation

Weekend check was using day === 7 which is impossible.
Changed to correctly check for day === 0 (Sunday) or day === 6 (Saturday).

Added tests for all days of the week to prevent regression.

Fixes #123"
```text

### Scenario 2: New Feature (Multi-file)

**Changes**: Added search by amenities

```bash

# Schema changes

git add packages/schemas/src/accommodation/search.schema.ts
git commit -m "feat(schemas): add amenities to search schema

- Add amenities array field
- Add validation for amenity values
- Update SearchAccommodationSchema"

# Service changes

git add packages/service-core/src/services/accommodation/
git commit -m "feat(services): implement amenity filtering

- Add amenity filtering to AccommodationService.search()
- Query accommodations with matching amenities
- Add tests for amenity combinations"

# API changes

git add apps/api/src/routes/accommodations/
git commit -m "feat(api): add amenity query parameter

- Accept amenities[] query param in search
- Validate amenity values
- Document in API docs"

# Frontend changes

git add apps/web/src/components/SearchForm.tsx
git commit -m "feat(web): add amenity checkboxes to search form

- Add amenity selection UI
- Show available amenities
- Update search on selection change"

```text

### Scenario 3: Refactoring

**Changes**: Extract validation logic

```bash
git add packages/service-core/src/validation/
git add packages/service-core/src/services/*/
git commit -m "refactor(services): extract common validation logic

- Create shared ValidationService
- Extract duplicate validation code
- Update services to use ValidationService
- No behavior changes
- All tests still passing"

```text

### Scenario 4: Documentation

**Changes**: API documentation updates

```bash
git add docs/api/
git commit -m "docs(api): document accommodation endpoints

- Add endpoint descriptions
- Include request/response examples
- Document error codes
- Add authentication requirements"

```text

---

## Best Practices

###  DO

- Write commits in present tense ("add" not "added")
- Keep subject line under 72 characters
- Use body to explain **why**, not **what**
- Reference issues in footer
- Group related changes
- Commit frequently (small, logical units)
- Verify changes before committing

### L DON'T

- Commit unrelated changes together
- Use vague messages ("fix stuff", "updates")
- Skip the body for complex changes
- Commit commented-out code
- Commit debug statements
- Commit broken code
- Mix formatting with logic changes

---

## Deliverables

When this skill is applied, produce:

1. **Analyzed Changes** - List of modified files grouped by purpose
2. **Commit Strategy** - How many commits and what each includes
3. **Commit Messages** - Well-formatted conventional commits
4. **Copy-Paste Commands** - Ready-to-use git commands
5. **Issue References** - Linked to relevant issues/PRs

---

**This skill ensures consistent, professional commit history that supports semantic versioning and makes project history easy to understand.**

