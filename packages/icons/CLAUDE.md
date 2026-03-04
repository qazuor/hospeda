# CLAUDE.md - Icons Package

> Main Documentation: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.

This file provides guidance for working with the Icons package (`@repo/icons`).

## Overview

Centralized icon components for consistent iconography across the Hospeda platform. All icons are React wrappers around Phosphor Icons (`@phosphor-icons/react`) created via the `createPhosphorIcon` factory function. Provides type-safe, customizable icon components with support for multiple weights, colors, and sizes.

## Key Commands

```bash
# Testing
pnpm test              # Run all tests
pnpm test:watch        # Watch mode

# Code Quality
pnpm typecheck         # TypeScript validation
pnpm lint              # Biome linting
pnpm format            # Format code

# Build
pnpm build             # Build icon components
```

## Usage

### Basic Icon Usage

```tsx
import { HomeIcon, SearchIcon, UserIcon } from '@repo/icons';

export function Navigation() {
  return (
    <nav>
      <HomeIcon />
      <SearchIcon />
      <UserIcon />
    </nav>
  );
}
```

### Icon Props

```tsx
import { StarIcon } from '@repo/icons';

<StarIcon
  size={24}                        // Size in pixels or 'xs' | 'sm' | 'md' | 'lg' | 'xl' (default: 'md')
  color="currentColor"             // Color (default: currentColor)
  weight="duotone"                 // Icon weight: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone' (default: 'duotone')
  duotoneColor="#1A5FB4"           // Color for duotone weight (default: #1A5FB4)
  mirrored={false}                 // Flip icon horizontally (default: false)
  className="icon-star"            // CSS class
/>
```

### Icon Weights

All icons support six weight variants from Phosphor Icons:

- `thin` - Thinnest stroke weight
- `light` - Light stroke weight
- `regular` - Default stroke weight
- `bold` - Bold stroke weight
- `fill` - Filled/solid variant
- `duotone` - Two-tone variant with primary and secondary colors (default)

```tsx
import { HomeIcon } from '@repo/icons';

<HomeIcon weight="thin" />
<HomeIcon weight="bold" />
<HomeIcon weight="fill" />
<HomeIcon weight="duotone" duotoneColor="#E53E3E" />
```

### Using with Tailwind

```tsx
import { HeartIcon } from '@repo/icons';

<HeartIcon
  className="w-6 h-6 text-red-500 hover:text-red-600"
/>
```

## Available Icons

Common icons include:

**Navigation:**

- `HomeIcon`
- `SearchIcon`
- `MenuIcon`
- `CloseIcon`
- `ArrowLeftIcon`
- `ArrowRightIcon`

**UI Elements:**

- `CheckIcon`
- `XIcon`
- `PlusIcon`
- `MinusIcon`
- `EditIcon`
- `DeleteIcon`
- `SettingsIcon`

**Content:**

- `StarIcon`
- `HeartIcon`
- `MapPinIcon`
- `CalendarIcon`
- `ClockIcon`
- `ImageIcon`

**User:**

- `UserIcon`
- `UsersIcon`
- `LoginIcon`
- `LogoutIcon`

**Accommodation Specific:**

- `BedIcon`
- `WifiIcon`
- `ParkingIcon`
- `PoolIcon`
- `AirConditioningIcon`

## Creating New Icons

All icons are wrappers around Phosphor Icons created via the `createPhosphorIcon` factory function.

### Adding a Phosphor Icon

1. Import the Phosphor icon and create wrapper:

```tsx
// src/icons/system/CustomIcon.tsx
import { YourPhosphorIcon } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

/**
 * Description of what this icon represents.
 *
 * @example
 * ```tsx
 * <CustomIcon size="md" weight="duotone" />
 * ```
 */
export const CustomIcon = createPhosphorIcon(YourPhosphorIcon, 'Custom');
```

2. Export from category index:

```ts
// src/icons/system/index.ts
export { CustomIcon } from './CustomIcon';
```

3. Export from main index:

```ts
// src/index.ts
export { CustomIcon } from './icons/system';
```

### Optional: Default Animation

For animated icons (like loaders), pass a `defaultClassName`:

```tsx
import { SpinnerGap } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

export const LoaderIcon = createPhosphorIcon(
  SpinnerGap,
  'Loader',
  { defaultClassName: 'animate-spin' }
);
```

## Icon Sets

