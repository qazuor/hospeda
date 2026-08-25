/**
 * @file SeoSection.test.tsx
 * @description Tests for the SEO override form section (HOS-792).
 *
 * Covers:
 * - Each empty field shows the value the public page would actually publish, as
 *   a placeholder AND as a named preview line.
 * - The two defaults are NOT the same value. That is the whole of finding 3:
 *   the old copy promised "the property's name" for both fields, while the
 *   description falls back to the summary. A test that gave the fixture the
 *   same string for both would pass with the fields crossed over.
 * - The preview reads `seoTitleDefault` / `seoDescriptionDefault` and never the
 *   raw `name` / `summary` columns. The fixture keeps those four apart on
 *   purpose, so a component reading the wrong pair fails with a wrong string
 *   rather than passing on a coincidence. Where those two defaults come from —
 *   `nameI18n ?? name` resolved for `es` — is pinned in the transform's own
 *   test; here we only prove the section shows what it was handed.
 * - The preview disappears the moment the host types, and comes back when the
 *   field is cleared, with no state of its own to get stuck in (AC-3).
 * - A field whose default does not exist yet (a fresh draft) shows no preview
 *   rather than an empty one.
 * - The counter is the shared `CharacterCounter`, so the minimum-length readout
 *   HOS-793 adds to it reaches this section too.
 * - Both fields are `union([literal(''), string().min(N)])`, so an EMPTY one is
 *   valid rather than short. The empty-field assertions below are what stops
 *   the counter from painting a correct field as a problem — the exact state
 *   HOS-792 made reachable by accepting `''` again.
 *
 * The `t` mock interpolates. A mock that returned the raw fallback would leave
 * `{{value}}` unexpanded, and every assertion about WHICH default is shown
 * would pass without the component ever reading its props.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SeoSectionProps } from '@/components/host/editor/SeoSection.client';
import { SeoSection } from '@/components/host/editor/SeoSection.client';
import type { AccommodationEditData } from '@/lib/api/types';

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string, params?: Record<string, string>) => {
            let text = fallback ?? key;
            for (const [name, value] of Object.entries(params ?? {})) {
                text = text.split(`{{${name}}}`).join(value);
            }
            return text;
        },
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false | null)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('@/components/host/editor/SeoSection.module.css', () => ({
    default: new Proxy({}, { get: (_target, prop) => String(prop) })
}));

vi.mock('@/components/ui/CharacterCounter.module.css', () => ({
    default: new Proxy({}, { get: (_target, prop) => String(prop) })
}));

vi.mock('@/components/ui/TextField.module.css', () => ({
    default: new Proxy({}, { get: (_target, prop) => String(prop) })
}));

/** What the public page publishes as the title — the transform's resolved value. */
const NAME = 'Cabañas Cheroga';

/** What it publishes as the description. Deliberately NOT the name. */
const SUMMARY = 'Cinco cabañas de madera frente al río Uruguay, con parque y parrilla propia.';

/**
 * The RAW columns, deliberately different from the published values above.
 *
 * This is what a stale `nameI18n` looks like from the editor's side: the host
 * renamed the property, the translation columns still hold the old text, and
 * the public page publishes the old text. A component that previewed
 * `data.name` would name a value Google never sees — so the fixture keeps the
 * two apart and every assertion below targets the published one.
 */
const RAW_NAME = 'Cheroga (nombre viejo sin traducir)';
const RAW_SUMMARY = 'Resumen viejo, distinto del que se publica.';

const MOCK_DATA: AccommodationEditData = {
    id: 'acc-1',
    slug: 'cabanas-cheroga',
    lifecycleState: 'DRAFT',
    name: RAW_NAME,
    summary: RAW_SUMMARY,
    description: 'Descripción larga',
    type: 'CABIN',
    destinationId: 'dest-1',
    latitude: null,
    longitude: null,
    street: '',
    number: '',
    floor: '',
    apartment: '',
    maxGuests: 6,
    bedrooms: 2,
    bathrooms: 1,
    beds: 3,
    minNights: 1,
    basePrice: 50000,
    currency: 'ARS',
    isAvailable: true,
    isFeatured: false,
    amenityIds: [],
    featureIds: [],
    phone: '',
    whatsapp: '',
    email: '',
    website: '',
    facebookUrl: '',
    instagramUrl: '',
    twitterUrl: '',
    linkedinUrl: '',
    tiktokUrl: '',
    youtubeUrl: '',
    seoTitle: '',
    seoDescription: '',
    seoTitleDefault: NAME,
    seoDescriptionDefault: SUMMARY,
    videos: []
};

