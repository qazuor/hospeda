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
import { ICON_SIZES as PACKAGE_ICON_SIZES } from '@repo/icons';
import { forwardRef } from 'react';
import { FallbackIcon, ICON_REGISTRY, type IconName, hasIcon } from './IconRegistry';

/**
 * Tailwind CSS class mapping for icon sizing in admin layout.
 * These classes set the rendered dimensions via CSS, overriding
 * the SVG's intrinsic width/height from @repo/icons ICON_SIZES.
 */
export const ICON_SIZE_CLASSES = {
    xs: 'h-3 w-3', // 12px
    sm: 'h-4 w-4', // 16px
    md: 'h-5 w-5', // 20px
    lg: 'h-6 w-6', // 24px
    xl: 'h-8 w-8', // 32px
    '2xl': 'h-10 w-10' // 40px (admin-only)
} as const;

/**
 * Maps admin size keys to pixel values for the underlying icon's
 * SVG intrinsic dimensions. Uses @repo/icons ICON_SIZES where available.
 */
const ICON_SIZE_MAP: Record<keyof typeof ICON_SIZE_CLASSES, number> = {
    xs: PACKAGE_ICON_SIZES.xs,
    sm: PACKAGE_ICON_SIZES.sm,
    md: PACKAGE_ICON_SIZES.md,
    lg: PACKAGE_ICON_SIZES.lg,
    xl: PACKAGE_ICON_SIZES.xl,
    '2xl': 40
};

/**
 * Icon component props
 */
export type IconProps = {
    /** Icon name from the registry */
    readonly name: IconName | string;
    /** Icon size */
    readonly size?: keyof typeof ICON_SIZE_CLASSES;
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
                size={ICON_SIZE_MAP[size]}
                className={cn(
                    // Base styles
                    'inline-block flex-shrink-0',
                    // Size (Tailwind classes override SVG intrinsic dimensions)
                    ICON_SIZE_CLASSES[size],
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
