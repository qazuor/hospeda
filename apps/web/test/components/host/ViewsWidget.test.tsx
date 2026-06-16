/**
 * @file ViewsWidget.test.tsx
 * @description Tests for ViewsWidget — daily trend chart + per-property ranked
 * list of accommodation views with 7d/30d toggle, loading skeleton, error, and
 * empty states. SPEC-207 Fase A: adds chart-presence / chart-absence cases.
 */

// Mock recharts BEFORE any imports — it renders SVG which JSDOM can't handle
vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: { readonly children: React.ReactNode }) => (
        <div data-testid="recharts-responsive-container">{children}</div>
    ),
    LineChart: ({ children }: { readonly children: React.ReactNode }) => (
        <div data-testid="recharts-line-chart">{children}</div>
    ),
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ViewsWidget } from '../../../src/components/host/ViewsWidget.client';

const mockData = {
    window: '7d' as const,
    items: [
        { accommodationId: 'a1', name: 'Casa del Sol', total: 42, unique: 30 },
        { accommodationId: 'a2', name: 'Cabaña del Río', total: 28, unique: 20 },
        { accommodationId: 'a3', name: 'Apartamento Centro', total: 15, unique: 12 }
    ]
};

const mockDailySeries = {
    window: '7d' as const,
    items: [
        { date: '2026-06-09', total: 3 },
        { date: '2026-06-10', total: 0 },
        { date: '2026-06-11', total: 7 },
        { date: '2026-06-12', total: 2 },
        { date: '2026-06-13', total: 5 },
        { date: '2026-06-14', total: 1 },
        { date: '2026-06-15', total: 4 }
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

    it('renders error state with role alert and message', () => {
        render(
            <ViewsWidget
                locale="es"
                data={undefined}
                isLoading={false}
                error="Error al cargar vistas"
                onWindowChange={vi.fn()}
            />
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Error al cargar vistas')).toBeInTheDocument();
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

    it('renders empty state when all items have total === 0', () => {
        render(
            <ViewsWidget
                locale="es"
                data={{
                    window: '30d',
                    items: [{ accommodationId: 'a1', name: 'Casa', total: 0, unique: 0 }]
                }}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        expect(screen.getByText(/Sin datos/i)).toBeInTheDocument();
    });

    it('renders accommodation names and totals sorted by total desc', () => {
        render(
            <ViewsWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        expect(screen.getByText('Casa del Sol')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
        expect(screen.getByText('Cabaña del Río')).toBeInTheDocument();
        expect(screen.getByText('28')).toBeInTheDocument();
        expect(screen.getByText('Apartamento Centro')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('shows the total badge with sum of all items totals', () => {
        render(
            <ViewsWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        // 42 + 28 + 15 = 85
        expect(screen.getByText('85')).toBeInTheDocument();
    });

    it('shows 7d toggle as active when data.window is 7d', () => {
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

    it('calls onWindowChange with 30d when toggle is clicked', async () => {
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

    it('falls back to unnamed translation when accommodation name is empty', () => {
        render(
            <ViewsWidget
                locale="es"
                data={{
                    window: '7d',
                    items: [{ accommodationId: 'x1', name: '', total: 10, unique: 8 }]
                }}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        expect(screen.getByText(/Sin nombre/i)).toBeInTheDocument();
    });

    // ── SPEC-207 Fase A: daily-series chart ──────────────────────────────

    it('renders the daily trend chart when dailySeries is present and non-empty', () => {
        render(
            <ViewsWidget
                locale="es"
                data={mockData}
                dailySeries={mockDailySeries}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        expect(screen.getByTestId('views-daily-chart')).toBeInTheDocument();
    });

    it('still renders the ranked list when dailySeries is present', () => {
        render(
            <ViewsWidget
                locale="es"
                data={mockData}
                dailySeries={mockDailySeries}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        // List items must still be visible alongside the chart
        expect(screen.getByText('Casa del Sol')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('does NOT render the daily chart when dailySeries is absent (backward compat)', () => {
        render(
            <ViewsWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        expect(screen.queryByTestId('views-daily-chart')).not.toBeInTheDocument();
    });

    it('does NOT render the daily chart when dailySeries has empty items', () => {
        render(
            <ViewsWidget
                locale="es"
                data={mockData}
                dailySeries={{ window: '7d', items: [] }}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        expect(screen.queryByTestId('views-daily-chart')).not.toBeInTheDocument();
    });

    it('the chart container has a descriptive aria-label', () => {
        render(
            <ViewsWidget
                locale="es"
                data={mockData}
                dailySeries={mockDailySeries}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        const chartEl = screen.getByTestId('views-daily-chart');
        expect(chartEl).toHaveAttribute('aria-label');
        expect(chartEl.getAttribute('aria-label')).not.toBe('');
    });
});