function buildProps(overrides: Partial<SeoSectionProps> = {}): SeoSectionProps {
    return {
        locale: 'es',
        data: MOCK_DATA,
        errors: {},
        onFieldChange: vi.fn(),
        ...overrides
    };
}

function titleField(): HTMLInputElement {
    return screen.getByLabelText('Título para Google') as HTMLInputElement;
}

function descriptionField(): HTMLTextAreaElement {
    return screen.getByLabelText('Descripción para Google') as HTMLTextAreaElement;
}

describe('SeoSection', () => {
    it('should render the section title', () => {
        render(<SeoSection {...buildProps()} />);
        expect(screen.getByText('Buscadores (Google)')).toBeInTheDocument();
    });

    describe('the default each empty field will publish', () => {
        it('should place the property name in the title placeholder', () => {
            render(<SeoSection {...buildProps()} />);
            expect(titleField()).toHaveAttribute('placeholder', NAME);
        });

        it('should place the SUMMARY — not the name — in the description placeholder', () => {
            render(<SeoSection {...buildProps()} />);

            const placeholder = descriptionField().getAttribute('placeholder');
            expect(placeholder).toBe(SUMMARY);
            expect(placeholder).not.toBe(NAME);
        });

        it('should name both defaults in a preview line, one per field', () => {
            render(<SeoSection {...buildProps()} />);

            expect(
                screen.getByText(`Si lo dejás vacío, se publica: «${NAME}»`)
            ).toBeInTheDocument();
            expect(
                screen.getByText(`Si lo dejás vacío, se publica: «${SUMMARY}»`)
            ).toBeInTheDocument();
        });

        it('should preview the published value, never the raw column', () => {
            // The regression this guards: reading `data.name` instead of the
            // resolved default. Both are present on the fixture and they differ,
            // so the wrong source shows up as a wrong string rather than as a
            // missing one.
            render(<SeoSection {...buildProps()} />);

            expect(titleField()).toHaveAttribute('placeholder', NAME);
            expect(titleField()).not.toHaveAttribute('placeholder', RAW_NAME);
            expect(screen.queryByText(new RegExp(RAW_NAME))).not.toBeInTheDocument();
            expect(screen.queryByText(new RegExp(RAW_SUMMARY))).not.toBeInTheDocument();
        });

        it('should not announce a default the accommodation does not have yet', () => {
            render(
                <SeoSection
                    {...buildProps({ data: { ...MOCK_DATA, seoDescriptionDefault: '' } })}
                />
            );

            expect(descriptionField()).not.toHaveAttribute('placeholder');
            expect(screen.queryByText('Si lo dejás vacío, se publica: «»')).not.toBeInTheDocument();
            // The title's own default is untouched by the missing summary.
            expect(
                screen.getByText(`Si lo dejás vacío, se publica: «${NAME}»`)
            ).toBeInTheDocument();
        });

        it('should apply the same whitespace rule to a nameless draft', () => {
            // The mirror of the case above. Without it, dropping `.trim()` from
            // the TITLE default alone survives every other assertion here.
            render(<SeoSection {...buildProps({ data: { ...MOCK_DATA, seoTitleDefault: '' } })} />);

            expect(titleField()).not.toHaveAttribute('placeholder');
            expect(screen.queryByText('Si lo dejás vacío, se publica: «»')).not.toBeInTheDocument();
            expect(
                screen.getByText(`Si lo dejás vacío, se publica: «${SUMMARY}»`)
            ).toBeInTheDocument();
        });
    });

    describe('authored text versus the default', () => {
        it('should drop the preview once the field carries the host own text', () => {
            const authored = 'Cabañas frente al río en Concepción del Uruguay';
            render(<SeoSection {...buildProps({ data: { ...MOCK_DATA, seoTitle: authored } })} />);

            expect(titleField()).toHaveValue(authored);
            expect(
                screen.queryByText(`Si lo dejás vacío, se publica: «${NAME}»`)
            ).not.toBeInTheDocument();
            // The default is still offered as the placeholder underneath, so
            // clearing the field reveals it again with no extra state.
            expect(titleField()).toHaveAttribute('placeholder', NAME);
        });

        it('should bring the preview back when the field is cleared (AC-3)', () => {
            const { rerender } = render(
                <SeoSection {...buildProps({ data: { ...MOCK_DATA, seoTitle: 'Algo escrito' } })} />
            );
            expect(
                screen.queryByText(`Si lo dejás vacío, se publica: «${NAME}»`)
            ).not.toBeInTheDocument();

            rerender(<SeoSection {...buildProps({ data: { ...MOCK_DATA, seoTitle: '' } })} />);

            expect(titleField()).toHaveValue('');
            expect(
                screen.getByText(`Si lo dejás vacío, se publica: «${NAME}»`)
            ).toBeInTheDocument();
        });

        it('should report a cleared field as the empty string, not as absent', () => {
            const onFieldChange = vi.fn();
            render(
                <SeoSection
                    {...buildProps({
                        data: { ...MOCK_DATA, seoTitle: 'Algo escrito' },
                        onFieldChange
                    })}
                />
            );

            fireEvent.change(titleField(), { target: { value: '' } });

            // `''` is what tells the save path to remove the stored override —
            // dropping the key instead would leave the old value in place.
            expect(onFieldChange).toHaveBeenCalledWith('seoTitle', '');
        });
    });

    describe('the character counter', () => {
        it('should render the shared counter for both fields, minimum included', () => {
            render(<SeoSection {...buildProps()} />);

            expect(screen.getByTestId('seo-title-char-counter')).toHaveTextContent(
                '0/60 · mín. 30'
            );
            expect(screen.getByTestId('seo-description-char-counter')).toHaveTextContent(
                '0/160 · mín. 70'
            );
        });

        it('should count the authored value, never the default behind it', () => {
            render(<SeoSection {...buildProps({ data: { ...MOCK_DATA, seoTitle: 'Hola' } })} />);

            expect(screen.getByTestId('seo-title-char-counter')).toHaveTextContent('4/60');
            expect(screen.queryByText(new RegExp(`${NAME.length}/60`))).not.toBeInTheDocument();
        });

        it('should leave an empty field unflagged — empty is a valid "no override"', () => {
            render(<SeoSection {...buildProps()} />);

            expect(screen.getByTestId('seo-title-char-counter')).toHaveAttribute(
                'data-state',
                'normal'
            );
            expect(screen.getByTestId('seo-description-char-counter')).toHaveAttribute(
                'data-state',
                'normal'
            );
        });

        it('should flag a field that has content but has not cleared its floor', () => {
            render(
                <SeoSection
                    {...buildProps({
                        data: { ...MOCK_DATA, seoTitle: 'Hola', seoDescription: 'x'.repeat(70) }
                    })}
                />
            );

            expect(screen.getByTestId('seo-title-char-counter')).toHaveAttribute(
                'data-state',
                'under-minimum'
            );
            // 70 is exactly the floor, so the description is already valid.
            expect(screen.getByTestId('seo-description-char-counter')).toHaveAttribute(
                'data-state',
                'normal'
            );
        });
    });

    it('should display an inline validation error on the description too', () => {
        render(
            <SeoSection
                {...buildProps({
                    errors: { seoDescription: 'La descripción debe tener al menos 70 caracteres' }
                })}
            />
        );

        expect(
            screen.getByText('La descripción debe tener al menos 70 caracteres')
        ).toBeInTheDocument();
    });

    it('should display inline validation errors', () => {
        render(
            <SeoSection
                {...buildProps({
                    errors: { seoTitle: 'El título debe tener al menos 30 caracteres' }
                })}
            />
        );

        expect(screen.getByText('El título debe tener al menos 30 caracteres')).toBeInTheDocument();
    });
});
