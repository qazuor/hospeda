/**
 * Example: Icon Colors and Theming
 *
 * Demonstrates icon color patterns including:
 * - Using currentColor inheritance
 * - Custom colors (hex, rgb, CSS variables)
 * - Tailwind color classes
 * - Hover and focus states
 * - Dark mode support
 * - Semantic color usage
 *
 * @module examples/colors
 * @example
 * ```tsx
 * import { App } from './colors';
 *
 * // Render the complete example
 * <App />
 * ```
 */

import React, { useState } from 'react';
import {
  HomeIcon,
  SearchIcon,
  UserIcon,
  StarIcon,
  HeartIcon,
  CheckIcon,
  XIcon,
  InfoIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  BedIcon,
  WifiIcon,
  ParkingIcon,
  AirConditioningIcon,
  KitchenIcon,
  SwimmingPoolIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  SettingsIcon,
  BellIcon,
  ShieldCheckIcon,
} from '@repo/icons';

/**
 * Color palette showcase properties
 */
interface ColorPaletteProps {
  title: string;
  colors: Array<{
    name: string;
    className: string;
    hex?: string;
  }>;
}

/**
 * ColorPalette Component
 *
 * Displays icons in various colors
 *
 * @param props - Component properties
 * @returns Rendered color palette
 */
