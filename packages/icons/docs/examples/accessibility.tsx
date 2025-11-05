/**
 * Example: Icon Accessibility
 *
 * Demonstrates accessibility patterns for icons including:
 * - Accessible icon-only buttons
 * - ARIA labels and attributes
 * - Screen reader support
 * - Keyboard navigation
 * - Touch targets
 * - Focus management
 * - High contrast mode
 *
 * @module examples/accessibility
 * @example
 * ```tsx
 * import { App } from './accessibility';
 *
 * // Render the complete example
 * <App />
 * ```
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  HomeIcon,
  SearchIcon,
  UserIcon,
  HeartIcon,
  StarIcon,
  CheckIcon,
  XIcon,
  EditIcon,
  DeleteIcon,
  ShareIcon,
  DownloadIcon,
  PlusIcon,
  MinusIcon,
  PlayIcon,
  PauseIcon,
  SettingsIcon,
  BellIcon,
  InfoIcon,
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
} from '@repo/icons';

/**
 * Accessible icon button properties
 */
interface AccessibleIconButtonProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
}

/**
 * AccessibleIconButton Component
 *
 * Icon-only button with proper ARIA labels and minimum touch target
 *
 * @param props - Component properties
 * @returns Rendered accessible icon button
 */
export function AccessibleIconButton(
  props: AccessibleIconButtonProps
): JSX.Element {
  const {
    icon: IconComponent,
    label,
    onClick,
    variant = 'ghost',
    disabled = false,
  } = props;

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`
        min-w-[44px] min-h-[44px] p-3 rounded-lg
        transition-all
        focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
      `}
    >
      <IconComponent size={20} aria-hidden="true" />
    </button>
  );
}

/**
 * Icon with text button properties
 */
interface IconTextButtonProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  iconPosition?: 'left' | 'right';
}

/**
 * IconTextButton Component
 *
 * Button with visible text label and icon (no aria-label needed)
 *
 * @param props - Component properties
 * @returns Rendered button with icon and text
 */
export function IconTextButton(props: IconTextButtonProps): JSX.Element {
  const {
    icon: IconComponent,
    label,
    onClick,
    variant = 'primary',
    iconPosition = 'left',
  } = props;

  const variantClasses = {
    primary:
      'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 active:bg-blue-800',
    secondary:
      'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 active:bg-gray-800',
    outline:
      'border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium
        min-h-[44px]
        transition-all
        focus:outline-none focus:ring-2 focus:ring-offset-2
        ${variantClasses[variant]}
      `}
    >
      {iconPosition === 'left' && (
        <IconComponent size={20} aria-hidden="true" />
      )}
      <span>{label}</span>
      {iconPosition === 'right' && (
        <IconComponent size={20} aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * Decorative icon properties
 */
interface DecorativeIconProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  text: string;
}

/**
 * DecorativeIcon Component
 *
 * Icon used purely for visual decoration (hidden from screen readers)
 *
 * @param props - Component properties
 * @returns Rendered decorative icon with text
 */
export function DecorativeIcon(props: DecorativeIconProps): JSX.Element {
  const { icon: IconComponent, text } = props;

  return (
    <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200">
      <IconComponent size={20} aria-hidden="true" className="text-blue-600" />
      <span>{text}</span>
    </div>
  );
}

/**
 * Status icon properties
 */
interface StatusIconProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

/**
 * StatusIcon Component
 *
 * Icon with semantic meaning that should be announced to screen readers
 *
 * @param props - Component properties
 * @returns Rendered status message with icon
 */
export function StatusIcon(props: StatusIconProps): JSX.Element {
  const { type, message } = props;

  const config = {
    success: {
      icon: CheckIcon,
      label: 'Success',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      iconColor: 'text-green-600',
      textColor: 'text-green-900',
    },
    error: {
      icon: AlertCircleIcon,
      label: 'Error',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-600',
      textColor: 'text-red-900',
    },
    warning: {
      icon: InfoIcon,
      label: 'Warning',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      iconColor: 'text-yellow-600',
      textColor: 'text-yellow-900',
    },
    info: {
      icon: InfoIcon,
      label: 'Information',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-600',
      textColor: 'text-blue-900',
    },
  };

  const { icon: IconComponent, label, bgColor, borderColor, iconColor, textColor } =
    config[type];

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border ${bgColor} ${borderColor}`}
      role="alert"
      aria-live="polite"
    >
      <IconComponent
        size={20}
        className={`${iconColor} flex-shrink-0 mt-0.5`}
        aria-label={label}
      />
      <p className={`${textColor} text-sm`}>{message}</p>
    </div>
  );
}

/**
 * Toggle button with accessible state
 */
