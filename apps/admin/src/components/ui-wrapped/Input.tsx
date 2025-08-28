/**
 * @file Wrapped Input Component
 *
 * This component wraps the Shadcn Input component to provide:
 * - Consistent API across the application
 * - Easy migration path to other UI libraries
 * - Additional functionality like icons and validation states
 */

import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

/**
 * Enhanced Input Props with additional functionality
 */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    /** Icon to display before the input */
    readonly leftIcon?: React.ReactNode;
    /** Icon to display after the input */
    readonly rightIcon?: React.ReactNode;
    /** Error state */
    readonly error?: boolean;
    /** Success state */
    readonly success?: boolean;
    /** Loading state */
    readonly loading?: boolean;
    /** Helper text */
    readonly helperText?: string;
    /** Error message */
    readonly errorMessage?: string;
    /** Label for the input */
    readonly label?: string;
    /** Required indicator */
    readonly required?: boolean;
};

/**
 * Wrapped Input Component
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Input placeholder="Enter text" />
 *
 * // With label and required
 * <Input label="Email" required />
 *
 * // With icons
 * <Input leftIcon={<SearchIcon />} placeholder="Search..." />
 *
 * // With error state
 * <Input error errorMessage="This field is required" />
 *
 * // With helper text
 * <Input helperText="Enter your full name" />
 * ```
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            className,
            type = 'text',
            leftIcon,
            rightIcon,
            error = false,
            success = false,
            loading = false,
            helperText,
            errorMessage,
            label,
            required = false,
            disabled,
            ...props
        },
        ref
    ) => {
        const hasError = error || !!errorMessage;
        const showHelperText = helperText && !hasError;

        const inputId = `input-${Math.random().toString(36).substr(2, 9)}`;

        return (
            <div className="w-full">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="mb-1 block font-medium text-gray-700 text-sm"
                    >
                        {label}
                        {required && <span className="ml-1 text-red-500">*</span>}
                    </label>
                )}

                <div className="relative">
                    {leftIcon && (
                        <div className="-translate-y-1/2 absolute top-1/2 left-3 text-gray-400">
                            {leftIcon}
                        </div>
                    )}

                    <input
                        id={inputId}
                        type={type}
                        className={cn(
                            // Base styles
                            'flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                            // Icon padding
                            leftIcon && 'pl-10',
                            rightIcon && 'pr-10',
                            // State styles
                            hasError && 'border-red-500 focus-visible:ring-red-500',
                            success && 'border-green-500 focus-visible:ring-green-500',
                            !hasError && !success && 'border-input',
                            loading && 'opacity-60',
                            className
                        )}
                        disabled={disabled || loading}
                        ref={ref}
                        {...props}
                    />

                    {(rightIcon || loading) && (
                        <div className="-translate-y-1/2 absolute top-1/2 right-3 text-gray-400">
                            {loading ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                                rightIcon
                            )}
                        </div>
                    )}
                </div>

                {hasError && errorMessage && (
                    <p className="mt-1 text-red-600 text-sm">{errorMessage}</p>
                )}

                {showHelperText && <p className="mt-1 text-gray-500 text-sm">{helperText}</p>}
            </div>
        );
    }
);

Input.displayName = 'Input';
