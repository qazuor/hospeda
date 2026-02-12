---
name: quality-check
description: Master quality validation orchestrating code checks, tests, code review, security review, and performance review with stop-on-error for critical checks and report-all for reviews
---

# Quality Check Command

## Purpose

Comprehensive quality validation running lint, typecheck, tests, and all review
commands. This is the **MASTER** validation command combining multiple quality
gates into a single comprehensive check.

## Usage

```bash
/quality-check
```

## Description

Executes a complete quality validation pipeline combining code quality checks
(lint, typecheck), test execution, and comprehensive reviews (code, security,
performance). Uses **STOP on error for critical checks** and **REPORT all for
reviews** to ensure quality while providing complete feedback.

---

## Execution Flow

This command orchestrates multiple quality checks in a specific order, stopping
at critical failures but continuing through reviews to provide complete
feedback.

### Step 1: Code Quality Checks (STOP on error)

**Command**: `/code-check`

**Process:**

1. **Lint Validation**
   - Run project linter (auto-detected)
   - Check code style and formatting
   - Verify import organization
   - **STOPS** on first linting error

2. **Type Checking**
   - Run type checker across all packages
   - Verify type safety
   - Check import resolution
   - **STOPS** on first type error

**STOP Condition**: Any linting or type error

**Why Stop**: Code must compile and pass basic quality checks before proceeding
to tests and reviews.

**Output on Error:**

```text
QUALITY CHECK FAILED - Code Quality Error

Step: Type Checking
File: src/services/user.service.ts:45:12
Error: Property 'id' does not exist on type 'CreateUserRequest'

Fix this error before proceeding with quality check.
Run /code-check again after fixing.
```

---

### Step 2: Test Validation (STOP on failure)

**Command**: `/run-tests`

**Process:**

1. **Unit Tests** - Test individual functions and methods
2. **Integration Tests** - Test component interactions
3. **E2E Tests** - Test complete user flows (if configured)
4. **Coverage Check** - Verify coverage meets minimum threshold (default 90%)

**STOP Condition**: Any test failure or coverage below configured minimum

**Why Stop**: Broken tests indicate broken functionality or insufficient
coverage.

**Output on Error:**

```text
QUALITY CHECK FAILED - Test Failure

Failed Tests: 3
Coverage: 87% (below 90% minimum)

Failed Test Details:

1. src/services/booking/booking.service.test.ts
   Test: "should check availability before creating booking"
   Error: Expected true to be false

2. src/routes/bookings/create.test.ts
   Test: "should return 400 for invalid booking data"
   Error: Expected status 400 but got 500

Fix failing tests and achieve coverage minimum before proceeding.
Run /run-tests again after fixing.
```

---

### Step 3: Code Quality Review (REPORT all findings)

**Process:**

Review all source code for quality, patterns, and architecture adherence.

**Review Areas:**

1. **Backend Review**
   - Review API routes, services, models
   - Check pattern compliance
   - Verify architecture adherence

2. **Frontend Review**
   - Review components, pages, hooks
   - Check accessibility compliance
   - Verify UX patterns

3. **Architecture Validation**
   - Validate layer separation
   - Check dependency management
   - Verify pattern consistency

**Behavior**: **REPORTS all findings** but does NOT stop execution

**Why Continue**: Code reviews provide valuable feedback but should not block the
pipeline. Critical issues can be addressed after seeing the full picture.

**Output:**

```text
CODE QUALITY REVIEW

Backend Review:
  API Routes: Excellent pattern compliance
  Service Layer: Clean business logic
  MEDIUM: Missing error handling in UserController
    File: src/routes/users/index.ts:78
    Fix: Add try-catch around service call

Frontend Review:
  Component Architecture: Well-structured
  MEDIUM: Performance issue in ItemList
    File: src/components/ItemList.tsx:67
    Fix: Memoize filter function with useCallback

Architecture Review:
  Layer Separation: Clean boundaries
  Package Organization: Logical structure
  Pattern Consistency: SOLID principles followed

Summary: 2 medium issues found (address soon)
```

---

### Step 4: Security Review (REPORT all findings)

**Command**: `/security-audit`

**Review Areas:**

- Authentication and authorization
- Input validation and sanitization
- SQL injection prevention
- XSS prevention
- CSRF protection
- Secret management
- Dependency vulnerabilities

**Behavior**: **REPORTS all findings** but does NOT stop execution

**Output:**

```text
SECURITY REVIEW

Authentication & Authorization:
  JWT implementation secure
  Role-based access control properly implemented
  MEDIUM: Consider adding rate limiting to auth endpoints

Input Validation:
  Validation schemas used consistently
  All user input validated

Vulnerability Scan:
  No known dependency vulnerabilities
  No hardcoded secrets found

Summary: 1 medium security recommendation
```

---

### Step 5: Performance Review (REPORT all findings)

**Command**: `/performance-audit`

**Review Areas:**

- Database query optimization
- API response times
- Frontend bundle size
- Component render optimization
- Caching strategies
- N+1 query detection

**Behavior**: **REPORTS all findings** but does NOT stop execution

**Output:**

```text
PERFORMANCE REVIEW

Backend Performance:
  Database queries optimized
  Proper indexing implemented
  LOW: Consider adding cache for search results

Frontend Performance:
  Code splitting implemented
  Lazy loading configured
  MEDIUM: Bundle size could be reduced by 15%
    Suggestion: Analyze with bundle analyzer

API Performance:
  Response times within acceptable range
  Rate limiting configured

Summary: 1 medium optimization opportunity
```

