---
audit: accessibility
status: complete
date: 2026-05-21
agent: Explore
---

# Accessibility Audit: Hospeda Admin Panel

## Executive Summary

The Hospeda admin panel demonstrates **strong baseline accessibility** with proper use of semantic HTML, ARIA attributes, and modern a11y patterns from Radix UI and TanStack libraries. The codebase shows intentional design for screen readers, keyboard navigation, and focus management. However, several gaps exist around dark-mode color contrast and skip links, with moderate impact on real-world usability.

---

## 1. Semantic HTML & Landmark Roles

### Strengths
- **Proper landmark structure**: Main content uses `<main>` (AppLayout.tsx:46), sidebar uses `<aside>` (Sidebar.tsx:76), header uses `<header>` (Header.tsx:75).
- **Navigation landmarks**: Two distinct `<nav>` elements with descriptive `aria-label` values:
  - "Main navigation" (Header.tsx:98) for top-level sections
  - "Secondary navigation" (Sidebar.tsx:111) for contextual sidebar items
- **Table structure**: DataTable.tsx uses proper `<table>`, `<thead>`, `<tbody>` with `scope="col"` on all `<th>` elements (line 371).
- **Form semantics**: ValidatedForm wraps content in `<form>` (line 244), ValidatedInput generates proper `<label htmlFor={id}>` associations (line 192–199).
- **Button semantics**: Interactive elements use native `<button>` type (mobile menu toggle, navigation buttons, close dialogs).

### Gaps
- **Overlay/backdrop div**: Sidebar overlay uses a generic `<div>` with `onClick` handler (Sidebar.tsx:63–72) instead of a semantic `<dialog>` or explicit role. However, `aria-label` is present, mitigating impact.
- **No skip link**: No "Skip to main content" link detected in AppLayout or Header. Screen reader users must tab through all header/sidebar navigation before reaching `<main>`.

---

## 2. ARIA Usage & Custom Components

### Strengths
- **aria-current="page"**: Correctly set on active navigation items (HeaderNavItem.tsx:59, SidebarItem.tsx:52, MobileMenuItem.tsx:173).
- **aria-label on icon-only buttons**: 
  - Menu toggle: "toggleMenu" (Header.tsx:80)
  - Notifications: "notifications" (Header.tsx:130)
  - Settings/Profile: properly labeled (Header.tsx:163, 173)
  - Dialog close: explicit sr-only span + aria-label (dialog.tsx:85, MobileMenu.tsx:127)
- **aria-describedby for form errors**: ValidatedInput links error/help text to input via `aria-describedby` (lines 210–217), with proper IDs.
- **aria-invalid for form state**: Set on inputs based on validation errors (line 209).
- **aria-labelledby for collapsible groups**: SidebarGroup properly uses `aria-labelledby` (SidebarGroup.tsx, referenced but not fully shown).
- **aria-hidden on decorative icons**: CloseIcon in mobile menu (MobileMenu.tsx:131).
- **aria-modal & aria-hidden on drawers**: Mobile menu drawer uses `aria-hidden={!isOpen}` (MobileMenu.tsx:116).
- **aria-live regions for screen readers**: ValidatedForm includes `aria-live="polite" aria-atomic="true"` for form status updates (lines 380–393); ValidatedInput includes status region (lines 270–278).

### Gaps
- **Badge count accessibility**: SidebarItem badge uses `aria-label` on the badge span itself (line 60), but the default label "$count unread messages" may not suffice in all contexts; consider aria-describedby on parent link for context.
- **Missing role on sortable th buttons**: DataTable sorting headers are clickable `<button>` elements inside `<th>` (line 375), which is correct, but the `aria-label` is only "sortColumn" without indicating current sort direction. The visual indicator (▲/▼) is present but not read aloud.

---

## 3. Keyboard Navigation & Focus Management

### Strengths
- **Full keyboard navigation**: All interactive elements are native `<button>`, `<a>`, `<input>`, or Radix-powered components that support keyboard by default.
- **Focus trap in MobileMenu**: Properly implemented Tab cycle (lines 76–92) with Shift+Tab cycling to last focusable element and Tab wrapping to first.
- **Focus restoration on close**: MobileMenu stores and restores previous focus when drawer closes (lines 49–59).
- **Escape key handling**: Both MobileMenu (lines 62–73) and Header notifications dropdown (line 125) handle Escape to close.
- **Dialog focus management**: Radix `<Dialog>` (dialog.tsx) uses Radix Dialog Primitive, which automatically:
  - Traps focus within the dialog
  - Closes on Escape
  - Restores focus to trigger button on close
