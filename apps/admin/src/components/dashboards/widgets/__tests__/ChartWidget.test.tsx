// @vitest-environment jsdom
/**
 * Tests for ChartWidget component (SPEC-155 T-025).
 *
 * Strategy:
 * - Mock `useDashboardResolver` to return a stub `resolveForScope`.
 * - Wrap each render in a minimal `QueryClientProvider` so `useQuery` works.
 * - Control what `resolveForScope` returns (found/not-found) and what the
 *   query produces (loading/error/data) via `vi.fn()` + query options.
 *
 * Covers:
 * - Renders the chart widget container with data (line/bar/area).
 * - Each chartType renders its specific DOM element.
 * - Renders the label from `widget.label.es`.
 * - Renders the chart-type badge.
 * - Shows skeleton while loading.
 * - Shows error state + retry button on error; clicking retry does not throw.
 * - Shows empty state when data is null.
 * - Shows empty state when series array is empty.
 * - Shows unavailable state when source is not found.
 * - Renders bar elements for each data point (bar chartType).
 * - Renders SVG dots for each data point (line and area chartTypes).
 *
 * References: SPEC-155 T-025
 */

import type { Widget } from '@/config/ia/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartWidget } from '../ChartWidget';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the resolver context — each test configures resolveForScope via the vi.fn() below.
const mockResolveForScope = vi.fn();

vi.mock('@/contexts/dashboard-resolver-context', () => ({
    useDashboardResolver: () => ({
        resolveForScope: mockResolveForScope,
        buildContextForScope: vi.fn(),
        role: 'ADMIN',
        isAuthenticated: true
    })
}));

// Mock icons so tests don't depend on Phosphor bundle.
vi.mock('@repo/icons', () => ({
    AlertTriangleIcon: ({ className }: { className?: string }) => (
        <svg
            data-testid="alert-triangle-icon"
            className={className}
            aria-hidden="true"
        />
    )
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a fresh QueryClient for each test to prevent cross-test cache bleed.
 */
function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                // Disable background refetching so tests stay deterministic.
                refetchOnWindowFocus: false,
                refetchOnMount: false
            }
        }
    });
}

/**
 * Wraps children in a fresh QueryClientProvider.
 */
