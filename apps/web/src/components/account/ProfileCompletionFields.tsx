/**
 * @file ProfileCompletionFields.tsx
 * @description Shared field wrappers of the profile-completion subcomponents
 * (HOS-2501): a kit `Field` + `TextInput` (or `Select`) whose DOM id is
 * `pc-<name>`, the namespace the completion tests and the error focus use.
 */

import type { HTMLInputTypeAttribute, ReactNode } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { Field, Select, TextInput } from './ui';

/** Id namespace of every profile-completion field (`pc-<name>`). */
export const PC_FIELD_PREFIX = 'pc';

/** Props of {@link PcTextField}. */
export interface PcTextFieldProps {
    /** Field name; the control id is `pc-<name>`. */
    readonly name: string;
    readonly label: ReactNode;
    readonly locale: SupportedLocale;
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly error?: string;
    readonly hint?: ReactNode;
    readonly required?: boolean;
    /** Marks the field «(opcional)» next to its label. */
    readonly optional?: boolean;
    readonly disabled?: boolean;
    readonly type?: HTMLInputTypeAttribute;
    readonly maxLength?: number;
    readonly autoComplete?: string;
    readonly placeholder?: string;
}

/**
 * One labelled text input with its own hint and error line.
 *
 * @param props - See {@link PcTextFieldProps}.
 */
export function PcTextField({
    name,
    label,
    locale,
    value,
    onChange,
    error,
    hint,
    required,
    optional,
    disabled,
    type = 'text',
    maxLength,
    autoComplete,
    placeholder
}: PcTextFieldProps) {
    return (
        <Field
            label={label}
            locale={locale}
            idParts={{ prefix: PC_FIELD_PREFIX, name }}
            error={error}
            hint={hint}
            required={required}
            optional={optional}
        >
            <TextInput
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                maxLength={maxLength}
                autoComplete={autoComplete}
                placeholder={placeholder}
                disabled={disabled}
            />
        </Field>
    );
}

/** One option of a {@link PcSelectField}. */
export interface PcSelectOption {
    readonly value: string;
    readonly label: string;
}

/** Props of {@link PcSelectField}. */
export interface PcSelectFieldProps {
    /** Field name; the control id is `pc-<name>`. */
    readonly name: string;
    readonly label: ReactNode;
    readonly locale: SupportedLocale;
    readonly value: string;
    readonly options: readonly PcSelectOption[];
    readonly onChange: (value: string) => void;
    readonly error?: string;
    readonly hint?: ReactNode;
    readonly optional?: boolean;
    readonly disabled?: boolean;
}

/**
 * One labelled select with its own hint and error line.
 *
 * @param props - See {@link PcSelectFieldProps}.
 */
export function PcSelectField({
    name,
    label,
    locale,
    value,
    options,
    onChange,
    error,
    hint,
    optional,
    disabled
}: PcSelectFieldProps) {
    return (
        <Field
            label={label}
            locale={locale}
            idParts={{ prefix: PC_FIELD_PREFIX, name }}
            error={error}
            hint={hint}
            optional={optional}
        >
            <Select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled}
            >
                {options.map((option) => (
                    <option
                        key={option.value}
                        value={option.value}
                    >
                        {option.label}
                    </option>
                ))}
            </Select>
        </Field>
    );
}
