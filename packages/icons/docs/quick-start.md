# Quick Start Guide

Get up and running with @repo/icons in 5 minutes. This guide covers the essential concepts and common patterns you'll use daily.

## What You'll Learn

- How to import and use icons
- Icon props (size, color, className)
- Predefined sizes (xs, sm, md, lg, xl)
- Tailwind CSS integration
- Basic accessibility with aria-label
- Finding icons in the catalog

## Prerequisites

The @repo/icons package is part of the Hospeda monorepo. It's automatically installed when you run `pnpm install` from the project root.

## 1. Your First Icon

### Basic Usage

The simplest way to use an icon:

```tsx
import { WifiIcon } from '@repo/icons';

export function AmenityBadge() {
  return <WifiIcon />;
}
```

This renders a WiFi icon with:

- Default size: 24px (md)
- Default color: currentColor (inherits from parent)
- Viewbox: 0 0 24 24

### Multiple Icons

Import and use multiple icons:

```tsx
import { WifiIcon, PoolIcon, ParkingIcon } from '@repo/icons';

export function AmenitiesList() {
  return (
    <div className="flex gap-4">
      <WifiIcon />
      <PoolIcon />
      <ParkingIcon />
    </div>
  );
}
```

## 2. Icon Props

All icons accept the same props through the `IconProps` interface:

### Size Prop

Control icon size with predefined sizes or custom pixels:

```tsx
import { SearchIcon } from '@repo/icons';

// Predefined sizes (recommended)
<SearchIcon size="xs" />  {/* 16px */}
<SearchIcon size="sm" />  {/* 20px */}
<SearchIcon size="md" />  {/* 24px - default */}
<SearchIcon size="lg" />  {/* 28px */}
<SearchIcon size="xl" />  {/* 32px */}

// Custom pixel values
<SearchIcon size={40} />
<SearchIcon size={18} />
```

**Best Practice:** Use predefined sizes for design system consistency.

### Color Prop

Change icon color with any valid CSS color:

```tsx
import { HeartIcon } from '@repo/icons';

// Hex colors
<HeartIcon color="#3B82F6" />
<HeartIcon color="#EF4444" />

// RGB/RGBA
<HeartIcon color="rgb(59, 130, 246)" />
<HeartIcon color="rgba(239, 68, 68, 0.5)" />

// Named colors
<HeartIcon color="red" />
<HeartIcon color="currentColor" />  {/* Default - inherits parent */}
```

**Best Practice:** Use `currentColor` (default) to inherit parent text color.

### className Prop

Add CSS classes for styling:

```tsx
import { UserIcon } from '@repo/icons';

// Single class
<UserIcon className="text-blue-500" />

// Multiple classes
<UserIcon className="text-blue-500 hover:text-blue-600 transition-colors" />

// Tailwind utilities
<UserIcon className="w-6 h-6 text-gray-700" />
```

**Note:** className applies to the `<svg>` element.

### aria-label Prop

Add accessibility labels for screen readers:

```tsx
import { CloseIcon } from '@repo/icons';

// With aria-label
<CloseIcon aria-label="Close dialog" />

// Icon-only button (accessible)
<button aria-label="Close">
  <CloseIcon aria-label="Close" />
</button>
```

**Best Practice:** Always add aria-label for icon-only interactive elements.

### Combined Props

Use multiple props together:

```tsx
import { EditIcon } from '@repo/icons';

<EditIcon
  size="lg"
  color="#3B82F6"
  className="hover:scale-110 transition-transform"
  aria-label="Edit item"
/>
```

## 3. Predefined Sizes

The `ICON_SIZES` constant provides five standard sizes:

```tsx
import { ICON_SIZES } from '@repo/icons';

// Available sizes
const sizes = {
  xs: 16,    // Extra small - inline text, small UI
  sm: 20,    // Small - buttons, form inputs
  md: 24,    // Medium (default) - navigation, standard UI
  lg: 28,    // Large - featured buttons, headers
  xl: 32,    // Extra large - hero sections, empty states
};

// Usage
<WifiIcon size="xs" />  {/* 16px */}
<WifiIcon size="sm" />  {/* 20px */}
<WifiIcon size="md" />  {/* 24px - default */}
<WifiIcon size="lg" />  {/* 28px */}
<WifiIcon size="xl" />  {/* 32px */}
```