function TestWrapper({ children }: { readonly children: ReactNode }) {
    const queryClient = makeQueryClient();
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/**
 * Minimal Widget fixture for chart type.
 */
function makeWidget(overrides: Partial<Widget> = {}): Widget {
    return {
        id: 'test-chart',
        type: 'chart',
        label: { es: 'Nuevos usuarios', en: 'New users', pt: 'Novos usuários' },
        scope: 'all',
        onMissing: 'disable',
        config: { source: 'admin.users.newUsersTrend', chartType: 'bar' },
        ...overrides
    };
}

/**
 * Stub query options that immediately return the given data.
 */
function stubQueryOptions(data: unknown) {
    return {
        queryKey: ['dashboard', 'test', 'ADMIN', 'all'],
        queryFn: () => Promise.resolve(data),
        staleTime: 60_000
    };
}

/**
 * Stub query options whose queryFn always rejects.
 */
function stubErrorOptions() {
    return {
        queryKey: ['dashboard', 'error', 'ADMIN', 'all'],
        queryFn: () => Promise.reject(new Error('fetch failed')),
        staleTime: 60_000
    };
}

/**
 * A reusable chart data fixture with three data points.
 */
const CHART_DATA = {
    series: [
        { label: 'Ene', value: 10 },
        { label: 'Feb', value: 25 },
        { label: 'Mar', value: 18 }
    ]
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChartWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Unavailable state ──────────────────────────────────────────────────

    it('renders the unavailable state when source is not registered', () => {
        mockResolveForScope.mockReturnValue({
            found: false,
            options: {
                queryKey: ['dashboard', '__noop__', 'test'],
                queryFn: () => Promise.resolve(null),
                staleTime: Number.POSITIVE_INFINITY,
                enabled: false
            }
        });

        render(
            <TestWrapper>
                <ChartWidget widget={makeWidget()} />
            </TestWrapper>
        );

        expect(screen.getByTestId('chart-widget-unavailable')).toBeInTheDocument();
        expect(screen.queryByTestId('chart-widget')).not.toBeInTheDocument();
    });

    // ── Loading state ──────────────────────────────────────────────────────

    it('renders the skeleton while the query is loading', () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: {
                queryKey: ['dashboard', 'pending', 'ADMIN', 'all'],
                queryFn: () => new Promise(() => undefined), // never resolves
                staleTime: 60_000
            }
        });

        render(
            <TestWrapper>
                <ChartWidget widget={makeWidget()} />
            </TestWrapper>
        );

        expect(screen.getByTestId('chart-widget-skeleton')).toBeInTheDocument();
        expect(screen.queryByTestId('chart-widget')).not.toBeInTheDocument();
    });

    // ── Error state ────────────────────────────────────────────────────────

    it('renders the error state when the query fails', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubErrorOptions()
        });

        render(
            <TestWrapper>
                <ChartWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const errorEl = await screen.findByTestId('chart-widget-error');
        expect(errorEl).toBeInTheDocument();
        expect(screen.queryByTestId('chart-widget')).not.toBeInTheDocument();
    });

    it('exposes a retry button inside the error state that does not throw on click', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubErrorOptions()
        });

        render(
            <TestWrapper>
                <ChartWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const retryBtn = await screen.findByRole('button', { name: /reintentar/i });
        expect(retryBtn).toBeInTheDocument();
        expect(() => fireEvent.click(retryBtn)).not.toThrow();
    });

    // ── Empty state ────────────────────────────────────────────────────────

    it('renders the empty state when data is null', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(null)
        });

        render(
            <TestWrapper>
                <ChartWidget widget={makeWidget()} />
            </TestWrapper>
        );

        expect(await screen.findByTestId('chart-widget-empty')).toBeInTheDocument();
    });

    it('renders the empty state when series array is empty', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ series: [] })
        });

        render(
            <TestWrapper>
                <ChartWidget widget={makeWidget()} />
            </TestWrapper>
        );

        expect(await screen.findByTestId('chart-widget-empty')).toBeInTheDocument();
    });

    // ── Data — shared content ─────────────────────────────────────────────

    it('renders the widget label from widget.label.es', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(CHART_DATA)
        });

        render(
            <TestWrapper>
                <ChartWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const label = await screen.findByTestId('chart-label');
        expect(label).toHaveTextContent('Nuevos usuarios');
    });

    it('renders the chart-type badge matching widget.config.chartType', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(CHART_DATA)
        });

        render(
            <TestWrapper>
                <ChartWidget
                    widget={makeWidget({ config: { source: 'test', chartType: 'bar' } })}
                />
            </TestWrapper>
        );

        const badge = await screen.findByTestId('chart-type-badge');
        expect(badge).toHaveTextContent('bar');
    });

    it('renders the chart widget container when data is present', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(CHART_DATA)
        });

        render(
            <TestWrapper>
                <ChartWidget widget={makeWidget()} />
            </TestWrapper>
        );

        expect(await screen.findByTestId('chart-widget')).toBeInTheDocument();
    });

    // ── Bar chart ──────────────────────────────────────────────────────────

    it('renders bars container for chartType=bar', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(CHART_DATA)
        });

        render(
            <TestWrapper>
                <ChartWidget
                    widget={makeWidget({ config: { source: 'test', chartType: 'bar' } })}
                />
            </TestWrapper>
        );

        await screen.findByTestId('chart-widget');
        expect(screen.getByTestId('chart-bars')).toBeInTheDocument();
    });

    it('renders one bar element per data point for chartType=bar', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(CHART_DATA)
        });

        render(
            <TestWrapper>
                <ChartWidget
                    widget={makeWidget({ config: { source: 'test', chartType: 'bar' } })}
                />
            </TestWrapper>
        );

        await screen.findByTestId('chart-widget');

        // Each bar has a data-testid of bar-<label>.
        for (const { label } of CHART_DATA.series) {
            expect(screen.getByTestId(`bar-${label}`)).toBeInTheDocument();
        }
    });

    // ── Line chart ─────────────────────────────────────────────────────────

    it('renders SVG line element for chartType=line', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(CHART_DATA)
        });

        render(
            <TestWrapper>
                <ChartWidget
                    widget={makeWidget({ config: { source: 'test', chartType: 'line' } })}
                />
            </TestWrapper>
        );

        await screen.findByTestId('chart-widget');
        expect(screen.getByTestId('chart-line')).toBeInTheDocument();
        expect(screen.getByTestId('line-path')).toBeInTheDocument();
        // Area fill must NOT be present for line type.
        expect(screen.queryByTestId('area-fill')).not.toBeInTheDocument();
    });

    it('renders one SVG dot per data point for chartType=line', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(CHART_DATA)
        });

        render(
            <TestWrapper>
                <ChartWidget
                    widget={makeWidget({ config: { source: 'test', chartType: 'line' } })}
                />
            </TestWrapper>
        );

        await screen.findByTestId('chart-widget');

        for (const { label } of CHART_DATA.series) {
            expect(screen.getByTestId(`chart-dot-${label}`)).toBeInTheDocument();
        }
    });

    // ── Area chart ─────────────────────────────────────────────────────────

    it('renders SVG area element for chartType=area', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(CHART_DATA)
        });

        render(
            <TestWrapper>
                <ChartWidget
                    widget={makeWidget({ config: { source: 'test', chartType: 'area' } })}
                />
            </TestWrapper>
        );

        await screen.findByTestId('chart-widget');
        expect(screen.getByTestId('chart-area')).toBeInTheDocument();
        expect(screen.getByTestId('area-fill')).toBeInTheDocument();
        expect(screen.getByTestId('line-path')).toBeInTheDocument();
    });

    it('renders one SVG dot per data point for chartType=area', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(CHART_DATA)
        });

        render(
            <TestWrapper>
                <ChartWidget
                    widget={makeWidget({ config: { source: 'test', chartType: 'area' } })}
                />
            </TestWrapper>
        );

        await screen.findByTestId('chart-widget');

        for (const { label } of CHART_DATA.series) {
            expect(screen.getByTestId(`chart-dot-${label}`)).toBeInTheDocument();
        }
    });

    // ── Default chartType fallback ─────────────────────────────────────────

    it('defaults to bar chart when chartType is omitted from config', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(CHART_DATA)
        });

        render(
            <TestWrapper>
                <ChartWidget
                    widget={makeWidget({ config: { source: 'admin.users.newUsersTrend' } })}
                />
            </TestWrapper>
        );

        await screen.findByTestId('chart-widget');
        expect(screen.getByTestId('chart-bars')).toBeInTheDocument();
    });
});
