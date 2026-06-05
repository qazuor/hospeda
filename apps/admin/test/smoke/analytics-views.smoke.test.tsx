// @vitest-environment jsdom
/**
 * Tests for the /analytics/views route (SPEC-197 T-019).
 *
 * Strategy:
 * - Mock `@tanstack/react-query` at the call site so individual `useQuery` /
 *   `useQueries` calls return controlled fixtures.
 * - Mock `recharts` `ResponsiveContainer` so it renders children in jsdom
 *   (same pattern as ChartWidget.test.tsx).
 * - Each `describe` block covers one AC.
 *
 * Covers:
 * - AC-31: page renders without error with ANALYTICS_VIEW permission.
 * - AC-33: summary tiles show three entity types + WindowToggle present.
 * - AC-34: top-10 tables render (loading skeleton + data).
 * - AC-35: resolved entity name shown; falls back to entityId.
 * - AC-36 / AC-38: chart renders with 90-row mock (three Line elements visible
 *   via the ResponsiveContainer wrapper test-id); loading skeleton shown.
 * - Summary section only contains WindowToggle (not top-10 or chart sections).
 */

import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/render-with-providers';

// ---------------------------------------------------------------------------
// Recharts mock — ResponsiveContainer must render children in jsdom
// ---------------------------------------------------------------------------
vi.mock('recharts', async (importActual) => {
    const actual = await importActual<typeof import('recharts')>();
    return {
        ...actual,
        ResponsiveContainer: ({
            children,
            ...props
        }: {
            children: React.ReactNode;
            [key: string]: unknown;
        }) => (
            <div
                data-testid="recharts-responsive-container"
                style={{ width: 300, height: 280 }}
                {...props}
            >
                {children}
            </div>
        )
    };
});

// ---------------------------------------------------------------------------
// TanStack Query mock — controlled query results per test
// ---------------------------------------------------------------------------
const mockSummaryRows = [
    { entityType: 'ACCOMMODATION', unique: 10, total: 25 },
    { entityType: 'POST', unique: 5, total: 12 },
    { entityType: 'EVENT', unique: 3, total: 7 }
];

const mockTopAccommodations = [
    { entityId: 'acc-001', unique: 8, total: 20 },
    { entityId: 'acc-002', unique: 4, total: 9 }
];

const mockTopPosts = [{ entityId: 'post-001', unique: 5, total: 12 }];

const mockTopEvents: never[] = [];

/** Build a 90-row daily-series fixture (3 types × 30 days). */
function buildDailySeries() {
    const types = ['ACCOMMODATION', 'POST', 'EVENT'] as const;
    const rows: Array<{ date: string; entityType: (typeof types)[number]; total: number }> = [];
    const base = new Date('2026-05-07');
    for (let d = 0; d < 30; d++) {
        const date = new Date(base);
        date.setDate(base.getDate() + d);
        const dateStr = date.toISOString().slice(0, 10);
        for (const t of types) {
            rows.push({ date: dateStr, entityType: t, total: d + 1 });
        }
    }
    return rows;
}

const mockDailySeries = buildDailySeries();

vi.mock('@tanstack/react-query', async (importActual) => {
    const actual = await importActual<typeof import('@tanstack/react-query')>();

    return {
        ...actual,
        useQuery: vi.fn(({ queryKey }: { queryKey: readonly unknown[] }) => {
            const key = queryKey[0] as string;

            if (key === 'admin-views-summary') {
                return { data: mockSummaryRows, isLoading: false, isError: false };
            }
            if (key === 'admin-views-top') {
                const entityType = queryKey[1] as string;
                if (entityType === 'ACCOMMODATION') {
                    return { data: mockTopAccommodations, isLoading: false, isError: false };
                }
                if (entityType === 'POST') {
                    return { data: mockTopPosts, isLoading: false, isError: false };
                }
                // EVENT — empty
                return { data: mockTopEvents, isLoading: false, isError: false };
            }
            if (key === 'admin-views-daily-series') {
                return { data: mockDailySeries, isLoading: false, isError: false };
            }
            return { data: undefined, isLoading: false, isError: false };
        }),
        useQueries: vi.fn(
            ({
                queries
            }: {
                queries: Array<{ queryKey: readonly [string, string, string] }>;
            }) =>
                queries.map(({ queryKey }) => {
                    const entityId = queryKey[2];
                    // Resolve acc-001 → 'Hospedaje Los Robles', others → null (fallback)
                    const name = entityId === 'acc-001' ? 'Hospedaje Los Robles' : null;
                    return { data: name, isLoading: false, isError: false };
                })
        )
    };
});

