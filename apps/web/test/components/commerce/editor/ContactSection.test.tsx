/**
 * @file ContactSection.test.tsx
 * @description Unit coverage for the commerce editor's contact section (HOS-258).
 *
 * @module test/components/commerce/editor/ContactSection
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContactSection } from '../../../../src/components/commerce/editor/ContactSection.client';

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
            contact: { mobilePhone: '+5491100000000', workEmail: 'dueno@test.com' }
        });

        expect(screen.getByLabelText('Teléfono')).toHaveValue('+5491100000000');
        expect(screen.getByLabelText('Email')).toHaveValue('dueno@test.com');
    });

    it('reports a phone edit as a partial contact patch', () => {
        const { onContactChange } = renderSection();

        fireEvent.change(screen.getByLabelText('Teléfono'), {
            target: { value: '+5491199999999' }
        });

        // A PARTIAL patch, not the whole object: the orchestrator merges it into
        // the current contact so the untouched member survives the PATCH.
        expect(onContactChange).toHaveBeenCalledWith({ mobilePhone: '+5491199999999' });
    });

    it('reports an email edit as a partial contact patch', () => {
        const { onContactChange } = renderSection();

        fireEvent.change(screen.getByLabelText('Email'), {
            target: { value: 'nuevo@test.com' }
        });

        expect(onContactChange).toHaveBeenCalledWith({ workEmail: 'nuevo@test.com' });
    });

    it('does NOT expose a website field (SPEC-253 AC-4)', () => {
        renderSection();

        // `website` exists on ContactInfoSchema but is deliberately absent from
        // this owner surface. Two text-ish inputs, no more.
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
        expect(screen.getByLabelText('Teléfono')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    });

    it('leaves fields valid when there are no errors', () => {
        renderSection();

        expect(screen.getByLabelText('Teléfono')).toHaveAttribute('aria-invalid', 'false');
        expect(screen.getByLabelText('Teléfono')).not.toHaveAttribute('aria-describedby');
    });

    it('renders the scrollspy anchor the section nav will target', () => {
        renderSection();

        expect(document.getElementById('editor-contact')).not.toBeNull();
    });
});
