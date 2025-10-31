# Quality Check Command

## Purpose

Comprehensive quality validation running lint, typecheck, tests, and all review commands. This is the **MASTER** validation command used in Phase 3 before finalization. Combines multiple quality gates into a single comprehensive check.

## Usage

```bash
/quality-check
```

## Description

Executes a complete quality validation pipeline combining code quality checks (lint, typecheck), test execution, and comprehensive reviews (code, security, performance). Uses **STOP on error for critical checks** and **REPORT all for reviews** to ensure quality while providing complete feedback.

---

## Execution Flow

This command orchestrates multiple quality checks in a specific order, stopping at critical failures but continuing through reviews to provide complete feedback.

### Step 1: Code Quality Checks (STOP on error)

**Command**: `/code-check`

**Process:**

1. **TypeScript Validation** (`pnpm typecheck`)
   - Compile all packages
   - Verify type safety
   - Check import resolution
   - **STOPS** on first TypeScript error

2. **Lint Validation** (`pnpm lint`)
   - Run Biome linting
   - Check code style
   - Verify import organization
   - **STOPS** on first linting error

**STOP Condition**: Any TypeScript or linting error

**Why Stop**: Code must compile and pass basic quality checks before proceeding to tests and reviews.

**Output on Error:**

```text
L QUALITY CHECK FAILED - Code Quality Error

Step: TypeScript Validation
File: apps/api/src/routes/accommodations/index.ts:45:12
Error: Property 'id' does not exist on type 'CreateAccommodationRequest'

=Ñ Fix this error before proceeding with quality check.
Run /code-check again after fixing.
```

---

### Step 2: Test Validation (STOP on failure)

**Command**: `/run-tests`

**Process:**

1. **Unit Tests** - Test individual functions and methods
2. **Integration Tests** - Test component interactions
3. **E2E Tests** - Test complete user flows
4. **Coverage Check** - Verify e 90% coverage

**Execution:**

```bash
pnpm test
```

**STOP Condition**: Any test failure or coverage below 90%

**Why Stop**: Broken tests indicate broken functionality or insufficient coverage.

**Output on Error:**

```text
L QUALITY CHECK FAILED - Test Failure

Failed Tests: 3
Coverage: 87% (below 90% minimum)

Failed Test Details:

1. packages/service-core/src/services/booking/booking.service.test.ts
   Test: "should check availability before creating booking"
   Error: Expected true to be false

2. apps/api/src/routes/bookings/create.test.ts
   Test: "should return 400 for invalid booking data"
   Error: Expected status 400 but got 500

=Ñ Fix failing tests and achieve 90% coverage before proceeding.
Run /run-tests again after fixing.
```

---

### Step 3: Code Quality Review (REPORT all findings)

**Command**: `/review-code`

**Agents Invoked:**

1. **backend-reviewer**
   - Review API routes, services, models
   - Check pattern compliance
   - Verify architecture adherence

2. **frontend-reviewer**
   - Review components, pages, hooks
   - Check accessibility compliance
   - Verify UX patterns

3. **architecture-validator**
   - Validate layer separation
   - Check dependency management
   - Verify pattern consistency

**Behavior**: **REPORTS all findings** but does NOT stop execution

**Why Continue**: Code reviews provide valuable feedback but shouldn't block the pipeline. Critical issues can be addressed after seeing the full picture.

**Output:**

```text
=Ë CODE QUALITY REVIEW

Backend Review (backend-reviewer):
 API Routes: Excellent pattern compliance
 Service Layer: Clean business logic
  MEDIUM: Missing error handling in BookingController
   File: apps/api/src/routes/bookings/index.ts:78
   Fix: Add try-catch around service call

Frontend Review (frontend-reviewer):
 Component Architecture: Well-structured
  MEDIUM: Performance issue in AccommodationList
   File: apps/web/src/components/accommodation/AccommodationList.tsx:67
   Fix: Memoize filter function with useCallback

Architecture Review (architecture-validator):
 Layer Separation: Clean boundaries
 Package Organization: Logical structure
 Pattern Consistency: SOLID principles followed

Summary: 2 medium issues found (address soon)
```

---

### Step 4: Security Review (REPORT all findings)

**Command**: `/review-security`

**Agent Invoked**: `security-engineer`

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
= SECURITY REVIEW

Authentication & Authorization:
 JWT implementation secure
 Role-based access control properly implemented
  MEDIUM: Consider adding rate limiting to auth endpoints

Input Validation:
 Zod schemas used consistently
 All user input validated

Vulnerability Scan:
 No known dependency vulnerabilities
 No hardcoded secrets found

Summary: 1 medium security recommendation
```

---

### Step 5: Performance Review (REPORT all findings)

**Command**: `/review-performance`

**Agent Invoked**: `performance-engineer`

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
¡ PERFORMANCE REVIEW

Backend Performance:
 Database queries optimized
 Proper indexing implemented
9 LOW: Consider adding Redis cache for search results

Frontend Performance:
 Code splitting implemented
 Lazy loading configured
  MEDIUM: Bundle size could be reduced by 15%
   Suggestion: Analyze with bundle analyzer

API Performance:
 Response times within acceptable range
 Rate limiting configured

Summary: 1 medium optimization opportunity
```

---

## Complete Output Format

### Success Case (No Issues)

```text
 QUALITY CHECK COMPLETE - ALL CHECKS PASSED

Step 1: Code Quality 
  TypeScript: All packages compile successfully
  Lint: No violations found

Step 2: Tests 
  Tests Passed: 247/247
  Coverage: 94.2%

Step 3: Code Review 
  Backend: High quality, pattern compliant
  Frontend: Accessible, performant, well-structured
  Architecture: Clean boundaries, SOLID principles

Step 4: Security Review 
  No vulnerabilities found
  All security best practices followed

Step 5: Performance Review 
  Optimized queries and bundles
  Response times acceptable

=€ Code meets all quality standards!
Ready for Phase 4: Finalization
```

