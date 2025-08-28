/**
 * @file Wrapped Button Component
 *
 * This component wraps the Shadcn Button component to provide:
 * - Consistent API across the application
 * - Easy migration path to other UI libraries
 * - Additional functionality and customization
 * - Better TypeScript support with our own types
 */

import {
    Button as ShadcnButton,
    type ButtonProps as ShadcnButtonProps
} from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

/**
 * Enhanced Button Props with additional functionality
 */
export type ButtonProps = ShadcnButtonProps & {
    /** Loading state - shows spinner and disables button */
    readonly loading?: boolean;
    /** Icon to display before the button text */
    readonly leftIcon?: React.ReactNode;
    /** Icon to display after the button text */
    readonly rightIcon?: React.ReactNode;
    /** Full width button */
    readonly fullWidth?: boolean;
    /** Tooltip text to display on hover */
    readonly tooltip?: string;
};

/**
 * Wrapped Button Component
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Button>Click me</Button>
 *
 * // With loading state
 * <Button loading>Saving...</Button>
 *
 * // With icons
 * <Button leftIcon={<SaveIcon />}>Save</Button>
 *
 * // Full width
 * <Button fullWidth>Submit</Button>
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            loading = false,
            leftIcon,
            rightIcon,
            fullWidth = false,
            disabled,
            children,
            ...props
        },
        ref
    ) => {
        return (
            <ShadcnButton
                ref={ref}
                className={cn(fullWidth && 'w-full', className)}
                disabled={disabled || loading}
                {...props}
            >
                {loading && (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                {!loading && leftIcon && <span className="mr-2 flex items-center">{leftIcon}</span>}
                {children}
                {!loading && rightIcon && (
                    <span className="ml-2 flex items-center">{rightIcon}</span>
                )}
            </ShadcnButton>
        );
    }
);

Button.displayName = 'Button';