export function AccessibleToggle(): JSX.Element {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setIsPlaying(!isPlaying)}
      aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
      aria-pressed={isPlaying}
      className="min-w-[44px] min-h-[44px] p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
    >
      {isPlaying ? (
        <PauseIcon size={20} aria-hidden="true" />
      ) : (
        <PlayIcon size={20} aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * Favorite button with accessible state
 */
export function AccessibleFavorite(): JSX.Element {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setIsFavorite(!isFavorite)}
      aria-label={
        isFavorite ? 'Remove from favorites' : 'Add to favorites'
      }
      aria-pressed={isFavorite}
      className={`
        min-w-[44px] min-h-[44px] p-3 rounded-full
        transition-all
        focus:outline-none focus:ring-2 focus:ring-offset-2
        ${
          isFavorite
            ? 'bg-red-50 text-red-600 focus:ring-red-500'
            : 'bg-gray-50 text-gray-400 hover:text-red-400 focus:ring-gray-300'
        }
      `}
    >
      <HeartIcon
        size={20}
        aria-hidden="true"
        className={isFavorite ? 'fill-current' : ''}
      />
    </button>
  );
}

/**
 * Counter with accessible controls
 */
export function AccessibleCounter(): JSX.Element {
  const [count, setCount] = useState(1);

  return (
    <div className="flex items-center gap-3">
      <AccessibleIconButton
        icon={MinusIcon}
        label="Decrease count"
        onClick={() => setCount(Math.max(1, count - 1))}
        variant="ghost"
        disabled={count <= 1}
      />
      <div
        className="w-16 text-center text-lg font-semibold"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span aria-label={`Current count: ${count}`}>{count}</span>
      </div>
      <AccessibleIconButton
        icon={PlusIcon}
        label="Increase count"
        onClick={() => setCount(Math.min(10, count + 1))}
        variant="ghost"
        disabled={count >= 10}
      />
    </div>
  );
}

/**
 * Expandable section with accessible controls
 */
export function AccessibleExpandable(): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = 'expandable-content';

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 rounded-lg transition-colors"
      >
        <span className="font-medium">Amenities and Services</span>
        {isExpanded ? (
          <ChevronUpIcon size={20} aria-hidden="true" />
        ) : (
          <ChevronDownIcon size={20} aria-hidden="true" />
        )}
      </button>

      {isExpanded && (
        <div id={contentId} className="p-4 pt-0 space-y-2">
          <DecorativeIcon icon={CheckIcon} text="Free WiFi" />
          <DecorativeIcon icon={CheckIcon} text="Free Parking" />
          <DecorativeIcon icon={CheckIcon} text="Air Conditioning" />
          <DecorativeIcon icon={CheckIcon} text="Kitchen" />
        </div>
      )}
    </div>
  );
}

/**
 * Keyboard navigable list
 */
