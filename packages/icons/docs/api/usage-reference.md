# Usage Reference

Complete API documentation for `@repo/icons` components, including TypeScript types, props, constants, and usage patterns.

## Table of Contents

- [IconProps Interface](#iconprops-interface)
- [ICON_SIZES Constant](#icon_sizes-constant)
- [Common Usage Patterns](#common-usage-patterns)
- [Advanced Usage](#advanced-usage)
- [TypeScript Integration](#typescript-integration)
- [Framework Integration](#framework-integration)
- [Best Practices](#best-practices)

## IconProps Interface

All icon components accept the `IconProps` interface, which provides a consistent API for customization.

### Type Definition

```typescript
interface IconProps {
  /**
   * Icon size - can be a number (pixels) or predefined size
   * @default 24
   */
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  /**
   * Icon color - accepts any valid CSS color value
   * @default 'currentColor'
   */
  color?: string;

  /**
   * Additional CSS classes to apply to the icon
   */
  className?: string;

  /**
   * Accessibility label for screen readers
   */
  'aria-label'?: string;

  /**
   * Additional SVG props (onClick, onMouseOver, etc.)
   */
  [key: string]: unknown;
}
```

### Property Details

#### size

**Type:** `number | 'xs' | 'sm' | 'md' | 'lg' | 'xl'`

**Default:** `24` (pixels)

**Description:** Controls the icon's width and height. Can be specified as:

- **Number**: Exact pixel size (e.g., `16`, `24`, `32`)
- **String**: Predefined size from `ICON_SIZES` constant

**Predefined Sizes:**

- `xs`: 16px - Small UI elements, inline text
- `sm`: 20px - Compact interfaces
- `md`: 24px - Default size (recommended)
- `lg`: 28px - Larger buttons, emphasis
- `xl`: 32px - Hero sections, featured content

**Examples:**

```tsx
import { HomeIcon } from '@repo/icons';

// Numeric size
<HomeIcon size={24} />          // 24x24 pixels

// Predefined size (recommended)
<HomeIcon size="sm" />          // 20x20 pixels
<HomeIcon size="md" />          // 24x24 pixels (default)
<HomeIcon size="lg" />          // 28x28 pixels
<HomeIcon size="xl" />          // 32x32 pixels

// Custom size
<HomeIcon size={48} />          // 48x48 pixels
```

#### color

**Type:** `string`

**Default:** `'currentColor'`

**Description:** Sets the icon's color. Accepts any valid CSS color value.

**Default Behavior:** By default, icons inherit the text color from their parent element using `currentColor`. This allows icons to automatically match surrounding text.

**Supported Color Formats:**

- Named colors: `'red'`, `'blue'`, `'green'`
- Hex codes: `'#FF5733'`, `'#1a202c'`
- RGB/RGBA: `'rgb(255, 87, 51)'`, `'rgba(255, 87, 51, 0.8)'`
- HSL/HSLA: `'hsl(120, 100%, 50%)'`
- CSS variables: `'var(--color-primary)'`
- Tailwind utilities: Use `className` instead

**Examples:**

```tsx
import { StarIcon } from '@repo/icons';

// Default (inherits from parent)
<StarIcon />

// Named color
<StarIcon color="red" />

// Hex color
<StarIcon color="#FFD700" />

// RGB with transparency
<StarIcon color="rgba(255, 215, 0, 0.8)" />

// CSS variable
<StarIcon color="var(--color-primary)" />

// With parent color inheritance
<div className="text-blue-600">
  <StarIcon />  {/* Will be blue */}
</div>
```

**Best Practice:** Use `className` with Tailwind utilities for dynamic colors:

```tsx
// ✅ Recommended - Works with hover, dark mode, etc.
<StarIcon className="text-yellow-400 hover:text-yellow-500" />

// ❌ Avoid - Doesn't work with Tailwind modifiers
<StarIcon color="yellow" />
```

#### className

**Type:** `string`

**Description:** Additional CSS classes to apply to the icon's SVG element. Useful for styling with Tailwind CSS or custom CSS.

**Common Use Cases:**

- Tailwind utilities (colors, sizing, spacing)
- Hover/focus states
- Dark mode variants
- Custom CSS classes
- Animations

**Examples:**

```tsx
import { HeartIcon } from '@repo/icons';

// Tailwind color utilities
<HeartIcon className="text-red-500" />

// Size with Tailwind
<HeartIcon className="w-6 h-6" />

// Hover state
<HeartIcon className="text-gray-400 hover:text-red-500" />

// Dark mode
<HeartIcon className="text-gray-600 dark:text-gray-300" />

// Multiple utilities
<HeartIcon className="w-8 h-8 text-red-500 hover:text-red-600 transition-colors" />

// Custom CSS class
<HeartIcon className="icon-favorite" />

// Animation
<HeartIcon className="animate-pulse" />
```

**Combining with size prop:**

```tsx
// Both work together
<HomeIcon size="md" className="text-blue-600 hover:text-blue-700" />
```

#### aria-label

**Type:** `string`

**Description:** Accessibility label for screen readers. Important for icon-only buttons and links.

**When to use:**

- Icon-only buttons (no visible text)
- Icon-only links
- Interactive icons without labels
- Icons conveying important information

**When not needed:**

- Icons with adjacent visible text
- Decorative icons (use `aria-hidden="true"` instead)
- Icons inside elements with proper labels

**Examples:**

```tsx
import { SearchIcon, CloseIcon, EditIcon } from '@repo/icons';

// ✅ Icon-only button - aria-label required
<button aria-label="Search">
  <SearchIcon />
</button>

// ✅ Icon-only link - aria-label required
<a href="/settings" aria-label="Settings">
  <SettingsIcon />
</a>

// ✅ Icon with text - aria-hidden for icon
<button>
  <SearchIcon aria-hidden="true" />
  <span>Search</span>
</button>

// ✅ Decorative icon
<div>
  <StarIcon aria-hidden="true" />
  <span>4.5 stars</span>
</div>

// ❌ Missing accessibility
<button>
  <CloseIcon />  {/* Screen readers won't know what this does */}
</button>
```

#### Additional SVG Props

**Type:** `[key: string]: unknown`

**Description:** All standard SVG attributes and React event handlers are supported through prop spreading.

**Common Props:**

- **Event Handlers**: `onClick`, `onMouseEnter`, `onMouseLeave`, `onFocus`, `onBlur`
- **Styling**: `style`, `strokeWidth`, `strokeLinecap`, `strokeLinejoin`
- **Accessibility**: `role`, `aria-hidden`, `focusable`
- **IDs**: `id`, `data-*` attributes

**Examples:**

```tsx
import { DownloadIcon } from '@repo/icons';

// Event handlers
<DownloadIcon onClick={handleClick} />
<DownloadIcon onMouseEnter={handleHover} />

// Inline styles (not recommended with Tailwind)
<DownloadIcon style={{ marginRight: '8px' }} />

// Data attributes
<DownloadIcon data-testid="download-icon" />

// Custom SVG props
<DownloadIcon strokeWidth={3} />

// Multiple props
<DownloadIcon
  onClick={handleClick}
  onMouseEnter={handleHover}
  data-testid="icon"
  aria-hidden="true"
/>
```

## ICON_SIZES Constant

Predefined size mappings for consistent icon sizing across the application.

### Definition

```typescript
const ICON_SIZES = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32
} as const;
```

### Usage

```typescript
import { ICON_SIZES } from '@repo/icons';

// Access size values
const smallSize = ICON_SIZES.sm;     // 20
const defaultSize = ICON_SIZES.md;   // 24
const largeSize = ICON_SIZES.lg;     // 28

// Use in component
<HomeIcon size={ICON_SIZES.lg} />

// Use for calculations
const iconSize = ICON_SIZES.md * 1.5; // 36
```

### Size Guidelines

| Size | Pixels | Use Case | Example Context |
|------|--------|----------|-----------------|
| `xs` | 16px | Inline text, badges | Within paragraphs, status indicators |
| `sm` | 20px | Compact UI, forms | Input prefixes, compact buttons |
| `md` | 24px | Default, navigation | Standard buttons, nav items |
| `lg` | 28px | Emphasis, headings | Section headers, featured buttons |
| `xl` | 32px | Hero, empty states | Page headers, large buttons |

### Responsive Sizing

```tsx
// Tailwind responsive sizing
<HomeIcon className="w-4 h-4 md:w-6 md:h-6 lg:w-8 lg:h-8" />

// Or with size prop and responsive logic
const iconSize = useMediaQuery('(min-width: 768px)') ? 'lg' : 'md';
<HomeIcon size={iconSize} />
```

## Common Usage Patterns

### Basic Usage

```tsx
import { HomeIcon } from '@repo/icons';

// Simplest form - uses all defaults
<HomeIcon />

// With size
<HomeIcon size="lg" />

// With color
<HomeIcon color="#3B82F6" />

// With Tailwind classes
<HomeIcon className="text-blue-600" />
```

### Icon in Button

```tsx
import { SaveIcon, CancelIcon } from '@repo/icons';

// Icon with text
<button className="btn-primary">
  <SaveIcon size="sm" className="mr-2" />
  Save Changes
</button>

// Icon-only button
<button
  className="btn-icon"
  aria-label="Delete"
>
  <DeleteIcon size="md" />
</button>

// Button with icon on right
<button className="btn-secondary">
  Download Report
  <DownloadIcon size="sm" className="ml-2" />
</button>
```

### Icon in Link

```tsx
import { ExternalLinkIcon, ArrowRightIcon } from '@repo/icons';

// Link with icon
<a href="/docs" className="flex items-center gap-2">
  Documentation
  <ExternalLinkIcon size="sm" />
</a>

// Navigation link
<nav>
  <a href="/" className="nav-link">
    <HomeIcon size="md" />
    <span>Home</span>
  </a>
</nav>
```

### Icon with Hover Effects

```tsx
import { HeartIcon } from '@repo/icons';

// Color change on hover
<button className="group">
  <HeartIcon className="text-gray-400 group-hover:text-red-500 transition-colors" />
</button>

// Size change on hover
<button className="group">
  <StarIcon className="group-hover:scale-110 transition-transform" />
</button>

// Fill on hover (requires custom styling)
<button className="group">
  <HeartIcon className="text-red-500 group-hover:fill-red-500" />
</button>
```

### Icon in List Items

```tsx
import { CheckIcon, XIcon } from '@repo/icons';

// Feature list
<ul className="space-y-2">
  <li className="flex items-center gap-2">
    <CheckIcon size="sm" className="text-green-600" />
    <span>Free WiFi</span>
  </li>
  <li className="flex items-center gap-2">
    <CheckIcon size="sm" className="text-green-600" />
    <span>Free Parking</span>
  </li>
  <li className="flex items-center gap-2">
    <XIcon size="sm" className="text-red-600" />
    <span>No Pets</span>
  </li>
</ul>
```

### Icon in Form Input

```tsx
import { SearchIcon, LocationIcon } from '@repo/icons';

// Input with prefix icon
<div className="relative">
  <SearchIcon
    size="sm"
    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
  />
  <input
    type="text"
    placeholder="Search..."
    className="pl-10 pr-4 py-2"
  />
</div>

// Input with suffix icon (clickable)
<div className="relative">
  <input type="text" className="pr-10" />
  <button
    className="absolute right-3 top-1/2 -translate-y-1/2"
    aria-label="Clear"
  >
    <CloseIcon size="sm" className="text-gray-400 hover:text-gray-600" />
  </button>
</div>
```

### Icon in Card

```tsx
import { PoolIcon, WifiIcon, ParkingIcon } from '@repo/icons';

// Amenity card
<div className="card">
  <div className="flex items-center gap-3">
    <div className="icon-wrapper">
      <PoolIcon size="lg" className="text-blue-600" />
    </div>
    <div>
      <h3>Swimming Pool</h3>
      <p>Heated outdoor pool</p>
    </div>
  </div>
</div>

// Icon grid
<div className="grid grid-cols-3 gap-4">
  <div className="text-center">
    <WifiIcon size="xl" className="mx-auto text-primary" />
    <p className="mt-2">Free WiFi</p>
  </div>
  <div className="text-center">
    <PoolIcon size="xl" className="mx-auto text-blue-500" />
    <p className="mt-2">Pool</p>
  </div>
  <div className="text-center">
    <ParkingIcon size="xl" className="mx-auto text-gray-700" />
    <p className="mt-2">Parking</p>
  </div>
</div>
```

### Icon in Badge

```tsx
import { AlertIcon, CheckIcon } from '@repo/icons';

// Status badge
<span className="badge badge-success">
  <CheckIcon size="xs" />
  Available
</span>

<span className="badge badge-warning">
  <AlertIcon size="xs" />
  Limited
</span>
```

### Icon in Alert/Notification

```tsx
import { InfoIcon, WarningIcon, ErrorIcon } from '@repo/icons';

// Alert component
<div className="alert alert-info">
  <InfoIcon size="md" className="flex-shrink-0" />
  <div>
    <h4>Information</h4>
    <p>Your booking has been confirmed.</p>
  </div>
</div>

// Toast notification
<div className="toast">
  <WarningIcon size="sm" className="text-yellow-600" />
  <span>Session will expire in 5 minutes</span>
</div>
```

## Advanced Usage

### Dynamic Icon Selection

```tsx
import { StarIcon, HeartIcon, BookmarkIcon } from '@repo/icons';

// Icon mapping
const iconMap = {
  star: StarIcon,
  heart: HeartIcon,
  bookmark: BookmarkIcon
} as const;

// Dynamic component
function DynamicIcon({ type, ...props }) {
  const Icon = iconMap[type];
  return Icon ? <Icon {...props} /> : null;
}

// Usage
<DynamicIcon type="star" size="md" className="text-yellow-400" />
```

### Icon with State

```tsx
import { HeartIcon } from '@repo/icons';
import { useState } from 'react';

function FavoriteButton({ itemId }: { itemId: string }) {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <button
      onClick={() => setIsFavorite(!isFavorite)}
      className="group"
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <HeartIcon
        size="lg"
        className={
          isFavorite
            ? 'text-red-500 fill-red-500'
            : 'text-gray-400 group-hover:text-red-400'
        }
      />
    </button>
  );
}
```

### Icon with Tooltip

```tsx
import { InfoIcon } from '@repo/icons';

function IconWithTooltip() {
  return (
    <div className="relative group">
      <InfoIcon
        size="sm"
        className="text-gray-400 hover:text-gray-600 cursor-help"
      />
      <div className="tooltip opacity-0 group-hover:opacity-100">
        Additional information about this feature
      </div>
    </div>
  );
}
```

### Animated Icons

```tsx
import { LoaderIcon, RefreshIcon } from '@repo/icons';

// Spinner
<LoaderIcon className="animate-spin" />

// Refresh with animation
<button onClick={handleRefresh}>
  <RefreshIcon
    className={`transition-transform ${isRefreshing ? 'animate-spin' : ''}`}
  />
</button>

// Pulse effect
<NotificationIcon className="animate-pulse text-red-500" />
```

### Icon Composition

```tsx
import { StarIcon, CheckIcon } from '@repo/icons';

// Icon with badge
<div className="relative inline-block">
  <StarIcon size="lg" className="text-yellow-400" />
  <div className="absolute -top-1 -right-1">
    <CheckIcon size="xs" className="text-green-600 bg-white rounded-full" />
  </div>
</div>

// Icon stack
<div className="relative w-8 h-8">
  <UserIcon className="absolute" size="lg" />
  <CheckIcon
    className="absolute bottom-0 right-0 text-green-600"
    size="xs"
  />
</div>
```

### Conditional Rendering

```tsx
import { CheckIcon, XIcon, MinusIcon } from '@repo/icons';

function StatusIcon({ status }: { status: 'yes' | 'no' | 'maybe' }) {
  const icons = {
    yes: <CheckIcon className="text-green-600" />,
    no: <XIcon className="text-red-600" />,
    maybe: <MinusIcon className="text-gray-400" />
  };

  return icons[status] || null;
}
```

### Responsive Icons

```tsx
import { MenuIcon, SearchIcon } from '@repo/icons';

// Show different icons on mobile vs desktop
function ResponsiveNav() {
  return (
    <nav>
      {/* Mobile */}
      <div className="md:hidden">
        <MenuIcon size="md" />
      </div>

      {/* Desktop */}
      <div className="hidden md:flex gap-4">
        <SearchIcon size="md" />
        <UserIcon size="md" />
        <SettingsIcon size="md" />
      </div>
    </nav>
  );
}

// Responsive sizing
<HomeIcon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8" />
```

### Icon as Background

```tsx
// SVG as inline background (advanced)
<div
  className="relative"
  style={{
    backgroundImage: `url("data:image/svg+xml,...")`,
    backgroundSize: '24px 24px'
  }}
>
  Content here
</div>
```

## TypeScript Integration

### Component with Icon Props

```typescript
import type { IconProps } from '@repo/icons';
import { HomeIcon } from '@repo/icons';

interface NavItemProps {
  icon: React.ComponentType<IconProps>;
  label: string;
  href: string;
}

function NavItem({ icon: Icon, label, href }: NavItemProps) {
  return (
    <a href={href} className="nav-item">
      <Icon size="md" className="text-gray-600" />
      <span>{label}</span>
    </a>
  );
}

// Usage
<NavItem icon={HomeIcon} label="Home" href="/" />
```

### Icon Map Type

```typescript
import type { FC } from 'react';
import type { IconProps } from '@repo/icons';
import { StarIcon, HeartIcon, BookmarkIcon } from '@repo/icons';

type IconType = 'star' | 'heart' | 'bookmark';

const iconMap: Record<IconType, FC<IconProps>> = {
  star: StarIcon,
  heart: HeartIcon,
  bookmark: BookmarkIcon
};

function getIcon(type: IconType) {
  return iconMap[type];
}
```

### Generic Icon Component

```typescript
import type { FC } from 'react';
import type { IconProps } from '@repo/icons';

interface IconWrapperProps extends IconProps {
  icon: FC<IconProps>;
  badge?: number;
}

function IconWrapper({ icon: Icon, badge, ...iconProps }: IconWrapperProps) {
  return (
    <div className="relative inline-block">
      <Icon {...iconProps} />
      {badge && (
        <span className="badge">{badge}</span>
      )}
    </div>
  );
}
```

### Icon Array Type

```typescript
import type { FC } from 'react';
import type { IconProps } from '@repo/icons';
import { WifiIcon, PoolIcon, ParkingIcon } from '@repo/icons';

interface Amenity {
  icon: FC<IconProps>;
  name: string;
  available: boolean;
}

const amenities: Amenity[] = [
  { icon: WifiIcon, name: 'WiFi', available: true },
  { icon: PoolIcon, name: 'Pool', available: true },
  { icon: ParkingIcon, name: 'Parking', available: false }
];
```

## Framework Integration

### React

```tsx
import { HomeIcon } from '@repo/icons';

function Component() {
  return <HomeIcon size="md" className="text-primary" />;
}
```

### Astro

Icons work seamlessly in Astro without hydration:

```astro
---
import { HomeIcon, SearchIcon } from '@repo/icons';
---

<nav>
  <a href="/">
    <HomeIcon size="md" />
    <span>Home</span>
  </a>
  <button>
    <SearchIcon size="md" />
  </button>
</nav>
```

### Next.js (App Router)

```tsx
// app/components/Navigation.tsx
'use client';

import { HomeIcon, UserIcon } from '@repo/icons';
import { usePathname } from 'next/navigation';

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav>
      <a
        href="/"
        className={pathname === '/' ? 'active' : ''}
      >
        <HomeIcon size="md" />
        Home
      </a>
    </nav>
  );
}
```

### TanStack Start

```tsx
import { HomeIcon } from '@repo/icons';
import { Link } from '@tanstack/react-router';

function Navigation() {
  return (
    <nav>
      <Link to="/">
        <HomeIcon size="md" />
        Home
      </Link>
    </nav>
  );
}
```

## Best Practices

### 1. Use Semantic Names

```tsx
// ✅ Good - Semantic naming
import { DeleteIcon, EditIcon, SaveIcon } from '@repo/icons';

// ❌ Avoid - Implementation-focused naming
import { TrashIcon, PencilIcon, FloppyDiskIcon } from '@repo/icons';
```

### 2. Consistent Sizing

```tsx
// ✅ Good - Use predefined sizes
<HomeIcon size="md" />
<SearchIcon size="md" />
<UserIcon size="md" />

// ❌ Avoid - Inconsistent custom sizes
<HomeIcon size={23} />
<SearchIcon size={25} />
<UserIcon size={22} />
```

### 3. Proper Color Usage

```tsx
// ✅ Good - Use currentColor or Tailwind
<div className="text-blue-600">
  <HomeIcon />  {/* Inherits blue color */}
</div>
<StarIcon className="text-yellow-400" />

// ❌ Avoid - Hardcoded colors that don't respond to themes
<HomeIcon color="#0000FF" />
```

### 4. Accessibility

```tsx
// ✅ Good - Icon with text or aria-label
<button aria-label="Close">
  <CloseIcon />
</button>

<button>
  <SaveIcon aria-hidden="true" />
  <span>Save</span>
</button>

// ❌ Avoid - Icon-only without label
<button>
  <CloseIcon />  {/* Screen readers don't know what this is */}
</button>
```

### 5. Performance

```tsx
// ✅ Good - Import only what you need
import { HomeIcon, SearchIcon } from '@repo/icons';

// ❌ Avoid - Importing entire package (if applicable)
import * as Icons from '@repo/icons';
```

### 6. Reusable Components

```tsx
// ✅ Good - Create reusable icon button
function IconButton({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} aria-label={label}>
      <Icon size="md" />
    </button>
  );
}

// Usage
<IconButton icon={SaveIcon} label="Save" onClick={handleSave} />
<IconButton icon={DeleteIcon} label="Delete" onClick={handleDelete} />
```

### 7. Responsive Design

```tsx
// ✅ Good - Responsive sizing
<HomeIcon className="w-5 h-5 md:w-6 md:h-6" />

// ✅ Good - Conditional rendering
{isMobile ? (
  <MenuIcon size="sm" />
) : (
  <div className="flex gap-4">
    <HomeIcon size="md" />
    <SearchIcon size="md" />
  </div>
)}
```

### 8. Dark Mode Support

```tsx
// ✅ Good - Dark mode aware
<HomeIcon className="text-gray-900 dark:text-gray-100" />

// ✅ Good - Theme-based colors
<StarIcon className="text-primary" />  {/* Uses CSS variable */}
```

### 9. Loading States

```tsx
// ✅ Good - Clear loading indication
<button disabled={isLoading}>
  {isLoading ? (
    <LoaderIcon className="animate-spin" />
  ) : (
    <SaveIcon />
  )}
  {isLoading ? 'Saving...' : 'Save'}
</button>
```

### 10. Icon Organization

```tsx
// ✅ Good - Organize imports by category
// Actions
import { SaveIcon, DeleteIcon, EditIcon } from '@repo/icons';

// Navigation
import { HomeIcon, SearchIcon, MenuIcon } from '@repo/icons';

// Amenities
import { WifiIcon, PoolIcon, ParkingIcon } from '@repo/icons';
```

## Related Documentation

- **[Icons Catalog](./icons-catalog.md)** - Complete list of all 386 available icons
- **[Usage Guide](../guides/usage-guide.md)** - Practical usage patterns and examples
- **[Integration Guide](../guides/integration-guide.md)** - Framework-specific integration
- **[Accessibility Guide](../guides/accessibility-guide.md)** - Accessibility best practices
- **[Performance Guide](../guides/performance-guide.md)** - Performance optimization

## Quick Reference

### Common Patterns Quick Copy

```tsx
// Basic icon
<HomeIcon />

// Sized icon
<HomeIcon size="lg" />

// Colored icon (Tailwind)
<HomeIcon className="text-blue-600" />

// Icon button
<button aria-label="Close">
  <CloseIcon size="md" />
</button>

// Icon with text
<button>
  <SaveIcon size="sm" className="mr-2" />
  Save
</button>

// Hover effect
<HeartIcon className="text-gray-400 hover:text-red-500 transition-colors" />

// Loading spinner
<LoaderIcon className="animate-spin" />

// Input prefix
<div className="relative">
  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2" size="sm" />
  <input className="pl-10" />
</div>
```

---

**Need more examples?** Check the [Usage Guide](../guides/usage-guide.md) for real-world patterns and the [Icons Catalog](./icons-catalog.md) for all available icons.
