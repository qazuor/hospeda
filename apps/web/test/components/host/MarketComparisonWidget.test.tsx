/**
 * @file MarketComparisonWidget.test.tsx
 * @description TDD tests for MarketComparisonWidget — table showing market
 * comparison data with rating/price badges vs destination average.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarketComparisonWidget } from '../../../src/components/host/MarketComparisonWidget.client';

const mockData = {
    items: [
        {
            accommodationId: 'acc-1',
            accommodationName: 'Casa del Río',
            accommodationType: 'HOUSE',
            destinationName: 'Concepción del Uruguay',
            yourRating: 4.5,
            yourReviews: 23,
            destinationAvgRating: 4.2,
            yourPrice: 8500,
            destinationAvgPrice: 7200
        },
        {
            accommodationId: 'acc-2',
            accommodationName: 'Departamento Centro',
            accommodationType: 'APARTMENT',
            destinationName: 'Concepción del Uruguay',
            yourRating: null,
            yourReviews: 0,
            destinationAvgRating: 4.2,
            yourPrice: null,
            destinationAvgPrice: 7200
        }
    ]
};

describe('MarketComparisonWidget', () => {
    it('renders loading skeleton when loading', () => {
        render(
            <MarketComparisonWidget
                locale="es"
                data={undefined}
                isLoading={true}
                error={null}
            />
        );
        expect(screen.getByTestId('market-comparison-skeleton')).toBeInTheDocument();
    });

    it('renders error state with message', () => {
        render(
            <MarketComparisonWidget
                locale="es"
                data={undefined}
                isLoading={false}
                error="Failed to load"
            />
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });

    it('renders empty state when data has no items', () => {
        render(
            <MarketComparisonWidget
                locale="es"
                data={{ items: [] }}
                isLoading={false}
                error={null}
            />
        );
        expect(screen.getByText(/Sin datos/i)).toBeInTheDocument();
    });

    it('renders table with market comparison data', () => {
        render(
            <MarketComparisonWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
            />
        );
        expect(screen.getByText(/Comparación de mercado/i)).toBeInTheDocument();
        // Should render accommodation names
        expect(screen.getByText('Casa del Río')).toBeInTheDocument();
        expect(screen.getByText('Departamento Centro')).toBeInTheDocument();
    });

    it('shows rating values for accommodations with ratings', () => {
        render(
            <MarketComparisonWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
            />
        );
        // Casa del Río has rating 4.5
        expect(screen.getByText('4.5')).toBeInTheDocument();
        // Destination avg rating 4.2 appears in both rows
        const ratings = screen.getAllByText('4.2');
        expect(ratings.length).toBe(2);
    });

    it('shows N/A for accommodations without rating or price', () => {
        render(
            <MarketComparisonWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
            />
        );
        // Departamento Centro has null rating and null price
        const naElements = screen.getAllByText('N/A');
        expect(naElements.length).toBeGreaterThanOrEqual(2);
    });

    it('renders table headers', () => {
        render(
            <MarketComparisonWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
            />
        );
        expect(screen.getByText('Alojamiento')).toBeInTheDocument();
        expect(screen.getByText('Tu rating')).toBeInTheDocument();
        expect(screen.getByText('Prom. destino')).toBeInTheDocument();
    });
});
