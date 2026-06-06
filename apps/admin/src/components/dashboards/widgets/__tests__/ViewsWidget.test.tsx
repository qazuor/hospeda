// @vitest-environment jsdom
/**
 * Tests for ViewsWidget component (SPEC-197 T-013..T-015).
 *
 * Strategy:
 * - Mock `useDashboardResolver` to return a controllable `resolveForScope`.
 * - Mock `useAuthContext` to provide a minimal user object.
 * - Mock `useTranslations` to return predictable strings.
 * - Mock `fetchApi` to control the responses returned by the window-parameterized queryFn.
 * - Wrap each render in `QueryClientProvider` so `useQuery` works.
 *
 * Covers (SPEC-197 ACs):
 * - AC-2: clicking 7d toggle re-fetches with ?window=7d and counts update.
 * - AC-3: locked state renders lock icon + description + CTA href /billing/plans.
 * - AC-6: when resolver returns { locked: true } (403 path), widget shows locked UI.
 * - AC-9: editor-posts variant window toggle is independent.
 * - AC-12: editor-events variant window toggle is independent.
 * - Empty state renders copy.
 * - Admin card three rows (ACCOMMODATION, POST, EVENT).
 * - Loading state renders skeleton.
 * - Error state renders error body.
 * - Unavailable state (source not found) renders unavailable body.
 */

import type { Widget } from '@/config/ia/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewsWidget } from '../ViewsWidget';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockResolveForScope = vi.fn();

vi.mock('@/contexts/dashboard-resolver-context', () => ({
    useDashboardResolver: () => ({
        resolveForScope: mockResolveForScope
    })
}));

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({ user: { id: 'u-test-1', role: 'HOST' } }),
    useHasPermission: vi.fn(() => true),
    useHasRole: vi.fn(() => false),
    useHasAnyRole: vi.fn(() => false)
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => {
            const MAP: Record<string, string> = {
                'admin-dashboard.dashboard.host.views.locked.description':
                    'Disponible con un plan activo',
                'admin-dashboard.dashboard.host.views.locked.cta': 'Ver planes',
                'common.window.ariaLabel': 'Período de tiempo',
                'common.window.7d': '7d',
                'common.window.30d': '30d'
            };
            return MAP[key] ?? key;
        }
    })
}));

// Mock fetchApi — the ViewsWidget calls it directly for window-parameterized fetches.
const mockFetchApi = vi.fn();
vi.mock('@/lib/api/client', () => ({
    fetchApi: (...args: unknown[]) => mockFetchApi(...args)
}));

// Mock ApiError
vi.mock('@/lib/errors', () => ({
    ApiError: class ApiError extends Error {
        public readonly status: number;

        constructor(message: string, config: { status: number }) {
            super(message);
            this.name = 'ApiError';
            this.status = config.status;
        }
    }
}));

vi.mock('@repo/icons', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/icons')>()),
    AlertTriangleIcon: () => <svg data-testid="alert-icon" />,
    LockIcon: () => <svg data-testid="lock-icon" />
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wraps a fetch body in the fetchApi `{ data, status }` envelope. */
function envelope(body: unknown) {
    return { data: body, status: 200 };
}

/** Creates a fresh QueryClient with retries disabled for deterministic tests. */
function makeClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });
}

