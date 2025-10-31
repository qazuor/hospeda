---
name: accessibility-audit
type: audit
category: quality
description: Comprehensive accessibility audit validating WCAG 2.1 Level AA compliance, ARIA implementation, keyboard navigation, and assistive technology support
---

# Accessibility Audit Command

## Purpose

Performs a comprehensive accessibility audit of the application, validating WCAG 2.1 Level AA compliance, ARIA implementation, keyboard navigation, screen reader compatibility, and ensuring the application is usable by everyone. This command provides automated and manual accessibility testing with actionable remediation guidance.

## When to Use

- **Before Production Deployment**: Ensure accessibility compliance before launch
- **After UI Changes**: Validate accessibility after design or component updates
- **Regular Audits**: Quarterly accessibility reviews (required for compliance)
- **Bug Reports**: When users report accessibility issues
- **Legal Compliance**: Before public releases (ADA, Section 508, WCAG requirements)

## Usage

```bash
/accessibility-audit [options]
```

### Options

- `--scope <area>`: Focus audit on specific area (navigation, forms, content, all)
- `--level <wcag>`: WCAG level (A, AA, AAA) - default: AA
- `--report`: Generate detailed accessibility-audit-report.md
- `--automated-only`: Run only automated tests (faster)

### Examples

```bash
/accessibility-audit                          # Standard full audit (WCAG 2.1 AA)
/accessibility-audit --scope forms --level AAA --report
/accessibility-audit --automated-only
```

## Audit Process

### 1. Perceivable - Information and UI components must be presentable

#### Text Alternatives (WCAG 1.1)

**Checks:**
- [ ] All images have meaningful alt text
- [ ] Decorative images have empty alt (`alt=""`)
- [ ] Complex images (charts, diagrams) have detailed descriptions
- [ ] Icons have accessible names
- [ ] Form inputs have associated labels
- [ ] Button text is descriptive
- [ ] Links have descriptive text (not "click here")
- [ ] ARIA labels for icon-only buttons

**Tools:**
- Automated alt text validation
- Missing label detection
- Link text analysis

**Benchmarks:**
- 100% of images have alt attributes
- 100% of form controls have labels
- 0 "click here" or "read more" links without context

#### Time-Based Media (WCAG 1.2)

**Checks:**
- [ ] Videos have captions
- [ ] Audio content has transcripts
- [ ] Video descriptions for visual content
- [ ] Media controls are keyboard accessible
- [ ] Auto-playing media can be paused

**Tools:**
- Media element detection
- Caption/transcript verification
- Control accessibility testing

**Benchmarks:**
- 100% of videos have captions
- 100% of audio has transcripts
- No auto-play without controls

#### Adaptable (WCAG 1.3)

**Checks:**
- [ ] Semantic HTML structure
- [ ] Heading hierarchy (h1-h6) logical
- [ ] Lists use proper markup (ul, ol, dl)
- [ ] Tables have proper structure (thead, tbody, th)
- [ ] Form fields have proper grouping (fieldset/legend)
- [ ] Landmarks defined (header, nav, main, aside, footer)
- [ ] Reading order makes sense when CSS disabled
- [ ] ARIA roles used appropriately
- [ ] ARIA properties valid and necessary

**Tools:**
- HTML validator
- Heading structure analyzer
- ARIA validator
- Landmark detection

**Benchmarks:**
- Logical heading hierarchy (no skipped levels)
- All major sections have landmarks
- 100% valid ARIA usage

#### Distinguishable (WCAG 1.4)

**Checks:**
- [ ] Color contrast ratio ≥ 4.5:1 for normal text
- [ ] Color contrast ratio ≥ 3:1 for large text (18pt+)
- [ ] Color contrast ratio ≥ 3:1 for UI components
- [ ] Information not conveyed by color alone
- [ ] Text resizable up to 200% without loss of content
- [ ] No horizontal scrolling at 320px width
- [ ] Background audio can be paused or volume adjusted
- [ ] Focus indicators visible and sufficient contrast

**Tools:**
- Color contrast analyzer
- Resize testing
- Focus indicator verification
- Color-only information detection

**Benchmarks:**
- 100% text meets contrast requirements
- No content loss at 200% zoom
- All focus indicators visible (3:1 contrast minimum)

### 2. Operable - UI components and navigation must be operable

#### Keyboard Accessible (WCAG 2.1)

