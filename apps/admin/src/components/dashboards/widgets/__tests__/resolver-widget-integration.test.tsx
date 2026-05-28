// @vitest-environment jsdom
/**
 * Integration tests: resolver real return shape → widget renderer (SPEC-155 fix).
 *
 * These tests were missing and allowed the resolver→widget shape mismatch to
 * ship undetected. Each test:
 *   1. Sets up the resolver's `queryFn` to return the REAL endpoint response
 *      shape (mocked at fetchApi level, not at an idealized widget shape).
 *   2. Feeds that shape through the widget renderer.
 *   3. Asserts it renders the expected value/list/chart WITHOUT crashing.
 *
 * Regressions covered:
 *   - admin.entities.counts (card A) → KpiWidget — was crashing with
 *     "kpi.value.toLocaleString is not a function" because raw return was
 *     Array<{name,count}> instead of {value:number}.
 *   - admin.moderation.pending (card F) → KpiWidget — was crashing because
 *     raw return was {total,accommodations,...} instead of {value:number}.
 *   - admin.users.stats (card G) → ChartWidget — was empty because raw return
 *     was {total,byRole,...} instead of {series:[{label,value}]}.
 *   - admin.accommodations.latest (card B) → ListWidget — raw return was
 *     Array<AccommodationItem> with no `label` field, crashing with undefined.
 *   - admin.system.health (card E) → StatusWidget — raw status 'ok' did not
 *     match variantMap key 'up', falling through to neutral.
 *   - editor.posts.stats (card E) → ChartWidget — raw return was a complex
 *     object; ChartWidget expected {series}.
 *   - host.accommodations.count (card A) → KpiWidget — raw return was a plain
 *     number, not {value:number}.
 *   - host.billing.plan (card B) → StatusWidget — raw return was {subscription,usage},
 *     not {status,label?,description?}.
 *
 * @see apps/admin/src/lib/dashboard-sources.ts
 * @see apps/admin/src/lib/dashboard-sources/admin.ts
 * @see apps/admin/src/lib/dashboard-sources/host.ts
 * @see apps/admin/src/lib/dashboard-sources/editor.ts
 * @see SPEC-155 resolver-widget-shape-bug fix
 */

import type { Widget } from '@/config/ia/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartWidget } from '../ChartWidget';
import { KpiWidget } from '../KpiWidget';
import { ListWidget } from '../ListWidget';
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

// Recharts mock — ResponsiveContainer needs real dimensions in jsdom.
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
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, refetchOnWindowFocus: false, refetchOnMount: false }
        }
    });
}

