/**
 * @file ReviewCard.react.test.tsx
 * @description React Testing Library tests for the ReviewCard.tsx component
 * after the Badge migration (Phase 2). Asserts the entity badge is rendered
 * using the shared Badge primitive (clickable when an entity URL is known,
 * decorative otherwise) and that the old `.entityBadge` / `.entityBadgeLink`
 * CSS classes have been removed.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ReviewCard } from '@/components/shared/cards/ReviewCard';
import type { ReviewCardData } from '@/data/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/shared/cards/ReviewCard.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/components/shared/ui/Badge.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

const baseReview: ReviewCardData = {
    id: 'r-1',
    quote: 'Excelente estadía, volveríamos sin dudarlo.',
    rating: 5,
    reviewerName: 'Carolina Rodríguez',
    reviewerOrigin: 'Buenos Aires, Argentina',
    date: '2024-03-15T10:00:00Z'
};

describe('ReviewCard (React) — Badge migration', () => {
    describe('accommodation review with entity URL', () => {
        it('renders the entity badge as an <a> linking to the accommodation detail page', () => {
            const data: ReviewCardData = {
                ...baseReview,
                entityType: 'accommodation',
                entitySlug: 'hotel-aurora',
                entityName: 'Hotel Aurora'
            };
            render(
                <ReviewCard
                    data={data}
                    locale="es"
                />
            );
            // Badge label — falls back to "Alojamiento" when no badge override is provided
            const link = screen.getByRole('link', { name: /Ver Alojamiento: Hotel Aurora/i });
            expect(link).toBeInTheDocument();
            expect(link).toHaveAttribute('href', '/es/alojamientos/hotel-aurora/');
            expect(link.textContent).toContain('Alojamiento');
        });
    });

    describe('destination review with entity URL', () => {
        it('renders the entity badge as an <a> linking to the destination detail page', () => {
            const data: ReviewCardData = {
                ...baseReview,
                entityType: 'destination',
                entitySlug: 'concepcion-del-uruguay',
                entityName: 'Concepción del Uruguay'
            };
            render(
                <ReviewCard
                    data={data}
                    locale="es"
                />
            );
            const link = screen.getByRole('link', {
                name: /Ver Destino: Concepción del Uruguay/i
            });
            expect(link).toBeInTheDocument();
            expect(link).toHaveAttribute('href', '/es/destinos/concepcion-del-uruguay/');
            expect(link.textContent).toContain('Destino');
        });
    });

    describe('review without entity URL', () => {
        it('renders the entity badge as a decorative <span> (no link)', () => {
            const data: ReviewCardData = {
                ...baseReview,
                entityType: 'accommodation'
                // no entitySlug → no link
            };
            const { container } = render(
                <ReviewCard
                    data={data}
                    locale="es"
                />
            );
            // No entity link should be rendered
            expect(screen.queryByRole('link', { name: /Ver Alojamiento/i })).toBeNull();
            // Label still renders as a span
            expect(screen.getByText('Alojamiento')).toBeInTheDocument();
            // The badge is rendered (span element with the aria-label)
            expect(container.querySelector('[aria-label="Tipo: Alojamiento"]')).not.toBeNull();
        });

        it('does not render any badge when entity type is missing and no explicit badge is provided', () => {
            render(
                <ReviewCard
                    data={baseReview}
                    locale="es"
                />
            );
            expect(screen.queryByText('Alojamiento')).toBeNull();
            expect(screen.queryByText('Destino')).toBeNull();
        });
    });

    describe('CSS module migration', () => {
        // Reads the CSS file directly because jsdom does not execute CSS.
        const cssSrc = readFileSync(
            resolve(__dirname, '../../../../src/components/shared/cards/ReviewCard.module.css'),
            'utf8'
        );

        it('removes the legacy `.entityBadge` rule', () => {
            expect(cssSrc).not.toMatch(/\.entityBadge\s*\{/);
        });

        it('removes the legacy `.entityBadgeLink` rule', () => {
            expect(cssSrc).not.toMatch(/\.entityBadgeLink\s*\{/);
        });

        it('introduces the `.entityBadgeSlot` positioning rule', () => {
            expect(cssSrc).toMatch(/\.entityBadgeSlot\s*\{/);
            expect(cssSrc).toContain('position: absolute');
        });
    });
});