**Checks:**
- [ ] All interactive elements keyboard accessible
- [ ] Tab order logical and intuitive
- [ ] No keyboard traps (can tab out)
- [ ] Skip navigation link present
- [ ] Custom controls have keyboard support
- [ ] Dropdowns operable with keyboard
- [ ] Modals can be closed with Escape
- [ ] Focus visible at all times
- [ ] Keyboard shortcuts documented

**Tools:**
- Tab order analyzer
- Keyboard trap detection
- Focus management testing

**Benchmarks:**
- 100% interactive elements keyboard accessible
- Logical tab order throughout
- No keyboard traps detected

#### Enough Time (WCAG 2.2)

**Checks:**
- [ ] No time limits or limits can be extended
- [ ] Auto-updating content can be paused
- [ ] Session timeout warnings provided
- [ ] Timeout can be extended or disabled
- [ ] No automatic redirects without warning

**Tools:**
- Timeout detection
- Auto-update monitoring

**Benchmarks:**
- All timeouts have warnings
- Users can extend time limits

#### Seizures and Physical Reactions (WCAG 2.3)

**Checks:**
- [ ] No content flashes more than 3 times per second
- [ ] No animation that could cause seizures
- [ ] Animation can be disabled (prefers-reduced-motion)
- [ ] Parallax effects can be disabled

**Tools:**
- Flash detection
- Animation analyzer
- Motion preference detection

**Benchmarks:**
- Zero content flashing > 3Hz
- All animations respect prefers-reduced-motion

#### Navigable (WCAG 2.4)

**Checks:**
- [ ] Skip links for repetitive content
- [ ] Page titles unique and descriptive
- [ ] Focus order follows logical sequence
- [ ] Link purpose clear from text or context
- [ ] Multiple ways to find pages (search, sitemap, nav)
- [ ] Headings describe content sections
- [ ] Current location indicated (breadcrumbs, active state)
- [ ] Focus visible when navigating

**Tools:**
- Page title analyzer
- Navigation structure validator
- Focus order testing

**Benchmarks:**
- 100% of pages have unique titles
- Clear navigation structure
- Logical focus order throughout

#### Input Modalities (WCAG 2.5)

**Checks:**
- [ ] Touch targets minimum 44x44 pixels
- [ ] Pointer gestures have keyboard alternative
- [ ] Click/tap activation on up event (can cancel)
- [ ] Device motion used carefully (or not at all)
- [ ] Label text matches accessible name

**Tools:**
- Touch target size analyzer
- Gesture detection
- Label/name matching validator

**Benchmarks:**
- 100% touch targets ≥ 44x44px
- All gestures have alternatives
- All labels match accessible names

### 3. Understandable - Information and UI operation must be understandable

#### Readable (WCAG 3.1)

**Checks:**
- [ ] Page language declared (lang attribute)
- [ ] Language changes marked (lang on elements)
- [ ] Reading level appropriate (or alternatives provided)
- [ ] Abbreviations explained on first use
- [ ] Pronunciation guidance for unusual words

**Tools:**
- Language attribute validator
- Reading level analyzer

**Benchmarks:**
- 100% of pages have lang attribute
- All language changes marked

#### Predictable (WCAG 3.2)

**Checks:**
- [ ] Focus does not trigger unexpected changes
- [ ] Input does not trigger unexpected changes
- [ ] Navigation consistent across pages
- [ ] Components identified consistently
- [ ] No unexpected context changes

**Tools:**
- Navigation consistency checker
- Component naming validator
- Context change detection

**Benchmarks:**
- Consistent navigation across site
- Consistent component labeling
- No unexpected navigation

#### Input Assistance (WCAG 3.3)

**Checks:**
- [ ] Error messages clear and specific
- [ ] Form labels and instructions provided
- [ ] Error suggestions provided when possible
- [ ] Error prevention for legal/financial transactions
- [ ] Confirmation for data deletion
- [ ] Form data can be reviewed before submission
- [ ] Help text available for complex inputs

**Tools:**
- Form validation testing
- Error message analyzer
- Help text detection

**Benchmarks:**
- 100% of errors identified and described
- All complex forms have help text
- Confirmation required for destructive actions

### 4. Robust - Content must be robust enough for assistive technologies

#### Compatible (WCAG 4.1)

**Checks:**
- [ ] Valid HTML (no parsing errors)
- [ ] Unique IDs within page
- [ ] ARIA roles, states, properties valid
- [ ] Status messages use appropriate ARIA
- [ ] Name, role, value available for all components
- [ ] Custom components have proper ARIA

