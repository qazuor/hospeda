# @repo/icons Documentation

Welcome to the comprehensive documentation for the **@repo/icons** package - a universal SVG icon system for the Hospeda platform.

## Overview

The @repo/icons package provides **386 professionally designed icons** organized into **12 semantic categories**, built for maximum performance, accessibility, and developer experience.

### Key Features

- **🎨 386 Icons**: Complete coverage across all Hospeda use cases
- **⚡ Framework-Agnostic**: Works seamlessly in React and Astro without hydration
- **🎯 Type-Safe**: Full TypeScript support with comprehensive IconProps interface
- **📦 Tree-Shakeable**: Import only what you need for optimal bundle size
- **♿ Accessible**: Built-in ARIA support following WCAG guidelines
- **🚀 Zero Runtime**: Pure SVG components with no JavaScript overhead
- **🔧 Customizable**: Flexible props for size, color, className, and more
- **📏 Predefined Sizes**: Five standard sizes (xs, sm, md, lg, xl) for design consistency

### Total Icon Count: 386

| Category | Count | Purpose |
|----------|-------|---------|
| **Actions** | 15 | User interactions (add, edit, delete, save, cancel, etc.) |
| **Admin** | 16 | Admin panel operations (dashboard, analytics, reports, etc.) |
| **Amenities** | 98 | Accommodation amenities (wifi, pool, parking, kitchen, etc.) |
| **Attractions** | 92 | Tourist attractions (beach, museum, cathedral, thermal spa, etc.) |
| **Booking** | 16 | Reservation states (available, confirmed, check-in, cancelled, etc.) |
| **Communication** | 7 | Contact methods (phone, email, chat, whatsapp, etc.) |
| **Entities** | 13 | Business entities (accommodation, event, destination, etc.) |
| **Features** | 70 | Property features (pet-friendly, ecological, panoramic view, etc.) |
| **Navigation** | 51 | UI navigation (home, search, menu, close, pagination, etc.) |
| **Social** | 4 | Social platforms (facebook, instagram, whatsapp, web) |
| **System** | 51 | System UI (user, settings, notifications, logout, etc.) |
| **Utilities** | 17 | General utilities (calendar, clock, location, map, etc.) |

## Architecture

### Pure SVG Components

Each icon is implemented as a **pure SVG component** that renders static HTML:

```tsx
// Icon component structure
export const WifiIcon = ({
  size = 'md',
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel,
  ...props
}: IconProps) => (
  <svg
    width={typeof size === 'string' ? ICON_SIZES[size] : size}
    height={typeof size === 'string' ? ICON_SIZES[size] : size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-label={ariaLabel}
    {...props}
  >
    <title>{ariaLabel || 'Wifi'}</title>
    {/* SVG paths */}
  </svg>
);
```

### Design Principles

1. **Framework Independence**: Works identically in React and Astro
2. **Performance First**: Zero JavaScript runtime, pure HTML/SVG
3. **Type Safety**: Full TypeScript inference from IconProps
4. **Accessibility by Default**: ARIA labels and semantic HTML
5. **Customization**: Flexible props without sacrificing defaults
6. **Tree Shaking**: Named exports for optimal bundle size
7. **Consistency**: Unified API across all 386 icons

### File Structure

```text
packages/icons/
├── src/
│   ├── icons/                  # Icon components by category
│   │   ├── actions/            # 15 action icons
│   │   ├── admin/              # 16 admin icons
│   │   ├── amenities/          # 98 amenity icons
│   │   ├── attractions/        # 92 attraction icons
│   │   ├── booking/            # 16 booking icons
│   │   ├── communication/      # 7 communication icons
│   │   ├── entities/           # 13 entity icons
│   │   ├── features/           # 70 feature icons
│   │   ├── navigation/         # 51 navigation icons (combined with system)
│   │   ├── social/             # 4 social icons
│   │   ├── system/             # 51 system icons
│   │   └── utilities/          # 17 utility icons (combined with system)
│   ├── types.ts                # IconProps interface & ICON_SIZES
│   └── index.ts                # Barrel exports (all 386 icons)
├── docs/                       # Documentation (this directory)
│   ├── README.md               # Documentation portal (this file)
│   ├── quick-start.md          # 5-minute tutorial
│   ├── api/                    # API reference documentation
│   │   ├── icons-catalog.md    # Complete catalog of 386 icons
│   │   └── usage-reference.md  # IconProps, ICON_SIZES, patterns
│   ├── guides/                 # How-to guides
│   │   ├── adding-icons.md     # Adding new icons
│   │   ├── naming.md           # Naming conventions
│   │   ├── optimization.md     # Performance optimization
│   │   ├── accessibility.md    # ARIA labels & WCAG compliance
│   │   └── testing.md          # Testing icon components
│   └── examples/               # Working code examples
│       ├── basic-usage.tsx     # Common patterns
│       ├── custom-sizing.tsx   # Size customization
│       ├── colors.tsx          # Color & theming
│       └── accessibility.tsx   # Accessible implementations
├── CLAUDE.md                   # Package-specific guidance
├── package.json                # Package configuration
└── tsconfig.json               # TypeScript configuration
```

