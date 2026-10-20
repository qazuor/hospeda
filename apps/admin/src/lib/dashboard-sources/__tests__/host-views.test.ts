/**
 * host.stats.views — locked-state and happy-path resolver tests (SPEC-197 T-013).
 *
 * Tests the views resolver contract:
 *  - Happy path → fetch views endpoint with correct path.
 *  - Views endpoint returns 403 → locked fallback (AC-6).
 *  - Unknown errors propagate.
 *
 * (HOS-1416: the proactive `view_basic_stats` entitlement pre-check against
 * the billing entitlements endpoint was removed with the legacy billing
 * surface. The lock state now comes solely from the views endpoint's own
 * authorization, so the entitlement-specific tests were removed with it.)
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
    roles: ['HOST'],
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
    // ── Happy path ────────────────────────────────────────────────────────────

    it('calls the views endpoint with correct path and returns the stats', async () => {
        const accommodationId = 'acc-uuid-001';

        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: [{ entityId: accommodationId, unique: 42, total: 150 }]
            })
        );

        const result = await runSource('host.stats.views');

        // Must NOT be locked
        expect((result as { locked: boolean }).locked).toBe(false);

        // Must have called views endpoint exactly once
        expect(mockFetchApi).toHaveBeenCalledTimes(1);
        const viewsPath = (mockFetchApi.mock.calls[0][0] as { path: string }).path;
        expect(viewsPath).toContain('/protected/views/accommodations/me');
        expect(viewsPath).toContain('window=30d');

        // Must contain the accommodation stats
        const items = (result as { items: unknown[] }).items;
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({ entityId: accommodationId, unique: 42, total: 150 });
    });

    // ── AC-6: 403 defensive fallback ──────────────────────────────────────────

    it('returns { locked: true } when the views endpoint returns 403', async () => {
        mockFetchApi.mockRejectedValueOnce(new ApiError('Forbidden', { status: 403 }));

        const result = await runSource('host.stats.views');

        expect(result).toEqual({ locked: true });
    });

    // ── Unknown errors propagate (not swallowed as sentinel) ──────────────────

    it('re-throws unknown errors so useQuery surfaces the error state', async () => {
        const networkError = new Error('Network timeout');
        mockFetchApi.mockRejectedValueOnce(networkError);

        await expect(runSource('host.stats.views')).rejects.toThrow('Network timeout');
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