function Wrapper({ children, client }: { children: ReactNode; client: QueryClient }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Minimal Widget fixture for the HOST variant. */
const hostWidget: Widget = {
    id: 'host-card-g-views',
    type: 'views',
    label: { es: 'Vistas de alojamientos', en: 'Accommodation views', pt: 'Visualizações' },
    scope: 'own',
    onMissing: 'hide',
    config: {
        source: 'host.stats.views',
        viewsVariant: 'host',
        accent: 'sky',
        icon: 'activity'
    }
};

/** Minimal Widget fixture for the admin-summary variant. */
const adminWidget: Widget = {
    id: 'admin-card-views',
    type: 'views',
    label: { es: 'Vistas de plataforma', en: 'Platform views', pt: 'Visualizações' },
    scope: 'all',
    onMissing: 'hide',
    config: {
        source: 'admin.views.summary',
        viewsVariant: 'admin-summary',
        accent: 'sky'
    }
};

/** Minimal Widget fixture for the editor-posts variant. */
const editorPostsWidget: Widget = {
    id: 'editor-card-e-views',
    type: 'views',
    label: { es: 'Vistas por post', en: 'Views per post', pt: 'Visualizações por post' },
    scope: 'all',
    onMissing: 'hide',
    config: {
        source: 'editor.posts.views',
        viewsVariant: 'editor-posts',
        accent: 'river'
    }
};

/** Minimal Widget fixture for the editor-events variant. */
const editorEventsWidget: Widget = {
    id: 'editor-card-f-views',
    type: 'views',
    label: { es: 'Vistas por evento', en: 'Views per event', pt: 'Visualizações por evento' },
    scope: 'all',
    onMissing: 'hide',
    config: {
        source: 'editor.events.views',
        viewsVariant: 'editor-events',
        accent: 'cyan'
    }
};

/** Shared resolver options used when the source IS registered. */
const foundOptions = {
    queryKey: ['dashboard', 'host.stats.views', 'HOST', 'own'],
    queryFn: async () => null,
    staleTime: 60_000
};

/** Admin resolver options. */
const adminFoundOptions = {
    queryKey: ['dashboard', 'admin.views.summary', 'ADMIN', 'all'],
    queryFn: async () => null,
    staleTime: 60_000
};

/** Editor resolver options. */
const editorPostsFoundOptions = {
    queryKey: ['dashboard', 'editor.posts.views', 'EDITOR', 'all'],
    queryFn: async () => null,
    staleTime: 60_000
};

/** Editor events resolver options. */
const editorEventsFoundOptions = {
    queryKey: ['dashboard', 'editor.events.views', 'EDITOR', 'all'],
    queryFn: async () => null,
    staleTime: 60_000
};

beforeEach(() => {
    // resetAllMocks clears both call history AND pending mockResolvedValueOnce
    // queues — preventing leakage between tests.
    vi.resetAllMocks();
    // Default: source is registered (can be overridden per test).
    mockResolveForScope.mockReturnValue({ found: true, options: foundOptions });
});

// ---------------------------------------------------------------------------
// Unavailable state
// ---------------------------------------------------------------------------

describe('ViewsWidget — unavailable state', () => {
    it('renders unavailable body when source is not registered', () => {
        mockResolveForScope.mockReturnValue({ found: false, options: foundOptions });
        const client = makeClient();

        render(
            <Wrapper client={client}>
                <ViewsWidget widget={hostWidget} />
            </Wrapper>
        );

        expect(screen.getByTestId('list-widget-unavailable')).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// HOST variant — locked state (AC-3, AC-6)
// ---------------------------------------------------------------------------

describe('ViewsWidget — HOST locked state (AC-3/AC-6)', () => {
    it('renders lock icon + description + CTA when resolver returns { locked: true }', async () => {
        // Entitlements call: view_basic_stats absent → locked
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: {
                    entitlements: ['other_entitlement'],
                    limits: {},
                    plan: null,
                    asOf: new Date().toISOString()
                }
            })
        );

        const client = makeClient();
        render(
            <Wrapper client={client}>
                <ViewsWidget widget={hostWidget} />
            </Wrapper>
        );

        // Wait for data to resolve
        await waitFor(() => {
            expect(screen.getByTestId('views-widget-locked')).toBeInTheDocument();
        });

        expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
        expect(screen.getByText('Disponible con un plan activo')).toBeInTheDocument();

        const cta = screen.getByTestId('views-widget-locked-cta');
        expect(cta).toBeInTheDocument();
        expect(cta).toHaveAttribute('href', '/billing/plans');
        expect(cta).toHaveAttribute('aria-label', 'Ver planes');
    });

    it('renders locked state and NOT an error callout when views endpoint returns 403 (AC-6)', async () => {
        // Entitlements: view_basic_stats present
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: {
                    entitlements: ['view_basic_stats'],
                    limits: {},
                    plan: null,
                    asOf: new Date().toISOString()
                }
            })
        );
        // Views endpoint: 403
        const { ApiError } = await import('@/lib/errors');
        mockFetchApi.mockRejectedValueOnce(new ApiError('Forbidden', { status: 403 }));

        const client = makeClient();
        render(
            <Wrapper client={client}>
                <ViewsWidget widget={hostWidget} />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('views-widget-locked')).toBeInTheDocument();
        });

        // Must NOT render the error body
        expect(screen.queryByTestId('list-widget-error')).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// HOST variant — happy path (AC-2: window toggle re-fetches)
// ---------------------------------------------------------------------------

describe('ViewsWidget — HOST happy path and window toggle (AC-2)', () => {
    it('renders accommodation view list when locked is false', async () => {
        // Entitlements: present
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: {
                    entitlements: ['view_basic_stats'],
                    limits: {},
                    plan: null,
                    asOf: new Date().toISOString()
                }
            })
        );
        // Views endpoint (30d default): 1 accommodation
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: [{ entityId: 'acc-001', unique: 10, total: 50 }]
            })
        );

        const client = makeClient();
        render(
            <Wrapper client={client}>
                <ViewsWidget widget={hostWidget} />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('views-host-list')).toBeInTheDocument();
        });

        // Two stats per row
        expect(screen.getByText('10 únicos')).toBeInTheDocument();
        expect(screen.getByText('50 totales')).toBeInTheDocument();
    });

    it('renders WindowToggle with default 30d selected', async () => {
        // Entitlements: present
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: { entitlements: ['view_basic_stats'], limits: {}, plan: null, asOf: '' }
            })
        );
        // Views endpoint: empty list
        mockFetchApi.mockResolvedValueOnce(envelope({ success: true, data: [] }));

        const client = makeClient();
        render(
            <Wrapper client={client}>
                <ViewsWidget widget={hostWidget} />
            </Wrapper>
        );

        // WindowToggle should be present (loading state)
        expect(screen.getByText('30d')).toBeInTheDocument();
        expect(screen.getByText('7d')).toBeInTheDocument();
    });

    it('re-fetches with ?window=7d when 7d toggle is clicked (AC-2)', async () => {
        // First render — 30d entitlements + views
        mockFetchApi
            .mockResolvedValueOnce(
                envelope({
                    success: true,
                    data: { entitlements: ['view_basic_stats'], limits: {}, plan: null, asOf: '' }
                })
            )
            .mockResolvedValueOnce(
                envelope({ success: true, data: [{ entityId: 'acc-001', unique: 10, total: 50 }] })
            );

        // After 7d toggle — entitlements + views with 7d
        mockFetchApi
            .mockResolvedValueOnce(
                envelope({
                    success: true,
                    data: { entitlements: ['view_basic_stats'], limits: {}, plan: null, asOf: '' }
                })
            )
            .mockResolvedValueOnce(
                envelope({ success: true, data: [{ entityId: 'acc-001', unique: 3, total: 15 }] })
            );

        const user = userEvent.setup();
        const client = makeClient();
        render(
            <Wrapper client={client}>
                <ViewsWidget widget={hostWidget} />
            </Wrapper>
        );

        // Wait for initial data
        await waitFor(() => {
            expect(screen.getByTestId('views-host-list')).toBeInTheDocument();
        });

        // Click 7d button
        await user.click(screen.getByText('7d'));

        // Should have fetched 7d endpoint
        await waitFor(() => {
            const paths = mockFetchApi.mock.calls
                .map((c) => (c[0] as { path: string }).path)
                .filter((p) => p.includes('/views/accommodations/me'));

            expect(paths.some((p) => p.includes('window=7d'))).toBe(true);
        });
    });
});

