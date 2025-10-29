# QA Criteria Validator Skill

## Purpose

Validate implementation against acceptance criteria from PDR.md, ensuring functionality, UI/UX compliance, accessibility (WCAG AA), performance benchmarks, security requirements, and overall quality standards are met before feature completion.

---

## Capabilities

- Validate against PDR.md acceptance criteria
- Check UI/UX compliance with mockups
- Validate functionality against user stories
- Check accessibility (WCAG AA compliance)
- Validate performance benchmarks
- Check security requirements
- Validate error handling
- Check responsive design
- Verify test coverage
- Validate documentation

---

## Validation Process

### Step 1: Review Requirements

**Read PDR.md (Product Development Requirements):**

```markdown

1. Locate PDR.md for the feature
2. Read acceptance criteria section
3. Note functional requirements
4. Note non-functional requirements (performance, security)
5. Identify edge cases mentioned
6. Review UI/UX specifications

```text

**Example PDR.md Acceptance Criteria:**

```markdown

## Acceptance Criteria

### Functional

- [ ] User can search accommodations by city
- [ ] Search results display within 2 seconds
- [ ] Each card shows: title, city, price, image
- [ ] Clicking card navigates to details page
- [ ] Empty state shown when no results
- [ ] Error state shown on API failure

### Non-Functional

- [ ] WCAG AA compliant
- [ ] Responsive (mobile, tablet, desktop)
- [ ] Test coverage > 90%
- [ ] Bundle size < 300KB

```text

### Step 2: Functional Validation

**Test each acceptance criterion:**

```typescript
// Validation checklist template
const functionalValidation = {
  feature: 'Accommodation Search',
  criteriaChecks: [
    {
      criterion: 'User can search accommodations by city',
      status: 'pass', // pass | fail | partial
      evidence: 'Tested manually with 5 cities, all returned correct results',
      issues: [],
    },
    {
      criterion: 'Search results display within 2 seconds',
      status: 'fail',
      evidence: 'Average response time: 3.5 seconds',
      issues: [
        'Need to optimize database query',
        'Consider adding pagination',
      ],
    },
    {
      criterion: 'Each card shows required information',
      status: 'partial',
      evidence: 'Shows title, city, price. Image sometimes missing.',
      issues: ['Missing fallback image for accommodations without photos'],
    },
  ],
};
```text

**Manual Testing Steps:**

```markdown

## Feature: Accommodation Search

### Test Case 1: Basic Search

**Steps:**

1. Navigate to homepage
2. Enter "Concepción" in search box
3. Click "Buscar" button

**Expected:**

- Results display within 2 seconds
- At least 1 accommodation shown
- Each card has: title, city, price, image

**Actual:**
[Document what actually happened]

**Status:**  PASS / L FAIL /   PARTIAL

### Test Case 2: No Results

**Steps:**

1. Search for non-existent city "ZZZZZ"

**Expected:**

- Empty state message displayed
- Suggests clearing filters or trying different search

**Actual:**
[Document results]

**Status:**  / L /  

### Test Case 3: API Error

**Steps:**

1. Disconnect from network
2. Attempt search

**Expected:**

- Error message displayed
- Retry button available
- Error logged to monitoring

**Actual:**
[Document results]

**Status:**  / L /  
```text

### Step 3: UI/UX Validation

**Visual Compliance Checklist:**

```markdown

## UI/UX Validation: Accommodation Card

### Visual Design

- [ ] Matches mockup layout
- [ ] Uses brand colors (primary-500 for CTAs)
- [ ] Typography follows design system
- [ ] Spacing consistent (p-6 for card padding)
- [ ] Shadows appropriate (hover:shadow-lg)
- [ ] Rounded corners (rounded-lg)

### Interactive States

- [ ] Hover state visible
- [ ] Active/pressed state defined
- [ ] Focus state visible (ring-2 ring-primary-500)
- [ ] Disabled state styled
- [ ] Loading state implemented

### Content

- [ ] All required fields displayed
- [ ] Text truncation with ellipsis
- [ ] Images have alt text
- [ ] Prices formatted correctly
- [ ] Icons semantically appropriate

### Responsive

- [ ] Works on mobile (320px+)
- [ ] Works on tablet (768px+)
- [ ] Works on desktop (1024px+)
- [ ] Touch targets e 44x44px
- [ ] Text readable on all sizes

```text

