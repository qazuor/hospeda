# Commands - Available Actions

This directory contains command definitions for automated workflows in the Hospeda project. All command files are **READ-ONLY** and should never be modified.

## How Commands Work

Commands are invoked using the `/command-name` syntax. Each command:

- Has a specific purpose and workflow
- Invokes relevant agents as needed
- Produces specific deliverables
- Follows a consistent execution pattern

---

## Planning Commands (2)

### `/start-feature-plan`

**Purpose:** Initialize comprehensive planning for a new feature

**File:** [start-feature-plan.md](./start-feature-plan.md)

**Process:**

1. Create `.claude/sessions/planning/{feature_name}/` directory
2. Invoke `product-functional` → Create PDR.md
3. Invoke `ui-ux-designer` → Mockups/wireframes
4. Invoke `product-technical` → tech-analysis.md
5. Break down into atomic tasks (1-2 hours each)
6. Iteratively refine until fully atomic
7. Create TODOs.md with priorities and dependencies
8. Update PDR.md with links

**Output:** Complete planning package ready for implementation

---

### `/start-refactor-plan`

**Purpose:** Plan refactoring work safely

**File:** [start-refactor-plan.md](./start-refactor-plan.md)

**Process:**

1. Invoke `debugger` → Analyze current code
2. Invoke `architecture-validator` → Identify issues
3. Invoke `product-technical` → Create refactor plan
4. Break down into safe, incremental steps
5. Identify tests to add/update
6. Create TODO list with priorities

**Output:** Refactoring plan with step-by-step tasks

---

## Quality Assurance Commands (3)

### `/quality-check`

**Purpose:** Complete quality validation before merge

**File:** [quality-check.md](./quality-check.md)

**Execution Order:**

1. `/code-check` (lint + typecheck) - **STOP on first error**
2. `/run-tests` - **STOP on first error**
3. `/review-code` - report all findings
4. `/review-security` - report all findings
5. `/review-performance` - report all findings

**Output:** Consolidated quality report with all findings

---

### `/code-check`

**Purpose:** Run linting and type checking

**File:** [code-check.md](./code-check.md)

**Process:**

1. Navigate to package root
2. Run `pnpm typecheck` - stop on first error
3. Run `pnpm lint` - stop on first error
4. Report issues with file locations

**Output:** Lint and type check results

---

### `/run-tests`

**Purpose:** Execute test suite with coverage

**File:** [run-tests.md](./run-tests.md)

**Process:**

1. Run `pnpm test:coverage` from repo root
2. Check coverage against 90% threshold
3. Report failures with details
4. Suggest missing test cases

**Output:** Test results with coverage report

---

## Code Review Commands (3)

### `/review-code`

**Purpose:** Comprehensive code review

**File:** [review-code.md](./review-code.md)

**Process:**

1. Invoke `backend-reviewer` for backend changes
2. Invoke `frontend-reviewer` for frontend changes
3. Invoke `architecture-validator` for consistency
4. Invoke `tech-lead` for global integration review
5. Present findings with severity (Critical, High, Medium, Low)
6. Suggest fixes with code examples

**Output:** Code review report in `.claude/sessions/planning/{feature_name}/code-review.md`

---

### `/review-security`

**Purpose:** Security audit of codebase

**File:** [review-security.md](./review-security.md)

**Process:**

1. Invoke `security-engineer`
2. Review authentication implementation
3. Check authorization logic
4. Validate input sanitization
5. Check for SQL injection risks
6. Review API security
7. Check dependency vulnerabilities

**Output:** Security audit report with findings and recommendations

---

### `/review-performance`

**Purpose:** Performance analysis and optimization

**File:** [review-performance.md](./review-performance.md)

**Process:**

1. Invoke `performance-engineer`
2. Analyze bundle sizes
3. Check database query performance
4. Review Core Web Vitals
5. Identify bottlenecks
6. Suggest optimizations

**Output:** Performance report with metrics and recommendations

---

### `/pen-test`

**Purpose:** Security penetration testing

**File:** [pen-test.md](./pen-test.md)

**Process:**

1. Invoke `security-engineer`
2. Test for OWASP Top 10 vulnerabilities
3. Test authentication/authorization
4. Test input validation
5. Check for exposed secrets
6. Test API security

**Output:** Penetration testing report with findings

---

## Development Commands (2)

### `/add-new-entity`

