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
        it('emits 6 per-entity kpis (4 content + tourists + owners; no attractions)', async () => {
            // Mock returns pagination.total=7 for the 4 content entities AND the
            // users/stats fetch (no byRole → tourists=0, owners=0). Sum = 28.
            mockFetchApi.mockResolvedValue(
                envelope({ success: true, data: { items: [], pagination: { total: 7 } } })
            );

            const result = (await runSource('admin.entities.counts')) as {
                value: number;
                kpis: ReadonlyArray<{ key: string; value: number; href: string }>;
            };

            // 4 content (4×7=28) + tourists 0 + owners 0 = 28.
            expect(result.value).toBe(28);
            expect(result.kpis).toHaveLength(6);
            expect(result.kpis.map((k) => k.key)).toEqual([
                'accommodations',
                'destinations',
                'events',
                'posts',
                'tourists',
                'owners'
            ]);
            // No attractions tile any more (dropped per owner feedback).
            expect(result.kpis.find((k) => k.key === 'attractions')).toBeUndefined();
            expect(result.kpis[0]).toMatchObject({ value: 7, href: '/accommodations' });
            // Tourists + owners both link to the users admin list.
            expect(result.kpis.find((k) => k.key === 'tourists')?.href).toBe('/access/users');
            expect(result.kpis.find((k) => k.key === 'owners')?.href).toBe('/access/users');
        });

        it('splits users into tourists (USER+GUEST) and owners (HOST) from byRole', async () => {
            // The users/stats fetch returns byRole; the content fetches return
            // pagination.total. The implementation issues a single fetchApi mock,
            // so we vary the response by URL.
            mockFetchApi.mockImplementation(async ({ path }: { path: string }) => {
                if (path.includes('/users/stats')) {
                    return envelope({
                        success: true,
                        data: { byRole: { USER: 5, GUEST: 2, HOST: 38 } }
                    });
                }
                return envelope({
                    success: true,
                    data: { items: [], pagination: { total: 10 } }
                });
            });

            const result = (await runSource('admin.entities.counts')) as {
                value: number;
                kpis: ReadonlyArray<{ key: string; value: number }>;
            };

            // tourists = USER(5) + GUEST(2) = 7; owners = HOST(38).
            expect(result.kpis.find((k) => k.key === 'tourists')?.value).toBe(7);
            expect(result.kpis.find((k) => k.key === 'owners')?.value).toBe(38);
            // total = 4*10 + 7 + 38 = 85.
            expect(result.value).toBe(85);
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
        it('emits 4 named editorial kpis from pagination totals (not a mixed list)', async () => {
            mockFetchApi.mockResolvedValue(
                envelope({
                    success: true,
                    data: { items: [], pagination: { total: 7 } }
                })
            );

            const result = (await runSource('admin.editorial.summary')) as {
                value: number;
                kpis: ReadonlyArray<{ key: string; value: number; href: string }>;
            };

            // 4 metrics × 7 = 28.
            expect(result.value).toBe(28);
            expect(result.kpis).toHaveLength(4);
            expect(result.kpis.map((k) => k.key)).toEqual([
                'featuredEvents',
                'postsThisMonth',
                'draftPosts',
                'draftEvents'
            ]);
            // No legacy routes; events/posts links resolve to the real lists.
            expect(
                result.kpis.every(
                    (k) => !k.href.includes('/catalogo/') && !k.href.includes('/contenido/')
                )
            ).toBe(true);
            expect(result.kpis.find((k) => k.key === 'featuredEvents')?.href).toBe('/events');
            expect(result.kpis.find((k) => k.key === 'draftPosts')?.href).toBe('/posts');
        });
    });

    // ── Card D — admin.crons.list ───────────────────────────────────────────
    describe('admin.crons.list (card D)', () => {
        /** Mocks the enriched GET /api/v1/admin/cron response (SPEC-161). */
        const mockCronJobs = (jobs: ReadonlyArray<Record<string, unknown>>) => {
            mockFetchApi.mockResolvedValue(
                envelope({
                    success: true,
                    data: { jobs, enabledJobs: jobs.length, totalJobs: jobs.length }
                })
            );
        };

        const job = (over: Record<string, unknown>) => ({
            name: 'dunning',
            displayName: 'Reintentos de cobro',
            category: 'billing',
            description: 'desc',
            schedule: '0 6 * * *',
            scheduleHuman: 'A las 06:00',
            enabled: true,
            nextRunAt: '2026-05-30T06:00:00Z',
            lastRun: null,
            ...over
        });

        it('maps each job to friendly name, category group, status badge and meta lines', async () => {
            mockCronJobs([
                job({
                    name: 'dunning',
                    lastRun: { status: 'success', finishedAt: '2026-05-29T06:00:00Z' }
                })
            ]);

            const result = (await runSource('admin.crons.list')) as ReadonlyArray<{
                id: string;
                label: string;
                group: string;
                statusBadge: { label: string; variant: string };
                metaLines: ReadonlyArray<{ key: string; content: string }>;
            }>;

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                id: 'dunning',
                label: 'Reintentos de cobro',
                group: 'Facturación',
                statusBadge: { variant: 'success' }
            });
            const keys = result[0]?.metaLines.map((l) => l.key);
            expect(keys).toEqual(['sched', 'last', 'next']);
            expect(mockFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({ path: '/api/v1/admin/cron' })
            );
        });

        it('marks jobs without a recorded run as neutral with "Sin corridas aún"', async () => {
            mockCronJobs([job({ name: 'never-ran', lastRun: null, nextRunAt: null })]);

            const result = (await runSource('admin.crons.list')) as ReadonlyArray<{
                statusBadge: { label: string; variant: string };
                metaLines: ReadonlyArray<{ key: string; content: string }>;
            }>;

            expect(result[0]?.statusBadge).toMatchObject({ variant: 'neutral' });
            expect(result[0]?.metaLines.find((l) => l.key === 'last')?.content).toBe(
                'Sin corridas aún'
            );
            // nextRunAt null → no "next" line.
            expect(result[0]?.metaLines.find((l) => l.key === 'next')).toBeUndefined();
        });

        it('orders by category, then failing-first within a category', async () => {
            mockCronJobs([
                job({
                    name: 'sys-ok',
                    category: 'system',
                    lastRun: { status: 'success', finishedAt: '2026-05-29T00:00:00Z' }
                }),
                job({
                    name: 'bill-ok',
                    category: 'billing',
                    lastRun: { status: 'success', finishedAt: '2026-05-29T00:00:00Z' }
                }),
                job({
                    name: 'bill-failed',
                    category: 'billing',
                    lastRun: { status: 'failed', finishedAt: '2026-05-29T00:00:00Z' }
                })
            ]);

            const result = (await runSource('admin.crons.list')) as ReadonlyArray<{ id: string }>;

            // billing before system; within billing, failed before success.
            expect(result.map((r) => r.id)).toEqual(['bill-failed', 'bill-ok', 'sys-ok']);
        });
    });

    // ── Card E — admin.system.health ────────────────────────────────────────
    describe('admin.system.health (card E)', () => {
        it('emits 3 chips (api/db/redis) + a metrics row (uptime, requests, …)', async () => {
            mockFetchApi.mockImplementation(async ({ path }: { path: string }) => {
                if (path.includes('/system/health')) {
                    return envelope({
                        success: true,
                        data: {
                            status: 'up',
                            db: 'connected',
                            redis: 'connected',
                            uptime: 3600
                        }
                    });
                }
                if (path.includes('/admin/metrics')) {
                    return envelope({
                        success: true,
                        data: {
                            summary: {
                                totalRequests: 884,
                                totalErrors: 0,
                                globalErrorRate: 0,
                                activeConnections: 1
                            }
                        }
                    });
                }
                return envelope({ success: true, data: {} });
            });

            const result = (await runSource('admin.system.health')) as {
                status: string;
                items: ReadonlyArray<{ key: string; status: string }>;
                metrics?: {
                    uptime?: number;
                    activeConnections?: number;
                    totalRequests?: number;
                    errorRate?: number;
                };
            };

            expect(result.status).toBe('up');
            // 3 sub-systems, all up.
            expect(result.items.map((i) => i.key)).toEqual(['api', 'db', 'redis']);
            // Metrics: uptime from health + summary from metrics.
            expect(result.metrics?.uptime).toBe(3600);
            expect(result.metrics?.totalRequests).toBe(884);
            expect(result.metrics?.activeConnections).toBe(1);
            expect(result.metrics?.errorRate).toBe(0);
            // Must use the admin endpoint (has CORS), NOT the root /health.
            expect(mockFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({ path: '/api/v1/admin/system/health' })
            );
            expect(mockFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({ path: '/api/v1/admin/metrics' })
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
        it('emits per-entity kpis (mini-grid) from byEntity', async () => {
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
                kpis: ReadonlyArray<{ key: string; value: number; href: string }>;
            };

            expect(result.value).toBe(3);
            expect(result.kpis).toHaveLength(4);
            expect(result.kpis.find((k) => k.key === 'accommodations')?.value).toBe(1);
            expect(result.kpis.find((k) => k.key === 'destinations')?.value).toBe(2);
            expect(result.kpis.find((k) => k.key === 'accommodations')?.href).toBe(
                '/accommodations'
            );
        });
    });

    // ── Card G — admin.users.stats ──────────────────────────────────────────
    describe('admin.users.stats (card G)', () => {
        it('filters platform roles, relabels in es, and sorts desc by value', async () => {
            mockFetchApi.mockResolvedValue(
                envelope({
                    success: true,
                    data: {
                        byRole: {
                            HOST: 38,
                            ADMIN: 2,
                            SYSTEM: 1,
                            SPONSOR: 1,
                            CLIENT_MANAGER: 3
                        },
                        newUsersTrend: []
                    }
                })
            );

            const result = (await runSource('admin.users.stats')) as {
                series: ReadonlyArray<{ label: string; value: number }>;
            };

            // SYSTEM / SPONSOR / CLIENT_MANAGER are filtered out by config.
            expect(result.series).toHaveLength(2);
            // Relabeled to Spanish + sorted descending.
            expect(result.series).toEqual([
                { label: 'Anfitriones', value: 38 },
                { label: 'Admins', value: 2 }
            ]);
        });
    });

    // ── Card I — super.billing.stats ────────────────────────────────────────
    describe('super.billing.stats (card I)', () => {
        it('emits 5 billing kpis from the nested overview object', async () => {
            mockFetchApi.mockResolvedValue(
                envelope({
                    success: true,
                    data: {
                        overview: {
                            activeSubscriptions: 5,
                            trialingSubscriptions: 2,
                            mrr: 100000,
                            churnRate: 0.025,
                            totalCustomers: 12
                        },
                        revenueTimeSeries: [],
                        subscriptionBreakdown: []
                    }
                })
            );

            const result = (await runSource('super.billing.stats')) as {
                value: number;
                kpis: ReadonlyArray<{
                    key: string;
                    value: number;
                    unitPrefix?: string;
                    unitSuffix?: string;
                }>;
            };

            expect(result.value).toBe(5);
            expect(result.kpis).toHaveLength(5);
            expect(result.kpis.find((k) => k.key === 'activeSubs')?.value).toBe(5);
            expect(result.kpis.find((k) => k.key === 'trialingSubs')?.value).toBe(2);
            // MRR converted from centavos (100000 → 1000 pesos), with $ prefix.
            const mrrKpi = result.kpis.find((k) => k.key === 'mrr');
            expect(mrrKpi?.value).toBe(1000);
            expect(mrrKpi?.unitPrefix).toBe('$');
            // Churn 0.025 → 2.5% with suffix.
            const churnKpi = result.kpis.find((k) => k.key === 'churn');
            expect(churnKpi?.value).toBe(2.5);
            expect(churnKpi?.unitSuffix).toBe('%');
        });

        it('returns null when overview is missing (renders empty, not 0)', async () => {
            mockFetchApi.mockResolvedValue(envelope({ success: true, data: {} }));
            const result = await runSource('super.billing.stats');
            expect(result).toBeNull();
        });
    });
});
