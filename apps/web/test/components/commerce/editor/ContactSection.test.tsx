/**
 * @file ContactSection.test.tsx
 * @description Unit coverage for the commerce editor's contact section (HOS-258,
 * extended in HOS-371).
 *
 * HOS-371 changed both fields' shape: the phone is a country-code combobox plus
 * a local-number input recomposed into one stored string, and the email carries
 * a real `<label>` instead of a bare `aria-label`. The section's contract to the
 * orchestrator is unchanged — every edit is still reported as a PARTIAL
 * `contactInfo` patch.
 *
 * @module test/components/commerce/editor/ContactSection
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { COMMERCE_FIELD_PREFIX } from '@/components/commerce/editor/field-ids';
import { buildFieldId } from '@/lib/forms/build-field-id';
import { ContactSection } from '../../../../src/components/commerce/editor/ContactSection.client';

/**
 * Derived rather than written out (HOS-385): the section builds this id with
 * `buildFieldId`, so hardcoding it here would let the test and the markup drift
 * apart again — the exact failure mode this spec removes.
 */
const WORK_EMAIL_ID = buildFieldId({
    prefix: COMMERCE_FIELD_PREFIX,
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
            contact={{ mobilePhone: '', workEmail: '' }}
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
            contact: { mobilePhone: '+54 9 11 0000 0000', workEmail: 'dueno@test.com' }
        });

        // The stored string is SPLIT across the two controls: the dial code
        // selects the country, the remainder fills the number input.
        expect(screen.getByRole('button', { name: /País: Argentina/ })).toBeInTheDocument();
        expect(screen.getByLabelText('Número')).toHaveValue('9 11 0000 0000');
        expect(screen.getByLabelText('Email')).toHaveValue('dueno@test.com');
    });

    it('keeps an unrecognized stored value intact instead of dropping it', () => {
        // `parsePhoneValue` falls back to the default country and keeps the FULL
        // raw value as the number, so a legacy/odd value is never silently lost.
        renderSection({ contact: { mobilePhone: '011 4444-5555', workEmail: '' } });

        expect(screen.getByLabelText('Número')).toHaveValue('011 4444-5555');
    });

    it('reports a phone edit as a partial contact patch, recomposed with the dial code', () => {
        const { onContactChange } = renderSection();

        fireEvent.change(screen.getByLabelText('Número'), {
            target: { value: '9 11 9999 9999' }
        });

        // A PARTIAL patch, not the whole object: the orchestrator merges it into
        // the current contact so the untouched member survives the PATCH.
        expect(onContactChange).toHaveBeenCalledWith({ mobilePhone: '+54 9 11 9999 9999' });
    });

    it('recomposes the stored phone when only the country changes', () => {
        const { onContactChange } = renderSection({
            contact: { mobilePhone: '+54 9 11 0000 0000', workEmail: '' }
        });

        fireEvent.click(screen.getByRole('button', { name: /País: Argentina/ }));
        fireEvent.mouseDown(screen.getByRole('option', { name: /Brasil/ }));

        expect(onContactChange).toHaveBeenCalledWith({ mobilePhone: '+55 9 11 0000 0000' });
    });

    it('clears the stored phone entirely rather than saving a bare dial code', () => {
        const { onContactChange } = renderSection({
            contact: { mobilePhone: '+54 9 11 0000 0000', workEmail: '' }
        });

        fireEvent.change(screen.getByLabelText('Número'), { target: { value: '' } });

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
                contact={{ mobilePhone: '', workEmail: '' }}
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
        // this owner surface. Two text-ish inputs (number + email), no more —
        // the country control is a <button>, and its search box only exists
        // while the popover is open.
        expect(screen.queryByLabelText(/web/i)).toBeNull();
        expect(document.querySelectorAll('input')).toHaveLength(2);
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
        expect(screen.getByLabelText('Número')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    });

    it('leaves fields valid when there are no errors', () => {
        renderSection();

        expect(screen.getByLabelText('Número')).toHaveAttribute('aria-invalid', 'false');
        expect(screen.getByLabelText('Número')).not.toHaveAttribute('aria-describedby');
    });

    it('renders the scrollspy anchor the section nav will target', () => {
        renderSection();

        expect(document.getElementById('editor-contact')).not.toBeNull();
    });
});
