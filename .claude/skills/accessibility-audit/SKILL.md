---
name: accessibility-audit
description: WCAG 2.1 AA accessibility audit patterns. Use when conducting accessibility reviews, ensuring inclusive UX, or auditing ARIA and keyboard navigation compliance.
---

# Accessibility Audit

## Purpose

Conduct a comprehensive accessibility audit ensuring WCAG 2.1 Level AA compliance and an inclusive user experience. This skill covers semantic HTML, ARIA implementation, keyboard navigation, screen reader compatibility, visual accessibility, form accessibility, mobile accessibility, and content readability to produce an actionable compliance report.

## When to Use

- Before production deployment
- After major UI/UX changes
- When adding new components or pages
- As part of regular accessibility reviews (quarterly recommended)
- After receiving accessibility-related user feedback
- When compliance requirements mandate an accessibility audit

## Audit Areas

### 1. WCAG 2.1 Compliance

Validate against the four WCAG principles:

**Perceivable:**

- Text alternatives for non-text content (images, icons, media)
- Captions and transcripts for audio/video
- Content adaptable to different presentations
- Distinguishable content (contrast, spacing)

**Operable:**

- All functionality accessible via keyboard
- Users have enough time to read and interact
- No content that causes seizures or physical reactions
- Navigable structure with clear wayfinding

**Understandable:**

- Readable text content
- Predictable operation and behavior
- Input assistance for error prevention and recovery

**Robust:**

- Compatible with current and future assistive technologies
- Valid markup and correct ARIA usage

### 2. Semantic HTML and ARIA

**Checks:**

- Proper HTML5 semantic elements (`<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`, `<header>`, `<footer>`)
- ARIA roles used only when semantic HTML is insufficient
- ARIA properties (aria-label, aria-labelledby, aria-describedby)
- ARIA states (aria-expanded, aria-selected, aria-hidden)
- Landmark regions cover all page content
- Heading hierarchy (h1-h6) is logical and complete
- Lists use proper markup (ul, ol, dl)
- Tables use th, caption, and scope attributes

### 3. Keyboard Navigation

**Checks:**

- All interactive elements are reachable via Tab/Shift+Tab
- Tab order matches visual reading order
- Focus indicators are visible and high-contrast
- Skip navigation link present
- No keyboard traps (user can always navigate away)
- Modal dialogs trap focus correctly
- Dropdown menus support arrow key navigation
- Custom widgets follow WAI-ARIA Authoring Practices

**Test procedure:**

1. Disconnect the mouse
2. Navigate the entire application using only Tab, Shift+Tab, Enter, Space, and Arrow keys
3. Test all interactive elements (links, buttons, forms, menus, modals)
4. Verify focus is always visible
5. Confirm no keyboard traps exist

### 4. Screen Reader Compatibility

**Checks:**

- Content is announced in a logical reading order
- Form labels and instructions are read correctly
- Error messages are announced when they appear
- Dynamic content updates use aria-live regions
- Image alt text is descriptive and meaningful
- Link text is descriptive (not "click here")
- Button labels clearly describe the action
- Table headers are associated with data cells

**Screen readers to test:**

- NVDA (Windows, free)
- VoiceOver (macOS/iOS, built-in)
- TalkBack (Android, built-in)
- JAWS (Windows, commercial)

### 5. Visual Accessibility

**Color Contrast:**

- Normal text: >= 4.5:1 ratio (WCAG AA)
- Large text (>= 18px or >= 14px bold): >= 3:1 ratio
- UI components and graphical objects: >= 3:1 ratio
- Focus indicators: >= 3:1 ratio against adjacent colors

**Text and Zoom:**

- Minimum base font size: 16px
- Text scalable to 200% without content loss
- Content reflows at 320px width (400% zoom)
- No horizontal scrolling at standard zoom levels

**Visual Indicators:**

- Color is never the sole indicator of information
- Focus indicators are always visible
- Reduced motion supported (prefers-reduced-motion)
- Images of text avoided (except logos)

### 6. Form and Input Accessibility

**Checks:**

- All inputs have associated labels (for/id or aria-labelledby)
- Required fields are indicated (not by color alone)
- Error messages are clear and associated (aria-describedby)
- Autocomplete attributes for personal data fields
- Grouped inputs use fieldset/legend
- Input types are appropriate (email, tel, number, url)
- Help text is programmatically associated
- Success messages are announced to screen readers

### 7. Mobile Accessibility

**Checks:**

- Touch targets >= 44x44px (WCAG 2.1)
- Spacing between targets >= 8px
- Pinch-to-zoom is not disabled
- Both portrait and landscape orientations supported
- Mobile screen reader compatibility (VoiceOver, TalkBack)
- Viewport meta tag does not disable scaling

### 8. Content Accessibility

**Checks:**

- Language attribute set on HTML element (`<html lang="en">`)
- Content language changes marked (lang attribute on elements)
- Reading level appropriate for the audience
- Abbreviations expanded on first use
- Instructions do not rely on sensory characteristics ("the red button")
- Time-limited content can be paused or extended
- Auto-playing media can be paused or stopped

## Workflow

### Phase 1: Automated Testing

```bash
# Lighthouse accessibility audit
lighthouse https://your-app.com --only-categories=accessibility --view

# Pa11y CI for multiple pages
pa11y-ci --sitemap https://your-app.com/sitemap.xml

# axe-core in test suite
npx axe https://your-app.com
```