**Tools:**
- HTML validator
- ARIA validator
- Component role analyzer

**Benchmarks:**
- 100% valid HTML
- 100% valid ARIA usage
- All custom components properly labeled

### 5. Screen Reader Testing

**Checks:**
- [ ] Test with NVDA (Windows)
- [ ] Test with JAWS (Windows)
- [ ] Test with VoiceOver (macOS/iOS)
- [ ] Test with TalkBack (Android)
- [ ] Landmark navigation works
- [ ] Heading navigation works
- [ ] Form field announcements correct
- [ ] Dynamic content changes announced
- [ ] Loading states announced
- [ ] Error messages announced

**Tools:**
- Screen reader testing
- ARIA live region verification
- Announcement monitoring

**Benchmarks:**
- Functional with all major screen readers
- All content accessible via screen reader
- Proper announcements for dynamic changes

### 6. Keyboard Navigation Testing

**Checks:**
- [ ] Tab through entire page
- [ ] Reverse tab (Shift+Tab) works
- [ ] Enter activates buttons/links
- [ ] Space activates buttons
- [ ] Arrow keys work in custom controls
- [ ] Escape closes modals/menus
- [ ] Focus never lost or trapped
- [ ] Focus indicator always visible

**Tools:**
- Manual keyboard testing
- Focus trap detection
- Tab order validation

**Benchmarks:**
- 100% keyboard navigable
- Logical tab order
- Visible focus at all times

### 7. Mobile Accessibility

**Checks:**
- [ ] Touch targets adequate size (44x44px minimum)
- [ ] Zoom enabled (not disabled)
- [ ] Orientation changes supported
- [ ] Gestures have alternatives
- [ ] Mobile screen reader compatible (VoiceOver, TalkBack)
- [ ] Responsive at 320px width
- [ ] Text spacing adjustable

**Tools:**
- Mobile accessibility testing
- Touch target analyzer
- Responsive design validator

**Benchmarks:**
- All touch targets ≥ 44x44px
- Zoom not disabled
- Functional in portrait and landscape

### 8. Form Accessibility

**Checks:**
- [ ] All inputs have associated labels
- [ ] Required fields indicated accessibly
- [ ] Error messages associated with fields
- [ ] Field instructions provided
- [ ] Autocomplete attributes used
- [ ] Fieldset/legend for radio/checkbox groups
- [ ] Help text linked with aria-describedby
- [ ] Submit buttons clearly labeled

**Tools:**
- Form accessibility analyzer
- Label association validator
- Error message testing

**Benchmarks:**
- 100% of inputs labeled
- All errors programmatically associated
- Clear field instructions

## Output Format

### Terminal Output

```
♿ Accessibility Audit Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Overall Score: 85/100 (Good - WCAG 2.1 AA)

🔴 Critical Issues (2)
  1. Missing alt text on product images
     Location: components/ProductCard.tsx:45
     Impact: Screen readers cannot describe images
     WCAG: 1.1.1 (Level A)
     Fix: Add descriptive alt text to all images

  2. Insufficient color contrast on call-to-action buttons
     Location: components/Button.tsx:12
     Contrast: 3.2:1 (needs 4.5:1)
     WCAG: 1.4.3 (Level AA)
     Fix: Increase contrast to 4.5:1 minimum

🟠 Serious Issues (5)
  1. Keyboard trap in modal dialog
     Location: components/BookingModal.tsx:78
     Impact: Users cannot exit modal with keyboard
     WCAG: 2.1.2 (Level A)
     Fix: Add keyboard handler for Escape key

  2. Missing form labels
     Location: pages/contact.astro:34
     Impact: Screen readers cannot identify fields
     WCAG: 3.3.2 (Level A)
     Fix: Add <label> elements or aria-label

  [...]

🟡 Warnings (8)
  1. Touch targets smaller than recommended
     Location: components/Navigation.tsx:23
     Size: 40x40px (recommended 44x44px)
     WCAG: 2.5.5 (Level AAA)
     Fix: Increase padding on mobile menu items

  [...]

📈 WCAG 2.1 Compliance

Level A (Required):
  ✓ Text Alternatives: 95% (19/20 checks)
  ✗ Keyboard Accessible: 85% (17/20 checks)
  ✓ Distinguishable: 90% (18/20 checks)
  ✓ Readable: 100% (10/10 checks)

Level AA (Target):
  ✗ Contrast: 80% (needs 100%)
  ✓ Resize Text: 100%
  ✓ Input Assistance: 95%
  ✓ Compatible: 100%

Level AAA (Enhanced):
  - Enhanced Contrast: 60%
  - No Timing: 100%
  - Section Headings: 95%

📊 Component Scores

Navigation: 92/100 ✓
  - Keyboard: 95% ✓
  - Screen Reader: 90% ✓
  - Mobile: 90% ✓

Forms: 78/100 ✗
  - Labels: 85% ✗
  - Errors: 70% ✗
  - Instructions: 80% ✓

Content: 88/100 ✓
  - Headings: 95% ✓
  - Landmarks: 85% ✓
  - Images: 85% ✗

💡 Top Recommendations
  1. Add alt text to all images (+10 accessibility score)
  2. Fix color contrast on CTAs (+5 accessibility score)
  3. Fix keyboard trap in modals (critical accessibility issue)
  4. Add form labels (+8 accessibility score)
  5. Increase touch target sizes (+3 mobile usability)

🧪 Testing Summary
  Automated Tests: 127 checks
  Manual Tests: 23 checks
  Screen Reader: NVDA, VoiceOver tested
  Keyboard: Full navigation tested
  Mobile: iOS/Android tested

📄 Detailed report: .claude/reports/accessibility-audit-report.md
```

