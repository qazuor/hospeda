/**
 * @file Wrapped Badge Component
 *
 * This component wraps the Shadcn Badge component to provide:
 * - Consistent API across the application
 * - Easy migration path to other UI libraries
 * - Additional variants and functionality
 */

import { Badge as ShadcnBadge, type BadgeProps as ShadcnBadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

/**
 * Enhanced Badge Props with additional variants
 */
export type BadgeProps = ShadcnBadgeProps & {
    /** Icon to display before the badge text */
    readonly leftIcon?: React.ReactNode;
    /** Icon to display after the badge text */
    readonly rightIcon?: React.ReactNode;
    /** Dot indicator instead of text */
    readonly dot?: boolean;
    /** Size variant */
    readonly size?: 'sm' | 'md' | 'lg';
};

/**
 * Wrapped Badge Component
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Badge>New</Badge>
 *
 * // With variants
 * <Badge variant="success">Active</Badge>
 *
 * // With icons
 * <Badge leftIcon={<CheckIcon />}>Verified</Badge>
 *
 * // Dot indicator
 * <Badge dot variant="destructive" />
 *
 * // Different sizes
 * <Badge size="sm">Small</Badge>
 * ```
 */
export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
    ({ className, leftIcon, rightIcon, dot = false, size = 'md', children, ...props }, _ref) => {
        return (
            <ShadcnBadge
                className={cn(
                    // Size variants
                    size === 'sm' && 'px-1.5 py-0.5 text-xs',
                    size === 'md' && 'px-2.5 py-0.5 text-xs', // default
                    size === 'lg' && 'px-3 py-1 text-sm',
                    // Dot variant
                    dot && 'h-2 w-2 rounded-full p-0',
                    className
                )}
                {...props}
            >
                {!dot && (
                    <>
                        {leftIcon && <span className="mr-1 flex items-center">{leftIcon}</span>}
                        {children}
                        {rightIcon && <span className="ml-1 flex items-center">{rightIcon}</span>}
                    </>
                )}
            </ShadcnBadge>
        );
    }
);

Badge.displayName = 'Badge';
