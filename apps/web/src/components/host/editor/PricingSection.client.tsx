/**
 * @file PricingSection.client.tsx
 * @description Form section for accommodation pricing: basePrice (editable)
 * and currency (static ARS indicator — see BETA-137).
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
 * Renders an editable basePrice (number) input and a static, read-only
 * currency indicator (BETA-137: multi-currency isn't implemented, so the
 * old ARS/USD select is hidden until it ships).
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
                    <span className={styles.fieldLabel}>
                        {t('host.properties.editor.field.currency', 'Moneda')}
                    </span>
                    {/*
                     * BETA-137: multi-currency is NOT implemented yet, so the
                     * currency SELECT (ARS/USD) is hidden — hosts cannot change
                     * it. This is a static, read-only indicator instead, kept
                     * so the two-column .row layout stays intact. Re-introduce
                     * the interactive select once multi-currency ships.
                     */}
                    <p
                        id="acc-currency-static"
                        className={styles.currencyStatic}
                    >
                        {t('host.properties.editor.field.currencyFixedArs', 'ARS — Peso argentino')}
                    </p>
                </div>
            </div>
        </fieldset>
    );
}
