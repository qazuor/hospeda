// @vitest-environment jsdom
/**
 * Tests for StatusWidget component (SPEC-155 T-027).
 *
 * Strategy:
 * - Mock `useDashboardResolver` to return a stub `resolveForScope`.
 * - Wrap each render in a minimal `QueryClientProvider` so `useQuery` works.
 * - Control what `resolveForScope` returns (found/not-found) and what the
 *   query produces (loading/error/data) via `vi.fn()`.
 *
 * Covers:
 * - Renders status badge from data with the correct variant class.
 * - Each built-in variantMap case: success / warning / destructive.
 * - Neutral fallback when status is NOT in the variantMap.
 * - Neutral fallback when variantMap is absent.
 * - Capitalises status string as badge label when data.label is absent.
 * - Uses data.label when provided.
 * - Renders optional description when present.
 * - Does NOT render description element when absent.
 * - Shows skeleton while loading.
 * - Shows error state + retry button on error; clicking retry does not throw.
 * - Shows empty state when data is null.
 * - Shows unavailable state when source is not found.
 *
 * References: SPEC-155 T-027
 */

import type { Widget } from '@/config/ia/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusWidget } from '../StatusWidget';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the resolver context — each test configures resolveForScope via vi.fn().
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
 * Minimal Widget fixture for status type.
 */
function makeWidget(overrides: Partial<Widget> = {}): Widget {
    return {
        id: 'test-status',
        type: 'kpi', // WidgetTypeSchema does not include 'status'; 'kpi' is the closest valid type for test purposes
        label: { es: 'Estado del sistema', en: 'System status', pt: 'Estado do sistema' },
        scope: 'all',
        onMissing: 'disable',
        config: {
            source: 'admin.system.health',
            variantMap: {
                up: 'success',
                degraded: 'warning',
                down: 'destructive',
                active: 'success',
                expiring: 'warning',
                expired: 'destructive'
            }
        },
        ...overrides
    };
}

/**
 * Stub query options that immediately return the given data.
 */
function stubQueryOptions(data: unknown) {
    return {
        queryKey: ['dashboard', 'test-status', 'ADMIN', 'all'],
        queryFn: () => Promise.resolve(data),
        staleTime: 60_000
    };
}

/**
 * Stub query options whose queryFn always rejects.
 */
