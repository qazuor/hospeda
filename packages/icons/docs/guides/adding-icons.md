# Adding Icons Guide

Comprehensive guide for adding new icons to the `@repo/icons` package.

## Table of Contents

- [When to Add New Icons](#when-to-add-new-icons)
- [Icon Sources](#icon-sources)
- [Step-by-Step Process](#step-by-step-process)
- [File Structure](#file-structure)
- [Component Template](#component-template)
- [SVG Optimization](#svg-optimization)
- [Category Organization](#category-organization)
- [TypeScript Integration](#typescript-integration)
- [Testing Requirements](#testing-requirements)
- [Documentation Updates](#documentation-updates)
- [Complete Example](#complete-example)
- [Troubleshooting](#troubleshooting)

---

## When to Add New Icons

Before adding a new icon, evaluate its necessity:

### Evaluation Checklist

**1. Check Existing Catalog**

Search the [Icons Catalog](../icons-catalog.md) to see if a similar icon already exists:

```bash
# Search in the catalog
grep -i "search term" packages/icons/docs/icons-catalog.md
```

**2. Business Justification**

- Is this icon used in multiple places?
- Does it represent a core business concept?
- Is it part of the brand identity?
- Will other features need this icon?

**3. Consistency Check**

- Does it match the existing visual style?
- Does it fit into an existing category?
- Is the concept already represented differently?

### When to Add

✅ **Add when:**

- Icon is used in 2+ places across the application
- Represents a core Hospeda business entity (accommodation, event, attraction)
- Required for brand consistency (logos, custom graphics)
- Part of a consistent icon set (all social media icons)
- Improves user experience significantly

❌ **Don't add when:**

- Only used once in entire application
- Can be replaced with existing icon
- Too specific to one feature
- Not aligned with design system
- Temporary or experimental feature

### Decision Tree

```
Need an icon?
    │
    ├─ Check catalog → Exists? → Use existing
    │                    │
    │                    └─ Similar exists? → Use similar + adjust size/color
    │
    └─ Doesn't exist
         │
         ├─ Used 2+ times? ────┐
         ├─ Core business? ────┤
         ├─ Brand identity? ───┤→ YES to any? → Add new icon
         └─ Part of set? ──────┘
                                │
                                └─ NO to all? → Reconsider necessity
```

---

## Icon Sources

### 1. Lucide Icons (Preferred)

**Why Lucide:**

- Consistent design language
- Well-optimized SVGs
- Regular updates
- Open source (ISC License)
- Perfect for UI elements

**Website:** [lucide.dev](https://lucide.dev)

**Usage:**

```bash
# Search for icon
# Visit https://lucide.dev
# Search: "calendar"
# Copy SVG code
```

**Example Lucide SVG:**

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
  <line x1="16" y1="2" x2="16" y2="6"></line>
  <line x1="8" y1="2" x2="8" y2="6"></line>
  <line x1="3" y1="10" x2="21" y2="10"></line>
</svg>
```

### 2. Heroicons (Alternative)

**When to use:**

- Lucide doesn't have the icon
- Need a specific style variation
- Solid fill icons needed

**Website:** [heroicons.com](https://heroicons.com)

**Styles:**

- Outline (default for Hospeda)
- Solid
- Mini

**Example Heroicons SVG:**

```xml
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
</svg>
```

### 3. Custom SVG Design

**When to create custom:**

- Brand-specific elements (Hospeda logo)
- Business-specific concepts (accommodation types unique to region)
- No suitable icon exists in icon libraries
- Need exact match to design specs

**Design Tools:**

- Figma (recommended)
- Adobe Illustrator
- Inkscape (free)
- Sketch

**Design Guidelines:**

```
Canvas: 24×24px
Grid: 1px
Stroke width: 2px (outline icons)
Stroke cap: round
Stroke join: round
Corner radius: 2px
Padding: 2px from edges
```

**Export Settings:**

```
Format: SVG
Decimal precision: 2
Remove: editor data, hidden elements, default values
Optimize: paths, transforms
```

### 4. Brand-Specific Icons

**Hospeda Brand Icons:**

- Custom logo variations
- Regional symbols (Litoral identity)
- Tourism-specific graphics
- Partner/certification badges

**Source:**

- Design team deliverables
- Brand guidelines
- Marketing assets

**Approval Process:**

1. Receive asset from design team
2. Verify brand compliance
3. Optimize for web
4. Add to icons package
5. Document brand usage rules

---

## Step-by-Step Process

### Overview

```
1. Find/Design Icon
    ↓
2. Create Component File
    ↓
3. Optimize SVG
    ↓
4. Add TypeScript Types
    ↓
5. Export from Index
    ↓
6. Add to Catalog
    ↓
7. Test Component
    ↓
8. Document Usage
```

### Step 1: Find/Design Icon

**A. Search Lucide:**

```bash
# Visit https://lucide.dev
# Search for concept (e.g., "bed", "wifi", "star")
# Preview different options
# Select best match
# Copy SVG code
```

**B. Design Custom (if needed):**

```bash
# Open Figma/Illustrator
# Create 24×24px canvas
# Design icon following guidelines
# Export as optimized SVG
```

### Step 2: Create Component File

**Choose category and create file:**

```bash
# Determine category (see Category Organization below)
# Create file in appropriate category folder

# Example: Adding BedIcon to Amenities
touch packages/icons/src/amenities/BedIcon.tsx
```

**File naming convention:**

- PascalCase
- Descriptive name
- End with "Icon"
- Examples: `BedIcon.tsx`, `WifiIcon.tsx`, `StarIcon.tsx`

### Step 3: Optimize SVG

**Manual optimization checklist:**

```xml
<!-- Before -->
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bed">
  <path d="M2 4v16"/>
  <path d="M2 8h18a2 2 0 0 1 2 2v10"/>
  <path d="M2 17h20"/>
  <path d="M6 8v9"/>
</svg>

<!-- After optimization -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <path d="M2 4v16"/>
  <path d="M2 8h18a2 2 0 0 1 2 2v10"/>
  <path d="M2 17h20"/>
  <path d="M6 8v9"/>
</svg>
```

**Changes made:**

- ❌ Removed `xmlns` (React doesn't need it)
- ❌ Removed `width` and `height` (controlled by props)
- ✅ Kept `viewBox` (essential for scaling)
- ✅ Changed `stroke-width` to `strokeWidth` (React naming)
- ✅ Changed `stroke-linecap` to `strokeLinecap`
- ✅ Changed `stroke-linejoin` to `strokeLinejoin`
- ❌ Removed `class` attribute
- ✅ Kept `currentColor` (enables color customization)

### Step 4: Add TypeScript Types

**Import and use IconProps:**

```typescript
import type { IconProps } from '../types';
```

**Apply types to component:**

```typescript
export function BedIcon({ size = 24, className, ...props }: IconProps): JSX.Element {
  // Component implementation
}
```

### Step 5: Export from Index

**A. Export from category index:**

```typescript
// packages/icons/src/amenities/index.ts
export { BedIcon } from './BedIcon';
export { WifiIcon } from './WifiIcon';
// ... other amenities icons
```

**B. Export from main index:**

```typescript
// packages/icons/src/index.ts
export * from './amenities';
export * from './actions';
// ... other categories
```

### Step 6: Add to Catalog

**Update icons-catalog.md:**

```markdown
### Amenities (15 icons)

Icons for accommodation features and amenities.

| Icon | Component | Description | Use Cases |
|------|-----------|-------------|-----------|
| 🛏️ | `BedIcon` | Bed/sleeping | Room capacity, bedroom count |
| 📶 | `WifiIcon` | Wi-Fi | Internet connectivity |
```

**Include:**

- Emoji representation
- Component name
- Brief description
- Primary use cases

### Step 7: Test Component

**Create test file:**

```bash
# Create test in same location as component
touch packages/icons/src/amenities/BedIcon.test.tsx
```

**Basic test template:**

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BedIcon } from './BedIcon';

describe('BedIcon', () => {
  it('renders without crashing', () => {
    const { container } = render(<BedIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('applies size prop correctly', () => {
    const { container } = render(<BedIcon size={32} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
  });

  it('applies className correctly', () => {
    const { container } = render(<BedIcon className="custom-class" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('custom-class');
  });

  it('uses currentColor for stroke', () => {
    const { container } = render(<BedIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
  });
});
```

**Run tests:**

```bash
# From project root
cd packages/icons && pnpm test

# Or specific test
cd packages/icons && pnpm test BedIcon.test.tsx
```

### Step 8: Document Usage

**Update usage documentation:**

```markdown
<!-- In usage-reference.md -->

### BedIcon

Display bedroom/sleeping amenity.

**Props:**
- `size?: number` - Icon dimensions (default: 24)
- `className?: string` - Additional CSS classes

**Example:**

```tsx
import { BedIcon } from '@repo/icons';

function RoomFeatures() {
  return (
    <div className="flex items-center gap-2">
      <BedIcon size={20} className="text-blue-600" />
      <span>2 Bedrooms</span>
    </div>
  );
}
```
```

---

## File Structure

### Directory Organization

```
packages/icons/src/
├── actions/           # User action icons
│   ├── index.ts
│   ├── AddIcon.tsx
│   └── EditIcon.tsx
├── amenities/         # Feature/facility icons
│   ├── index.ts
│   ├── BedIcon.tsx
│   └── WifiIcon.tsx
├── entities/          # Business entity icons
│   ├── index.ts
│   └── AccommodationIcon.tsx
├── navigation/        # Navigation icons
│   ├── index.ts
│   └── HomeIcon.tsx
├── status/            # Status indicator icons
│   ├── index.ts
│   └── CheckIcon.tsx
├── social/            # Social media icons
│   ├── index.ts
│   └── FacebookIcon.tsx
├── payment/           # Payment method icons
│   ├── index.ts
│   └── CreditCardIcon.tsx
├── weather/           # Weather condition icons
│   ├── index.ts
│   └── SunIcon.tsx
├── accessibility/     # Accessibility feature icons
│   ├── index.ts
│   └── WheelchairIcon.tsx
├── time/              # Time/date related icons
│   ├── index.ts
│   └── ClockIcon.tsx
├── communication/     # Communication icons
│   ├── index.ts
│   └── MailIcon.tsx
├── ui/                # General UI icons
│   ├── index.ts
│   └── LoaderIcon.tsx
├── types.ts           # Shared TypeScript types
└── index.ts           # Main export file
```

### Naming Conventions

**Files:**

- PascalCase: `BedIcon.tsx`
- Descriptive: Clearly indicates what the icon represents
- Suffix: Always ends with "Icon"

**Components:**

```typescript
// ✅ Good
export function BedIcon() {}
export function WifiIcon() {}
export function CreditCardIcon() {}

// ❌ Bad
export function Bed() {}           // Missing "Icon" suffix
export function wifi() {}          // Not PascalCase
export function CC() {}            // Abbreviation unclear
```

---

## Component Template

### Basic Template

```typescript
import type { IconProps } from '../types';

/**
 * [Icon Name] icon component
 *
 * @description [Brief description of what the icon represents]
 * @category [Category name]
 * @example
 * ```tsx
 * import { [IconName] } from '@repo/icons';
 *
 * function Example() {
 *   return <[IconName] size={24} className="text-blue-500" />;
 * }
 * ```
 */
export function [IconName]({
  size = 24,
  className,
  ...props
}: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* SVG paths here */}
    </svg>
  );
}
```

### Real Example: BedIcon

```typescript
import type { IconProps } from '../types';

/**
 * Bed icon component
 *
 * @description Represents bedroom or sleeping accommodations
 * @category amenities
 * @example
 * ```tsx
 * import { BedIcon } from '@repo/icons';
 *
 * function RoomInfo() {
 *   return (
 *     <div className="flex items-center gap-2">
 *       <BedIcon size={20} />
 *       <span>2 Bedrooms</span>
 *     </div>
 *   );
 * }
 * ```
 */
export function BedIcon({
  size = 24,
  className,
  ...props
}: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M2 4v16" />
      <path d="M2 8h18a2 2 0 0 1 2 2v10" />
      <path d="M2 17h20" />
      <path d="M6 8v9" />
    </svg>
  );
}
```

### Template Sections Explained

**1. Import Types**

```typescript
import type { IconProps } from '../types';
```

Always import `IconProps` for consistent prop typing.

**2. JSDoc Comments**

```typescript
/**
 * [Icon Name] icon component
 *
 * @description [What it represents]
 * @category [Which category]
 * @example [Usage example]
 */
```

Provides IntelliSense documentation and examples.

**3. Function Signature**

```typescript
export function [IconName]({
  size = 24,
  className,
  ...props
}: IconProps): JSX.Element
```

- Named export (not default)
- Destructure with defaults
- Type with IconProps
- Return JSX.Element

**4. SVG Element**

```typescript
<svg
  width={size}          // Dynamic sizing
  height={size}
  viewBox="0 0 24 24"   // Standard viewBox
  fill="none"           // Usually no fill
  stroke="currentColor" // Inherits text color
  strokeWidth="2"       // Standard stroke
  strokeLinecap="round" // Rounded ends
  strokeLinejoin="round" // Rounded joins
  className={className} // Custom classes
  aria-hidden="true"    // Decorative by default
  {...props}            // Additional props
>
```

**5. SVG Paths**

```typescript
<path d="M2 4v16" />
<path d="M2 8h18a2 2 0 0 1 2 2v10" />
```

Cleaned, optimized paths from source.

---

## SVG Optimization

### Why Optimize?

**Benefits:**

- ⚡ Smaller bundle size
- 🚀 Faster load times
- 🧹 Cleaner code
- 🔧 Easier maintenance
- 📦 Better tree-shaking

### Optimization Checklist

```
□ Remove XML namespace
□ Remove width/height attributes (controlled by props)
□ Keep viewBox attribute
□ Convert attribute names to React format (camelCase)
□ Remove class attributes
□ Remove id attributes (unless necessary)
□ Remove style attributes
□ Remove title/desc elements (handled by ARIA)
□ Remove comments
□ Remove editor metadata
□ Simplify paths (combine when possible)
□ Round decimal values to 2 places
□ Use currentColor for dynamic coloring
```

### Before and After

**Before (from Lucide):**

```xml
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  class="lucide lucide-wifi"
>
  <title>WiFi Icon</title>
  <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
  <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
  <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
  <line x1="12" y1="20" x2="12.01" y2="20"></line>
</svg>
```

**After (optimized for React):**

```tsx
<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth="2"
  strokeLinecap="round"
  strokeLinejoin="round"
  className={className}
  aria-hidden="true"
  {...props}
>
  <path d="M5 12.55a11 11 0 0 1 14.08 0" />
  <path d="M1.42 9a16 16 0 0 1 21.16 0" />
  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
  <line x1="12" y1="20" x2="12.01" y2="20" />
</svg>
```

### Detailed Changes

**1. Remove XML namespace:**

```xml
<!-- Before -->
xmlns="http://www.w3.org/2000/svg"

<!-- After -->
<!-- Removed - React doesn't need it -->
```

**2. Replace static size with props:**

```xml
<!-- Before -->
width="24" height="24"

<!-- After -->
width={size} height={size}
```

**3. Convert hyphenated attributes:**

```xml
<!-- Before -->
stroke-width="2"
stroke-linecap="round"
stroke-linejoin="round"

<!-- After -->
strokeWidth="2"
strokeLinecap="round"
strokeLinejoin="round"
```

**4. Replace class with className:**

```xml
<!-- Before -->
class="lucide lucide-wifi"

<!-- After -->
className={className}
```

**5. Remove title (use ARIA instead):**

```xml
<!-- Before -->
<title>WiFi Icon</title>

<!-- After -->
<!-- Removed - use aria-label when needed -->
```

**6. Add ARIA attribute:**

```xml
<!-- Added -->
aria-hidden="true"
```

**7. Add props spread:**

```xml
<!-- Added -->
{...props}
```

### Tools for Optimization

**1. SVGO (Command Line):**

```bash
# Install
npm install -g svgo

# Optimize single file
svgo input.svg -o output.svg

# Optimize with config
svgo input.svg -o output.svg --config svgo.config.js
```

**SVGO Config (svgo.config.js):**

```javascript
module.exports = {
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          removeViewBox: false, // Keep viewBox
          removeTitle: true,
          removeDesc: true,
        },
      },
    },
    'removeXMLNS',
    'removeDimensions',
  ],
};
```

**2. Online Tools:**

- [SVGOMG](https://jakearchibald.github.io/svgomg/) - Visual SVGO interface
- [SVG Optimizer](https://www.svgoptimizer.com/)

**3. Manual Optimization:**

For simple icons, manual optimization is often fastest and most precise.

---

## Category Organization

### Categories Overview

```
1.  actions         - User actions (add, edit, delete)
2.  amenities       - Features/facilities (wifi, pool, parking)
3.  entities        - Business objects (accommodation, event)
4.  navigation      - Navigation elements (home, back, menu)
5.  status          - Status indicators (check, warning, error)
6.  social          - Social media (facebook, instagram, twitter)
7.  payment         - Payment methods (credit card, mercado pago)
8.  weather         - Weather conditions (sun, rain, cloud)
9.  accessibility   - Accessibility features (wheelchair, audio)
10. time            - Time/date related (clock, calendar)
11. communication   - Communication (mail, phone, message)
12. ui              - General UI (loader, chevron, dots)
```

### Category Selection Guide

**Decision Process:**

1. **What does the icon represent?**
   - User action → actions
   - Physical feature → amenities
   - Business concept → entities
   - Navigation element → navigation
   - State/status → status

2. **What is its primary purpose?**
   - Perform action → actions
   - Display feature → amenities
   - Represent entity → entities
   - Navigate app → navigation
   - Show status → status

3. **Where is it primarily used?**
   - Forms/buttons → actions
   - Feature lists → amenities
   - Cards/headers → entities
   - Navigation bars → navigation
   - Alerts/badges → status

### Examples by Category

**Actions:**

```typescript
// User can perform these actions
AddIcon          // Add new item
EditIcon         // Edit existing item
DeleteIcon       // Delete item
SaveIcon         // Save changes
CancelIcon       // Cancel operation
```

**Amenities:**

```typescript
// Physical features/facilities
WifiIcon         // Internet connectivity
PoolIcon         // Swimming pool
ParkingIcon      // Parking availability
AirConditioningIcon // AC availability
KitchenIcon      // Kitchen facilities
```

**Entities:**

```typescript
// Business objects/concepts
AccommodationIcon   // Lodging
EventIcon          // Tourism event
AttractionIcon     // Tourist attraction
ExperienceIcon     // Tourism experience
DestinationIcon    // Travel destination
```

**Navigation:**

```typescript
// Navigation elements
HomeIcon         // Home page
BackIcon         // Go back
MenuIcon         // Open menu
SearchIcon       // Search functionality
FilterIcon       // Filter results
```

**Status:**

```typescript
// Status/state indicators
CheckIcon        // Success/completed
WarningIcon      // Warning state
ErrorIcon        // Error state
InfoIcon         // Information
LoadingIcon      // Loading state
```

### Category Migration

**When icon doesn't fit:**

If you add an icon and later realize it's in the wrong category:

```bash
# 1. Move file
mv src/old-category/IconName.tsx src/new-category/IconName.tsx

# 2. Update old category index
# Remove export from src/old-category/index.ts

# 3. Update new category index
# Add export to src/new-category/index.ts

# 4. Update catalog documentation
# Move entry to new category in docs/icons-catalog.md

# 5. Update tests
mv src/old-category/IconName.test.tsx src/new-category/IconName.test.tsx

# 6. Update imports in consuming code (if needed)
# Import path remains same: '@repo/icons'
```

---

## TypeScript Integration

### Type Definition

**IconProps interface:**

```typescript
// packages/icons/src/types.ts

/**
 * Props for icon components
 */
export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /**
   * Icon size in pixels
   * @default 24
   */
  size?: number;

  /**
   * Additional CSS classes
   */
  className?: string;
}
```

### Using IconProps

**Import and apply:**

```typescript
import type { IconProps } from '../types';

export function MyIcon({ size = 24, className, ...props }: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      {...props}
    >
      {/* paths */}
    </svg>
  );
}
```

### Type Safety Benefits

**1. Prop Validation:**

```typescript
// ✅ Valid
<BedIcon size={24} />
<BedIcon size={32} className="text-red-500" />
<BedIcon onClick={() => {}} />

// ❌ Type errors
<BedIcon size="large" />        // Type 'string' not assignable to 'number'
<BedIcon invalid={true} />      // Property 'invalid' does not exist
```

**2. IntelliSense:**

```typescript
<BedIcon
  // IntelliSense shows:
  // - size?: number
  // - className?: string
  // - All SVG props (onClick, onMouseEnter, etc.)
/>
```

**3. Refactoring Safety:**

```typescript
// If IconProps changes, TypeScript catches all issues
// Example: Adding new required prop
export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
  color: string; // New required prop
}

// TypeScript errors appear everywhere color is missing
<BedIcon /> // ❌ Error: Property 'color' is missing
```

### Extending IconProps

**For specialized icons:**

```typescript
interface LogoIconProps extends IconProps {
  variant?: 'full' | 'symbol' | 'text';
}

export function HospedaLogoIcon({
  size = 24,
  className,
  variant = 'full',
  ...props
}: LogoIconProps): JSX.Element {
  if (variant === 'symbol') {
    return <svg>{/* symbol only */}</svg>;
  }
  if (variant === 'text') {
    return <svg>{/* text only */}</svg>;
  }
  return <svg>{/* full logo */}</svg>;
}
```

---

## Testing Requirements

### Minimum Test Coverage

Every icon component must have:

1. ✅ Render test
2. ✅ Size prop test
3. ✅ ClassName prop test
4. ✅ CurrentColor test

### Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { [IconName] } from './[IconName]';

describe('[IconName]', () => {
  it('renders without crashing', () => {
    const { container } = render(<[IconName] />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('applies size prop correctly', () => {
    const { container } = render(<[IconName] size={32} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
  });

  it('applies className correctly', () => {
    const { container } = render(<[IconName] className="custom-class" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('custom-class');
  });

  it('uses currentColor for stroke', () => {
    const { container } = render(<[IconName] />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
  });
});
```

### Running Tests

```bash
# All tests
cd packages/icons && pnpm test

# Specific test
cd packages/icons && pnpm test BedIcon.test.tsx

# Watch mode
cd packages/icons && pnpm test --watch

# Coverage
cd packages/icons && pnpm test --coverage
```

### Coverage Requirements

- **Line coverage:** 90%+
- **Branch coverage:** 90%+
- **Function coverage:** 100%
- **Statement coverage:** 90%+

---

## Documentation Updates

### Required Documentation

When adding a new icon, update these documents:

1. ✅ **Icons Catalog** (`docs/icons-catalog.md`)
2. ✅ **Usage Reference** (`docs/usage-reference.md`)
3. ✅ **Changelog** (if significant addition)

### Icons Catalog Update

**Add to appropriate category:**

```markdown
### Amenities (16 icons) <!-- Update count -->

| Icon | Component | Description | Use Cases |
|------|-----------|-------------|-----------|
| 🛏️ | `BedIcon` | Bed/sleeping | Room capacity, bedroom count |
<!-- New icon added here -->
```

### Usage Reference Update

**Add usage example:**

```markdown
### BedIcon

Display bedroom/sleeping amenity.

**Category:** amenities

**Props:**
- `size?: number` - Icon dimensions (default: 24)
- `className?: string` - Additional CSS classes

**Example:**

```tsx
import { BedIcon } from '@repo/icons';

function RoomFeatures() {
  return (
    <div className="flex items-center gap-2">
      <BedIcon size={20} className="text-blue-600" />
      <span>2 Bedrooms</span>
    </div>
  );
}
```

**Accessibility:**

```tsx
{/* Decorative */}
<BedIcon aria-hidden="true" />

{/* Semantic */}
<BedIcon aria-label="Bedroom count" />
```
```

### Changelog Update

**For significant additions:**

```markdown
## [Unreleased]

### Added
- New `BedIcon` component for bedroom/sleeping amenities
- `WifiIcon` for internet connectivity indication
```

---

## Complete Example

### Adding HospedaLogoIcon

Complete walkthrough of adding a custom brand logo icon.

#### Step 1: Design the Logo

**Design specs:**

- Canvas: 24×24px (for consistency)
- Elements: "H" symbol + "hospeda" text
- Colors: Brand colors (applied via CSS)
- Variants: Full, symbol only, text only

**Export from Figma:**

```
Export settings:
- Format: SVG
- Suffix: @1x
- Remove: "id" attribute
```

#### Step 2: Create Component File

```bash
# Decide category: ui (general brand UI element)
touch packages/icons/src/ui/HospedaLogoIcon.tsx
```

#### Step 3: Implement Component

```typescript
// packages/icons/src/ui/HospedaLogoIcon.tsx

import type { IconProps } from '../types';

export interface HospedaLogoIconProps extends IconProps {
  /**
   * Logo variant
   * @default 'full'
   */
  variant?: 'full' | 'symbol' | 'text';
}

/**
 * Hospeda brand logo icon
 *
 * @description Official Hospeda logo with variant support
 * @category ui
 * @example
 * ```tsx
 * import { HospedaLogoIcon } from '@repo/icons';
 *
 * function Header() {
 *   return (
 *     <HospedaLogoIcon
 *       size={32}
 *       variant="full"
 *       className="text-brand-primary"
 *     />
 *   );
 * }
 * ```
 */
export function HospedaLogoIcon({
  size = 24,
  className,
  variant = 'full',
  ...props
}: HospedaLogoIconProps): JSX.Element {
  if (variant === 'symbol') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        {...props}
      >
        {/* H symbol only */}
        <path d="M4 4h4v7h8V4h4v16h-4v-7H8v7H4V4z" />
      </svg>
    );
  }

  if (variant === 'text') {
    return (
      <svg
        width={size * 4}
        height={size}
        viewBox="0 0 96 24"
        fill="currentColor"
        className={className}
        {...props}
      >
        {/* Text only */}
        <text x="0" y="18" fontFamily="sans-serif" fontSize="16" fontWeight="600">
          hospeda
        </text>
      </svg>
    );
  }

  // Full logo
  return (
    <svg
      width={size * 5}
      height={size}
      viewBox="0 0 120 24"
      fill="currentColor"
      className={className}
      {...props}
    >
      {/* H symbol */}
      <path d="M0 4h4v7h8V4h4v16h-4v-7H4v7H0V4z" />

      {/* hospeda text */}
      <text x="24" y="18" fontFamily="sans-serif" fontSize="16" fontWeight="600">
        hospeda
      </text>
    </svg>
  );
}
```

#### Step 4: Create Tests

```typescript
// packages/icons/src/ui/HospedaLogoIcon.test.tsx

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HospedaLogoIcon } from './HospedaLogoIcon';

describe('HospedaLogoIcon', () => {
  it('renders full variant by default', () => {
    const { container } = render(<HospedaLogoIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '120'); // 24 * 5
  });

  it('renders symbol variant', () => {
    const { container } = render(<HospedaLogoIcon variant="symbol" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '24');
  });

  it('renders text variant', () => {
    const { container } = render(<HospedaLogoIcon variant="text" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '96'); // 24 * 4
  });

  it('applies size prop correctly', () => {
    const { container } = render(<HospedaLogoIcon size={32} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '160'); // 32 * 5
    expect(svg).toHaveAttribute('height', '32');
  });

  it('applies className correctly', () => {
    const { container } = render(
      <HospedaLogoIcon className="text-brand-primary" />
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('text-brand-primary');
  });

  it('uses currentColor for fill', () => {
    const { container } = render(<HospedaLogoIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('fill', 'currentColor');
  });
});
```

#### Step 5: Export from Indices

```typescript
// packages/icons/src/ui/index.ts
export { HospedaLogoIcon } from './HospedaLogoIcon';
export type { HospedaLogoIconProps } from './HospedaLogoIcon';
// ... other ui icons

// packages/icons/src/index.ts
export * from './ui';
// ... other categories
```

#### Step 6: Run Tests

```bash
cd packages/icons && pnpm test HospedaLogoIcon.test.tsx
```

**Expected output:**

```
✓ HospedaLogoIcon (6 tests)
  ✓ renders full variant by default
  ✓ renders symbol variant
  ✓ renders text variant
  ✓ applies size prop correctly
  ✓ applies className correctly
  ✓ uses currentColor for fill
```

#### Step 7: Update Documentation

**A. Icons Catalog:**

```markdown
### UI (8 icons) <!-- Updated count -->

| Icon | Component | Description | Use Cases |
|------|-----------|-------------|-----------|
| 🏠 | `HospedaLogoIcon` | Brand logo | Headers, splash screens |
```

**B. Usage Reference:**

```markdown
### HospedaLogoIcon

Display Hospeda brand logo with variant support.

**Category:** ui

**Props:**
- `size?: number` - Icon dimensions (default: 24)
- `className?: string` - Additional CSS classes
- `variant?: 'full' | 'symbol' | 'text'` - Logo variant (default: 'full')

**Examples:**

```tsx
import { HospedaLogoIcon } from '@repo/icons';

// Full logo
function Header() {
  return (
    <HospedaLogoIcon
      size={32}
      variant="full"
      className="text-brand-primary"
    />
  );
}

// Symbol only (mobile)
function MobileHeader() {
  return (
    <HospedaLogoIcon
      size={24}
      variant="symbol"
      className="text-brand-primary"
    />
  );
}

// Text only
function Footer() {
  return (
    <HospedaLogoIcon
      size={20}
      variant="text"
      className="text-gray-600"
    />
  );
}
```

**Accessibility:**

```tsx
<HospedaLogoIcon
  aria-label="Hospeda - Tourism Platform"
  role="img"
/>
```
```

#### Step 8: Verify in Application

**Use in web app:**

```tsx
// apps/web/src/components/Header.tsx
import { HospedaLogoIcon } from '@repo/icons';

export function Header() {
  return (
    <header className="flex items-center justify-between p-4">
      <a href="/" className="text-brand-primary hover:text-brand-dark">
        <HospedaLogoIcon
          size={32}
          variant="full"
          aria-label="Hospeda - Return to home"
        />
      </a>
      {/* ... other header content */}
    </header>
  );
}
```

**Test in browser:**

```bash
# Start dev server
pnpm dev --filter=web

# Visit http://localhost:4321
# Verify logo appears correctly
# Test responsive behavior
# Test color inheritance
```

#### Step 9: Commit Changes

```bash
# Stage files
git add packages/icons/src/ui/HospedaLogoIcon.tsx
git add packages/icons/src/ui/HospedaLogoIcon.test.tsx
git add packages/icons/src/ui/index.ts
git add packages/icons/docs/icons-catalog.md
git add packages/icons/docs/usage-reference.md

# Commit
git commit -m "feat(icons): add HospedaLogoIcon with variant support

- Add brand logo icon with full/symbol/text variants
- Include comprehensive tests (6 test cases)
- Update documentation with usage examples
- Support size and color customization"
```

---

## Troubleshooting

### Common Issues

#### 1. Icon Not Appearing

**Symptoms:**

- Component renders but no visual output
- Empty space where icon should be

**Solutions:**

```tsx
// ❌ Problem: Missing viewBox
<svg width={size} height={size}>
  <path d="..." />
</svg>

// ✅ Solution: Add viewBox
<svg width={size} height={size} viewBox="0 0 24 24">
  <path d="..." />
</svg>
```

#### 2. Icon Not Scaling

**Symptoms:**

- Size prop doesn't affect icon
- Icon always same size

**Solutions:**

```tsx
// ❌ Problem: Hardcoded dimensions
<svg width="24" height="24" viewBox="0 0 24 24">

// ✅ Solution: Use size prop
<svg width={size} height={size} viewBox="0 0 24 24">
```

#### 3. Color Not Applying

**Symptoms:**

- className with color doesn't work
- Icon has wrong color

**Solutions:**

```tsx
// ❌ Problem: Hardcoded color
<svg stroke="#000000">

// ✅ Solution: Use currentColor
<svg stroke="currentColor">
```

#### 4. TypeScript Errors

**Symptoms:**

- Type errors on props
- IntelliSense not working

**Solutions:**

```typescript
// ❌ Problem: Missing type import
export function MyIcon({ size, className }) {

// ✅ Solution: Import and use IconProps
import type { IconProps } from '../types';

export function MyIcon({ size = 24, className, ...props }: IconProps): JSX.Element {
```

#### 5. Icon Not Exported

**Symptoms:**

- Cannot import icon in consuming code
- "Module not found" error

**Solutions:**

```typescript
// ❌ Problem: Missing export in category index
// packages/icons/src/amenities/index.ts
export { WifiIcon } from './WifiIcon';
// BedIcon missing

// ✅ Solution: Add export
export { BedIcon } from './BedIcon';
export { WifiIcon } from './WifiIcon';
```

#### 6. Tests Failing

**Symptoms:**

- Test errors about missing methods
- Render failures

**Solutions:**

```typescript
// ❌ Problem: Missing test setup
import { render } from '@testing-library/react';
// Missing jsdom setup

// ✅ Solution: Ensure vitest.config.ts has jsdom
// packages/icons/vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
```

### Debugging Steps

**1. Verify File Structure:**

```bash
# Check file exists
ls -la packages/icons/src/amenities/BedIcon.tsx

# Check exports
grep "BedIcon" packages/icons/src/amenities/index.ts
grep "amenities" packages/icons/src/index.ts
```

**2. Verify Component:**

```tsx
// Minimal test
import { BedIcon } from '@repo/icons';

function Test() {
  return <BedIcon size={48} className="text-red-500" />;
}
```

**3. Check Browser Console:**

```
F12 → Console → Look for:
- Import errors
- React warnings
- TypeScript errors
```

**4. Verify Build:**

```bash
# Build package
cd packages/icons && pnpm build

# Check output
ls -la packages/icons/dist
```

**5. Clear Cache:**

```bash
# Clear all caches
pnpm clean

# Reinstall dependencies
pnpm install

# Rebuild
pnpm build
```

### Getting Help

**When stuck:**

1. ✅ Check this guide thoroughly
2. ✅ Review existing similar icons
3. ✅ Check [Usage Reference](../usage-reference.md)
4. ✅ Search issues in codebase
5. ✅ Ask team for help

**Provide when asking:**

- Icon name and category
- Complete component code
- Error messages
- Steps to reproduce
- Expected vs actual behavior

---

## Summary

### Quick Checklist

Adding a new icon:

```
□ Evaluate necessity (used 2+ times)
□ Check existing catalog
□ Find/design icon source
□ Create component file
□ Optimize SVG
□ Add TypeScript types
□ Export from category index
□ Export from main index
□ Add to catalog documentation
□ Create test file
□ Run tests (pass all)
□ Update usage reference
□ Verify in application
□ Commit changes
```

### Key Principles

1. **Consistency:** Follow established patterns
2. **Optimization:** Clean, efficient SVGs
3. **Type Safety:** Always use IconProps
4. **Testing:** 90%+ coverage required
5. **Documentation:** Update all relevant docs
6. **Accessibility:** Consider ARIA from start

### Next Steps

- **Usage patterns:** See [Usage Reference](../usage-reference.md)
- **Naming standards:** See [Naming Guide](./naming.md)
- **Optimization tips:** See [Optimization Guide](./optimization.md)
- **Accessibility:** See [Accessibility Guide](./accessibility.md)
- **Testing details:** See [Testing Guide](./testing.md)

---

*Last updated: 2025-01-05*