export function KeyboardNavigableList(): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const items = ['Home', 'Search', 'Bookings', 'Profile'];
  const icons = [HomeIcon, SearchIcon, CalendarIcon, UserIcon];
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    itemRefs.current[selectedIndex]?.focus();
  }, [selectedIndex]);

  const handleKeyDown = (
    event: React.KeyboardEvent,
    index: number
  ): void => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        break;
      case 'Home':
        event.preventDefault();
        setSelectedIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setSelectedIndex(items.length - 1);
        break;
    }
  };

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className="bg-white rounded-lg border border-gray-200"
    >
      <ul role="list" className="divide-y divide-gray-200">
        {items.map((item, index) => {
          const IconComponent = icons[index];
          const isSelected = index === selectedIndex;

          return (
            <li key={item}>
              <button
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                onClick={() => setSelectedIndex(index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                aria-current={isSelected ? 'page' : undefined}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 text-left
                  transition-colors
                  focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500
                  ${
                    isSelected
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <IconComponent size={20} aria-hidden="true" />
                <span className="font-medium">{item}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Booking action buttons with clear labels
 */
export function BookingActions(): JSX.Element {
  return (
    <div
      role="group"
      aria-label="Booking actions"
      className="flex flex-wrap gap-3"
    >
      <AccessibleIconButton
        icon={EditIcon}
        label="Edit booking details"
        variant="ghost"
      />
      <AccessibleIconButton
        icon={ShareIcon}
        label="Share booking"
        variant="ghost"
      />
      <AccessibleIconButton
        icon={DownloadIcon}
        label="Download booking confirmation"
        variant="ghost"
      />
      <AccessibleIconButton
        icon={DeleteIcon}
        label="Cancel booking"
        variant="danger"
      />
    </div>
  );
}

/**
 * Touch target examples
 */
export function TouchTargetExamples(): JSX.Element {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold mb-6">
        Touch Targets (Minimum 44x44px)
      </h2>

      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-sm text-gray-600 mb-2">Too Small</div>
            <button
              type="button"
              aria-label="Settings"
              className="p-1 bg-gray-100 rounded text-gray-700"
            >
              <SettingsIcon size={16} aria-hidden="true" />
            </button>
            <div className="text-xs text-red-600 mt-2">
              24px × 24px
              <br />❌ Not accessible
            </div>
          </div>

          <div className="text-center">
            <div className="text-sm text-gray-600 mb-2">Acceptable</div>
            <button
              type="button"
              aria-label="Settings"
              className="p-2 bg-gray-100 rounded text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <SettingsIcon size={20} aria-hidden="true" />
            </button>
            <div className="text-xs text-yellow-600 mt-2">
              36px × 36px
              <br />⚠ Marginal
            </div>
          </div>

          <div className="text-center">
            <div className="text-sm text-gray-600 mb-2">Good</div>
            <AccessibleIconButton
              icon={SettingsIcon}
              label="Settings"
              variant="ghost"
            />
            <div className="text-xs text-green-600 mt-2">
              44px × 44px
              <br />✓ WCAG compliant
            </div>
          </div>

          <div className="text-center">
            <div className="text-sm text-gray-600 mb-2">Excellent</div>
            <button
              type="button"
              aria-label="Settings"
              className="p-4 bg-gray-100 rounded text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              <SettingsIcon size={24} aria-hidden="true" />
            </button>
            <div className="text-xs text-green-600 mt-2">
              56px × 56px
              <br />✓✓ Optimal
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
 * Demonstrates all accessibility patterns
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
            Icon Accessibility Examples
          </h1>
          <p className="text-lg text-gray-600">
            Comprehensive guide to accessible icon usage following WCAG 2.1 AA
            standards
          </p>
        </header>

        {/* Icon-only buttons */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Icon-Only Buttons</h2>
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <p className="text-gray-600 mb-4">
              Icon-only buttons MUST have aria-label for screen readers
            </p>
            <div className="flex flex-wrap gap-3">
              <AccessibleIconButton
                icon={HeartIcon}
                label="Add to favorites"
                variant="ghost"
              />
              <AccessibleIconButton
                icon={ShareIcon}
                label="Share this page"
                variant="ghost"
              />
              <AccessibleIconButton
                icon={SettingsIcon}
                label="Open settings"
                variant="ghost"
              />
              <AccessibleIconButton
                icon={BellIcon}
                label="View notifications"
                variant="ghost"
              />
            </div>
          </div>
        </section>

        {/* Icon + text buttons */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Icon + Text Buttons</h2>
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <p className="text-gray-600 mb-4">
              Text labels make icons decorative (use aria-hidden="true")
            </p>
            <div className="flex flex-wrap gap-3">
              <IconTextButton
                icon={SearchIcon}
                label="Search accommodations"
                variant="primary"
              />
              <IconTextButton
                icon={PlusIcon}
                label="Create booking"
                variant="secondary"
              />
              <IconTextButton
                icon={DownloadIcon}
                label="Download receipt"
                variant="outline"
                iconPosition="right"
              />
            </div>
          </div>
        </section>

        {/* Decorative vs semantic icons */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">
            Decorative vs Semantic Icons
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h3 className="font-semibold mb-4">
                Decorative Icons (aria-hidden="true")
              </h3>
              <div className="space-y-2">
                <DecorativeIcon icon={MapPinIcon} text="Concepción del Uruguay" />
                <DecorativeIcon icon={CalendarIcon} text="Check-in: Jan 15, 2024" />
                <DecorativeIcon icon={ClockIcon} text="3:00 PM" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h3 className="font-semibold mb-4">
                Semantic Icons (with aria-label)
              </h3>
              <div className="space-y-3">
                <StatusIcon type="success" message="Booking confirmed successfully" />
                <StatusIcon type="error" message="Payment failed, please try again" />
                <StatusIcon type="warning" message="Check-in time is approaching" />
              </div>
            </div>
          </div>
        </section>

        {/* Interactive states */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">
            Interactive States with ARIA
          </h2>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="font-semibold mb-3">Toggle Button</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Uses aria-pressed to indicate state
                </p>
                <AccessibleToggle />
              </div>

              <div>
                <h3 className="font-semibold mb-3">Favorite Button</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Label changes with state
                </p>
                <AccessibleFavorite />
              </div>

              <div>
                <h3 className="font-semibold mb-3">Counter Controls</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Live region announces changes
                </p>
                <AccessibleCounter />
              </div>
            </div>
          </div>
        </section>

        {/* Keyboard navigation */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Keyboard Navigation</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h3 className="font-semibold mb-4">Navigation List</h3>
              <p className="text-sm text-gray-600 mb-4">
                Use Arrow keys, Home, End to navigate
              </p>
              <KeyboardNavigableList />
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h3 className="font-semibold mb-4">Expandable Section</h3>
              <p className="text-sm text-gray-600 mb-4">
                Uses aria-expanded and aria-controls
              </p>
              <AccessibleExpandable />
            </div>
          </div>
        </section>

        {/* Touch targets */}
        <TouchTargetExamples />

        {/* Focus management */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Focus Management</h2>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <p className="text-gray-600 mb-4">
              All interactive icons have visible focus indicators (try pressing
              Tab)
            </p>
            <BookingActions />
          </div>
        </section>

        {/* Best practices */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Accessibility Best Practices</h2>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckIcon size={20} className="text-green-600" />
                  DO: Provide text alternatives
                </h3>
                <p className="text-gray-600 ml-7">
                  Use aria-label for icon-only buttons, visible text when
                  possible
                </p>
                <div className="ml-7 mt-2 p-3 bg-gray-50 rounded-lg font-mono text-sm">
                  {`<button aria-label="Close dialog">`}
                  <br />
                  {`  <XIcon aria-hidden="true" />`}
                  <br />
                  {`</button>`}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckIcon size={20} className="text-green-600" />
                  DO: Ensure minimum touch target size
                </h3>
                <p className="text-gray-600 ml-7">
                  Minimum 44x44px for WCAG 2.1 Level AA compliance
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckIcon size={20} className="text-green-600" />
                  DO: Provide visible focus indicators
                </h3>
                <p className="text-gray-600 ml-7">
                  Use focus:ring or similar styles for keyboard navigation
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckIcon size={20} className="text-green-600" />
                  DO: Use semantic HTML and ARIA
                </h3>
                <p className="text-gray-600 ml-7">
                  Proper roles, states, and properties for screen readers
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircleIcon size={20} className="text-orange-600" />
                  DON'T: Rely only on color to convey meaning
                </h3>
                <p className="text-gray-600 ml-7">
                  Include text labels, icons, or patterns in addition to color
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircleIcon size={20} className="text-orange-600" />
                  DON'T: Remove focus outlines
                </h3>
                <p className="text-gray-600 ml-7">
                  Never use outline: none without providing alternative focus
                  styles
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Testing notes */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Testing Accessibility</h2>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Keyboard Testing</h3>
                <ul className="text-gray-600 space-y-1 ml-4">
                  <li>• Tab/Shift+Tab: Navigate through interactive elements</li>
                  <li>• Enter/Space: Activate buttons and controls</li>
                  <li>• Arrow keys: Navigate lists and menus</li>
                  <li>• Escape: Close dialogs and menus</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Screen Reader Testing</h3>
                <ul className="text-gray-600 space-y-1 ml-4">
                  <li>• NVDA (Windows - Free)</li>
                  <li>• JAWS (Windows - Commercial)</li>
                  <li>• VoiceOver (macOS/iOS - Built-in)</li>
                  <li>• TalkBack (Android - Built-in)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Automated Testing Tools</h3>
                <ul className="text-gray-600 space-y-1 ml-4">
                  <li>• axe DevTools (Browser extension)</li>
                  <li>• Lighthouse (Chrome DevTools)</li>
                  <li>• WAVE (Web accessibility evaluation tool)</li>
                  <li>• Pa11y (Command-line tool)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Manual Checks</h3>
                <ul className="text-gray-600 space-y-1 ml-4">
                  <li>• Verify all icons have appropriate labels</li>
                  <li>• Check color contrast ratios (4.5:1 minimum)</li>
                  <li>• Test with browser zoom at 200%</li>
                  <li>• Verify touch targets on mobile devices</li>
                  <li>• Test keyboard-only navigation flow</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* WCAG compliance */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">WCAG 2.1 Level AA Compliance</h2>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckIcon size={20} className="text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold">1.1.1 Non-text Content (A)</div>
                  <div className="text-gray-600">
                    All icons have text alternatives via aria-label or visible
                    text
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckIcon size={20} className="text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold">2.1.1 Keyboard (A)</div>
                  <div className="text-gray-600">
                    All icon buttons are keyboard accessible
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckIcon size={20} className="text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold">2.4.7 Focus Visible (AA)</div>
                  <div className="text-gray-600">
                    Visible focus indicators on all interactive icons
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckIcon size={20} className="text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold">2.5.5 Target Size (AAA)</div>
                  <div className="text-gray-600">
                    Minimum 44x44px touch targets for all icon buttons
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckIcon size={20} className="text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold">
                    4.1.2 Name, Role, Value (A)
                  </div>
                  <div className="text-gray-600">
                    Proper ARIA attributes for all interactive icons
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