## Core Concepts

### 1. IconProps Interface

All icons share a unified props interface:

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

  /** Additional SVG props (onClick, onMouseOver, etc.) */
  [key: string]: unknown;
}
```

### 2. Predefined Sizes (ICON_SIZES)

Five standard sizes for design system consistency:

```tsx
export const ICON_SIZES = {
  xs: 16,    // Extra small - inline text, small UI elements
  sm: 20,    // Small - buttons, form inputs
  md: 24,    // Medium (default) - navigation, standard UI
  lg: 28,    // Large - featured buttons, headers
  xl: 32,    // Extra large - hero sections, empty states
} as const;
```

### 3. Framework-Agnostic Design

Icons work identically in React and Astro:

**React:**

```tsx
import { WifiIcon } from '@repo/icons';

export function AmenityBadge() {
  return <WifiIcon size="md" className="text-green-500" />;
}
```

**Astro:**

```astro
---
import { WifiIcon } from '@repo/icons';
---

<!-- Renders as static HTML - no hydration needed -->
<WifiIcon size="md" className="text-green-500" />
```

## Quick Navigation

### Getting Started

**New to @repo/icons?** Start here:

1. [**Quick Start Guide**](./quick-start.md) - 5-minute tutorial covering basics
2. [**Icons Catalog**](./api/icons-catalog.md) - Browse all 386 available icons
3. [**Usage Reference**](./api/usage-reference.md) - Learn IconProps and patterns

### API Documentation

Complete API reference:

- [**Icons Catalog**](./api/icons-catalog.md) - All 386 icons organized by category
- [**Usage Reference**](./api/usage-reference.md) - Props, constants, and patterns

### How-To Guides

Step-by-step guides for common tasks:

- [**Adding Icons**](./guides/adding-icons.md) - How to add new icons to the library
- [**Naming Conventions**](./guides/naming.md) - Icon naming standards and best practices
- [**Optimization**](./guides/optimization.md) - Performance optimization techniques
- [**Accessibility**](./guides/accessibility.md) - ARIA labels and WCAG compliance
- [**Testing**](./guides/testing.md) - Testing icon components with Vitest

### Code Examples

Working TypeScript/React examples:

- [**Basic Usage**](./examples/basic-usage.tsx) - Common usage patterns
- [**Custom Sizing**](./examples/custom-sizing.tsx) - Size customization and responsive icons
- [**Colors**](./examples/colors.tsx) - Color, theming, and dark mode
- [**Accessibility**](./examples/accessibility.tsx) - Accessible implementations

## Common Use Cases

### 1. Navigation Icons

```tsx
import { HomeIcon, SearchIcon, UserIcon, MenuIcon } from '@repo/icons';

export function MainNav() {
  return (
    <nav className="flex items-center gap-6">
      <HomeIcon size="md" className="text-gray-700 hover:text-blue-600" />
      <SearchIcon size="md" className="text-gray-700 hover:text-blue-600" />
      <UserIcon size="md" className="text-gray-700 hover:text-blue-600" />
      <MenuIcon size="md" className="text-gray-700 hover:text-blue-600" />
    </nav>
  );
}
```

### 2. Amenity Badges

```tsx
import { WifiIcon, PoolIcon, ParkingIcon, AirConditioningIcon } from '@repo/icons';

