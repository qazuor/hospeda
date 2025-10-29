# @repo/icons

Universal SVG icon components that work seamlessly in both React and Astro without requiring hydration. Built for the Hospeda monorepo with performance and accessibility in mind.

## Features

- 🎨 **Configurable**: Size, color, and className props
- 🔧 **Type-safe**: Full TypeScript support
- 🎯 **Consistent**: Standardized icon sizes and API
- 📦 **Tree-shakeable**: Import only what you need
- ♿ **Accessible**: Built-in aria-label and title support
- ⚡ **Universal**: Works in React and Astro without hydration
- 🚀 **Performance**: Pure SVG components, no JavaScript runtime
- 🎨 **Self-contained**: No external dependencies (no lucide-react)
- ✨ **Real SVGs**: All icons use authentic Lucide SVG paths
- 🛠️ **Developer Tools**: Scripts for generating and updating icons

## Installation

This package is part of the monorepo and should be installed automatically when you run `pnpm install` from the root.

## Usage

### Basic Usage (React & Astro)

```tsx
// Works identically in both React and Astro
import { WifiIcon, PoolIcon, RestaurantIcon } from '@repo/icons';

function MyComponent() {
  return (
    <div>
      <WifiIcon />
      <PoolIcon />
      <RestaurantIcon />
    </div>
  );
}
```

### With Custom Props

```tsx
import { WifiIcon, ICON_SIZES } from '@repo/icons';

function MyComponent() {
  return (
    <div>
      {/* Custom size */}
      <WifiIcon size="lg" />
      
      {/* Custom color */}
      <WifiIcon color="#3B82F6" />
      
      {/* Custom className */}
      <WifiIcon className="text-blue-500 hover:text-blue-600" />
      
      {/* Accessibility */}
      <WifiIcon aria-label="WiFi connection" />
      
      {/* All together */}
      <WifiIcon 
        size="xl" 
        color="currentColor"
        className="transition-colors duration-200"
        aria-label="WiFi"
      />
    </div>
  );
}
```

### Astro Usage (No Hydration Required)

```astro
---
// server-side - runs at build time
import { WifiIcon, PoolIcon, RestaurantIcon } from '@repo/icons';
---

<!-- Static HTML - no JavaScript needed -->
<div class="amenities">
  <WifiIcon size="md" className="text-green-500" />
  <PoolIcon size="md" className="text-blue-500" />
  <RestaurantIcon size="md" className="text-amber-500" />
</div>
```

### Available Sizes

```tsx
import { ICON_SIZES } from '@repo/icons';

// Predefined sizes
const sizes = {
  xs: 16,    // Extra small
  sm: 20,    // Small  
  md: 24,    // Medium (default)
  lg: 32,    // Large
  xl: 48,    // Extra large
  '2xl': 64  // 2X Large
};

// You can also use custom pixel values
<WifiIcon size={28} />
```

## Available Icons

### Entity Icons (10)

- `AccommodationIcon`, `ContentIcon`, `DestinationIcon`, `EventIcon`, `PostIcon`
- `PermissionIcon`, `PostSponsorIcon`, `PostSponsorshipIcon`, `EventLocationIcon`, `EventOrganizerIcon`

### Admin Icons (7)

- `DashboardIcon`, `AnalyticsIcon`, `ListIcon`, `ViewAllIcon`, `TagIcon`, `TagsIcon`, `SectionIcon`

### Amenity Icons (25)

- `WifiIcon`, `AirConditioningIcon`, `PoolIcon`, `ParkingIcon`, `KitchenIcon`
- `CoffeeMakerIcon`, `HeatingIcon`, `TvIcon`, `BbqGrillIcon`, `WasherIcon`
- `SafeIcon`, `BreakfastIcon`, `GymIcon`, `RefrigeratorIcon`, `MicrowaveIcon`
- `BedLinensIcon`, `TowelsIcon`, `FireplaceIcon`, `JacuzziIcon`, `TerraceIcon`
- `BalconyIcon`, `ElevatorIcon`, `MiniBarIcon`, `PlaygroundIcon`, `BicyclesIcon`

