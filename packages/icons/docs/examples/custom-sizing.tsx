/**
 * Example: Custom Icon Sizing
 *
 * Demonstrates icon sizing patterns including:
 * - Predefined size constants
 * - Custom pixel sizes
 * - Responsive sizing with Tailwind
 * - Context-aware sizing
 * - Dynamic sizing patterns
 *
 * @module examples/custom-sizing
 * @example
 * ```tsx
 * import { App } from './custom-sizing';
 *
 * // Render the complete example
 * <App />
 * ```
 */

import React from 'react';
import {
  HomeIcon,
  SearchIcon,
  UserIcon,
  StarIcon,
  HeartIcon,
  BedIcon,
  WifiIcon,
  ParkingIcon,
  MapPinIcon,
  CalendarIcon,
  CheckIcon,
  InfoIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
} from '@repo/icons';

/**
 * Predefined icon sizes (in pixels)
 */
export const ICON_SIZES = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

/**
 * Type for predefined size keys
 */
export type IconSize = keyof typeof ICON_SIZES;

/**
 * Size comparison properties
 */
interface SizeComparisonProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
}

/**
 * SizeComparison Component
 *
 * Shows the same icon at all predefined sizes
 *
 * @param props - Component properties
 * @returns Rendered size comparison
 */
export function SizeComparison(props: SizeComparisonProps): JSX.Element {
  const { icon: IconComponent, title } = props;

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="flex flex-wrap items-end gap-8">
        {(Object.keys(ICON_SIZES) as IconSize[]).map((sizeKey) => (
          <div key={sizeKey} className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center h-20">
              <IconComponent
                size={ICON_SIZES[sizeKey]}
                className="text-blue-600"
              />
            </div>
            <div className="text-center">
              <div className="text-sm font-medium">{sizeKey}</div>
              <div className="text-xs text-gray-500">
                {ICON_SIZES[sizeKey]}px
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Size guideline item properties
 */
interface SizeGuidelineItemProps {
  size: number;
  name: string;
  context: string;
  examples: string[];
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

/**
 * SizeGuidelineItem Component
 *
 * Displays a single size guideline with context and examples
 *
 * @param props - Component properties
 * @returns Rendered guideline item
 */
export function SizeGuidelineItem(
  props: SizeGuidelineItemProps
): JSX.Element {
  const { size, name, context, examples, icon: IconComponent } = props;

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-16 h-16 bg-blue-50 rounded-lg flex items-center justify-center">
          <IconComponent size={size} className="text-blue-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="text-lg font-semibold">{name}</h3>
            <span className="text-sm text-gray-500">{size}px</span>
          </div>
          <p className="text-gray-600 mb-3">{context}</p>
          <div>
            <div className="text-sm font-medium text-gray-700 mb-1">
              Use for:
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              {examples.map((example, index) => (
                <li key={index}>• {example}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Size guidelines reference
 */
export function SizeGuidelinesReference(): JSX.Element {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold mb-6">Size Guidelines</h2>
      <div className="space-y-4">
        <SizeGuidelineItem
          size={16}
          name="Extra Small"
          context="Small UI elements and inline text icons"
          examples={[
            'Inline icons within text paragraphs',
            'Dense data tables',
            'Compact list items',
            'Small badges and tags',
          ]}
          icon={InfoIcon}
        />
        <SizeGuidelineItem
          size={20}
          name="Small"
          context="Standard UI controls and form elements"
          examples={[
            'Form input icons',
            'Button icons',
            'Dropdown indicators',
            'Status indicators',
          ]}
          icon={CheckIcon}
        />
        <SizeGuidelineItem
          size={24}
          name="Medium (Default)"
          context="Primary navigation and action buttons"
          examples={[
            'Main navigation icons',
            'Card action buttons',
            'Toolbar icons',
            'Modal headers',
          ]}
          icon={HomeIcon}
        />
        <SizeGuidelineItem
          size={32}
          name="Large"
          context="Featured buttons and section headers"
          examples={[
            'Primary call-to-action buttons',
            'Section header icons',
            'Empty state icons',
            'Feature highlights',
          ]}
          icon={StarIcon}
        />
        <SizeGuidelineItem
          size={48}
          name="Extra Large"
          context="Hero sections and major visual elements"
          examples={[
            'Hero section icons',
            'Large feature cards',
            'Welcome screens',
            'Success/error confirmations',
          ]}
          icon={HeartIcon}
        />
      </div>
    </section>
  );
}

/**
 * Amenity icon with size properties
 */
interface AmenityIconProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  size: 'compact' | 'standard' | 'featured';
}

/**
 * AmenityIcon Component
 *
 * Displays amenity icon at context-appropriate size
 *
 * @param props - Component properties
 * @returns Rendered amenity icon
 */
export function AmenityIcon(props: AmenityIconProps): JSX.Element {
  const { icon: IconComponent, label, size } = props;

  const sizeMap = {
    compact: 16,
    standard: 20,
    featured: 24,
  };

  const iconSize = sizeMap[size];

  const containerClasses = {
    compact: 'flex items-center gap-1 text-xs',
    standard: 'flex items-center gap-2 text-sm',
    featured: 'flex items-center gap-3 text-base',
  };

  return (
    <div className={containerClasses[size]}>
      <IconComponent size={iconSize} className="text-gray-600 flex-shrink-0" />
      <span>{label}</span>
    </div>
  );
}

/**
 * Context-aware sizing examples
 */
export function ContextAwareSizing(): JSX.Element {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold mb-6">Context-Aware Sizing</h2>

      <div className="space-y-6">
        {/* Compact list view */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-3">Compact List View (16px)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <AmenityIcon icon={WifiIcon} label="WiFi" size="compact" />
            <AmenityIcon icon={ParkingIcon} label="Parking" size="compact" />
            <AmenityIcon icon={BedIcon} label="Bedroom" size="compact" />
            <AmenityIcon icon={MapPinIcon} label="Location" size="compact" />
          </div>
        </div>

        {/* Standard card view */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-4">Standard Card View (20px)</h3>
          <div className="grid grid-cols-2 gap-3">
            <AmenityIcon icon={WifiIcon} label="WiFi" size="standard" />
            <AmenityIcon icon={ParkingIcon} label="Parking" size="standard" />
            <AmenityIcon icon={BedIcon} label="Bedroom" size="standard" />
            <AmenityIcon icon={MapPinIcon} label="Location" size="standard" />
          </div>
        </div>

        {/* Featured detail view */}
        <div className="bg-white p-8 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-4">Featured Detail View (24px)</h3>
          <div className="space-y-3">
            <AmenityIcon icon={WifiIcon} label="High-speed WiFi" size="featured" />
            <AmenityIcon icon={ParkingIcon} label="Free parking" size="featured" />
            <AmenityIcon icon={BedIcon} label="3 bedrooms" size="featured" />
            <AmenityIcon icon={MapPinIcon} label="City center" size="featured" />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Responsive icon properties
 */
interface ResponsiveIconProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}

/**
 * ResponsiveIcon Component
 *
 * Icon that changes size based on screen width
 *
 * @param props - Component properties
 * @returns Rendered responsive icon
 */
export function ResponsiveIcon(props: ResponsiveIconProps): JSX.Element {
  const { icon: IconComponent, label } = props;

  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border border-gray-200">
      <IconComponent className="w-4 h-4 md:w-6 md:h-6 lg:w-8 lg:h-8 text-blue-600" />
      <span className="text-xs md:text-sm lg:text-base text-center">
        {label}
      </span>
    </div>
  );
}

/**
 * Responsive sizing examples
 */
export function ResponsiveSizing(): JSX.Element {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold mb-6">Responsive Sizing</h2>

      <div className="bg-gray-50 p-6 rounded-xl">
        <p className="text-sm text-gray-600 mb-4">
          Resize your browser to see icons adapt:
          <br />
          Mobile (16px) → Tablet (24px) → Desktop (32px)
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ResponsiveIcon icon={HomeIcon} label="Home" />
          <ResponsiveIcon icon={SearchIcon} label="Search" />
          <ResponsiveIcon icon={StarIcon} label="Favorites" />
          <ResponsiveIcon icon={UserIcon} label="Profile" />
        </div>
      </div>
    </section>
  );
}

/**
 * Navigation bar with responsive icons
 */
export function ResponsiveNavigation(): JSX.Element {
  return (
    <nav className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Logo - scales with viewport */}
          <div className="flex items-center gap-2">
            <HomeIcon className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
            <span className="text-lg md:text-xl font-bold">Hospeda</span>
          </div>

          {/* Navigation - hidden on mobile, visible on desktop */}
          <div className="hidden md:flex items-center gap-6">
            <a href="/" className="flex items-center gap-2 text-gray-700">
              <HomeIcon className="w-5 h-5" />
              <span>Inicio</span>
            </a>
            <a href="/search" className="flex items-center gap-2 text-gray-700">
              <SearchIcon className="w-5 h-5" />
              <span>Buscar</span>
            </a>
            <a href="/profile" className="flex items-center gap-2 text-gray-700">
              <UserIcon className="w-5 h-5" />
              <span>Perfil</span>
            </a>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              aria-label="Search"
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <SearchIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              aria-label="Profile"
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <UserIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

/**
 * Dynamic size example properties
 */
interface DynamicSizeExampleProps {
  importance: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

/**
 * DynamicSizeExample Component
 *
 * Icon size changes based on message importance
 *
 * @param props - Component properties
 * @returns Rendered notification
 */
export function DynamicSizeExample(
  props: DynamicSizeExampleProps
): JSX.Element {
  const { importance, message } = props;

  const config = {
    low: {
      icon: InfoIcon,
      iconSize: 16,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      textSize: 'text-sm',
    },
    medium: {
      icon: CheckIcon,
      iconSize: 20,
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      textSize: 'text-base',
    },
    high: {
      icon: AlertCircleIcon,
      iconSize: 24,
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600',
      textSize: 'text-lg',
    },
    critical: {
      icon: AlertTriangleIcon,
      iconSize: 32,
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600',
      textSize: 'text-xl',
    },
  };

  const { icon: IconComponent, iconSize, bgColor, iconColor, textSize } =
    config[importance];

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg ${bgColor}`}>
      <IconComponent size={iconSize} className={`${iconColor} flex-shrink-0`} />
      <p className={`${textSize} font-medium`}>{message}</p>
    </div>
  );
}

/**
 * Dynamic sizing examples
 */
export function DynamicSizing(): JSX.Element {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold mb-6">Dynamic Sizing by Context</h2>

      <div className="space-y-4">
        <DynamicSizeExample
          importance="low"
          message="Regular information message"
        />
        <DynamicSizeExample
          importance="medium"
          message="Success: Operation completed"
        />
        <DynamicSizeExample
          importance="high"
          message="Warning: Please review this carefully"
        />
        <DynamicSizeExample
          importance="critical"
          message="Critical: Immediate action required!"
        />
      </div>
    </section>
  );
}

/**
 * Accommodation feature card with custom sizing
 */
interface FeatureCardProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  size: 'compact' | 'standard' | 'large';
}

/**
 * FeatureCard Component
 *
 * Feature card with size-appropriate icon
 *
 * @param props - Component properties
 * @returns Rendered feature card
 */
export function FeatureCard(props: FeatureCardProps): JSX.Element {
  const { icon: IconComponent, title, description, size } = props;

  const config = {
    compact: {
      iconSize: 24,
      iconBg: 'w-10 h-10',
      titleSize: 'text-base',
      descSize: 'text-sm',
      padding: 'p-3',
    },
    standard: {
      iconSize: 32,
      iconBg: 'w-12 h-12',
      titleSize: 'text-lg',
      descSize: 'text-base',
      padding: 'p-4',
    },
    large: {
      iconSize: 48,
      iconBg: 'w-16 h-16',
      titleSize: 'text-xl',
      descSize: 'text-lg',
      padding: 'p-6',
    },
  };

  const { iconSize, iconBg, titleSize, descSize, padding } = config[size];

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${padding}`}>
      <div
        className={`${iconBg} bg-blue-100 rounded-lg flex items-center justify-center mb-3`}
      >
        <IconComponent size={iconSize} className="text-blue-600" />
      </div>
      <h3 className={`${titleSize} font-semibold mb-2`}>{title}</h3>
      <p className={`${descSize} text-gray-600`}>{description}</p>
    </div>
  );
}

/**
 * Feature cards showcase
 */
export function FeatureCardsShowcase(): JSX.Element {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold mb-6">Feature Cards - Size Variants</h2>

      <div className="space-y-8">
        {/* Compact cards */}
        <div>
          <h3 className="font-semibold mb-4">Compact Cards</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FeatureCard
              icon={BedIcon}
              title="Comfortable Rooms"
              description="Spacious accommodations"
              size="compact"
            />
            <FeatureCard
              icon={WifiIcon}
              title="Free WiFi"
              description="High-speed internet"
              size="compact"
            />
            <FeatureCard
              icon={ParkingIcon}
              title="Free Parking"
              description="Secure parking area"
              size="compact"
            />
          </div>
        </div>

        {/* Standard cards */}
        <div>
          <h3 className="font-semibold mb-4">Standard Cards</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FeatureCard
              icon={StarIcon}
              title="Premium Quality"
              description="5-star rated accommodations"
              size="standard"
            />
            <FeatureCard
              icon={MapPinIcon}
              title="Great Location"
              description="Close to major attractions"
              size="standard"
            />
          </div>
        </div>

        {/* Large cards */}
        <div>
          <h3 className="font-semibold mb-4">Large Cards</h3>
          <div className="grid grid-cols-1 gap-6">
            <FeatureCard
              icon={HeartIcon}
              title="Guest Favorite"
              description="Highly recommended by previous guests for exceptional service and comfort"
              size="large"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Main App Component
 *
 * Demonstrates all custom sizing patterns
 *
 * @returns Rendered application
 */
export function App(): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Responsive navigation */}
      <ResponsiveNavigation />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Page header */}
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Custom Icon Sizing Examples
          </h1>
          <p className="text-lg text-gray-600">
            Comprehensive guide to icon sizing across different contexts
          </p>
        </header>

        {/* Size comparisons */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Predefined Sizes</h2>
          <div className="space-y-6">
            <SizeComparison icon={HomeIcon} title="Home Icon" />
            <SizeComparison icon={StarIcon} title="Star Icon" />
            <SizeComparison icon={HeartIcon} title="Heart Icon" />
          </div>
        </section>

        {/* Size guidelines */}
        <SizeGuidelinesReference />

        {/* Context-aware sizing */}
        <ContextAwareSizing />

        {/* Responsive sizing */}
        <ResponsiveSizing />

        {/* Dynamic sizing */}
        <DynamicSizing />

        {/* Feature cards */}
        <FeatureCardsShowcase />

        {/* Best practices */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Sizing Best Practices</h2>
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckIcon size={20} className="text-green-600" />
                  DO: Use consistent sizes within the same context
                </h3>
                <p className="text-gray-600 ml-7">
                  All navigation icons should be the same size (typically 20-24px)
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckIcon size={20} className="text-green-600" />
                  DO: Scale icons proportionally with text
                </h3>
                <p className="text-gray-600 ml-7">
                  Icon size should match or slightly exceed adjacent text size
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckIcon size={20} className="text-green-600" />
                  DO: Use larger icons for touch targets on mobile
                </h3>
                <p className="text-gray-600 ml-7">
                  Minimum 44x44px touch target, so use 24px+ icons with padding
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircleIcon size={20} className="text-orange-600" />
                  DON'T: Mix different sizes arbitrarily
                </h3>
                <p className="text-gray-600 ml-7">
                  Random icon sizes create visual inconsistency
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircleIcon size={20} className="text-orange-600" />
                  DON'T: Use extremely small icons
                </h3>
                <p className="text-gray-600 ml-7">
                  Icons below 12px lose detail and become hard to recognize
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
