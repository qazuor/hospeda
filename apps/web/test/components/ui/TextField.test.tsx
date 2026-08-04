/**
 * @file TextField.test.tsx
 * @description Tests for the shared field wrapper (HOS-385).
 *
 * The assertions that matter are the wiring ones: that the label, the control
 * and the error element all resolve to the SAME derived id, and that focus by
 * that id actually lands on the control. Those are what let the per-editor
 * lookup tables and their static guard be deleted.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextField } from '@/components/ui/TextField';
import { buildFieldId } from '@/lib/forms/build-field-id';

describe('TextField', () => {
    it('should render the label associated with the control', () => {
        render(
            <TextField
                prefix="acc"
                name="facebook"
                label="Facebook"
            />
        );

        // getByLabelText only resolves when htmlFor/id actually pair up.
        expect(screen.getByLabelText('Facebook')).toBeInTheDocument();
    });

    it('should give the control the id derived from the Zod key', () => {
        render(
            <TextField
                prefix="acc"
                name="facebook"
                label="Facebook"
            />
        );

        expect(screen.getByLabelText('Facebook')).toHaveAttribute(
            'id',
            buildFieldId({ prefix: 'acc', name: 'facebook' })
        );
    });

    it('should be focusable by the id the derivation produces', () => {
        // This is the property the deleted guard was protecting: focus-on-error
        // resolves ids with getElementById, and a miss is a silent no-op.
        render(
            <TextField
                prefix="acc"
                name="summary"
                label="Resumen"
            />
        );

        const id = buildFieldId({ prefix: 'acc', name: 'summary' });
        const element = document.getElementById(id);

        expect(element).not.toBeNull();
        element?.focus();
        expect(document.activeElement).toBe(element);
    });

    it('should not render an error or mark the control invalid when there is no message', () => {
        render(
            <TextField
                prefix="acc"
                name="email"
                label="Email"
            />
        );

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'false');
    });

    it('should point aria-describedby at the rendered error when there is one', () => {
        render(
            <TextField
                prefix="acc"
                name="email"
                label="Email"
                error="Email inválido"
            />
        );

        const control = screen.getByLabelText('Email');
        const alert = screen.getByRole('alert');

        expect(control).toHaveAttribute('aria-invalid', 'true');
        // The pairing must resolve to the element actually in the document —
        // an aria-describedby aimed at nothing is a dangling reference.
        expect(control.getAttribute('aria-describedby')).toBe(alert.id);
        expect(alert).toHaveTextContent('Email inválido');
    });

    it('should not leave a dangling aria-describedby once the error clears', () => {
        const { rerender } = render(
            <TextField
                prefix="acc"
                name="email"
                label="Email"
                error="Email inválido"
            />
        );
        rerender(
            <TextField
                prefix="acc"
                name="email"
                label="Email"
            />
        );

        expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-describedby');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should target the suffixed control when one Zod key renders several', () => {
        render(
            <TextField
                prefix="acc"
                name="phone"
                suffix="number"
                label="Número"
            />
        );

        expect(screen.getByLabelText('Número')).toHaveAttribute('id', 'acc-phone-number');
    });

    it('should render a textarea when asked, with the same wiring', () => {
        render(
            <TextField
                as="textarea"
                prefix="acc"
                name="summary"
                label="Resumen"
                error="Muy corto"
            />
        );

        const control = screen.getByLabelText('Resumen');
        expect(control.tagName).toBe('TEXTAREA');
        expect(control).toHaveAttribute('id', 'acc-summary');
        expect(control.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
    });

    it('should render a select when asked, with the same wiring', () => {
        render(
            <TextField
                as="select"
                prefix="acc"
                name="type"
                label="Tipo"
                error="Requerido"
            >
                <option value="HOTEL">Hotel</option>
            </TextField>
        );

        const control = screen.getByLabelText('Tipo');
        expect(control.tagName).toBe('SELECT');
        expect(control).toHaveAttribute('id', 'acc-type');
        expect(control.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
    });

    it('should forward native props to the control', () => {
        render(
            <TextField
                prefix="acc"
                name="website"
                label="Sitio web"
                type="url"
                placeholder="https://ejemplo.com"
                value="https://hotel.com"
                onChange={() => undefined}
            />
        );

        const control = screen.getByLabelText('Sitio web');
        expect(control).toHaveAttribute('type', 'url');
        expect(control).toHaveAttribute('placeholder', 'https://ejemplo.com');
        expect(control).toHaveValue('https://hotel.com');
    });

    it('should apply the section-supplied classes rather than imposing its own', () => {
        // The wrapper is layout-neutral on purpose: the editors' `.fieldLabel`
        // genuinely differs between sections (display:block in 4, absent in 3),
        // so imposing one style here would move the layout.
        render(
            <TextField
                prefix="acc"
                name="name"
                label="Nombre"
                labelClassName="section-label"
                className="section-input"
            />
        );

        const control = screen.getByLabelText('Nombre');
        expect(control).toHaveClass('section-input');
        expect(document.querySelector('label')).toHaveClass('section-label');
    });
});
