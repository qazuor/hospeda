import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import { Label, Textarea } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import { useFieldI18n } from '@/lib/utils/i18n-field.utils';
import * as React from 'react';

/**
 * Props for TextareaField component
 */
export interface TextareaFieldProps {
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
}

/**
 * TextareaField component for multi-line text input fields
 * Handles TEXTAREA field type from FieldConfig
 */
export const TextareaField = React.forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
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
            ...props
        },
        ref
    ) => {
        const { label, description, placeholder, helper } = useFieldI18n(config.id, config.i18n);

        const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            onChange?.(e.target.value);
        };

        const fieldId = `field-${config.id}`;
        const errorId = hasError ? `${fieldId}-error` : undefined;
        const descriptionId = description ? `${fieldId}-description` : undefined;
        const helperId = helper ? `${fieldId}-helper` : undefined;

        // Get textarea-specific config
        const textareaConfig =
            config.typeConfig?.type === 'TEXTAREA' ? config.typeConfig : undefined;
        const minRows = textareaConfig?.minRows || 3;
        const maxRows = textareaConfig?.maxRows;
        const resize = textareaConfig?.resize !== false;

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

                {/* Textarea Field */}
                <Textarea
                    ref={ref}
                    id={fieldId}
                    value={value}
                    onChange={handleChange}
                    onBlur={onBlur}
                    onFocus={onFocus}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    rows={minRows}
                    className={cn(
                        hasError && 'border-destructive focus-visible:ring-destructive',
                        !resize && 'resize-none',
                        maxRows && `max-h-[${maxRows * 1.5}rem]`,
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

TextareaField.displayName = 'TextareaField';
