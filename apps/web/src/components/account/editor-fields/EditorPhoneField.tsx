/**
 * @file EditorPhoneField.tsx
 * @description One phone of an owner editor (HOS-2497, spec HOS-2415 §6.3 and
 * §6.9): a kit {@link Field} around a country picker plus the local number.
 *
 * The kit `PhoneField` has a fixed «+54» addon and no country picker, so this
 * reuses `CountryCodeCombobox` (spec §6.3: «reused inside it if the kit piece
 * lacks a country picker») next to a kit `TextInput`. The stored value stays
 * ONE string: the pair is parsed from it and recomposed on every change
 * (`@/lib/phone-countries`), so dirty tracking and the PATCH are unchanged.
 * The pair is re-parsed only when the value changes from OUTSIDE (a discard, a
 * reset after save): a value the pair itself composed never resets the typing.
 *
 * Ids follow the editor contract: the number input gets
 * `buildFieldId({ prefix, name, suffix })` (the focus target of «Ir al primer
 * error») and the picker the same id with the `country` suffix.
 */

import { type ReactNode, useState } from 'react';
import { Field } from '@/components/account/ui/Field';
import { TextInput } from '@/components/account/ui/TextInput';
import { CountryCodeCombobox } from '@/components/host/editor/CountryCodeCombobox.client';
import { buildFieldId } from '@/lib/forms/build-field-id';
import type { SupportedLocale } from '@/lib/i18n';
import { composePhoneValue, type PhoneCountry, parsePhoneValue } from '@/lib/phone-countries';
import styles from './EditorFields.module.css';

/** Props of {@link EditorPhoneField}. */
export interface EditorPhoneFieldProps {
    /** Active UI locale (the picker's labels and the Field's hidden text). */
    readonly locale: SupportedLocale;
    /** Visible label. */
    readonly label: string;
    /** The editor's field id namespace (`acc`, `ce`). */
    readonly idPrefix: string;
    /** The Zod key this phone writes (`phone`, `contactInfo.mobilePhone`, …). */
    readonly name: string;
    /** The editor's suffix for this key (the number input), if any. */
    readonly suffix?: string;
    /** Stored value, e.g. `+54 9 343 1234567`; `''` when none. */
    readonly value: string;
    /** Receives the recomposed full value on every change. */
    readonly onChange: (value: string) => void;
    /** Validation message for this key. */
    readonly error?: string;
    /** Shows «(opcional)» next to the label. */
    readonly optional?: boolean;
    /** Helper text under the control. */
    readonly hint?: ReactNode;
}

/**
 * A phone with its country picker, inside a kit Field.
 *
 * @param props - See {@link EditorPhoneFieldProps}.
 * @returns The field.
 */
export function EditorPhoneField({
    locale,
    label,
    idPrefix,
    name,
    suffix,
    value,
    onChange,
    error,
    optional,
    hint
}: EditorPhoneFieldProps) {
    const numberId = buildFieldId({ prefix: idPrefix, name, suffix });
    const countryId = buildFieldId({ prefix: idPrefix, name, suffix: 'country' });

    // The two halves are the source of truth while the owner types.
    const [country, setCountry] = useState<PhoneCountry>(() => parsePhoneValue(value).country);
    const [number, setNumber] = useState<string>(() => parsePhoneValue(value).number);
    // A value the halves did not compose came from outside (e.g. «Descartar»):
    // re-parse it, or the inputs would keep showing the discarded phone and the
    // next keystroke would write it back. Adjusting state during render is
    // React's documented pattern for deriving from a changed prop.
    const [seen, setSeen] = useState(value);
    if (value !== seen) {
        setSeen(value);
        if (value !== composePhoneValue({ country, number })) {
            const parsed = parsePhoneValue(value);
            setCountry(parsed.country);
            setNumber(parsed.number);
        }
    }

    return (
        <Field
            locale={locale}
            label={label}
            id={numberId}
            error={error}
            optional={optional}
            hint={hint}
        >
            <div className={styles.phoneRow}>
                <div className={styles.phoneCountry}>
                    <CountryCodeCombobox
                        locale={locale}
                        id={countryId}
                        value={country}
                        onChange={(next) => {
                            setCountry(next);
                            onChange(composePhoneValue({ country: next, number }));
                        }}
                    />
                </div>
                <TextInput
                    className={styles.phoneNumber}
                    name={name}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={number}
                    onChange={(event) => {
                        setNumber(event.target.value);
                        onChange(composePhoneValue({ country, number: event.target.value }));
                    }}
                />
            </div>
        </Field>
    );
}