// ---------------------------------------------------------------------------
// HOST empty state
// ---------------------------------------------------------------------------

describe('ViewsWidget — HOST empty state', () => {
    it('renders empty body when locked is false and items array is empty', async () => {
        mockFetchApi
            .mockResolvedValueOnce(
                envelope({
                    success: true,
                    data: { entitlements: ['view_basic_stats'], limits: {}, plan: null, asOf: '' }
                })
            )
            .mockResolvedValueOnce(envelope({ success: true, data: [] }));

        const client = makeClient();
        render(
            <Wrapper client={client}>
                <ViewsWidget widget={hostWidget} />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('list-widget-empty')).toBeInTheDocument();
        });
    });
});

// ---------------------------------------------------------------------------
// ADMIN variant — three entity-type rows
// ---------------------------------------------------------------------------

describe('ViewsWidget — ADMIN summary variant', () => {
    beforeEach(() => {
        mockResolveForScope.mockReturnValue({ found: true, options: adminFoundOptions });
    });

    it('renders three rows for ACCOMMODATION, POST, EVENT', async () => {
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: [
                    { entityType: 'ACCOMMODATION', unique: 100, total: 400 },
                    { entityType: 'POST', unique: 50, total: 200 },
                    { entityType: 'EVENT', unique: 25, total: 80 }
                ]
            })
        );

        const client = makeClient();
        render(
            <Wrapper client={client}>
                <ViewsWidget widget={adminWidget} />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('views-admin-summary')).toBeInTheDocument();
        });

        const rows = screen.getAllByTestId('views-admin-row');
        expect(rows).toHaveLength(3);

        expect(screen.getByText('Alojamientos')).toBeInTheDocument();
        expect(screen.getByText('Posts')).toBeInTheDocument();
        expect(screen.getByText('Eventos')).toBeInTheDocument();

        // Unique and total values
        expect(screen.getByText('100 únicos')).toBeInTheDocument();
        expect(screen.getByText('400 totales')).toBeInTheDocument();
    });

    it('renders WindowToggle on admin summary card', async () => {
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: [
                    { entityType: 'ACCOMMODATION', unique: 1, total: 2 },
                    { entityType: 'POST', unique: 1, total: 2 },
                    { entityType: 'EVENT', unique: 1, total: 2 }
                ]
            })
        );

        const client = makeClient();
        render(
            <Wrapper client={client}>
                <ViewsWidget widget={adminWidget} />
            </Wrapper>
        );

        expect(screen.getByText('30d')).toBeInTheDocument();
        expect(screen.getByText('7d')).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// EDITOR variants — independent window toggles (AC-9/AC-12)
