/**
 * @file PricingSection.client.tsx
 * @description Form section for accommodation pricing: basePrice and currency.
 * Uses native HTML form elements.
 */

import type { AccommodationEditData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './PricingSection.module.css';

/** Props for PricingSection. */
export interface PricingSectionProps {
    readonly locale: SupportedLocale;
    readonly data: AccommodationEditData;
    readonly errors: Readonly<{ basePrice?: string; currency?: string }>;
    readonly onFieldChange: (
        field: keyof AccommodationEditData,
        value: number | string | null
    ) => void;
}

/**
 * Pricing form section.
 * Renders basePrice (number) and currency (select: ARS/USD) inputs.
 */
export function PricingSection({ locale, data, errors, onFieldChange }: PricingSectionProps) {
    const { t } = createTranslations(locale);

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.pricing', 'Precio')}
            </legend>

            <div className={styles.row}>
                <div className={styles.field}>
                    <label
                        htmlFor="acc-basePrice"
                        className={styles.fieldLabel}
                    >
                        {t('host.properties.editor.field.price', 'Precio por noche')}
                    </label>
                    <input
                        id="acc-basePrice"
                        type="number"
                        className={styles.fieldInput}
                        value={data.basePrice ?? ''}
                        min={0}
                        step={100}
                        onChange={(e) =>
                            onFieldChange(
                                'basePrice',
                                e.target.value === '' ? null : Number(e.target.value)
                            )
                        }
                        aria-invalid={Boolean(errors.basePrice)}
                        aria-describedby={errors.basePrice ? 'acc-basePrice-error' : undefined}
                    />
                    {errors.basePrice && (
                        <span
                            id="acc-basePrice-error"
                            className={styles.fieldError}
                            role="alert"
                        >
                            {errors.basePrice}
                        </span>
                    )}
                </div>

                <div className={styles.field}>
                    <label
                        htmlFor="acc-currency"
                        className={styles.fieldLabel}
                    >
                        {t('host.properties.editor.field.currency', 'Moneda')}
                    </label>
                    <select
                        id="acc-currency"
                        className={styles.fieldInput}
                        value={data.currency ?? 'ARS'}
                        onChange={(e) => onFieldChange('currency', e.target.value)}
                        aria-invalid={Boolean(errors.currency)}
                        aria-describedby={errors.currency ? 'acc-currency-error' : undefined}
                    >
                        <option value="ARS">ARS — Peso argentino</option>
                        <option value="USD">USD — Dólar</option>
                    </select>
                    {errors.currency && (
                        <span
                            id="acc-currency-error"
                            className={styles.fieldError}
                            role="alert"
                        >
                            {errors.currency}
                        </span>
                    )}
                </div>
            </div>
        </fieldset>
    );
}