export function ColorPalette(props: ColorPaletteProps): JSX.Element {
  const { title, colors } = props;

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {colors.map((color) => (
          <div key={color.name} className="flex flex-col items-center gap-2">
            <div className="p-4 bg-gray-50 rounded-lg">
              <StarIcon size={32} className={color.className} />
            </div>
            <div className="text-center">
              <div className="text-sm font-medium">{color.name}</div>
              {color.hex && (
                <div className="text-xs text-gray-500">{color.hex}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * CurrentColor inheritance example
 */
export function CurrentColorExample(): JSX.Element {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold mb-6">Color Inheritance (currentColor)</h2>

      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <p className="text-gray-600 mb-6">
          Icons inherit color from their parent element's text color
        </p>

        <div className="space-y-4">
          <div className="text-blue-600">
            <div className="flex items-center gap-3">
              <HomeIcon size={24} />
              <span className="font-medium">Blue text → Blue icon</span>
            </div>
          </div>

          <div className="text-green-600">
            <div className="flex items-center gap-3">
              <CheckIcon size={24} />
              <span className="font-medium">Green text → Green icon</span>
            </div>
          </div>

          <div className="text-red-600">
            <div className="flex items-center gap-3">
              <AlertCircleIcon size={24} />
              <span className="font-medium">Red text → Red icon</span>
            </div>
          </div>

          <div className="text-purple-600">
            <div className="flex items-center gap-3">
              <StarIcon size={24} />
              <span className="font-medium">Purple text → Purple icon</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Interactive button properties
 */
interface InteractiveButtonProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  variant: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
}

/**
 * InteractiveButton Component
 *
 * Button with hover and focus states
 *
 * @param props - Component properties
 * @returns Rendered interactive button
 */
export function InteractiveButton(
  props: InteractiveButtonProps
): JSX.Element {
  const { icon: IconComponent, label, variant } = props;

  const variantClasses = {
    primary:
      'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 active:bg-blue-800',
    secondary:
      'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 active:bg-gray-800',
    success:
      'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 active:bg-green-800',
    danger:
      'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 active:bg-red-800',
    ghost:
      'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-300 active:bg-gray-200',
  };

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${variantClasses[variant]}`}
    >
      <IconComponent size={20} />
      <span>{label}</span>
    </button>
  );
}

/**
 * Interactive states example
 */
export function InteractiveStates(): JSX.Element {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold mb-6">
        Hover, Focus, and Active States
      </h2>

      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <p className="text-gray-600 mb-6">
          Icons automatically adapt to button state changes
        </p>

        <div className="flex flex-wrap gap-3">
          <InteractiveButton
            icon={CheckIcon}
            label="Confirm"
            variant="primary"
          />
          <InteractiveButton
            icon={SearchIcon}
            label="Search"
            variant="secondary"
          />
          <InteractiveButton
            icon={CheckIcon}
            label="Success"
            variant="success"
          />
          <InteractiveButton icon={XIcon} label="Cancel" variant="danger" />
          <InteractiveButton icon={SettingsIcon} label="Settings" variant="ghost" />
        </div>
      </div>
    </section>
  );
}

/**
 * Status badge properties
 */
interface StatusBadgeProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  status: 'available' | 'booked' | 'unavailable' | 'pending';
}

/**
 * StatusBadge Component
 *
 * Status indicator with semantic colors
 *
 * @param props - Component properties
 * @returns Rendered status badge
 */
export function StatusBadge(props: StatusBadgeProps): JSX.Element {
  const { icon: IconComponent, label, status } = props;

  const statusConfig = {
    available: {
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      iconColor: 'text-green-600',
    },
    booked: {
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      iconColor: 'text-blue-600',
    },
    unavailable: {
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      iconColor: 'text-red-600',
    },
    pending: {
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-700',
      iconColor: 'text-yellow-600',
    },
  };

  const { bgColor, textColor, iconColor } = statusConfig[status];

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${bgColor} ${textColor}`}
    >
      <IconComponent size={16} className={iconColor} />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

/**
 * Semantic colors example
 */
export function SemanticColors(): JSX.Element {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold mb-6">Semantic Color Usage</h2>

      <div className="space-y-6">
        {/* Status badges */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="font-semibold mb-4">Status Indicators</h3>
          <div className="flex flex-wrap gap-3">
            <StatusBadge
              icon={CheckIcon}
              label="Available"
              status="available"
            />
            <StatusBadge icon={CalendarIcon} label="Booked" status="booked" />
            <StatusBadge icon={XIcon} label="Unavailable" status="unavailable" />
            <StatusBadge icon={ClockIcon} label="Pending" status="pending" />
          </div>
        </div>

        {/* Alert messages */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="font-semibold mb-4">Alert Messages</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <InfoIcon size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-blue-900">Information</div>
                <div className="text-sm text-blue-700">
                  Regular informational message
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckIcon size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-green-900">Success</div>
                <div className="text-sm text-green-700">
                  Operation completed successfully
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangleIcon
                size={20}
                className="text-yellow-600 flex-shrink-0 mt-0.5"
              />
              <div>
                <div className="font-medium text-yellow-900">Warning</div>
                <div className="text-sm text-yellow-700">
                  Please review before continuing
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircleIcon
                size={20}
                className="text-red-600 flex-shrink-0 mt-0.5"
              />
              <div>
                <div className="font-medium text-red-900">Error</div>
                <div className="text-sm text-red-700">
                  An error occurred, please try again
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Amenity with brand color properties
 */
interface BrandAmenityProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  featured?: boolean;
}

/**
 * BrandAmenity Component
 *
 * Amenity icon with brand colors
 *
 * @param props - Component properties
 * @returns Rendered amenity
 */
export function BrandAmenity(props: BrandAmenityProps): JSX.Element {
  const { icon: IconComponent, label, featured = false } = props;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
        featured
          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
          : 'bg-gray-100 text-gray-700'
      }`}
    >
      <IconComponent size={20} />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

/**
 * Brand colors example
 */
export function BrandColors(): JSX.Element {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold mb-6">Brand Colors</h2>

      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <h3 className="font-semibold mb-4">Hospeda Brand Amenities</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <BrandAmenity icon={WifiIcon} label="WiFi Gratis" featured={true} />
          <BrandAmenity
            icon={ParkingIcon}
            label="Estacionamiento"
            featured={true}
          />
          <BrandAmenity icon={AirConditioningIcon} label="Aire Acondicionado" />
          <BrandAmenity icon={KitchenIcon} label="Cocina" />
          <BrandAmenity icon={SwimmingPoolIcon} label="Piscina" />
          <BrandAmenity icon={BedIcon} label="Habitaciones" />
        </div>
      </div>
    </section>
  );
}

/**
 * Favorite button with state
 */
export function FavoriteButton(): JSX.Element {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setIsFavorite(!isFavorite)}
      className="group p-3 rounded-full bg-white shadow-md hover:shadow-lg transition-all"
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <HeartIcon
        size={24}
        className={`transition-colors ${
          isFavorite
            ? 'text-red-500 fill-red-500'
            : 'text-gray-400 group-hover:text-red-400'
        }`}
      />
    </button>
  );
}

/**
 * Navigation item with active state
 */
interface NavItemProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  isActive?: boolean;
  href: string;
}

/**
 * NavItem Component
 *
 * Navigation item with active/inactive states
 *
 * @param props - Component properties
 * @returns Rendered navigation item
 */
export function NavItem(props: NavItemProps): JSX.Element {
  const { icon: IconComponent, label, isActive = false, href } = props;

  return (
    <a
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-50 text-blue-600'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <IconComponent size={20} />
      <span className="font-medium">{label}</span>
    </a>
  );
}

/**
 * Active/Inactive states example
 */
export function ActiveInactiveStates(): JSX.Element {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold mb-6">Active/Inactive States</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Navigation */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="font-semibold mb-4">Navigation States</h3>
          <nav className="space-y-2">
            <NavItem icon={HomeIcon} label="Home" isActive={true} href="/" />
            <NavItem icon={SearchIcon} label="Search" href="/search" />
            <NavItem icon={CalendarIcon} label="Bookings" href="/bookings" />
            <NavItem icon={UserIcon} label="Profile" href="/profile" />
          </nav>
        </div>

        {/* Favorite buttons */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="font-semibold mb-4">Interactive State (Click heart)</h3>
          <div className="flex items-center justify-center">
            <FavoriteButton />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Dark mode example
 */
export function DarkModeExample(): JSX.Element {
  const [isDark, setIsDark] = useState(false);

  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold mb-6">Dark Mode Support</h2>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsDark(!isDark)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Toggle {isDark ? 'Light' : 'Dark'} Mode
          </button>
        </div>

        <div
          className={`p-6 rounded-xl border transition-colors ${
            isDark
              ? 'bg-gray-900 border-gray-700'
              : 'bg-white border-gray-200'
          }`}
        >
          <div className="space-y-4">
            <div
              className={`flex items-center gap-3 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              <HomeIcon size={24} />
              <span className="font-medium">Home</span>
            </div>

            <div
              className={`flex items-center gap-3 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              <SearchIcon size={24} />
              <span>Search accommodations</span>
            </div>

            <div
              className={`flex items-center gap-3 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              <UserIcon size={24} />
              <span className="text-sm">Profile settings</span>
            </div>

            <div className="pt-4 border-t border-gray-700">
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                  isDark
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <CheckIcon size={20} />
                <span>Book now</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Main App Component
 *
 * Demonstrates all color and theming patterns
 *
 * @returns Rendered application
 */
export function App(): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Page header */}
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Icon Colors and Theming Examples
          </h1>
          <p className="text-lg text-gray-600">
            Comprehensive guide to using colors with icons
          </p>
        </header>

        {/* Color palettes */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Color Palettes</h2>

          <div className="space-y-6">
            <ColorPalette
              title="Gray Scale"
              colors={[
                { name: 'Gray 900', className: 'text-gray-900', hex: '#111827' },
                { name: 'Gray 700', className: 'text-gray-700', hex: '#374151' },
                { name: 'Gray 500', className: 'text-gray-500', hex: '#6B7280' },
                { name: 'Gray 400', className: 'text-gray-400', hex: '#9CA3AF' },
                { name: 'Gray 300', className: 'text-gray-300', hex: '#D1D5DB' },
                { name: 'Gray 200', className: 'text-gray-200', hex: '#E5E7EB' },
              ]}
            />

            <ColorPalette
              title="Primary Colors"
              colors={[
                { name: 'Blue 600', className: 'text-blue-600', hex: '#2563EB' },
                { name: 'Green 600', className: 'text-green-600', hex: '#16A34A' },
                { name: 'Red 600', className: 'text-red-600', hex: '#DC2626' },
                { name: 'Yellow 600', className: 'text-yellow-600', hex: '#CA8A04' },
                { name: 'Purple 600', className: 'text-purple-600', hex: '#9333EA' },
                { name: 'Pink 600', className: 'text-pink-600', hex: '#DB2777' },
              ]}
            />

            <ColorPalette
              title="Semantic Colors"
              colors={[
                { name: 'Success', className: 'text-green-600', hex: '#16A34A' },
                { name: 'Warning', className: 'text-yellow-600', hex: '#CA8A04' },
                { name: 'Error', className: 'text-red-600', hex: '#DC2626' },
                { name: 'Info', className: 'text-blue-600', hex: '#2563EB' },
              ]}
            />
          </div>
        </section>

        {/* CurrentColor inheritance */}
        <CurrentColorExample />

        {/* Interactive states */}
        <InteractiveStates />

        {/* Semantic colors */}
        <SemanticColors />

        {/* Brand colors */}
        <BrandColors />

        {/* Active/Inactive states */}
        <ActiveInactiveStates />

        {/* Dark mode */}
        <DarkModeExample />

        {/* Best practices */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Color Best Practices</h2>
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckIcon size={20} className="text-green-600" />
                  DO: Use semantic colors for meaning
                </h3>
                <p className="text-gray-600 ml-7">
                  Green for success, red for errors, yellow for warnings
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckIcon size={20} className="text-green-600" />
                  DO: Ensure sufficient contrast
                </h3>
                <p className="text-gray-600 ml-7">
                  Minimum 4.5:1 contrast ratio for WCAG AA compliance
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckIcon size={20} className="text-green-600" />
                  DO: Use currentColor for flexibility
                </h3>
                <p className="text-gray-600 ml-7">
                  Icons inherit parent text color automatically
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircleIcon size={20} className="text-orange-600" />
                  DON'T: Rely only on color to convey information
                </h3>
                <p className="text-gray-600 ml-7">
                  Always include text labels or additional visual cues
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircleIcon size={20} className="text-orange-600" />
                  DON'T: Use too many colors
                </h3>
                <p className="text-gray-600 ml-7">
                  Stick to your brand palette and semantic colors
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
