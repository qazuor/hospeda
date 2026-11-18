/**
 * @file TradeCategoryBadges.test.tsx
 * @description The shared category badge list used by the directory cards, the
 * usage cards, the edit form and the provider pages (HOS-919 AC-5.1).
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TradeCategoryBadges } from '../../../../src/components/host/host-trades/TradeCategoryBadges';

const ref = (slug: string, es: string, en?: string) => ({
    id: `id-${slug}`,
    slug,
    nameI18n: en === undefined ? { es } : { es, en },
    groupSlug: 'g'
});

const FIVE = [
    ref('a', 'Alfa'),
    ref('b', 'Beta'),
    ref('c', 'Gamma'),
    ref('d', 'Delta'),
    ref('e', 'Epsilon')
];

describe('TradeCategoryBadges', () => {
    it('should render 3 badges plus «+2» for 5 categories by default cap', () => {
        render(
            <TradeCategoryBadges
                categories={FIVE}
                locale="es"
                max={3}
            />
        );

        const list = screen.getByRole('list');
        expect(within(list).getAllByRole('listitem')).toHaveLength(4);
        expect(within(list).getByText('Alfa')).toBeInTheDocument();
        expect(within(list).getByText('Gamma')).toBeInTheDocument();
        expect(within(list).queryByText('Delta')).toBeNull();
        expect(within(list).getByText('+2')).toBeInTheDocument();
    });

    it('should render one badge and no «+N» for a single category', () => {
        render(
            <TradeCategoryBadges
                categories={FIVE.slice(0, 1)}
                locale="es"
                max={3}
            />
        );

        expect(screen.getAllByRole('listitem')).toHaveLength(1);
        expect(screen.queryByText(/^\+/)).toBeNull();
    });

    it('should render every category with no «+N» when uncapped (detail pages)', () => {
        render(
            <TradeCategoryBadges
                categories={FIVE}
                locale="es"
            />
        );

        expect(screen.getAllByRole('listitem')).toHaveLength(5);
        expect(screen.queryByText(/^\+/)).toBeNull();
    });

    it('should keep the order it was given', () => {
        render(
            <TradeCategoryBadges
                categories={[ref('z', 'Zeta'), ref('a', 'Alfa')]}
                locale="es"
            />
        );

        expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
            'Zeta',
            'Alfa'
        ]);
    });

    it('should label in the page locale and fall back to Spanish', () => {
        render(
            <TradeCategoryBadges
                categories={[ref('a', 'Alfa', 'Alpha'), ref('b', 'Beta')]}
                locale="en"
            />
        );

        expect(screen.getByText('Alpha')).toBeInTheDocument();
        expect(screen.getByText('Beta')).toBeInTheDocument();
    });

    it('should render nothing for a provider without categories', () => {
        const { container } = render(
            <TradeCategoryBadges
                categories={[]}
                locale="es"
            />
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('should give the overflow a spoken label, not just «+2»', () => {
        render(
            <TradeCategoryBadges
                categories={FIVE}
                locale="es"
                max={3}
            />
        );

        expect(screen.getByText('2 rubros más')).toBeInTheDocument();
    });
});