export function AmenitiesList({ amenities }: { amenities: string[] }) {
  const iconMap = {
    wifi: <WifiIcon size="sm" />,
    pool: <PoolIcon size="sm" />,
    parking: <ParkingIcon size="sm" />,
    airConditioning: <AirConditioningIcon size="sm" />,
  };

  return (
    <div className="flex gap-2">
      {amenities.map(amenity => (
        <span key={amenity} className="flex items-center gap-1">
          {iconMap[amenity]}
          <span className="text-sm">{amenity}</span>
        </span>
      ))}
    </div>
  );
}
```

### 3. Action Buttons

```tsx
import { EditIcon, DeleteIcon, SaveIcon, CancelIcon } from '@repo/icons';

export function ActionButtons({ onEdit, onDelete, onSave, onCancel }) {
  return (
    <div className="flex gap-2">
      <button onClick={onEdit} aria-label="Edit">
        <EditIcon size="sm" className="text-blue-600" />
      </button>
      <button onClick={onDelete} aria-label="Delete">
        <DeleteIcon size="sm" className="text-red-600" />
      </button>
      <button onClick={onSave} aria-label="Save">
        <SaveIcon size="sm" className="text-green-600" />
      </button>
      <button onClick={onCancel} aria-label="Cancel">
        <CancelIcon size="sm" className="text-gray-600" />
      </button>
    </div>
  );
}
```

### 4. Status Indicators

```tsx
import {
  AvailableIcon,
  ConfirmedIcon,
  PendingIcon,
  CancelledIcon
} from '@repo/icons';

export function BookingStatus({ status }: { status: string }) {
  const statusConfig = {
    available: { icon: <AvailableIcon size="sm" />, color: 'text-green-600' },
    confirmed: { icon: <ConfirmedIcon size="sm" />, color: 'text-blue-600' },
    pending: { icon: <PendingIcon size="sm" />, color: 'text-yellow-600' },
    cancelled: { icon: <CancelledIcon size="sm" />, color: 'text-red-600' },
  };

  const config = statusConfig[status];

  return (
    <span className={`flex items-center gap-1 ${config.color}`}>
      {config.icon}
      <span className="capitalize">{status}</span>
    </span>
  );
}
```

### 5. Feature Highlights

```tsx
import {
  PetFriendlyIcon,
  EcologicalIcon,
  PanoramicViewIcon,
  SmartHomeIcon
} from '@repo/icons';

export function FeatureGrid({ features }: { features: string[] }) {
  const featureMap = {
    petFriendly: { icon: <PetFriendlyIcon size="lg" />, label: 'Pet Friendly' },
    ecological: { icon: <EcologicalIcon size="lg" />, label: 'Eco-Friendly' },
    panoramicView: { icon: <PanoramicViewIcon size="lg" />, label: 'Panoramic View' },
    smartHome: { icon: <SmartHomeIcon size="lg" />, label: 'Smart Home' },
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {features.map(feature => (
        <div key={feature} className="flex flex-col items-center gap-2 p-4 border rounded">
          {featureMap[feature].icon}
          <span className="text-sm font-medium">{featureMap[feature].label}</span>
        </div>
      ))}
    </div>
  );
}
```

## Best Practices

### 1. Use Semantic Names

```tsx
// ✅ Good - semantic, business-focused
import { SearchIcon, UserIcon, HomeIcon } from '@repo/icons';

// ❌ Bad - generic, technical names
import { MagnifyingGlassIcon, PersonIcon, HouseIcon } from '@repo/icons';
```

### 2. Leverage Predefined Sizes

```tsx
// ✅ Good - uses predefined sizes
<WifiIcon size="sm" />
<PoolIcon size="md" />
<ParkingIcon size="lg" />

// ❌ Bad - custom pixel values without reason
<WifiIcon size={19} />
<PoolIcon size={23} />
```

### 3. Respect Color Inheritance

```tsx
// ✅ Good - inherits parent color
<div className="text-blue-600">
  <WifiIcon /> {/* Inherits blue-600 */}
</div>

// ✅ Also good - explicit color when needed
<WifiIcon color="#3B82F6" />

// ❌ Bad - redundant color specification
<div className="text-blue-600">
  <WifiIcon color="#3B82F6" />
</div>
```

### 4. Add ARIA Labels for Icon-Only Buttons

```tsx
// ✅ Good - accessible
<button aria-label="Close dialog">
  <CloseIcon aria-label="Close" />
</button>

// ❌ Bad - no accessibility label
<button>
  <CloseIcon />
