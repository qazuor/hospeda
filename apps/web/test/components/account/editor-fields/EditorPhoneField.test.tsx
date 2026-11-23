/**
 * @file EditorPhoneField.test.tsx
 * @description The phone field keeps its two halves (country, number) as local
 * state; a value changed from OUTSIDE — «Descartar» — must re-seed them, while
 * the values they compose themselves must never reset the typing.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { EditorPhoneField } from '@/components/account/editor-fields/EditorPhoneField';
import { buildFieldId } from '@/lib/forms/build-field-id';

const NUMBER_ID = buildFieldId({ prefix: 'ce', name: 'contact.mobilePhone' });

/** An editor in miniature: a value, its persisted baseline and a discard. */
function PhoneHarness({ baseline }: { readonly baseline: string }) {
    const [value, setValue] = useState(baseline);
    return (
        <>
            <EditorPhoneField
                locale="es"
                label="Celular"
                idPrefix="ce"
                name="contact.mobilePhone"
                value={value}
                onChange={setValue}
            />
            <button
                type="button"
                onClick={() => setValue(baseline)}
            >
                Descartar
            </button>
            <output data-testid="phone-value">{value}</output>
        </>
    );
}

const numberInput = () => document.getElementById(NUMBER_ID) as HTMLInputElement;
const storedValue = () => screen.getByTestId('phone-value').textContent;

describe('EditorPhoneField — discard (HOS-2497 review)', () => {
    it('shows the baseline again after a discard, and the next keystroke builds on it', () => {
        render(<PhoneHarness baseline="+54 343 111" />);
        expect(numberInput().value).toBe('343 111');

        fireEvent.change(numberInput(), { target: { value: '343 999' } });
        expect(storedValue()).toBe('+54 343 999');

        fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));

        expect(storedValue()).toBe('+54 343 111');
        expect(numberInput().value).toBe('343 111');

        fireEvent.change(numberInput(), { target: { value: '343 1112' } });
        expect(storedValue()).toBe('+54 343 1112');
    });

    it('empties the inputs when the discarded baseline had no phone', () => {
        render(<PhoneHarness baseline="" />);

        fireEvent.change(numberInput(), { target: { value: '+598 99 123456' } });
        expect(storedValue()).toBe('+598 99 123456');

        fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));

        expect(storedValue()).toBe('');
        expect(numberInput().value).toBe('');
    });

    it('never resets the typing on a value it composed itself (trailing space kept)', () => {
        render(<PhoneHarness baseline="" />);

        fireEvent.change(numberInput(), { target: { value: '343 ' } });

        expect(storedValue()).toBe('+54 343');
        expect(numberInput().value).toBe('343 ');
    });
});
