---
name: qa-criteria-validator
description: Acceptance criteria validation patterns. Use when verifying feature implementations against specs, UI/UX compliance, or test coverage requirements.
---

# QA Criteria Validator

## Purpose

Validate that a feature implementation meets all acceptance criteria from its specification, covering functional requirements, UI/UX compliance, accessibility (WCAG AA), performance benchmarks, security requirements, test coverage, and error handling. This skill produces a structured validation report with pass/fail status and actionable recommendations.

## When to Use

- Before marking a feature as complete
- During code review of feature branches
- Before production release
- When verifying bug fixes meet their acceptance criteria
- As part of sprint review or QA sign-off

## Process

### Step 1: Review Requirements

1. Locate the feature specification or requirements document
2. Extract all acceptance criteria (functional and non-functional)
3. Note performance targets, security requirements, and edge cases
4. Identify UI/UX specifications and design references

**Example Acceptance Criteria:**

```markdown
## Acceptance Criteria

### Functional
- [ ] User can search resources by keyword
- [ ] Results display within 2 seconds
- [ ] Each result shows: title, description, status
- [ ] Empty state shown when no results match
- [ ] Error state shown on API failure

### Non-Functional
- [ ] WCAG AA compliant
- [ ] Responsive (mobile, tablet, desktop)
- [ ] Test coverage > 90%
- [ ] Bundle size impact < 50KB
```

### Step 2: Functional Validation

Test each acceptance criterion individually and record the result.

```typescript
const functionalValidation = {
  feature: 'Resource Search',
  criteriaChecks: [
    {
      criterion: 'User can search resources by keyword',
      status: 'pass',  // pass | fail | partial
      evidence: 'Tested with 5 different keywords, all returned correct results',
      issues: [],
    },
    {
      criterion: 'Results display within 2 seconds',
      status: 'fail',
      evidence: 'Average response time: 3.5 seconds',
      issues: ['Database query needs optimization', 'Consider adding an index'],
    },
    {
      criterion: 'Empty state shown when no results',
      status: 'pass',
      evidence: 'Tested with non-matching keyword, empty state displayed correctly',
      issues: [],
    },
  ],
};
```

**Manual test case template:**

```markdown
### Test Case: Basic Search

**Steps:**
1. Navigate to the search page
2. Enter "test keyword" in the search box
3. Click the search button

**Expected:**
- Results display within 2 seconds
- At least 1 result shown
- Each result has title, description, status

**Actual:**
[Document what actually happened]

**Status:** PASS / FAIL / PARTIAL
```

### Step 3: UI/UX Validation

**Visual compliance checklist:**

- [ ] Layout matches design specification
- [ ] Colors follow the design system
- [ ] Typography is consistent
- [ ] Spacing and padding are correct
- [ ] Hover, focus, active, and disabled states are styled
- [ ] Loading states are implemented
- [ ] Animations are smooth and purposeful

**Responsive design:**

- [ ] Works on mobile (320px+)
- [ ] Works on tablet (768px+)
- [ ] Works on desktop (1024px+)
- [ ] Touch targets are at least 44x44px
- [ ] Text remains readable at all sizes

### Step 4: Accessibility Validation

**WCAG AA checklist:**

**Perceivable:**

- [ ] All images have descriptive alt text
- [ ] Color contrast >= 4.5:1 (normal text)
- [ ] Color contrast >= 3:1 (large text >= 18px)
- [ ] Color is not the sole indicator of information
- [ ] Text resizable to 200% without content loss

**Operable:**

- [ ] All functionality is keyboard accessible
- [ ] Tab order is logical
- [ ] Focus indicators are visible
- [ ] No keyboard traps exist
- [ ] Skip-to-main-content link is present

**Understandable:**

- [ ] Language attribute set on HTML element
- [ ] Form labels are associated with inputs
- [ ] Error messages are clear and helpful
- [ ] Navigation is consistent across pages

**Robust:**

- [ ] Valid HTML (no errors)
- [ ] ARIA attributes used correctly
- [ ] Works with screen readers
- [ ] No JavaScript console errors

