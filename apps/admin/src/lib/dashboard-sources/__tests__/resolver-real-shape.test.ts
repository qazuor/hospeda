/**
 * Resolver real-endpoint-shape tests (SPEC-155 follow-up).
 *
 * WHY THIS FILE EXISTS:
 * The original SPEC-155 tests (resolver-widget-integration.test.tsx) stubbed the
 * resolver's *already-normalized* output and fed it to the widget. They proved
 * "given shape X, the widget renders Y" — but NOT "the resolver actually reads
 * the real endpoint body correctly". That gap let several resolvers ship reading
 * the wrong field (`data.data` instead of `data.items`) or the wrong route
 * (`/api/v1/health`, `/admin/cron-jobs`), so the cards rendered empty/errored
 * against the live API while every unit test stayed green.
 *
 * These tests mock `fetchApi` at its OUTPUT boundary with the SHAPE THE REAL
 * ENDPOINTS RETURN (captured from the running API) and assert each resolver's
 * `queryFn` normalizes it to the contract the widget expects. This is the
 * cross-layer check the per-layer mocks were missing.
 *
 * Real shapes captured 2026-05-27 from the local API:
 *   - list endpoints:            { success, data: { items: [...], pagination: { total } } }
 *   - GET /api/v1/admin/system/health: { success, data: { status, db, redis } }
 *   - GET /api/v1/admin/cron:    { success, data: { jobs, enabledJobs, totalJobs } }
 *   - moderation/pending-count:  { success, data: { total, byEntity: {...} } }
 *   - users/stats:               { success, data: { byRole, newUsersTrend } }
 *   - billing/metrics:           { success, data: { overview: {...}, revenueTimeSeries, subscriptionBreakdown } }
 *
 * @see apps/admin/src/lib/dashboard-sources/admin.ts
 * @see apps/admin/src/lib/dashboard-sources/super.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetchApi BEFORE importing the resolver modules (vi.mock is hoisted).
vi.mock('@/lib/api/client', () => ({
    fetchApi: vi.fn()
}));

import { fetchApi } from '@/lib/api/client';
import { type ResolverContext, resolveDataSource } from '@/lib/dashboard-sources';
// Side-effect import: registers host/editor/admin/super sources into the registry.
import '@/lib/dashboard-sources/index';

const mockFetchApi = vi.mocked(fetchApi);

/** SUPER_ADMIN context — sees the full admin base + super-only sources. */
const ctx: ResolverContext = {
    role: 'SUPER_ADMIN',
    userId: 'u-super',
    permissions: [],
    scope: 'all'
};

/** Wraps a raw endpoint body in the `fetchApi` output envelope `{ data, status }`. */
function envelope(body: unknown) {
    return { data: body, status: 200 };
}

/** Resolves a source and runs its queryFn, asserting it is registered. */
async function runSource(sourceId: string): Promise<unknown> {
    const { found, options } = resolveDataSource(sourceId, ctx);
    expect(found).toBe(true);
    return options.queryFn();
}

beforeEach(() => {
    mockFetchApi.mockReset();
});

