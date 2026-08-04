/**
 * @file CommercePhoneField.tsx
 * @description Phone input for the commerce owner editor: a searchable
 * country-code combobox plus a local-number input, recomposed into the single
 * `contactInfo.mobilePhone` string the backend stores.
 *
 * HOS-371: replaces the bare `<input type="tel">` with a static `"+54..."`
 * placeholder the editor shipped before, reusing the accommodation editor's
 * `CountryCodeCombobox` (BETA-144) verbatim. Mechanically identical to
 * `host/editor/ContactInfoSection`'s phone pair (BETA-139) — the parse/compose
 * primitives in `lib/phone-countries` are the shared contract, so both editors
 * write the same `"<dialCode> <number>"` shape that `InternationalPhoneRegex`
 * validates on the write path.
 *
 * Lives beside `ContactSection.client.tsx` rather than inline in it because the
 * two concerns are independent: this owns the parse/compose state machine, the
 * section owns the group-level `onContactChange` contract.
 */

import { type JSX, useState } from 'react';
import { CountryCodeCombobox } from '@/components/host/editor/CountryCodeCombobox.client';
import { FieldError } from '@/components/ui/FieldError';
import { buildFieldErrorId, TextField } from '@/components/ui/TextField';
import { buildFieldId } from '@/lib/forms/build-field-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { composePhoneValue, type PhoneCountry, parsePhoneValue } from '@/lib/phone-countries';
import styles from './ContactSection.module.css';
import fieldStyles from './editor-fields.module.css';
import { COMMERCE_FIELD_ID_SUFFIXES, COMMERCE_FIELD_PREFIX } from './field-ids';

/**
 * Identity of the two grouped phone controls.
 *
 * The suffix is READ from the editor's shared map rather than written here.
 * That is the whole safeguard for this field: `focusFirstInvalidField` reads the
 * same map, so the control this points at and the one focus targets cannot
 * drift. Hard-coding `'number'` in either place would compile, render and
 * silently focus nothing.
 */
const PHONE_FIELD = {
    prefix: COMMERCE_FIELD_PREFIX,
    name: 'contactInfo.mobilePhone',
    suffix: COMMERCE_FIELD_ID_SUFFIXES['contactInfo.mobilePhone']
} as const;

const PHONE_COUNTRY_ID = buildFieldId({ ...PHONE_FIELD, suffix: 'country' });

export interface CommercePhoneFieldProps {
    /** Active UI locale (drives the combobox's translated labels). */
    readonly locale: SupportedLocale;
    /** Current stored phone value (e.g. `"+54 9 343 1234567"`). */
    readonly value: string;
    /** Fired with the recomposed full phone string on any change. */
    readonly onChange: (value: string) => void;
    /** Validation message for `contactInfo.mobilePhone`, when present. */
    readonly error?: string;
}

/**
 * Country-code + local-number phone pair. Parses the stored value once on
 * mount and recomposes it on every change, so the parent keeps owning a single
 * `mobilePhone` string and its existing dirty tracking is untouched.
 */
export function CommercePhoneField({
    locale,
    value,
    onChange,
    error
}: CommercePhoneFieldProps): JSX.Element {
    const { t } = createTranslations(locale);

    // Lazy initializers keep this robust to an empty/undefined initial value.
    const [country, setCountry] = useState<PhoneCountry>(() => parsePhoneValue(value).country);
    const [number, setNumber] = useState<string>(() => parsePhoneValue(value).number);

    const handleCountryChange = (nextCountry: PhoneCountry) => {
        setCountry(nextCountry);
        onChange(composePhoneValue({ country: nextCountry, number }));
    };

    const handleNumberChange = (nextNumber: string) => {
        setNumber(nextNumber);
        onChange(composePhoneValue({ country, number: nextNumber }));
    };

    return (
        <div className={styles.phoneField}>
            <fieldset className={styles.phoneFieldset}>
                <legend className={styles.fieldLabel}>
                    {t('commerce.owner.editor.contactField.mobilePhone', 'Teléfono')}
                </legend>
                <div className={styles.phoneRow}>
                    <div className={styles.phoneCountryField}>
                        {/* Deliberately the `host.*` keys, not commerce ones:
                            `CountryCodeCombobox` builds its own aria-label from
                            `host.properties.editor.field.phoneCountry` (see its
                            WCAG 2.5.3 "Label in Name" comment). A parallel
                            commerce key would let the visible label and the
                            accessible name drift apart on the next edit. */}
                        <label
                            htmlFor={PHONE_COUNTRY_ID}
                            className={styles.fieldSubLabel}
                        >
                            {t('host.properties.editor.field.phoneCountry', 'País')}
                        </label>
                        <CountryCodeCombobox
                            locale={locale}
                            id={PHONE_COUNTRY_ID}
                            value={country}
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
                            className={fieldStyles.input}
                            error={error}
                            renderError={false}
                            type="tel"
                            inputMode="tel"
                            value={number}
                            placeholder="9 343 1234567"
                            onChange={(event) => handleNumberChange(event.target.value)}
                        />
                    </div>
                </div>
            </fieldset>
            <FieldError
                id={buildFieldErrorId(PHONE_FIELD)}
                message={error}
            />
        </div>
    );
}
