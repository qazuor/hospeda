/**
 * @file ContactInfoSection.client.tsx
 * @description Form section for accommodation contact info: phone, email,
 * website. Uses native HTML form elements. The phone field is split into a
 * searchable country-code selector plus a local-number input (BETA-139); both
 * recompose into the single `data.phone` string the backend stores.
 */

import { useState } from 'react';
import { FieldError } from '@/components/ui/FieldError';
import { buildFieldErrorId, TextField } from '@/components/ui/TextField';
import type { AccommodationEditData } from '@/lib/api/types';
import { buildFieldId } from '@/lib/forms/build-field-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { composePhoneValue, type PhoneCountry, parsePhoneValue } from '@/lib/phone-countries';
import styles from './ContactInfoSection.module.css';
import { CountryCodeCombobox } from './CountryCodeCombobox.client';
import { ACCOMMODATION_FIELD_ID_SUFFIXES, ACCOMMODATION_FIELD_PREFIX } from './field-ids';

/**
 * Identity of the two grouped phone fields.
 *
 * The suffix is READ from the editor's shared map rather than written here.
 * That is the whole safeguard for these two fields: `focusFirstInvalidField`
 * reads the same map, so the control this points at and the one focus targets
 * cannot drift. Hard-coding `'number'` in either place would compile, render
 * and silently focus nothing.
 */
const PHONE_FIELD = {
    prefix: ACCOMMODATION_FIELD_PREFIX,
    name: 'phone',
    suffix: ACCOMMODATION_FIELD_ID_SUFFIXES.phone
} as const;

const WHATSAPP_FIELD = {
    prefix: ACCOMMODATION_FIELD_PREFIX,
    name: 'whatsapp',
    suffix: ACCOMMODATION_FIELD_ID_SUFFIXES.whatsapp
} as const;

const LANDLINE_FIELD = {
    prefix: ACCOMMODATION_FIELD_PREFIX,
    name: 'landlinePhone',
    suffix: ACCOMMODATION_FIELD_ID_SUFFIXES.landlinePhone
} as const;

