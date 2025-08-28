/**
 * @file Dynamic Icon Component
 *
 * This component provides a unified interface for rendering icons with:
 * - Dynamic icon loading by name
 * - Consistent sizing and styling
 * - Fallback handling for missing icons
 * - Accessibility support
 */

import { cn } from '@/lib/utils';
import { forwardRef } from 'react';
import { FallbackIcon, ICON_REGISTRY, type IconName, hasIcon } from './IconRegistry';

/**
 * Icon size variants
 */
export const ICON_SIZES = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
    xl: 'h-8 w-8',
    '2xl': 'h-10 w-10'
} as const;

/**
 * Icon component props
 */
export type IconProps = {
    /** Icon name from the registry */
    readonly name: IconName | string;
    /** Icon size */
    readonly size?: keyof typeof ICON_SIZES;
    /** Additional CSS classes */
    readonly className?: string;
    /** Accessibility label */
    readonly ariaLabel?: string;
    /** Whether the icon is decorative (hidden from screen readers) */
    readonly decorative?: boolean;
    /** Color variant */
    readonly variant?: 'default' | 'muted' | 'success' | 'warning' | 'error' | 'primary';
};

/**
 * Dynamic Icon Component
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Icon name="home" />
 *
 * // With size and styling
 * <Icon name="user" size="lg" className="text-blue-500" />
 *
 * // With accessibility
 * <Icon name="settings" ariaLabel="Settings" />
 *
 * // Decorative icon (hidden from screen readers)
 * <Icon name="star" decorative />
 *
 * // With color variant
 * <Icon name="alert-triangle" variant="error" />
 * ```
 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(
    (
        {
            name,
            size = 'md',
            className,
            ariaLabel,
            decorative = false,
            variant = 'default',
            ...props
        },
        ref
    ) => {
        // Get the icon component
        const IconComponent = hasIcon(name) ? ICON_REGISTRY[name] : FallbackIcon;

        // Determine accessibility attributes
        const accessibilityProps = decorative
            ? { 'aria-hidden': true }
            : {
                  'aria-label': ariaLabel || `${name} icon`,
                  role: 'img'
              };

        return (
            <IconComponent
                ref={ref}
                className={cn(
                    // Base styles
                    'inline-block flex-shrink-0',
                    // Size
                    ICON_SIZES[size],
                    // Color variants
                    variant === 'default' && 'text-current',
                    variant === 'muted' && 'text-muted-foreground',
                    variant === 'success' && 'text-green-600',
                    variant === 'warning' && 'text-yellow-600',
                    variant === 'error' && 'text-red-600',
                    variant === 'primary' && 'text-primary',
                    className
                )}
                {...accessibilityProps}
                {...props}
            />
        );
    }
);

Icon.displayName = 'Icon';