### Report File Structure

```markdown
# Accessibility Audit Report

**Date**: 2024-01-15T10:30:00Z
**WCAG Version**: 2.1
**Conformance Level**: AA
**Scope**: Full Application
**Auditor**: Claude Code Accessibility Audit

## Executive Summary

Overall Accessibility Score: 85/100 (Good)

**Compliance Status:**
- WCAG 2.1 Level A: 95% compliant (2 critical issues)
- WCAG 2.1 Level AA: 85% compliant (target level)
- WCAG 2.1 Level AAA: 70% compliant (enhanced)

**Key Findings:**
- 2 critical accessibility barriers identified
- 5 serious issues requiring immediate attention
- 8 minor improvements recommended
- Generally good accessibility foundation

## Critical Issues

### A11Y-001: Missing Alt Text on Images

- **Severity**: Critical
- **WCAG**: 1.1.1 Non-text Content (Level A)
- **Location**: components/ProductCard.tsx:45
- **Impact**:
  - Screen reader users cannot understand image content
  - Affects ~500 product images across site
  - Violates ADA compliance requirements
- **Current State**:
  ```tsx
  <img src={product.image} />
  ```
- **Fix**:
  ```tsx
  <img
    src={product.image}
    alt={`${product.name} - ${product.category}`}
  />
  ```
- **Testing**: Test with NVDA/VoiceOver to verify descriptions
- **Priority**: Immediate (legal compliance risk)

### A11Y-002: Insufficient Color Contrast

- **Severity**: Critical
- **WCAG**: 1.4.3 Contrast (Minimum) (Level AA)
- **Location**: components/Button.tsx:12
- **Impact**:
  - Users with low vision cannot read button text
  - Contrast ratio: 3.2:1 (needs 4.5:1)
  - Affects primary call-to-action buttons
- **Current Colors**:
  - Background: #3B82F6
  - Text: #93C5FD
  - Ratio: 3.2:1
- **Fix**:
  - Change text to: #FFFFFF
  - New ratio: 4.8:1 ✓
- **Testing**: Verify with color contrast analyzer
- **Priority**: Immediate (WCAG AA requirement)

## Serious Issues

### A11Y-003: Keyboard Trap in Modal

[Similar detailed structure]

## WCAG 2.1 Compliance Report

### Level A (Required)

| Guideline | Criterion | Status | Issues |
|-----------|-----------|--------|--------|
| 1.1 Text Alternatives | 1.1.1 Non-text Content | ✗ Fail | 2 images missing alt |
| 2.1 Keyboard Accessible | 2.1.1 Keyboard | ✓ Pass | - |
| 2.1 Keyboard Accessible | 2.1.2 No Keyboard Trap | ✗ Fail | 1 modal trap |
| 3.3 Input Assistance | 3.3.1 Error Identification | ✓ Pass | - |
| 4.1 Compatible | 4.1.1 Parsing | ✓ Pass | - |
| 4.1 Compatible | 4.1.2 Name, Role, Value | ✓ Pass | - |

### Level AA (Target)

| Guideline | Criterion | Status | Issues |
|-----------|-----------|--------|--------|
| 1.4 Distinguishable | 1.4.3 Contrast (Minimum) | ✗ Fail | 3 components |
| 1.4 Distinguishable | 1.4.5 Images of Text | ✓ Pass | - |
| 2.4 Navigable | 2.4.6 Headings and Labels | ✓ Pass | - |
| 2.4 Navigable | 2.4.7 Focus Visible | ✓ Pass | - |
| 3.2 Predictable | 3.2.3 Consistent Navigation | ✓ Pass | - |

### Level AAA (Enhanced)

| Guideline | Criterion | Status | Notes |
|-----------|-----------|--------|-------|
| 1.4.6 Contrast (Enhanced) | ⚠ Partial | Some components 7:1 |
| 2.1.3 Keyboard (No Exception) | ✓ Pass | All keyboard accessible |

## Component Analysis

### Navigation Component

**Score**: 92/100 ✓

**Strengths**:
- Proper semantic HTML (nav, ul, li)
- Skip navigation link present
- ARIA current on active page
- Keyboard accessible
- Logical tab order

**Issues**:
- Mobile menu touch targets: 40x40px (needs 44x44px)
- Missing aria-label on navigation landmark

**Recommendations**:
1. Increase touch target sizes on mobile
2. Add aria-label="Primary navigation"

### Form Components

**Score**: 78/100 ✗

**Strengths**:
- Good error messaging
- Required fields marked with aria-required
- Autocomplete attributes present

**Issues**:
- 15% of fields missing labels
- Error messages not programmatically associated
- Missing field instructions for complex inputs

**Recommendations**:
1. Add labels to all form fields
2. Use aria-describedby for error messages
3. Provide help text for date/time pickers

## Screen Reader Testing Results

### NVDA (Windows) - Version 2023.3

**Status**: Generally Good ✓

**Working**:
- Navigation via headings (H key)
- Landmark navigation (D key)
- Form field reading
- Link list (Insert+F7)

**Issues**:
- Modal announcements delayed
- Some dynamic content changes not announced

**Fix**: Add aria-live regions for dynamic content

### VoiceOver (macOS) - Latest

**Status**: Generally Good ✓

**Working**:
- Rotor navigation
- Web spots
- Form navigation
- Gesture support on iOS

**Issues**:
- Custom dropdown not announced correctly

**Fix**: Add proper ARIA combobox pattern

### JAWS (Windows) - Version 2024

**Status**: Good ✓

**All features working as expected**

## Keyboard Testing Results

### Full Page Navigation

**Tab Order**: ✓ Logical and consistent
**Reverse Tab**: ✓ Works correctly
**Skip Links**: ✓ Present and functional

### Interactive Elements

- Buttons: ✓ Enter activates
- Links: ✓ Enter activates
- Checkboxes: ✓ Space toggles
- Radio buttons: ✓ Arrow keys work
- Dropdowns: ✓ Arrow keys navigate
- Modals: ✗ Escape does not close (1 instance)

### Focus Management

- Focus visible: ✓ Yes (3.5:1 contrast)
- Focus not lost: ✓ Yes
- Focus order: ✓ Logical

## Mobile Accessibility Results

### iOS (VoiceOver)

- Screen reader: ✓ Fully functional
- Gestures: ✓ Standard gestures work
- Zoom: ✓ Not disabled
- Orientation: ✓ Both supported

### Android (TalkBack)

- Screen reader: ✓ Fully functional
- Gestures: ✓ Standard gestures work
- Zoom: ✓ Not disabled
- Touch targets: ⚠ Some < 44px

## Recommendations

### Immediate Actions (This Week)

1. Fix missing alt text on images (A11Y-001)
2. Increase color contrast on buttons (A11Y-002)
3. Fix keyboard trap in modal (A11Y-003)

### Short Term (This Sprint)

1. Add missing form labels
2. Improve error message associations
3. Increase mobile touch target sizes

### Long Term (Next Quarter)

1. Implement comprehensive keyboard shortcuts
2. Add enhanced ARIA live regions
3. Conduct user testing with disabled users
4. Create accessibility testing checklist

## Testing Methodology

### Automated Testing Tools

- axe DevTools
- WAVE (Web Accessibility Evaluation Tool)
- Lighthouse Accessibility Audit
- Pa11y

### Manual Testing

- Keyboard-only navigation
- Screen reader testing (NVDA, JAWS, VoiceOver)
- Color contrast analysis
- Zoom and resize testing
- Mobile device testing

### Test Coverage

- Pages tested: 25
- Components tested: 47
- Automated checks: 127
- Manual checks: 23

## Next Steps

1. **Immediate Fixes** (Complete critical issues by end of week)
2. **Validation Testing** (Re-test with assistive technologies)
3. **User Testing** (Conduct testing with disabled users)
4. **Documentation** (Update accessibility documentation)
5. **Training** (Train team on accessibility best practices)
6. **Monitoring** (Set up automated accessibility testing in CI/CD)

## Appendix

### Tools Used

- axe DevTools 4.8.0
- WAVE Extension 3.2.4
- Lighthouse 10.0
- Pa11y 6.2.3
- NVDA 2023.3
- JAWS 2024
- VoiceOver (macOS 14.1)

### References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Articles](https://webaim.org/articles/)
- [Inclusive Components](https://inclusive-components.design/)

### Test Environment

- Browser: Chrome 120, Firefox 121, Safari 17
- Screen Readers: NVDA 2023.3, JAWS 2024, VoiceOver
- Mobile: iOS 17.1, Android 14
- Resolution: 1920x1080, 1366x768, 375x667 (mobile)
```

