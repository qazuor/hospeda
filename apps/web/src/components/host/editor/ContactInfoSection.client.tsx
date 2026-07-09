/**
 * @file ContactInfoSection.client.tsx
 * @description Form section for accommodation contact info: phone, email,
 * website. Uses native HTML form elements. The phone field is split into a
 * searchable country-code selector plus a local-number input (BETA-139); both
 * recompose into the single `data.phone` string the backend stores.
 */

import { useState } from 'react';
import type { AccommodationEditData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import {
    composePhoneValue,
    findPhoneCountryByLabel,
    formatPhoneCountryLabel,
    PHONE_COUNTRIES,
    type PhoneCountry,
    parsePhoneValue
} from '@/lib/phone-countries';
import styles from './ContactInfoSection.module.css';

/** DOM id for the phone country `<datalist>`. */
const PHONE_COUNTRY_DATALIST_ID = 'acc-phone-country-options';

/** Props for ContactInfoSection. */
export interface ContactInfoSectionProps {
    readonly locale: SupportedLocale;
    readonly data: AccommodationEditData;
    readonly errors: Readonly<{
        phone?: string;
        email?: string;
        website?: string;
    }>;
    readonly onFieldChange: (field: keyof AccommodationEditData, value: string) => void;
}

/**
 * Contact information form section.
 * Renders a searchable phone country-code + number pair, plus email and
 * website inputs.
 */
export function ContactInfoSection({
    locale,
    data,
    errors,
    onFieldChange
}: ContactInfoSectionProps) {
    const { t } = createTranslations(locale);

    // Local derived state for the phone split: `data.phone` is a single
    // string the backend stores, so the country + number pair is parsed once
    // on mount and recomposed into that single string on every change (see
    // `@/lib/phone-countries`). Lazy initializers keep this robust to an
    // empty/undefined initial `data.phone`.
    const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>(
        () => parsePhoneValue(data.phone).country
    );
    const [phoneNumber, setPhoneNumber] = useState<string>(
        () => parsePhoneValue(data.phone).number
    );
    const [countryQuery, setCountryQuery] = useState<string>(() =>
        formatPhoneCountryLabel(parsePhoneValue(data.phone).country)
    );

    const handleCountryQueryChange = (value: string) => {
        setCountryQuery(value);
        const matched = findPhoneCountryByLabel(value);
        if (matched) {
            setPhoneCountry(matched);
            onFieldChange('phone', composePhoneValue({ country: matched, number: phoneNumber }));
        }
    };

    const handleNumberChange = (value: string) => {
        setPhoneNumber(value);
        onFieldChange('phone', composePhoneValue({ country: phoneCountry, number: value }));
    };

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.contact', 'Contacto')}
            </legend>

            <div className={styles.field}>
                <fieldset className={styles.phoneFieldset}>
                    <legend className={styles.fieldLabel}>
                        {t('host.properties.editor.field.phone', 'Teléfono')}
                    </legend>
                    <div className={styles.phoneRow}>
                        <div className={styles.phoneCountryField}>
                            <label
                                htmlFor="acc-phone-country"
                                className={styles.fieldSubLabel}
                            >
                                {t('host.properties.editor.field.phoneCountry', 'País')}
                            </label>
                            <input
                                id="acc-phone-country"
                                list={PHONE_COUNTRY_DATALIST_ID}
                                className={`${styles.fieldInput} ${styles.phoneCountryInput}`}
                                value={countryQuery}
                                onChange={(e) => handleCountryQueryChange(e.target.value)}
                                placeholder={t(
                                    'host.properties.editor.field.phoneCountrySearchPlaceholder',
                                    'Buscar país...'
                                )}
                                autoComplete="off"
                            />
                            <datalist id={PHONE_COUNTRY_DATALIST_ID}>
                                {PHONE_COUNTRIES.map((country) => (
                                    <option
                                        key={country.iso}
                                        value={formatPhoneCountryLabel(country)}
                                    />
                                ))}
                            </datalist>
                        </div>
                        <div className={styles.phoneNumberField}>
                            <label
                                htmlFor="acc-phone-number"
                                className={styles.fieldSubLabel}
                            >
                                {t('host.properties.editor.field.phoneNumber', 'Número')}
                            </label>
                            <input
                                id="acc-phone-number"
                                type="tel"
                                inputMode="tel"
                                className={`${styles.fieldInput} ${styles.phoneNumberInput}`}
                                value={phoneNumber}
                                onChange={(e) => handleNumberChange(e.target.value)}
                                placeholder="9 343 1234567"
                                aria-invalid={Boolean(errors.phone)}
                                aria-describedby={errors.phone ? 'acc-phone-error' : undefined}
                            />
                        </div>
                    </div>
                </fieldset>
                {errors.phone && (
                    <span
                        id="acc-phone-error"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {errors.phone}
                    </span>
                )}
            </div>

            <div className={styles.field}>
                <label
                    htmlFor="acc-email"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.field.email', 'Email')}
                </label>
                <input
                    id="acc-email"
                    type="email"
                    className={styles.fieldInput}
                    value={data.email}
                    onChange={(e) => onFieldChange('email', e.target.value)}
                    placeholder="contacto@ejemplo.com"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'acc-email-error' : undefined}
                />
                {errors.email && (
                    <span
                        id="acc-email-error"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {errors.email}
                    </span>
                )}
            </div>

            <div className={styles.field}>
                <label
                    htmlFor="acc-website"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.field.website', 'Sitio web')}
                </label>
                <input
                    id="acc-website"
                    type="url"
                    className={styles.fieldInput}
                    value={data.website}
                    onChange={(e) => onFieldChange('website', e.target.value)}
                    placeholder="https://www.ejemplo.com"
                    aria-invalid={Boolean(errors.website)}
                    aria-describedby={errors.website ? 'acc-website-error' : undefined}
                />
                {errors.website && (
                    <span
                        id="acc-website-error"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {errors.website}
                    </span>
                )}
            </div>
        </fieldset>
    );
}
