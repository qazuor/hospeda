# @repo/icons

Universal SVG icon components for the Hospeda platform. Built for performance, accessibility, and seamless integration across React and Astro applications.

## Features

- **396 Icons**: Comprehensive collection across 11 categories (434 component files)
- **Phosphor Icons**: All icons are wrappers around @phosphor-icons/react
- **Six Weight Variants**: thin, light, regular, bold, fill, duotone (default: duotone)
- **Framework-Agnostic**: Works in React and Astro without hydration
- **Type-Safe**: Full TypeScript support with IconProps interface
- **Tree-Shakeable**: Import only what you need
- **Accessible**: Built-in aria-label support
- **Customizable**: Configurable size, color, weight, duotoneColor, and mirrored
- **Predefined Sizes**: xs (16px), sm (20px), md (24px), lg (28px), xl (32px)
- **Default Duotone Color**: Brand color #1A5FB4

## Installation

This package is part of the Hospeda monorepo and is automatically installed when you run `pnpm install` from the project root.

## Quick Start

### Basic Usage

```tsx
import { WifiIcon, PoolIcon, RestaurantIcon } from '@repo/icons';

export function AmenitiesList() {
  return (
    <div className="flex gap-4">
      <WifiIcon />
      <PoolIcon />
      <RestaurantIcon />
    </div>
  );
}
```

### Using Predefined Sizes

```tsx
import { SearchIcon } from '@repo/icons';

export function SearchBar() {
  return (
    <button className="flex items-center gap-2">
      <SearchIcon size="sm" />
      <span>Search</span>
    </button>
  );
}
```

### Using Different Weights

```tsx
import { HomeIcon } from '@repo/icons';

export function Navigation() {
  return (
    <nav>
      <HomeIcon weight="thin" />
      <HomeIcon weight="light" />
      <HomeIcon weight="regular" />
      <HomeIcon weight="bold" />
      <HomeIcon weight="fill" />
      <HomeIcon weight="duotone" duotoneColor="#E53E3E" />
    </nav>
  );
}
```

### Custom Styling with Tailwind

```tsx
import { HeartIcon } from '@repo/icons';

export function FavoriteButton() {
  return (
    <button>
      <HeartIcon
        size="lg"
        className="text-red-500 hover:text-red-600 transition-colors"
      />
    </button>
  );
}
```

### Accessibility Example

```tsx
import { CloseIcon } from '@repo/icons';

export function Modal() {
  return (
    <button aria-label="Close modal">
      <CloseIcon aria-label="Close" />
    </button>
  );
}
```

## 396 Icons Catalog

Our comprehensive icon library includes:

- **Actions** (15 icons): AddIcon, EditIcon, DeleteIcon, SaveIcon, CancelIcon, CopyIcon, ShareIcon, etc.
- **Admin** (16 icons): DashboardIcon, AnalyticsIcon, UsersManagementIcon, ReportsIcon, etc.
- **Amenities** (98 icons): WifiIcon, PoolIcon, ParkingIcon, AirConditioningIcon, KitchenIcon, etc.
- **Attractions** (92 icons): BeachIcon, MuseumIcon, ParkIcon, CathedralIcon, ThermalSpaIcon, etc.
- **Booking** (16 icons): AvailableIcon, ConfirmedIcon, CheckInIcon, CheckOutIcon, CancelledIcon, etc.
- **Communication** (7 icons): PhoneIcon, EmailIcon, ChatIcon, WhatsappIcon, etc.
- **Entities** (13 icons): AccommodationIcon, EventIcon, DestinationIcon, PostIcon, etc.
- **Features** (70 icons): PetFriendlyIcon, EcologicalIcon, PanoramicViewIcon, SmartHomeIcon, etc.
- **Social** (4 icons): FacebookIcon, InstagramIcon, WhatsappIcon, WebIcon
- **System** (65 icons): UserIcon, SettingsIcon, NotificationIcon, LogoutIcon, HomeIcon, etc.
- **Utilities** (38 icons): CalendarIcon, ClockIcon, LocationIcon, MapIcon, FilterIcon, etc.

**Total: 434 component files, 396 exported icons** organized for easy discovery and usage.

For the complete catalog with visual previews and usage examples, see the [Icons Catalog](./docs/api/icons-catalog.md).

## Documentation

### Getting Started

- [Quick Start Guide](./docs/quick-start.md) - 5-minute tutorial
- [Documentation Portal](./docs/README.md) - Complete documentation hub

### API Reference

- [Icons Catalog](./docs/api/icons-catalog.md) - Complete list of all 386 icons
- [Usage Reference](./docs/api/usage-reference.md) - IconProps, ICON_SIZES, and patterns

### Guides

- [Adding Icons](./docs/guides/adding-icons.md) - How to add new icons
- [Naming Conventions](./docs/guides/naming.md) - Icon naming standards
- [Optimization](./docs/guides/optimization.md) - Performance best practices
- [Accessibility](./docs/guides/accessibility.md) - ARIA labels and WCAG compliance
- [Testing](./docs/guides/testing.md) - Testing icon components

### Examples

