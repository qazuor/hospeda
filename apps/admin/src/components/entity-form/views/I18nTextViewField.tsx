import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import { Label } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import type { I18nText } from '@repo/schemas';
import * as React from 'react';

const LOCALES = ['es', 'en', 'pt'] as const;
type Locale = (typeof LOCALES)[number];

const LOCALE_LABELS: Record<Locale, string> = {
    es: 'ES',
    en: 'EN',
    pt: 'PT'
};

/**
 * Props for I18nTextViewField component.
 */
export interface I18nTextViewFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current i18n text value */
    value?: Partial<I18nText> | null;
    /** Additional CSS classes */
    className?: string;
    /** Whether to show the field label */
    showLabel?: boolean;
    /** Whether to show the description (unused in view mode per spec §4.2) */
    showDescription?: boolean;
}

/**
 * I18nTextViewField — displays a localized text field in read-only view mode.
 *
 * Shows all three locales (es / en / pt) as labeled rows so admins can verify
 * all translations at a glance. Empty locales are rendered with an italic
 * "no value" placeholder.
 */
export const I18nTextViewField = React.forwardRef<HTMLDivElement, I18nTextViewFieldProps>(
    (
        { config, value, className, showLabel = true, showDescription: _showDescription = false },
        ref
    ) => {
        const label = config.label;

        const safeValue: I18nText = {
            es: value?.es ?? '',
            en: value?.en ?? '',
            pt: value?.pt ?? ''
        };

        const hasAnyValue = LOCALES.some((l) => safeValue[l].length > 0);

        return (
            <div
                ref={ref}
                className={cn('space-y-1', className)}
            >
                {showLabel && label && (
                    <Label className="font-medium text-muted-foreground text-sm">{label}</Label>
                )}

                {hasAnyValue ? (
                    <div className="space-y-1">
                        {LOCALES.map((locale) => {
                            const localeValue = safeValue[locale];
                            return (
                                <div
                                    key={locale}
                                    className="flex items-start gap-2"
                                >
                                    <span className="mt-0.5 inline-flex h-4 w-7 shrink-0 items-center justify-center rounded-sm bg-muted px-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                                        {LOCALE_LABELS[locale]}
                                    </span>
                                    <span
                                        className={cn(
                                            'text-sm',
                                            !localeValue && 'text-muted-foreground italic'
                                        )}
                                    >
                                        {localeValue || '—'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-muted-foreground text-sm italic">—</div>
                )}
            </div>
        );
    }
);

I18nTextViewField.displayName = 'I18nTextViewField';
