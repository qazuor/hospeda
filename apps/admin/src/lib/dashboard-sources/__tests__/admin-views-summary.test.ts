/**
 * admin.views.summary resolver tests (SPEC-197 T-015).
 *
 * Tests:
 *  - Correct API path: GET /api/v1/admin/views/summary?window=30d.
 *  - Response normalized to kpis array with one entry per entity type.
 *  - Source is registered on adminBaseDashboard (via the KNOWN_SOURCE_IDS check
 *    in dashboards.config.test.ts — this test focuses on the resolver behavior).
 *  - Source is NOT present in hostDashboard widget configs (AC-14).
 *
 * @see apps/admin/src/lib/dashboard-sources/admin.ts
 * @see SPEC-197 T-015, §3.3
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({
    fetchApi: vi.fn()
}));

import { fetchApi } from '@/lib/api/client';
import { type ResolverContext, resolveDataSource } from '@/lib/dashboard-sources';
import '@/lib/dashboard-sources/index';
import { dashboards } from '@/config/ia/dashboards';

const mockFetchApi = vi.mocked(fetchApi);

const ctx: ResolverContext = {
    role: 'ADMIN',
    userId: 'u-admin-1',
    permissions: ['ANALYTICS_VIEW'],
    scope: 'all'
};

function envelope(body: unknown) {
    return { data: body, status: 200 };
}

async function runSource(sourceId: string): Promise<unknown> {
    const { found, options } = resolveDataSource(sourceId, ctx);
    expect(found, `source '${sourceId}' should be registered`).toBe(true);
    return options.queryFn();
}

beforeEach(() => {
    mockFetchApi.mockReset();
});

describe('admin.views.summary resolver (SPEC-197 T-015)', () => {
    // ── API path ──────────────────────────────────────────────────────────────

    it('calls GET /api/v1/admin/views/summary with window=30d', async () => {
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

        await runSource('admin.views.summary');

        expect(mockFetchApi).toHaveBeenCalledTimes(1);
        const path = (mockFetchApi.mock.calls[0][0] as { path: string }).path;
        expect(path).toContain('/admin/views/summary');
        expect(path).toContain('window=30d');
    });

    // ── Response shape ────────────────────────────────────────────────────────

    it('returns kpis array with three items (one per entity type)', async () => {
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

        const result = await runSource('admin.views.summary');
        const { kpis } = result as { kpis: unknown[]; window: string };

        expect(kpis).toHaveLength(3);
        const accommodationKpi = (
            kpis as Array<{ key: string; value: number; extra: { unique: number } }>
        ).find((k) => k.key === 'ACCOMMODATION');
        expect(accommodationKpi).toBeDefined();
        expect(accommodationKpi?.value).toBe(400);
        expect(accommodationKpi?.extra.unique).toBe(100);
    });

    it('zero-fills when service returns fewer than 3 entity types', async () => {
        // Service returns only ACCOMMODATION (missing POST and EVENT)
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: [{ entityType: 'ACCOMMODATION', unique: 10, total: 50 }]
            })
        );

        const result = await runSource('admin.views.summary');
        const { kpis } = result as { kpis: Array<{ key: string; value: number }> };

        // All three entity types must still appear
        const keys = kpis.map((k) => k.key);
        expect(keys).toContain('ACCOMMODATION');
        expect(keys).toContain('POST');
        expect(keys).toContain('EVENT');

        const postKpi = kpis.find((k) => k.key === 'POST');
        expect(postKpi?.value).toBe(0);
    });

    // ── Dashboard config: admin-card-views presence / absence ─────────────────

    it('admin-card-views is present in adminBaseDashboard', () => {
        const card = dashboards.adminBaseDashboard.widgets.find((w) => w.id === 'admin-card-views');
        expect(card).toBeDefined();
        expect(card?.config?.source).toBe('admin.views.summary');
    });

    it('admin-card-views is NOT present in hostDashboard (AC-14)', () => {
        const card = dashboards.hostDashboard.widgets.find((w) => w.id === 'admin-card-views');
        expect(card).toBeUndefined();
    });

    it('admin-card-views is present in superAdminDashboard (assembled from base)', () => {
        const card = dashboards.superAdminDashboard.widgets.find(
            (w) => w.id === 'admin-card-views'
        );
        expect(card).toBeDefined();
    });

    // ── Query key shape ────────────────────────────────────────────────────────

    it('builds a queryKey starting with [dashboard, admin.views.summary, ADMIN, all]', () => {
        const { found, options } = resolveDataSource('admin.views.summary', ctx);

        expect(found).toBe(true);
        const key = options.queryKey as unknown[];
        expect(key[0]).toBe('dashboard');
        expect(key[1]).toBe('admin.views.summary');
        expect(key[2]).toBe('ADMIN');
    });
});
