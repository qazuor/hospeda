# Phase 4: Finalization

This document describes the finalization phase workflow for the Hospeda project.

---

## Table of Contents

1. [Overview](#overview)
2. [Goals](#goals)
3. [Documentation Process](#documentation-process)
4. [Commit Preparation](#commit-preparation)
5. [Final Checklist](#final-checklist)

---

## Overview

**Phase 4** is the finalization phase where we document the work and prepare commits for the user to review and merge.

**Duration:** 1-2 hours

**Key Principle:** Complete documentation and clean commit history.

---

## Goals

### Primary Goals

1. **Document Work**: Comprehensive documentation in `/docs`
2. **Prepare Commits**: Clean, conventional commits ready for user
3. **Final Verification**: Everything complete and ready
4. **Handoff**: Clear handoff to user for merge

### Success Metrics

- ✅ All documentation complete
- ✅ Commits prepared (not executed)
- ✅ User has clear next steps
- ✅ Feature ready for production

---

## Documentation Process

### Step 1: Invoke Tech Writer

**Duration:** 30 minutes - 1 hour

**Agent:** `tech-writer`

**Command:**

```bash
/update-docs
```text

---

### Step 2: Identify Documentation Needs

**What needs documentation:**

1. **API Endpoints** (if new/modified)
   - OpenAPI/Swagger docs
   - Endpoint descriptions
   - Request/response examples
   - Error codes
   - Rate limits

2. **Components** (if new/modified)
   - Component README
   - Props documentation
   - Usage examples
   - Variants
   - Accessibility notes

3. **Architecture** (if significant changes)
   - Architecture Decision Records (ADRs)
   - Updated diagrams
   - Pattern explanations

4. **Deployment** (if infrastructure changes)
   - Environment variables
   - Configuration changes
   - Migration steps
   - Rollback procedures

---

### Step 3: API Documentation

**Location:** `/docs/api/{entity}.md`

**Format:**

```markdown

# {Entity} API

## Overview

Brief description of the API endpoints for {entity}.

## Endpoints

### List {Entities}

`GET /api/{entities}`

**Authentication:** Public / Required

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Page number |
| pageSize | number | No | 20 | Items per page |

**Response:**
```json

{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {...}
  }
}

```text

**Example:**
```bash

curl https://api.hospeda.com/api/accommodations?page=1

```text

### Create {Entity}

`POST /api/{entities}`

[Continue with full endpoint documentation]
```text

**OpenAPI Generation:**

```typescript
// Ensure all routes have @openapi comments
/**

 * @openapi
 * /api/accommodations:
 *   post:
 *     summary: Create accommodation
 *     ...

 */
```text

---

### Step 4: Component Documentation

**Location:** `/docs/components/{Component}.md`

**Format:**

```markdown

# {Component}

Brief description of what the component does.

## Usage

\`\`\`tsx
import { Component } from '@/components';

<Component prop1="value" prop2={value} />
\`\`\`

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| prop1 | string | Yes | - | Description |
| prop2 | number | No | 0 | Description |

## Examples

### Basic usage

\`\`\`tsx
<Component prop1="example" />
\`\`\`

### Advanced usage

\`\`\`tsx
<Component
  prop1="example"
  prop2={42}
  onAction={handleAction}
/>
\`\`\`

## Accessibility

- Keyboard navigable
- Screen reader friendly
- WCAG AA compliant

## Styling

Uses Tailwind CSS. Customizable via className prop.

## Dependencies

- React 19
- Tailwind CSS
- Shadcn UI

```text

---

### Step 5: Architecture Documentation

**When needed:**

- Significant architectural changes
- New patterns introduced
- Technology decisions

**Format:** Architecture Decision Record (ADR)

**Location:** `/docs/architecture/decisions/ADR-{number}-{title}.md`

```markdown

# ADR-{number}: {Title}

## Status

Proposed | Accepted | Deprecated | Superseded

## Context

What is the issue we're trying to solve?

## Decision

What did we decide to do?

## Rationale

Why did we make this decision?

- Reason 1
- Reason 2

## Consequences

### Positive

- Benefit 1
- Benefit 2

### Negative

- Drawback 1
- Drawback 2

### Neutral

- Note 1

## Alternatives Considered

1. **Option 1**
   - Pros: ...
   - Cons: ...

2. **Option 2**
   - Pros: ...
   - Cons: ...

## References

- Link 1
- Link 2

```text

---

### Step 6: Update README Files

**Package READMEs:**

If new packages or significant changes:

```markdown

# @repo/{package-name}

Brief description

## Installation

\`\`\`bash
pnpm add @repo/{package-name}
\`\`\`

## Usage

\`\`\`typescript
import { Thing } from '@repo/{package-name}';
\`\`\`

## Documentation

See [full documentation](../../docs/{package}.md)
```text

**Main README:**

Update if:

- New features for users
- Changed commands
- New requirements

---

### Step 7: Generate Diagrams

**When needed:**

- New data models (ERD)
- New flows (sequence diagrams)
- New architecture (system diagrams)

**Tools:** Mermaid (in markdown)

**Examples:**

**Entity Relationship:**

```mermaid
erDiagram
    USER ||--o{ BOOKING : makes
    ACCOMMODATION ||--o{ BOOKING : has
    BOOKING ||--|| PAYMENT : requires
```text

**Sequence Diagram:**

```mermaid
sequenceDiagram
    User->>Frontend: Click "Book"
    Frontend->>API: POST /bookings
    API->>Service: create()
    Service->>Database: insert()
    Database-->>Service: booking
    Service-->>API: result
    API-->>Frontend: 201 Created
    Frontend-->>User: Show confirmation
```text

**System Diagram:**

```mermaid
graph TB
    User[User]
    Web[Web App]
    Admin[Admin App]
    API[API]
    DB[(Database)]

    User -->|HTTPS| Web
    User -->|HTTPS| Admin
    Web -->|REST| API
    Admin -->|REST| API
    API -->|Drizzle| DB
```text

---

### Step 8: Document Technical Debt

**Location:** `tech-analysis.md` or separate `TECH_DEBT.md`

**Format:**

```markdown

## Technical Debt

### TD-001: Optimize accommodation search

**Created:** 2024-01-15
**Priority:** Medium
**Effort:** 8 hours
**Description:** Current search uses full table scan. Need to add indexes.
**Impact:** Slow for large datasets (>10k records)
**Plan:** Add composite index in next sprint

### TD-002: Refactor booking service

**Created:** 2024-01-15
**Priority:** Low
**Effort:** 4 hours
**Description:** Booking service has too many responsibilities
**Impact:** Hard to maintain and test
**Plan:** Extract email notifications to separate service
```text

---

## Commit Preparation

### Step 1: Run Commit Command

**Command:**

```bash
/commit
```text

**What it does:**

1. Analyzes all changed files
2. Groups changes by feature/type
3. Generates conventional commit messages
4. Formats as copy-paste ready commands

**Important:** Does NOT execute commits. User does manually.

---

### Step 2: Commit Message Format

**Standard:** Conventional Commits

**Format:**

```text
<type>(<scope>): <subject>

<body>
```text

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Code style (formatting)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Tests
- `build` - Build system
- `ci` - CI/CD
- `chore` - Other changes

**Scope:** Package or feature name

**Subject:** Brief description (imperative mood)

**Body:** Detailed explanation with bullet points

---

### Step 3: Example Output

```bash

# Commit 1: Add accommodation listing entity

git add packages/schemas/src/accommodation/
git add packages/types/src/accommodation/
git add packages/db/src/schemas/accommodation/
git add packages/db/src/models/accommodation.model.ts
git commit -m "feat(entities): add accommodation listing entity

- Add accommodation types and interfaces
- Add Zod validation schemas with business rules
- Add Drizzle schema with relationships
- Add AccommodationModel extending BaseModel
- Include comprehensive unit tests (95% coverage)
- Add JSDoc documentation for all exports"

# Commit 2: Add accommodation service layer

git add packages/service-core/src/services/accommodation/
git commit -m "feat(services): add accommodation business logic

- Create AccommodationService extending BaseCrudService
- Implement host-only creation rule
- Add custom search with filters (type, capacity, price)
- Add availability check logic
- Include service integration tests (92% coverage)
- Document all public methods with JSDoc"

# Commit 3: Add accommodation API endpoints

git add apps/api/src/routes/accommodation/
git commit -m "feat(api): add accommodation CRUD endpoints

- Add protected CRUD routes using factory pattern
- Add public list/search endpoints
- Include authentication middleware
- Add input validation with Zod
- Add OpenAPI documentation
- Include API integration tests (90% coverage)"

# Commit 4: Add accommodation UI components

git add apps/web/src/components/accommodation/
git add apps/web/src/pages/accommodations/
git commit -m "feat(ui): add accommodation listing UI

- Create AccommodationList component with pagination
- Create AccommodationCard component with variants
- Create AccommodationForm with TanStack Form
- Add TanStack Query integration for data fetching
- Implement responsive design (mobile + desktop)
- Apply brand guidelines (colors, typography)
- Include component tests (88% coverage)
- Add accessibility features (keyboard nav, ARIA labels)"

# Commit 5: Add documentation

git add docs/api/accommodations.md
git add docs/components/AccommodationCard.md
git commit -m "docs: add accommodation feature documentation

- Add API endpoint documentation with examples
- Add component usage guides
- Include entity relationship diagrams
- Document business rules and constraints"

# Commit 6: Update configuration

git add drizzle.config.ts
git commit -m "chore: update drizzle config for new schema

- Add accommodation table to schema
- Update migration path"

```text

---

### Step 4: Commit Grouping Strategy

**Group by:**

1. **Layer** (Database, Service, API, Frontend)
2. **Type** (feat, fix, docs, test)
3. **Logical units** (cohesive changes)

**Don't:**

- ❌ Mix layers in one commit
- ❌ Mix types (feat + fix)
- ❌ Create giant commits (>50 files)
- ❌ Create tiny commits (1 line changes)

**Do:**

- ✅ Keep commits focused
- ✅ Make commits atomic
- ✅ Write clear messages
- ✅ Include context in body

---

### Step 5: Present to User

**Format:**

```text
Feature implementation complete! 🎉

Summary:

- ✅ All acceptance criteria met
- ✅ 90%+ test coverage achieved
- ✅ All quality checks passing
- ✅ Documentation complete

I've prepared 6 commits following conventional commits:

1. feat(entities): Add accommodation entity
2. feat(services): Add business logic
3. feat(api): Add API endpoints
4. feat(ui): Add UI components
5. docs: Add documentation
6. chore: Update configuration

The commits are ready for you to review and execute.
Each commit is independent and can be reviewed separately.

Next steps:

1. Review the commits below
2. Copy and paste each git command
3. Push to your branch
4. Create PR for review

[Show formatted commit commands]
```text

---

## Final Checklist

### Before Handoff to User

**Implementation:**

- [ ] All acceptance criteria met
- [ ] All tasks in TODOs.md complete
- [ ] All tests passing (100%)
- [ ] Coverage ≥ 90%
- [ ] Lint passing (zero errors)
- [ ] TypeCheck passing (zero errors)

**Quality:**

- [ ] Code review complete
- [ ] Security review complete
- [ ] Performance review complete
- [ ] Accessibility review complete
- [ ] Tech lead approved

**Documentation:**

- [ ] API documentation complete
- [ ] Component documentation complete
- [ ] Architecture docs (if needed)
- [ ] README files updated
- [ ] Diagrams created
- [ ] Technical debt documented

**Commits:**

- [ ] Commits prepared (not executed)
- [ ] Conventional format followed
- [ ] Grouped logically
- [ ] Messages clear and descriptive
- [ ] Ready for user to copy/paste

**Handoff:**

- [ ] User notified of completion
- [ ] Clear next steps provided
- [ ] Questions anticipated
- [ ] Success communicated

---

## Handoff Template

```text

# Feature Complete: {Feature Name}

## Summary

✅ **Implementation Complete**

- All {n} acceptance criteria validated
- {n} tasks completed over {n} days
- {n}% test coverage achieved
- All quality gates passed

## What Was Built

### Database Layer

- Added {entity} schema with relationships
- Created model with custom search
- Added migration with rollback

### Service Layer

- Implemented business logic with validation
- Added {n} custom methods
- Enforced business rules: {list}

### API Layer

- Added {n} endpoints (CRUD + custom)
- Implemented authentication/authorization
- Added rate limiting and validation

### Frontend

- Created {n} components (List, Card, Form, Detail)
- Implemented state management with TanStack Query
- Applied responsive design and brand guidelines
- Ensured WCAG AA accessibility

## Quality Metrics

- Test Coverage: {n}%
- Tests Passing: {n}/{n} (100%)
- Lint Errors: 0
- Type Errors: 0
- Security Issues: 0
- Performance: All benchmarks met

## Documentation

Created:

- `/docs/api/{entity}.md` - API documentation
- `/docs/components/{Component}.md` - Component guides
- Updated README files

## Technical Debt

Documented {n} items for future improvement:

1. {Item 1} - Priority: {P}, Effort: {n}h
2. {Item 2} - Priority: {P}, Effort: {n}h

## Commits Prepared

I've prepared {n} commits following conventional commits standard.
Each commit is focused, atomic, and well-documented.

**Please review and execute the commits below:**

[Show commit commands]

## Next Steps

1. **Review Commits**
   - Read through each commit message
   - Verify changes make sense
   - Ask questions if unclear

2. **Execute Commits**
   - Copy and paste each git command
   - Commits will be added to your branch

3. **Push Branch**

   ```bash
   git push origin feature/{feature-name}
   ```

4. **Create PR**
   - Open pull request on GitHub
   - Add description from PDR.md
   - Request reviews from team

5. **Deploy** (after PR approval)
   - Merge to main
   - Automatic deployment via Vercel
   - Monitor for issues

## Questions?

Let me know if you need:

- Clarification on any commits
- Changes to commit grouping
- Additional documentation
- Anything else!

Ready to proceed? 🚀

```text

---

## 🔥 CRITICAL: Final State Update

**Before Closing Phase 4:**

When the feature is fully finalized and ready for deployment, you MUST update all state files one last time:

### 1. Update .checkpoint.json (Mark Feature Complete)

```json
{
  "currentPhase": "completed",
  "status": "feature-complete",
  "phases": {
    "phase-1-planning": {
      "status": "completed",
      "duration": "6h"
    },
    "phase-2-implementation": {
      "status": "completed",
      "duration": "32h",
      "tasksCompleted": 45
    },
    "phase-3-validation": {
      "status": "completed",
      "duration": "4h",
      "issuesFound": 3,
      "issuesFixed": 2
    },
    "phase-4-finalization": {
      "status": "completed",
      "started": "2024-01-16T08:00:00Z",
      "completed": "2024-01-16T12:00:00Z",
      "duration": "4h"
    }
  },
  "summary": {
    "totalDuration": "46h",
    "totalTasks": 45,
    "completedTasks": 45,
    "deferredIssues": 1,
    "technicalDebtItems": 2
  },
  "completedAt": "2024-01-16T12:00:00Z"
}
```

### 2. Update TODOs.md (Mark All Complete)

```markdown
# Feature: User Authentication System

## Status: ✅ COMPLETED

- Started: 2024-01-10
- Completed: 2024-01-16
- Total Duration: 46 hours
- Tasks Completed: 45/45 (100%)

## Phases

- ✅ Phase 1: Planning (6h)
- ✅ Phase 2: Implementation (32h)
- ✅ Phase 3: Validation (4h)
- ✅ Phase 4: Finalization (4h)

## Summary

All acceptance criteria met. Feature ready for production deployment.

[Keep existing detailed task list below]
```

### 3. Update issues-sync.json (Final Sync)

```json
{
  "sessionId": "P-001-user-auth",
  "status": "completed",
  "completedAt": "2024-01-16T12:00:00Z",
  "issues": {
    "HOSP-120": { "status": "done" },
    "HOSP-121": { "status": "done" },
    "HOSP-122": { "status": "done" }
    // ... all issues marked as done
  },
  "metadata": {
    "totalIssues": 45,
    "completedIssues": 45,
    "lastSync": "2024-01-16T12:00:00Z",
    "syncStatus": "final-sync-complete"
  }
}
```

### 4. Commit Final State

```bash
git add .claude/sessions/planning/P-001-user-auth/TODOs.md
git add .claude/sessions/planning/P-001-user-auth/.checkpoint.json
git add .claude/sessions/planning/P-001-user-auth/issues-sync.json
git commit -m "docs: Phase 4 completed - feature ready for deployment

- All 45 tasks completed (100%)
- Documentation finalized
- Technical debt documented
- Ready for production deployment"

git push origin main
```

### 5. Optional: Sync with Linear

```bash
pnpm planning:sync .claude/sessions/planning/P-001-user-auth/
```

This will:
- Mark all Linear issues as "Done"
- Update project progress to 100%
- Add final comment with summary

---

## Summary

**Phase 4 Checklist:**

- [ ] Documentation complete
- [ ] Commits prepared (not executed)
- [ ] 🔥 **TODOs.md updated (marked complete)**
- [ ] 🔥 **.checkpoint.json updated (marked complete)**
- [ ] 🔥 **issues-sync.json updated (final sync)**
- [ ] 🔥 **State changes committed and pushed**
- [ ] User notified
- [ ] Clear next steps
- [ ] All files in proper locations
- [ ] Technical debt documented
- [ ] Success celebrated 🎉

---

**Remember: User controls the git history. We prepare, they execute.**

**⚠️ CRITICAL**: State files MUST be updated and committed before considering the feature "complete". This ensures accurate project tracking and team visibility.

