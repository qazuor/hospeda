/**
 * @file ProfileEditFields.tsx
 * @description Shared text-field wrapper of the profile edit form sections.
 *
 * Every field is a kit `Field` + `TextInput` whose DOM id is
 * `profile-<name>`, the namespace `useZodForm` and `useSaveBar` use to focus
 * the first invalid field.
 */

import type { HTMLInputTypeAttribute } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import styles from './ProfileEditForm.module.css';
import { Field } from './ui/Field';
import { TextInput } from './ui/TextInput';

/** Id namespace of every profile form field (`profile-<name>`). */
export const PROFILE_FIELD_PREFIX = 'profile';

/** Props of {@link ProfileTextField}. */
export interface ProfileTextFieldProps {
    /** Field name, as in the form schema (`displayName`, `facebookUrl`...). */
    readonly name: string;
    readonly label: string;
    readonly locale: SupportedLocale;
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly error?: string;
    readonly hint?: string;
    readonly required?: boolean;
    readonly disabled?: boolean;
    readonly type?: HTMLInputTypeAttribute;
    readonly maxLength?: number;
    readonly autoComplete?: string;
    readonly placeholder?: string;
    readonly max?: string;
    /** Language of the control (the native date picker follows it). */
    readonly lang?: string;
    /** Spans both grid columns on wide screens. */
    readonly full?: boolean;
}

/**
 * One labelled text input with its own error line.
 *
 * @param props - See {@link ProfileTextFieldProps}.
 */
export function ProfileTextField({
    name,
    label,
    locale,
    value,
    onChange,
    error,
    hint,
    required,
    disabled,
    type = 'text',
    maxLength,
    autoComplete,
    placeholder,
    max,
    lang,
    full
}: ProfileTextFieldProps) {
    return (
        <Field
            label={label}
            locale={locale}
            idParts={{ prefix: PROFILE_FIELD_PREFIX, name }}
            error={error}
            hint={hint}
            required={required}
            className={full ? styles.full : undefined}
        >
            <TextInput
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                maxLength={maxLength}
                autoComplete={autoComplete}
                placeholder={placeholder}
                max={max}
                lang={lang}
                disabled={disabled}
            />
        </Field>
    );
}