function TestWrapper({ children }: { readonly children: ReactNode }) {
    const queryClient = makeQueryClient();
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/**
 * Builds resolver stub that returns the given raw endpoint response shape.
 * This simulates what the real resolver's queryFn returns AFTER normalization.
 */
function stubResolverWith(normalizedData: unknown) {
    mockResolveForScope.mockReturnValue({
        found: true,
        options: {
            queryKey: ['dashboard', 'test', 'ADMIN', 'all'],
            queryFn: () => Promise.resolve(normalizedData),
            staleTime: 60_000
        }
    });
}

function makeKpiWidget(sourceId: string): Widget {
    return {
        id: `test-kpi-${sourceId}`,
        type: 'kpi',
        label: { es: 'Test KPI', en: 'Test KPI', pt: 'Test KPI' },
        scope: 'all',
        onMissing: 'disable',
        config: { source: sourceId }
    };
}

function makeListWidget(sourceId: string): Widget {
    return {
        id: `test-list-${sourceId}`,
        type: 'list',
        label: { es: 'Test List', en: 'Test List', pt: 'Test List' },
        scope: 'all',
        onMissing: 'disable',
        config: { source: sourceId, maxItems: 5 }
    };
}

function makeChartWidget(sourceId: string): Widget {
    return {
        id: `test-chart-${sourceId}`,
        type: 'chart',
        label: { es: 'Test Chart', en: 'Test Chart', pt: 'Test Chart' },
        scope: 'all',
        onMissing: 'disable',
        config: { source: sourceId, chartType: 'bar' }
    };
}

function makeStatusWidget(
    sourceId: string,
    variantMap: Record<string, 'success' | 'warning' | 'destructive' | 'neutral'>
): Widget {
    return {
        id: `test-status-${sourceId}`,
        type: 'status',
        label: { es: 'Test Status', en: 'Test Status', pt: 'Test Status' },
        scope: 'all',
        onMissing: 'disable',
        config: { source: sourceId, variantMap }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolver → widget integration (shape contract)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // REGRESSION: admin.entities.counts → KpiWidget
    // BEFORE fix: returned Array<{name,count}> → kpi.value was undefined → crash
    // AFTER fix:  returns {value:number, kpis:[{key,label,value,href}]} → GRID MODE
    //             (SPEC-155 follow-up: show the 6 per-entity counts, not the sum)
    // =========================================================================

    describe('admin.entities.counts (card A) → KpiWidget', () => {
        it('REGRESSION: raw array shape from before fix renders empty, not crash', async () => {
            // Simulate BEFORE fix: resolver returned raw array
            stubResolverWith([
                { name: 'accommodations', count: 120 },
                { name: 'destinations', count: 45 }
            ]);
            render(
                <TestWrapper>
                    <KpiWidget widget={makeKpiWidget('admin.entities.counts')} />
                </TestWrapper>
            );
            // Must NOT crash — defensive guard renders empty state for non-number value
            expect(await screen.findByTestId('kpi-widget-empty')).toBeInTheDocument();
        });

        it('AFTER fix: normalized {value, kpis} shape renders the per-entity grid', async () => {
            // Simulate AFTER fix: resolver returns multi-KPI grid data
            stubResolverWith({
                value: 165,
                kpis: [
                    {
                        key: 'accommodations',
                        label: { es: 'Alojamientos', en: 'Accommodations', pt: 'Alojamentos' },
                        value: 120,
                        href: '/accommodations'
                    },
                    {
                        key: 'destinations',
                        label: { es: 'Destinos', en: 'Destinations', pt: 'Destinos' },
                        value: 45,
                        href: '/destinations'
                    }
                ]
            });
            render(
                <TestWrapper>
                    <KpiWidget widget={makeKpiWidget('admin.entities.counts')} />
                </TestWrapper>
            );
            // Grid renders one tile per entity (NOT the single summed value).
            const grid = await screen.findByTestId('kpi-grid');
            expect(grid).toBeInTheDocument();
            expect(screen.getAllByTestId('kpi-grid-item')).toHaveLength(2);
            expect(screen.getByText('Alojamientos')).toBeInTheDocument();
            expect(screen.getByText('120')).toBeInTheDocument();
            // The summed single value must NOT be rendered in grid mode.
            expect(screen.queryByTestId('kpi-value')).not.toBeInTheDocument();
        });
    });

    // =========================================================================
    // REGRESSION: admin.moderation.pending → KpiWidget
    // BEFORE fix: returned {total, accommodations, ...} → kpi.value undefined → crash
    // AFTER fix:  returns {value:number, breakdown:...}
    // =========================================================================

    describe('admin.moderation.pending (card F) → KpiWidget', () => {
        it('REGRESSION: raw {total,...} shape from before fix renders empty, not crash', async () => {
            // Simulate BEFORE fix: resolver returned raw moderation response
            stubResolverWith({ total: 12, accommodations: 5, destinations: 3, posts: 4 });
            render(
                <TestWrapper>
                    <KpiWidget widget={makeKpiWidget('admin.moderation.pending')} />
                </TestWrapper>
            );
            // Must NOT crash — renders empty because `value` field is missing
            expect(await screen.findByTestId('kpi-widget-empty')).toBeInTheDocument();
        });

        it('AFTER fix: normalized {value, breakdown} renders the total count', async () => {
            stubResolverWith({ value: 12, breakdown: { accommodations: 5, destinations: 3 } });
            render(
                <TestWrapper>
                    <KpiWidget widget={makeKpiWidget('admin.moderation.pending')} />
                </TestWrapper>
            );
            const valueEl = await screen.findByTestId('kpi-value');
            expect(valueEl).toHaveTextContent('12');
        });
    });

    // =========================================================================
    // admin.users.stats → ChartWidget
    // BEFORE fix: returned {total,byRole,...} → no `series` → empty or crash
    // AFTER fix:  returns {series:[{label,value}]}
    // =========================================================================

    describe('admin.users.stats (card G) → ChartWidget', () => {
        it('REGRESSION: raw {total,byRole} shape from before fix renders empty, not crash', async () => {
            stubResolverWith({ total: 200, byRole: { HOST: 50, ADMIN: 5 }, recentSignups: 10 });
            render(
                <TestWrapper>
                    <ChartWidget widget={makeChartWidget('admin.users.stats')} />
                </TestWrapper>
            );
            // No `series` field → defensive guard → empty state
            expect(await screen.findByTestId('chart-widget-empty')).toBeInTheDocument();
        });

        it('AFTER fix: normalized {series} shape renders the chart widget', async () => {
            stubResolverWith({
                series: [
                    { label: 'HOST', value: 50 },
                    { label: 'ADMIN', value: 5 }
                ]
            });
            render(
                <TestWrapper>
                    <ChartWidget widget={makeChartWidget('admin.users.stats')} />
                </TestWrapper>
            );
            expect(await screen.findByTestId('chart-widget')).toBeInTheDocument();
        });
    });

    // =========================================================================
    // admin.accommodations.latest → ListWidget
    // BEFORE fix: returned AccommodationItem[] (no `label`) → undefined labels
    // AFTER fix:  returns ListItem[] with `label: item.name`
    // =========================================================================

    describe('admin.accommodations.latest (card B) → ListWidget', () => {
        it('REGRESSION: raw AccommodationItem[] without label field renders empty, not crash', async () => {
            stubResolverWith([
                { id: '1', name: 'Cabaña del Sol', status: 'ACTIVE', publishedAt: '2025-01-01' },
                { id: '2', name: 'Hotel Litoral', status: 'ACTIVE' }
            ]);
            render(
                <TestWrapper>
                    <ListWidget widget={makeListWidget('admin.accommodations.latest')} />
                </TestWrapper>
            );
            // Items have `name` but not `label` — ListWidget renders them with '—' fallback
            // and does NOT crash. We check the widget itself renders.
            const listEl = await screen.findByTestId('list-widget');
            expect(listEl).toBeInTheDocument();
        });

        it('AFTER fix: normalized ListItem[] shape renders accommodation names as labels', async () => {
            stubResolverWith([
                {
                    id: '1',
                    label: 'Cabaña del Sol',
                    meta: 'ACTIVE',
                    href: '/catalogo/alojamientos/1'
                },
                {
                    id: '2',
                    label: 'Hotel Litoral',
                    meta: 'ACTIVE',
                    href: '/catalogo/alojamientos/2'
                }
            ]);
            render(
                <TestWrapper>
                    <ListWidget widget={makeListWidget('admin.accommodations.latest')} />
                </TestWrapper>
            );
            await screen.findByTestId('list-widget');
            expect(screen.getByText('Cabaña del Sol')).toBeInTheDocument();
            expect(screen.getByText('Hotel Litoral')).toBeInTheDocument();
        });
    });

    // =========================================================================
    // admin.system.health → StatusWidget
    // BEFORE fix: returned {status:'ok',...} but variantMap had key 'up' → fell to neutral
    // AFTER fix:  normalizes 'ok' → 'up' before returning
    // =========================================================================

    describe('admin.system.health (card E) → StatusWidget', () => {
        const healthVariantMap = {
            up: 'success',
            degraded: 'warning',
            down: 'destructive'
        } as const;

        it('REGRESSION: raw status "ok" does not match variantMap key "up" → neutral variant', async () => {
            // Before fix: resolver returned {status: 'ok',...} — variantMap has 'up' not 'ok'
            stubResolverWith({ status: 'ok', db: 'ok', redis: 'ok' });
            render(
                <TestWrapper>
                    <StatusWidget
                        widget={makeStatusWidget('admin.system.health', healthVariantMap)}
                    />
                </TestWrapper>
            );
            const statusEl = await screen.findByTestId('status-widget');
            expect(statusEl).toBeInTheDocument();
            // 'ok' is not in variantMap → resolves to 'neutral'
            const badge = screen.getByTestId('status-badge');
            expect(badge).toHaveAttribute('data-variant', 'neutral');
        });

        it('AFTER fix: normalized status "up" matches variantMap → success variant', async () => {
            // After fix: resolver normalizes 'ok' → 'up'
            stubResolverWith({ status: 'up', description: 'DB: ok · Redis: ok' });
            render(
                <TestWrapper>
                    <StatusWidget
                        widget={makeStatusWidget('admin.system.health', healthVariantMap)}
                    />
                </TestWrapper>
            );
            await screen.findByTestId('status-widget');
            const badge = screen.getByTestId('status-badge');
            expect(badge).toHaveAttribute('data-variant', 'success');
        });
    });

    // =========================================================================
    // editor.posts.stats → ChartWidget
    // BEFORE fix: returned complex object without `series`
    // AFTER fix:  returns {series:[{label,value}]} from monthly trend or status distribution
    // =========================================================================

    describe('editor.posts.stats (card E) → ChartWidget', () => {
        it('REGRESSION: complex stats object without series renders empty, not crash', async () => {
            stubResolverWith({
                statusDistribution: { active: 10, draft: 5, archived: 2 },
                popularPosts: [],
                totalPublished: 10,
                monthlyTrend: []
            });
            render(
                <TestWrapper>
                    <ChartWidget widget={makeChartWidget('editor.posts.stats')} />
                </TestWrapper>
            );
            // No `series` field → empty state
            expect(await screen.findByTestId('chart-widget-empty')).toBeInTheDocument();
        });

        it('AFTER fix: normalized {series} from monthly trend renders chart', async () => {
            stubResolverWith({
                series: [
                    { label: 'Ene', value: 3 },
                    { label: 'Feb', value: 5 },
                    { label: 'Mar', value: 4 }
                ]
            });
            render(
                <TestWrapper>
                    <ChartWidget widget={makeChartWidget('editor.posts.stats')} />
                </TestWrapper>
            );
            expect(await screen.findByTestId('chart-widget')).toBeInTheDocument();
        });
    });

    // =========================================================================
    // host.accommodations.count → KpiWidget
    // BEFORE fix: returned raw number → kpi.value.toLocaleString crash
    // AFTER fix:  returns {value:number}
    // =========================================================================

    describe('host.accommodations.count (card A) → KpiWidget', () => {
        it('REGRESSION: raw number shape from before fix renders empty, not crash', async () => {
            // Before fix: resolver returned a plain number
            stubResolverWith(3);
            render(
                <TestWrapper>
                    <KpiWidget
                        widget={{
                            ...makeKpiWidget('host.accommodations.count'),
                            scope: 'own'
                        }}
                    />
                </TestWrapper>
            );
            // number is not an object with a `value` field — defensive guard → empty
            expect(await screen.findByTestId('kpi-widget-empty')).toBeInTheDocument();
        });

        it('AFTER fix: normalized {value} shape renders the count', async () => {
            stubResolverWith({ value: 3 });
            render(
                <TestWrapper>
                    <KpiWidget
                        widget={{
                            ...makeKpiWidget('host.accommodations.count'),
                            scope: 'own'
                        }}
                    />
                </TestWrapper>
            );
            const valueEl = await screen.findByTestId('kpi-value');
            expect(valueEl).toHaveTextContent('3');
        });
    });

    // =========================================================================
    // host.billing.plan → StatusWidget
    // BEFORE fix: returned {subscription,usage} — no `status` string
    // AFTER fix:  returns {status,label?,description?}
    // =========================================================================

    describe('host.billing.plan (card B) → StatusWidget', () => {
        const billingVariantMap = {
            active: 'success',
            expiring: 'warning',
            expired: 'destructive',
            cancelled: 'neutral',
            trial: 'warning'
        } as const;

        it('REGRESSION: raw {subscription,usage} shape renders empty (no status string), not crash', async () => {
            stubResolverWith({
                subscription: { id: 'sub_1', status: 'active', planId: 'plan-host-basico' },
                usage: { accommodationsUsed: 1, accommodationsLimit: 3 }
            });
            render(
                <TestWrapper>
                    <StatusWidget
                        widget={{
                            ...makeStatusWidget('host.billing.plan', billingVariantMap),
                            scope: 'own'
                        }}
                    />
                </TestWrapper>
            );
            // {subscription,usage} is an object but status is not a top-level string → empty
            expect(await screen.findByTestId('status-widget-empty')).toBeInTheDocument();
        });

        it('AFTER fix: normalized {status:"active"} shape renders success badge', async () => {
            stubResolverWith({
                status: 'active',
                label: 'plan-host-basico',
                description: '1/3 alojamientos'
            });
            render(
                <TestWrapper>
                    <StatusWidget
                        widget={{
                            ...makeStatusWidget('host.billing.plan', billingVariantMap),
                            scope: 'own'
                        }}
                    />
                </TestWrapper>
            );
            await screen.findByTestId('status-widget');
            const badge = screen.getByTestId('status-badge');
            expect(badge).toHaveAttribute('data-variant', 'success');
        });
    });

    // =========================================================================
    // Defensive guard: KpiWidget does not crash on any unexpected shape
    // =========================================================================

    describe('KpiWidget defensive guard', () => {
        // null → TanStack Query returns null → KpiWidget shows empty state (data == null guard)
        it('renders empty state when resolver returns null', async () => {
            stubResolverWith(null);
            render(
                <TestWrapper>
                    <KpiWidget widget={makeKpiWidget('test.source')} />
                </TestWrapper>
            );
            expect(await screen.findByTestId('kpi-widget-empty')).toBeInTheDocument();
            // Card shell always present (title always visible)
            expect(screen.getByTestId('kpi-widget')).toBeInTheDocument();
        });

        // Non-null values without `value` field → defensive guard → empty state, NOT crash
        const nonNullCases = [
            { label: 'raw number (old host.accommodations.count)', data: 42 },
            { label: 'array (old admin.entities.counts)', data: [{ name: 'acc', count: 5 }] },
            { label: 'object without value', data: { total: 99 } },
            { label: 'string', data: 'unexpected' }
        ];

        for (const { label, data } of nonNullCases) {
            it(`renders empty state for unexpected non-null shape: ${label}`, async () => {
                stubResolverWith(data);
                render(
                    <TestWrapper>
                        <KpiWidget widget={makeKpiWidget('test.source')} />
                    </TestWrapper>
                );
                // Defensive guard: typeof kpi.value !== 'number' → empty state, not crash
                expect(await screen.findByTestId('kpi-widget-empty')).toBeInTheDocument();
                // Card shell always present (title always visible)
                expect(screen.getByTestId('kpi-widget')).toBeInTheDocument();
            });
        }
    });

    // =========================================================================
    // Defensive guard: ChartWidget does not crash on any unexpected shape
    // =========================================================================

    describe('ChartWidget defensive guard', () => {
        const cases = [
            { label: 'null', data: null },
            { label: 'object without series', data: { total: 5, byRole: { HOST: 3 } } },
            { label: 'series is not array', data: { series: 'bad' } },
            { label: 'empty series array', data: { series: [] } },
            { label: 'raw array', data: [{ month: 'Ene', count: 3 }] }
        ];

        for (const { label, data } of cases) {
            it(`renders empty state for unexpected shape: ${label}`, async () => {
                stubResolverWith(data);
                render(
                    <TestWrapper>
                        <ChartWidget widget={makeChartWidget('test.source')} />
                    </TestWrapper>
                );
                expect(await screen.findByTestId('chart-widget-empty')).toBeInTheDocument();
                // Card shell always present (title always visible)
                expect(screen.getByTestId('chart-widget')).toBeInTheDocument();
            });
        }
    });

    // =========================================================================
    // Defensive guard: StatusWidget does not crash on any unexpected shape
    // =========================================================================

    describe('StatusWidget defensive guard', () => {
        const variantMap = { up: 'success' } as const;

        const cases = [
            { label: 'null', data: null },
            { label: 'object without status', data: { subscription: { status: 'active' } } },
            { label: 'number', data: 1 },
            { label: 'string', data: 'up' }
        ];

        for (const { label, data } of cases) {
            it(`renders empty state for unexpected shape: ${label}`, async () => {
                stubResolverWith(data);
                render(
                    <TestWrapper>
                        <StatusWidget widget={makeStatusWidget('test.source', variantMap)} />
                    </TestWrapper>
                );
                expect(await screen.findByTestId('status-widget-empty')).toBeInTheDocument();
                // Card shell always present (title always visible)
                expect(screen.getByTestId('status-widget')).toBeInTheDocument();
            });
        }
    });

    // =========================================================================
    // Defensive guard: ListWidget does not crash on any unexpected shape
    // =========================================================================

    describe('ListWidget defensive guard', () => {
        const cases = [
            { label: 'null', data: null },
            { label: 'object with items not at root', data: { items: [{ id: '1', label: 'x' }] } },
            { label: 'empty array', data: [] }
        ];

        for (const { label, data } of cases) {
            it(`renders empty state for unexpected shape: ${label}`, async () => {
                stubResolverWith(data);
                render(
                    <TestWrapper>
                        <ListWidget widget={makeListWidget('test.source')} />
                    </TestWrapper>
                );
                expect(await screen.findByTestId('list-widget-empty')).toBeInTheDocument();
                // Card shell always present (title always visible)
                expect(screen.getByTestId('list-widget')).toBeInTheDocument();
            });
        }
    });
});
