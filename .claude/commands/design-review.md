---
name: design-review
description: Invokes the design-reviewer agent for visual UI review of a URL or component path
---

# Design Review Command

## Purpose

Performs a visual UI and design review by invoking the design-reviewer agent. Accepts a URL for live page review or a component file path for source-level analysis. Evaluates visual consistency, accessibility compliance, responsive design, spacing/alignment, color contrast, typography hierarchy, and adherence to design system guidelines.

This command bridges the gap between code review and visual quality assurance, catching design issues that are invisible in code-only reviews.

## When to Use

- **UI Component Development**: After building or modifying UI components
- **Page Layout Changes**: When changing page layouts or navigation
- **Design System Updates**: When updating shared design tokens or components
- **Pre-Release Review**: Visual QA before shipping to users
- **Accessibility Validation**: Checking visual accessibility compliance (contrast, sizing)
- **Responsive Design**: Validating layouts across breakpoints
- **Brand Consistency**: Ensuring new UI matches brand guidelines

## Usage

```bash
/design-review [target] [options]
```

### Arguments

- `<target>`: URL or file/directory path to review

### Options

- `--url <url>`: URL to review (alternative to positional argument)
- `--path <path>`: Component file or directory path (alternative to positional argument)
- `--breakpoints <sizes>`: Responsive breakpoints to check (mobile, tablet, desktop, all)
- `--focus <area>`: Focus review on specific area (layout, typography, colors, spacing, accessibility, animation)
- `--design-system <path>`: Path to design system or brand config file
- `--report`: Generate detailed design review report
- `--screenshots`: Capture and compare screenshots (requires browser tool)
- `--compare <url-or-path>`: Compare against reference design or previous version

### Examples

```bash
/design-review https://localhost:3000/dashboard         # Review live page
/design-review src/components/Header/                   # Review component files
/design-review --url https://staging.example.com/login  # Review staging URL
/design-review --path src/pages/Home.tsx --breakpoints all
/design-review --focus accessibility --url https://localhost:3000
/design-review --design-system .claude/brand-config.json --path src/components/
/design-review --compare https://production.example.com --url https://staging.example.com
```

## Review Process

### Step 1: Target Analysis

**Actions:**

- Determine review target type (URL or file path)
- If URL: prepare for visual review via browser tools (if available)
- If file path: read component source code and identify UI patterns
- Load design system configuration (if provided or detected)
- Identify technology stack (React, Vue, Astro, HTML/CSS, etc.)

**Checks:**

- [ ] Target is accessible and valid
- [ ] Technology stack identified
- [ ] Design system loaded (if available)
- [ ] Review scope determined

### Step 2: Visual Structure Analysis

**Review Areas:**

1. **Layout & Composition**
   - Grid system usage and consistency
   - Content alignment and flow
   - Visual hierarchy effectiveness
   - White space distribution
   - Section proportions and balance
   - Scroll behavior and page length

2. **Typography**
   - Font hierarchy (h1-h6, body, captions)
   - Font size scale consistency
   - Line height and readability
   - Font weight usage
   - Text alignment patterns
   - Text truncation and overflow handling

3. **Color & Contrast**
   - WCAG AA contrast ratios (4.5:1 for text, 3:1 for large text)
   - Color palette consistency with design system
   - Meaningful use of color (not sole indicator)
   - Dark mode / light mode support
   - Focus indicator visibility
   - Color harmony and balance

4. **Spacing & Alignment**
   - Consistent spacing scale usage
   - Element alignment on grid
   - Padding and margin consistency
   - Gap consistency in flex/grid layouts
   - Touch target sizing (minimum 44x44px)

5. **Components & Patterns**
   - Button styles and states (default, hover, active, disabled, focus)
   - Form element consistency
   - Card and container patterns
   - Navigation patterns
   - Loading and empty states
   - Error and success states
   - Modal and overlay patterns

### Step 3: Responsive Design Review

**Breakpoint Analysis:**

- **Mobile** (320px - 480px):
  - Touch-friendly targets
  - Readable text without zooming
  - No horizontal scrolling
  - Proper stacking of content

- **Tablet** (481px - 1024px):
  - Appropriate layout adaptation
  - Effective use of available space
  - Navigation accessibility

- **Desktop** (1025px+):
  - Content max-width constraints
  - Multi-column layouts
  - Hover state availability
  - Large screen optimization

**Checks:**

- [ ] Layout adapts properly at each breakpoint
- [ ] No content overflow or clipping
- [ ] Touch targets adequate on mobile
- [ ] Images and media responsive
- [ ] Navigation accessible at all sizes

### Step 4: Accessibility Review (Visual)

**WCAG 2.1 Visual Checks:**

1. **Perceivable**
   - Color contrast meets AA standards (4.5:1 normal, 3:1 large)
   - Text resizable to 200% without loss
   - Content reflows at 320px width
   - Non-text content has alternatives
   - UI not dependent on color alone

2. **Operable**
   - Focus indicators visible and clear
   - Touch targets minimum 44x44px
   - Interactive elements clearly identifiable
   - No content requires specific orientation
   - Motion/animation respects prefers-reduced-motion

3. **Understandable**
   - Consistent navigation patterns
   - Form labels clearly associated
   - Error messages visible and descriptive
   - Interface behavior predictable

4. **Robust**
   - Semantic HTML structure
   - ARIA labels where needed
   - Proper heading hierarchy
   - Landmark regions defined

### Step 5: Design System Compliance

**Actions (when design system provided):**

- Compare colors against design tokens
- Verify typography matches defined scales
- Check spacing values against spacing scale
- Validate component usage against design system patterns
- Flag custom/overridden styles
- Check icon usage consistency

