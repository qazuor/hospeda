# Mockup Prompt Engineering Guide

> **Complete guide to crafting effective prompts for AI-powered mockup generation in Hospeda**

## Overview

This guide provides best practices, examples, and tips for creating high-quality mockups using the AI image generation system (`@repo/ai-image-generation`). Effective prompt engineering is crucial for generating mockups that accurately represent your design vision.

---

## Table of Contents

1. [Prompt Anatomy](#prompt-anatomy)
2. [Best Practices](#best-practices)
3. [Device-Specific Presets](#device-specific-presets)
4. [Good vs Bad Examples](#good-vs-bad-examples)
5. [Quality Tips](#quality-tips)
6. [Common Patterns](#common-patterns)
7. [Troubleshooting](#troubleshooting)

---

## Prompt Anatomy

A well-structured prompt has 5 key components:

```text
[Device Type] + [Page/Feature Name] + [Key Elements] + [Visual Style] + [Layout Details]
```

### Component Breakdown

1. **Device Type** (Optional but recommended)
   - Desktop/laptop view
   - Mobile/phone view
   - Tablet view
   - Specific: iPhone, iPad, MacBook

2. **Page/Feature Name** (Required)
   - Landing page
   - Search results page
   - Booking confirmation screen
   - User dashboard
   - Product details page

3. **Key Elements** (Required)
   - Header, navigation, sidebar
   - Search bar, filters, buttons
   - Cards, forms, tables
   - Images, icons, badges

4. **Visual Style** (Recommended)
   - Modern, clean, minimalist
   - Professional, corporate
   - Colorful, playful, vibrant
   - Dark mode, light mode

5. **Layout Details** (Optional)
   - Grid-based, card layout
   - Two-column, three-column
   - Sidebar on left/right
   - Plenty of white space
   - Compact, dense information

---

## Best Practices

### ✅ DO

1. **Be Specific About Layout**

   ```text
   "Header with logo on left and navigation on right, main content area with sidebar on left showing filters, right side with grid of property cards (3 columns)"
   ```

2. **Mention Key UI Elements**

   ```text
   "Include: search bar with location input, date picker, guest selector dropdown, price range slider, filter checkboxes for amenities"
   ```

3. **Specify Visual Style**

   ```text
   "Clean modern design, plenty of white space, professional appearance, minimal color palette"
   ```

4. **Include Device Type**

   ```text
   "Desktop view" or "Mobile-optimized layout" or "Tablet horizontal orientation"
   ```

5. **Add Context About Density**

   ```text
   "Sparse layout with focus on imagery" or "Information-dense dashboard with multiple widgets"
   ```

### ❌ DON'T

1. **Don't Be Too Vague**

   ```text
   ❌ "booking page"
   ✅ "Booking confirmation page with success checkmark, booking details card, and action buttons"
   ```

2. **Don't Overspecify Colors/Fonts**

   ```text
   ❌ "Use #3B82F6 blue for buttons and Roboto 16px font"
   ✅ "Modern blue accent colors, readable typography"
   ```

3. **Don't Request Specific Brands/Copyrighted Content**

   ```text
   ❌ "Airbnb-style interface with their logo"
   ✅ "Accommodation booking interface similar to popular platforms"
   ```

4. **Don't Include Technical Jargon**

   ```text
   ❌ "React component with useState hooks and Tailwind CSS classes"
   ✅ "Interactive search interface with real-time filtering"
   ```

5. **Don't Use Multiple Conflicting Styles**

   ```text
   ❌ "Minimalist but also colorful and playful yet professional corporate"
   ✅ "Professional design with colorful accents"
   ```

---

## Device-Specific Presets

The `craftPrompt` utility provides device-specific enhancements:

### Desktop Preset

```ts
const prompt = craftPrompt({
  description: 'Accommodation search results page',
  device: 'desktop'
});
// Adds: "Desktop/laptop view, wide layout, ..."
```

**Characteristics:**

- Wide layouts (1200px+ width)
- Multi-column grids
- Sidebars for filters/navigation
- Hover states implied
- Mouse/cursor interactions

**Best For:**

- Complex dashboards
- Data-heavy interfaces
- Multi-panel layouts
- Detailed forms

### Mobile Preset

```ts
const prompt = craftPrompt({
  description: 'Booking confirmation screen',
  device: 'mobile'
});
// Adds: "Mobile/phone view, vertical layout, ..."
```

**Characteristics:**

- Single column layouts
- Bottom sheets/modal filters
- Floating action buttons
- Touch-friendly targets (44x44px+)
- Swipe gestures implied

**Best For:**

- On-the-go tasks
- Quick actions
- Card-based content
- Simple forms

### Tablet Preset

```ts
const prompt = craftPrompt({
  description: 'Property details with image gallery',
  device: 'tablet'
});
// Adds: "Tablet view, medium width layout, ..."
```

**Characteristics:**

- 2-column layouts
- Adaptive sidebars
- Hybrid touch/cursor interactions
- Medium content density

**Best For:**

- Browsing experiences
- Content consumption
- Mixed interaction modes

---

## Good vs Bad Examples

### Example 1: Search Results Page

#### ❌ Bad Prompt

```text
"search results"
```

**Problems:**

- Too vague
- No device specified
- No layout details
- No visual style

#### ✅ Good Prompt

```text
"Desktop accommodation search results page with left sidebar filters (price, amenities, ratings), main area showing grid of property cards (3 columns) with images, titles, ratings, and prices. Top header with search bar and map toggle button. Clean modern design with white background."
```

**Why It Works:**

- Specific device (Desktop)
- Clear layout structure (sidebar + grid)
- Key elements mentioned (filters, cards, header)
- Visual style defined (clean modern, white)
- Component details (3 columns, specific filters)

---

### Example 2: Mobile Booking Flow

#### ❌ Bad Prompt

```text
"booking screen mobile"
```

**Problems:**

- Minimal detail
- No specific step in flow
- No elements described

#### ✅ Good Prompt

```text
"Mobile booking confirmation screen with large green checkmark icon at top, booking details card showing check-in/check-out dates, guest count, total price. Two action buttons below: 'View Booking' (primary blue) and 'Back to Home' (secondary). Bottom navigation bar with 5 icons. Clean design, plenty of white space, success state visual."
```

**Why It Works:**

- Device specified (Mobile)
- Specific flow step (confirmation)
- All elements listed (checkmark, card, buttons, nav)
- Visual hierarchy (large checkmark, button colors)
- Emotional context (success state)

---

### Example 3: Dashboard Interface

#### ❌ Bad Prompt

```text
"admin dashboard with stats and charts"
```

**Problems:**

- Generic description
- No layout specifics
- Missing key widget details

#### ✅ Good Prompt

```text
"Desktop admin dashboard with top navigation bar, sidebar menu on left. Main area contains 4 stat cards in a row (total bookings, revenue, occupancy rate, reviews) followed by two charts side by side: line graph for monthly revenue trend and bar chart for top properties. Below that, a table showing recent bookings with columns for guest name, property, dates, status. Professional dark blue theme, clean typography."
```

**Why It Works:**

- Clear device (Desktop)
- Specific layout (sidebar + main area)
- Detailed widget descriptions (4 stat cards, 2 charts, table)
- Chart types specified (line graph, bar chart)
- Visual theme (professional dark blue)

---

## Quality Tips

### 1. Layout & Structure

✅ **Describe the hierarchy:**

```text
"Header at top → Hero section with large image → Search panel overlayed on hero → Feature cards in 3-column grid → Footer"
```

✅ **Use directional terms:**

- "Left sidebar", "Right panel"
- "Top navigation", "Bottom sheet"
- "Centered modal", "Fixed header"

✅ **Specify dimensions relationally:**

- "Large hero image taking 60% of viewport height"
- "Compact header with minimal padding"
- "Wide main content area (70%) with narrow sidebar (30%)"

### 2. Elements & Components

✅ **Name standard UI components:**

- Search bar, dropdown, checkbox, radio button
- Card, modal, toast, badge, chip
- Tab navigation, breadcrumb, pagination
- Date picker, time picker, slider

✅ **Describe states when relevant:**

- "Selected tab highlighted"
- "Disabled button grayed out"
- "Active filter with blue background"
- "Loading skeleton for cards"

### 3. Visual Style

✅ **Use design adjectives:**

- Clean, minimal, spacious
- Modern, contemporary, fresh
- Professional, corporate, polished
- Friendly, approachable, warm
- Bold, vibrant, energetic

✅ **Mention color schemes (general):**

- "Light theme with blue accents"
- "Dark mode interface"
- "Neutral color palette with green call-to-action"
- "Warm tones for hospitality feel"

⚠️ **Avoid exact hex colors** - AI interprets color names better than codes

### 4. Content Density

✅ **Specify information density:**

- "Sparse layout focused on imagery" → More white space, fewer elements
- "Dense information dashboard" → Compact, many widgets
- "Balanced content-to-white-space ratio" → Medium density

### 5. Responsiveness

✅ **Mobile-specific mentions:**

- "Touch-friendly button sizes"
- "Swipeable card carousel"
- "Bottom navigation bar"
- "Hamburger menu in top-left"

✅ **Desktop-specific mentions:**

- "Hover effects on cards"
- "Sidebar always visible"
- "Multi-column layout"
- "Breadcrumb navigation"

---

## Common Patterns

### Pattern 1: Hero Section with Search

```text
"[Device] landing page with full-width hero image, centered overlay containing large heading and search form (location input, date range picker, search button). Below hero, 3-column grid of featured properties. Modern design, white overlay on hero image for contrast."
```

**Use For:** Landing pages, search-focused pages

---

### Pattern 2: List/Grid with Filters

```text
"[Device] results page with left sidebar containing filters (checkboxes for amenities, price slider, star rating), main area showing grid of result cards (3 columns on desktop, 1 on mobile) with image, title, rating, price. Top bar with sort dropdown and view toggle (grid/list). Clean layout with card shadows."
```

**Use For:** Search results, catalog browsing, property listings

---

### Pattern 3: Detail Page

```text
"[Device] property details page with image gallery carousel at top, main content section with property name, rating, description, amenities list, and location map. Right sidebar with booking form (dates, guests, price summary, 'Book Now' button). Responsive layout: sidebar moves below content on mobile."
```

**Use For:** Product/property details, profile pages, article pages

---

### Pattern 4: Multi-Step Form

```text
"[Device] booking form step 2 of 3, showing progress indicator at top, main form area with labeled fields (guest details, special requests), navigation buttons at bottom ('Back' and 'Continue'), sidebar showing booking summary (dates, property, price). Clean form design with clear labels and validation hints."
```

**Use For:** Checkout flows, onboarding, wizards

---

### Pattern 5: Dashboard/Overview

```text
"[Device] dashboard with metric cards at top row (4 cards: total views, bookings, revenue, rating), middle section with chart showing trend over time, bottom section with data table (recent activities). Sidebar navigation on left. Professional interface, organized layout, clear data visualization."
```

**Use For:** Admin dashboards, analytics, reporting

---

## Troubleshooting

### Issue 1: Mockup Too Generic

**Problem:** Output looks generic, doesn't match brand/style

**Solutions:**

- Add more specific visual style descriptors
- Mention color scheme (e.g., "blue and white color scheme")
- Specify design language (e.g., "Material Design style" or "iOS native feel")
- Include brand personality (e.g., "warm and welcoming")

**Example Fix:**

```diff
- "Hotel search page with filters"
+ "Hotel search page with filters. Warm, welcoming design with terracotta accent colors, rounded corners on cards, soft shadows. Professional yet approachable feel suitable for tourism platform."
```

---

### Issue 2: Wrong Layout

**Problem:** Elements in wrong positions or missing

**Solutions:**

- Be more explicit about positions (left, right, top, bottom)
- Number elements in order (first, second, then)
- Use layout terminology (grid, flexbox-style, columns)
- Describe relative sizes

**Example Fix:**

```diff
- "Search page with sidebar and results"
+ "Search page with LEFT sidebar (30% width) containing stacked filter groups, RIGHT main area (70% width) showing 3-column grid of property cards. Header spans full width at top with search bar centered."
```

---

### Issue 3: Too Much/Little Detail

**Problem:** Mockup is too cluttered or too empty

**Solutions:**

- Specify content density explicitly
- Mention white space if needed
- Balance specificity: focus on structure > minor details
- Use "minimal", "detailed", "comprehensive" qualifiers

**Example Fix (Too Cluttered):**

```diff
- "Dashboard with all stats, charts, tables, cards, widgets, graphs"
+ "Dashboard with 4 key metric cards at top, single line chart showing main trend, and table of 5 most recent items. Clean layout with generous spacing between sections."
```

**Example Fix (Too Empty):**

```diff
- "Clean minimal booking page"
+ "Booking page with centered form containing date pickers, guest dropdown, and price summary. Minimal distraction but all necessary booking information visible."
```

---

### Issue 4: Unclear Device/Responsiveness

**Problem:** Mockup doesn't look right for target device

**Solutions:**

- Always specify device type in prompt
- Use device-specific patterns (e.g., "bottom sheet" for mobile)
- Mention touch vs. cursor interactions if relevant
- Describe how layout adapts if showing multiple devices

**Example Fix:**

```diff
- "Booking confirmation screen"
+ "MOBILE booking confirmation screen with vertical layout, large touch-friendly buttons (minimum 44px height), bottom navigation bar, and swipe-friendly card design."
```

---

### Issue 5: Style Mismatch

**Problem:** Mockup style doesn't fit project aesthetic

**Solutions:**

- Study existing mockups for style patterns
- Reference similar successful prompts
- Use consistent terminology across prompts
- Mention the Hospeda brand (modern, professional, welcoming)

**Example Fix:**

```diff
- "Property search interface"
+ "Property search interface in Hospeda brand style: modern, professional yet welcoming design. Clean typography, blue accent colors (#3B82F6), generous white space, soft shadows on cards, rounded corners (8px border radius)."
```

---

## Advanced Techniques

### 1. Layering Prompts

For complex UIs, build prompts in layers:

**Base Layer (Structure):**

```text
"Desktop accommodation listing page with header, left filter sidebar, main content grid"
```

**Element Layer (Components):**

```text
"+ Header contains: logo, search bar, user profile icon
+ Sidebar contains: price slider, amenity checkboxes, rating filter
+ Main grid: 3 columns of property cards"
```

**Style Layer (Visual):**

```text
"+ Modern clean design, blue accents, white background, card shadows, plenty of spacing"
```

**Combined:**

```text
"Desktop accommodation listing page with header (logo, search bar, user profile), left filter sidebar (price slider, amenity checkboxes, rating filter), main content grid (3 columns of property cards). Modern clean design, blue accents, white background, card shadows, plenty of spacing."
```

### 2. Reference-Based Prompts

Use references to well-known patterns:

```text
"Accommodation search results page similar to Booking.com layout: left sidebar filters, main area with property cards in grid, top bar with sort/filter options. Adapt style to be more modern and minimal with blue accent color."
```

**Caution:** Only use references to describe structure/layout, not to copy copyrighted designs.

### 3. State-Specific Mockups

Generate mockups for specific states:

```text
"[Same base prompt] showing LOADING STATE with skeleton placeholders for cards"
"[Same base prompt] showing EMPTY STATE with centered illustration and 'No results found' message"
"[Same base prompt] showing ERROR STATE with error banner at top"
```

---

## Quick Reference Checklist

Before generating a mockup, verify your prompt has:

- [ ] Device type specified (desktop/mobile/tablet)
- [ ] Page/feature name clear
- [ ] Key UI elements listed (3-5 minimum)
- [ ] Layout structure described (columns, sidebars, sections)
- [ ] Visual style mentioned (modern, clean, professional, etc.)
- [ ] Content density hint (sparse, dense, balanced)
- [ ] 50-150 words total (sweet spot for detail vs. clarity)
- [ ] No copyrighted brand references
- [ ] No exact hex colors or font specifications
- [ ] Focus on structure and hierarchy, not tiny details

---

## Resources

**Example Prompts from P-005:**

- See `.claude/sessions/planning/P-005-test/mockups/.registry.json` for real prompts and results
- Study successful prompts from `examples/e2e-test.ts`

**Related Documentation:**

- [Environment Setup Guide](./mockup-setup.md) - How to configure the system
- [UX/UI Designer Agent](../../agents/design/ux-ui-designer.md) - Full agent documentation
- [MockupGenerator API Reference](../../../packages/ai-image-generation/README.md) - Technical details

---

**Last Updated:** 2025-11-04
**Version:** 1.0.0
**Related:** P-005, PF-005-18
