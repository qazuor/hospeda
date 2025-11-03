---
name: accessibility-audit
category: audit
description: Comprehensive accessibility audit validating WCAG 2.1 Level AA compliance, ARIA implementation, keyboard navigation, and assistive technology support
usage: Use for accessibility compliance validation before deployment, after UI changes, or as part of regular accessibility assessments
input: Application URLs, user flows, component library, design system, accessibility requirements
output: Accessibility audit report with WCAG compliance status, violations by severity, remediation steps, and testing results
---

# Accessibility Audit

## Overview

**Purpose**: Comprehensive accessibility audit ensuring WCAG 2.1 Level AA compliance and inclusive user experience

**Category**: Audit
**Primary Users**: tech-lead
**Coordinates**: Accessibility validation and compliance verification

## When to Use This Skill

- Before production deployment
- After major UI/UX changes
- When adding new components or pages
- As part of regular accessibility reviews (quarterly)
- Before launching marketing campaigns
- When compliance requirements mandate accessibility audits
- After receiving accessibility-related user feedback

## Prerequisites

**Required:**

- Running application (dev/staging/production)
- Access to all user interfaces (web, admin)
- Component library and design system
- User flow documentation
- Browser with accessibility tools

**Optional:**

- Screen reader software (NVDA, JAWS, VoiceOver)
- Accessibility testing tools (axe, Lighthouse, WAVE)
- Real users with disabilities for testing
- Accessibility requirements documentation
- Previous audit reports for comparison

## Input

**What the skill needs:**

- Application URLs and user flows
- Component library documentation
- Design system specifications
- Target WCAG level (default: AA)
- Supported assistive technologies
- Browser/device support matrix
- Historical accessibility data

## Audit Areas (8 Comprehensive Checks)

### 1. WCAG 2.1 Compliance

**Checks:**

- **Perceivable**: Text alternatives, captions, adaptable content, distinguishable content
- **Operable**: Keyboard accessible, enough time, seizures prevention, navigable
- **Understandable**: Readable, predictable, input assistance
- **Robust**: Compatible with assistive technologies

**Levels:**

- Level A (minimum)
- Level AA (target)
- Level AAA (aspirational)

**Output:** WCAG compliance score, violations by principle, priority fixes

### 2. Semantic HTML & ARIA

**Checks:**

- Proper HTML5 semantic elements (`<nav>`, `<main>`, `<article>`, etc.)
- ARIA roles usage (only when semantic HTML insufficient)
- ARIA properties (aria-label, aria-labelledby, aria-describedby)
- ARIA states (aria-expanded, aria-selected, aria-hidden)
- Landmark regions
- Heading hierarchy (h1-h6)
- Lists markup (ul, ol, dl)
- Table markup (th, caption, scope)

**Metrics:**

- Semantic HTML usage %
- ARIA attribute correctness
- Landmark coverage
- Heading structure validity

**Output:** Semantic HTML score, ARIA implementation gaps, structure violations

### 3. Keyboard Navigation

**Checks:**

- All interactive elements accessible via keyboard
- Logical tab order (matches visual order)
- Focus indicators visible and clear
- Skip navigation links
- Keyboard shortcuts documented
- No keyboard traps
- Modal focus management
- Dropdown/menu keyboard support

**Test Scenarios:**

- Navigate entire app using only keyboard
- Tab through all interactive elements
- Open/close modals and menus
- Submit forms
- Navigate data tables

**Metrics:**

- % of interactive elements keyboard accessible
- Tab order correctness
- Focus indicator visibility

**Output:** Keyboard navigation score, inaccessible elements, focus issues

### 4. Screen Reader Compatibility

**Checks:**

- Proper reading order
- Form labels and instructions
- Error messages announced
- Dynamic content updates (aria-live)
- Image alt text quality
- Link text descriptiveness
- Button text clarity
- Table headers association

**Screen Readers Tested:**

- NVDA (Windows, free)
- JAWS (Windows, commercial)
- VoiceOver (macOS/iOS, built-in)
- TalkBack (Android, built-in)

**Metrics:**

- % of content accessible to screen readers
- Alt text coverage
- Form label association
- Dynamic content announcement

**Output:** Screen reader compatibility score, announcement issues, content gaps

### 5. Visual Accessibility

**Checks:**

- **Color Contrast**: WCAG AA (4.5:1 text, 3:1 UI components)
- **Text Size**: Minimum 16px, scalable to 200%
- **Color Alone**: Never sole indicator of information
- **Focus Indicators**: Visible, high contrast (3:1 minimum)
- **Text Spacing**: Line height, letter spacing, word spacing
- **Reflow**: Content adapts to 320px width at 400% zoom
- **Images of Text**: Avoided except logos
- **Motion**: Reduced motion support (prefers-reduced-motion)