### Step 6: Results Compilation

**Actions:**

- Organize findings by category and severity
- Generate visual comparison screenshots (if available)
- Calculate design quality score
- Create remediation suggestions with specific CSS/component fixes

## Output Format

### Terminal Output

```
Design Review Results
===================================================================

Target: https://localhost:3000/dashboard
Type: Live page review
Breakpoints: mobile, tablet, desktop
Design System: brand-config.json loaded

LAYOUT & COMPOSITION
===================================================================

MEDIUM: Inconsistent section spacing
  Location: Dashboard main content area
  Issue: Top section has 32px margin, bottom sections have 24px
  Fix: Standardize to design system spacing scale (--spacing-8)

LOW: Visual hierarchy could be stronger
  Location: Dashboard header
  Issue: Page title and subtitle have similar visual weight
  Fix: Increase title size or reduce subtitle opacity

TYPOGRAPHY
===================================================================

PASS: Font hierarchy consistent
PASS: Line heights readable
LOW: Long heading may truncate on mobile
  Location: Report title in card component
  Issue: Title exceeds card width at 320px
  Fix: Add text truncation or reduce font size on mobile

COLOR & CONTRAST
===================================================================

HIGH: Insufficient contrast on disabled button text
  Location: "Submit" button (disabled state)
  Issue: Contrast ratio 2.8:1 (requires 4.5:1)
  Current: #999999 on #E5E5E5
  Fix: Use #767676 on #E5E5E5 (4.54:1)

PASS: Primary text contrast (12.6:1)
PASS: Color palette matches design system

SPACING & ALIGNMENT
===================================================================

MEDIUM: Inconsistent card padding
  Location: Dashboard cards grid
  Issue: Summary cards use 16px padding, detail cards use 24px
  Fix: Standardize to 20px (--spacing-5) or 24px (--spacing-6)

PASS: Grid alignment consistent
PASS: Touch targets meet minimum 44px

RESPONSIVE DESIGN
===================================================================

Mobile (320px):
  HIGH: Navigation menu overlaps content
    Issue: Hamburger menu dropdown extends beyond viewport
    Fix: Add max-height with overflow scroll

  MEDIUM: Table content requires horizontal scroll
    Issue: Data table does not adapt for mobile
    Fix: Use card layout or responsive table pattern

Tablet (768px):
  PASS: Layout adapts properly
  PASS: Navigation accessible

Desktop (1280px):
  PASS: Content properly constrained
  PASS: Multi-column layout effective

ACCESSIBILITY (Visual)
===================================================================

HIGH: Focus indicator not visible on cards
  Issue: Interactive cards lack visible focus outline
  Fix: Add outline or ring on :focus-visible

MEDIUM: Color used as sole indicator for status
  Issue: Status badges use only color (green/red) without text
  Fix: Add text label or icon alongside color

PASS: Touch targets adequate
PASS: Heading hierarchy correct

===================================================================
Summary
===================================================================

  Category               Pass    Issues
  Layout & Composition   2       2 (0 high, 1 medium, 1 low)
  Typography             2       1 (0 high, 0 medium, 1 low)
  Color & Contrast       2       1 (1 high, 0 medium, 0 low)
  Spacing & Alignment    2       1 (0 high, 1 medium, 0 low)
  Responsive Design      3       2 (1 high, 1 medium, 0 low)
  Accessibility          2       2 (1 high, 1 medium, 0 low)

  Total: 9 issues (3 high, 4 medium, 2 low)

  Design Quality Score: 7.2/10

  Recommendation: Address high-priority issues (contrast, focus
  indicators, mobile navigation) before release.
```

### Report File

When `--report` is enabled, generates a detailed report at
`.claude/reports/design-review-report.md` including:

- Full visual analysis per category
- Screenshots at each breakpoint (if browser tools available)
- Color contrast calculations with WCAG references
- Component-level findings with code suggestions
- Design system compliance checklist
- Before/after comparison (if `--compare` used)
- Accessibility audit summary

## Integration with Workflow

### Validation Phase

The design review is part of the validation workflow:

1. Implement UI changes
2. Run `/code-review` for code quality
3. Run `/design-review` for visual quality
4. Address high-priority design findings
5. Get stakeholder approval on visual changes

### Design Iteration

For iterative design work:

1. Build initial component
2. Run `/design-review --path src/components/MyComponent/`
3. Fix findings
4. Re-run to verify fixes
5. Expand to page-level review with URL

## Best Practices

1. **Review at Component Level First**: Start with individual component files before full page review
2. **Use Design System**: Provide brand config for more accurate compliance checking
3. **Test All Breakpoints**: Use `--breakpoints all` for responsive validation
4. **Address Accessibility First**: High-contrast and focus issues affect the most users
5. **Compare with Production**: Use `--compare` to catch regressions
6. **Screenshot Evidence**: Use `--screenshots` for visual documentation
7. **Iterate Quickly**: Run focused reviews during development for fast feedback
8. **Include Stakeholders**: Share design review reports with designers for alignment

## Related Commands

- `/code-review` - Code quality review (complements design review)
- `/security-review` - Security-focused review
- `/help` - Get help on available commands

## Notes

- URL reviews require a running local or staging server
- Full screenshot comparison requires browser automation tools (MCP chrome-devtools)
- Component file review is source-level analysis; some visual issues can only be detected with a live page
- Design system compliance checking requires a `brand-config.json` or equivalent configuration file
- Accessibility checks are visual-only; use dedicated accessibility audit tools for full WCAG compliance
- The design-reviewer agent is invoked as a subagent to perform the actual review
- Color contrast calculations follow WCAG 2.1 formulas for luminance ratio
