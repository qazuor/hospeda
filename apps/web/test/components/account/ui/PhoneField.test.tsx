/**
 * @file PhoneField.test.tsx
 * @description The phone field keeps its two halves (country, number) as local
 * state; a value changed from OUTSIDE — «Descartar» — must re-seed them, while
 * the values they compose themselves must never reset the typing.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Field, PhoneField } from '@/components/account/ui';
import { buildFieldId } from '@/lib/forms/build-field-id';

const NUMBER_ID = buildFieldId({ prefix: 'ce', name: 'contact.mobilePhone' });

/** An editor in miniature: a value, its persisted baseline and a discard. */
function PhoneHarness({ baseline }: { readonly baseline: string }) {
    const [value, setValue] = useState(baseline);
    return (
        <>
            <Field
                locale="es"
                label="Celular"
                id={NUMBER_ID}
            >
                <PhoneField
                    locale="es"
                    name="contact.mobilePhone"
                    value={value}
                    onValueChange={setValue}
                />
            </Field>
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

describe('PhoneField — discard (HOS-2497 review)', () => {
    it('keeps a selected country before a number is entered, then emits E.164', () => {
        render(<PhoneHarness baseline="" />);
        fireEvent.click(screen.getByRole('button', { name: /Argentina/ }));
        fireEvent.mouseDown(screen.getByRole('option', { name: /Uruguay/ }));
        expect(storedValue()).toBe('');
        expect(screen.getByRole('button', { name: /Uruguay/ })).toHaveTextContent('+598');
        fireEvent.change(numberInput(), { target: { value: '99 123-456' } });
        expect(storedValue()).toBe('+59899123456');
    });

    it('passes Field errors to the number and disables both halves', () => {
        render(
            <Field
                locale="es"
                label="Phone"
                id="phone"
                error="Invalid phone"
            >
                <PhoneField
                    locale="es"
                    value=""
                    disabled
                />
            </Field>
        );
        expect(screen.getByLabelText('Phone')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Phone')).toHaveAccessibleDescription('Error: Invalid phone');
        expect(screen.getByLabelText('Phone')).toBeDisabled();
        expect(screen.getByRole('button', { name: /Argentina/ })).toBeDisabled();
    });

    it.each([
        ['en', 'Germany'],
        ['pt', 'Alemanha']
    ] as const)('uses translated country names in %s', (locale, countryName) => {
        render(<PhoneField locale={locale} />);
        fireEvent.click(screen.getByRole('button', { name: /Argentina/ }));
        expect(screen.getByRole('option', { name: new RegExp(countryName) })).toBeInTheDocument();
    });

    it('shows the baseline again after a discard, and the next keystroke builds on it', () => {
        render(<PhoneHarness baseline="+54 343 111" />);
        expect(numberInput().value).toBe('343 111');

        fireEvent.change(numberInput(), { target: { value: '343 999' } });
        expect(storedValue()).toBe('+54343999');

        fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));

        expect(storedValue()).toBe('+54 343 111');
        expect(numberInput().value).toBe('343 111');

        fireEvent.change(numberInput(), { target: { value: '343 1112' } });
        expect(storedValue()).toBe('+543431112');
    });

    it('empties the inputs when the discarded baseline had no phone', () => {
        render(<PhoneHarness baseline="" />);

        fireEvent.change(numberInput(), { target: { value: '+598 99 123456' } });
        expect(storedValue()).toBe('+59899123456');

        fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));

        expect(storedValue()).toBe('');
        expect(numberInput().value).toBe('');
    });

    it('never resets the typing on a value it composed itself (trailing space kept)', () => {
        render(<PhoneHarness baseline="" />);

        fireEvent.change(numberInput(), { target: { value: '343 ' } });

        expect(storedValue()).toBe('+54343');
        expect(numberInput().value).toBe('343 ');
    });
});