### Size Guidelines

| Size | Pixels | Use Cases | Examples |
|------|--------|-----------|----------|
| xs | 16px | Inline text, table cells, small badges | Status indicators, inline icons |
| sm | 20px | Buttons, form inputs, list items | Action buttons, form icons |
| md | 24px | Navigation, standard UI, default | Nav menu, toolbars, cards |
| lg | 28px | Featured buttons, section headers | Primary actions, hero buttons |
| xl | 32px | Hero sections, empty states, large UI | Landing pages, placeholders |

## 4. Tailwind CSS Integration

Icons work seamlessly with Tailwind CSS:

### Text Color

```tsx
import { WifiIcon } from '@repo/icons';

// Text color utilities
<WifiIcon className="text-blue-500" />
<WifiIcon className="text-gray-700" />
<WifiIcon className="text-red-600" />

// Hover states
<WifiIcon className="text-gray-500 hover:text-blue-600" />

// Dark mode
<WifiIcon className="text-gray-700 dark:text-gray-300" />
```

**Note:** Icons use `stroke` not `fill`, so `text-*` classes control the stroke color.

### Sizing with Tailwind

```tsx
// Using className for size (alternative to size prop)
<WifiIcon className="w-4 h-4" />   {/* 16px */}
<WifiIcon className="w-5 h-5" />   {/* 20px */}
<WifiIcon className="w-6 h-6" />   {/* 24px */}
<WifiIcon className="w-7 h-7" />   {/* 28px */}
<WifiIcon className="w-8 h-8" />   {/* 32px */}

// Best practice: use size prop instead
<WifiIcon size="sm" />  {/* Preferred */}
```

### Transitions and Animations

```tsx
import { HeartIcon } from '@repo/icons';

// Smooth transitions
<HeartIcon className="transition-colors duration-200" />

// Scale on hover
<HeartIcon className="hover:scale-110 transition-transform" />

// Rotate animation
<HeartIcon className="animate-spin" />

// Combined effects
<HeartIcon className="text-gray-500 hover:text-red-500 hover:scale-110 transition-all duration-200" />
```

### Layout Utilities

```tsx
import { SearchIcon, UserIcon, MenuIcon } from '@repo/icons';

// Flexbox
<div className="flex items-center gap-2">
  <SearchIcon size="sm" />
  <span>Search</span>
</div>

// Grid
<div className="grid grid-cols-3 gap-4">
  <SearchIcon />
  <UserIcon />
  <MenuIcon />
</div>

// Spacing
<div className="p-4">
  <SearchIcon className="mb-2" />
  <span>Search</span>
</div>
```

## 5. Common Patterns

### Navigation Menu

```tsx
import { HomeIcon, SearchIcon, UserIcon, MenuIcon } from '@repo/icons';

export function Navigation() {
  return (
    <nav className="flex items-center gap-6">
      <a href="/" className="flex items-center gap-2 text-gray-700 hover:text-blue-600">
        <HomeIcon size="md" />
        <span>Home</span>
      </a>
      <a href="/search" className="flex items-center gap-2 text-gray-700 hover:text-blue-600">
        <SearchIcon size="md" />
        <span>Search</span>
      </a>
      <a href="/profile" className="flex items-center gap-2 text-gray-700 hover:text-blue-600">
        <UserIcon size="md" />
        <span>Profile</span>
      </a>
    </nav>
  );
}
```

### Icon-Only Buttons

```tsx
import { EditIcon, DeleteIcon, SaveIcon } from '@repo/icons';

export function ActionButtons() {
  return (
    <div className="flex gap-2">
      <button
        aria-label="Edit"
        className="p-2 rounded hover:bg-blue-50 transition-colors"
      >
        <EditIcon size="sm" className="text-blue-600" />
      </button>
      <button
        aria-label="Delete"
        className="p-2 rounded hover:bg-red-50 transition-colors"
      >
        <DeleteIcon size="sm" className="text-red-600" />
      </button>
      <button
        aria-label="Save"
        className="p-2 rounded hover:bg-green-50 transition-colors"
      >
        <SaveIcon size="sm" className="text-green-600" />
      </button>
    </div>
  );
}
```