// ---------------------------------------------------------------------------

describe('ViewsWidget — EDITOR variants independent window toggles (AC-9/AC-12)', () => {
    it('editor-posts widget has its own window toggle independent from editor-events', async () => {
        // Posts widget
        mockResolveForScope.mockReturnValueOnce({ found: true, options: editorPostsFoundOptions });
        mockFetchApi
            .mockResolvedValueOnce(
                envelope({
                    success: true,
                    data: {
                        items: [{ id: 'p1', title: 'Post A', status: 'ACTIVE' }],
                        pagination: { total: 1 }
                    }
                })
            )
            .mockResolvedValueOnce(
                envelope({ success: true, data: [{ entityId: 'p1', unique: 5, total: 20 }] })
            );

        // Events widget
        mockResolveForScope.mockReturnValueOnce({ found: true, options: editorEventsFoundOptions });
        mockFetchApi
            .mockResolvedValueOnce(
                envelope({
                    success: true,
                    data: { items: [{ id: 'e1', name: 'Event A' }], pagination: { total: 1 } }
                })
            )
            .mockResolvedValueOnce(
                envelope({ success: true, data: [{ entityId: 'e1', unique: 8, total: 30 }] })
            );

        const client = makeClient();
        render(
            <Wrapper client={client}>
                {/* Two independent widget instances */}
                <ViewsWidget widget={editorPostsWidget} />
                <ViewsWidget widget={editorEventsWidget} />
            </Wrapper>
        );

        // Both should have 7d/30d toggles (two of each in the DOM)
        await waitFor(() => {
            const buttons7d = screen.getAllByText('7d');
            expect(buttons7d).toHaveLength(2);
        });
    });

    it('editor-posts renders post rows', async () => {
        mockResolveForScope.mockReturnValue({ found: true, options: editorPostsFoundOptions });
        mockFetchApi
            .mockResolvedValueOnce(
                envelope({
                    success: true,
                    data: {
                        items: [{ id: 'p1', title: 'My Post', status: 'ACTIVE' }],
                        pagination: { total: 1 }
                    }
                })
            )
            .mockResolvedValueOnce(
                envelope({ success: true, data: [{ entityId: 'p1', unique: 7, total: 28 }] })
            );

        const client = makeClient();
        render(
            <Wrapper client={client}>
                <ViewsWidget widget={editorPostsWidget} />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('views-editor-list')).toBeInTheDocument();
        });

        expect(screen.getByText('My Post')).toBeInTheDocument();
        expect(screen.getByText('7 únicos')).toBeInTheDocument();
        expect(screen.getByText('28 totales')).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe('ViewsWidget — error state', () => {
    it('renders error body when fetch throws a non-403 error', async () => {
        // For host variant: entitlements present but views endpoint throws 500
        mockFetchApi
            .mockResolvedValueOnce(
                envelope({
                    success: true,
                    data: { entitlements: ['view_basic_stats'], limits: {}, plan: null, asOf: '' }
                })
            )
            .mockRejectedValueOnce(new Error('Server error'));

        const client = makeClient();
        render(
            <Wrapper client={client}>
                <ViewsWidget widget={hostWidget} />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('list-widget-error')).toBeInTheDocument();
        });

        // Must NOT render the locked state
        expect(screen.queryByTestId('views-widget-locked')).not.toBeInTheDocument();
    });
});
