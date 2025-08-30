import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import { Label, Switch } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import { useFieldI18n } from '@/lib/utils/i18n-field.utils';
import * as React from 'react';

/**
 * Props for SwitchField component
 */
export interface SwitchFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current field value */
    value?: boolean;
    /** Change handler */
    onChange?: (value: boolean) => void;
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
 * SwitchField component for boolean toggle fields
 * Handles SWITCH field type from FieldConfig
 */
export const SwitchField = React.forwardRef<HTMLButtonElement, SwitchFieldProps>(
    (
        {
            config,
            value = false,
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
        const { label, description, helper } = useFieldI18n(config.id, config.i18n);

        const handleCheckedChange = (checked: boolean) => {
            onChange?.(checked);
        };

        const fieldId = `field-${config.id}`;
        const errorId = hasError ? `${fieldId}-error` : undefined;
        const descriptionId = description ? `${fieldId}-description` : undefined;
        const helperId = helper ? `${fieldId}-helper` : undefined;

        return (
            <div className={cn('space-y-2', className)}>
                {/* Description */}
                {description && (
                    <p
                        id={descriptionId}
                        className="text-muted-foreground text-sm"
                    >
                        {description}
                    </p>
                )}

                {/* Switch with Label */}
                <div className="flex items-center justify-between space-x-3">
                    <div className="flex-1 space-y-1">
                        {label && (
                            <Label
                                htmlFor={fieldId}
                                className={cn(
                                    'font-medium text-sm leading-none',
                                    required &&
                                        'after:ml-0.5 after:text-destructive after:content-["*"]',
                                    disabled && 'cursor-not-allowed opacity-70'
                                )}
                            >
                                {label}
                            </Label>
                        )}
                    </div>

                    <Switch
                        ref={ref}
                        id={fieldId}
                        checked={value}
                        onCheckedChange={handleCheckedChange}
                        onBlur={onBlur}
                        onFocus={onFocus}
                        disabled={disabled}
                        required={required}
                        className={cn(hasError && 'border-destructive', config.className)}
                        aria-invalid={hasError}
                        aria-describedby={cn(errorId, descriptionId, helperId).trim() || undefined}
                        {...props}
                    />
                </div>

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

SwitchField.displayName = 'SwitchField';
