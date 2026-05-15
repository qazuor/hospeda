import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import { Input, Label } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import * as React from 'react';

/**
 * Props for TextField component
 */
export interface TextFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current field value */
    value?: string;
    /** Change handler */
    onChange?: (value: string) => void;
    /** Blur handler */
    onBlur?: () => void;
    /** Focus handler */
    onFocus?: () => void;
    /** Whether the field has an error */
    hasError?: boolean;
    /** Error message to display */
    errorMessage?: string;
    /** Whether the field is disabled */
    disabled?: boolean;
    /** Whether the field is required */
    required?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** HTML input type (default 'text'). Used by NUMBER, DATE, TIME fields. */
    type?: string;
    /** Optional native min attribute (used when type='number'). */
    min?: number | string;
    /** Optional native max attribute (used when type='number'). */
    max?: number | string;
    /** Optional native step attribute (used when type='number'). */
    step?: number | string;
}

/**
 * TextField component for text input fields
 * Handles TEXT field type from FieldConfig
 */
export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
    (
        {
            config,
            value = '',
            onChange,
            onBlur,
            onFocus,
            hasError = false,
            errorMessage,
            disabled = false,
            required = false,
            className,
            type = 'text',
            min,
            max,
            step,
            ...props
        },
        ref
    ) => {
        // Use direct translations from config
        const label = config.label;
        const description = config.description;
        const placeholder = config.placeholder;
        const helper = config.help;

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange?.(e.target.value);
        };

        const fieldId = `field-${config.id}`;
        const errorId = hasError ? `${fieldId}-error` : undefined;
        const descriptionId = description ? `${fieldId}-description` : undefined;
        const helperId = helper ? `${fieldId}-helper` : undefined;

        return (
            <div className={cn('space-y-2', className)}>
                {/* Label */}
                {label && (
                    <Label
                        htmlFor={fieldId}
                        className={cn(
                            required && 'after:ml-0.5 after:text-destructive after:content-["*"]'
                        )}
                    >
                        {label}
                    </Label>
                )}

                {/* Description */}
                {description && (
                    <p
                        id={descriptionId}
                        className="text-muted-foreground text-sm"
                    >
                        {description}
                    </p>
                )}

                {/* Input Field */}
                <Input
                    ref={ref}
                    id={fieldId}
                    type={type}
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={handleChange}
                    onBlur={onBlur}
                    onFocus={onFocus}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    className={cn(
                        hasError && 'border-destructive focus-visible:ring-destructive',
                        config.className
                    )}
                    aria-invalid={hasError}
                    aria-describedby={cn(errorId, descriptionId, helperId).trim() || undefined}
                    {...props}
                />

                {/* Helper Text */}
                {helper && !hasError && (
                    <p
                        id={helperId}
                        className="text-muted-foreground text-sm"
                    >
                        {helper}
                    </p>
                )}

                {/* Error Message */}
                {hasError && errorMessage && (
                    <p
                        id={errorId}
                        className="text-destructive text-sm"
                    >
                        {errorMessage}
                    </p>
                )}
            </div>
        );
    }
);

TextField.displayName = 'TextField';
