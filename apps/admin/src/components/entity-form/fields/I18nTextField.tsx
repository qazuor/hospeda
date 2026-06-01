import { FieldWrapper } from '@/components/entity-form/components/FieldWrapper';
import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import { Input, Textarea } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import type { I18nText } from '@repo/schemas';
import * as React from 'react';

/**
 * Supported locales for i18n text fields.
 */
const LOCALES = ['es', 'en', 'pt'] as const;
type Locale = (typeof LOCALES)[number];

/**
 * Per-locale label map (static, no i18n key needed — locale codes are universal).
 */
const LOCALE_LABELS: Record<Locale, string> = {
    es: 'ES',
    en: 'EN',
    pt: 'PT'
};

/**
 * Props for I18nTextField — renders one input per locale (es / en / pt).
 */
export interface I18nTextFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current i18n text value */
    value?: Partial<I18nText> | null;
    /** Change handler — receives the updated i18n object */
    onChange?: (value: I18nText) => void;
    /** Blur handler */
    onBlur?: () => void;
    /** Whether the field has an error */
    hasError?: boolean;
    /** Top-level error message (e.g. "Required") */
    errorMessage?: string;
    /** Per-locale error messages keyed by locale code */
    localeErrors?: Partial<Record<Locale, string>>;
    /** Whether the field is disabled */
    disabled?: boolean;
    /** Whether the field is required */
    required?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Whether to render as textarea (I18N_TEXTAREA) */
    multiline?: boolean;
    /** Max character length per locale — used for char counter */
    maxLength?: number;
    /** Textarea rows (only when multiline=true) */
    rows?: number;
}

/**
 * I18nTextField — renders a labeled group of inputs for all supported locales.
 *
 * Used for entity `name` and `description` fields whose data shape changed from
 * `string` to `{ es: string; en: string; pt: string }` (SPEC-172 PR2).
 *
 * The outer `FieldWrapper` carries the top-level field label + description +
 * global error. Each locale renders its own small labeled input with a
 * language badge and inline char counter when `maxLength` is provided.
 */
export const I18nTextField = React.forwardRef<HTMLDivElement, I18nTextFieldProps>(
    (
        {
            config,
            value,
            onChange,
            onBlur,
            hasError = false,
            errorMessage,
            localeErrors,
            disabled = false,
            required = false,
            className,
            multiline = false,
            maxLength,
            rows = 2
        },
        ref
    ) => {
        const fieldId = `field-${config.id}`;

        /** Coerce incoming value to a full I18nText object with empty-string fallbacks. */
        const safeValue: I18nText = {
            es: value?.es ?? '',
            en: value?.en ?? '',
            pt: value?.pt ?? ''
        };

        const handleLocaleChange = (locale: Locale, newLocaleValue: string) => {
            onChange?.({ ...safeValue, [locale]: newLocaleValue });
        };

        return (
            <div
                ref={ref}
                className={cn('space-y-3', className)}
            >
                <FieldWrapper
                    fieldId={fieldId}
                    label={config.label}
                    required={required}
                    description={config.description}
                    hasError={hasError}
                    errorMessage={errorMessage}
                    mode="edit"
                >
                    {/* Render one input per locale */}
                    <div className="space-y-2">
                        {LOCALES.map((locale) => {
                            const localeFieldId = `${fieldId}-${locale}`;
                            const localeValue = safeValue[locale];
                            const localeError = localeErrors?.[locale];
                            const hasLocaleError = Boolean(localeError);

                            return (
                                <div
                                    key={locale}
                                    className="flex flex-col gap-1"
                                >
                                    {/* Locale label row */}
                                    <div className="flex items-center gap-1.5">
                                        <label
                                            htmlFor={localeFieldId}
                                            className={cn(
                                                'flex items-center gap-1 font-medium text-xs leading-none',
                                                hasLocaleError
                                                    ? 'text-destructive'
                                                    : 'text-muted-foreground'
                                            )}
                                        >
                                            <span className="inline-flex h-4 w-7 items-center justify-center rounded-sm bg-muted px-1 font-mono text-[10px] uppercase tracking-wider">
                                                {LOCALE_LABELS[locale]}
                                            </span>
                                        </label>
                                    </div>

                                    {/* Input widget */}
                                    {multiline ? (
                                        <Textarea
                                            id={localeFieldId}
                                            value={localeValue}
                                            onChange={(e) =>
                                                handleLocaleChange(locale, e.target.value)
                                            }
                                            onBlur={onBlur}
                                            placeholder={config.placeholder}
                                            disabled={disabled}
                                            rows={rows}
                                            className={cn(
                                                'resize-none text-sm',
                                                hasLocaleError &&
                                                    'border-destructive focus-visible:ring-destructive'
                                            )}
                                            aria-invalid={hasLocaleError}
                                            aria-describedby={
                                                hasLocaleError
                                                    ? `${localeFieldId}-error`
                                                    : undefined
                                            }
                                        />
                                    ) : (
                                        <Input
                                            id={localeFieldId}
                                            type="text"
                                            value={localeValue}
                                            onChange={(e) =>
                                                handleLocaleChange(locale, e.target.value)
                                            }
                                            onBlur={onBlur}
                                            placeholder={config.placeholder}
                                            disabled={disabled}
                                            className={cn(
                                                'text-sm',
                                                hasLocaleError &&
                                                    'border-destructive focus-visible:ring-destructive'
                                            )}
                                            aria-invalid={hasLocaleError}
                                            aria-describedby={
                                                hasLocaleError
                                                    ? `${localeFieldId}-error`
                                                    : undefined
                                            }
                                        />
                                    )}

                                    {/* Locale-level error or char counter */}
                                    {(hasLocaleError || maxLength !== undefined) && (
                                        <div className="flex items-start justify-between gap-2">
                                            {hasLocaleError && localeError ? (
                                                <p
                                                    id={`${localeFieldId}-error`}
                                                    className="text-destructive text-xs"
                                                    role="alert"
                                                >
                                                    ⚠ {localeError}
                                                </p>
                                            ) : (
                                                <span />
                                            )}
                                            {maxLength !== undefined && (
                                                <span
                                                    className={cn(
                                                        'text-xs tabular-nums',
                                                        localeValue.length > maxLength
                                                            ? 'text-destructive'
                                                            : 'text-muted-foreground'
                                                    )}
                                                >
                                                    {localeValue.length}/{maxLength}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </FieldWrapper>
            </div>
        );
    }
);

I18nTextField.displayName = 'I18nTextField';
