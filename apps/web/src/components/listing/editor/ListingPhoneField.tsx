/**
 * @file ListingPhoneField.tsx
 * @description Phone input for the listing owner editor: a searchable
 * country-code combobox plus a local-number input, recomposed into the single
 * `contactInfo.mobilePhone` string the backend stores.
 *
 * HOS-371: replaces the bare `<input type="tel">` with a static `"+54..."`
 * placeholder the editor shipped before, reusing the accommodation editor's
 * `CountryCodeCombobox` (BETA-144) verbatim. Mechanically identical to
 * `host/editor/ContactInfoSection`'s phone pair (BETA-139) — the parse/compose
 * primitives in `lib/phone-countries` are the shared contract, so both editors
 * write the same `"<dialCode> <number>"` shape that the shared phone
 * validator accepts on the write path.
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
import { LISTING_FIELD_ID_SUFFIXES, LISTING_FIELD_PREFIX } from './field-ids';

/**
 * Identity of the two grouped phone controls.
 *
 * The suffix is READ from the editor's shared map rather than written here.
 * That is the whole safeguard for this field: `focusFirstInvalidField` reads the
 * same map, so the control this points at and the one focus targets cannot
 * drift. Hard-coding `'number'` in either place would compile, render and
 * silently focus nothing.
 */
/**
 * The `contactInfo` phone keys this control can edit: the main (mobile) phone
 * and the optional landline (HOS-2042).
 */
export type ListingPhoneKey = 'mobilePhone' | 'workPhone' | 'whatsapp';

/** Default label text per key, used as the i18n fallback. */
const PHONE_LABELS: Readonly<Record<ListingPhoneKey, { key: string; fallback: string }>> = {
    mobilePhone: { key: 'listing.owner.editor.contactField.mobilePhone', fallback: 'Teléfono' },
    workPhone: {
        key: 'listing.owner.editor.contactField.landlinePhone',
        fallback: 'Teléfono fijo'
    },
    // HOS-2256: the venue WhatsApp number, same country + number pair.
    whatsapp: { key: 'listing.owner.editor.contactField.whatsapp', fallback: 'WhatsApp' }
};

/** Builds the id identity of one phone control from its `contactInfo` key. */
function phoneFieldIdentity(phoneKey: ListingPhoneKey) {
    const name = `contactInfo.${phoneKey}` as const;
    return {
        prefix: LISTING_FIELD_PREFIX,
        name,
        suffix: LISTING_FIELD_ID_SUFFIXES[name]
    } as const;
}

export interface ListingPhoneFieldProps {
    /** Which `contactInfo` key this control edits. Defaults to the main (mobile) phone. */
    readonly phoneKey?: ListingPhoneKey;
    /** Active UI locale (drives the combobox's translated labels). */
    readonly locale: SupportedLocale;
    /** Current stored phone value (e.g. `"+54 9 343 1234567"`). */
    readonly value: string;
    /** Fired with the recomposed full phone string on any change. */
    readonly onChange: (value: string) => void;
    /** Validation message for the edited `contactInfo` phone key, when present. */
    readonly error?: string;
}

/**
 * Country-code + local-number phone pair. Parses the stored value once on
 * mount and recomposes it on every change, so the parent keeps owning a single
 * `mobilePhone` string and its existing dirty tracking is untouched.
 */
export function ListingPhoneField({
    phoneKey = 'mobilePhone',
    locale,
    value,
    onChange,
    error
}: ListingPhoneFieldProps): JSX.Element {
    const { t } = createTranslations(locale);
    const phoneField = phoneFieldIdentity(phoneKey);
    const phoneCountryId = buildFieldId({ ...phoneField, suffix: 'country' });
    const label = PHONE_LABELS[phoneKey];

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
                <legend className={styles.fieldLabel}>{t(label.key, label.fallback)}</legend>
                <div className={styles.phoneRow}>
                    <div className={styles.phoneCountryField}>
                        {/* Deliberately the `host.*` keys, not listing ones:
                            `CountryCodeCombobox` builds its own aria-label from
                            `host.properties.editor.field.phoneCountry` (see its
                            WCAG 2.5.3 "Label in Name" comment). A parallel
                            listing key would let the visible label and the
                            accessible name drift apart on the next edit. */}
                        <label
                            htmlFor={phoneCountryId}
                            className={styles.fieldSubLabel}
                        >
                            {t('host.properties.editor.field.phoneCountry', 'País')}
                        </label>
                        <CountryCodeCombobox
                            locale={locale}
                            id={phoneCountryId}
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
                            {...phoneField}
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
                id={buildFieldErrorId(phoneField)}
                message={error}
            />
        </div>
    );
}