### Phase 2: Keyboard Testing

1. Navigate the entire application using only the keyboard
2. Document every element that cannot be reached or operated
3. Note any keyboard traps or missing focus indicators
4. Verify modal focus management
5. Test all custom interactive widgets

### Phase 3: Screen Reader Testing

1. Test with NVDA or VoiceOver on all critical pages
2. Verify form labels, error announcements, and dynamic updates
3. Check reading order matches visual order
4. Test navigation landmarks and heading structure

### Phase 4: Visual Testing

1. Check color contrast with browser DevTools or a contrast analyzer
2. Zoom to 200% and verify no content loss
3. Zoom to 400% and verify content reflows to single column
4. Enable reduced motion and verify animations are suppressed

### Phase 5: Code Review

1. Review HTML for semantic correctness
2. Verify ARIA attributes are used correctly
3. Check heading hierarchy (one h1, logical h2-h6 structure)
4. Review alt text quality on all images

## Report Template

```markdown
# Accessibility Audit Report

**Date:** YYYY-MM-DD
**Application:** [App Name]
**WCAG Target:** Level AA

## Executive Summary
- **WCAG Compliance:** Pass/Fail Level AA
- **Overall Score:** X/100
- **Critical Issues:** X (blocks access)
- **High Issues:** X (severe impact)
- **Medium Issues:** X (moderate impact)
- **Low Issues:** X (best practices)

## WCAG 2.1 Compliance Status

### Principle 1: Perceivable
| Criterion                    | Level | Status    |
|------------------------------|-------|-----------|
| 1.1.1 Non-text Content      | A     | PASS/FAIL |
| 1.3.1 Info and Relationships | A     | PASS/FAIL |
| 1.4.3 Contrast (Minimum)    | AA    | PASS/FAIL |
| 1.4.11 Non-text Contrast    | AA    | PASS/FAIL |

### Principle 2: Operable
| Criterion              | Level | Status    |
|------------------------|-------|-----------|
| 2.1.1 Keyboard         | A     | PASS/FAIL |
| 2.1.2 No Keyboard Trap | A     | PASS/FAIL |
| 2.4.3 Focus Order      | A     | PASS/FAIL |
| 2.4.7 Focus Visible    | AA    | PASS/FAIL |

### Principle 3: Understandable
| Criterion                    | Level | Status    |
|------------------------------|-------|-----------|
| 3.1.1 Language of Page       | A     | PASS/FAIL |
| 3.3.1 Error Identification   | A     | PASS/FAIL |
| 3.3.2 Labels or Instructions | A     | PASS/FAIL |

### Principle 4: Robust
| Criterion               | Level | Status    |
|-------------------------|-------|-----------|
| 4.1.2 Name, Role, Value | A     | PASS/FAIL |
| 4.1.3 Status Messages   | AA    | PASS/FAIL |

## Findings by Severity

### Critical (Blocks Access)
1. **[Issue Title]**
   - **WCAG:** [Criterion]
   - **Location:** [Page/Component]
   - **User Impact:** [Who is affected and how]
   - **Remediation:** [Fix steps]
   - **Effort:** [Low/Medium/High]

### High / Medium / Low
[...]

## Testing Results
- **Lighthouse Score:** X/100
- **axe Violations:** X critical, X serious, X moderate, X minor
- **Keyboard Navigation:** PASS/FAIL
- **Screen Reader:** PASS/FAIL
- **Color Contrast:** PASS/FAIL

## Recommendations
1. **Priority 1 (Critical):** [Fix immediately]
2. **Priority 2 (High):** [Fix this sprint]
3. **Priority 3 (Medium):** [Fix next sprint]
4. **Priority 4 (Low):** [Backlog]
```

## WCAG Level Quick Reference

**Level A (Minimum):**

- Alt text for all images
- All functionality keyboard accessible
- Clear form labels
- No seizure-triggering content

**Level AA (Target):**

- Color contrast 4.5:1 for text, 3:1 for UI
- Text resizable to 200%
- Multiple navigation methods
- Consistent navigation
- Error suggestions and prevention

**Level AAA (Aspirational):**

- Color contrast 7:1 for text
- No time limits
- No interruptions
- Enhanced error prevention

## Best Practices

1. **Test early and often** -- integrate accessibility checks into development, not just audits
2. **Use semantic HTML first** -- ARIA is supplemental, not a replacement
3. **Test with real assistive technology** -- automated tools catch only ~30% of issues
4. **Include users with disabilities** -- real user feedback is invaluable
5. **Automate in CI/CD** -- fail builds on critical accessibility violations
6. **Train the team** -- accessibility is everyone's responsibility
7. **Document accessible patterns** -- create and maintain an accessible component library
8. **Track compliance trends** -- compare audit results over time
9. **Focus on user impact** -- prioritize fixes that affect the most users
10. **Consider all disabilities** -- visual, auditory, motor, cognitive

## Recommended Tools

**Browser Extensions:**

- axe DevTools -- automated testing
- WAVE -- visual accessibility feedback
- Lighthouse -- audit scores and recommendations
- Color Contrast Analyzer -- contrast checking

**Screen Readers:**

- NVDA (Windows, free)
- VoiceOver (macOS/iOS, built-in)
- TalkBack (Android, built-in)

**Command Line:**

- Pa11y CI -- automated testing in CI/CD
- axe-core -- headless accessibility testing
- Lighthouse CI -- continuous integration audits
