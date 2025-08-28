/**
 * @file Wrapped Card Component
 *
 * This component wraps the Shadcn Card components to provide:
 * - Consistent API across the application
 * - Easy migration path to other UI libraries
 * - Additional functionality and customization
 */

import {
    Card as ShadcnCard,
    CardContent as ShadcnCardContent,
    CardDescription as ShadcnCardDescription,
    CardFooter as ShadcnCardFooter,
    CardHeader as ShadcnCardHeader,
    CardTitle as ShadcnCardTitle
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

/**
 * Enhanced Card Props
 */
export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
    /** Adds hover effect */
    readonly hoverable?: boolean;
    /** Adds clickable cursor */
    readonly clickable?: boolean;
    /** Loading state */
    readonly loading?: boolean;
};

/**
 * Enhanced Card Header Props
 */
export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
    /** Show divider below header */
    readonly divider?: boolean;
};

/**
 * Enhanced Card Content Props
 */
export type CardContentProps = React.HTMLAttributes<HTMLDivElement> & {
    /** Remove default padding */
    readonly noPadding?: boolean;
};

/**
 * Wrapped Card Component
 *
 * @example
 * ```tsx
 * <Card hoverable>
 *   <CardHeader divider>
 *     <CardTitle>Title</CardTitle>
 *     <CardDescription>Description</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     Content goes here
 *   </CardContent>
 * </Card>
 * ```
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ className, hoverable = false, clickable = false, loading = false, ...props }, ref) => {
        return (
            <ShadcnCard
                ref={ref}
                className={cn(
                    hoverable && 'transition-shadow hover:shadow-md',
                    clickable && 'cursor-pointer',
                    loading && 'pointer-events-none opacity-60',
                    className
                )}
                {...props}
            />
        );
    }
);
Card.displayName = 'Card';

/**
 * Wrapped Card Header Component
 */
export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
    ({ className, divider = false, ...props }, ref) => {
        return (
            <ShadcnCardHeader
                ref={ref}
                className={cn(divider && 'border-border border-b pb-4', className)}
                {...props}
            />
        );
    }
);
CardHeader.displayName = 'CardHeader';

/**
 * Wrapped Card Content Component
 */
export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
    ({ className, noPadding = false, ...props }, ref) => {
        return (
            <ShadcnCardContent
                ref={ref}
                className={cn(noPadding && 'p-0', className)}
                {...props}
            />
        );
    }
);
CardContent.displayName = 'CardContent';

/**
 * Re-export other card components as-is
 */
export const CardTitle = ShadcnCardTitle;
export const CardDescription = ShadcnCardDescription;
export const CardFooter = ShadcnCardFooter;