Icons are organized by category:

```
src/
├── icons/
│   ├── actions/
│   ├── admin/
│   ├── amenities/
│   ├── attractions/
│   ├── booking/
│   ├── communication/
│   ├── entities/
│   ├── features/
│   ├── social/
│   ├── system/
│   └── utilities/
├── types.ts
├── create-phosphor-icon.tsx
└── index.ts
```

## Type Definition

```ts
export interface IconProps {
  /** Icon size - predefined size key or pixel value */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

  /** Icon color - any valid CSS color value */
  color?: string;

  /** Icon weight/style variant */
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

  /** Color used when weight is 'duotone' */
  duotoneColor?: string;

  /** Flip icon horizontally for RTL layouts */
  mirrored?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Accessibility label */
  'aria-label'?: string;

  /** Additional SVG props */
  [key: string]: unknown;
}

export const ICON_SIZES = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32
} as const;

export const DEFAULT_DUOTONE_COLOR = '#1A5FB4';
```

## Best Practices

1. **Use semantic names** - `SearchIcon` not `MagnifyingGlassIcon`
2. **Consistent sizing** - use predefined size keys (`xs`, `sm`, `md`, `lg`, `xl`)
3. **Respect color inheritance** - default to `currentColor`
4. **Use duotone weight** - default weight provides visual hierarchy
5. **Document usage** - add JSDoc for all icons
6. **Test accessibility** - ensure proper ARIA labels when needed
7. **Choose appropriate weight** - use `fill` for active states, `regular` for minimal UI
8. **Leverage mirrored prop** - for RTL layouts instead of CSS transforms

## Icon Sizing Guide

Use predefined size keys for consistency:

- `xs` (16px) - Small UI elements, inline text
- `sm` (20px) - Standard UI icons, form inputs
- `md` (24px) - Default size, navigation icons
- `lg` (28px) - Large buttons, featured icons
- `xl` (32px) - Hero sections, empty states

Custom pixel values are also supported for special cases.

## Accessibility

### Adding ARIA Labels

```tsx
import { SearchIcon } from '@repo/icons';

<button aria-label="Search">
  <SearchIcon aria-hidden="true" />
</button>
```

### Icon-Only Buttons

```tsx
<button aria-label="Close dialog">
  <CloseIcon />
</button>
```

## Integration Examples

### In Buttons

```tsx
import { PlusIcon } from '@repo/icons';

<button className="flex items-center gap-2">
  <PlusIcon size={20} />
  Add Item
</button>
```

### In Navigation

```tsx
import { HomeIcon, SearchIcon, UserIcon } from '@repo/icons';

<nav>
  <a href="/">
    <HomeIcon className="w-6 h-6" />
    <span>Home</span>
  </a>
  <a href="/search">
    <SearchIcon className="w-6 h-6" />
    <span>Search</span>
  </a>
  <a href="/profile">
    <UserIcon className="w-6 h-6" />
    <span>Profile</span>
  </a>
</nav>
```

### With State (Favorite)

```tsx
import { HeartIcon } from '@repo/icons';
import { useState } from 'react';

export function FavoriteButton() {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <button onClick={() => setIsFavorite(!isFavorite)}>
      <HeartIcon
        className={isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}
      />
    </button>
  );
}
```

## Icon Source

All icons are wrappers around [Phosphor Icons](https://phosphoricons.com/):

- 434 icon component files
- 396 exported icons
- Organized in 11 categories
- Wrapped via `createPhosphorIcon` factory
- Full weight system support (thin, light, regular, bold, fill, duotone)

## Key Dependencies

- `react` - For React components
- `@phosphor-icons/react` - Icon source library

## Notes

- All icons are tree-shakeable - only imported icons are bundled
- Icons are Phosphor wrappers, not custom SVGs
- Default weight is duotone with brand color #1A5FB4
- Default size is 'md' (24px)
- Icons inherit color from parent by default (currentColor)
- Six weight variants available: thin, light, regular, bold, fill, duotone

## Critical Rules

- NEVER use inline `<svg>` elements (except decorative illustrations in 404/500 pages)
- NEVER import `phosphor-react` directly - always use `@repo/icons` wrappers
- All icons are server-renderable in Astro without client directives

## Related Documentation

- [Dependency Policy](../../docs/guides/dependency-policy.md)

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

*No recent activity*
</claude-mem-context>
