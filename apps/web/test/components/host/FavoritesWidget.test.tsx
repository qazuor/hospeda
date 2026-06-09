/**
 * @file FavoritesWidget.test.tsx
 * @description TDD tests for FavoritesWidget — horizontal bar chart showing
 * favorites breakdown across collections.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FavoritesWidget } from '../../../src/components/host/FavoritesWidget.client';

const mockData = {
    collections: [
        { collection: 'Sin colección', count: 24 },
        { collection: 'Playa', count: 12 },
        { collection: 'Montaña', count: 8 },
        { collection: 'Favoritos VIP', count: 3 }
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

    it('renders empty state when no collections', () => {
        render(
            <FavoritesWidget
                locale="es"
                data={{ collections: [] }}
                isLoading={false}
                error={null}
            />
        );
        expect(screen.getByText(/Sin favoritos/i)).toBeInTheDocument();
    });

    it('renders collection breakdown with counts', () => {
        render(
            <FavoritesWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
            />
        );
        expect(screen.getByText('Sin colección')).toBeInTheDocument();
        expect(screen.getByText('Playa')).toBeInTheDocument();
        expect(screen.getByText('Montaña')).toBeInTheDocument();
        expect(screen.getByText('Favoritos VIP')).toBeInTheDocument();
    });

    it('displays correct count for each collection', () => {
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

    it('shows total favorites count', () => {
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
});