---

## Complete Output Format

### Success Case (No Issues)

```text
QUALITY CHECK COMPLETE - ALL CHECKS PASSED

Step 1: Code Quality
  Lint: No violations found
  Type Check: All packages compile successfully

Step 2: Tests
  Tests Passed: 247/247
  Coverage: 94.2%

Step 3: Code Review
  Backend: High quality, pattern compliant
  Frontend: Accessible, performant, well-structured
  Architecture: Clean boundaries, SOLID principles

Step 4: Security Review
  No vulnerabilities found
  All security best practices followed

Step 5: Performance Review
  Optimized queries and bundles
  Response times acceptable

Code meets all quality standards!
```

---

### Failure Case (Critical Issues)

```text
QUALITY CHECK FAILED

Step 1: Code Quality FAILED
  FAILED: Type checking error
  File: src/routes/bookings/index.ts:45:12
  Error: Property 'id' does not exist

PIPELINE STOPPED

Fix the above error and run /quality-check again.
Remaining steps (tests, reviews) were not executed.
```

---

### Partial Success (All checks pass, but reviews find issues)

```text
QUALITY CHECK - ISSUES TO ADDRESS

Step 1: Code Quality
  Lint: Passed
  Type Check: Passed

Step 2: Tests
  Tests: 247/247 passed
  Coverage: 94.2%

Step 3: Code Review
  Backend: 1 medium issue
  Frontend: 1 medium issue
  Architecture: Passed

Step 4: Security Review
  1 medium security recommendation

Step 5: Performance Review
  1 medium optimization opportunity

Summary:
  Critical Issues: 0
  Medium Issues: 3
  Low Issues: 1

Address medium issues before merge.
Consider addressing low issues during next refactor.
```

---

## Quality Standards Reference

### Critical Quality Gates (Must Pass)

These checks **STOP** execution on failure:

1. **Linting** - No rule violations
2. **Type Checking** - No type errors
3. **Tests** - All tests passing
4. **Coverage** - Meets minimum threshold (default 90%)

### Advisory Quality Checks (Report but Continue)

These checks **REPORT** findings but do not stop:

1. **Code Quality Review** - Architecture and patterns
2. **Security Review** - Security best practices
3. **Performance Review** - Optimization opportunities

---

## Issue Severity Levels

### Critical (Must Fix Before Merge)

- Type errors
- Linting violations
- Test failures
- Coverage below threshold
- Security vulnerabilities
- Accessibility violations

### Medium (Should Fix Soon)

- Performance optimization opportunities
- Inconsistent pattern usage
- Missing test coverage for edge cases
- Documentation gaps
- Code smell patterns

### Low (Nice to Fix)

- Code style suggestions
- Minor refactoring opportunities
- Optimization suggestions
- Documentation improvements

---

## When to Run

### Required Workflow Points

1. **Before Merge**
   - After implementing all features
   - Before creating pull request
   - Before user approval

2. **Before Creating Pull Request**
   - Ensure all quality gates pass
   - Address critical and medium issues

3. **Pre-Commit Check**
   - Verify changes maintain quality
   - Catch issues early

### Recommended Workflow Points

- After completing a major feature
- After significant refactoring
- Before merging feature branch
- Periodically during development

---

## Prerequisites

- All code changes saved
- Dependencies installed
- Database migrations applied (if applicable)
- Environment variables configured

---

## Post-Command Actions

### If All Passed

1. Proceed to finalization
2. Update documentation with `/update-docs`
3. Run `/commit` to generate commit messages
4. Present commits to user for approval

### If Critical Issues Found

1. **STOP** - Do not proceed
2. Fix reported errors immediately
3. Run `/quality-check` again
4. Continue only after all critical issues resolved

### If Only Advisory Issues Found

1. Review all reported issues
2. Create list of medium issues to address
3. Discuss with user whether to fix now or later
4. If approved, proceed to finalization
5. Consider creating follow-up tasks for improvements

---

## Configuration

Quality check behavior can be customized via project configuration:

### Coverage Threshold

The default coverage minimum is **90%**. Override this in your test runner
configuration (e.g., `vitest.config.ts`, `jest.config.js`):

```json
{
  "coverage": {
    "lines": 90,
    "functions": 90,
    "branches": 90,
    "statements": 90
  }
}
```

### Lint Rules

Configure linting rules in your project linter configuration file (e.g.,
`biome.json`, `.eslintrc`, `eslint.config.js`).

---

## Troubleshooting

### "Type errors but code works locally"

- Ensure dependencies are installed
- Clear cache (e.g., `rm -rf node_modules/.cache`)
- Rebuild packages

### "Tests fail in quality-check but pass locally"

- Check environment variables
- Verify database state
- Check for timing issues in tests

### "Quality check too slow"

- Use build cache if available
- Run individual checks during development
- Only run full quality-check before merge

---

## Related Commands

### Individual Component Commands

- `/code-check` - Only lint and typecheck
- `/run-tests` - Only test execution
- `/security-audit` - Only security review
- `/performance-audit` - Only performance review

### Workflow Commands

- `/commit` - Generate commit messages (after quality-check)
- `/update-docs` - Update documentation
- `/add-new-entity` - Begin new entity/feature creation

---

**This command is the master quality gate ensuring code meets project standards
before finalization and merge.**