---

### Failure Case (Critical Issues)

```text
L QUALITY CHECK FAILED

Step 1: Code Quality L
  FAILED: TypeScript compilation error
  File: apps/api/src/routes/bookings/index.ts:45:12
  Error: Property 'id' does not exist

=Ñ PIPELINE STOPPED

Fix the above error and run /quality-check again.
Remaining steps (tests, reviews) were not executed.
```

---

### Partial Success (All checks pass, but reviews find issues)

```text
  QUALITY CHECK - ISSUES TO ADDRESS

Step 1: Code Quality 
  TypeScript:  Passed
  Lint:  Passed

Step 2: Tests 
  Tests:  247/247 passed
  Coverage:  94.2%

Step 3: Code Review  
  Backend: 1 medium issue
  Frontend: 1 medium issue
  Architecture:  Passed

Step 4: Security Review  
  1 medium security recommendation

Step 5: Performance Review  
  1 medium optimization opportunity

=Ê Summary:
  Critical Issues: 0
  Medium Issues: 3
  Low Issues: 1

  Address medium issues before merge.
Consider addressing low issues during next refactor.
```

---

## Quality Standards Reference

### Critical Quality Gates (Must Pass)

These checks **STOP** execution on failure:

1. **TypeScript Compilation** - No type errors
2. **Linting** - No rule violations
3. **Tests** - All tests passing
4. **Coverage** - e 90% code coverage

### Advisory Quality Checks (Report but Continue)

These checks **REPORT** findings but don't stop:

1. **Code Quality Review** - Architecture and patterns
2. **Security Review** - Security best practices
3. **Performance Review** - Optimization opportunities

---

## Issue Severity Levels

### Critical (=Ñ Must Fix Before Merge)

- TypeScript errors
- Linting violations
- Test failures
- Coverage below threshold
- Security vulnerabilities
- Accessibility violations

### Medium (  Should Fix Soon)

- Performance optimization opportunities
- Inconsistent pattern usage
- Missing test coverage for edge cases
- Documentation gaps
- Code smell patterns

### Low (9 Nice to Fix)

- Code style suggestions
- Minor refactoring opportunities
- Optimization suggestions
- Documentation improvements

---

## When to Run

### Required Workflow Points

1. **Phase 3: Validation**
   - After implementing all features
   - Before invoking `tech-lead` for final review
   - Before user approval

2. **Before Creating Pull Request**
   - Ensure all quality gates pass
   - Address critical and medium issues

3. **Pre-Commit Check**
   - Verify changes maintain quality
   - Catch issues early

### Recommended Workflow Points

- After completing major feature
- After significant refactoring
- Before merging feature branch
- Periodically during development

---

## Prerequisites

- All code changes saved
- Dependencies installed (`pnpm install`)
- Database migrations applied (if applicable)
- Environment variables configured

---

## Post-Command Actions

### If All Passed

1. Proceed to **Phase 4: Finalization**
2. Invoke `tech-writer` to update documentation
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
4. If approved, proceed to Phase 4
5. Consider creating follow-up tasks for improvements

---

## Performance Notes

**Typical Duration**: 2-5 minutes for full monorepo

**Breakdown:**

- Code Quality: 30-60 seconds
- Tests: 60-120 seconds
- Code Review: 30-60 seconds
- Security Review: 20-40 seconds
- Performance Review: 20-40 seconds

**Optimization:**

- TurboRepo caching speeds up repeated runs
- Parallel execution where possible
- Incremental checks for unchanged packages

---

## Related Commands

### Individual Component Commands

- `/code-check` - Only lint and typecheck
- `/run-tests` - Only test execution
- `/review-code` - Only code quality review
- `/review-security` - Only security review
- `/review-performance` - Only performance review

### Workflow Commands

- `/commit` - Generate commit messages (after quality-check)
- `/update-docs` - Update documentation (Phase 4)
- `/start-feature-plan` - Begin new feature (Phase 1)

---

## Integration with Development Workflow

### Phase 1: Planning

- Not required during planning phase

### Phase 2: Implementation

- Run `/code-check` frequently during development
- Run `/run-tests` after completing features
- Optional: Run individual review commands as needed

### Phase 3: Validation (P REQUIRED)

- **MUST** run `/quality-check` before Phase 4
- Address all critical issues
- Discuss medium/low issues with user
- Get user approval before proceeding

### Phase 4: Finalization

- Run after quality check passes
- Generate commits
- Update documentation
- Prepare for merge

---

## Configuration

Quality check behavior can be customized via project configuration:

### Coverage Threshold

```json
// package.json or vitest.config.ts
{
  "test": {
    "coverage": {
      "lines": 90,
      "functions": 90,
      "branches": 90,
      "statements": 90
    }
  }
}
```

### Lint Rules

```json
// biome.json
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

---

## Troubleshooting

### "TypeScript errors but code works locally"

- Ensure dependencies are installed: `pnpm install`
- Clear cache: `rm -rf node_modules/.cache`
- Rebuild packages: `pnpm build`

### "Tests fail in quality-check but pass locally"

- Check environment variables
- Verify database state
- Check for timing issues in tests

### "Quality check too slow"

- Use TurboRepo cache: Enabled by default
- Run individual checks during development
- Only run full quality-check before merge

---

**This command is the master quality gate ensuring code meets project standards before finalization and merge.**

---

## Changelog

| Version | Date | Changes | Author | Related |
|---------|------|---------|--------|---------|
| 1.0.0 | 2025-10-31 | Initial version | @tech-lead | P-004 |