**Metrics:**

- Color contrast ratio (AA: 4.5:1, AAA: 7:1)
- Text size in pixels
- Focus indicator contrast ratio
- Reflow breakpoints

**Output:** Visual accessibility score, contrast violations, text sizing issues

### 6. Forms & Input Accessibility

**Checks:**

- All inputs have labels (associated via for/id or aria-labelledby)
- Required fields indicated
- Error messages clear and associated (aria-describedby)
- Autocomplete attributes for personal data
- Fieldset/legend for grouped inputs
- Input type appropriate (email, tel, number, etc.)
- Help text accessible
- Success messages announced

**Validation:**

- Native HTML5 validation
- Clear error messages
- Error prevention strategies
- Error recovery assistance

**Metrics:**

- % of inputs with labels
- % with autocomplete
- Error message clarity score
- Form completion success rate

**Output:** Form accessibility score, unlabeled inputs, validation issues

### 7. Responsive & Mobile Accessibility

**Checks:**

- Touch targets ≥ 44x44px (WCAG 2.1)
- Spacing between targets ≥ 8px
- Pinch-to-zoom enabled
- Orientation support (portrait/landscape)
- Screen reader mobile compatibility
- Swipe gestures documented
- Mobile keyboard navigation
- Viewport meta tag correct

**Mobile Screen Readers:**

- VoiceOver (iOS)
- TalkBack (Android)

**Metrics:**

- Touch target size (pixels)
- Target spacing (pixels)
- Zoom capability
- Orientation support

**Output:** Mobile accessibility score, touch target violations, orientation issues

### 8. Content Accessibility

**Checks:**

- Reading level appropriate (Flesch-Kincaid)
- Language attribute set (`<html lang="es">`)
- Abbreviations expanded (first use)
- Idioms/jargon explained
- Instructions don't rely on sensory characteristics
- Timing adjustable for time-limited content
- Animations pauseable
- Auto-playing media controllable

**Readability Metrics:**

- Flesch Reading Ease (target: 60-70)
- Flesch-Kincaid Grade Level (target: 8-9)
- Average sentence length
- Complex word percentage

**Output:** Content accessibility score, readability metrics, clarity issues

## Workflow

### Phase 1: Preparation (10 minutes)

1. **Setup Environment:**
   - Install browser extensions (axe DevTools, WAVE)
   - Configure screen reader
   - Prepare test scenarios
   - Document baseline

2. **Identify Critical Paths:**
   - Homepage → Accommodation search
   - Search → Booking flow
   - User registration → Login
   - Admin dashboard navigation

### Phase 2: Automated Testing (20 minutes)

1. **Lighthouse Accessibility Audit:**

   ```bash
   lighthouse https://your-app.com --only-categories=accessibility --view
   ```

2. **axe DevTools:**
   - Run axe on all critical pages
   - Export results
   - Categorize violations by severity

3. **WAVE Evaluation:**
   - Visual feedback on accessibility issues
   - Contrast checker
   - Structure outline

4. **Pa11y CI (Command Line):**

   ```bash
   pa11y-ci --sitemap https://your-app.com/sitemap.xml
   ```

### Phase 3: Manual Testing (40 minutes)

1. **Keyboard Navigation Testing:**
   - Disconnect mouse
   - Navigate entire app with Tab, Shift+Tab, Enter, Space, Arrow keys
   - Test all interactive elements
   - Verify focus indicators
   - Check for keyboard traps

2. **Screen Reader Testing:**
   - **NVDA (Windows):**
     - Test homepage, forms, navigation
     - Verify reading order
     - Check dynamic content announcements

   - **VoiceOver (macOS/iOS):**
     - Test mobile app
     - Verify touch gestures
     - Check rotor navigation

3. **Visual Testing:**
   - Contrast checker (Chrome DevTools)
   - Text resize to 200% (verify no content loss)
   - Zoom to 400% (verify reflow)
   - Reduced motion (prefers-reduced-motion)

4. **Form Testing:**
   - Submit forms with errors
   - Verify error announcements
   - Check autocomplete
   - Test required field indicators

### Phase 4: Manual Review (20 minutes)

1. **Code Review:**
   - HTML semantics
   - ARIA attributes correctness
   - Heading hierarchy
   - Alt text quality

2. **Content Review:**
   - Language attribute
   - Reading level
   - Link text clarity
   - Button labels

### Phase 5: Reporting (15 minutes)

1. **Categorize Findings:**
   - **Critical:** Blocks access (missing alt, keyboard traps, no labels)
   - **High:** Severely impacts UX (low contrast, poor focus, confusing navigation)
   - **Medium:** Moderate impact (missing ARIA, suboptimal alt text)
   - **Low:** Best practices (semantic HTML, heading order)

