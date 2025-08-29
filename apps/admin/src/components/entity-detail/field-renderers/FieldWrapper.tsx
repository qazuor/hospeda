/**
 * @file FieldWrapper Component
 *
 * Common wrapper component for all field renderers that provides consistent
 * layout, labeling, error display, help text, and accessibility features.
 */

import { Icon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { memo } from 'react';
import type { FieldConfig } from '../types';

/**
 * Props for the FieldWrapper component
 */
type FieldWrapperProps = {
    readonly field: FieldConfig;
    readonly error?: string;
    readonly children: React.ReactNode;
    readonly className?: string;
};

/**
 * FieldWrapper component that provides consistent field layout and labeling
 */
export const FieldWrapper = memo(({ field, error, children, className }: FieldWrapperProps) => {
    const fieldId = `field-${field.name}`;
    const errorId = `${fieldId}-error`;
    const helpId = `${fieldId}-help`;

    return (
        <div
            className={cn('field-wrapper space-y-2', className)}
            data-field={field.name}
        >
            {/* Field Label */}
            <div className="flex items-center gap-2">
                <label
                    htmlFor={fieldId}
                    className={cn(
                        'font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                        field.required && "after:ml-0.5 after:text-destructive after:content-['*']"
                    )}
                >
                    {field.label}
                </label>

                {field.tooltip && (
                    <div className="group relative">
                        <Icon
                            name="Info"
                            className="h-4 w-4 cursor-help text-muted-foreground"
                        />
                        <div className="-translate-x-1/2 pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 transform whitespace-nowrap rounded bg-black px-2 py-1 text-white text-xs opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                            {field.tooltip}
                        </div>
                    </div>
                )}
            </div>

            {/* Field Description */}
            {field.description && (
                <p className="text-muted-foreground text-sm">{field.description}</p>
            )}

            {/* Field Input */}
            <div className="relative">{children}</div>

            {/* Error Message */}
            {error && (
                <div
                    id={errorId}
                    className="flex items-center gap-2 text-destructive text-sm"
                    role="alert"
                    aria-live="polite"
                >
                    <Icon
                        name="AlertCircle"
                        className="h-4 w-4"
                    />
                    <span>{error}</span>
                </div>
            )}

            {/* Help Text */}
            {field.helpText && !error && (
                <p
                    id={helpId}
                    className="text-muted-foreground text-sm"
                >
                    {field.helpText}
                </p>
            )}
        </div>
    );
});

FieldWrapper.displayName = 'FieldWrapper';
