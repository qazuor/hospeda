import { FieldAffix } from '@/components/entity-form/components/FieldAffix';
import { FieldWrapper } from '@/components/entity-form/components/FieldWrapper';
import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    FieldConfig,
    TextFieldConfig
} from '@/components/entity-form/types/field-config.types';
import { Input } from '@/components/ui-wrapped';
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
 * TextField component for text input fields.
 *
 * Uses the redesigned FieldWrapper (label-above, help icon, error, char counter)
 * and FieldAffix for prefix/suffix from config.prefix / config.suffix.
 * Per spec §4.2 — prefix/suffix come from FieldConfig, not hardcoded.
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
        const label = config.label;
        const description = config.description;
        const placeholder = config.placeholder;

        // Extract maxLength from typeConfig for char counter (TEXT fields only)
        const textConfig =
            config.type === FieldTypeEnum.TEXT
                ? (config.typeConfig as TextFieldConfig | undefined)
                : undefined;
        const maxLength = textConfig?.maxLength;

        const fieldId = `field-${config.id}`;
        const errorId = hasError ? `${fieldId}-error` : undefined;

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange?.(e.target.value);
        };

        const inputElement = (
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
                aria-describedby={errorId || undefined}
                {...props}
            />
        );

        return (
            <FieldWrapper
                fieldId={fieldId}
                label={label}
                required={required}
                description={description}
                hasError={hasError}
                errorMessage={errorMessage}
                mode="edit"
                charCount={maxLength !== undefined ? (value ?? '').length : undefined}
                maxLength={maxLength}
                className={className}
            >
                {config.prefix || config.suffix ? (
                    <FieldAffix
                        prefix={config.prefix}
                        suffix={config.suffix}
                    >
                        {inputElement}
                    </FieldAffix>
                ) : (
                    inputElement
                )}
            </FieldWrapper>
        );
    }
);

TextField.displayName = 'TextField';
