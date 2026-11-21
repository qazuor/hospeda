/**
 * Tests for Select, Textarea, Checkbox and Radio (HOS-2413 T-007).
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
    Checkbox,
    CheckboxGroup,
    counterLevel,
    Field,
    Radio,
    RadioGroup,
    Select,
    Textarea
} from '../../../../src/components/account/ui';

describe('Select', () => {
    it('is a native select wired to its Field', () => {
        render(
            <Field
                label="Provincia"
                locale="es"
                error="Elegí una"
            >
                <Select defaultValue="">
                    <option value="">-</option>
                    <option value="er">Entre Ríos</option>
                </Select>
            </Field>
        );
        const select = screen.getByLabelText('Provincia');
        expect(select.tagName).toBe('SELECT');
        expect(select).toHaveAttribute('aria-invalid', 'true');
        expect(select).toHaveClass('control', 'select');
    });
});

describe('counterLevel', () => {
    it.each([
        [0, 'ok'],
        [89, 'ok'],
        [90, 'near'],
        [99, 'near'],
        [100, 'at'],
        [101, 'over']
    ] as const)('classifies %i of 100 as %s', (length, expected) => {
        expect(counterLevel({ length, limit: 100 })).toBe(expected);
    });
});

describe('Textarea counter', () => {
    const live = () => document.querySelector('[aria-live="polite"]') as HTMLElement;

    it('describes the textarea with the counter and announces only at 90% and 100%', async () => {
        // Arrange
        const user = userEvent.setup();
        render(
            <Textarea
                aria-label="Notas"
                limit={10}
                locale="es"
            />
        );
        const textarea = screen.getByLabelText('Notas');
        const counterId = textarea.getAttribute('aria-describedby') ?? '';
        expect(document.getElementById(counterId)).toHaveTextContent('0 de 10 caracteres');
        expect(live()).toBeEmptyDOMElement();
        // Act + Assert: 8 chars, still silent
        await user.type(textarea, '12345678');
        expect(live()).toBeEmptyDOMElement();
        // 9 chars (90%) speaks once
        await user.type(textarea, '9');
        expect(live()).toHaveTextContent('Quedan 1 caracteres');
        // 10 chars (100%) speaks the limit
        await user.type(textarea, '0');
        expect(live()).toHaveTextContent('Llegaste al límite de 10 caracteres');
    });

    it('blocks typing past a hard limit', async () => {
        const user = userEvent.setup();
        render(
            <Textarea
                aria-label="Notas"
                limit={3}
                locale="es"
            />
        );
        const textarea = screen.getByLabelText('Notas');
        await user.type(textarea, 'abcdef');
        expect(textarea).toHaveValue('abc');
    });

    it('softLimit lets the text go over, warns and turns the counter danger', async () => {
        const user = userEvent.setup();
        render(
            <Textarea
                aria-label="Notas"
                limit={3}
                softLimit
                locale="es"
            />
        );
        const textarea = screen.getByLabelText('Notas');
        await user.type(textarea, 'abcde');
        expect(textarea).toHaveValue('abcde');
        expect(live()).toHaveTextContent('Superaste el límite de 3 caracteres en 2');
        const counterId = textarea.getAttribute('aria-describedby') ?? '';
        expect(document.getElementById(counterId)).toHaveClass('over');
    });

    it('renders no counter without a limit', () => {
        render(<Textarea aria-label="Notas" />);
        expect(document.querySelector('[aria-live]')).toBeNull();
    });
});

describe('Checkbox', () => {
    it('sets indeterminate on the DOM node', () => {
        const { rerender } = render(
            <Checkbox
                label="Todos"
                indeterminate
            />
        );
        const box = screen.getByLabelText('Todos') as HTMLInputElement;
        expect(box.indeterminate).toBe(true);
        rerender(<Checkbox label="Todos" />);
        expect(box.indeterminate).toBe(false);
    });

    it('toggles and supports disabled', async () => {
        const user = userEvent.setup();
        render(
            <>
                <Checkbox label="Wifi" />
                <Checkbox
                    label="Pileta"
                    disabled
                />
            </>
        );
        await user.click(screen.getByLabelText('Wifi'));
        expect(screen.getByLabelText('Wifi')).toBeChecked();
        expect(screen.getByLabelText('Pileta')).toBeDisabled();
    });

    it('groups inside a fieldset with a legend', () => {
        render(
            <CheckboxGroup
                legend="Servicios"
                locale="es"
                hint="Elegí varios"
                error="Elegí al menos uno"
            >
                <Checkbox label="Wifi" />
            </CheckboxGroup>
        );
        const group = screen.getByRole('group', { name: 'Servicios' });
        expect(group.tagName).toBe('FIELDSET');
        expect(within(group).getByText('Elegí al menos uno')).toBeInTheDocument();
        expect(group).toHaveAttribute('aria-invalid', 'true');
    });
});

describe('Radio', () => {
    function Controlled() {
        const [value, setValue] = useState('a');
        return (
            <RadioGroup
                legend="Plan"
                locale="es"
                name="plan"
                value={value}
                onValueChange={setValue}
            >
                <Radio
                    value="a"
                    label="Uno"
                />
                <Radio
                    value="b"
                    label="Dos"
                    variant="card"
                />
            </RadioGroup>
        );
    }

    it('arrow keys move the selection natively', async () => {
        const user = userEvent.setup();
        render(<Controlled />);
        const one = screen.getByLabelText('Uno');
        expect(one).toBeChecked();
        one.focus();
        await user.keyboard('{ArrowDown}');
        expect(screen.getByLabelText('Dos')).toBeChecked();
    });

    it('shares the group name, exposes the legend and renders the card variant', () => {
        render(<Controlled />);
        expect(screen.getByRole('group', { name: 'Plan' })).toBeInTheDocument();
        expect(screen.getByLabelText('Uno')).toHaveAttribute('name', 'plan');
        expect(screen.getByLabelText('Dos').closest('label')).toHaveClass('card');
    });

    it('supports disabled', () => {
        render(
            <RadioGroup
                legend="Plan"
                locale="es"
                disabled
            >
                <Radio
                    value="a"
                    label="Uno"
                />
            </RadioGroup>
        );
        expect(screen.getByLabelText('Uno')).toBeDisabled();
    });
});
