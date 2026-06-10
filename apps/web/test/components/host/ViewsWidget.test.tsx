/**
 * @file ViewsWidget.test.tsx
 * @description TDD tests for ViewsWidget — bar chart showing accommodation views
 * with 7d/30d toggle, loading skeleton, and empty state.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ViewsWidget } from '../../../src/components/host/ViewsWidget.client';

const mockData = {
    window: '7d' as const,
    items: [
        { date: '2026-06-01', count: 12 },
        { date: '2026-06-02', count: 8 },
        { date: '2026-06-03', count: 15 },
        { date: '2026-06-04', count: 3 },
        { date: '2026-06-05', count: 20 },
        { date: '2026-06-06', count: 7 },
        { date: '2026-06-07', count: 11 }
    ]
};

describe('ViewsWidget', () => {
    it('renders loading skeleton when loading', () => {
        render(
            <ViewsWidget
                locale="es"
                data={undefined}
                isLoading={true}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        expect(screen.getByTestId('views-skeleton')).toBeInTheDocument();
    });

    it('renders error state with message', () => {
        render(
            <ViewsWidget
                locale="es"
                data={undefined}
                isLoading={false}
                error="Failed to load"
                onWindowChange={vi.fn()}
            />
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });

    it('renders empty state when data has no items', () => {
        render(
            <ViewsWidget
                locale="es"
                data={{ window: '7d', items: [] }}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        expect(screen.getByText(/Sin datos/i)).toBeInTheDocument();
    });

    it('renders bar chart with view data', () => {
        render(
            <ViewsWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        // The widget title should be present
        expect(screen.getByText(/Vistas/i)).toBeInTheDocument();
        // recharts renders SVG bars — check for the chart container
        expect(screen.getByTestId('views-chart')).toBeInTheDocument();
    });

    it('shows 7d toggle as active by default', () => {
        render(
            <ViewsWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        const btn7d = screen.getByRole('button', { name: /7d/i });
        expect(btn7d).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onWindowChange when toggle is clicked', async () => {
        const user = userEvent.setup();
        const onWindowChange = vi.fn();
        render(
            <ViewsWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
                onWindowChange={onWindowChange}
            />
        );
        const btn30d = screen.getByRole('button', { name: /30d/i });
        await user.click(btn30d);
        expect(onWindowChange).toHaveBeenCalledWith('30d');
    });

    it('shows total views count', () => {
        render(
            <ViewsWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        // Total: 12+8+15+3+20+7+11 = 76
        expect(screen.getByText('76')).toBeInTheDocument();
    });
});
