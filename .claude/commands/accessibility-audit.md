---
name: accessibility-audit
description: Comprehensive accessibility audit validating WCAG 2.1 Level AA compliance across 8 areas including perceivable, operable, understandable, robust, screen reader, keyboard, mobile, and forms
---

# Accessibility Audit Command

## Purpose

Performs a comprehensive accessibility audit of the application, validating WCAG
2.1 Level AA compliance, ARIA implementation, keyboard navigation, screen reader
compatibility, and ensuring the application is usable by everyone. Provides
automated and manual accessibility testing with actionable remediation guidance.

## When to Use

- **Before Production Deployment**: Ensure accessibility compliance before launch
- **After UI Changes**: Validate accessibility after design or component updates
- **Regular Audits**: Quarterly accessibility reviews (required for compliance)
- **Bug Reports**: When users report accessibility issues
- **Legal Compliance**: Before public releases (ADA, Section 508, WCAG
  requirements)

## Usage

```bash
/accessibility-audit [options]
```

### Options

- `--scope <area>`: Focus audit on specific area (navigation, forms, content,
  all)
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

**Benchmarks:**

- Logical heading hierarchy (no skipped levels)
- All major sections have landmarks
- 100% valid ARIA usage

#### Distinguishable (WCAG 1.4)

**Checks:**

- [ ] Color contrast ratio >= 4.5:1 for normal text
- [ ] Color contrast ratio >= 3:1 for large text (18pt+)
- [ ] Color contrast ratio >= 3:1 for UI components
- [ ] Information not conveyed by color alone
- [ ] Text resizable up to 200% without loss of content
- [ ] No horizontal scrolling at 320px width
- [ ] Background audio can be paused or volume adjusted
- [ ] Focus indicators visible and sufficient contrast

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

#### Seizures and Physical Reactions (WCAG 2.3)

**Checks:**

- [ ] No content flashes more than 3 times per second
- [ ] No animation that could cause seizures
- [ ] Animation can be disabled (prefers-reduced-motion)
- [ ] Parallax effects can be disabled

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

**Benchmarks:**

- 100% touch targets >= 44x44px
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

**Benchmarks:**

- All touch targets >= 44x44px
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

**Benchmarks:**

- 100% of inputs labeled
- All errors programmatically associated
- Clear field instructions

## Output Format

### Terminal Output

```text
Accessibility Audit Report

Overall Score: 85/100 (Good - WCAG 2.1 AA)

Critical Issues (2)
  1. Missing alt text on product images
     Location: src/components/ProductCard.tsx:45
     Impact: Screen readers cannot describe images
     WCAG: 1.1.1 (Level A)
     Fix: Add descriptive alt text to all images

  2. Insufficient color contrast on call-to-action buttons
     Location: src/components/Button.tsx:12
     Contrast: 3.2:1 (needs 4.5:1)
     WCAG: 1.4.3 (Level AA)
     Fix: Increase contrast to 4.5:1 minimum

Serious Issues (5)
  1. Keyboard trap in modal dialog
     Location: src/components/Modal.tsx:78
     Impact: Users cannot exit modal with keyboard
     WCAG: 2.1.2 (Level A)
     Fix: Add keyboard handler for Escape key

  2. Missing form labels
     Location: src/pages/contact.tsx:34
     Impact: Screen readers cannot identify fields
     WCAG: 3.3.2 (Level A)
     Fix: Add <label> elements or aria-label

  [...]

WCAG 2.1 Compliance

Level A (Required):
  Text Alternatives: 95% (19/20 checks)
  Keyboard Accessible: 85% (17/20 checks)
  Distinguishable: 90% (18/20 checks)
  Readable: 100% (10/10 checks)

Level AA (Target):
  Contrast: 80% (needs 100%)
  Resize Text: 100%
  Input Assistance: 95%
  Compatible: 100%

Level AAA (Enhanced):
  Enhanced Contrast: 60%
  No Timing: 100%
  Section Headings: 95%

Top Recommendations
  1. Add alt text to all images (+10 accessibility score)
  2. Fix color contrast on CTAs (+5 accessibility score)
  3. Fix keyboard trap in modals (critical accessibility issue)
  4. Add form labels (+8 accessibility score)
  5. Increase touch target sizes (+3 mobile usability)
```

## Testing Tools

### Automated Testing

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

## Best Practices

1. **Test Early and Often**: Integrate accessibility into development workflow
2. **Use Automated + Manual Testing**: Automated tools catch ~30-40% of issues
3. **Test with Real Users**: Include disabled users in testing
4. **Semantic HTML First**: Use correct HTML elements before adding ARIA
5. **Keyboard First**: Ensure keyboard accessibility before adding mouse
   interactions
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
- People using assistive technologies (screen readers, voice control, switch
  devices)

Accessibility is not just a legal requirement -- it is about ensuring equal
access for all users.

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Articles](https://webaim.org/articles/)
- [Inclusive Components](https://inclusive-components.design/)
