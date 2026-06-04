// @vitest-environment jsdom
/**
 * Tests for ListWidget component (SPEC-155 T-024).
 *
 * Strategy:
 * - Mock `useDashboardResolver` to return a stub `resolveForScope`.
 * - Wrap each render in a minimal `QueryClientProvider` so `useQuery` works.
 * - Control what `resolveForScope` returns (found/not-found) and what the
 *   query produces (loading/error/data) via `vi.fn()`.
 *
 * Covers:
 * - Renders N items from the data array.
 * - Renders item label and optional meta field.
 * - Renders item badge when present.
 * - Respects `maxItems` config — slices the list.
 * - `actionPerItem` with `hrefTemplate` renders an `<a>` link per row.
 * - `actionPerItem` without `hrefTemplate` renders a `<button>` per row.
 * - Item's own `href` takes precedence over the config `hrefTemplate`.
 * - Shows skeleton while loading.
 * - Shows error state + retry button on error; clicking retry does not throw.
 * - Shows empty state when data is null.
 * - Shows empty state when data is an empty array.
 * - Shows unavailable state when source is not found.
 *
 * References: SPEC-155 T-024
 */

import type { Widget } from '@/config/ia/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListWidget } from '../ListWidget';

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
 * Minimal Widget fixture for list type.
 */
function makeWidget(overrides: Partial<Widget> = {}): Widget {
    return {
        id: 'test-list',
        type: 'list',
        label: { es: 'Consultas recientes', en: 'Recent inquiries', pt: 'Consultas recentes' },
        scope: 'all',
        onMissing: 'disable',
        config: { source: 'admin.recent.consultations' },
        ...overrides
    };
}

/**
 * Stub query options that immediately resolve with the given data.
 */
function stubQueryOptions(data: unknown) {
    return {
        queryKey: ['dashboard', 'list-test', 'ADMIN', 'all'],
        queryFn: () => Promise.resolve(data),
        staleTime: 60_000
    };
}

/**
 * Stub query options whose queryFn always rejects.
 */
function stubErrorOptions() {
    return {
        queryKey: ['dashboard', 'list-error', 'ADMIN', 'all'],
        queryFn: () => Promise.reject(new Error('fetch failed')),
        staleTime: 60_000
    };
}

/**
 * Default list items fixture used across multiple tests.
 */