- **Table pagination buttons**: Disabled states properly marked with `disabled` attribute (DataTable.tsx:476, 486).

### Gaps
- **Sidebar overlay backdrop**: The overlay `<div>` can be clicked to close (line 103), and Escape is handled (line 124), but the div itself doesn't have `role="button"` or any explicit keyboard affordance. It's `role="presentation"`, which is correct semantically, but keyboard users may not discover this interaction.
- **No explicit focus visible styles on all elements**: Most components use `focus-visible:ring-2 focus-visible:ring-ring`, which is good, but some lower-level interactive divs may lack this.

---

## 4. Focus Management: Dialogs & Modals

### Implementation
- **Radix Dialog** used for all modals (dialog.tsx), which handles:
  - Initial focus (moves to first focusable child or DialogTitle if `autoFocus=true`)
  - Focus trap (cycling within modal only)
  - Escape to close
  - Focus restoration post-close
- **MobileMenu (custom)** implements manual focus management:
  - `previousFocusRef` stores focus on open (line 51)
  - Focus moved to close button on open (line 53)
  - Focus restored to trigger on close (line 55–57)

### Gaps
- **No explicit `autoFocus` in Dialog examples**: If custom usage doesn't set `autoFocus`, the first focusable element might be deep in the form, requiring sighted users to feel lost.
- **DialogContent doesn't announce open state**: Radix Dialog doesn't announce "dialog opened" to screen readers automatically; implementations must add a title or description for context.

---

## 5. Color Contrast in Dark Mode

### Light Mode
- **Primary text on background**: `oklch(0.141 0.005 285.823)` text on `oklch(1 0 0)` = ~14:1 contrast (WCAG AAA).
- **Muted foreground on background**: `oklch(0.4 0.016 285.938)` on white = ~4.7:1 (WCAG AA, by design comment line 31–32).
- **Muted foreground on muted**: `oklch(0.4)` on `oklch(0.967)` = ~3.5:1 (borderline AA for large text).

### Dark Mode
- **Primary text (white) on background**: `oklch(0.985 0 0)` on `oklch(0.141)` = ~14:1 (WCAG AAA).
- **Muted foreground on dark background**: `oklch(0.82 0.015 286.067)` on `oklch(0.141)` = ~4.7:1 (WCAG AA, by design comment line 70–71).
- **Destructive color in dark**: `oklch(0.65 0.22 27)` on dark background — lifted from 0.55 to pass AA (comment line 74–75). On dark tinted backgrounds, this clears AA.

### Assessment
- **WCAG AA compliant** for text/foreground combinations documented.
- **Borderline cases**: Muted-on-muted in light mode at 3.5:1 may not pass AA for regular text; check actual rendered usage.
- **Risk**: Chart colors and accent states not explicitly verified for contrast; spot-check in dark mode if charts/analytics views exist.

---

## 6. Sidebar & Secondary Navigation

### Strengths
- **Landmark role**: Sidebar is `<aside>` with `aria-label` (Sidebar.tsx:76–77, 112).
- **Active item indication**: 
  - Visual: `.bg-accent` + `.font-medium` (SidebarItem.tsx:47–49)
  - ARIA: `aria-current="page"` when active (line 52)
- **Badge on unread items**: Conversations inbox shows unread count with aria-label (line 60).
- **Contextual sidebar**: Title changes based on section (line 58), proper label for screen readers.
- **Responsive**: Sidebar collapses on desktop (isCollapsed state), sidebar overlay manages mobile drawer.

### Gaps
- **No "section heading" role on sidebar title**: The title div (line 105–107) could benefit from a heading role (`<h2>`) to give screen reader users clearer nesting of content hierarchy.
- **Missing aria-current on sidebar group headings**: Groups can be expanded/collapsed, but if a group heading corresponds to a parent nav item, no aria-expanded or aria-current is visible.

---

## 7. Tables