### Buttons with Icons and Text

```tsx
import { AddIcon, DownloadIcon, ShareIcon } from '@repo/icons';

export function ButtonExamples() {
  return (
    <div className="flex flex-col gap-4">
      {/* Primary button */}
      <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        <AddIcon size="sm" />
        <span>Add Item</span>
      </button>

      {/* Secondary button */}
      <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
        <DownloadIcon size="sm" />
        <span>Download</span>
      </button>

      {/* Outline button */}
      <button className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50">
        <ShareIcon size="sm" />
        <span>Share</span>
      </button>
    </div>
  );
}
```

### Amenity Grid

```tsx
import { WifiIcon, PoolIcon, ParkingIcon, AirConditioningIcon, KitchenIcon, GymIcon } from '@repo/icons';

export function AmenityGrid() {
  const amenities = [
    { icon: <WifiIcon size="lg" />, label: 'WiFi' },
    { icon: <PoolIcon size="lg" />, label: 'Pool' },
    { icon: <ParkingIcon size="lg" />, label: 'Parking' },
    { icon: <AirConditioningIcon size="lg" />, label: 'A/C' },
    { icon: <KitchenIcon size="lg" />, label: 'Kitchen' },
    { icon: <GymIcon size="lg" />, label: 'Gym' },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {amenities.map(({ icon, label }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-2 p-4 border rounded hover:border-blue-500 transition-colors"
        >
          <div className="text-blue-600">{icon}</div>
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
      ))}
    </div>
  );
}
```

### Status Badge

```tsx
import { AvailableIcon, ConfirmedIcon, PendingIcon, CancelledIcon } from '@repo/icons';

export function BookingStatus({ status }: { status: 'available' | 'confirmed' | 'pending' | 'cancelled' }) {
  const config = {
    available: {
      icon: <AvailableIcon size="sm" />,
      text: 'Available',
      className: 'bg-green-100 text-green-800',
    },
    confirmed: {
      icon: <ConfirmedIcon size="sm" />,
      text: 'Confirmed',
      className: 'bg-blue-100 text-blue-800',
    },
    pending: {
      icon: <PendingIcon size="sm" />,
      text: 'Pending',
      className: 'bg-yellow-100 text-yellow-800',
    },
    cancelled: {
      icon: <CancelledIcon size="sm" />,
      text: 'Cancelled',
      className: 'bg-red-100 text-red-800',
    },
  };

  const { icon, text, className } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${className}`}>
      {icon}
      <span>{text}</span>
    </span>
  );
}
```

## 6. Finding Icons

### Browse the Complete Catalog

See all 386 icons organized by category in the [Icons Catalog](./api/icons-catalog.md).

### Search by Category

Icons are organized into 12 categories:

1. **Actions** (15 icons): AddIcon, EditIcon, DeleteIcon, SaveIcon, CancelIcon, etc.
2. **Admin** (16 icons): DashboardIcon, AnalyticsIcon, UsersManagementIcon, etc.
3. **Amenities** (98 icons): WifiIcon, PoolIcon, ParkingIcon, AirConditioningIcon, etc.
4. **Attractions** (92 icons): BeachIcon, MuseumIcon, CathedralIcon, ThermalSpaIcon, etc.
5. **Booking** (16 icons): AvailableIcon, ConfirmedIcon, CheckInIcon, CheckOutIcon, etc.
6. **Communication** (7 icons): PhoneIcon, EmailIcon, ChatIcon, WhatsappIcon, etc.
7. **Entities** (13 icons): AccommodationIcon, EventIcon, DestinationIcon, etc.
8. **Features** (70 icons): PetFriendlyIcon, EcologicalIcon, PanoramicViewIcon, etc.
9. **Navigation** (51 icons): HomeIcon, SearchIcon, MenuIcon, CloseIcon, BackIcon, etc.
10. **Social** (4 icons): FacebookIcon, InstagramIcon, WhatsappIcon, WebIcon
11. **System** (51 icons): UserIcon, SettingsIcon, NotificationIcon, LogoutIcon, etc.
12. **Utilities** (17 icons): CalendarIcon, ClockIcon, LocationIcon, MapIcon, etc.

### Icon Naming Convention

Icons follow a consistent naming pattern:

- **Descriptive name** + **Icon suffix**
- PascalCase (e.g., `WifiIcon`, not `wifiIcon`)
- Semantic names (e.g., `SearchIcon` not `MagnifyingGlassIcon`)
- Business-focused (e.g., `AccommodationIcon` not `BuildingIcon`)

Examples:

```tsx
// ✅ Good - semantic, business-focused
import { SearchIcon, UserIcon, AccommodationIcon } from '@repo/icons';