## Integration with Workflow

### Phase 3 - Validation

Run during Phase 3 (Validation):

1. After implementation complete
2. Before deployment
3. As part of `/quality-check`

### Continuous Monitoring

Set up automated accessibility testing:

```yaml
- name: Accessibility Audit
  run: claude /accessibility-audit --automated-only --report
  schedule:
    - cron: '0 0 * * 1'  # Weekly
```

## Best Practices

1. **Test Early and Often**: Integrate accessibility into development workflow
2. **Use Automated + Manual Testing**: Automated tools catch ~30-40% of issues
3. **Test with Real Users**: Include disabled users in testing
4. **Semantic HTML First**: Use correct HTML elements before adding ARIA
5. **Keyboard First**: Ensure keyboard accessibility before adding mouse interactions
6. **Focus Management**: Always know where focus is and make it visible
7. **Progressive Enhancement**: Start accessible, add enhancements
8. **Document Patterns**: Create reusable accessible component patterns

## Common Accessibility Issues

### Critical
- Missing alt text on images
- Insufficient color contrast
- Keyboard traps
- Missing form labels
- Inaccessible custom controls

### Serious
- Poor heading structure
- Missing landmarks
- Unclear error messages
- Insufficient touch targets
- No focus indicators

### Minor
- Redundant ARIA
- Missing page titles
- Inconsistent navigation
- Missing skip links