**Automated testing:**

```bash
# Run accessibility checks
npx pa11y http://localhost:3000/search
npx lighthouse http://localhost:3000/search --only-categories=accessibility
```

### Step 5: Performance Validation

- [ ] FCP (First Contentful Paint) < 1.8s
- [ ] LCP (Largest Contentful Paint) < 2.5s
- [ ] CLS (Cumulative Layout Shift) < 0.1
- [ ] FID (First Input Delay) < 100ms
- [ ] API responses < 2s (p95)
- [ ] Database queries < 100ms
- [ ] No memory leaks detected
- [ ] Bundle size impact within budget

### Step 6: Security Validation

- [ ] Protected endpoints require authentication
- [ ] Users can only access their own resources
- [ ] All user inputs are validated server-side
- [ ] No XSS vulnerabilities
- [ ] CSRF protection is enabled
- [ ] No sensitive data in error messages
- [ ] Security headers are set
- [ ] Dependencies have no known critical vulnerabilities

### Step 7: Test Coverage Validation

- [ ] Lines coverage > 90%
- [ ] Functions coverage > 90%
- [ ] Branches coverage > 90%
- [ ] Unit tests for business logic
- [ ] Integration tests for service interactions
- [ ] Component tests for UI elements
- [ ] E2E tests for critical user paths

### Step 8: Error Handling Validation

- [ ] Network timeout handled gracefully
- [ ] Offline state detected and communicated
- [ ] Retry mechanism available for transient failures
- [ ] Form validation errors displayed inline
- [ ] Error messages are helpful and specific
- [ ] 500 errors show a generic user-friendly message
- [ ] 404 page exists with navigation options

## Validation Report Template

```markdown
# QA Validation Report: [Feature Name]

**Date:** YYYY-MM-DD
**Feature:** [Feature Name]
**Specification:** [Link or reference]

## Summary

**Overall Status:** PASS / FAIL / PASS WITH ISSUES

## Functional Validation

| Criterion | Status | Evidence | Issues |
|-----------|--------|----------|--------|
| [Criterion 1] | PASS | [Evidence] | None |
| [Criterion 2] | FAIL | [Evidence] | [Issue description] |

## UI/UX Validation
- Visual compliance: PASS / FAIL
- Responsive design: PASS / FAIL
- Interactive states: PASS / FAIL

## Accessibility Validation
- WCAG AA compliance: PASS / FAIL
- Automated test results: X violations

## Performance Validation
- Core Web Vitals: PASS / FAIL
- API performance: PASS / FAIL
- Bundle size: PASS / FAIL

## Security Validation
- Authentication: PASS / FAIL
- Input validation: PASS / FAIL
- Data protection: PASS / FAIL

## Test Coverage
- Lines: XX%
- Functions: XX%
- Branches: XX%

## Issues Found

### Must Fix (Before Release)
1. [Issue with impact and recommendation]

### Should Fix (Nice to Have)
1. [Issue with impact and recommendation]

## Recommendation
- [ ] Ready for production
- [ ] Minor fixes needed (list above)
- [ ] Major fixes required (list above)
- [ ] Needs redesign
```

## Best Practices

1. **Validate early** -- do not wait until the end of development
2. **Document evidence** -- screenshots, test results, metrics
3. **Be specific** -- cite exact criteria and exact outcomes
4. **Prioritize issues** -- distinguish critical from cosmetic
5. **Test edge cases** -- empty states, error states, boundary values
6. **Automate where possible** -- integrate checks into CI/CD
7. **Use real data** -- test with production-like data volumes
8. **Involve stakeholders** -- share reports for sign-off
9. **Track trends** -- compare quality across releases
10. **Revalidate after fixes** -- confirm issues are actually resolved

## Deliverables

When applying this skill, produce:

1. **Validation report** with pass/fail for each criterion
2. **Issue list** with severity, impact, and recommendations
3. **Evidence** -- screenshots, test output, metric snapshots
4. **Coverage report** showing threshold compliance
5. **Release recommendation** with clear rationale
