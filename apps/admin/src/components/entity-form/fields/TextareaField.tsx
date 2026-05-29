import { FieldWrapper } from '@/components/entity-form/components/FieldWrapper';
import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    FieldConfig,
    TextareaFieldConfig
} from '@/components/entity-form/types/field-config.types';
import { Textarea } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
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
 * TextareaField component for multi-line text input fields.
 *
 * Uses the redesigned FieldWrapper (label-above, help icon, error, char counter)
 * and reads maxLength from typeConfig for the inline char counter.
 * Per spec §4.2 — char counter: max comes from typeConfig.maxLength, not hardcoded.
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
        const label = config.label;
        const description = config.description;
        const placeholder = config.placeholder;

        const fieldId = `field-${config.id}`;
        const errorId = hasError ? `${fieldId}-error` : undefined;

        // Get textarea-specific config for rows, resize, and maxLength
        const textareaConfig =
            config.type === FieldTypeEnum.TEXTAREA
                ? (config.typeConfig as TextareaFieldConfig | undefined)
                : undefined;
        const minRows = textareaConfig?.minRows ?? 3;
        const maxRows = textareaConfig?.maxRows;
        const resize = textareaConfig?.resize !== false;
        const maxLength = textareaConfig?.maxLength;

        const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            onChange?.(e.target.value);
        };

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
                    aria-describedby={errorId || undefined}
                    {...props}
                />
            </FieldWrapper>
        );
    }
);

TextareaField.displayName = 'TextareaField';
