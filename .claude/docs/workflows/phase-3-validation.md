# Phase 3: Validation

This document describes the validation phase workflow for the Hospeda project.

---

## Table of Contents

1. [Overview](#overview)
2. [Goals](#goals)
3. [Validation Process](#validation-process)
4. [Quality Checks](#quality-checks)
5. [Review Process](#review-process)
6. [Issue Resolution](#issue-resolution)

---

## Overview

**Phase 3** is the validation phase where we ensure the implementation meets all quality standards before finalization.

**Duration:** 3-6 hours (depending on feature complexity)

**Key Principle:** Quality gate before finalization. Nothing proceeds with failing checks.

---

## Goals

### Primary Goals

1. **Validate Functionality**: All acceptance criteria met
2. **Ensure Quality**: Code, tests, security, performance
3. **Catch Issues**: Find and fix problems before finalization
4. **Get Approval**: Tech lead approval before Phase 4

### Success Metrics

- ✅ All acceptance criteria validated
- ✅ All quality checks passing
- ✅ All reviews complete
- ✅ All critical/high issues resolved
- ✅ Tech lead approved

---

## Validation Process

### Step 1: QA Validation

**Duration:** 30 minutes - 1 hour

**Agent:** `qa-engineer` with `qa-criteria-validator` skill

**Process:**

1. **Read PDR.md**
   - Review all acceptance criteria
   - Understand expected behavior
   - Check constraints

2. **Validate Each Criterion**

   ```
   Acceptance Criterion: AC-001
   Given: User is authenticated host
   When: Creating accommodation with valid data
   Then: Accommodation is created with pending status

   ✅ PASS: Tested manually and with automated tests
   ```

3. **Test All Scenarios**
   - Happy path
   - Edge cases
   - Error cases
   - Boundary conditions

4. **Check UI/UX**
   - Matches mockups/wireframes
   - Brand guidelines applied
   - Responsive on all breakpoints
   - Loading states present
   - Error messages clear
   - User feedback immediate

5. **Check Accessibility**
   - Keyboard navigation works
   - Screen reader friendly
   - Focus states visible
   - ARIA labels correct
   - Color contrast sufficient
   - Alt text for images

6. **Check Performance**
   - Page load time acceptable
   - API response time fast
   - No unnecessary re-renders
   - Images optimized

7. **Check Security**
   - Input validation present
   - XSS protection working
   - Auth/authz correct
   - No sensitive data exposed

**Deliverable:** Validation report

**Format:**

```markdown

# QA Validation Report: {Feature Name}

## Summary

- Total Criteria: 15
- Passed: 13
- Failed: 2
- Status: NEEDS FIXES

## Detailed Results

### AC-001: Create accommodation as host

✅ PASS

- Tested with valid data
- Accommodation created successfully
- Status set to "pending" correctly

### AC-002: Reject non-host users

❌ FAIL

- Guest user able to create accommodation
- Expected: 403 Forbidden
- Actual: 201 Created
- Severity: HIGH

### AC-003: Validate capacity limits

❌ FAIL

- Capacity 0 accepted
- Expected: Validation error
- Actual: Record created
- Severity: MEDIUM

## Issues Found

1. [HIGH] Non-host users can create accommodations
2. [MEDIUM] Capacity validation not enforced

## Recommendations

- Fix authorization check in API route
- Add capacity validation in service layer

```text

---

### Step 2: Iteration on Feedback

**Duration:** Variable (depends on issues)

**Process:**

1. **Review Feedback**
   - Read validation report
   - Understand all issues
   - Prioritize by severity

2. **Fix Issues**
   - Start with critical/high
   - Write tests that expose bug
   - Fix implementation
   - Verify tests pass

3. **Re-run Validation**
   - QA engineer re-tests
   - Verify all fixes work
   - Check for regressions

4. **Repeat Until Clean**
   - Continue until all pass
   - No critical/high issues
   - Medium/low documented

---

### Step 3: Quality Check Command

**Duration:** 15-30 minutes

**Command:**

```bash
/quality-check
```text

**Execution Order:**

1. **Lint** (STOP on first error)

   ```bash
   pnpm lint
   ```

- Check code style
- Check formatting
- Stop if any errors

2. **TypeCheck** (STOP on first error)

   ```bash
   pnpm typecheck
   ```

   - Verify type safety
   - Check type definitions
   - Stop if any errors

3. **Tests** (STOP on first error)

   ```bash
   pnpm test:coverage
   ```

   - Run all tests
   - Check coverage ≥ 90%
   - Stop if any failures

4. **Code Review** (Report all)
   - Backend review
   - Frontend review
   - Architecture validation
   - Report all findings

5. **Security Review** (Report all)
   - Security audit
   - Vulnerability scan
   - Report all findings

6. **Performance Review** (Report all)
   - Bundle size check
   - Query performance
   - Core Web Vitals
   - Report all findings

**Output:** Consolidated quality report

---

## Quality Checks

### Code Check

**What it checks:**

- Linting rules
- Code formatting
- Import organization
- Naming conventions

**Pass Criteria:**

- Zero lint errors
- Zero type errors
- All files formatted

---

### Test Check

**What it checks:**

- All tests passing
- Coverage ≥ 90%
- No skipped tests
- No flaky tests

**Pass Criteria:**

- 100% tests passing
- Coverage above threshold
- All tests stable

---

### Code Review

**Backend Review:**

**Checks:**

- Follows BaseCrudService pattern
- Proper error handling
- Business logic correct
- Database queries optimized
- Transactions used correctly
- Security considerations

**Agent:** `backend-reviewer`

**Output:**

```markdown

# Backend Code Review

## Summary

- Files Reviewed: 8
- Issues Found: 3
- Severity: 1 High, 2 Medium

## Issues

### [HIGH] Missing transaction in booking creation

**File:** `packages/service-core/src/services/booking/booking.service.ts`
**Line:** 45
**Issue:** Multi-step operation not wrapped in transaction
**Impact:** Data consistency risk
**Recommendation:**
```typescript

await this.db.transaction(async (trx) => {
  const booking = await trx.insert(bookings).values(data);
  await trx.insert(bookingItems).values(items);
  return booking;
});

```text

### [MEDIUM] N+1 query problem

**File:** `packages/db/src/models/accommodation.model.ts`
**Line:** 67
**Issue:** Loading related data in loop
**Recommendation:** Use joins or batch loading
```text

**Frontend Review:**

**Checks:**

- Component reusability
- State management correct
- TanStack Query used properly
- Accessibility compliance
- Brand guidelines applied
- Performance optimizations

**Agent:** `frontend-reviewer`

---

### Architecture Validation

**Checks:**

- Follows layer architecture
- Consistent with existing patterns
- SOLID principles followed
- No architectural drift
- Proper separation of concerns

**Agent:** `architecture-validator`

**Output:**

```markdown

# Architecture Validation

## Summary

- Architectural Consistency: ✅ PASS
- Pattern Adherence: ✅ PASS
- SOLID Principles: ⚠️ WARNING

## Findings

### ✅ Layer Architecture

All layers properly separated:

- Database → Service → API → Frontend
- No layer violations detected

### ✅ Pattern Adherence

- All models extend BaseModel ✓
- All services extend BaseCrudService ✓
- Routes use factory pattern ✓

### ⚠️ Single Responsibility Principle

**File:** `BookingService`
**Issue:** Service handling both booking logic and email notifications
**Recommendation:** Extract email notifications to separate service
```text

---

### Security Review

**Checks:**

- Authentication implementation
- Authorization logic
- Input validation
- XSS prevention
- SQL injection prevention
- CSRF protection
- Dependency vulnerabilities

**Agent:** `security-engineer`

**Output:**

```markdown

# Security Review

## Summary

- Security Score: 8/10
- Critical Issues: 0
- High Issues: 1
- Medium Issues: 2

## Issues

### [HIGH] Insufficient input sanitization

**File:** `apps/api/src/routes/search.ts`
**Line:** 23
**Issue:** User input used directly in query
**Recommendation:** Use parameterized queries
**Impact:** Potential SQL injection

### [MEDIUM] Missing rate limiting

**Endpoint:** `POST /api/bookings`
**Issue:** No rate limit configured
**Recommendation:** Add rate limiting middleware
**Impact:** Potential abuse
```text

---

### Performance Review

**Checks:**

- Bundle sizes
- Database query performance
- API response times
- Core Web Vitals
- Memory usage
- Network requests

**Agent:** `performance-engineer`

**Output:**

```markdown

# Performance Review

## Summary

- Bundle Size: ✅ PASS (within limits)
- Query Performance: ⚠️ WARNING (some slow queries)
- Core Web Vitals: ✅ PASS

## Metrics

### Bundle Size

- JavaScript: 145 KB (target: < 200 KB) ✅
- CSS: 12 KB (target: < 20 KB) ✅
- Total: 157 KB ✅

### Database Performance

- Average query time: 45ms ✅
- Slowest query: 320ms ⚠️
  - Query: `SELECT * FROM accommodations WHERE ...`
  - Recommendation: Add index on (type, capacity)

### Core Web Vitals

- LCP: 1.8s (target: < 2.5s) ✅
- FID: 45ms (target: < 100ms) ✅
- CLS: 0.05 (target: < 0.1) ✅

```text

---

### Accessibility Review

**Checks:**

- WCAG AA compliance
- Keyboard navigation
- Screen reader support
- Focus management
- Color contrast
- ARIA labels

**Agent:** `accessibility-engineer`

**Output:**

```markdown

# Accessibility Review

## Summary

- WCAG Level: AA
- Compliance: 95%
- Issues Found: 3

## Issues

### [MEDIUM] Missing alt text

**Component:** `AccommodationCard`
**Issue:** Image missing alt attribute
**Fix:** Add descriptive alt text

### [LOW] Focus not visible

**Component:** `BookingForm`
**Issue:** Focus ring not visible on submit button
**Fix:** Add focus-visible styles
```text

---

## Review Process

### Tech Lead Global Review

**Duration:** 30 minutes - 1 hour

**Agent:** `tech-lead`

**Purpose:** Final integration and consistency check

**What it checks:**

1. **Integration**
   - All parts work together
   - No integration issues
   - Smooth data flow

2. **Consistency**
   - Consistent patterns across code
   - Consistent naming
   - Consistent error handling

3. **Completeness**
   - All acceptance criteria met
   - All tasks completed
   - Nothing missing

4. **Quality**
   - Overall code quality
   - Test quality
   - Documentation quality

**Decision:**

- ✅ **APPROVED**: Proceed to Phase 4
- ⚠️ **APPROVED WITH NOTES**: Proceed, address notes in future
- ❌ **REJECTED**: Fix issues, re-review

---

## Issue Resolution

### Issue Prioritization

**Critical:**

- Security vulnerabilities
- Data loss risks
- System crashes
- **Action:** MUST FIX before proceeding

**High:**

- Core functionality broken
- Major UX issues
- Performance problems
- **Action:** SHOULD FIX before proceeding

**Medium:**

- Minor functionality issues
- Small UX improvements
- Code quality issues
- **Action:** Document, fix if time permits

**Low:**

- Nice-to-have improvements
- Minor refactoring
- **Action:** Document as technical debt

### Issue Tracking

**Format in TODOs.md:**

```markdown

## Issues Found During Validation

| ID | Severity | Description | Status | Owner |
|----|----------|-------------|--------|-------|
| V-001 | HIGH | Missing auth check | Fixed | @backend |
| V-002 | MEDIUM | Slow query | Fixed | @db-engineer |
| V-003 | LOW | Minor UI alignment | Deferred | - |
```text

### Resolution Process

1. **Log Issue**
   - Add to TODOs.md
   - Assign severity
   - Assign owner

2. **Fix Issue**
   - Write test that exposes issue
   - Implement fix
   - Verify test passes
   - Verify no regressions

3. **Re-validate**
   - QA re-tests
   - Run quality checks
   - Verify fix works

4. **Update Status**
   - Mark as fixed
   - Document solution
   - Close issue

---

## Summary Checklist

Before proceeding to Phase 4:

### QA Validation

- [ ] All acceptance criteria tested
- [ ] All pass or documented exceptions
- [ ] UI/UX validated
- [ ] Accessibility validated
- [ ] Performance validated
- [ ] Security validated

### Quality Checks

- [ ] Lint passing (zero errors)
- [ ] TypeCheck passing (zero errors)
- [ ] Tests passing (100%)
- [ ] Coverage ≥ 90%

### Code Reviews

- [ ] Backend review complete
- [ ] Frontend review complete
- [ ] Architecture validation complete
- [ ] All critical/high issues fixed
- [ ] Medium/low documented

### Specialized Reviews

- [ ] Security review complete
- [ ] Performance review complete
- [ ] Accessibility review complete
- [ ] No critical issues

### Final Approval

- [ ] Tech lead reviewed
- [ ] Tech lead approved
- [ ] User notified of completion
- [ ] Ready for Phase 4

---

**Remember: Quality is non-negotiable. Fix issues before proceeding.**

