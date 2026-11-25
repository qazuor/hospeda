/** Compound phone control: one country picker and national number, one stored value. */
import { useId, useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { composePhoneValue, parsePhoneValue } from '@/lib/phone-countries';
import styles from './Control.module.css';
import { cx } from './cx';
import { useFieldControl } from './field-context';
import { PhoneCountryPicker } from './PhoneCountryPicker';
import type { TextInputProps } from './TextInput';

export interface PhoneFieldProps
    extends Omit<TextInputProps, 'value' | 'defaultValue' | 'onChange' | 'type'> {
    readonly locale: SupportedLocale;
    /** Complete phone value. Formatting is kept locally while typing. */
    readonly value?: string;
    /** Emits one E.164 string, or an empty string when the number is cleared. */
    readonly onValueChange?: (value: string) => void;
    /** Explicit picker id for existing form and end-to-end selector contracts. */
    readonly countryId?: string;
}

export function PhoneField({
    locale,
    value = '',
    onValueChange,
    countryId,
    id,
    invalid,
    required,
    disabled,
    className,
    'aria-describedby': describedBy,
    ...rest
}: PhoneFieldProps) {
    const generatedId = useId();
    const control = useFieldControl({ id, invalid, required, describedBy });
    const [parts, setParts] = useState(() => parsePhoneValue(value));
    const [seen, setSeen] = useState(value);
    const compose = (next: typeof parts) => composePhoneValue(next).replace(/[\s().-]/g, '');
    // Only external changes (discard/reset) reseed the pair. Echoed values must
    // preserve whitespace while typing and the selected country for shared codes.
    if (seen !== value) {
        setSeen(value);
        if (value !== compose(parts)) setParts(parsePhoneValue(value));
    }
    const update = (next: typeof parts) => {
        setParts(next);
        onValueChange?.(compose(next));
    };
    return (
        <div
            className={cx(
                styles.group,
                styles.phoneGroup,
                control['aria-invalid'] && styles.groupInvalid,
                disabled && styles.groupDisabled,
                className
            )}
        >
            <div className={styles.phoneCountry}>
                <PhoneCountryPicker
                    locale={locale}
                    id={countryId ?? `${control.id ?? generatedId}-country`}
                    value={parts.country}
                    disabled={disabled}
                    onChange={(country) => update({ ...parts, country })}
                />
            </div>
            <input
                {...rest}
                {...control}
                className={styles.bare}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                disabled={disabled}
                value={parts.number}
                onChange={(event) => update({ ...parts, number: event.target.value })}
            />
        </div>
    );
}
