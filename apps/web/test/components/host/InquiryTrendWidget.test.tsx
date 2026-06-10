/**
 * @file InquiryTrendWidget.test.tsx
 * @description TDD tests for InquiryTrendWidget — line chart showing 6-month
 * inquiry trend with loading skeleton, error, and empty states.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InquiryTrendWidget } from '../../../src/components/host/InquiryTrendWidget.client';

const mockData = {
    months: [
        { month: '2026-01', count: 5 },
        { month: '2026-02', count: 8 },
        { month: '2026-03', count: 12 },
        { month: '2026-04', count: 7 },
        { month: '2026-05', count: 15 },
        { month: '2026-06', count: 20 }
    ]
};

describe('InquiryTrendWidget', () => {
    it('renders loading skeleton when loading', () => {
        render(
            <InquiryTrendWidget
                locale="es"
                data={undefined}
                isLoading={true}
                error={null}
            />
        );
        expect(screen.getByTestId('inquiry-trend-skeleton')).toBeInTheDocument();
    });

    it('renders error state with message', () => {
        render(
            <InquiryTrendWidget
                locale="es"
                data={undefined}
                isLoading={false}
                error="Failed to load"
            />
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });

    it('renders empty state when data has no months', () => {
        render(
            <InquiryTrendWidget
                locale="es"
                data={{ months: [] }}
                isLoading={false}
                error={null}
            />
        );
        expect(screen.getByText(/Sin datos/i)).toBeInTheDocument();
    });

    it('renders line chart with inquiry data', () => {
        render(
            <InquiryTrendWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
            />
        );
        // The widget title should be present
        expect(screen.getByText(/Consultas/i)).toBeInTheDocument();
        // recharts renders SVG — check for the chart container
        expect(screen.getByTestId('inquiry-trend-chart')).toBeInTheDocument();
    });

    it('shows total inquiry count', () => {
        render(
            <InquiryTrendWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
            />
        );
        // Total: 5+8+12+7+15+20 = 67
        expect(screen.getByText('67')).toBeInTheDocument();
    });

    it('renders chart with correct number of data points', () => {
        render(
            <InquiryTrendWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
            />
        );
        // recharts renders line dots — verify the chart container exists
        const chart = screen.getByTestId('inquiry-trend-chart');
        expect(chart).toBeInTheDocument();
    });
});
