/**
 * @file TradeCard.categories.test.tsx
 * @description The directory card shows one badge per category, capped at 3 plus
 * «+N» (HOS-919 AC-5.1).
 */

import type { HostTradePublic } from '@repo/schemas';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TradeCard } from '../../../../src/components/host/host-trades/TradeCard';

const names = ['Plomería', 'Electricidad', 'Piletas', 'Pintura', 'Herrería'] as const;

const buildTrade = (count: number): HostTradePublic =>
    ({
        id: 'trade-1',
        slug: 'multi',
        name: 'Multi Servicios',
        categories: names.slice(0, count).map((es, i) => ({
            id: `cat-${i}`,
            slug: `cat-${i}`,
            nameI18n: { es, en: `${es} EN` },
            groupSlug: 'g'
        })),
        benefit: '10% de descuento',
        contact: '+54 9 3442 567890',
        is24h: false
    }) as unknown as HostTradePublic;

describe('TradeCard — category badges', () => {
    it('should render 3 badges plus «+2» when the provider has 5 categories', () => {
        render(
            <TradeCard
                locale="es"
                trade={buildTrade(5)}
            />
        );

        const list = screen.getByRole('list', { name: 'Rubros' });
        expect(within(list).getAllByRole('listitem')).toHaveLength(4);
        expect(within(list).getByText('Plomería')).toBeInTheDocument();
        expect(within(list).getByText('Piletas')).toBeInTheDocument();
        expect(within(list).queryByText('Pintura')).toBeNull();
        expect(within(list).getByText('+2')).toBeInTheDocument();
    });

    it('should render one badge and no «+N» for a single category', () => {
        render(
            <TradeCard
                locale="es"
                trade={buildTrade(1)}
            />
        );

        const list = screen.getByRole('list', { name: 'Rubros' });
        expect(within(list).getAllByRole('listitem')).toHaveLength(1);
        expect(screen.queryByText(/^\+\d/)).toBeNull();
    });

    it('should keep catalog order and the page locale label', () => {
        render(
            <TradeCard
                locale="en"
                trade={buildTrade(3)}
            />
        );

        const labels = within(screen.getByRole('list', { name: 'Categories' }))
            .getAllByRole('listitem')
            .map((li) => li.textContent);
        expect(labels).toEqual(['Plomería EN', 'Electricidad EN', 'Piletas EN']);
    });
});