2. **Generate Report:**
   - Executive summary with WCAG compliance level
   - Violations by severity
   - WCAG success criteria failed
   - Remediation steps with priority
   - Testing methodology

## Output

**Accessibility Audit Report** (saved as `accessibility-audit-report.md`):

```markdown
# Accessibility Audit Report

**Date:** YYYY-MM-DD
**Auditor:** tech-lead
**Application:** [App Name]
**Environment:** [dev/staging/production]
**WCAG Target:** Level AA

## Executive Summary

- **WCAG Compliance:** [Pass/Fail] Level AA
- **Overall Accessibility Score:** X/100
- **Critical Issues:** X (blocking access)
- **High Issues:** X (severe impact)
- **Medium Issues:** X (moderate impact)
- **Low Issues:** X (best practices)

## WCAG 2.1 Compliance Status

### Principle 1: Perceivable

| Success Criterion | Level | Status | Issues |
|-------------------|-------|--------|--------|
| 1.1.1 Non-text Content | A | ✅/❌ | X |
| 1.2.1 Audio-only/Video-only | A | ✅/❌ | X |
| 1.3.1 Info and Relationships | A | ✅/❌ | X |
| 1.4.3 Contrast (Minimum) | AA | ✅/❌ | X |
| 1.4.11 Non-text Contrast | AA | ✅/❌ | X |

### Principle 2: Operable

| Success Criterion | Level | Status | Issues |
|-------------------|-------|--------|--------|
| 2.1.1 Keyboard | A | ✅/❌ | X |
| 2.1.2 No Keyboard Trap | A | ✅/❌ | X |
| 2.4.3 Focus Order | A | ✅/❌ | X |
| 2.4.7 Focus Visible | AA | ✅/❌ | X |
| 2.5.5 Target Size | AAA | ✅/❌ | X |

### Principle 3: Understandable

| Success Criterion | Level | Status | Issues |
|-------------------|-------|--------|--------|
| 3.1.1 Language of Page | A | ✅/❌ | X |
| 3.2.1 On Focus | A | ✅/❌ | X |
| 3.3.1 Error Identification | A | ✅/❌ | X |
| 3.3.2 Labels or Instructions | A | ✅/❌ | X |

### Principle 4: Robust

| Success Criterion | Level | Status | Issues |
|-------------------|-------|--------|--------|
| 4.1.2 Name, Role, Value | A | ✅/❌ | X |
| 4.1.3 Status Messages | AA | ✅/❌ | X |

## Audit Scores by Area

| Area | Score | Critical | High | Medium | Low |
|------|-------|----------|------|--------|-----|
| Semantic HTML & ARIA | X/100 | X | X | X | X |
| Keyboard Navigation | X/100 | X | X | X | X |
| Screen Reader | X/100 | X | X | X | X |
| Visual Accessibility | X/100 | X | X | X | X |
| Forms & Inputs | X/100 | X | X | X | X |
| Mobile Accessibility | X/100 | X | X | X | X |
| Content Accessibility | X/100 | X | X | X | X |

## Findings by Severity

### Critical (Immediate Action Required)

1. **[Issue Title]**
   - **WCAG:** 1.1.1 Non-text Content (Level A)
   - **Severity:** Critical
   - **Location:** [Page/Component]
   - **Description:** [Details]
   - **User Impact:** Blocks access for screen reader users
   - **Remediation:** [Fix steps]
   - **Effort:** [Low/Medium/High]

### High (Fix Before Deployment)

[...]

### Medium (Fix Soon)

[...]

### Low (Best Practices)

[...]

## Testing Results

### Automated Testing

**Lighthouse:**
- Accessibility Score: X/100
- Issues Found: X

**axe DevTools:**
- Critical: X
- Serious: X
- Moderate: X
- Minor: X

**WAVE:**
- Errors: X
- Contrast Errors: X
- Alerts: X

### Manual Testing

**Keyboard Navigation:**
- ✅/❌ All interactive elements accessible
- ✅/❌ Logical tab order
- ✅/❌ Visible focus indicators
- ✅/❌ No keyboard traps

**Screen Reader (NVDA):**
- ✅/❌ Content announced correctly
- ✅/❌ Form labels associated
- ✅/❌ Dynamic updates announced
- ✅/❌ Logical reading order

**Visual:**
- ✅/❌ Color contrast meets AA (4.5:1)
- ✅/❌ Text scalable to 200%
- ✅/❌ Content reflows at 400% zoom
- ✅/❌ Reduced motion supported

## Remediation Recommendations

### Priority 1: Critical Fixes (Immediate)

1. **Add Missing Alt Text**
   - **Pages:** Homepage, Search results
   - **Images:** X images missing alt
   - **Fix:** Add descriptive alt text for all images
   - **Effort:** 2 hours
   - **Impact:** Unblocks screen reader users

2. **Fix Keyboard Traps**
   - **Components:** Modal dialog, dropdown menu
   - **Issue:** Focus locked, cannot escape
   - **Fix:** Implement Esc key handler, focus management
   - **Effort:** 4 hours
   - **Impact:** Enables keyboard-only navigation

### Priority 2: High Fixes (This Sprint)

[...]

### Priority 3: Medium Fixes (Next Sprint)

[...]

### Priority 4: Low Improvements (Backlog)

[...]

## Component-Specific Issues

### Navigation

- Missing skip link
- No landmark regions
- Submenu not keyboard accessible

### Forms

- X inputs missing labels
- Error messages not associated
- No autocomplete attributes

### Modals

- Focus not trapped
- Esc key doesn't close
- Background not hidden from screen readers

### Data Tables

- Missing `<th>` headers
- No `scope` attributes
- No `<caption>`

## Browser/Assistive Technology Testing

| Browser | Screen Reader | Status | Issues |
|---------|--------------|--------|--------|
| Chrome | NVDA | ✅/❌ | X |
| Firefox | NVDA | ✅/❌ | X |
| Safari | VoiceOver | ✅/❌ | X |
| iOS Safari | VoiceOver | ✅/❌ | X |
| Chrome Android | TalkBack | ✅/❌ | X |

## Trend Analysis

*Compare with previous audit (if available)*

| Metric | Previous | Current | Change |
|--------|----------|---------|--------|
| Compliance Level | AA | AA | ➡️ |
| Critical Issues | X | X | ⬇️ X% |
| Accessibility Score | X/100 | X/100 | ⬆️ X% |
| WCAG Success Criteria | X/50 | X/50 | ⬆️ X |

## Next Steps

1. **Immediate Actions** (Critical)
   - [Action 1 with owner and deadline]
   - [Action 2]

2. **Short-term Fixes** (High, this sprint)
   - [Action 1]
   - [Action 2]

3. **Medium-term Improvements** (Medium, next sprint)
   - [Action 1]
   - [Action 2]

4. **Long-term Enhancements** (Low, backlog)
   - [Action 1]
   - [Action 2]

5. **Continuous Monitoring**
   - Add accessibility tests to CI/CD
   - Schedule quarterly audits
   - Track WCAG compliance in releases
   - Monitor user feedback from assistive technology users
```

