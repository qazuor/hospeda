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
import { describe, expect, it, vi } from 'vitest';
import { FieldError } from '@/components/ui/FieldError';
import { buildFieldErrorId, TextField } from '@/components/ui/TextField';
import { buildFieldId } from '@/lib/forms/build-field-id';

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (_key: string, fallback: string, params: Record<string, string>) =>
            fallback
                .replaceAll('{{count}}', params.count)
                .replaceAll('{{max}}', params.max)
                .replaceAll('{{min}}', params.min ?? '')
    })
}));

vi.mock('@/components/ui/CharacterCounter.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

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

    describe('renderError={false} — one Zod field, several controls', () => {
        it('should not render the error itself', () => {
            render(
                <TextField
                    prefix="acc"
                    name="phone"
                    suffix="number"
                    label="Número"
                    error="Teléfono inválido"
                    renderError={false}
                />
            );

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('should STILL mark the control invalid and describe it', () => {
            // The caller only chooses where the message goes. If opting out of
            // the render also dropped the a11y wiring, this prop would be a
            // silent accessibility regression rather than a layout choice.
            render(
                <TextField
                    prefix="acc"
                    name="phone"
                    suffix="number"
                    label="Número"
                    error="Teléfono inválido"
                    renderError={false}
                />
            );

            const control = screen.getByLabelText('Número');
            expect(control).toHaveAttribute('aria-invalid', 'true');
            expect(control).toHaveAttribute(
                'aria-describedby',
                buildFieldErrorId({ prefix: 'acc', name: 'phone', suffix: 'number' })
            );
        });

        it('should pair with an externally placed FieldError built from the same params', () => {
            // The whole point of exporting buildFieldErrorId: the message the
            // caller positions elsewhere must still be the element the control
            // points at. Assert they resolve to each other, not just that both
            // exist.
            const params = { prefix: 'acc', name: 'phone', suffix: 'number' } as const;

            render(
                <fieldset>
                    <TextField
                        {...params}
                        label="Número"
                        error="Teléfono inválido"
                        renderError={false}
                    />
                    <FieldError
                        id={buildFieldErrorId(params)}
                        message="Teléfono inválido"
                    />
                </fieldset>
            );

            const control = screen.getByLabelText('Número');
            const alert = screen.getByRole('alert');

            expect(control.getAttribute('aria-describedby')).toBe(alert.id);
            expect(document.getElementById(alert.id)).toBe(alert);
        });

        it('should derive the error id from the control id, suffix included', () => {
            expect(buildFieldErrorId({ prefix: 'acc', name: 'phone', suffix: 'number' })).toBe(
                'acc-phone-number-error'
            );
        });
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

    it('should pass the minimum-aware counter through the shared wiring', () => {
        render(
            <TextField
                prefix="acc"
                name="name"
                label="Nombre"
                value="AB"
                maxLength={100}
                onChange={() => undefined}
                counter={{ locale: 'es', min: 3, testId: 'name-counter' }}
            />
        );

        const control = screen.getByLabelText('Nombre');
        const counter = screen.getByTestId('name-counter');

        expect(counter).toHaveTextContent('2/100 · mín. 3');
        expect(counter).toHaveAttribute('data-state', 'under-minimum');
        expect(control.getAttribute('aria-describedby')).toBe(counter.id);
    });

    it('should announce a caller-supplied hint alongside the error and the counter', () => {
        render(
            <>
                <TextField
                    prefix="acc"
                    name="seoTitle"
                    label="Título para Google"
                    value=""
                    maxLength={60}
                    onChange={() => undefined}
                    error="Muy corto"
                    describedByExtraId="acc-seoTitle-default-preview"
                    counter={{ locale: 'es', min: 30, optional: true, testId: 'seo-counter' }}
                />
                <p id="acc-seoTitle-default-preview">Si lo dejás vacío, se publica: «Cheroga»</p>
            </>
        );

        const describedBy = screen
            .getByLabelText('Título para Google')
            .getAttribute('aria-describedby');

        // All three, and the hint must not displace the other two.
        expect(describedBy?.split(' ')).toEqual([
            buildFieldErrorId({ prefix: 'acc', name: 'seoTitle' }),
            screen.getByTestId('seo-counter').id,
            'acc-seoTitle-default-preview'
        ]);
    });

    it('should leave aria-describedby untouched when the caller supplies no hint', () => {
        render(
            <TextField
                prefix="acc"
                name="seoTitle"
                label="Título para Google"
                value=""
                onChange={() => undefined}
            />
        );

        expect(screen.getByLabelText('Título para Google')).not.toHaveAttribute('aria-describedby');
    });
});