function stubErrorOptions() {
    return {
        queryKey: ['dashboard', 'error-status', 'ADMIN', 'all'],
        queryFn: () => Promise.reject(new Error('fetch failed')),
        staleTime: 60_000
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StatusWidget', () => {
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
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        expect(screen.getByTestId('status-widget-unavailable')).toBeInTheDocument();
        expect(screen.queryByTestId('status-widget')).not.toBeInTheDocument();
    });

    // ── Loading state ──────────────────────────────────────────────────────

    it('renders the skeleton while the query is loading', () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: {
                queryKey: ['dashboard', 'pending-status', 'ADMIN', 'all'],
                queryFn: () => new Promise(() => undefined), // never resolves
                staleTime: 60_000
            }
        });

        render(
            <TestWrapper>
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        expect(screen.getByTestId('status-widget-skeleton')).toBeInTheDocument();
        expect(screen.queryByTestId('status-widget')).not.toBeInTheDocument();
    });

    // ── Error state ────────────────────────────────────────────────────────

    it('renders the error state with a retry button when the query fails', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubErrorOptions()
        });

        render(
            <TestWrapper>
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const errorEl = await screen.findByTestId('status-widget-error');
        expect(errorEl).toBeInTheDocument();
        expect(screen.queryByTestId('status-widget')).not.toBeInTheDocument();
    });

    it('exposes a retry button inside the error state; clicking it does not throw', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubErrorOptions()
        });

        render(
            <TestWrapper>
                <StatusWidget widget={makeWidget()} />
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
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        expect(await screen.findByTestId('status-widget-empty')).toBeInTheDocument();
    });

    // ── Data — label ──────────────────────────────────────────────────────

    it('renders the widget label from widget.label.es', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ status: 'up' })
        });

        render(
            <TestWrapper>
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const label = await screen.findByTestId('status-label');
        expect(label).toHaveTextContent('Estado del sistema');
    });

    it('capitalises the status string as badge label when data.label is absent', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ status: 'up' })
        });

        render(
            <TestWrapper>
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const badge = await screen.findByTestId('status-badge');
        expect(badge).toHaveTextContent('Up');
    });

    it('uses data.label when provided', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ status: 'up', label: 'Operational' })
        });

        render(
            <TestWrapper>
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const badge = await screen.findByTestId('status-badge');
        expect(badge).toHaveTextContent('Operational');
    });

    // ── Data — description ────────────────────────────────────────────────

    it('renders the description when provided', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ status: 'up', description: 'Checked 2 min ago' })
        });

        render(
            <TestWrapper>
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const desc = await screen.findByTestId('status-description');
        expect(desc).toHaveTextContent('Checked 2 min ago');
    });

    it('does NOT render description element when absent', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ status: 'up' })
        });

        render(
            <TestWrapper>
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        await screen.findByTestId('status-widget');
        expect(screen.queryByTestId('status-description')).not.toBeInTheDocument();
    });

    // ── Data — variant mapping ────────────────────────────────────────────

    it('applies success variant when status maps to "success"', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ status: 'up' })
        });

        render(
            <TestWrapper>
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const badge = await screen.findByTestId('status-badge');
        expect(badge).toHaveAttribute('data-variant', 'success');
    });

    it('applies warning variant when status maps to "warning"', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ status: 'degraded' })
        });

        render(
            <TestWrapper>
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const badge = await screen.findByTestId('status-badge');
        expect(badge).toHaveAttribute('data-variant', 'warning');
    });

    it('applies destructive variant when status maps to "destructive"', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ status: 'down' })
        });

        render(
            <TestWrapper>
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const badge = await screen.findByTestId('status-badge');
        expect(badge).toHaveAttribute('data-variant', 'destructive');
    });

    it('applies success variant for subscription "active" status', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ status: 'active', label: 'Activa' })
        });

        render(
            <TestWrapper>
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const badge = await screen.findByTestId('status-badge');
        expect(badge).toHaveAttribute('data-variant', 'success');
        expect(badge).toHaveTextContent('Activa');
    });

    it('applies warning variant for subscription "expiring" status', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ status: 'expiring', label: 'Por vencer' })
        });

        render(
            <TestWrapper>
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const badge = await screen.findByTestId('status-badge');
        expect(badge).toHaveAttribute('data-variant', 'warning');
    });

    it('applies destructive variant for subscription "expired" status', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ status: 'expired', label: 'Vencida' })
        });

        render(
            <TestWrapper>
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const badge = await screen.findByTestId('status-badge');
        expect(badge).toHaveAttribute('data-variant', 'destructive');
    });

    it('falls back to neutral variant when status is NOT in the variantMap', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ status: 'unknown' })
        });

        render(
            <TestWrapper>
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const badge = await screen.findByTestId('status-badge');
        expect(badge).toHaveAttribute('data-variant', 'neutral');
    });

    it('falls back to neutral variant when config has no variantMap', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ status: 'active' })
        });

        const widget = makeWidget({
            config: { source: 'admin.system.health' } // no variantMap
        });

        render(
            <TestWrapper>
                <StatusWidget widget={widget} />
            </TestWrapper>
        );

        const badge = await screen.findByTestId('status-badge');
        expect(badge).toHaveAttribute('data-variant', 'neutral');
    });

    // ── Data — indicator dot ──────────────────────────────────────────────

    it('renders the indicator dot alongside the badge', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ status: 'up' })
        });

        render(
            <TestWrapper>
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        await screen.findByTestId('status-widget');
        expect(screen.getByTestId('status-indicator-dot')).toBeInTheDocument();
    });

    // ── Accessibility ─────────────────────────────────────────────────────

    it('applies an aria-label that includes the widget label and badge label', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions({ status: 'up', label: 'Healthy' })
        });

        render(
            <TestWrapper>
                <StatusWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const card = await screen.findByTestId('status-widget');
        expect(card).toHaveAttribute('aria-label', 'Estado del sistema: Healthy');
    });
});
