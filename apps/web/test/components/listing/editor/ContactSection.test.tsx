/**
 * @file ContactSection.test.tsx
 * @description Unit coverage for the listing editor's contact section (HOS-258,
 * extended in HOS-371).
 *
 * HOS-371 changed both fields' shape: the phone is a country-code combobox plus
 * a local-number input recomposed into one stored string, and the email carries
 * a real `<label>` instead of a bare `aria-label`. The section's contract to the
 * orchestrator is unchanged — every edit is still reported as a PARTIAL
 * `contactInfo` patch.
 *
 * @module test/components/listing/editor/ContactSection
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LISTING_FIELD_PREFIX } from '@/components/listing/editor/field-ids';
import { buildFieldId } from '@/lib/forms/build-field-id';
import { ContactSection } from '../../../../src/components/listing/editor/ContactSection.client';

/**
 * Derived rather than written out (HOS-385): the section builds this id with
 * `buildFieldId`, so hardcoding it here would let the test and the markup drift
 * apart again — the exact failure mode this spec removes.
 */
const WORK_EMAIL_ID = buildFieldId({
    prefix: LISTING_FIELD_PREFIX,
    name: 'contactInfo.workEmail'
});

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? `[MISSING:${key}]`
    })
}));

function renderSection(overrides: Partial<React.ComponentProps<typeof ContactSection>> = {}): {
    onContactChange: ReturnType<typeof vi.fn>;
} {
    const onContactChange = vi.fn();
    render(
        <ContactSection
            locale="es"
            contact={{ mobilePhone: '', workPhone: '', workEmail: '' }}
            errors={{}}
            onContactChange={onContactChange}
            {...overrides}
        />
    );
    return { onContactChange };
}

