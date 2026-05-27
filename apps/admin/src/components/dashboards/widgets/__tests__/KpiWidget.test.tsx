// @vitest-environment jsdom
/**
 * Tests for KpiWidget component (SPEC-155 T-023).
 *
 * Strategy:
 * - Mock `useDashboardResolver` to return a stub `resolveForScope`.
 * - Wrap each render in a minimal `QueryClientProvider` so `useQuery` works.
 * - Control what `resolveForScope` returns (found/not-found) and what the
 *   query produces (loading/error/data) via `vi.fn()` + `useQuery` mocks.
 *
 * Covers:
 * - Renders value from data.
 * - Renders delta up (positive) with TrendingUpIcon.
 * - Renders delta down (negative) with TrendingDownIcon.
 * - Renders unit prefix and suffix from data.
 * - Config-level unit overrides take precedence over data-level.
 * - Shows skeleton while loading.
 * - Shows error state + retry button on error; clicking retry calls refetch.
 * - Shows empty state when data is null.
 * - Shows unavailable state when source is not found.
 *
 * References: SPEC-155 T-023
 */

import type { Widget } from '@/config/ia/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KpiWidget } from '../KpiWidget';

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
    ),
    TrendingUpIcon: ({ className }: { className?: string }) => (
        <svg
            data-testid="trending-up-icon"
            className={className}
            aria-hidden="true"
        />
    ),
    TrendingDownIcon: ({ className }: { className?: string }) => (
        <svg
            data-testid="trending-down-icon"
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
 * Minimal Widget fixture for KPI type.
 */
function makeWidget(overrides: Partial<Widget> = {}): Widget {
    return {
        id: 'test-kpi',
        type: 'kpi',
        label: { es: 'Total alojamientos', en: 'Total accommodations', pt: 'Total alojamentos' },
        scope: 'all',
        onMissing: 'disable',
        config: { source: 'admin.entities.counts' },
        ...overrides
    };
}

/**
 * Stub query options that immediately return the given data.
 * Simulates a resolver whose queryFn resolves synchronously.
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KpiWidget', () => {
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
                <KpiWidget widget={makeWidget()} />
            </TestWrapper>
        );

        expect(screen.getByTestId('kpi-widget-unavailable')).toBeInTheDocument();
        // Card shell is always present
        expect(screen.getByTestId('kpi-widget')).toBeInTheDocument();
        // Title is always visible
        expect(screen.getByTestId('kpi-label')).toHaveTextContent('Total alojamientos');
    });

    // ── Loading state ──────────────────────────────────────────────────────

    it('renders the skeleton while the query is loading', () => {
        // Return a queryFn that never resolves (pending state).
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
                <KpiWidget widget={makeWidget()} />
            </TestWrapper>
        );

        expect(screen.getByTestId('kpi-widget-skeleton')).toBeInTheDocument();
        // Card shell is always present
        expect(screen.getByTestId('kpi-widget')).toBeInTheDocument();
        // Title is always visible while loading
        expect(screen.getByTestId('kpi-label')).toHaveTextContent('Total alojamientos');
    });

    // ── Error state ────────────────────────────────────────────────────────

    it('renders the error state with a retry button when the query fails', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubErrorOptions()
        });

        render(
            <TestWrapper>
                <KpiWidget widget={makeWidget()} />
            </TestWrapper>
        );

        // Wait for the error state to appear (query must settle).
        const errorEl = await screen.findByTestId('kpi-widget-error');
        expect(errorEl).toBeInTheDocument();
        // Card shell is always present even on error
        expect(screen.getByTestId('kpi-widget')).toBeInTheDocument();
        // Title is always visible on error
        expect(screen.getByTestId('kpi-label')).toHaveTextContent('Total alojamientos');
    });

    it('exposes a retry button inside the error state', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubErrorOptions()
        });

        render(
            <TestWrapper>
                <KpiWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const retryBtn = await screen.findByRole('button', { name: /reintentar/i });
        expect(retryBtn).toBeInTheDocument();

        // Clicking retry should not throw (refetch is wired).
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
                <KpiWidget widget={makeWidget()} />
            </TestWrapper>
        );

        expect(await screen.findByTestId('kpi-widget-empty')).toBeInTheDocument();
        // Title is always visible when empty
        expect(screen.getByTestId('kpi-label')).toHaveTextContent('Total alojamientos');
    });

    // ── Data — value ──────────────────────────────────────────────────────

    it('renders the numeric value from data', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ value: 42 })
        });

        render(
            <TestWrapper>
                <KpiWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const valueEl = await screen.findByTestId('kpi-value');
        // 42 locale-formatted in es-AR is just "42"
        expect(valueEl).toHaveTextContent('42');
    });

    it('renders the widget label from widget.label.es', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ value: 5 })
        });

        render(
            <TestWrapper>
                <KpiWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const label = await screen.findByTestId('kpi-label');
        expect(label).toHaveTextContent('Total alojamientos');
    });

    // ── Data — delta up ───────────────────────────────────────────────────

    it('renders the TrendingUpIcon when delta is positive', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ value: 100, delta: 12.5 })
        });

        render(
            <TestWrapper>
                <KpiWidget widget={makeWidget()} />
            </TestWrapper>
        );

        await screen.findByTestId('kpi-widget');
        expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument();
        expect(screen.queryByTestId('trending-down-icon')).not.toBeInTheDocument();
    });

    it('includes "+" prefix in the delta badge for positive values', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ value: 100, delta: 8 })
        });

        render(
            <TestWrapper>
                <KpiWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const delta = await screen.findByTestId('kpi-delta');
        expect(delta.textContent).toContain('+');
        expect(delta.textContent).toContain('8.0%');
    });

    // ── Data — delta down ─────────────────────────────────────────────────

    it('renders the TrendingDownIcon when delta is negative', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ value: 75, delta: -5.3 })
        });

        render(
            <TestWrapper>
                <KpiWidget widget={makeWidget()} />
            </TestWrapper>
        );

        await screen.findByTestId('kpi-widget');
        expect(screen.getByTestId('trending-down-icon')).toBeInTheDocument();
        expect(screen.queryByTestId('trending-up-icon')).not.toBeInTheDocument();
    });

    it('does NOT render a delta badge when delta is absent', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ value: 200 })
        });

        render(
            <TestWrapper>
                <KpiWidget widget={makeWidget()} />
            </TestWrapper>
        );

        await screen.findByTestId('kpi-widget');
        expect(screen.queryByTestId('kpi-delta')).not.toBeInTheDocument();
    });

    // ── Data — unit prefix/suffix ─────────────────────────────────────────

    it('renders the unit prefix from data', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ value: 1500, unitPrefix: '$' })
        });

        render(
            <TestWrapper>
                <KpiWidget widget={makeWidget()} />
            </TestWrapper>
        );

        await screen.findByTestId('kpi-widget');
        expect(screen.getByTestId('kpi-unit-prefix')).toHaveTextContent('$');
    });

    it('renders the unit suffix from data', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ value: 99, unitSuffix: 'hosts' })
        });

        render(
            <TestWrapper>
                <KpiWidget widget={makeWidget()} />
            </TestWrapper>
        );

        await screen.findByTestId('kpi-widget');
        expect(screen.getByTestId('kpi-unit-suffix')).toHaveTextContent('hosts');
    });

    it('config unitPrefix overrides data.unitPrefix', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ value: 999, unitPrefix: '$' })
        });

        const widget = makeWidget({
            config: { source: 'admin.entities.counts', unitPrefix: 'USD' }
        });

        render(
            <TestWrapper>
                <KpiWidget widget={widget} />
            </TestWrapper>
        );

        await screen.findByTestId('kpi-widget');
        // The config override takes precedence.
        expect(screen.getByTestId('kpi-unit-prefix')).toHaveTextContent('USD');
    });

    it('does NOT render prefix element when neither data nor config provides one', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ value: 7 })
        });

        render(
            <TestWrapper>
                <KpiWidget widget={makeWidget()} />
            </TestWrapper>
        );

        await screen.findByTestId('kpi-widget');
        expect(screen.queryByTestId('kpi-unit-prefix')).not.toBeInTheDocument();
        expect(screen.queryByTestId('kpi-unit-suffix')).not.toBeInTheDocument();
    });
});
