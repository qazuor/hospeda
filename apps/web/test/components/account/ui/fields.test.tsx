/**
 * Tests for Field, TextInput, InputGroup and PhoneField (HOS-2413 T-006).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field, InputGroup, PhoneField, TextInput } from '../../../../src/components/account/ui';

describe('Field + TextInput', () => {
    it('associates the visible label with the control', () => {
        // Arrange + Act
        render(
            <Field
                label="Nombre"
                locale="es"
            >
                <TextInput />
            </Field>
        );
        // Assert
        expect(screen.getByLabelText('Nombre')).toBeInstanceOf(HTMLInputElement);
    });

    it('uses the explicit id and builds one from idParts', () => {
        const { rerender } = render(
            <Field
                label="Nombre"
                locale="es"
                id="custom-id"
            >
                <TextInput />
            </Field>
        );
        expect(screen.getByLabelText('Nombre')).toHaveAttribute('id', 'custom-id');
        rerender(
            <Field
                label="Nombre"
                locale="es"
                idParts={{ prefix: 'acc', name: 'contact.name' }}
            >
                <TextInput />
            </Field>
        );
        expect(screen.getByLabelText('Nombre')).toHaveAttribute('id', 'acc-contact-name');
    });

    it('marks a required field with an asterisk and hidden text', () => {
        render(
            <Field
                label="Nombre"
                locale="es"
                required
            >
                <TextInput />
            </Field>
        );
        const input = screen.getByLabelText(/Nombre/);
        expect(input).toHaveAttribute('aria-required', 'true');
        expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByText(/obligatorio/)).toBeInTheDocument();
    });

    it('shows (opcional) for an optional field only', () => {
        const { rerender } = render(
            <Field
                label="Nombre"
                locale="es"
                optional
            >
                <TextInput />
            </Field>
        );
        expect(screen.getByText('(opcional)')).toBeInTheDocument();
        rerender(
            <Field
                label="Nombre"
                locale="es"
            >
                <TextInput />
            </Field>
        );
        expect(screen.queryByText('(opcional)')).not.toBeInTheDocument();
    });

    it('lists hint then error in aria-describedby and toggles aria-invalid', () => {
        // Arrange
        const { rerender } = render(
            <Field
                label="Nombre"
                locale="es"
                id="f"
                hint="Como en tu DNI"
            >
                <TextInput />
            </Field>
        );
        const input = screen.getByLabelText('Nombre');
        expect(input).toHaveAttribute('aria-describedby', 'f-hint');
        expect(input).not.toHaveAttribute('aria-invalid');
        // Act
        rerender(
            <Field
                label="Nombre"
                locale="es"
                id="f"
                hint="Como en tu DNI"
                error="Falta el nombre"
            >
                <TextInput />
            </Field>
        );
        // Assert
        expect(input).toHaveAttribute('aria-describedby', 'f-hint f-error');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(document.getElementById('f-error')).toHaveTextContent('Falta el nombre');
    });

    it('never lets a placeholder replace the label (carta audit finding)', () => {
        render(
            <Field
                label="Precio"
                locale="es"
            >
                <TextInput placeholder="Ej: 1500" />
            </Field>
        );
        expect(screen.getByText('Precio').tagName).toBe('LABEL');
        expect(screen.getByLabelText('Precio')).toHaveAttribute('placeholder', 'Ej: 1500');
    });

    it('renders data-help on the Field root only when helpId is passed', () => {
        const { container } = render(
            <Field
                label="Nombre"
                locale="es"
                helpId="section:venue.carta"
            >
                <TextInput />
            </Field>
        );
        expect(container.querySelector('[data-help="section:venue.carta"]')).not.toBeNull();
    });
});

describe('InputGroup', () => {
    it('renders the prefix and suffix addons', () => {
        const { container } = render(
            <Field
                label="Precio"
                locale="es"
            >
                <InputGroup
                    prefix="$"
                    suffix="ARS"
                />
            </Field>
        );
        expect(container.querySelector('[data-addon="prefix"]')).toHaveTextContent('$');
        expect(container.querySelector('[data-addon="suffix"]')).toHaveTextContent('ARS');
        expect(screen.getByLabelText('Precio')).toBeInTheDocument();
    });

    it('marks the wrapper invalid from the Field error', () => {
        const { container } = render(
            <Field
                label="Precio"
                locale="es"
                error="Mal"
            >
                <InputGroup prefix="$" />
            </Field>
        );
        expect(container.querySelector('.group')).toHaveClass('groupInvalid');
        expect(screen.getByLabelText('Precio')).toHaveAttribute('aria-invalid', 'true');
    });
});

describe('PhoneField', () => {
    it('is a tel input with a +54 prefix and the right hints', () => {
        const { container } = render(
            <Field
                label="Teléfono"
                locale="es"
            >
                <PhoneField />
            </Field>
        );
        const input = screen.getByLabelText('Teléfono');
        expect(input).toHaveAttribute('type', 'tel');
        expect(input).toHaveAttribute('inputmode', 'tel');
        expect(input).toHaveAttribute('autocomplete', 'tel');
        expect(container.querySelector('[data-addon="prefix"]')).toHaveTextContent('+54');
    });
});
