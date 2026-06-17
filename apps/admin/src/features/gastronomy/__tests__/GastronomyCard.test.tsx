// @vitest-environment jsdom
/**
 * @file GastronomyCard.test.tsx
 * Unit tests for `GastronomyCard` (SPEC-239 T-059).
 *
 * Covers:
 *  - Renders the gastronomy name
 *  - Renders the type badge
 *  - Renders the price range badge when provided
 *  - Does NOT render price range badge when absent
 *  - Renders "Destacado" badge when isFeatured is true
 *  - Does NOT render "Destacado" when isFeatured is false
 *  - Renders the formatted creation date when provided
 *  - Renders the ownerId when provided
 *  - Renders the lifecycleStatus when provided
 *  - Has an accessible aria-label on the link
 *  - Calls onSelect when clicked
 */

import type { GastronomyListItem } from '@/features/gastronomy/config/gastronomy.config';
import { GastronomyTypeEnum, PriceRangeEnum } from '@repo/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GastronomyCard } from '../components/GastronomyCard';

// ---------------------------------------------------------------------------
// Mocks / router setup
// ---------------------------------------------------------------------------

// TanStack Router requires a RouterProvider to resolve <Link>.
// We create a minimal in-memory router that renders children without routing.
vi.mock('@tanstack/react-router', async (importOriginal) => {
    const original = await importOriginal<typeof import('@tanstack/react-router')>();
    return {
        ...original,
        Link: ({
            children,
            onClick,
            'aria-label': ariaLabel
        }: {
            children: React.ReactNode;
            onClick?: () => void;
            'aria-label'?: string;
        }) => React.createElement('a', { href: '#', onClick, 'aria-label': ariaLabel }, children)
    };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_GASTRONOMY: GastronomyListItem = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'La Parrilla del Sur',
    type: GastronomyTypeEnum.RESTAURANT,
    priceRange: PriceRangeEnum.MID,
    destinationId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    isFeatured: false,
    ownerId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    createdAt: new Date('2024-03-15T10:00:00.000Z'),
    lifecycleStatus: 'ACTIVE'
};

function renderCard(overrides?: Partial<GastronomyListItem>, onSelect?: (id: string) => void) {
    const gastronomy = { ...BASE_GASTRONOMY, ...overrides };
    render(
        <GastronomyCard
            gastronomy={gastronomy}
            onSelect={onSelect}
        />
    );
    return gastronomy;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GastronomyCard — rendering', () => {
    it('should render the gastronomy name', () => {
        renderCard();
        expect(screen.getByText('La Parrilla del Sur')).toBeInTheDocument();
    });

    it('should render the type badge (Restaurante)', () => {
        renderCard({ type: GastronomyTypeEnum.RESTAURANT });
        expect(screen.getByText('Restaurante')).toBeInTheDocument();
    });

    it('should render the price range badge when provided', () => {
        renderCard({ priceRange: PriceRangeEnum.MID });
        expect(screen.getByText('$$')).toBeInTheDocument();
    });

    it('should NOT render price range badge when priceRange is null/undefined', () => {
        renderCard({ priceRange: undefined });
        expect(screen.queryByText('$$')).not.toBeInTheDocument();
    });

    it('should render "Destacado" badge when isFeatured is true', () => {
        renderCard({ isFeatured: true });
        expect(screen.getByText('Destacado')).toBeInTheDocument();
    });

    it('should NOT render "Destacado" when isFeatured is false', () => {
        renderCard({ isFeatured: false });
        expect(screen.queryByText('Destacado')).not.toBeInTheDocument();
    });

    it('should render the lifecycleStatus', () => {
        renderCard({ lifecycleStatus: 'ACTIVE' });
        expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    });

    it('should render the ownerId', () => {
        renderCard({ ownerId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' });
        expect(screen.getByText('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')).toBeInTheDocument();
    });

    it('should render a formatted creation date', () => {
        renderCard({ createdAt: new Date('2024-03-15T10:00:00.000Z') });
        // Date is formatted as es-AR locale; just assert the year is present
        expect(screen.getByText(/2024/)).toBeInTheDocument();
    });

    it('should NOT render date section when createdAt is null/undefined', () => {
        renderCard({ createdAt: undefined });
        expect(screen.queryByText('Creado:')).not.toBeInTheDocument();
    });

    it('should have a correct aria-label on the link', () => {
        renderCard();
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('aria-label', 'Ver gastronomía: La Parrilla del Sur');
    });
});

describe('GastronomyCard — type badge labels', () => {
    const CASES: Array<{ type: GastronomyTypeEnum; label: string }> = [
        { type: GastronomyTypeEnum.BAR, label: 'Bar' },
        { type: GastronomyTypeEnum.CAFE, label: 'Café' },
        { type: GastronomyTypeEnum.PARRILLA, label: 'Parrilla' },
        { type: GastronomyTypeEnum.CERVECERIA, label: 'Cervecería' },
        { type: GastronomyTypeEnum.HELADERIA, label: 'Heladería' },
        { type: GastronomyTypeEnum.FOOD_TRUCK, label: 'Food Truck' }
    ];

    for (const { type, label } of CASES) {
        it(`should label type ${type} as "${label}"`, () => {
            renderCard({ type });
            expect(screen.getByText(label)).toBeInTheDocument();
        });
    }
});

describe('GastronomyCard — interaction', () => {
    it('should call onSelect with the gastronomy ID when clicked', () => {
        const onSelect = vi.fn();
        renderCard({}, onSelect);

        fireEvent.click(screen.getByRole('link'));

        expect(onSelect).toHaveBeenCalledWith('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    });

    it('should NOT throw when onSelect is not provided', () => {
        renderCard();
        expect(() => fireEvent.click(screen.getByRole('link'))).not.toThrow();
    });
});