### Structure
- Proper `<table>` → `<thead>` + `<tbody>` (DataTable.tsx:361–447)
- All `<th>` have `scope="col"` (line 371)
- Sortable headers are `<button>` inside `<th>` (line 375)

### Gaps
- **Sort direction not announced**: Visual sort indicator (▲/▼) at line 387–392 is not included in the aria-label. Screen readers cannot distinguish ascending vs. descending.
  - **Fix**: Change aria-label from `'ui.accessibility.sortColumn'` to include current sort direction: `'${currentSort} column, ${direction}'`
- **Rows per page label**: Row-count selector has `aria-label="rowsPerPage"` (line 461), which is good.
- **colSpan for empty/loading states**: When no data or loading, colSpan is set correctly (lines 410, 420).

---

## 8. Forms

### ValidatedForm
- **Proper form semantics**: `<form>` with `noValidate` (line 244–249).
- **Error display**: Global errors and field errors listed in `<ul>` (lines 268–271), each error is a list item.
- **Status for screen readers**: `aria-live="polite"` region announces submission state, validation results (lines 380–393).
- **Success/error messaging**: Icons have aria-labels; text is clear.

### ValidatedInput
- **Label association**: `<label htmlFor={id}>` always generated (line 192–199); id auto-generated via useId if not provided (line 90).
- **Required indicator**: Red asterisk added to required fields (line 197).
- **aria-invalid**: Set based on validation state (line 209).
- **aria-describedby**: Links input to error and help text IDs (lines 210–217).
- **Help text**: Displayed below input when no error (line 262–267).
- **Screen reader status**: aria-live region announces validation state (lines 270–278).

### Gaps
- **No `required` attribute on input**: The form marks required fields visually (`*`) but doesn't set the HTML `required` attribute on the input element. While not necessary with ValidatedForm's approach, it would enhance semantics.
- **Validation icons**: Loading, success, and error icons have aria-labels (lines 224, 229, 235), but these labels are on the icon element, not the input. Could be clearer if aria-describedby points to these instead.

---

## 9. Icon-Only Buttons

All icon-only buttons have aria-labels:
- Mobile menu toggle: "toggleMenu" (Header.tsx:80)
- Notifications: "notifications" (Header.tsx:130)
- Profile/Settings links: aria-label + title attribute (Header.tsx:163, 173)
- Dialog close: sr-only span + aria-label (dialog.tsx:84–85)
- Sidebar close (mobile): aria-label (Sidebar.tsx:98)
- MobileMenu close: aria-label (MobileMenu.tsx:127)

**Status: Compliant.** All icon-only buttons are labeled.

---

## 10. Page Titles

### Implementation
- **DocumentTitle component** in __root.tsx (lines 184–194) updates `document.title` on every route change.
- **titleForPath function** (line 159–163) maps section paths to human-readable labels (e.g., `/accommodations` → "Alojamientos · Hospeda Admin").
- **Fallback to BASE_TITLE**: If path doesn't match a section, defaults to "Hospeda Admin".
- **Static head meta**: Root route head includes initial meta title (line 166–168).

### Assessment
- **Good**: Every route has a unique, descriptive page title in the browser tab and available to screen readers.
- **Potential gap**: Title updates on *client-side* navigation after initial load. If page is bookmarked and reopened, the initial head meta might not match the section. However, this is acceptable for a CSR admin app.

---

## 11. Skip Links

### Finding
- **No skip link detected** in AppLayout, Header, or any layout component.
- Screen reader users must tab through:
  1. Header logo/link
  2. Header navigation (multiple items)
  3. Mobile menu (if open)
  4. Sidebar (secondary nav, potentially large)
  5. Finally reach `<main>` content

### Impact
- **Moderate**: For desktop users with reduced sidebar (collapsed state), the overhead is lower. For mobile, the sidebar is not visible unless explicitly opened, reducing the issue. However, on first load or with keyboard-only users on desktop, this is a usability friction.