const ITEMS = [
    { id: '1', label: 'Consulta sobre cabaña', meta: 'hace 2h' },
    { id: '2', label: 'Reserva pendiente', meta: 'ayer' },
    { id: '3', label: 'Pregunta sobre servicios' }
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ListWidget', () => {
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
                <ListWidget widget={makeWidget()} />
            </TestWrapper>
        );

        expect(screen.getByTestId('list-widget-unavailable')).toBeInTheDocument();
        // Card shell is always present
        expect(screen.getByTestId('list-widget')).toBeInTheDocument();
        // Title is always visible
        expect(screen.getByTestId('list-label')).toHaveTextContent('Consultas recientes');
    });

    // ── Loading state ──────────────────────────────────────────────────────

    it('renders the skeleton while the query is loading', () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: {
                queryKey: ['dashboard', 'list-pending', 'ADMIN', 'all'],
                queryFn: () => new Promise(() => undefined), // never resolves
                staleTime: 60_000
            }
        });

        render(
            <TestWrapper>
                <ListWidget widget={makeWidget()} />
            </TestWrapper>
        );

        expect(screen.getByTestId('list-widget-skeleton')).toBeInTheDocument();
        // Card shell is always present while loading
        expect(screen.getByTestId('list-widget')).toBeInTheDocument();
        // Title is always visible while loading
        expect(screen.getByTestId('list-label')).toHaveTextContent('Consultas recientes');
    });

    // ── Error state ────────────────────────────────────────────────────────

    it('renders the error state with a retry button when the query fails', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubErrorOptions()
        });

        render(
            <TestWrapper>
                <ListWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const errorEl = await screen.findByTestId('list-widget-error');
        expect(errorEl).toBeInTheDocument();
        // Card shell is always present on error
        expect(screen.getByTestId('list-widget')).toBeInTheDocument();
        // Title is always visible on error
        expect(screen.getByTestId('list-label')).toHaveTextContent('Consultas recientes');
    });

    it('exposes a retry button inside the error state that does not throw when clicked', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubErrorOptions()
        });

        render(
            <TestWrapper>
                <ListWidget widget={makeWidget()} />
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
                <ListWidget widget={makeWidget()} />
            </TestWrapper>
        );

        expect(await screen.findByTestId('list-widget-empty')).toBeInTheDocument();
        // Title is always visible when empty
        expect(screen.getByTestId('list-label')).toHaveTextContent('Consultas recientes');
    });

    it('renders the empty state when data is an empty array', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions([])
        });

        render(
            <TestWrapper>
                <ListWidget widget={makeWidget()} />
            </TestWrapper>
        );

        expect(await screen.findByTestId('list-widget-empty')).toBeInTheDocument();
        // Title is always visible when empty
        expect(screen.getByTestId('list-label')).toHaveTextContent('Consultas recientes');
    });

    // ── Data — renders N items ─────────────────────────────────────────────

    it('renders the correct number of items from data', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(ITEMS)
        });

        render(
            <TestWrapper>
                <ListWidget widget={makeWidget()} />
            </TestWrapper>
        );

        await screen.findByTestId('list-widget');
        const rows = screen.getAllByTestId('list-item');
        expect(rows).toHaveLength(ITEMS.length);
    });

    it('renders the item label', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(ITEMS)
        });

        render(
            <TestWrapper>
                <ListWidget widget={makeWidget()} />
            </TestWrapper>
        );

        await screen.findByTestId('list-widget');
        expect(screen.getByText('Consulta sobre cabaña')).toBeInTheDocument();
        expect(screen.getByText('Reserva pendiente')).toBeInTheDocument();
    });

    it('renders the item meta when present', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(ITEMS)
        });

        render(
            <TestWrapper>
                <ListWidget widget={makeWidget()} />
            </TestWrapper>
        );

        await screen.findByTestId('list-widget');
        expect(screen.getByText('hace 2h')).toBeInTheDocument();
        expect(screen.getByText('ayer')).toBeInTheDocument();
    });

    it('does not render meta element when meta is absent', async () => {
        const items = [{ id: '1', label: 'Solo label' }];
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(items)
        });

        render(
            <TestWrapper>
                <ListWidget widget={makeWidget()} />
            </TestWrapper>
        );

        await screen.findByTestId('list-widget');
        expect(screen.queryByTestId('list-item-meta')).not.toBeInTheDocument();
    });

    // ── Data — badge ──────────────────────────────────────────────────────

    it('renders item badges when present', async () => {
        const items = [
            { id: '1', label: 'Item con badge', badge: 'nuevo' },
            { id: '2', label: 'Item con badge numérico', badge: 3 }
        ];
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(items)
        });

        render(
            <TestWrapper>
                <ListWidget widget={makeWidget()} />
            </TestWrapper>
        );

        await screen.findByTestId('list-widget');
        const badges = screen.getAllByTestId('list-item-badge');
        expect(badges).toHaveLength(2);
        expect(badges[0]).toHaveTextContent('nuevo');
        expect(badges[1]).toHaveTextContent('3');
    });

    it('does not render a badge element when badge is absent', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions([{ id: '1', label: 'Sin badge' }])
        });

        render(
            <TestWrapper>
                <ListWidget widget={makeWidget()} />
            </TestWrapper>
        );

        await screen.findByTestId('list-widget');
        expect(screen.queryByTestId('list-item-badge')).not.toBeInTheDocument();
    });

    // ── Data — maxItems ───────────────────────────────────────────────────

    it('respects maxItems config and slices the list', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(ITEMS)
        });

        const widget = makeWidget({
            config: { source: 'admin.recent.consultations', maxItems: 2 }
        });

        render(
            <TestWrapper>
                <ListWidget widget={widget} />
            </TestWrapper>
        );

        await screen.findByTestId('list-widget');
        const rows = screen.getAllByTestId('list-item');
        expect(rows).toHaveLength(2);
    });

    // ── Data — widget label ───────────────────────────────────────────────

    it('renders the widget label from widget.label.es', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(ITEMS)
        });

        render(
            <TestWrapper>
                <ListWidget widget={makeWidget()} />
            </TestWrapper>
        );

        const labelEl = await screen.findByTestId('list-label');
        expect(labelEl).toHaveTextContent('Consultas recientes');
    });

    // ── actionPerItem — link (hrefTemplate) ───────────────────────────────

    it('renders an <a> link per row when actionPerItem has hrefTemplate', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(ITEMS)
        });

        const widget = makeWidget({
            config: {
                source: 'admin.recent.consultations',
                actionPerItem: {
                    label: 'Responder',
                    hrefTemplate: '/admin/conversations/{id}'
                }
            }
        });

        render(
            <TestWrapper>
                <ListWidget widget={widget} />
            </TestWrapper>
        );

        await screen.findByTestId('list-widget');

        // One link per item (all items have an id).
        const links = screen.getAllByTestId('list-item-action-link');
        expect(links).toHaveLength(ITEMS.length);

        // The href is correctly interpolated with the item id.
        expect(links[0]).toHaveAttribute('href', '/admin/conversations/1');
        expect(links[1]).toHaveAttribute('href', '/admin/conversations/2');
    });

    it('renders action link text from actionPerItem.label', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions([{ id: '1', label: 'Test item' }])
        });

        const widget = makeWidget({
            config: {
                source: 'admin.recent.consultations',
                actionPerItem: {
                    label: 'Ver detalle',
                    hrefTemplate: '/admin/items/{id}'
                }
            }
        });

        render(
            <TestWrapper>
                <ListWidget widget={widget} />
            </TestWrapper>
        );

        await screen.findByTestId('list-widget');
        const link = screen.getByTestId('list-item-action-link');
        expect(link).toHaveTextContent('Ver detalle');
    });

    it("uses item's own href over hrefTemplate when both are present", async () => {
        const items = [{ id: '1', label: 'Item', href: '/custom/path' }];
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(items)
        });

        const widget = makeWidget({
            config: {
                source: 'admin.recent.consultations',
                actionPerItem: {
                    label: 'Ir',
                    hrefTemplate: '/admin/should-not-be-used/{id}'
                }
            }
        });

        render(
            <TestWrapper>
                <ListWidget widget={widget} />
            </TestWrapper>
        );

        await screen.findByTestId('list-widget');
        const link = screen.getByTestId('list-item-action-link');
        expect(link).toHaveAttribute('href', '/custom/path');
    });

    // ── actionPerItem — button (no hrefTemplate) ──────────────────────────

    it('renders a <button> per row when actionPerItem has no hrefTemplate', async () => {
        const items = [
            { id: '1', label: 'Draft 1' },
            { id: '2', label: 'Draft 2' }
        ];
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(items)
        });

        const widget = makeWidget({
            config: {
                source: 'admin.recent.consultations',
                actionPerItem: { label: 'Publicar' }
            }
        });

        render(
            <TestWrapper>
                <ListWidget widget={widget} />
            </TestWrapper>
        );

        await screen.findByTestId('list-widget');

        const buttons = screen.getAllByTestId('list-item-action-button');
        expect(buttons).toHaveLength(2);
        expect(buttons[0]).toHaveTextContent('Publicar');

        // No links should be present in this case.
        expect(screen.queryByTestId('list-item-action-link')).not.toBeInTheDocument();
    });

    it('does not render any action elements when actionPerItem is absent', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubQueryOptions(ITEMS)
        });

        render(
            <TestWrapper>
                <ListWidget widget={makeWidget()} />
            </TestWrapper>
        );

        await screen.findByTestId('list-widget');
        expect(screen.queryByTestId('list-item-action-link')).not.toBeInTheDocument();
        expect(screen.queryByTestId('list-item-action-button')).not.toBeInTheDocument();
    });

    // ── i18n label resolution (regression) ─────────────────────────────────
    // Dashboard configs supply `actionPerItem.label` as an { es, en, pt } object.
    // Rendering that object directly crashes React ("Objects are not valid as a
    // React child"). The widget must resolve it to the es locale string.

    describe('i18n label resolution (regression)', () => {
        it('renders the es locale when actionPerItem.label is an I18nLabel object', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([
                    { id: '1', label: 'Cabaña del Sol', href: '/accommodations/1' }
                ])
            });

            const widget = makeWidget({
                config: {
                    source: 'admin.accommodations.latest',
                    actionPerItem: {
                        label: { es: 'Ver', en: 'View', pt: 'Ver' },
                        hrefTemplate: '/x/{id}'
                    }
                }
            });

            render(
                <TestWrapper>
                    <ListWidget widget={widget} />
                </TestWrapper>
            );

            const link = await screen.findByTestId('list-item-action-link');
            // Renders the es string — NOT the raw object (which would crash React).
            expect(link).toHaveTextContent('Ver');
        });

        it('renders the es locale when an item.label is an I18nLabel object', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([{ id: '1', label: { es: 'Hola', en: 'Hi', pt: 'Olá' } }])
            });

            render(
                <TestWrapper>
                    <ListWidget widget={makeWidget()} />
                </TestWrapper>
            );

            const label = await screen.findByTestId('list-item-label');
            expect(label).toHaveTextContent('Hola');
        });
    });

    // ── inlineMeta (SPEC-161 cron card D) ──────────────────────────────────

    describe('inlineMeta', () => {
        it('renders inlineMeta inline next to the label on line 1', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([
                    { id: '1', label: 'Purga de runs', inlineMeta: 'cada hora' }
                ])
            });

            render(
                <TestWrapper>
                    <ListWidget widget={makeWidget()} />
                </TestWrapper>
            );

            const inlineMeta = await screen.findByTestId('list-item-inline-meta');
            expect(inlineMeta).toHaveTextContent('cada hora');
        });

        it('omits inlineMeta when the field is absent', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([{ id: '1', label: 'Sin schedule' }])
            });

            render(
                <TestWrapper>
                    <ListWidget widget={makeWidget()} />
                </TestWrapper>
            );

            await screen.findByTestId('list-item-label');
            expect(screen.queryByTestId('list-item-inline-meta')).not.toBeInTheDocument();
        });
    });

    // ── Collapsible groups (SPEC-161 cron card D) ──────────────────────────

    describe('collapsibleGroups', () => {
        /** Two categories, one of which has a failed + a timeout row. */
        const GROUPED_ITEMS = [
            {
                id: 'a',
                label: 'Job A',
                group: 'Sistema',
                statusBadge: { label: 'Falló', variant: 'destructive' as const }
            },
            {
                id: 'b',
                label: 'Job B',
                group: 'Sistema',
                statusBadge: { label: 'Timeout', variant: 'warning' as const }
            },
            {
                id: 'c',
                label: 'Job C',
                group: 'Sistema',
                statusBadge: { label: 'OK', variant: 'success' as const }
            },
            {
                id: 'd',
                label: 'Job D',
                group: 'Facturación',
                statusBadge: { label: 'OK', variant: 'success' as const }
            }
        ];

        function makeCollapsibleWidget() {
            return makeWidget({
                config: { source: 'admin.crons.list', collapsibleGroups: true }
            });
        }

        it('renders one collapsible panel per group with all panels collapsed by default', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions(GROUPED_ITEMS)
            });

            render(
                <TestWrapper>
                    <ListWidget widget={makeCollapsibleWidget()} />
                </TestWrapper>
            );

            const toggles = await screen.findAllByTestId('list-group-toggle');
            expect(toggles).toHaveLength(2);
            // Collapsed by default: no item rows are visible.
            expect(screen.queryByTestId('list-item')).not.toBeInTheDocument();
            // Each toggle reports collapsed via aria-expanded.
            for (const toggle of toggles) {
                expect(toggle).toHaveAttribute('aria-expanded', 'false');
            }
        });

        it('shows the item count and a failure badge per group header', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions(GROUPED_ITEMS)
            });

            render(
                <TestWrapper>
                    <ListWidget widget={makeCollapsibleWidget()} />
                </TestWrapper>
            );

            // Counts: Sistema (3), Facturación (1) — rendered as a soft pill (number only).
            const counts = await screen.findAllByTestId('list-group-count');
            expect(counts.map((c) => c.textContent)).toEqual(['3', '1']);

            // Failure badge: only Sistema (failed + timeout = 2); Facturación has none.
            const failureBadges = screen.getAllByTestId('list-group-failure-badge');
            expect(failureBadges).toHaveLength(1);
            expect(failureBadges[0]).toHaveTextContent('2');
        });

        it('expands a group on click and collapses it again on a second click', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions(GROUPED_ITEMS)
            });

            render(
                <TestWrapper>
                    <ListWidget widget={makeCollapsibleWidget()} />
                </TestWrapper>
            );

            const [sistemaToggle] = await screen.findAllByTestId('list-group-toggle');

            // Expand Sistema → its 3 rows become visible.
            fireEvent.click(sistemaToggle);
            expect(sistemaToggle).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getAllByTestId('list-item')).toHaveLength(3);

            // Collapse again → rows hidden.
            fireEvent.click(sistemaToggle);
            expect(sistemaToggle).toHaveAttribute('aria-expanded', 'false');
            expect(screen.queryByTestId('list-item')).not.toBeInTheDocument();
        });
    });

    // ── footerLink (SPEC-175 T-015) ────────────────────────────────────────

    describe('footerLink', () => {
        it('renders the footer link when footerLink and onFooterLinkClick are configured', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions(ITEMS)
            });

            const widget = makeWidget({
                config: {
                    source: 'admin.recent.consultations',
                    footerLink: {
                        label: { es: 'Ver todas', en: 'See all', pt: 'Ver todas' },
                        action: 'whats-new-panel'
                    },
                    onFooterLinkClick: vi.fn()
                }
            });

            render(
                <TestWrapper>
                    <ListWidget widget={widget} />
                </TestWrapper>
            );

            await screen.findByTestId('list-widget');
            expect(screen.getByTestId('list-widget-footer')).toBeInTheDocument();
            expect(screen.getByTestId('list-widget-footer-link')).toHaveTextContent('Ver todas');
        });

        it('fires onFooterLinkClick with the action key when clicked', async () => {
            const onFooterLinkClick = vi.fn();
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions(ITEMS)
            });

            const widget = makeWidget({
                config: {
                    source: 'admin.recent.consultations',
                    footerLink: {
                        label: 'Ver todas',
                        action: 'whats-new-panel'
                    },
                    onFooterLinkClick
                }
            });

            render(
                <TestWrapper>
                    <ListWidget widget={widget} />
                </TestWrapper>
            );

            await screen.findByTestId('list-widget-footer-link');
            fireEvent.click(screen.getByTestId('list-widget-footer-link'));
            expect(onFooterLinkClick).toHaveBeenCalledTimes(1);
            expect(onFooterLinkClick).toHaveBeenCalledWith('whats-new-panel');
        });

        it('does not render the footer when footerLink is absent', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions(ITEMS)
            });

            render(
                <TestWrapper>
                    <ListWidget widget={makeWidget()} />
                </TestWrapper>
            );

            await screen.findByTestId('list-widget');
            expect(screen.queryByTestId('list-widget-footer')).not.toBeInTheDocument();
        });

        it('does not render the footer when onFooterLinkClick is absent (safety guard)', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions(ITEMS)
            });

            // footerLink present but no handler — footer must NOT render to avoid
            // dead UI elements that do nothing when clicked.
            const widget = makeWidget({
                config: {
                    source: 'admin.recent.consultations',
                    footerLink: { label: 'Ver todas', action: 'whats-new-panel' }
                    // onFooterLinkClick intentionally absent
                }
            });

            render(
                <TestWrapper>
                    <ListWidget widget={widget} />
                </TestWrapper>
            );

            await screen.findByTestId('list-widget');
            expect(screen.queryByTestId('list-widget-footer')).not.toBeInTheDocument();
        });
    });

    // ── onItemClick (SPEC-175 T-015) ───────────────────────────────────────

    describe('onItemClick', () => {
        it('fires onItemClick with the item when the action button is clicked', async () => {
            const onItemClick = vi.fn();
            const items = [
                { id: 'entry-1', label: 'Primera novedad', meta: '2026-06-01' },
                { id: 'entry-2', label: 'Segunda novedad', meta: '2026-05-15' }
            ];

            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions(items)
            });

            const widget = makeWidget({
                config: {
                    source: 'whats-new.recent',
                    actionPerItem: { label: { es: 'Ver', en: 'View', pt: 'Ver' } },
                    onItemClick
                }
            });

            render(
                <TestWrapper>
                    <ListWidget widget={widget} />
                </TestWrapper>
            );

            await screen.findByTestId('list-widget');
            const buttons = screen.getAllByTestId('list-item-action-button');
            expect(buttons).toHaveLength(2);

            fireEvent.click(buttons[0]);
            expect(onItemClick).toHaveBeenCalledTimes(1);
            expect(onItemClick).toHaveBeenCalledWith(items[0]);
        });

        it('widgets WITHOUT onItemClick/footerLink render identically to before (regression)', async () => {
            // This test ensures the existing behavior is preserved when neither
            // new config field is present — a regression guard.
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions(ITEMS)
            });

            const widget = makeWidget({
                config: {
                    source: 'admin.recent.consultations',
                    maxItems: 3,
                    actionPerItem: {
                        label: 'Responder',
                        hrefTemplate: '/admin/conversations/{id}'
                    }
                }
            });

            render(
                <TestWrapper>
                    <ListWidget widget={widget} />
                </TestWrapper>
            );

            await screen.findByTestId('list-widget');

            // Normal data rendered.
            expect(screen.getAllByTestId('list-item')).toHaveLength(3);
            // Links rendered (not buttons).
            expect(screen.getAllByTestId('list-item-action-link')).toHaveLength(3);
            // No footer.
            expect(screen.queryByTestId('list-widget-footer')).not.toBeInTheDocument();
            // No extra buttons introduced.
            expect(screen.queryByTestId('list-item-action-button')).not.toBeInTheDocument();
        });
    });
});
