// @vitest-environment jsdom
/**
 * @file VenueCard.test.tsx
 * Unit tests for `VenueCard` (SPEC-239 T-059).
 *
 * Covers:
 *  - Renders the gastronomy name
 *  - Renders the type badge
 *  - Renders the price range badge when provided
 *  - Does NOT render price range badge when absent
 *  - Renders the formatted creation date when provided
 *  - Renders the ownerId when provided
 *  - Renders the publicationStatus
 *  - Has an accessible aria-label on the link
 *  - Calls onSelect when clicked
 */

import { PriceRangeEnum, PublicationStatusEnum, VenueTypeEnum } from '@repo/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { VenueListItem } from '@/features/venue/config/venue.config';
import { VenueCard } from '../components/VenueCard';

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

const BASE_VENUE: VenueListItem = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'La Parrilla del Sur',
    type: VenueTypeEnum.RESTAURANT,
    priceRange: PriceRangeEnum.MID,
    destinationId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    ownerId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    createdAt: new Date('2024-03-15T10:00:00.000Z'),
    featuredByEntitlement: false,
    publicationStatus: PublicationStatusEnum.PUBLISHED
};

function renderCard(overrides?: Partial<VenueListItem>, onSelect?: (id: string) => void) {
    const venue = { ...BASE_VENUE, ...overrides };
    render(
        <VenueCard
            venue={venue}
            onSelect={onSelect}
        />
    );
    return venue;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GastronomyCard — rendering', () => {
    it('should render "Destacado" badge when featuredByEntitlement is true', () => {
        renderCard({ featuredByEntitlement: true });
        expect(screen.getByText('Destacado')).toBeInTheDocument();
    });

    it('should NOT render "Destacado" when featuredByEntitlement is false', () => {
        renderCard({ featuredByEntitlement: false });
        expect(screen.queryByText('Destacado')).not.toBeInTheDocument();
    });

    it('should render the gastronomy name', () => {
        renderCard();
        expect(screen.getByText('La Parrilla del Sur')).toBeInTheDocument();
    });

    it('should render the type badge (Restaurante)', () => {
        renderCard({ type: VenueTypeEnum.RESTAURANT });
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

    it('should render the publicationStatus', () => {
        renderCard({ publicationStatus: PublicationStatusEnum.MODERATED });
        expect(screen.getByText(PublicationStatusEnum.MODERATED)).toBeInTheDocument();
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
    const CASES: Array<{ type: VenueTypeEnum; label: string }> = [
        { type: VenueTypeEnum.BAR, label: 'Bar' },
        { type: VenueTypeEnum.CAFE, label: 'Café' },
        { type: VenueTypeEnum.PARRILLA, label: 'Parrilla' },
        { type: VenueTypeEnum.CERVECERIA, label: 'Cervecería' },
        { type: VenueTypeEnum.HELADERIA, label: 'Heladería' },
        { type: VenueTypeEnum.FOOD_TRUCK, label: 'Food Truck' }
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
