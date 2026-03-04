# Adding Icons Guide

Guide for adding new icons to the `@repo/icons` package. All icons are Phosphor Icons wrappers created via the `createPhosphorIcon` factory function.

## How It Works

The `@repo/icons` package wraps components from `@phosphor-icons/react` using a factory function (`createPhosphorIcon`) that maps Phosphor's API to the shared `IconProps` interface used across the Hospeda platform.

Each icon is a thin wrapper.. typically 3-4 lines of code.

## Step-by-Step Process

### 1. Find the Phosphor Icon

Browse the Phosphor Icons catalog at [phosphoricons.com](https://phosphoricons.com/) and find the icon you need.

### 2. Create the Wrapper Component

Create a new file in the appropriate category folder under `packages/icons/src/icons/`.

Categories: `actions`, `admin`, `amenities`, `attractions`, `booking`, `communication`, `entities`, `features`, `navigation`, `social`, `system`, `utilities`.

```tsx
// packages/icons/src/icons/system/CameraIcon.tsx
import { Camera } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

export const CameraIcon = createPhosphorIcon(Camera, 'camera');
```

For icons that need a default CSS class (e.g. loaders):

```tsx
// packages/icons/src/icons/system/SpinnerIcon.tsx
import { SpinnerGap } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

export const SpinnerIcon = createPhosphorIcon(SpinnerGap, 'spinner', {
    defaultClassName: 'animate-spin',
});
```

### 3. Export from index.ts

Add the named export to `packages/icons/src/index.ts` in the appropriate section:

```ts
// Export system icons
export { CameraIcon } from './icons/system/CameraIcon';
```

## IconProps Reference

All wrapped icons accept these props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `number \| 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | Icon size. Keys map to: xs=16, sm=20, md=24, lg=28, xl=32 |
| `weight` | `'thin' \| 'light' \| 'regular' \| 'bold' \| 'fill' \| 'duotone'` | `'duotone'` | Visual weight/style variant |
| `color` | `string` | `'currentColor'` | Icon color (used for non-duotone weights) |
| `duotoneColor` | `string` | `'#1A5FB4'` | Color for duotone weight |
| `mirrored` | `boolean` | `false` | Flip horizontally (for RTL) |
| `className` | `string` | `''` | CSS class names |
| `aria-label` | `string` | `'{name} icon'` | Accessibility label |

## Usage Examples

### In Astro Components

Icons render as SVG on the server.. no client JavaScript needed:

```astro
---
import { SearchIcon, FavoriteIcon, CalendarIcon } from '@repo/icons';
---

<SearchIcon size={20} weight="regular" aria-hidden="true" />
<FavoriteIcon size="lg" weight="fill" className="text-red-500" />
<CalendarIcon size="sm" weight="duotone" />
```

### In React Components

```tsx
import { SearchIcon, HomeIcon } from '@repo/icons';

function Navigation() {
    return (
        <nav>
            <HomeIcon size="md" weight="duotone" aria-hidden="true" />
            <SearchIcon size={20} weight="regular" className="text-gray-600" />
        </nav>
    );
}
```

## Rules

- **Named exports only**.. no default exports
- **One icon per file**.. each wrapper gets its own `.tsx` file
- **Use `createPhosphorIcon`**.. never create manual SVG components
- **Import from `@phosphor-icons/react`**.. never copy SVG paths manually
- **Always export from `index.ts`**.. so consumers import from `@repo/icons`