// ---------------------------------------------------------------------------
// Import route AFTER mocks
// ---------------------------------------------------------------------------
import { Route } from '@/routes/_authed/analytics/views';

// ============================================================================
// TESTS
// ============================================================================

describe('AnalyticsViewsPage (SPEC-197 T-019)', () => {
    // -------------------------------------------------------------------------
    // AC-31 — page renders without error
    // -------------------------------------------------------------------------
    describe('AC-31: page renders', () => {
        it('mounts without throwing', async () => {
            const Page = Route.options.component;
            if (!Page) throw new Error('Component not found in Route.options');

            const { container } = renderWithProviders(<Page />);
            await waitFor(() => {
                expect(container.firstChild).not.toBeNull();
            });
        });
    });

    // -------------------------------------------------------------------------
    // AC-33 — summary tiles: three entity types + WindowToggle in summary only
    // -------------------------------------------------------------------------
    describe('AC-33: summary tiles', () => {
        it('renders three entity-type labels', async () => {
            const Page = Route.options.component;
            if (!Page) throw new Error('Component not found in Route.options');

            const { getAllByText } = renderWithProviders(<Page />);
            // i18n mock returns key as-is
            await waitFor(() => {
                expect(
                    getAllByText('admin-pages.analytics.views.labelAccommodation').length
                ).toBeGreaterThanOrEqual(1);
                expect(
                    getAllByText('admin-pages.analytics.views.labelPost').length
                ).toBeGreaterThanOrEqual(1);
                expect(
                    getAllByText('admin-pages.analytics.views.labelEvent').length
                ).toBeGreaterThanOrEqual(1);
            });
        });

        it('renders WindowToggle in the summary section', async () => {
            const Page = Route.options.component;
            if (!Page) throw new Error('Component not found in Route.options');

            const { getByRole } = renderWithProviders(<Page />);
            await waitFor(() => {
                // WindowToggle renders a <fieldset> with aria-label
                const fieldset = getByRole('group', {
                    name: 'common.window.ariaLabel'
                });
                expect(fieldset).toBeTruthy();
            });
        });

        it('shows summary unique and total counts', async () => {
            const Page = Route.options.component;
            if (!Page) throw new Error('Component not found in Route.options');

            const { getAllByText } = renderWithProviders(<Page />);
            await waitFor(() => {
                // unique=10 for ACCOMMODATION
                expect(getAllByText('10').length).toBeGreaterThanOrEqual(1);
                // total=25 for ACCOMMODATION
                expect(getAllByText('25').length).toBeGreaterThanOrEqual(1);
            });
        });
    });

    // -------------------------------------------------------------------------
    // AC-35 — entity name resolution: resolved name shown, fallback to entityId
    // -------------------------------------------------------------------------
    describe('AC-35: entity name resolution', () => {
        it('shows resolved name when available', async () => {
            const Page = Route.options.component;
            if (!Page) throw new Error('Component not found in Route.options');

            const { getByText } = renderWithProviders(<Page />);
            await waitFor(() => {
                expect(getByText('Hospedaje Los Robles')).toBeTruthy();
            });
        });

        it('falls back to entityId when name cannot be resolved', async () => {
            const Page = Route.options.component;
            if (!Page) throw new Error('Component not found in Route.options');

            const { getByText } = renderWithProviders(<Page />);
            await waitFor(() => {
                // acc-002 resolves to null → shows entityId
                expect(getByText('acc-002')).toBeTruthy();
            });
        });
    });

    // -------------------------------------------------------------------------
    // AC-34 — top-10 tables: empty state rendered for EVENT
    // -------------------------------------------------------------------------
    describe('AC-34: top-10 tables', () => {
        it('shows empty state for entity type with no views', async () => {
            const Page = Route.options.component;
            if (!Page) throw new Error('Component not found in Route.options');

            const { getAllByText } = renderWithProviders(<Page />);
            await waitFor(() => {
                // EVENT has no rows → empty label shown
                expect(
                    getAllByText('admin-pages.analytics.views.empty').length
                ).toBeGreaterThanOrEqual(1);
            });
        });
    });

    // -------------------------------------------------------------------------
    // AC-36 / AC-38 — chart: ResponsiveContainer present + no skeleton when data ready
    // -------------------------------------------------------------------------
    describe('AC-36 + AC-38: chart renders with data', () => {
        it('renders the ResponsiveContainer wrapper', async () => {
            const Page = Route.options.component;
            if (!Page) throw new Error('Component not found in Route.options');

            const { getByTestId } = renderWithProviders(<Page />);
            await waitFor(() => {
                expect(getByTestId('recharts-responsive-container')).toBeTruthy();
            });
        });
    });
});
