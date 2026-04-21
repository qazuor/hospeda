/**
 * @file PropertyFormPrice.client.tsx
 * @description Section 6 — Price fields for the PropertyForm wizard.
 * Covers the base price (integer, in smallest unit) and currency selector.
 *
 * Schema shape for `price` (AccommodationPriceSchema extends PriceSchema):
 *   { price?: number; currency?: PriceCurrencyEnum; additionalFees?: ...; discounts?: ... }
 *
 * For MVP: only `price.price` (per-night amount) and `price.currency` are exposed.
 * The schema accepts any positive number — the API stores it as a numeric column.
 * No centavos conversion is done here; the number is stored as-is.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { PriceCurrencyEnum } from '@repo/schemas';
import styles from './PropertyForm.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for PropertyFormPrice. */
export type PropertyFormPriceProps = {
    /** Current price object from form state. */
    readonly priceValue: number | undefined;
    /** Current currency from form state. */
    readonly currencyValue: string | undefined;
    /**
     * Called when price amount changes.
     * Passes `undefined` when the input is cleared.
     */
    readonly onPriceChange: (value: number | undefined) => void;
    /** Called when currency selection changes. */
    readonly onCurrencyChange: (value: string) => void;
    /** Called on blur — triggers autosave. */
    readonly onBlur: () => void;
    /** Validation error for price.price field. */
    readonly priceError?: string;
    /** Validation error for price.currency field. */
    readonly currencyError?: string;
    /** Active locale for i18n strings. */
    readonly locale: SupportedLocale;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Section 6 — Price for the PropertyForm wizard.
 *
 * Renders a number input for the nightly price and a currency selector.
 * Uses i18n keys under `host.form.sections.precio.fields.*`.
 *
 * @example
 * ```tsx
 * <PropertyFormPrice
 *   priceValue={form.values.price?.price}
 *   currencyValue={form.values.price?.currency}
 *   onPriceChange={(v) => form.setValue('price.price', v)}
 *   onCurrencyChange={(v) => form.setValue('price.currency', v)}
 *   onBlur={handleBlur}
 *   locale={locale}
 * />
 * ```
 */
export function PropertyFormPrice({
    priceValue,
    currencyValue,
    onPriceChange,
    onCurrencyChange,
    onBlur,
    priceError,
    currencyError,
    locale
}: PropertyFormPriceProps) {
    const { t } = createTranslations(locale);

    function handlePriceInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
        const raw = e.target.value;
        if (raw === '') {
            onPriceChange(undefined);
        } else {
            const parsed = Number(raw);
            if (!Number.isNaN(parsed) && parsed > 0) {
                onPriceChange(parsed);
            }
        }
    }

    return (
        <div className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
                {/* Price amount */}
                <div className={styles.field}>
                    <label
                        className={`${styles.label} ${styles.labelRequired}`}
                        htmlFor="field-price-amount"
                    >
                        {t('host.form.sections.precio.fields.pricePerNight', 'Precio por noche')}
                    </label>
                    <input
                        id="field-price-amount"
                        type="number"
                        min={1}
                        step={1}
                        className={`${styles.numberInput} ${priceError ? styles.inputError : ''}`}
                        value={priceValue ?? ''}
                        onChange={handlePriceInputChange}
                        onBlur={onBlur}
                        aria-required="true"
                        aria-describedby={priceError ? 'error-price-amount' : undefined}
                        placeholder={t(
                            'host.form.sections.precio.fields.pricePerNightPlaceholder',
                            'Ej: 5000'
                        )}
                    />
                    {priceError && (
                        <p
                            id="error-price-amount"
                            className={styles.fieldError}
                            role="alert"
                        >
                            {priceError}
                        </p>
                    )}
                </div>

                {/* Currency */}
                <div className={styles.field}>
                    <label
                        className={`${styles.label} ${styles.labelRequired}`}
                        htmlFor="field-price-currency"
                    >
                        {t('host.form.sections.precio.fields.currency', 'Moneda')}
                    </label>
                    <select
                        id="field-price-currency"
                        className={`${styles.select} ${currencyError ? styles.inputError : ''}`}
                        value={currencyValue ?? ''}
                        onChange={(e) => onCurrencyChange(e.target.value)}
                        onBlur={onBlur}
                        aria-required="true"
                        aria-describedby={currencyError ? 'error-price-currency' : undefined}
                    >
                        <option value="">
                            {t(
                                'host.form.sections.precio.fields.currencyPlaceholder',
                                'Seleccioná moneda'
                            )}
                        </option>
                        {Object.values(PriceCurrencyEnum).map((code) => (
                            <option
                                key={code}
                                value={code}
                            >
                                {code}
                            </option>
                        ))}
                    </select>
                    {currencyError && (
                        <p
                            id="error-price-currency"
                            className={styles.fieldError}
                            role="alert"
                        >
                            {currencyError}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
