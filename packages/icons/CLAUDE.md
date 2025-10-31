# CLAUDE.md - Icons Package

> **📚 Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.


This file provides guidance for working with the Icons package (`@repo/icons`).

## Overview

Centralized icon components for consistent iconography across the Hospeda platform. Provides React components for SVG icons with customization options.

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
  size={24}              // Size in pixels (default: 24)
  color="currentColor"   // Color (default: currentColor)
  className="icon-star"  // CSS class
  strokeWidth={2}        // Stroke width (default: 2)
/>
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

### Add SVG Icon

1. Create icon component file:

```tsx
// src/icons/CustomIcon.tsx
import type { IconProps } from '../types';

export function CustomIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  className,
  ...props
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M..." />
      {/* SVG paths */}
    </svg>
  );
}
```

2. Export from index:

```ts
// src/index.ts
export { CustomIcon } from './icons/CustomIcon';
```

## Icon Sets

Icons are organized by category:

```
src/
├── icons/
│   ├── navigation/
│   ├── ui/
│   ├── content/
│   ├── user/
│   └── accommodation/
├── types/
│   └── IconProps.ts
└── index.ts
```

## Type Definition

```ts
export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}
```

## Best Practices

1. **Use semantic names** - `SearchIcon` not `MagnifyingGlassIcon`
2. **Consistent sizing** - use size prop, not width/height directly
3. **Respect color inheritance** - default to `currentColor`
4. **Optimize SVGs** - minimize path data
5. **Document usage** - add JSDoc for complex icons
6. **Test accessibility** - ensure proper ARIA labels when needed
7. **Keep icons simple** - avoid overly complex designs
8. **Use stroke icons** - for consistency (not fill)

## Icon Sizing Guide

- `16px` - Small UI elements, inline text
- `20px` - Standard UI icons
- `24px` - Default size, navigation icons
- `32px` - Large buttons, featured icons
- `48px` - Hero sections, empty states

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

## Icon Sources

Icons are typically sourced from:

- [Lucide Icons](https://lucide.dev/) - Preferred source
- Custom SVGs for brand-specific icons
- [Heroicons](https://heroicons.com/) - Alternative

## Key Dependencies

- `react` - For React components
- `react-dom` - For DOM rendering

## Notes

- All icons are tree-shakeable - only imported icons are bundled
- Icons are optimized SVGs for minimal bundle size
- Use consistent stroke width (default: 2) across all icons
- Icons inherit color from parent by default