/** Props for ContactInfoSection. */
export interface ContactInfoSectionProps {
    readonly locale: SupportedLocale;
    readonly data: AccommodationEditData;
    readonly errors: Readonly<{
        phone?: string;
        whatsapp?: string;
        landlinePhone?: string;
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

    const handleCountryChange = (country: PhoneCountry) => {
        setPhoneCountry(country);
        onFieldChange('phone', composePhoneValue({ country, number: phoneNumber }));
    };

    const handleNumberChange = (value: string) => {
        setPhoneNumber(value);
        onFieldChange('phone', composePhoneValue({ country: phoneCountry, number: value }));
    };

    // WhatsApp mirrors the phone split (BETA-151): `data.whatsapp` is a single
    // string parsed into a country + number pair and recomposed on every change.
    const [whatsappCountry, setWhatsappCountry] = useState<PhoneCountry>(
        () => parsePhoneValue(data.whatsapp).country
    );
    const [whatsappNumber, setWhatsappNumber] = useState<string>(
        () => parsePhoneValue(data.whatsapp).number
    );

    const handleWhatsappCountryChange = (country: PhoneCountry) => {
        setWhatsappCountry(country);
        onFieldChange('whatsapp', composePhoneValue({ country, number: whatsappNumber }));
    };

    const handleWhatsappNumberChange = (value: string) => {
        setWhatsappNumber(value);
        onFieldChange('whatsapp', composePhoneValue({ country: whatsappCountry, number: value }));
    };

    // Optional landline (HOS-2042): same country + number pair, recomposed into
    // the single `data.landlinePhone` string; stored in `contactInfo.workPhone`.
    const [landlineCountry, setLandlineCountry] = useState<PhoneCountry>(
        () => parsePhoneValue(data.landlinePhone).country
    );
    const [landlineNumber, setLandlineNumber] = useState<string>(
        () => parsePhoneValue(data.landlinePhone).number
    );

    const handleLandlineCountryChange = (country: PhoneCountry) => {
        setLandlineCountry(country);
        onFieldChange('landlinePhone', composePhoneValue({ country, number: landlineNumber }));
    };

    const handleLandlineNumberChange = (value: string) => {
        setLandlineNumber(value);
        onFieldChange(
            'landlinePhone',
            composePhoneValue({ country: landlineCountry, number: value })
        );
    };

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.contact', 'Contacto')}
            </legend>

            {/* HOS-2042: these channels are published on the public listing. */}
            <p className={styles.contactHint}>
                {t(
                    'host.properties.editor.field.contactPublicHint',
                    'Estos datos de contacto se muestran públicamente en tu ficha.'
                )}
            </p>

            <div className={styles.field}>
                <fieldset className={styles.phoneFieldset}>
                    <legend className={styles.fieldLabel}>
                        {t('host.properties.editor.field.phone', 'Teléfono')}
                    </legend>
                    <div className={styles.phoneRow}>
                        <div className={styles.phoneCountryField}>
                            <label
                                htmlFor={buildFieldId({ ...PHONE_FIELD, suffix: 'country' })}
                                className={styles.fieldSubLabel}
                            >
                                {t('host.properties.editor.field.phoneCountry', 'País')}
                            </label>
                            <CountryCodeCombobox
                                locale={locale}
                                id={buildFieldId({ ...PHONE_FIELD, suffix: 'country' })}
                                value={phoneCountry}
                                onChange={handleCountryChange}
                            />
                        </div>
                        <div className={styles.phoneNumberField}>
                            {/*
                             * `renderError={false}`: one Zod field, two controls.
                             * The message belongs under the whole fieldset (below),
                             * not inside this column — the wrapper still owns the
                             * aria wiring, only the placement is ours.
                             */}
                            <TextField
                                {...PHONE_FIELD}
                                label={t('host.properties.editor.field.phoneNumber', 'Número')}
                                labelClassName={styles.fieldSubLabel}
                                className={`${styles.fieldInput} ${styles.phoneNumberInput}`}
                                error={errors.phone}
                                renderError={false}
                                type="tel"
                                inputMode="tel"
                                value={phoneNumber}
                                onChange={(e) => handleNumberChange(e.target.value)}
                                placeholder="9 343 1234567"
                            />
                        </div>
                    </div>
                </fieldset>
                <FieldError
                    id={buildFieldErrorId(PHONE_FIELD)}
                    message={errors.phone}
                    className={styles.fieldErrorSpacing}
                />
            </div>

            <div className={styles.field}>
                <fieldset className={styles.phoneFieldset}>
                    <legend className={styles.fieldLabel}>
                        {t('host.properties.editor.field.landlinePhone', 'Teléfono fijo')}
                    </legend>
                    <div className={styles.phoneRow}>
                        <div className={styles.phoneCountryField}>
                            <label
                                htmlFor={buildFieldId({ ...LANDLINE_FIELD, suffix: 'country' })}
                                className={styles.fieldSubLabel}
                            >
                                {t('host.properties.editor.field.phoneCountry', 'País')}
                            </label>
                            <CountryCodeCombobox
                                locale={locale}
                                id={buildFieldId({ ...LANDLINE_FIELD, suffix: 'country' })}
                                value={landlineCountry}
                                onChange={handleLandlineCountryChange}
                            />
                        </div>
                        <div className={styles.phoneNumberField}>
                            {/* Mirrors the phone block above — see the note there. */}
                            <TextField
                                {...LANDLINE_FIELD}
                                label={t('host.properties.editor.field.phoneNumber', 'Número')}
                                labelClassName={styles.fieldSubLabel}
                                className={`${styles.fieldInput} ${styles.phoneNumberInput}`}
                                error={errors.landlinePhone}
                                renderError={false}
                                type="tel"
                                inputMode="tel"
                                value={landlineNumber}
                                onChange={(e) => handleLandlineNumberChange(e.target.value)}
                                placeholder="3442 45-2345"
                            />
                        </div>
                    </div>
                </fieldset>
                <FieldError
                    id={buildFieldErrorId(LANDLINE_FIELD)}
                    message={errors.landlinePhone}
                    className={styles.fieldErrorSpacing}
                />
            </div>

            <div className={styles.field}>
                <fieldset className={styles.phoneFieldset}>
                    <legend className={styles.fieldLabel}>
                        {t('host.properties.editor.field.whatsapp', 'WhatsApp')}
                    </legend>
                    <div className={styles.phoneRow}>
                        <div className={styles.phoneCountryField}>
                            <label
                                htmlFor={buildFieldId({ ...WHATSAPP_FIELD, suffix: 'country' })}
                                className={styles.fieldSubLabel}
                            >
                                {t('host.properties.editor.field.phoneCountry', 'País')}
                            </label>
                            <CountryCodeCombobox
                                locale={locale}
                                id={buildFieldId({ ...WHATSAPP_FIELD, suffix: 'country' })}
                                value={whatsappCountry}
                                onChange={handleWhatsappCountryChange}
                            />
                        </div>
                        <div className={styles.phoneNumberField}>
                            {/* Mirrors the phone block above — see the note there. */}
                            <TextField
                                {...WHATSAPP_FIELD}
                                label={t('host.properties.editor.field.phoneNumber', 'Número')}
                                labelClassName={styles.fieldSubLabel}
                                className={`${styles.fieldInput} ${styles.phoneNumberInput}`}
                                error={errors.whatsapp}
                                renderError={false}
                                type="tel"
                                inputMode="tel"
                                value={whatsappNumber}
                                onChange={(e) => handleWhatsappNumberChange(e.target.value)}
                                placeholder="9 343 1234567"
                            />
                        </div>
                    </div>
                </fieldset>
                <FieldError
                    id={buildFieldErrorId(WHATSAPP_FIELD)}
                    message={errors.whatsapp}
                    className={styles.fieldErrorSpacing}
                />
            </div>

            <div className={styles.field}>
                <TextField
                    prefix={ACCOMMODATION_FIELD_PREFIX}
                    name="email"
                    label={t('host.properties.editor.field.email', 'Email')}
                    labelClassName={styles.fieldLabel}
                    className={styles.fieldInput}
                    error={errors.email}
                    type="email"
                    value={data.email}
                    onChange={(e) => onFieldChange('email', e.target.value)}
                    placeholder="contacto@ejemplo.com"
                />
            </div>

            <div className={styles.field}>
                <TextField
                    prefix={ACCOMMODATION_FIELD_PREFIX}
                    name="website"
                    label={t('host.properties.editor.field.website', 'Sitio web')}
                    labelClassName={styles.fieldLabel}
                    className={styles.fieldInput}
                    error={errors.website}
                    type="url"
                    value={data.website}
                    onChange={(e) => onFieldChange('website', e.target.value)}
                    placeholder="https://www.ejemplo.com"
                />
            </div>
        </fieldset>
    );
}
