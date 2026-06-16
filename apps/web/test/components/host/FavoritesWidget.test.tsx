/**
 * @file FavoritesWidget.test.tsx
 * @description Tests for FavoritesWidget — per-accommodation ranked bar list
 * showing bookmark counts (SPEC-207 redesign from "collections" to real backend
 * shape: {accommodationId, name, bookmarkCount}[]).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FavoritesWidget } from '../../../src/components/host/FavoritesWidget.client';

const mockData = {
    items: [
        { accommodationId: 'acc-1', name: 'Casa del Río', bookmarkCount: 24 },
        { accommodationId: 'acc-2', name: 'Villa Paraíso', bookmarkCount: 12 },
        { accommodationId: 'acc-3', name: 'Loft Centro', bookmarkCount: 8 },
        { accommodationId: 'acc-4', name: 'Cabaña del Bosque', bookmarkCount: 3 }
    ]
};

describe('FavoritesWidget', () => {
    it('renders loading skeleton when loading', () => {
        render(
            <FavoritesWidget
                locale="es"
                data={undefined}
                isLoading={true}
                error={null}
            />
        );
        expect(screen.getByTestId('favorites-skeleton')).toBeInTheDocument();
    });

    it('renders error state with message', () => {
        render(
            <FavoritesWidget
                locale="es"
                data={undefined}
                isLoading={false}
                error="Network error"
            />
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('renders empty state when no items', () => {
        render(
            <FavoritesWidget
                locale="es"
                data={{ items: [] }}
                isLoading={false}
                error={null}
            />
        );
        expect(screen.getByText(/Sin favoritos/i)).toBeInTheDocument();
    });

    it('renders per-accommodation ranked list with names', () => {
        render(
            <FavoritesWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
            />
        );
        expect(screen.getByText('Casa del Río')).toBeInTheDocument();
        expect(screen.getByText('Villa Paraíso')).toBeInTheDocument();
        expect(screen.getByText('Loft Centro')).toBeInTheDocument();
        expect(screen.getByText('Cabaña del Bosque')).toBeInTheDocument();
    });

    it('displays correct bookmark count for each accommodation', () => {
        render(
            <FavoritesWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
            />
        );
        expect(screen.getByText('24')).toBeInTheDocument();
        expect(screen.getByText('12')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows total bookmark count in header', () => {
        render(
            <FavoritesWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
            />
        );
        // Total: 24+12+8+3 = 47
        expect(screen.getByText('47')).toBeInTheDocument();
    });

    it('falls back to slug as name when name resolves to slug (unnamed accommodation)', () => {
        render(
            <FavoritesWidget
                locale="es"
                data={{
                    items: [
                        {
                            accommodationId: 'acc-unknown',
                            name: 'casa-del-rio-slug',
                            bookmarkCount: 5
                        }
                    ]
                }}
                isLoading={false}
                error={null}
            />
        );
        expect(screen.getByText('casa-del-rio-slug')).toBeInTheDocument();
    });
});
