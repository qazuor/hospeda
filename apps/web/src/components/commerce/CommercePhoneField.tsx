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
 * Lives in its own file rather than inline in `CommerceListingEditor.client.tsx`
 * because that editor is already 2x over the 500-line cap (see HOS-258).
 */

import { useState } from 'react';
import { CountryCodeCombobox } from '@/components/host/editor/CountryCodeCombobox.client';
import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import type { SupportedLocale } from '@/lib/i18n';
import { composePhoneValue, type PhoneCountry, parsePhoneValue } from '@/lib/phone-countries';

/** Translator function shape (matches the editor's `createTranslations().t`). */
type Translate = (key: string, fallback?: string) => string;

export interface CommercePhoneFieldProps {
    /** Active UI locale (drives the combobox's translated labels). */
    readonly locale: SupportedLocale;
    /** Current stored phone value (e.g. `"+54 9 343 1234567"`). */
    readonly value: string;
    /** Fired with the recomposed full phone string on any change. */
    readonly onChange: (value: string) => void;
    /** Validation message for `contactInfo.mobilePhone`, when present. */
    readonly error?: string;
    /** Active editor translator. */
    readonly t: Translate;
    /** Shared CSS-module classes from the hosting editor. */
    readonly classes: Readonly<Record<string, string>>;
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
    error,
    t,
    classes
}: CommercePhoneFieldProps) {
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

    const errorId = fieldErrorId('contactInfo.mobilePhone');

    return (
        <div className={classes.phoneField}>
            <fieldset className={classes.phoneFieldset}>
                <legend className={classes.fieldLabel}>
                    {t('commerce.owner.editor.contactField.mobilePhone', 'Teléfono')}
                </legend>
                <div className={classes.phoneRow}>
                    <div className={classes.phoneCountryField}>
                        {/* Deliberately the `host.*` keys, not commerce ones:
                            `CountryCodeCombobox` builds its own aria-label from
                            `host.properties.editor.field.phoneCountry` (see its
                            WCAG 2.5.3 "Label in Name" comment). A parallel
                            commerce key would let the visible label and the
                            accessible name drift apart on the next edit. */}
                        <label
                            htmlFor="ce-phone-country"
                            className={classes.fieldSubLabel}
                        >
                            {t('host.properties.editor.field.phoneCountry', 'País')}
                        </label>
                        <CountryCodeCombobox
                            locale={locale}
                            id="ce-phone-country"
                            value={country}
                            onChange={handleCountryChange}
                        />
                    </div>
                    <div className={classes.phoneNumberField}>
                        <label
                            htmlFor="ce-phone-number"
                            className={classes.fieldSubLabel}
                        >
                            {t('host.properties.editor.field.phoneNumber', 'Número')}
                        </label>
                        <input
                            id="ce-phone-number"
                            className={classes.input}
                            type="tel"
                            inputMode="tel"
                            value={number}
                            placeholder="9 343 1234567"
                            aria-invalid={error ? 'true' : 'false'}
                            aria-describedby={error ? errorId : undefined}
                            onChange={(event) => handleNumberChange(event.target.value)}
                        />
                    </div>
                </div>
            </fieldset>
            <FieldError
                id={errorId}
                message={error}
            />
        </div>
    );
}
