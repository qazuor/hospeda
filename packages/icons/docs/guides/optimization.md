# Icon Optimization Guide

Optimization strategy for the `@repo/icons` package, which wraps `@phosphor-icons/react`.

## Tree Shaking

The most impactful optimization. Only icons you import are included in the bundle.

```tsx
// Only SearchIcon and UserIcon are bundled
import { SearchIcon, UserIcon } from '@repo/icons';
```

This works because:

- All icons use **named exports** (no default exports)
- The package is marked as `sideEffects: false`
- Each icon is in its own file, enabling per-icon code splitting

Never use namespace imports:

```tsx
// Avoid.. may prevent tree shaking
import * as Icons from '@repo/icons';
```

## Bundle Size

Each icon adds minimal footprint since they are thin wrappers around Phosphor SVG components. A typical icon wrapper is 3-4 lines of code. The actual SVG rendering is handled by `@phosphor-icons/react`, which provides pre-optimized SVG paths.

There is no need for:

- SVG sprite sheets
- SVGO or other SVG optimization tools
- Manual path simplification
- Custom SVG optimization scripts

Phosphor handles all of that internally.

## Server-Side Rendering

In Astro components, icons render as inline SVG on the server. No client-side JavaScript is required:

```astro
---
import { SearchIcon } from '@repo/icons';
---

<!-- Renders as static SVG in the HTML.. zero JS -->
<SearchIcon size={20} weight="regular" aria-hidden="true" />
```

Use `client:*` directives only on parent React islands that need interactivity, not for icons themselves.

## Weight Selection

All six Phosphor weights (`thin`, `light`, `regular`, `bold`, `fill`, `duotone`) are available. For consistent file size and visual style across the platform:

- **`duotone`** is the default weight (set by `createPhosphorIcon`)
- **`regular`** is a good choice when you want a simpler, single-color icon
- **`fill`** works well for active/selected states (e.g. filled heart for favorites)
- Avoid mixing many different weights on the same page for visual consistency

## Performance Checklist

- Import only the icons you use (tree shaking)
- Use `aria-hidden="true"` on decorative icons to reduce accessibility tree noise
- Prefer Astro components over React islands when the icon does not need interactivity
- Use predefined size keys (`'xs'`, `'sm'`, `'md'`, `'lg'`, `'xl'`) for consistency
- Use `className` with Tailwind utilities for color instead of the `color` prop when possible