**Purpose:** Create complete full-stack entity

**File:** [add-new-entity.md](./add-new-entity.md)

**Process:**

1. Invoke `product-technical` for entity design
2. Create in order:
   - Zod schemas (`@repo/schemas`)
   - Types via `z.infer<typeof schema>`
   - Drizzle schema (`@repo/db/schemas`)
   - Model extending BaseModel (`@repo/db/models`)
   - Service extending BaseCrudService (`@repo/service-core`)
   - API routes using factory pattern (`apps/api/routes`)
3. Generate migration
4. Create comprehensive tests (unit + integration)
5. Update barrel files (index.ts)
6. Generate documentation

**Output:** Complete entity with tests and docs

---

### `/update-docs`

**Purpose:** Update project documentation

**File:** [update-docs.md](./update-docs.md)

**Process:**

1. Invoke `tech-writer`
2. Identify what needs documentation
3. Update or create:
   - API documentation (OpenAPI)
   - Component usage guides
   - Architecture decisions
   - Deployment guides
4. Generate diagrams if needed
5. Update README files

**Output:** Updated documentation in `/docs`

---

## Git Commands (1)

### `/commit`

**Purpose:** Prepare git commits following conventional commits

**File:** [commit.md](./commit.md)

**Process:**

1. Analyze changed files by feature/type
2. Group changes logically
3. Generate commit messages following `commitlint.config.js`
4. Format as copy-paste ready commands
5. **DO NOT stage files** (user does manually)

**Output Format:**

```bash

# Commit 1: {title}

git add {files...}
git commit -m "{type}({scope}): {subject}

{body with bullet points}"

# Commit 2: {title}

git add {files...}
git commit -m "{type}({scope}): {subject}

{body}"
```text

**Output:** Formatted git commit commands ready to copy-paste

---

## Analysis Commands (1)

### `/five-why`

**Purpose:** Root cause analysis using 5 Whys technique

**File:** [five-why.md](./five-why.md)

**Use Cases:**

- Debugging complex bugs
- Analyzing architectural decisions
- Understanding recurring problems
- Root cause analysis of issues

**Process:**

1. Invoke `debugger`
2. Perform 5 Whys analysis:
   - Problem statement
   - Why? (1st level)
   - Why? (2nd level)
   - Why? (3rd level)
   - Why? (4th level)
   - Why? (5th level - root cause)
3. Identify root cause
4. Propose solutions with tradeoffs
5. Present options to user

**Output:** 5 Whys analysis document with root cause and solution options

---

## Total: 12 Commands

## Command Categories Summary

- **Planning**: 2 commands (feature, refactor)
- **Quality Assurance**: 3 commands (quality-check, code-check, run-tests)
- **Code Review**: 4 commands (review-code, review-security, review-performance, pen-test)
- **Development**: 2 commands (add-new-entity, update-docs)
- **Git**: 1 command (commit)
- **Analysis**: 1 command (five-why)

---

## Command Execution Guidelines

### Stop on Error vs Report All

**STOP on first error:**

- `/code-check` - Stop at first lint or typecheck error
- `/run-tests` - Stop at first test failure
- `/quality-check` - Stop at lint/typecheck/test errors

**REPORT all findings:**

- `/review-code` - Report all code issues
- `/review-security` - Report all security findings
- `/review-performance` - Report all performance issues
- `/pen-test` - Report all vulnerabilities

### When to Use Each Command

**Before starting work:**

- `/start-feature-plan` - Every new feature
- `/start-refactor-plan` - Before refactoring

**During implementation:**

- `/code-check` - Frequently during development
- `/run-tests` - After each significant change
- `/five-why` - When encountering bugs or unclear decisions

**Before merge:**

- `/quality-check` - Always before requesting merge
- Individual review commands if specific concerns

**After implementation:**

- `/update-docs` - After feature complete
- `/commit` - When ready to commit

**Specialized needs:**

- `/add-new-entity` - When adding new domain entities
- `/pen-test` - Before handling sensitive data or production release

---

## Command Files are READ-ONLY

All files in `.claude/commands/` are **READ-ONLY** and must not be modified. They contain precise instructions for Claude Code to execute specific workflows.

If a command needs improvement:

1. Document the issue in CLAUDE.md Recent Learnings
2. Discuss with user
3. Update command file only after user approval

---

**See individual command files for detailed execution instructions.**