// ❌ Bad - generic, technical names
import { MagnifyingGlassIcon, PersonIcon, HouseIcon } from '@repo/icons';
```

## 7. Accessibility Basics

### Icon with Text (Icon is Decorative)

When icons accompany text, mark them as decorative with `aria-hidden`:

```tsx
import { WifiIcon } from '@repo/icons';

<button>
  <WifiIcon aria-hidden="true" />
  <span>Connect to WiFi</span>
</button>
```

Screen readers will read: "Connect to WiFi" (icon is ignored).

### Icon-Only Button (Icon is Semantic)

When icons are standalone, add `aria-label` to both button and icon:

```tsx
import { CloseIcon } from '@repo/icons';

<button aria-label="Close dialog">
  <CloseIcon aria-label="Close" />
</button>
```

Screen readers will read: "Close dialog" or "Close".

### Icon in Link

```tsx
import { HomeIcon } from '@repo/icons';

// With text
<a href="/">
  <HomeIcon aria-hidden="true" />
  <span>Home</span>
</a>

// Icon-only
<a href="/" aria-label="Go to home page">
  <HomeIcon aria-label="Home" />
</a>
```

### Status Indicators

```tsx
import { ConfirmedIcon } from '@repo/icons';

// Semantic icon with status text
<div className="flex items-center gap-2">
  <ConfirmedIcon aria-hidden="true" />
  <span>Booking Confirmed</span>
</div>

// Icon-only status (needs aria-label)
<div aria-label="Booking confirmed">
  <ConfirmedIcon aria-label="Confirmed" />
</div>
```

## 8. TypeScript Support

All icons are fully typed with TypeScript:

### IconProps Interface

```tsx
import { type IconProps } from '@repo/icons';

interface IconProps {
  /** Icon size - predefined size key or pixel value */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

  /** Icon color - any valid CSS color value */
  color?: string;

  /** Additional CSS classes */
  className?: string;

  /** Accessibility label */
  'aria-label'?: string;

  /** Additional SVG props (onClick, onMouseOver, etc.) */
  [key: string]: unknown;
}
```

### Using IconProps in Components

```tsx
import { WifiIcon, type IconProps } from '@repo/icons';

// Wrapper component with IconProps
export function CustomWifiIcon(props: IconProps) {
  return <WifiIcon {...props} />;
}

// Partial IconProps
export function FixedSizeIcon({ className, 'aria-label': ariaLabel }: Pick<IconProps, 'className' | 'aria-label'>) {
  return <WifiIcon size="md" className={className} aria-label={ariaLabel} />;
}
```

### Type Inference

TypeScript will infer types automatically:

```tsx
import { SearchIcon } from '@repo/icons';

// TypeScript knows these are valid
<SearchIcon size="md" />           {/* ✅ */}
<SearchIcon size={24} />            {/* ✅ */}
<SearchIcon color="#3B82F6" />      {/* ✅ */}
<SearchIcon className="text-blue-500" /> {/* ✅ */}