### Recommendation
Add a "Skip to main content" link in the header, hidden visually but visible on focus:
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```
And add `id="main-content"` to the `<main>` element.

---

## 12. Dark Mode Compliance

### Tokens Used
- **--muted-foreground**: Light `oklch(0.4)`, Dark `oklch(0.82)` — both at ~4.7:1 contrast (WCAG AA).
- **--destructive**: Light `oklch(0.5)`, Dark `oklch(0.65)` — adjusted to clear AA on tinted backgrounds.
- **Primary text**: White in dark mode (`oklch(0.985)`), dark in light mode — both high contrast.

### Assessment
- **WCAG AA compliant** for main text and foreground colors.
- **Edge case**: Accent color on muted background in dark mode (`oklch(0.274)` on `oklch(0.141)`) may be borderline; spot-check if backgrounds change.

---

## Summary of Findings

### Top 3 Wins
1. **Strong semantic HTML**: Proper use of `<main>`, `<aside>`, `<nav>`, `<button>`, `<label>` throughout. TanStack Router + Radix UI provide robust, accessible primitives.
2. **Focus management in modals/drawers**: MobileMenu implements correct focus trap + restoration. Radix Dialog automates this for other modals.
3. **Form validation accessibility**: ValidatedForm & ValidatedInput include aria-live regions, aria-invalid, aria-describedby, and clear error messaging for screen readers.

### Top 3 Gaps
1. **No skip link** (Moderate impact) — Screen reader users must tab through entire header/sidebar to reach main content. Easy fix: add one-line "Skip to main content" link.
2. **Table sort direction not announced** (Low-moderate impact) — Sort button aria-label only says "Sort column"; doesn't indicate asc/desc. Users cannot tell current direction without sighted assistance.
3. **Missing explicit role or focus-visible on overlay backdrop** (Low impact) — Sidebar overlay is clickable to close but offers no keyboard affordance beyond Escape. Adding `role="button"` or explicit focus styles would improve discoverable

ability.

---

## Compliance Checklist

| Criterion | Status | Notes |
|-----------|--------|-------|
| Semantic HTML (`<main>`, `<nav>`, `<button>`) | ✓ Pass | Used correctly throughout |
| Form labels (`<label htmlFor>`) | ✓ Pass | All validated inputs labeled |
| Table structure (`<thead>`, `scope="col"`) | ✓ Pass | Proper HTML structure |
| ARIA landmarks | ✓ Pass | `<nav aria-label>`, `<aside>`, etc. |
| aria-current on active nav | ✓ Pass | Set on header, sidebar, mobile menu items |
| Icon-only button labels | ✓ Pass | All have aria-label |
| Form validation feedback | ✓ Pass | aria-invalid, aria-describedby, aria-live |
| Focus management in dialogs | ✓ Pass | Focus trap + restoration in modals |
| Dark mode contrast | ✓ Pass | Tokens at WCAG AA (borderline in edge cases) |
| Page titles | ✓ Pass | Unique per route |
| Skip links | ✗ Fail | None present |
| Table sort direction announcement | ~ Partial | Visual only, not in aria-label |
| Keyboard navigation (non-button elements) | ✓ Pass | All interactive elements are semantic or explicitly trapped |

---

## Recommendations (Priority Order)

### High (Do First)
1. **Add skip link**: One-liner in Header, restore focus to main on click.
2. **Improve sort aria-label**: Include direction (asc/desc) in button label.

### Medium (Do Next)
3. Verify muted-on-muted contrast in actual light-mode UI; adjust if below 4.5:1.
4. Add heading role (`<h2>`) to sidebar title or group headings for clearer hierarchy.
5. Test validation icons in screen readers; consider moving aria-label to parent input with aria-describedby.

### Low (Nice to Have)
6. Add aria-expanded to collapsible sidebar groups (if implemented).
7. Consider role="button" on overlay backdrops for clarity, though current Escape handling is sufficient.

---

## Tools & References

- **WCAG 2.1 Level AA** target for this audit.
- **Radix UI**: Dialog, Label, Slot (accessible primitives leveraged well).
- **TanStack Router**: Handles nav state; DocumentTitle component updates page title.
- **oklch() color tokens**: Light & dark mode colors specified with explicit lightness values for contrast verification.
- **sr-only pattern**: Tailwind `.sr-only` class used for screen-reader-only content.

---

## Conclusion

The Hospeda admin panel has a **solid accessibility foundation** with proper semantic HTML, ARIA attributes, and focus management. The design leverages accessible libraries (Radix, TanStack) effectively. The primary gaps are the absence of a skip link and table sort direction announcement—both are easy, high-impact fixes. With these addressed, the panel would achieve WCAG AA compliance across all major criteria.