## Accessibility Testing Checklist

### Automated Testing
- [ ] Run axe DevTools
- [ ] Run Lighthouse accessibility audit
- [ ] Run WAVE validator
- [ ] Check color contrast

### Keyboard Testing
- [ ] Tab through entire page
- [ ] Test all interactive elements
- [ ] Verify focus indicators
- [ ] Test keyboard shortcuts

### Screen Reader Testing
- [ ] Test with NVDA (Windows)
- [ ] Test with VoiceOver (macOS/iOS)
- [ ] Test landmark navigation
- [ ] Test form announcements

### Mobile Testing
- [ ] Test with VoiceOver (iOS)
- [ ] Test with TalkBack (Android)
- [ ] Verify touch target sizes
- [ ] Test zoom functionality

### Compliance Validation
- [ ] WCAG 2.1 Level A compliance
- [ ] WCAG 2.1 Level AA compliance
- [ ] Section 508 compliance (if applicable)
- [ ] ADA compliance (if applicable)

## Related Commands

- `/quality-check` - Comprehensive quality validation (includes accessibility)
- `/security-audit` - Security-specific audits
- `/performance-audit` - Performance optimization
- `/code-check` - Code quality and standards

## Notes

This command ensures the application is usable by everyone, including:
- People with visual impairments (blind, low vision, color blind)
- People with auditory impairments (deaf, hard of hearing)
- People with motor impairments (limited mobility, tremors)
- People with cognitive impairments (learning disabilities, memory issues)
- Elderly users
- People using assistive technologies (screen readers, voice control, switch devices)

Accessibility is not just a legal requirement—it's about ensuring equal access for all users and expanding your potential user base by 15-20%.
