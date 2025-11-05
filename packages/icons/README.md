# @repo/icons

Universal SVG icon components for the Hospeda platform. Built for performance, accessibility, and seamless integration across React and Astro applications.

## Features

- 🎨 **386 Icons**: Comprehensive collection across 12 categories
- ⚡ **Framework-Agnostic**: Works in React and Astro without hydration
- 🎯 **Type-Safe**: Full TypeScript support with IconProps interface
- 📦 **Tree-Shakeable**: Import only what you need
- ♿ **Accessible**: Built-in aria-label and title support
- 🚀 **Zero Runtime**: Pure SVG components, no JavaScript required
- 🔧 **Customizable**: Configurable size, color, and className
- 📏 **Predefined Sizes**: xs, sm, md, lg, xl for consistency

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
import { SearchIcon, ICON_SIZES } from '@repo/icons';

export function SearchBar() {
  return (
    <button className="flex items-center gap-2">
      <SearchIcon size="sm" />
      <span>Search</span>
    </button>
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

## 386 Icons Catalog

Our comprehensive icon library includes:

- **Actions** (15 icons): AddIcon, EditIcon, DeleteIcon, SaveIcon, CancelIcon, CopyIcon, ShareIcon, etc.
- **Admin** (16 icons): DashboardIcon, AnalyticsIcon, UsersManagementIcon, ReportsIcon, etc.
- **Amenities** (98 icons): WifiIcon, PoolIcon, ParkingIcon, AirConditioningIcon, KitchenIcon, etc.
- **Attractions** (92 icons): BeachIcon, MuseumIcon, ParkIcon, CathedralIcon, ThermalSpaIcon, etc.
- **Booking** (16 icons): AvailableIcon, ConfirmedIcon, CheckInIcon, CheckOutIcon, CancelledIcon, etc.
- **Communication** (7 icons): PhoneIcon, EmailIcon, ChatIcon, WhatsappIcon, etc.
- **Entities** (13 icons): AccommodationIcon, EventIcon, DestinationIcon, PostIcon, etc.
- **Features** (70 icons): PetFriendlyIcon, EcologicalIcon, PanoramicViewIcon, SmartHomeIcon, etc.
- **Navigation** (51 icons): HomeIcon, SearchIcon, MenuIcon, CloseIcon, BackIcon, NextIcon, etc.
- **Social** (4 icons): FacebookIcon, InstagramIcon, WhatsappIcon, WebIcon
- **System** (51 icons): UserIcon, SettingsIcon, NotificationIcon, LogoutIcon, etc.
- **Utilities** (17 icons): CalendarIcon, ClockIcon, LocationIcon, MapIcon, etc.

**Total: 386 icons** organized for easy discovery and usage.

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

  /** Icon color - any valid CSS color value */
  color?: string;

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
- **className**: `''`

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
3. **Respect Color Inheritance**: Default `currentColor` inherits from parent
4. **Add ARIA Labels**: Provide `aria-label` for icon-only buttons
5. **Optimize Imports**: Import only needed icons for tree-shaking
6. **Consistent Sizing**: Use predefined sizes for design system consistency
7. **Test Accessibility**: Verify screen reader compatibility

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

This package uses **pure SVG components** that render as static HTML:

- ✅ **Server-side rendering** (Astro, Next.js)
- ✅ **Static site generation**
- ✅ **Zero JavaScript runtime**
- ✅ **Accessibility-first**
- ✅ **Tree-shakeable exports**

Each icon is a self-contained JSX component rendering an inline SVG with configurable props. Icons work identically in React and Astro environments.

## Migration from Lucide

Replace direct `lucide-react` imports:

```tsx
// ❌ Old way
import { Wifi, Home, User } from 'lucide-react';

<Wifi size={24} />
<Home className="text-blue-500" />
<User color="#3B82F6" />
```

With `@repo/icons`:

```tsx
// ✅ New way
import { WifiIcon, HomeIcon, UserIcon } from '@repo/icons';

<WifiIcon size="md" />
<HomeIcon className="text-blue-500" />
<UserIcon color="#3B82F6" />
```

## License

MIT

## Related Packages

- `@repo/schemas` - Validation schemas
- `@repo/db` - Database models
- `@repo/service-core` - Business logic services
- `@repo/utils` - Shared utilities
