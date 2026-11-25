/** Venue dish surfaces and translation disclosure recovery. */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VenueMenuDishFields } from '@/components/venue/VenueMenuDishFields.client';
import { VenueMenuTranslationFields } from '@/components/venue/VenueMenuTranslationFields.client';
import { createTranslations } from '@/lib/i18n';

const translationProps = {
    locale: 'es' as const,
    nameEn: 'Soup',
    namePt: 'Sopa',
    descriptionEn: '',
    descriptionPt: '',
    hasDescription: true,
    locked: false,
    onChange: vi.fn()
};

describe('venue menu fields', () => {
    it('renders the kit disclosure with a real chevron and starts collapsed', () => {
        const { container } = render(<VenueMenuTranslationFields {...translationProps} />);
        const summary = screen.getByText('Traducciones (EN/PT)');
        expect(summary.tagName).toBe('SUMMARY');
        expect(summary.querySelector('svg')).not.toBeNull();
        expect(container.querySelector('details')).not.toHaveAttribute('open');
    });

    it('opens on a refused save and keeps translation clearing available', () => {
        const onChange = vi.fn();
        const { container, rerender } = render(
            <VenueMenuTranslationFields
                {...translationProps}
                onChange={onChange}
            />
        );
        rerender(
            <VenueMenuTranslationFields
                {...translationProps}
                locked
                onChange={onChange}
            />
        );
        expect(container.querySelector('details')).toHaveAttribute('open');
        const name = screen.getByLabelText('Nombre en inglés');
        expect(name).not.toBeDisabled();
        fireEvent.change(name, { target: { value: '' } });
        expect(onChange).toHaveBeenCalledWith({ nameEn: '' });
    });

    it('frames each dish in a div card, never an extra list item or Section', () => {
        const { t } = createTranslations('es');
        const { container } = render(
            <VenueMenuDishFields
                locale="es"
                t={t}
                item={{
                    name: 'Soup',
                    description: '',
                    nameEn: '',
                    namePt: '',
                    descriptionEn: '',
                    descriptionPt: '',
                    priceCents: null,
                    isAvailable: true,
                    photoUrl: null,
                    photoAlt: null
                }}
                readOnly={false}
                busy={false}
                isPhotoLocked={false}
                isTranslationLocked={false}
                onPatch={vi.fn()}
                onUploadPhoto={vi.fn()}
                onRemovePhoto={vi.fn()}
            />
        );
        expect(container.firstElementChild?.tagName).toBe('DIV');
        expect(container.querySelector('h3')).toHaveTextContent('Soup');
        expect(container.querySelector('li, [data-kit-section]')).toBeNull();
    });
});