**Brand Compliance:**

```typescript
// Check against brand guidelines
const brandValidation = {
  colors: {
    primary: 'Uses primary-500 ',
    text: 'Uses gray-900 for headings ',
    background: 'Uses white/gray-50 ',
  },
  typography: {
    headings: 'Uses text-xl font-semibold ',
    body: 'Uses text-base ',
    fontFamily: 'Uses Inter ',
  },
  spacing: {
    padding: 'Card uses p-6 ',
    gap: 'Elements use space-y-4 ',
  },
  toneOfVoice: {
    style: 'Uses familiar "te/tu" ',
    warmth: 'Friendly and welcoming ',
  },
};
```text

### Step 4: Accessibility Validation

**WCAG AA Checklist:**

```markdown

## Accessibility Validation

### Perceivable

- [ ] All images have alt text
- [ ] Color contrast e 4.5:1 (normal text)
- [ ] Color contrast e 3:1 (large text e18px)
- [ ] Color not sole indicator of information
- [ ] Text resizable to 200% without loss

### Operable

- [ ] All functionality keyboard accessible
- [ ] Logical tab order
- [ ] Visible focus indicators
- [ ] No keyboard traps
- [ ] Skip to main content link present

### Understandable

- [ ] Lang attribute on HTML element
- [ ] Form labels associated with inputs
- [ ] Error messages clear and helpful
- [ ] Consistent navigation
- [ ] Predictable behavior

### Robust

- [ ] Valid HTML (no errors)
- [ ] ARIA used correctly
- [ ] Works with screen readers
- [ ] No JavaScript errors in console

```text

**Automated Accessibility Testing:**

```bash

# Run axe-core

pnpm test:a11y

# Check specific page

npx pa11y http://localhost:4321/accommodations
```text

**Manual Screen Reader Testing:**

```markdown

## Screen Reader Test (NVDA/VoiceOver)

### Accommodation Card

**Expected Announcements:**

1. "Link, Beach House with Ocean View"
2. "Concepción del Uruguay"
3. "$150 per night"
4. "6 guests, 3 bedrooms"
5. "View details button"

**Actual:**
[Document what screen reader announced]

**Issues:**
[List any problems]
```text

### Step 5: Performance Validation

**Performance Benchmarks:**

```markdown

## Performance Validation

### Core Web Vitals

- [ ] FCP (First Contentful Paint) < 1.8s
- [ ] LCP (Largest Contentful Paint) < 2.5s
- [ ] CLS (Cumulative Layout Shift) < 0.1
- [ ] FID (First Input Delay) < 100ms
- [ ] TTI (Time to Interactive) < 3.5s

### Bundle Size

- [ ] Main bundle < 300KB
- [ ] Route chunks < 100KB each
- [ ] Images optimized (WebP format)
- [ ] Lazy loading implemented

### Runtime Performance

- [ ] API responses < 2s (p95)
- [ ] Database queries < 100ms
- [ ] No memory leaks
- [ ] No unnecessary re-renders

```text

**Performance Testing:**

```bash

# Lighthouse audit

pnpm lighthouse http://localhost:4321/accommodations

# Bundle size check

pnpm analyze-bundle

# Load testing

pnpm test:load
```text

**Results Template:**

```markdown

## Performance Test Results

### Lighthouse Scores

- Performance: 95/100 
- Accessibility: 100/100 
- Best Practices: 100/100 
- SEO: 92/100   (missing meta descriptions)

### Bundle Sizes

- Main bundle: 285KB  (under 300KB limit)
- Route chunks: 45-80KB 

### API Performance

- List accommodations: 450ms 
- Get accommodation: 180ms 
- Search: 1.2s 

```text

### Step 6: Security Validation

**Security Checklist:**