### Feature Icons (14)

- `RiverFrontIcon`, `PanoramicViewIcon`, `NaturalEnvironmentIcon`, `PetFriendlyIcon`
- `FamilySuitableIcon`, `SmartHomeIcon`, `EcologicalIcon`, `SpaFrontIcon`
- `RuralAreaIcon`, `PavedAccessIcon`, `CentralAreaIcon`, `ModernStyleIcon`
- `RusticStyleIcon`, `RenewableEnergyIcon`

### Attraction Icons (16)

- `AmphitheaterIcon`, `MuseumIcon`, `BeachIcon`, `ParkIcon`, `CasinoIcon`
- `CathedralIcon`, `ShoppingCenterIcon`, `RestaurantIcon`, `AviariumIcon`
- `AgriculturalCenterIcon`, `EducationalFarmIcon`, `SportsComplexIcon`
- `CulturalCenterIcon`, `ThermalSpaIcon`, `NatureReserveIcon`, `WetlandsIcon`

### System Icons (15)

- `HomeIcon`, `AddIcon`, `CreateIcon`, `StarIcon`, `FavoriteIcon`
- `HamburgerIcon`, `DropdownIcon`, `BreadcrumbsIcon`, `NotificationIcon`
- `LogoutIcon`, `LightThemeIcon`, `DarkThemeIcon`, `UsersIcon`, `AdminIcon`, `DebugIcon`

**Total: 106+ Icons**

## API Reference

### IconProps

```tsx
interface IconProps {
  /** Icon size - predefined size key or pixel value */
  size?: keyof typeof ICON_SIZES | number;
  
  /** Icon color - any valid CSS color value */
  color?: string;
  
  /** Additional CSS classes */
  className?: string;
  
  /** Accessibility label */
  'aria-label'?: string;
  
  /** Additional props passed to the SVG element */
  [key: string]: any;
}
```

### ICON_SIZES

Predefined size constants for consistent icon sizing across the application.

```tsx
export const ICON_SIZES = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
  '2xl': 64
} as const;
```

## Architecture

This package uses **pure SVG components** that render as static HTML. No JavaScript runtime is required, making them perfect for:

- ✅ **Server-side rendering** (Astro, Next.js, etc.)
- ✅ **Static site generation**
- ✅ **Performance-critical applications**
- ✅ **Accessibility-first development**

Each icon is a self-contained JSX component that renders an inline SVG with configurable props. The components work identically in React and Astro environments.

## Migration from Lucide

This package replaces direct `lucide-react` imports. Instead of:

```tsx
// ❌ Old way
import { Wifi, Home, User } from 'lucide-react';

<Wifi size={24} />
<Home className="text-blue-500" />
<User color="#3B82F6" />
```

Use:

```tsx
// ✅ New way
import { WifiIcon, HomeIcon, UsersIcon } from '@repo/icons';

<WifiIcon size="md" />
<HomeIcon className="text-blue-500" />
<UsersIcon color="#3B82F6" />
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

### Icon Management Scripts

#### Generate New Icon

```bash
# Generate a new icon with automatic SVG download
pnpm add:icon <icon-name> [category]

# Examples:
pnpm add:icon facebook social
pnpm add:icon calculator system
pnpm add:icon pool amenities
```

#### Update All SVGs

```bash
# Download and update all icons with real Lucide SVGs
pnpm update:svgs
```

### Icon Categories

Icons are organized into logical categories:

- **`system`**: Core UI icons (home, menu, close, etc.)
- **`social`**: Social media icons (instagram, whatsapp, etc.)
- **`communication`**: Contact icons (phone, chat, etc.)
- **`actions`**: Action icons (copy, help, etc.)
- **`admin`**: Admin panel icons (dashboard, analytics, etc.)
- **`amenities`**: Hotel amenities (wifi, pool, parking, etc.)
- **`features`**: Property features (pet-friendly, ecological, etc.)
- **`attractions`**: Tourist attractions (museum, beach, etc.)
- **`entities`**: Business entities (accommodation, event, etc.)

## License

MIT