describe('resolver real-shape contract', () => {
    // ── Card A — admin.entities.counts ──────────────────────────────────────
    describe('admin.entities.counts (card A)', () => {
        it('reads pagination.total and emits 6 per-entity kpis (not the sum)', async () => {
            // Every entity endpoint returns total=7 → 6 tiles, sum 42.
            mockFetchApi.mockResolvedValue(
                envelope({ success: true, data: { items: [], pagination: { total: 7 } } })
            );

            const result = (await runSource('admin.entities.counts')) as {
                value: number;
                kpis: ReadonlyArray<{ key: string; value: number; href: string }>;
            };

            expect(result.value).toBe(42);
            expect(result.kpis).toHaveLength(6);
            expect(result.kpis.map((k) => k.key)).toEqual([
                'accommodations',
                'destinations',
                'events',
                'posts',
                'attractions',
                'users'
            ]);
            // Each tile carries its real admin-list route.
            expect(result.kpis[0]).toMatchObject({ value: 7, href: '/accommodations' });
            expect(result.kpis.find((k) => k.key === 'attractions')?.href).toBe(
                '/content/destination-attractions'
            );
            expect(result.kpis.find((k) => k.key === 'users')?.href).toBe('/access/users');
        });
    });

    // ── Card B — admin.accommodations.latest ────────────────────────────────
    describe('admin.accommodations.latest (card B)', () => {
        it('reads rows from data.items (NOT data.data) and uses the real route', async () => {
            mockFetchApi.mockResolvedValue(
                envelope({
                    success: true,
                    data: {
                        items: [
                            { id: 'a1', name: 'Cabaña del Sol', status: 'ACTIVE' },
                            { id: 'a2', name: 'Hotel Litoral', status: 'ACTIVE' }
                        ],
                        pagination: { total: 2 }
                    }
                })
            );

            const result = (await runSource('admin.accommodations.latest')) as ReadonlyArray<{
                id: string;
                label: string;
                href: string;
            }>;

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                id: 'a1',
                label: 'Cabaña del Sol',
                href: '/accommodations/a1'
            });
            // Old broken route must be gone.
            expect(result[0].href).not.toContain('/catalogo/');
            // Uses the valid `field:desc` sort format — the old `field_desc`
            // returned HTTP 400 and left the card empty.
            const path = (mockFetchApi.mock.calls[0][0] as { path: string }).path;
            expect(path).toContain('sort=createdAt:desc');
            expect(path).not.toContain('_desc');
        });

        it('returns an empty list (not a crash) when items is absent', async () => {
            mockFetchApi.mockResolvedValue(
                envelope({ success: true, data: { pagination: { total: 0 } } })
            );
            const result = (await runSource(
                'admin.accommodations.latest'
            )) as ReadonlyArray<unknown>;
            expect(result).toEqual([]);
        });
    });

    // ── Card C — admin.editorial.summary ────────────────────────────────────
    describe('admin.editorial.summary (card C)', () => {
        it('reads data.items across its parallel fetches and uses real routes', async () => {
            mockFetchApi.mockResolvedValue(
                envelope({
                    success: true,
                    data: {
                        items: [
                            { id: 'x1', title: 'Cosa', status: 'ACTIVE', startDate: '2026-06-01' }
                        ],
                        pagination: { total: 5 }
                    }
                })
            );

            const result = (await runSource('admin.editorial.summary')) as ReadonlyArray<{
                href: string;
            }>;

            expect(result.length).toBeGreaterThan(0);
            expect(result.some((i) => i.href.startsWith('/events/'))).toBe(true);
            expect(result.some((i) => i.href.startsWith('/posts/'))).toBe(true);
            // No legacy routes anywhere.
            expect(
                result.every(
                    (i) => !i.href.includes('/catalogo/') && !i.href.includes('/contenido/')
                )
            ).toBe(true);
            // No fetch uses the invalid `field_desc` sort format (HTTP 400). A single
            // rejected query rejects the whole Promise.all and empties the card.
            const calledPaths = mockFetchApi.mock.calls.map((c) => (c[0] as { path: string }).path);
            expect(calledPaths.some((p) => p.includes('sort=updatedAt:desc'))).toBe(true);
            expect(calledPaths.every((p) => !p.includes('_desc'))).toBe(true);
        });
    });

    // ── Card D — admin.crons.list ───────────────────────────────────────────
    describe('admin.crons.list (card D)', () => {
        it('calls /api/v1/admin/cron and reads data.jobs', async () => {
            mockFetchApi.mockResolvedValue(
                envelope({
                    success: true,
                    data: {
                        jobs: [{ id: 'c1', name: 'dunning', enabled: true, schedule: '0 0 * * *' }],
                        enabledJobs: 1,
                        totalJobs: 1
                    }
                })
            );

            const result = (await runSource('admin.crons.list')) as ReadonlyArray<{
                id: string;
                label: string;
                badge: string;
            }>;

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({ id: 'c1', label: 'dunning', badge: 'activo' });
            expect(mockFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({ path: '/api/v1/admin/cron' })
            );
        });
    });

    // ── Card E — admin.system.health ────────────────────────────────────────
    describe('admin.system.health (card E)', () => {
        it('calls the CORS-enabled admin endpoint and reads the rolled-up status', async () => {
            mockFetchApi.mockResolvedValue(
                envelope({
                    success: true,
                    data: { status: 'up', db: 'connected', redis: 'connected' }
                })
            );

            const result = (await runSource('admin.system.health')) as {
                status: string;
                description: string;
            };

            expect(result.status).toBe('up');
            expect(result.description).toContain('connected');
            // Must use the admin endpoint (has CORS), NOT the root /health (blocked).
            expect(mockFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({ path: '/api/v1/admin/system/health' })
            );
        });

        it('returns null when the envelope has no data (renders empty, not crash)', async () => {
            mockFetchApi.mockResolvedValue(envelope({ success: true }));
            const result = await runSource('admin.system.health');
            expect(result).toBeNull();
        });
    });

    // ── Card F — admin.moderation.pending ───────────────────────────────────
    describe('admin.moderation.pending (card F)', () => {
        it('reads total + nested byEntity breakdown', async () => {
            mockFetchApi.mockResolvedValue(
                envelope({
                    success: true,
                    data: {
                        total: 3,
                        byEntity: { accommodations: 1, destinations: 2, posts: 0, events: 0 }
                    }
                })
            );

            const result = (await runSource('admin.moderation.pending')) as {
                value: number;
                breakdown: Record<string, number>;
            };

            expect(result.value).toBe(3);
            expect(result.breakdown).toMatchObject({ accommodations: 1, destinations: 2 });
        });
    });

    // ── Card G — admin.users.stats ──────────────────────────────────────────
    describe('admin.users.stats (card G)', () => {
        it('reads data.byRole into chart series', async () => {
            mockFetchApi.mockResolvedValue(
                envelope({
                    success: true,
                    data: { byRole: { HOST: 38, ADMIN: 2 }, newUsersTrend: [] }
                })
            );

            const result = (await runSource('admin.users.stats')) as {
                series: ReadonlyArray<{ label: string; value: number }>;
            };

            expect(result.series).toEqual(
                expect.arrayContaining([
                    { label: 'HOST', value: 38 },
                    { label: 'ADMIN', value: 2 }
                ])
            );
        });
    });

    // ── Card I — super.billing.stats ────────────────────────────────────────
    describe('super.billing.stats (card I)', () => {
        it('reads activeSubscriptions from the nested overview object', async () => {
            mockFetchApi.mockResolvedValue(
                envelope({
                    success: true,
                    data: {
                        overview: { activeSubscriptions: 5, mrr: 100000, churnRate: 0 },
                        revenueTimeSeries: [],
                        subscriptionBreakdown: []
                    }
                })
            );

            const result = (await runSource('super.billing.stats')) as { value: number };
            expect(result.value).toBe(5);
        });

        it('returns null when overview is missing (renders empty, not 0)', async () => {
            mockFetchApi.mockResolvedValue(envelope({ success: true, data: {} }));
            const result = await runSource('super.billing.stats');
            expect(result).toBeNull();
        });
    });
});
