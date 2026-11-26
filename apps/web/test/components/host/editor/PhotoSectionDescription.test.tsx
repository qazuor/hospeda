/**
 * @file PhotoSectionDescription.test.tsx
 * @description The photo section's cap line in its five states, per vertical
 * and locale (HOS-2495, AC-1/5/6/7/16). Real i18n.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhotoSectionDescription } from '@/components/host/editor/PhotoSectionDescription.client';

describe('PhotoSectionDescription', () => {
    it.each([
        ['accommodation', 'Subí hasta 15 fotos de tu alojamiento.'],
        ['venue', 'Subí hasta 15 fotos de tu ficha de Comer y salir.'],
        ['experience', 'Subí hasta 15 fotos de tu experiencia.']
    ] as const)('limited %s names the cap and the vertical (AC-1)', (vertical, copy) => {
        render(
            <PhotoSectionDescription
                locale="es"
                vertical={vertical}
                capView={{ kind: 'limited', cap: 15 }}
                breakdown={null}
            />
        );
        expect(screen.getByText(copy)).toBeInTheDocument();
        expect(screen.queryByTestId('photo-cap-breakdown')).toBeNull();
    });

    it('uses the singular for a cap of one', () => {
        render(
            <PhotoSectionDescription
                locale="es"
                vertical="venue"
                capView={{ kind: 'limited', cap: 1 }}
                breakdown={null}
            />
        );
        expect(
            screen.getByText('Subí hasta 1 foto de tu ficha de Comer y salir.')
        ).toBeInTheDocument();
    });

    it('prints every finite contribution and skips an unlimited one (AC-5)', () => {
        render(
            <PhotoSectionDescription
                locale="es"
                vertical="experience"
                capView={{ kind: 'limited', cap: 35 }}
                breakdown={{
                    contributions: [
                        { kind: 'PLAN', value: 15, sources: 1 },
                        { kind: 'COURTESY', value: 10, sources: 1 },
                        { kind: 'PERMANENT_GRANT', value: 10, sources: 1 }
                    ]
                }}
            />
        );
        expect(screen.getByTestId('photo-cap-breakdown').textContent).toMatch(
            /^15 .+ \+ 10 .+ \+ 10 .+ = 35$/
        );
    });

    it('reads unlimited without a number (AC-16)', () => {
        render(
            <PhotoSectionDescription
                locale="es"
                vertical="venue"
                capView={{ kind: 'unlimited', cap: null }}
                breakdown={null}
            />
        );
        expect(screen.getByText('Sin límite de fotos')).toBeInTheDocument();
        expect(screen.queryByText(/\d/)).toBeNull();
    });

    it('keeps "Sin límite" and lists the contributions without the sentinel (AC-5, AC-16)', () => {
        render(
            <PhotoSectionDescription
                locale="es"
                vertical="venue"
                capView={{ kind: 'unlimited', cap: null }}
                breakdown={{
                    contributions: [
                        { kind: 'PLAN', value: 'unlimited', sources: 1 },
                        { kind: 'ADDON', value: 20, sources: 2 }
                    ]
                }}
            />
        );
        const breakdown = screen.getByTestId('photo-cap-breakdown');
        expect(breakdown.textContent).toBe('sin límite de tu plan + 20 de packs de fotos');
        expect(breakdown.closest('p')?.textContent).toBe(
            'Sin límite de fotos sin límite de tu plan + 20 de packs de fotos'
        );
        expect(screen.queryByText(/2147483647|2\.147\.483\.647/)).toBeNull();
    });

    it('marks the loading line busy', () => {
        render(
            <PhotoSectionDescription
                locale="es"
                vertical="venue"
                capView={{ kind: 'loading', cap: null }}
                breakdown={null}
            />
        );
        expect(screen.getByText('Cargando tu límite de fotos…')).toHaveAttribute(
            'aria-busy',
            'true'
        );
    });

    it('a failed read never says there is no plan, and offers no pricing link (AC-7)', () => {
        render(
            <PhotoSectionDescription
                locale="es"
                vertical="venue"
                capView={{ kind: 'failed', cap: null }}
                breakdown={null}
            />
        );
        expect(screen.getByText(/No pudimos cargar tu límite de fotos/)).toHaveAttribute(
            'aria-busy',
            'false'
        );
        expect(screen.queryByText(/necesitás un plan/)).toBeNull();
        expect(screen.queryByRole('link')).toBeNull();
    });

    it.each([
        ['es', 'Ver planes'],
        ['en', 'View plans'],
        ['pt', 'Ver planos']
    ] as const)('no plan links to the vertical pricing page in %s (AC-6)', (locale, cta) => {
        render(
            <PhotoSectionDescription
                locale={locale}
                vertical="experience"
                capView={{ kind: 'none', cap: 0 }}
                breakdown={null}
            />
        );
        const link = screen.getByRole('link', { name: cta });
        expect(link.getAttribute('href')).toMatch(new RegExp(`^/${locale}/.+/`));
        expect(screen.queryByText(/Cargando|Loading|Carregando/)).toBeNull();
    });
});