</button>
```

### 5. Tree-Shake Imports

```tsx
// ✅ Good - imports only what's needed
import { WifiIcon, PoolIcon } from '@repo/icons';

// ❌ Bad - barrel import (not supported)
import * as Icons from '@repo/icons';
const { WifiIcon, PoolIcon } = Icons;
```

### 6. Consistent Icon Sizing

```tsx
// ✅ Good - consistent sizing within context
<nav className="flex gap-4">
  <HomeIcon size="md" />
  <SearchIcon size="md" />
  <UserIcon size="md" />
</nav>

// ❌ Bad - inconsistent sizes
<nav className="flex gap-4">
  <HomeIcon size="sm" />
  <SearchIcon size="lg" />
  <UserIcon size="md" />
</nav>
```

## Performance Considerations

### Tree Shaking

The package uses **named exports** for optimal tree shaking:

```tsx
// Only WifiIcon and PoolIcon are included in bundle
import { WifiIcon, PoolIcon } from '@repo/icons';
```

### Bundle Size Impact

- **Single icon**: ~0.5 KB (minified + gzipped)
- **10 icons**: ~5 KB
- **50 icons**: ~25 KB
- **All 386 icons**: ~193 KB (not recommended - import only what you need)

### Server-Side Rendering

Icons render as **static HTML** in Astro with zero JavaScript:

```astro
---
import { WifiIcon } from '@repo/icons';
---

<!-- Pure HTML/SVG - no JavaScript runtime -->
<WifiIcon size="md" />
```

## Accessibility

### WCAG Compliance

All icons follow WCAG 2.1 Level AA guidelines:

- ✅ Semantic HTML (`<svg>` with proper attributes)
- ✅ ARIA labels for screen readers
- ✅ Color contrast (when used with text)
- ✅ Keyboard navigation (when in interactive elements)

### Screen Reader Support

```tsx
// Icon with text (icon is decorative)
<button>
  <WifiIcon aria-hidden="true" />
  <span>Connect to WiFi</span>
</button>

// Icon-only button (icon is semantic)
<button aria-label="Connect to WiFi">
  <WifiIcon aria-label="WiFi" />
</button>
```

## Troubleshooting

### Icons Not Displaying

**Problem**: Icons don't appear on the page.

**Solution**: Verify import path and icon name:

```tsx
// ✅ Correct
import { WifiIcon } from '@repo/icons';

// ❌ Wrong - direct Phosphor import
import { Wifi } from '@phosphor-icons/react';
```

### Size Not Working

**Problem**: Size prop doesn't change icon size.

**Solution**: Ensure size prop is typed correctly:

```tsx
// ✅ Correct
<WifiIcon size="md" />
<WifiIcon size={24} />

// ❌ Wrong - string number
<WifiIcon size="24" />
```

### Color Not Applying

**Problem**: Color prop doesn't change icon color.

**Solution**: Use valid CSS color:

```tsx
// ✅ Correct
<WifiIcon color="#3B82F6" />
<WifiIcon color="currentColor" />
<WifiIcon className="text-blue-500" />

// ❌ Wrong - fill instead of stroke
<WifiIcon fill="#3B82F6" />
```

### TypeScript Errors

**Problem**: TypeScript complains about icon props.

**Solution**: Import IconProps type:

```tsx
import { WifiIcon, type IconProps } from '@repo/icons';

function CustomIcon(props: IconProps) {
  return <WifiIcon {...props} />;
}
```

## Contributing

### Adding New Icons

See [Adding Icons Guide](./guides/adding-icons.md) for step-by-step instructions.

### Reporting Issues

Found a bug or have a suggestion? Please:

1. Check existing issues
2. Create detailed issue with reproduction
3. Include icon name, framework, and version

### Code Style

Follow existing patterns:

- Named exports only
- JSDoc comments for all icons
- TypeScript strict mode
- Consistent SVG attributes
- Semantic icon names

## Related Documentation

- [Main Project Documentation](../../../CLAUDE.md)
- [Quick Start Guide](./quick-start.md)
- [Icons Catalog](./api/icons-catalog.md)
- [Usage Reference](./api/usage-reference.md)

## Support

For questions or issues:

- Check [Troubleshooting](#troubleshooting) section
- Review [API Reference](./api/usage-reference.md)
- Consult [Code Examples](./examples/)

---

**Last Updated**: 2024-11-05
**Package Version**: 1.0.0
**Total Icons**: 386
