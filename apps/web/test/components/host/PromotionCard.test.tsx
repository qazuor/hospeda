import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PromotionCard } from '@/components/host/PromotionCard';

describe('shared owner promotion card', () => {
    it('renders the benefit as the headline and secondary facts as labelled values', () => {
        render(
            <ul>
                <PromotionCard
                    locale="es"
                    title="Temporada baja"
                    benefit="20%"
                    status="Activa"
                    validFrom="2026-11-01"
                    validUntil="2026-11-30"
                    actions={<button type="button">Editar</button>}
                />
            </ul>
        );
        expect(screen.getByRole('heading', { name: '20%' })).toBeInTheDocument();
        expect(screen.getByText('Temporada baja')).toBeInTheDocument();
        expect(screen.getByText('Estado').tagName).toBe('DT');
        expect(screen.getByText('Vigencia').tagName).toBe('DT');
        expect(screen.getByText('Activa').tagName).toBe('DD');
    });

    it.each([
        'es',
        'en',
        'pt'
    ] as const)('includes benefit and calendar dates in raw %s SSR output', (locale) => {
        const html = renderToStaticMarkup(
            <PromotionCard
                locale={locale}
                title="Season offer"
                benefit="20%"
                status="Active"
                validFrom="2026-11-01"
                validUntil={null}
                actions={null}
            />
        );
        expect(html).toContain('20%');
        expect(html).toContain('2026');
        expect(html).not.toContain('host.promotions.');
    });
});