## Success Criteria

- WCAG 2.1 Level AA compliance validated
- All critical accessibility issues identified
- Screen reader compatibility verified
- Keyboard navigation fully functional
- Visual accessibility standards met
- Remediation steps prioritized and documented
- Report delivered with actionable fixes

## WCAG 2.1 Quick Reference

**Level A (Minimum):**

- Alt text for images
- Keyboard accessible
- Clear labels
- No seizure triggers

**Level AA (Target):**

- Color contrast 4.5:1 (text)
- Color contrast 3:1 (UI components)
- Resize text 200%
- Multiple ways to navigate
- Consistent navigation
- Error suggestions

**Level AAA (Aspirational):**

- Color contrast 7:1 (text)
- No timing
- No interruptions
- Enhanced error suggestions

## Best Practices

1. **Test early and often** - Don't wait for final audit
2. **Use semantic HTML first** - ARIA is supplemental
3. **Test with real users** - People with disabilities provide invaluable feedback
4. **Automate where possible** - CI/CD accessibility checks
5. **Train the team** - Accessibility is everyone's responsibility
6. **Document patterns** - Create accessible component library
7. **Track compliance** - Regular audits, not one-time checks

## Tools Integration

**Browser Extensions:**

- axe DevTools - Automated testing
- WAVE - Visual feedback
- Lighthouse - Audit scores
- Color Contrast Analyzer - Contrast checking

**Screen Readers:**

- NVDA (Windows, free)
- JAWS (Windows, commercial)
- VoiceOver (macOS/iOS, built-in)
- TalkBack (Android, built-in)

**Command Line:**

- Pa11y CI - Automated testing
- axe-core - Headless testing
- Lighthouse CI - Continuous integration

**CI/CD Integration:**

- Add accessibility tests to pipeline
- Fail builds on critical violations
- Track compliance trends over time

## Related Skills

- [web-app-testing](../testing/web-app-testing.md) - For development testing
- [qa-criteria-validator](../qa/qa-criteria-validator.md) - For acceptance validation
- [ui-ux-designer](../../agents/design/ui-ux-designer.md) - For accessible design

## Related Commands

- `/accessibility-audit` - Invoke this skill for comprehensive accessibility review
- `/quality-check` - Includes basic accessibility checks
