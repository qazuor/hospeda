// @vitest-environment jsdom
/**
 * Tests for ChartWidget component (SPEC-155 T-025).
 *
 * Strategy:
 * - Mock `useDashboardResolver` to return a stub `resolveForScope`.
 * - Wrap each render in a minimal `QueryClientProvider` so `useQuery` works.
 * - Control what `resolveForScope` returns (found/not-found) and what the
 *   query produces (loading/error/data) via `vi.fn()` + query options.
 * - Mock `recharts` ResponsiveContainer so it renders children synchronously
 *   without measuring DOM dimensions (jsdom has no layout engine). The rest
 *   of recharts is the real implementation rendered into the JSDOM SVG layer;
 *   we only assert on the high-level container test-ids, not on individual
 *   SVG paths, because Recharts does not render SVG elements synchronously
 *   in a headless environment without real dimensions.
 *
 * Covers:
 * - Renders the chart widget container with data (line/bar/area).
 * - Each chartType renders its specific container (chart-line/chart-bars/chart-area).
 * - Renders the label from `widget.label.es`.
 * - Renders the chart-type badge.
 * - Shows skeleton while loading.
 * - Shows error state + retry button on error; clicking retry does not throw.
 * - Shows empty state when data is null.
 * - Shows empty state when series array is empty.
 * - Shows unavailable state when source is not found.
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
// Recharts mock — ResponsiveContainer must render children in jsdom
// ---------------------------------------------------------------------------
// jsdom has no layout engine, so ResponsiveContainer never gets a measured
// width/height and renders nothing. We replace it with a pass-through div.
// All other recharts components (BarChart, LineChart, AreaChart, etc.) are
// the real implementations — they will render but jsdom SVG has no layout,
// so we only assert on our wrapper data-testid attributes, not SVG internals.
vi.mock('recharts', async (importActual) => {
    const actual = await importActual<typeof import('recharts')>();
    return {
        ...actual,
        ResponsiveContainer: ({
            children,
            ...props
        }: {
            children: ReactNode;
            [key: string]: unknown;
        }) => (
            <div
                data-testid="recharts-responsive-container"
                style={{ width: 300, height: 200 }}
                {...props}
            >
                {children}
            </div>
        )
    };
});

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
vi.mock('@repo/icons', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/icons')>()),
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
        // Card shell is always present
        expect(screen.getByTestId('chart-widget')).toBeInTheDocument();
        // Title is always visible
        expect(screen.getByTestId('chart-label')).toHaveTextContent('Nuevos usuarios');
        // Badge is always visible (even unavailable)
        expect(screen.getByTestId('chart-type-badge')).toBeInTheDocument();
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
        // Card shell is always present while loading
        expect(screen.getByTestId('chart-widget')).toBeInTheDocument();
        // Title is always visible while loading
        expect(screen.getByTestId('chart-label')).toHaveTextContent('Nuevos usuarios');
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
        // Card shell is always present on error
        expect(screen.getByTestId('chart-widget')).toBeInTheDocument();
        // Title is always visible on error
        expect(screen.getByTestId('chart-label')).toHaveTextContent('Nuevos usuarios');
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
        // Title is always visible when empty
        expect(screen.getByTestId('chart-label')).toHaveTextContent('Nuevos usuarios');
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
        // Title is always visible when empty
        expect(screen.getByTestId('chart-label')).toHaveTextContent('Nuevos usuarios');
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

    it('renders the bar chart container for chartType=bar', async () => {
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

    it('does not render the line or area container for chartType=bar', async () => {
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
        expect(screen.queryByTestId('chart-line')).not.toBeInTheDocument();
        expect(screen.queryByTestId('chart-area')).not.toBeInTheDocument();
    });

    // ── Line chart ─────────────────────────────────────────────────────────

    it('renders the line chart container for chartType=line', async () => {
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
    });

    it('does not render the bar or area container for chartType=line', async () => {
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
        expect(screen.queryByTestId('chart-bars')).not.toBeInTheDocument();
        expect(screen.queryByTestId('chart-area')).not.toBeInTheDocument();
    });

    // ── Area chart ─────────────────────────────────────────────────────────

    it('renders the area chart container for chartType=area', async () => {
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
    });

    it('does not render the bar or line container for chartType=area', async () => {
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
        expect(screen.queryByTestId('chart-bars')).not.toBeInTheDocument();
        expect(screen.queryByTestId('chart-line')).not.toBeInTheDocument();
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
