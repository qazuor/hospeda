/**
 * host.stats.views — locked-state and happy-path resolver tests (SPEC-197 T-013).
 *
 * Tests the proactive entitlement-check logic:
 *  - Entitlements WITHOUT view_basic_stats → { locked: true } and NO views fetch.
 *  - Entitlements WITH view_basic_stats → fetch views endpoint with correct path.
 *  - Views endpoint returns 403 → locked fallback (AC-6).
 *
 * @see apps/admin/src/lib/dashboard-sources/host.ts
 * @see SPEC-197 T-013, §5.2
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetchApi BEFORE importing resolver modules (vi.mock is hoisted).
vi.mock('@/lib/api/client', () => ({
    fetchApi: vi.fn()
}));

// Mock ApiError — matches real signature: (message: string, config: { status: number, ... })
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

import { fetchApi } from '@/lib/api/client';
import { type ResolverContext, resolveDataSource } from '@/lib/dashboard-sources';
import { ApiError } from '@/lib/errors';
// Side-effect: registers host sources into the registry.
import '@/lib/dashboard-sources/index';

const mockFetchApi = vi.mocked(fetchApi);

/** HOST context. */
const ctx: ResolverContext = {
    role: 'HOST',
    userId: 'u-host-1',
    permissions: ['ACCOMMODATION_VIEW_OWN'],
    scope: 'own'
};

/** Wraps a raw endpoint body in the fetchApi output envelope `{ data, status }`. */
function envelope(body: unknown) {
    return { data: body, status: 200 };
}

/** Resolves the source and runs its queryFn, asserting it is registered. */
async function runSource(sourceId: string): Promise<unknown> {
    const { found, options } = resolveDataSource(sourceId, ctx);
    expect(found, `source '${sourceId}' should be registered`).toBe(true);
    return options.queryFn();
}

beforeEach(() => {
    mockFetchApi.mockReset();
});

describe('host.stats.views resolver (SPEC-197 T-013)', () => {
    // ── Locked state: missing entitlement ─────────────────────────────────────

    it('returns { locked: true } when view_basic_stats is absent and does NOT call the views endpoint', async () => {
        // Entitlements response without view_basic_stats
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: {
                    entitlements: ['other_entitlement', 'create_promotions'],
                    limits: {},
                    plan: { slug: 'basic', name: 'Basic', status: 'active' },
                    asOf: new Date().toISOString()
                }
            })
        );

        const result = await runSource('host.stats.views');

        // Must return locked: true
        expect(result).toEqual({ locked: true });

        // Must NOT have called the views endpoint — only one call (entitlements)
        expect(mockFetchApi).toHaveBeenCalledTimes(1);
        expect((mockFetchApi.mock.calls[0][0] as { path: string }).path).toContain('/entitlements');
    });

    // ── Happy path: entitlement present ───────────────────────────────────────

    it('calls the views endpoint with correct path when view_basic_stats IS present', async () => {
        const accommodationId = 'acc-uuid-001';

        // First call: entitlements (includes view_basic_stats)
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: {
                    entitlements: ['view_basic_stats', 'create_promotions'],
                    limits: {},
                    plan: { slug: 'pro', name: 'Pro', status: 'active' },
                    asOf: new Date().toISOString()
                }
            })
        );

        // Second call: views endpoint
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: [{ entityId: accommodationId, unique: 42, total: 150 }]
            })
        );

        const result = await runSource('host.stats.views');

        // Must NOT be locked
        expect((result as { locked: boolean }).locked).toBe(false);

        // Must have called views endpoint
        expect(mockFetchApi).toHaveBeenCalledTimes(2);
        const viewsPath = (mockFetchApi.mock.calls[1][0] as { path: string }).path;
        expect(viewsPath).toContain('/protected/views/accommodations/me');
        expect(viewsPath).toContain('window=30d');

        // Must contain the accommodation stats
        const items = (result as { items: unknown[] }).items;
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({ entityId: accommodationId, unique: 42, total: 150 });
    });

    // ── AC-6: 403 defensive fallback ──────────────────────────────────────────

    it('returns { locked: true } when the views endpoint returns 403 despite entitlement check', async () => {
        // Entitlements present
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

        // Views endpoint throws ApiError 403
        mockFetchApi.mockRejectedValueOnce(new ApiError('Forbidden', { status: 403 }));

        const result = await runSource('host.stats.views');

        expect(result).toEqual({ locked: true });
    });

    // ── Query key shape ────────────────────────────────────────────────────────

    it('builds a queryKey starting with [dashboard, host.stats.views, HOST, own]', () => {
        const { found, options } = resolveDataSource('host.stats.views', ctx);

        expect(found).toBe(true);
        const key = options.queryKey as unknown[];
        expect(key[0]).toBe('dashboard');
        expect(key[1]).toBe('host.stats.views');
        expect(key[2]).toBe('HOST');
        expect(key[3]).toBe('own');
    });
});
