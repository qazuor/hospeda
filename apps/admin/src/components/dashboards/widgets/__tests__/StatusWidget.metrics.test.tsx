// @vitest-environment jsdom
/**
 * Regression tests for the StatusWidget "Errores" metric tile (HOS-1751).
 *
 * The API sends `errorRate` / `globalErrorRate` as a PERCENTAGE in [0, 100].
 * The widget must render it as-is instead of multiplying it by 100 again,
 * which produced values like "755,8%" for a real 7.558%.
 *
 * Reuses the scaffolding from `StatusWidget.test.tsx` in a separate file so
 * the existing suite stays untouched.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Widget } from '@/config/ia/schema';
import { StatusWidget } from '../StatusWidget';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockResolveForScope = vi.fn();

vi.mock('@/contexts/dashboard-resolver-context', () => ({
    useDashboardResolver: () => ({
        resolveForScope: mockResolveForScope,
        buildContextForScope: vi.fn(),
        role: 'ADMIN',
        isAuthenticated: true
    })
}));

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

function TestWrapper({ children }: { readonly children: ReactNode }) {
    const queryClient = makeQueryClient();
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function makeWidget(overrides: Partial<Widget> = {}): Widget {
    return {
        id: 'test-status',
        type: 'status',
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

function stubQueryOptions(data: unknown) {
    return {
        queryKey: ['dashboard', 'test-status', 'ADMIN', 'all'],
        queryFn: () => Promise.resolve(data),
        staleTime: 60_000
    };
}

/**
 * The metrics tile row only renders in grid mode, so `items` must be non-empty.
 */
function statusDataWithErrorRate(errorRate: number) {
    return {
        status: 'up',
        items: [{ key: 'api', label: 'API', status: 'up' }],
        metrics: { errorRate }
    };
}

/**
 * Renders the widget and returns the tile whose label is "Errores".
 */
async function renderErrorTile(errorRate: number): Promise<HTMLElement> {
    mockResolveForScope.mockReturnValue({
        found: true,
        options: stubQueryOptions(statusDataWithErrorRate(errorRate))
    });

    render(
        <TestWrapper>
            <StatusWidget widget={makeWidget()} />
        </TestWrapper>
    );

    const tiles = await screen.findAllByTestId('status-metric');
    const errorTile = tiles.find((tile) => within(tile).queryByText('Errores') !== null);
    if (!errorTile) {
        throw new Error('The "Errores" tile did not render');
    }
    return errorTile;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StatusWidget error-rate tile (HOS-1751)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        { errorRate: 7.558, expected: '7,6%' },
        { errorRate: 0, expected: '0,0%' },
        { errorRate: 100, expected: '100,0%' },
        { errorRate: 0.5, expected: '0,5%' }
    ])('TEST:1751:1 renders errorRate $errorRate as $expected without re-scaling', async ({
        errorRate,
        expected
    }) => {
        const tile = await renderErrorTile(errorRate);
        expect(tile).toHaveTextContent(expected);
    });

    it('TEST:1751:1 never renders the double-scaled 755% for a 7.558% rate', async () => {
        await renderErrorTile(7.558);
        expect(screen.getByTestId('status-widget')).not.toHaveTextContent('755');
    });
});