// TypeScript will error on invalid props
<SearchIcon size="invalid" />       {/* ❌ Type error */}
<SearchIcon size="24" />            {/* ❌ Type error - should be number or predefined size */}
```

## 9. Framework Examples

### React

```tsx
import { WifiIcon, PoolIcon } from '@repo/icons';

export function AmenityList() {
  const amenities = ['wifi', 'pool'];

  return (
    <div className="flex gap-4">
      {amenities.includes('wifi') && <WifiIcon size="md" />}
      {amenities.includes('pool') && <PoolIcon size="md" />}
    </div>
  );
}
```

### Astro

```astro
---
import { WifiIcon, PoolIcon } from '@repo/icons';

const amenities = ['wifi', 'pool'];
---

<!-- Renders as static HTML - no JavaScript -->
<div class="flex gap-4">
  {amenities.includes('wifi') && <WifiIcon size="md" />}
  {amenities.includes('pool') && <PoolIcon size="md" />}
</div>
```

**Note:** Icons work identically in React and Astro - no hydration needed!

## 10. Common Mistakes

### ❌ Using String Numbers for Size

```tsx
// ❌ Wrong - string number
<WifiIcon size="24" />

// ✅ Correct - number or predefined size
<WifiIcon size={24} />
<WifiIcon size="md" />
```

### ❌ Missing aria-label on Icon-Only Buttons

```tsx
// ❌ Wrong - no accessibility label
<button>
  <CloseIcon />
</button>

// ✅ Correct - with aria-label
<button aria-label="Close">
  <CloseIcon aria-label="Close" />
</button>
```

### ❌ Using fill Instead of stroke

```tsx
// ❌ Wrong - icons use stroke, not fill
<WifiIcon fill="#3B82F6" />

// ✅ Correct - use color prop or className
<WifiIcon color="#3B82F6" />
<WifiIcon className="text-blue-500" />
```

### ❌ Inconsistent Sizes in Same Context

```tsx
// ❌ Wrong - inconsistent sizes
<nav>
  <HomeIcon size="sm" />
  <SearchIcon size="lg" />
  <UserIcon size="md" />
</nav>

// ✅ Correct - consistent sizes
<nav>
  <HomeIcon size="md" />
  <SearchIcon size="md" />
  <UserIcon size="md" />
</nav>
```

### ❌ Redundant Color Specification

```tsx
// ❌ Wrong - redundant color
<div className="text-blue-600">
  <WifiIcon color="#3B82F6" />
</div>

// ✅ Correct - inherit parent color
<div className="text-blue-600">
  <WifiIcon />  {/* Inherits blue-600 via currentColor */}
</div>
```

## Next Steps

Now that you're familiar with the basics, explore:

1. **[Icons Catalog](./api/icons-catalog.md)** - Browse all 386 available icons
2. **[Usage Reference](./api/usage-reference.md)** - Deep dive into IconProps and patterns
3. **[Accessibility Guide](./guides/accessibility.md)** - Learn WCAG compliance
4. **[Examples](./examples/basic-usage.tsx)** - See real working code examples

## Quick Reference

### Import Patterns

```tsx
// Single icon
import { WifiIcon } from '@repo/icons';

// Multiple icons
import { WifiIcon, PoolIcon, ParkingIcon } from '@repo/icons';

// With types
import { WifiIcon, type IconProps } from '@repo/icons';

// ICON_SIZES constant
import { ICON_SIZES } from '@repo/icons';
```

### Common Props

```tsx
<Icon size="md" />                        {/* Predefined size */}
<Icon size={24} />                        {/* Custom pixels */}
<Icon color="#3B82F6" />                  {/* Hex color */}
<Icon className="text-blue-500" />       {/* Tailwind class */}
<Icon aria-label="Description" />        {/* Accessibility */}
```

### Predefined Sizes

- `xs` = 16px
- `sm` = 20px
- `md` = 24px (default)
- `lg` = 28px
- `xl` = 32px

### Default Values

- **size**: `'md'` (24px)
- **color**: `'currentColor'`
- **className**: `''`

---

**Ready to use icons?** Start browsing the [Icons Catalog](./api/icons-catalog.md) or check out [working examples](./examples/basic-usage.tsx).
