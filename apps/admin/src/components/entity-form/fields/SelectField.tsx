import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    FieldConfig,
    SelectFieldConfig,
    SelectOption
} from '@/components/entity-form/types/field-config.types';
import {
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';

import * as React from 'react';

/**
 * Props for SelectField component
 */
export interface SelectFieldProps {
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
    /** Options for the select */
    options?: SelectOption[];
    /** Loading state */
    loading?: boolean;
}

/**
 * SelectField component for dropdown selection fields
 * Handles SELECT field type from FieldConfig
 */
export const SelectField = React.forwardRef<HTMLButtonElement, SelectFieldProps>(
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
            options = [],
            loading = false,
            ...props
        },
        ref
    ) => {
        // Use direct translations from config
        const label = config.label;
        const description = config.description;
        const placeholder = config.placeholder;
        const helper = config.help;

        const handleValueChange = (newValue: string) => {
            // Handle special values
            if (newValue === '__CLEAR__') {
                onChange?.('');
            } else if (newValue === '__EMPTY__' || newValue === '__LOADING__') {
                // Ignore these special values
                return;
            } else {
                onChange?.(newValue);
            }
        };

        const fieldId = `field-${config.id}`;
        const errorId = hasError ? `${fieldId}-error` : undefined;
        const descriptionId = description ? `${fieldId}-description` : undefined;
        const helperId = helper ? `${fieldId}-helper` : undefined;

        // Get select-specific config
        const selectConfig =
            config.type === FieldTypeEnum.SELECT
                ? (config.typeConfig as SelectFieldConfig)
                : undefined;
        const allowClear = selectConfig?.clearable;

        // Find selected option for display
        const selectedOption = options.find((option) => option.value === value);

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

                {/* Select Field */}
                <Select
                    value={value}
                    onValueChange={handleValueChange}
                    disabled={disabled || loading}
                    required={required}
                    {...props}
                >
                    <SelectTrigger
                        ref={ref}
                        id={fieldId}
                        className={cn(
                            hasError && 'border-destructive focus:ring-destructive',
                            config.className
                        )}
                        aria-invalid={hasError}
                        aria-describedby={cn(errorId, descriptionId, helperId).trim() || undefined}
                        onBlur={onBlur}
                        onFocus={onFocus}
                    >
                        <SelectValue placeholder={placeholder || 'Select an option...'}>
                            {loading ? 'Loading...' : selectedOption?.label || placeholder}
                        </SelectValue>
                    </SelectTrigger>

                    <SelectContent>
                        {/* Clear option if allowed */}
                        {allowClear && value && (
                            <SelectItem value="__CLEAR__">
                                <span className="text-muted-foreground">Clear selection</span>
                            </SelectItem>
                        )}

                        {/* Options */}
                        {options
                            .filter((option) => option.value !== '' && option.value != null)
                            .map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                    disabled={option.disabled}
                                    className={cn(
                                        option.disabled && 'cursor-not-allowed opacity-50'
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        {(() => {
                                            const icon = option.metadata?.icon;
                                            if (icon && typeof icon === 'string') {
                                                return (
                                                    <span className="text-muted-foreground">
                                                        {icon}
                                                    </span>
                                                );
                                            }
                                            return null;
                                        })()}

                                        <div className="flex flex-col">
                                            <span>{option.label}</span>
                                            {option.description && (
                                                <span className="text-muted-foreground text-xs">
                                                    {option.description}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </SelectItem>
                            ))}

                        {/* Empty state */}
                        {!loading && options.length === 0 && (
                            <SelectItem
                                value="__EMPTY__"
                                disabled
                            >
                                <span className="text-muted-foreground">No options available</span>
                            </SelectItem>
                        )}

                        {/* Loading state */}
                        {loading && (
                            <SelectItem
                                value="__LOADING__"
                                disabled
                            >
                                <span className="text-muted-foreground">Loading options...</span>
                            </SelectItem>
                        )}
                    </SelectContent>
                </Select>

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

SelectField.displayName = 'SelectField';