```markdown

## Security Validation

### Authentication & Authorization

- [ ] Protected endpoints require authentication
- [ ] User can only access own resources
- [ ] Admin functions properly protected
- [ ] JWT tokens validated
- [ ] Session management secure

### Input Validation

- [ ] All user inputs validated with Zod
- [ ] SQL injection prevented (using ORM)
- [ ] XSS prevention (sanitized output)
- [ ] CSRF protection enabled
- [ ] File upload validation (if applicable)

### Data Protection

- [ ] Sensitive data encrypted
- [ ] No secrets in code
- [ ] Environment variables used
- [ ] HTTPS enforced in production
- [ ] Security headers configured

### Error Handling

- [ ] No sensitive data in error messages
- [ ] Errors logged securely
- [ ] Generic error messages to users
- [ ] Stack traces hidden in production

```text

**Security Testing:**

```bash

# Dependency audit

pnpm audit

# Check for vulnerabilities

pnpm audit --audit-level=moderate

# Manual security review

# - Check auth implementation

# - Review authorization logic

# - Test input validation

# - Verify error handling

```text

### Step 7: Test Coverage Validation

**Coverage Requirements:**

```markdown

## Test Coverage Validation

### Overall Coverage

- [ ] Lines: > 90%
- [ ] Functions: > 90%
- [ ] Branches: > 90%
- [ ] Statements: > 90%

### Test Types

- [ ] Unit tests for business logic
- [ ] Integration tests for services
- [ ] Component tests for UI
- [ ] E2E tests for critical paths
- [ ] Accessibility tests automated

```text

**Check Coverage:**

```bash

# Run tests with coverage

pnpm test:coverage

# View report

open coverage/index.html

# Check thresholds

pnpm test:coverage --reporter=json-summary
```text

**Coverage Report Template:**

```markdown

## Test Coverage Report

### Overall

- Lines: 92.5% 
- Functions: 94.1% 
- Branches: 89.3%   (below 90%)
- Statements: 93.0% 

### Areas Needing Improvement

- `src/utils/date-helper.ts`: 75% coverage
  - Missing tests for edge cases
  - Need tests for invalid dates

```text

### Step 8: Error Handling Validation

**Error Scenarios Checklist:**

```markdown

## Error Handling Validation

### Network Errors

- [ ] API timeout handled gracefully
- [ ] Network offline detected
- [ ] Retry mechanism available
- [ ] User notified clearly

### Validation Errors

- [ ] Form validation errors displayed inline
- [ ] Error messages helpful and specific
- [ ] Field-level errors highlighted
- [ ] Summary of errors at top of form

### Server Errors

- [ ] 500 errors handled gracefully
- [ ] Generic message shown to user
- [ ] Error logged to monitoring
- [ ] Retry or contact support option

### Not Found Errors

- [ ] 404 page exists
- [ ] Helpful navigation provided
- [ ] Search or home link available

```text

**Test Error Scenarios:**

```typescript
// Test network error
describe('Accommodation Search - Error Handling', () => {
  it('should handle network timeout', async () => {
    // Arrange: Mock timeout
    global.fetch = vi.fn().mockImplementation(() =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 100)
      )
    );

    // Act: Render and wait
    render(<AccommodationSearch />);
    await screen.findByText(/error/i);

    // Assert: Error message displayed
    expect(screen.getByText(/No pudimos cargar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});
```text

---

## Validation Report Template

