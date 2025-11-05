# Icon Accessibility Guide

Comprehensive guide for making icon components accessible to all users in the `@repo/icons` package.

## Table of Contents

- [Why Accessibility Matters](#why-accessibility-matters)
- [WCAG Compliance](#wcag-compliance)
- [Decorative vs Semantic Icons](#decorative-vs-semantic-icons)
- [ARIA Attributes](#aria-attributes)
- [Icon-Only Buttons](#icon-only-buttons)
- [Icon with Text Combinations](#icon-with-text-combinations)
- [Screen Reader Considerations](#screen-reader-considerations)
- [Focus Indicators](#focus-indicators)
- [Color Contrast](#color-contrast)
- [Touch Targets](#touch-targets)
- [Motion and Animation](#motion-and-animation)
- [Testing with Screen Readers](#testing-with-screen-readers)
- [Automated Testing](#automated-testing)
- [Common Issues](#common-issues)
- [Hospeda Examples](#hospeda-examples)
- [WCAG Criteria Mapping](#wcag-criteria-mapping)

---

## Why Accessibility Matters

### Business Case for Accessibility

**For Hospeda tourism platform:**

- 🌍 **Inclusive tourism:** 15% of global population has disabilities
- ⚖️ **Legal compliance:** Accessibility laws in Argentina and globally
- 📈 **Better SEO:** Accessible sites rank higher
- 👥 **Wider audience:** More potential guests and hosts
- ⭐ **User experience:** Better for everyone, not just disabled users

### Impact of Inaccessible Icons

**Without proper accessibility:**

- ❌ Screen reader users don't know what icons mean
- ❌ Keyboard users can't see focus
- ❌ Low-vision users can't see icon-only buttons
- ❌ Color-blind users miss color-only information
- ❌ Motor-impaired users struggle with small touch targets

**Real scenario:**

```
Tourist with visual impairment trying to book:
1. Encounters icon-only "Add to Favorites" button
2. Screen reader announces: "Button" (no context)
3. User doesn't know button's purpose
4. Cannot complete action
5. Leaves site frustrated
```

---

## WCAG Compliance

### WCAG 2.1 Level AA

**Hospeda target:** WCAG 2.1 Level AA compliance

**Key principles (POUR):**

- **Perceivable:** Users can perceive content
- **Operable:** Users can operate interface
- **Understandable:** Users understand content and operation
- **Robust:** Content works with assistive technologies

### Relevant Success Criteria for Icons

**Level A (Must meet):**

- 1.1.1 Non-text Content
- 2.1.1 Keyboard
- 2.4.4 Link Purpose (In Context)
- 4.1.2 Name, Role, Value

**Level AA (Target):**

- 1.4.3 Contrast (Minimum)
- 2.4.7 Focus Visible
- 2.5.5 Target Size

### Compliance Checklist

```
□ All semantic icons have text alternatives
□ Decorative icons hidden from assistive tech
□ Icon buttons have accessible names
□ Keyboard navigation works
□ Focus indicators visible
□ Color contrast meets 4.5:1 minimum
□ Touch targets at least 44×44px
□ Works with screen readers
□ Tested with keyboard only
```

---

## Decorative vs Semantic Icons

### Understanding the Difference

**Decorative icons:**

- Add visual appeal
- Don't convey meaning
- Information available elsewhere
- Should be hidden from screen readers

**Semantic icons:**

- Convey meaning
- Provide information
- Part of content
- Need text alternatives

### Decision Tree

```
Does removing the icon change the meaning?
    ├─ YES → Semantic (needs accessibility)
    │        Example: Icon-only button
    └─ NO → Decorative (hide from screen readers)
             Example: Icon next to text label
```

### Examples

**Decorative icons:**

```tsx
// Icon next to visible text label
<button>
  <SearchIcon aria-hidden="true" />
  <span>Search</span>
</button>

// Visual enhancement only
<h2>
  <StarIcon aria-hidden="true" />
  Featured Accommodations
</h2>
```

**Semantic icons:**

```tsx
// Icon-only button (icon IS the content)
<button aria-label="Search accommodations">
  <SearchIcon />
</button>

// Icon conveys status
<div>
  <SuccessIcon aria-label="Verified" />
  Verified host
</div>
```

---

## ARIA Attributes

### Core ARIA Attributes for Icons

#### 1. aria-hidden

**Purpose:** Hide decorative elements from assistive tech

**Usage:**

```tsx
// Decorative icon
<SearchIcon aria-hidden="true" />
```

**When to use:**

- Icon is decorative
- Text label already present
- Icon doesn't add information

**Example:**

```tsx
<button>
  <AddIcon aria-hidden="true" />
  <span>Add to Favorites</span>
</button>
```

#### 2. aria-label

**Purpose:** Provide accessible name for elements

**Usage:**

```tsx
// Icon-only button
<button aria-label="Add to favorites">
  <AddIcon />
</button>

// Icon with semantic meaning
<div>
  <SuccessIcon aria-label="Booking confirmed" />
</div>
```

**When to use:**

- Icon-only buttons
- Icons conveying status
- Icons representing actions
- No visible text label

**Best practices:**

- Be concise but descriptive
- Don't include "icon" or "button" (announced by screen reader)
- Use present tense for actions
- Match visual intent

**Examples:**

```tsx
// ✅ Good
<button aria-label="Search">
  <SearchIcon />
</button>

<button aria-label="Add to cart">
  <AddIcon />
</button>

// ❌ Bad
<button aria-label="Search icon button">  // Redundant
  <SearchIcon />
</button>

<button aria-label="Click to search">  // Don't say "click"
  <SearchIcon />
</button>
```

#### 3. aria-labelledby

**Purpose:** Reference another element for label

**Usage:**

```tsx
<div>
  <h3 id="section-title">Available Amenities</h3>
  <ul aria-labelledby="section-title">
    <li><WifiIcon aria-hidden="true" /> Wi-Fi</li>
    <li><PoolIcon aria-hidden="true" /> Pool</li>
  </ul>
</div>
```

**When to use:**

- Label exists elsewhere in DOM
- Multiple elements share same label
- Complex relationships

#### 4. aria-describedby

**Purpose:** Provide additional description

**Usage:**

```tsx
<button
  aria-label="Delete booking"
  aria-describedby="delete-warning"
>
  <DeleteIcon />
</button>
<div id="delete-warning" className="sr-only">
  This action cannot be undone
</div>
```

**When to use:**

- Additional context needed
- Warning or error information
- Supplementary details

#### 5. role="img"

**Purpose:** Identify semantic icons as images

**Usage:**

```tsx
<span role="img" aria-label="Five star rating">
  <StarIcon />
  <StarIcon />
  <StarIcon />
  <StarIcon />
  <StarIcon />
</span>
```

**When to use:**

- Multiple icons forming single concept
- Icon represents an image
- Complex icon combinations

### ARIA Attribute Decision Matrix

| Scenario | Attributes | Example |
|----------|------------|---------|
| Icon + text button | `aria-hidden="true"` on icon | `<button><SearchIcon aria-hidden="true" />Search</button>` |
| Icon-only button | `aria-label` on button | `<button aria-label="Search"><SearchIcon /></button>` |
| Status indicator | `aria-label` on container | `<div aria-label="Verified"><CheckIcon /></div>` |
| Decorative | `aria-hidden="true"` | `<StarIcon aria-hidden="true" />` |
| Complex icon group | `role="img"` + `aria-label` | `<span role="img" aria-label="Rating"><StarIcon /></span>` |

---

## Icon-Only Buttons

### The Problem

**Icon-only buttons without labels are inaccessible:**

```tsx
// ❌ Inaccessible
<button>
  <SearchIcon />
</button>

// Screen reader announces: "Button"
// User has no idea what it does
```

### The Solution

**1. Add aria-label (Preferred):**

```tsx
// ✅ Accessible
<button aria-label="Search accommodations">
  <SearchIcon />
</button>

// Screen reader announces: "Search accommodations, button"
```

**2. Add visually-hidden text:**

```tsx
// ✅ Accessible alternative
<button>
  <SearchIcon aria-hidden="true" />
  <span className="sr-only">Search accommodations</span>
</button>
```

**sr-only utility class:**

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### Best Practices for Icon-Only Buttons

**1. Descriptive labels:**

```tsx
// ✅ Good - Clear action
<button aria-label="Add to favorites">
  <HeartIcon />
</button>

// ✅ Good - Context included
<button aria-label="Filter accommodation results">
  <FilterIcon />
</button>

// ❌ Bad - Too vague
<button aria-label="Click">
  <HeartIcon />
</button>

// ❌ Bad - Too wordy
<button aria-label="Click this button to add this accommodation to your list of favorite accommodations">
  <HeartIcon />
</button>
```

**2. Action-oriented labels:**

```tsx
// ✅ Good - Action verbs
<button aria-label="Edit profile">
  <EditIcon />
</button>

<button aria-label="Delete booking">
  <DeleteIcon />
</button>

// ❌ Bad - Passive
<button aria-label="Profile editor">
  <EditIcon />
</button>
```

**3. Context-aware labels:**

```tsx
// In accommodation listing
<button aria-label="Add Beach House Villa to favorites">
  <HeartIcon />
</button>

// In navigation
<button aria-label="Open main menu">
  <MenuIcon />
</button>
```

### Icon Button Component

**Reusable accessible icon button:**

```tsx
import type { IconProps } from '@repo/icons';

interface IconButtonProps {
  icon: (props: IconProps) => JSX.Element;
  label: string;
  onClick: () => void;
  className?: string;
}

export function IconButton({
  icon: Icon,
  label,
  onClick,
  className,
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`p-2 rounded hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 ${className}`}
    >
      <Icon size={20} />
    </button>
  );
}

// Usage
<IconButton
  icon={SearchIcon}
  label="Search accommodations"
  onClick={handleSearch}
/>
```

---

## Icon with Text Combinations

### Pattern 1: Icon Before Text

**Icon is decorative:**

```tsx
<button>
  <SearchIcon aria-hidden="true" />
  <span>Search</span>
</button>
```

**Screen reader announces:** "Search, button"

### Pattern 2: Icon After Text

**Icon is decorative:**

```tsx
<button>
  <span>Download Report</span>
  <DownloadIcon aria-hidden="true" />
</button>
```

**Screen reader announces:** "Download Report, button"

### Pattern 3: Icon with Adjacent Text

**Icon is decorative:**

```tsx
<div className="flex items-center gap-2">
  <WifiIcon aria-hidden="true" />
  <span>Free Wi-Fi available</span>
</div>
```

**Screen reader announces:** "Free Wi-Fi available"

### Pattern 4: Icon as Status Indicator

**Icon is semantic:**

```tsx
<div className="flex items-center gap-2">
  <SuccessIcon aria-label="Verified" />
  <span>John Smith - Verified Host</span>
</div>
```

**Screen reader announces:** "Verified, John Smith - Verified Host"

**Better approach (avoid redundancy):**

```tsx
<div className="flex items-center gap-2">
  <SuccessIcon aria-hidden="true" />
  <span>John Smith - Verified Host</span>
</div>
```

**Screen reader announces:** "John Smith - Verified Host" (verified already in text)

### Pattern 5: Icon Replacing Text (Mobile)

**Desktop:**

```tsx
<button>
  <SearchIcon aria-hidden="true" />
  <span>Search Accommodations</span>
</button>
```

**Mobile (icon-only):**

```tsx
<button aria-label="Search accommodations">
  <SearchIcon />
  <span className="sr-only md:not-sr-only">Search Accommodations</span>
</button>
```

---

## Screen Reader Considerations

### How Screen Readers Interact with Icons

**Screen reader announcement order:**

1. Role (button, link, image, etc.)
2. Accessible name (aria-label, text content, etc.)
3. State (expanded, checked, etc.)

**Example:**

```tsx
<button aria-label="Add to favorites">
  <HeartIcon />
</button>
```

**Announced as:** "Add to favorites, button"

### Screen Reader Testing

**Popular screen readers:**

- **NVDA** (Windows, free)
- **JAWS** (Windows, commercial)
- **VoiceOver** (macOS/iOS, built-in)
- **TalkBack** (Android, built-in)
- **ORCA** (Linux, free)

### Common Announcements

**Good announcements:**

```
"Search accommodations, button"
"Add to favorites, button"
"Verified, image"
"Close dialog, button"
"Delete booking, button"
```

**Bad announcements:**

```
"Button" (no label)
"Icon, button" (redundant)
"Star icon, image" (implementation detail)
"Click here, button" (vague)
```

### Redundancy Issues

**Problem:**

```tsx
// Screen reader announces:
// "Search icon, search accommodations, button"
<button aria-label="Search icon, search accommodations">
  <SearchIcon />
</button>
```

**Solution:**

```tsx
// Screen reader announces:
// "Search accommodations, button"
<button aria-label="Search accommodations">
  <SearchIcon />
</button>
```

### Language Considerations

**For multilingual Hospeda:**

```tsx
// Spanish version
<button aria-label="Buscar alojamientos">
  <SearchIcon />
</button>

// English version
<button aria-label="Search accommodations">
  <SearchIcon />
</button>
```

**Use i18n:**

```tsx
import { useTranslation } from 'next-i18next';

function SearchButton() {
  const { t } = useTranslation();

  return (
    <button aria-label={t('search.button.label')}>
      <SearchIcon />
    </button>
  );
}
```

---

## Focus Indicators

### Why Focus Indicators Matter

**Keyboard users need visible focus:**

- Know where they are on page
- Navigate efficiently
- Activate correct elements

### Default Focus Styles

**Browser default (often inadequate):**

```css
button:focus {
  outline: 1px dotted;  /* Hard to see */
}
```

### Enhanced Focus Indicators

**Hospeda standard:**

```css
/* Focus visible (keyboard only) */
.icon-button:focus-visible {
  outline: 2px solid #3B82F6;  /* Blue-500 */
  outline-offset: 2px;
  border-radius: 0.375rem;  /* Rounded */
}

/* Remove outline for mouse clicks */
.icon-button:focus:not(:focus-visible) {
  outline: none;
}
```

**With Tailwind:**

```tsx
<button className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
  <SearchIcon />
</button>
```

### Focus Indicator Requirements

**WCAG 2.1 Level AA:**

- Minimum contrast: 3:1 against background
- Visible indicator: At least 2px
- Clear boundary: Around entire element

**Examples:**

```tsx
// ✅ Good - Clear focus ring
<button className="p-2 rounded hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500">
  <SearchIcon />
</button>

// ❌ Bad - No visible focus
<button className="focus:outline-none">
  <SearchIcon />
</button>
```

### Testing Focus Indicators

**Manual testing:**

```
1. Open page in browser
2. Press Tab key repeatedly
3. Verify:
   - Focus indicator visible
   - Easy to see where focus is
   - Logical tab order
   - No focus traps
```

---

## Color Contrast

### WCAG Contrast Requirements

**Level AA (Hospeda target):**

- Normal text: 4.5:1 contrast ratio
- Large text (18pt+): 3:1 contrast ratio
- UI components: 3:1 contrast ratio

**Level AAA (ideal):**

- Normal text: 7:1 contrast ratio
- Large text: 4.5:1 contrast ratio

### Icon Contrast

**Icons are UI components:**

- Minimum contrast: 3:1
- Applies to icon stroke/fill vs background

### Testing Contrast

**Tools:**

- **WebAIM Contrast Checker:** [webaim.org/resources/contrastchecker](https://webaim.org/resources/contrastchecker/)
- **Chrome DevTools:** Lighthouse audit
- **Figma:** Built-in contrast checker

**Example:**

```
Icon color: #6B7280 (gray-500)
Background: #FFFFFF (white)
Contrast ratio: 4.6:1
Result: ✅ Pass AA (UI component)
```

### Contrast Examples

**✅ Good contrast:**

```tsx
// Dark icon on light background
<SearchIcon className="text-gray-700" />  // #374151 on white = 10.9:1

// Light icon on dark background
<SearchIcon className="text-gray-100" />  // #F3F4F6 on #1F2937 = 14.4:1
```

**❌ Poor contrast:**

```tsx
// Light gray on white
<SearchIcon className="text-gray-300" />  // #D1D5DB on white = 1.8:1 ❌

// Dark gray on dark background
<SearchIcon className="text-gray-600" />  // #4B5563 on #1F2937 = 2.3:1 ❌
```

### Color Combinations

**Safe combinations (Hospeda palette):**

| Icon Color | Background | Contrast | Pass |
|------------|------------|----------|------|
| gray-700 | white | 10.9:1 | ✅ AAA |
| gray-600 | white | 7.2:1 | ✅ AAA |
| gray-500 | white | 4.6:1 | ✅ AA |
| blue-600 | white | 8.6:1 | ✅ AAA |
| green-600 | white | 4.8:1 | ✅ AA |
| red-600 | white | 5.9:1 | ✅ AAA |
| white | gray-900 | 18.6:1 | ✅ AAA |
| gray-300 | white | 1.8:1 | ❌ Fail |

### Don't Rely on Color Alone

**❌ Bad - Color-only information:**

```tsx
// Status shown only by color
<div>
  <CircleIcon className="text-green-500" />  // Success
  <CircleIcon className="text-red-500" />    // Error
</div>
```

**✅ Good - Color + shape/text:**

```tsx
// Status shown by icon + color + text
<div>
  <SuccessIcon className="text-green-500" />
  <span>Booking confirmed</span>
</div>

<div>
  <ErrorIcon className="text-red-500" />
  <span>Payment failed</span>
</div>
```

---

## Touch Targets

### WCAG Touch Target Size

**Minimum size:**

- 44×44 CSS pixels (Level AAA)
- 24×24 CSS pixels (Level AA, with spacing)

**Hospeda target:** 44×44px minimum

### Implementing Touch Targets

**Icon size vs touch target:**

```tsx
// Icon: 20px
// Touch target: 44px (via padding)
<button className="p-3">  {/* 3 × 8px = 24px padding */}
  <SearchIcon size={20} />  {/* 20px + 24px padding = 44px total */}
</button>
```

**Tailwind spacing reference:**

- `p-2`: 8px padding → 32px touch target (with 16px icon)
- `p-3`: 12px padding → 44px touch target (with 20px icon) ✅
- `p-4`: 16px padding → 56px touch target (with 24px icon)

### Touch Target Examples

**❌ Too small:**

```tsx
// 24px icon, no padding = 24px touch target
<button>
  <SearchIcon size={24} />
</button>
```

**✅ Adequate:**

```tsx
// 20px icon + 12px padding = 44px touch target
<button className="p-3">
  <SearchIcon size={20} />
</button>

// 24px icon + 10px padding = 44px touch target
<button className="p-2.5">
  <SearchIcon size={24} />
</button>
```

**✅ Generous:**

```tsx
// 24px icon + 16px padding = 56px touch target
<button className="p-4">
  <SearchIcon size={24} />
</button>
```

### Spacing Between Targets

**Minimum spacing:** 8px between adjacent targets

```tsx
// ❌ Too close (no spacing)
<div className="flex">
  <button className="p-2"><EditIcon /></button>
  <button className="p-2"><DeleteIcon /></button>
</div>

// ✅ Adequate spacing
<div className="flex gap-2">
  <button className="p-2"><EditIcon /></button>
  <button className="p-2"><DeleteIcon /></button>
</div>
```

---

## Motion and Animation

### Respecting User Preferences

**Some users need reduced motion:**

- Vestibular disorders
- Motion sickness
- Cognitive disabilities
- Personal preference

### prefers-reduced-motion

**CSS media query:**

```css
/* Animation enabled by default */
.icon {
  transition: transform 0.2s;
}

.icon:hover {
  transform: scale(1.1);
}

/* Respect user preference */
@media (prefers-reduced-motion: reduce) {
  .icon {
    transition: none;
  }

  .icon:hover {
    transform: none;
  }
}
```

**Tailwind:**

```tsx
<button className="transition-transform hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100">
  <SearchIcon />
</button>
```

### Safe Animations

**✅ Acceptable (subtle):**

- Fade in/out
- Color changes
- Size changes (small)

**⚠️ Caution (can trigger):**

- Rotation
- Parallax effects
- Large movements

**❌ Avoid:**

- Constant animation
- Spinning/rotating continuously
- Rapid flashing (seizure risk)

### Example: Loading Spinner

**With reduced motion support:**

```tsx
<div className="animate-spin motion-reduce:animate-none">
  <LoaderIcon />
  <span className="sr-only">Loading...</span>
</div>

/* CSS */
@media (prefers-reduced-motion: reduce) {
  .animate-spin {
    animation: none;
  }

  /* Show alternative indicator */
  .animate-spin::after {
    content: '...';
  }
}
```

---

## Testing with Screen Readers

### Setting Up Screen Readers

#### NVDA (Windows - Free)

**Installation:**

```
1. Download: https://www.nvaccess.org
2. Install
3. Launch with Ctrl+Alt+N
4. Stop with Insert+Q
```

**Basic commands:**

- `Insert+Down`: Read line
- `Tab`: Next interactive element
- `Shift+Tab`: Previous interactive element
- `Insert+Space`: Browse/focus mode toggle

#### VoiceOver (macOS - Built-in)

**Enable:**

```
System Preferences → Accessibility → VoiceOver → Enable
Or: Cmd+F5
```

**Basic commands:**

- `VO+A`: Read page
- `VO+Right`: Next element
- `VO+Left`: Previous element
- `Tab`: Next interactive element

#### TalkBack (Android - Built-in)

**Enable:**

```
Settings → Accessibility → TalkBack → Enable
```

### Testing Checklist

```
□ Icon-only buttons have labels
□ Decorative icons hidden (aria-hidden)
□ Labels are descriptive
□ Focus order is logical
□ Focus indicators visible
□ All interactive elements reachable by keyboard
□ No keyboard traps
□ Color contrast sufficient
□ Touch targets adequate size
□ Animations respect prefers-reduced-motion
```

### Testing Procedure

**1. Keyboard-only test:**

```
1. Close/hide mouse
2. Use only Tab, Shift+Tab, Enter, Space
3. Verify:
   - Can reach all icon buttons
   - Focus indicators visible
   - Logical tab order
   - Can activate buttons
```

**2. Screen reader test:**

```
1. Enable screen reader
2. Navigate with keyboard
3. Listen to announcements
4. Verify:
   - Icon buttons have meaningful labels
   - Decorative icons not announced
   - No redundant information
   - Context is clear
```

**3. Visual test:**

```
1. Check color contrast (DevTools)
2. Verify focus indicators
3. Test with zoom (200%, 400%)
4. Check touch target sizes (mobile)
```

---

## Automated Testing

### Accessibility Testing Tools

#### 1. axe DevTools

**Browser extension:**

```
Chrome/Edge: axe DevTools
Firefox: axe DevTools
```

**Usage:**

```
1. Open DevTools
2. Click axe tab
3. Click "Scan ALL of my page"
4. Review issues
```

#### 2. Lighthouse

**Chrome DevTools built-in:**

```
1. Open DevTools
2. Lighthouse tab
3. Select "Accessibility"
4. Click "Generate report"
```

#### 3. jest-axe

**Automated testing in Jest:**

```bash
pnpm add -D jest-axe @testing-library/jest-dom
```

**Test example:**

```typescript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SearchIcon } from './SearchIcon';

expect.extend(toHaveNoViolations);

describe('SearchIcon accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(
      <button aria-label="Search">
        <SearchIcon />
      </button>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('decorative icon should be hidden', async () => {
    const { container } = render(
      <button>
        <SearchIcon aria-hidden="true" />
        <span>Search</span>
      </button>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### CI/CD Integration

**GitHub Actions workflow:**

```yaml
name: Accessibility Tests

on: [push, pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm test:a11y
      - run: pnpm lighthouse:ci
```

---

## Common Issues

### Issue 1: Missing aria-label on Icon Button

**Problem:**

```tsx
<button>
  <SearchIcon />
</button>
```

**Screen reader:** "Button" (no context)

**Solution:**

```tsx
<button aria-label="Search accommodations">
  <SearchIcon />
</button>
```

**Screen reader:** "Search accommodations, button"

### Issue 2: Redundant Announcements

**Problem:**

```tsx
<button aria-label="Search">
  <SearchIcon />
  <span>Search</span>
</button>
```

**Screen reader:** "Search, search, button" (redundant)

**Solution:**

```tsx
<button>
  <SearchIcon aria-hidden="true" />
  <span>Search</span>
</button>
```

**Screen reader:** "Search, button"

### Issue 3: Poor Color Contrast

**Problem:**

```tsx
<SearchIcon className="text-gray-300" />  // On white background
```

**Contrast:** 1.8:1 ❌ Fails WCAG

**Solution:**

```tsx
<SearchIcon className="text-gray-700" />  // On white background
```

**Contrast:** 10.9:1 ✅ Passes WCAG AAA

### Issue 4: Inadequate Touch Targets

**Problem:**

```tsx
<button>
  <SearchIcon size={24} />
</button>
```

**Touch target:** 24×24px ❌ Too small

**Solution:**

```tsx
<button className="p-3">
  <SearchIcon size={20} />
</button>
```

**Touch target:** 44×44px ✅ Adequate

### Issue 5: No Focus Indicator

**Problem:**

```tsx
<button className="focus:outline-none">
  <SearchIcon />
</button>
```

**Result:** Keyboard users can't see focus ❌

**Solution:**

```tsx
<button className="focus-visible:ring-2 focus-visible:ring-blue-500">
  <SearchIcon />
</button>
```

**Result:** Clear focus ring ✅

---

## Hospeda Examples

### Example 1: Search Button (Navigation)

```tsx
// Mobile: Icon-only
// Desktop: Icon + text

function SearchButton() {
  return (
    <button
      aria-label="Search accommodations"
      className="flex items-center gap-2 p-3 rounded-lg hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <SearchIcon size={20} aria-hidden="true" />
      <span className="hidden md:inline">Search</span>
    </button>
  );
}
```

**Accessibility:**

- ✅ aria-label for icon-only (mobile)
- ✅ Icon hidden when text visible (desktop)
- ✅ Adequate touch target (44×44px)
- ✅ Focus indicator

### Example 2: Favorite Button (Accommodation Card)

```tsx
function FavoriteButton({ accommodationName, isFavorite, onToggle }) {
  return (
    <button
      aria-label={
        isFavorite
          ? `Remove ${accommodationName} from favorites`
          : `Add ${accommodationName} to favorites`
      }
      aria-pressed={isFavorite}
      onClick={onToggle}
      className="p-2 rounded-full hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <HeartIcon
        size={24}
        className={isFavorite ? 'text-red-500 fill-red-500' : 'text-gray-400'}
      />
    </button>
  );
}
```

**Accessibility:**

- ✅ Descriptive label with context
- ✅ aria-pressed for toggle state
- ✅ Color + fill (not color alone)
- ✅ Adequate touch target

### Example 3: Amenity List

```tsx
function AmenityList({ amenities }) {
  return (
    <ul className="space-y-2">
      {amenities.map((amenity) => (
        <li key={amenity.id} className="flex items-center gap-3">
          {getAmenityIcon(amenity.type)}
          <span>{amenity.name}</span>
        </li>
      ))}
    </ul>
  );
}

function getAmenityIcon(type: string) {
  const iconProps = { size: 20, 'aria-hidden': true };

  switch (type) {
    case 'wifi':
      return <WifiIcon {...iconProps} />;
    case 'pool':
      return <PoolIcon {...iconProps} />;
    case 'parking':
      return <ParkingIcon {...iconProps} />;
    default:
      return null;
  }
}
```

**Accessibility:**

- ✅ Icons are decorative (text provides info)
- ✅ aria-hidden on all icons
- ✅ Semantic list markup

### Example 4: Status Indicators

```tsx
function BookingStatus({ status }) {
  const statusConfig = {
    confirmed: {
      icon: SuccessIcon,
      text: 'Booking confirmed',
      color: 'text-green-600',
    },
    pending: {
      icon: PendingIcon,
      text: 'Awaiting confirmation',
      color: 'text-yellow-600',
    },
    cancelled: {
      icon: ErrorIcon,
      text: 'Booking cancelled',
      color: 'text-red-600',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 ${config.color}`}>
      <Icon size={20} aria-hidden="true" />
      <span className="font-medium">{config.text}</span>
    </div>
  );
}
```

**Accessibility:**

- ✅ Icon + text (not color alone)
- ✅ Icon is decorative
- ✅ Semantic status information

---

## WCAG Criteria Mapping

### Icons Package Compliance

**1.1.1 Non-text Content (Level A):**

✅ All semantic icons have text alternatives
✅ Decorative icons marked with aria-hidden

**2.1.1 Keyboard (Level A):**

✅ All icon buttons keyboard accessible
✅ Logical focus order

**2.4.4 Link Purpose (Level A):**

✅ Icon links have descriptive labels

**2.4.7 Focus Visible (Level AA):**

✅ Focus indicators on all interactive icons

**1.4.3 Contrast Minimum (Level AA):**

✅ All icons meet 3:1 contrast ratio

**2.5.5 Target Size (Level AAA):**

✅ All touch targets minimum 44×44px

**4.1.2 Name, Role, Value (Level A):**

✅ All icon components have proper ARIA

### Compliance Summary

| Criterion | Level | Status | Notes |
|-----------|-------|--------|-------|
| 1.1.1 Non-text Content | A | ✅ Pass | Text alternatives provided |
| 2.1.1 Keyboard | A | ✅ Pass | All icons keyboard accessible |
| 2.4.4 Link Purpose | A | ✅ Pass | Descriptive labels |
| 4.1.2 Name, Role, Value | A | ✅ Pass | Proper ARIA attributes |
| 1.4.3 Contrast (Minimum) | AA | ✅ Pass | 3:1 minimum met |
| 2.4.7 Focus Visible | AA | ✅ Pass | Clear focus indicators |
| 2.5.5 Target Size | AAA | ✅ Pass | 44×44px minimum |

---

## Summary

### Accessibility Checklist

```
□ Decorative icons: aria-hidden="true"
□ Semantic icons: aria-label
□ Icon-only buttons: descriptive labels
□ Icon+text: hide icon from screen readers
□ Focus indicators: visible and clear
□ Color contrast: 3:1 minimum (4.5:1 for text)
□ Touch targets: 44×44px minimum
□ Keyboard navigation: works perfectly
□ Screen reader testing: completed
□ Automated tests: passing
```

### Key Principles

1. **Decorative = hide** (aria-hidden)
2. **Semantic = label** (aria-label)
3. **Context matters** (descriptive labels)
4. **Test with real users** (screen readers)
5. **Automate checks** (jest-axe)

### Resources

- **WCAG 2.1:** [w3.org/WAI/WCAG21/quickref](https://www.w3.org/WAI/WCAG21/quickref/)
- **ARIA Authoring:** [w3.org/WAI/ARIA/apg](https://www.w3.org/WAI/ARIA/apg/)
- **WebAIM:** [webaim.org](https://webaim.org/)
- **Adding icons:** [Adding Icons Guide](./adding-icons.md)
- **Testing:** [Testing Guide](./testing.md)

---

*Last updated: 2025-01-05*