describe('ContactSection', () => {
    it('seeds both fields from the contact prop', () => {
        renderSection({
            contact: {
                mobilePhone: '+54 9 11 0000 0000',
                workPhone: '',
                workEmail: 'dueno@test.com'
            }
        });

        // The stored string is SPLIT across the two controls: the dial code
        // selects the country, the remainder fills the number input.
        expect(screen.getAllByRole('button', { name: /País: Argentina/ })[0]).toBeInTheDocument();
        expect(screen.getAllByLabelText('Número')[0]).toHaveValue('9 11 0000 0000');
        expect(screen.getByLabelText('Email')).toHaveValue('dueno@test.com');
    });

    it('keeps an unrecognized stored value intact instead of dropping it', () => {
        // `parsePhoneValue` falls back to the default country and keeps the FULL
        // raw value as the number, so a legacy/odd value is never silently lost.
        renderSection({ contact: { mobilePhone: '011 4444-5555', workPhone: '', workEmail: '' } });

        expect(screen.getAllByLabelText('Número')[0]).toHaveValue('011 4444-5555');
    });

    it('reports a phone edit as a partial contact patch, recomposed with the dial code', () => {
        const { onContactChange } = renderSection();

        fireEvent.change(screen.getAllByLabelText('Número')[0], {
            target: { value: '9 11 9999 9999' }
        });

        // A PARTIAL patch, not the whole object: the orchestrator merges it into
        // the current contact so the untouched member survives the PATCH.
        expect(onContactChange).toHaveBeenCalledWith({ mobilePhone: '+54 9 11 9999 9999' });
    });

    it('recomposes the stored phone when only the country changes', () => {
        const { onContactChange } = renderSection({
            contact: { mobilePhone: '+54 9 11 0000 0000', workPhone: '', workEmail: '' }
        });

        fireEvent.click(
            screen.getAllByRole('button', { name: /País: Argentina/ })[0] as HTMLElement
        );
        fireEvent.mouseDown(screen.getByRole('option', { name: /Brasil/ }));

        expect(onContactChange).toHaveBeenCalledWith({ mobilePhone: '+55 9 11 0000 0000' });
    });

    it('clears the stored phone entirely rather than saving a bare dial code', () => {
        const { onContactChange } = renderSection({
            contact: { mobilePhone: '+54 9 11 0000 0000', workPhone: '', workEmail: '' }
        });

        fireEvent.change(screen.getAllByLabelText('Número')[0], { target: { value: '' } });

        expect(onContactChange).toHaveBeenCalledWith({ mobilePhone: '' });
    });

    it('reports an email edit as a partial contact patch', () => {
        const { onContactChange } = renderSection();

        fireEvent.change(screen.getByLabelText('Email'), {
            target: { value: 'nuevo@test.com' }
        });

        expect(onContactChange).toHaveBeenCalledWith({ workEmail: 'nuevo@test.com' });
    });

    it('names the email input with a real <label>, not just an aria-label (HOS-371)', () => {
        const { container } = render(
            <ContactSection
                locale="es"
                contact={{ mobilePhone: '', workPhone: '', workEmail: '' }}
                errors={{}}
                onContactChange={vi.fn()}
            />
        );

        // `getByLabelText` matches an aria-label too, so it cannot tell the two
        // mechanisms apart — assert the <label> element itself. An aria-label
        // alone leaves a sighted user staring at an anonymous box (WCAG 3.3.2).
        const label = [...container.querySelectorAll('label')].find(
            (el) => el.textContent?.trim() === 'Email'
        );
        expect(label).toBeDefined();
        expect(label?.getAttribute('for')).toBe(WORK_EMAIL_ID);
        expect(container.querySelector(`#${WORK_EMAIL_ID}`)).toBeInstanceOf(HTMLInputElement);
    });

    it('does NOT expose a website field (SPEC-253 AC-4)', () => {
        renderSection();

        // `website` exists on ContactInfoSchema but is deliberately absent from
        // this owner surface. Three text-ish inputs (phone number, landline
        // number — HOS-2042 — and email), no more: the country control is a
        // <button>, and its search box only exists while the popover is open.
        expect(screen.queryByLabelText(/web/i)).toBeNull();
        expect(document.querySelectorAll('input')).toHaveLength(3);
    });

    it('surfaces per-field errors and marks the field invalid', () => {
        renderSection({
            errors: {
                'contactInfo.mobilePhone': 'Teléfono inválido',
                'contactInfo.workEmail': 'Email inválido'
            }
        });

        expect(screen.getByText('Teléfono inválido')).toBeInTheDocument();
        expect(screen.getByText('Email inválido')).toBeInTheDocument();
        expect(screen.getAllByLabelText('Número')[0]).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    });

    it('leaves fields valid when there are no errors', () => {
        renderSection();

        expect(screen.getAllByLabelText('Número')[0]).toHaveAttribute('aria-invalid', 'false');
        expect(screen.getAllByLabelText('Número')[0]).not.toHaveAttribute('aria-describedby');
    });

    it('renders the scrollspy anchor the section nav will target', () => {
        renderSection();

        expect(document.getElementById('editor-contact')).not.toBeNull();
    });

    describe('optional landline (HOS-2042)', () => {
        it('renders a "Teléfono fijo" group next to the main phone group', () => {
            renderSection();

            expect(screen.getByRole('group', { name: 'Teléfono' })).toBeInTheDocument();
            expect(screen.getByRole('group', { name: 'Teléfono fijo' })).toBeInTheDocument();
        });

        it('seeds the landline pair from contact.workPhone', () => {
            renderSection({
                contact: { mobilePhone: '', workPhone: '+54 3442 45-2345', workEmail: '' }
            });

            expect(screen.getAllByLabelText('Número')[1]).toHaveValue('3442 45-2345');
        });

        it('reports a typed landline as a workPhone patch and never touches mobilePhone', () => {
            const { onContactChange } = renderSection();

            fireEvent.change(screen.getAllByLabelText('Número')[1] as HTMLElement, {
                target: { value: '3442 45-2345' }
            });

            expect(onContactChange).toHaveBeenCalledWith({ workPhone: '+54 3442 45-2345' });
        });

        it('shows the workPhone error on the landline control only', () => {
            renderSection({ errors: { 'contactInfo.workPhone': 'Teléfono inválido' } });

            const [mobile, landline] = screen.getAllByLabelText('Número');
            expect(mobile).toHaveAttribute('aria-invalid', 'false');
            expect(landline).toHaveAttribute('aria-invalid', 'true');
            expect(screen.getByText('Teléfono inválido')).toBeInTheDocument();
        });
    });

    it('tells the owner these contact channels are shown publicly (HOS-2042)', () => {
        renderSection();

        expect(
            screen.getByText('Estos datos de contacto se muestran públicamente en tu ficha.')
        ).toBeInTheDocument();
    });

    describe('WhatsApp controls (HOS-2256)', () => {
        const whatsapp = (visibility: string) => ({
            number: '',
            visibility,
            onNumberChange: vi.fn(),
            onVisibilityChange: vi.fn()
        });

        it('renders no WhatsApp control unless the caller passes them', () => {
            renderSection();

            expect(screen.queryByLabelText('Público')).not.toBeInTheDocument();
        });

        it('says the button stays hidden until the owner chooses (AC-16)', () => {
            renderSection({ whatsapp: whatsapp('') });

            expect(screen.getByText(/el botón de WhatsApp no se muestra/)).toBeInTheDocument();
            expect(screen.getByLabelText('Público')).not.toBeChecked();
            expect(screen.getByLabelText('Solo usuarios logueados')).not.toBeChecked();
        });

        it('warns that a public number can be copied by third parties (AC-21)', () => {
            renderSection({ whatsapp: whatsapp('PUBLIC') });

            expect(screen.getByText(/cualquiera puede copiarlo/)).toBeInTheDocument();
            expect(screen.getByLabelText('Público')).toBeChecked();
        });

        it('does not show the copy warning for the signed-in-only choice', () => {
            renderSection({ whatsapp: whatsapp('LOGGED_IN_ONLY') });

            expect(screen.queryByText(/cualquiera puede copiarlo/)).not.toBeInTheDocument();
        });

        it('reports the picked visibility', () => {
            const controls = whatsapp('');
            renderSection({ whatsapp: controls });

            fireEvent.click(screen.getByLabelText('Público'));

            expect(controls.onVisibilityChange).toHaveBeenCalledWith('PUBLIC');
        });
    });
});
