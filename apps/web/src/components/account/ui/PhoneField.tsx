/**
 * PhoneField — a text input with a country prefix for phone numbers
 * (HOS-2413 T-006).
 *
 * An {@link InputGroup} with `inputMode="tel"`, `autoComplete="tel"` and
 * `type="tel"`. The prefix defaults to the Argentine `+54`.
 *
 * @module components/account/ui/PhoneField
 */

import { InputGroup, type InputGroupProps } from './InputGroup';

/** Props of {@link PhoneField}. */
export interface PhoneFieldProps extends Omit<InputGroupProps, 'prefix' | 'type'> {
    /** Country prefix addon. @default '+54' */
    readonly countryPrefix?: string;
}

/**
 * The kit phone input.
 *
 * @param props - See {@link PhoneFieldProps}.
 * @returns An {@link InputGroup} configured for phone numbers.
 */
export function PhoneField({ countryPrefix = '+54', ...rest }: PhoneFieldProps) {
    return (
        <InputGroup
            inputMode="tel"
            autoComplete="tel"
            {...rest}
            type="tel"
            prefix={countryPrefix}
        />
    );
}
