/** Kit field and the same length guidance used by the property mini form. */

import type { ChangeEvent } from 'react';
import { Field } from '@/components/account/ui/Field';
import { Textarea } from '@/components/account/ui/Textarea';
import { TextInput } from '@/components/account/ui/TextInput';
import { CharacterCounter } from '@/components/ui/CharacterCounter';
import type { SupportedLocale } from '@/lib/i18n';

export function CreateTextField({
    id,
    locale,
    label,
    hint,
    error,
    value,
    onChange,
    min,
    max,
    rows
}: {
    readonly id: string;
    readonly locale: SupportedLocale;
    readonly label: string;
    readonly hint: string;
    readonly error?: string;
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly min: number;
    readonly max: number;
    readonly rows?: number;
}) {
    const control = {
        value,
        minLength: min,
        'aria-describedby': `${id}-counter`,
        onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            onChange(event.target.value)
    };
    return (
        <Field
            id={id}
            locale={locale}
            label={label}
            hint={hint}
            error={error}
            required
        >
            {rows ? (
                <Textarea
                    {...control}
                    rows={rows}
                />
            ) : (
                <TextInput
                    {...control}
                    maxLength={max}
                />
            )}
            <CharacterCounter
                id={`${id}-counter`}
                locale={locale}
                current={value.length}
                min={min}
                max={max}
            />
        </Field>
    );
}