```markdown

# QA Validation Report: [Feature Name]

**Date:** 2024-01-20
**Validator:** QA Engineer
**Feature:** Accommodation Search
**PDR:** PDR-012.md

---

## Executive Summary

**Overall Status:**  PASS / L FAIL /   PASS WITH ISSUES

**Summary:**
[Brief summary of validation results]

**Recommendation:**

- [ ] Ready for production
- [ ] Minor fixes needed
- [ ] Major fixes required
- [ ] Needs redesign

---

## Functional Validation

### Acceptance Criteria

| Criterion | Status | Evidence | Issues |
|-----------|--------|----------|--------|
| Search by city |  PASS | Tested with 5 cities | None |
| Response time < 2s | L FAIL | Average 3.5s | Optimize query |
| Display cards correctly |   PARTIAL | Works except images | Need fallback |
| Empty state |  PASS | Shows helpful message | None |
| Error handling |  PASS | Tested offline | None |

**Issues Found:**

1. **Critical**: Search response time exceeds requirement
   - Impact: User experience degraded
   - Recommendation: Add database indexes, implement caching

2. **Major**: Missing image fallback
   - Impact: Broken images shown
   - Recommendation: Add placeholder image

---

## UI/UX Validation

### Visual Compliance

-  Matches mockup
-  Uses brand colors
-  Typography correct
-  Responsive design
-   Hover states need polish

### Interactive States

-  Hover implemented
-  Focus visible
-  Loading states
- L Disabled state missing

**Issues Found:**

1. **Minor**: Disabled button not styled
   - Impact: Visual feedback missing
   - Recommendation: Add opacity-50 cursor-not-allowed

---

## Accessibility Validation

### WCAG AA Compliance

-  Color contrast sufficient
-  Keyboard navigation works
-  Screen reader compatible
-  Focus indicators visible
-  Form labels associated

### Automated Tests

- axe-core: 0 violations 
- Pa11y: 0 errors 

**Issues Found:**
None - Fully accessible 

---

## Performance Validation

### Metrics

- FCP: 1.2s 
- LCP: 2.1s 
- CLS: 0.05 
- TTI: 2.8s 

### Bundle Sizes

- Main: 285KB 
- Route: 65KB 

**Issues Found:**
None - Meets all targets 

---

## Security Validation

### Checks

-  Authentication required
-  Input validation present
-  No XSS vulnerabilities
-  CSRF protection
-  Dependencies secure

**Issues Found:**
None - Security requirements met 

---

## Test Coverage

### Coverage Report

- Lines: 92.5% 
- Functions: 94.1% 
- Branches: 89.3%  
- Statements: 93.0% 

**Issues Found:**

1. **Minor**: Branch coverage below 90%
   - Recommendation: Add tests for error branches

---

## Recommendations

### Must Fix (Before Release)

1. Optimize search performance to meet 2s requirement
2. Add image fallback for accommodations

### Should Fix (Nice to Have)

1. Polish hover animations
2. Add disabled button styling
3. Improve branch test coverage to 90%

### Future Improvements

1. Consider implementing virtual scrolling for large result sets
2. Add skeleton loaders for better perceived performance

---

## Sign-off

**QA Engineer:** ______________ **Date:** __________

**Tech Lead:** ______________ **Date:** __________

**Product Owner:** ______________ **Date:** __________
```text

---

## Quick Validation Checklists

### Minimum Viable Validation

```markdown

## Quick QA Checklist

### Functional

- [ ] Feature works as described in PDR
- [ ] No console errors
- [ ] Error states handled

### Visual

- [ ] Matches design
- [ ] Brand compliant
- [ ] Responsive

### Accessibility

- [ ] Keyboard accessible
- [ ] Screen reader friendly
- [ ] Color contrast OK

### Performance

- [ ] Loads quickly
- [ ] No lag on interaction

### Tests

- [ ] Tests exist and pass
- [ ] Coverage > 90%

```text

### Pre-Release Checklist

```markdown

## Pre-Release Validation

- [ ] All acceptance criteria met
- [ ] UI matches mockups exactly
- [ ] WCAG AA compliant (automated + manual)
- [ ] Performance benchmarks met
- [ ] Security review passed
- [ ] Test coverage > 90%
- [ ] No critical/high bugs
- [ ] Documentation updated
- [ ] Stakeholder approval obtained
- [ ] Ready for production

```text

---

## Deliverables

When this skill is applied, produce:

1. **Validation Report** with pass/fail status for all criteria
2. **Issue List** with severity, impact, and recommendations
3. **Evidence** (screenshots, test results, metrics)
4. **Test Coverage Report** showing percentage by area
5. **Recommendation** on readiness for release
6. **Sign-off Documentation** for stakeholders

---

**This skill ensures that features meet all quality standards, acceptance criteria, and non-functional requirements before being released to production, reducing bugs and improving user satisfaction.**