- [Basic Usage](./docs/examples/basic-usage.tsx) - Common usage patterns
- [Custom Sizing](./docs/examples/custom-sizing.tsx) - Size customization
- [Colors](./docs/examples/colors.tsx) - Color and theming
- [Accessibility](./docs/examples/accessibility.tsx) - Accessible implementations

## Available Sizes

```tsx
import { ICON_SIZES } from '@repo/icons';

// Predefined sizes
const sizes = {
  xs: 16,    // Extra small - inline text, small UI elements
  sm: 20,    // Small - buttons, form inputs
  md: 24,    // Medium (default) - navigation, standard UI
  lg: 28,    // Large - featured buttons, headers
  xl: 32,    // Extra large - hero sections, empty states
};

// Use predefined sizes
<WifiIcon size="md" />

// Or custom pixel values
<WifiIcon size={28} />
```

## API Overview

### IconProps Interface

```tsx
interface IconProps {
  /** Icon size - predefined size key or pixel value */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

  /** Icon color - any valid CSS color value (used for non-duotone weights) */
  color?: string;

  /** Icon weight/style variant */
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

  /** Color used when weight is 'duotone' */
  duotoneColor?: string;

  /** Flip icon horizontally (useful for RTL layouts) */
  mirrored?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Accessibility label */
  'aria-label'?: string;

  /** Additional SVG props */
  [key: string]: unknown;
}
```

### Default Values

- **size**: `'md'` (24px)
- **color**: `'currentColor'` (inherits parent text color)
- **weight**: `'duotone'`
- **duotoneColor**: `'#1A5FB4'` (brand color)
- **mirrored**: `false`
- **className**: `''`

### ICON_SIZES Constant

```tsx
export const ICON_SIZES = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32
} as const;
```

## Development

### Building

```bash
pnpm build
```

### Type Checking

```bash
pnpm typecheck
```

### Linting

```bash
pnpm lint
```

### Formatting

```bash
pnpm format
```

## Best Practices

1. **Use Semantic Names**: Import `SearchIcon` not `MagnifyingGlassIcon`
2. **Leverage Predefined Sizes**: Use size props (`xs`, `sm`, `md`, `lg`, `xl`)
3. **Choose Appropriate Weight**: Use `duotone` for visual hierarchy, `fill` for active states, `regular` for minimal UI
4. **Respect Color Inheritance**: Default `currentColor` inherits from parent
5. **Use duotoneColor**: Customize duotone icons with brand colors
6. **Add ARIA Labels**: Provide `aria-label` for icon-only buttons
7. **Optimize Imports**: Import only needed icons for tree-shaking
8. **Test Accessibility**: Verify screen reader compatibility
9. **Leverage Mirrored Prop**: Use for RTL layouts instead of CSS transforms

## Framework Integration

### React

```tsx
import { HomeIcon, SearchIcon } from '@repo/icons';

export function Navigation() {
  return (
    <nav className="flex gap-4">
      <HomeIcon size="md" className="text-gray-700" />
      <SearchIcon size="md" className="text-gray-700" />
    </nav>
  );
}
```

### Astro (Server-Side Rendering)

```astro
---
import { WifiIcon, PoolIcon } from '@repo/icons';
---

<!-- Static HTML - no JavaScript needed -->
<div class="amenities">
  <WifiIcon size="md" className="text-green-500" />
  <PoolIcon size="md" className="text-blue-500" />
</div>
```

## Architecture

This package uses **Phosphor Icons wrappers** created via the `createPhosphorIcon` factory:

- **Icon Source**: All icons are React wrappers around `@phosphor-icons/react`
- **Factory Pattern**: `createPhosphorIcon` bridges Phosphor's API with IconProps interface
- **Weight System**: Six variants (thin, light, regular, bold, fill, duotone)
- **Default Weight**: Duotone with brand color #1A5FB4
- **Server-side rendering** (Astro, TanStack Start)
- **Accessibility-first**
- **Tree-shakeable exports**

Each icon is created by importing a Phosphor component and wrapping it with `createPhosphorIcon(PhosphorComponent, displayName, options)`. The factory handles size mapping, weight defaults, and prop forwarding.

## Creating New Icons

All icons are created using the `createPhosphorIcon` factory function.

### Example: Adding a New Icon

```tsx
// src/icons/system/NewIcon.tsx
import { YourPhosphorIcon } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * Description of what this icon represents.
 *
 * @example
 * ```tsx
 * <NewIcon size="md" weight="duotone" />
 * <NewIcon weight="bold" color="#E53E3E" />
 * ```
 */
export const NewIcon = createPhosphorIcon(YourPhosphorIcon, 'New');
```

### With Default Animation

```tsx
import { SpinnerGap } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

export const LoaderIcon = createPhosphorIcon(
  SpinnerGap,
  'Loader',
  { defaultClassName: 'animate-spin' }
);
```

### Steps to Add

1. Import Phosphor icon from `@phosphor-icons/react`
2. Create wrapper using `createPhosphorIcon`
3. Export from category index (e.g., `src/icons/system/index.ts`)
4. Export from main index (`src/index.ts`)

## License

MIT

## Related Packages

- `@repo/schemas` - Validation schemas
- `@repo/db` - Database models
- `@repo/service-core` - Business logic services
- `@repo/utils` - Shared utilities
