/**
 * @file entitlements-cache.test.ts
 * @description Unit + regression tests for the shared entitlements cache
 * module (`@/lib/entitlements-cache`).
 *
 * The regression suite at the bottom guards the "unify entitlements client
 * caches" HOS follow-up: before this module existed, `useMyEntitlements`
 * (React hook) and `syncPlanPersonProperties` (PostHog analytics sync) each
 * kept their own module-level cache and their own `fetch`, so an
 * authenticated page load could hit
 * `GET /api/v1/protected/users/me/entitlements` twice.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMyEntitlements } from '@/hooks/useMyEntitlements';
import {
    __resetPlanPropertiesSyncedForTests,
    syncPlanPersonProperties
} from '@/lib/analytics/plan-properties';
import { clearEntitlementsCache, getEntitlementsCached } from '@/lib/entitlements-cache';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('@/lib/analytics/posthog-client', () => ({
    setPersonProperties: vi.fn()
}));

const mockUseSession = vi.fn();
vi.mock('@/lib/auth-client', () => ({
    useSession: () => mockUseSession()
}));

const AUTHENTICATED = { data: { user: { id: 'user-1' } }, isPending: false };

function mockSuccessResponse(data: unknown) {
    return {
        ok: true,
        status: 200,
        json: () => Promise.resolve(data)
    };
}

const ENTITLEMENTS_RESPONSE = {
    data: {
        entitlements: ['can_use_rich_description'],
        limits: { max_accommodations: 5 },
        plan: { slug: 'owner-pro', name: 'Owner Pro', status: 'active' },
        asOf: '2026-01-01T00:00:00Z'
    }
};

describe('entitlements-cache', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        clearEntitlementsCache();
        __resetPlanPropertiesSyncedForTests();
        mockUseSession.mockReturnValue(AUTHENTICATED);
    });

    describe('getEntitlementsCached', () => {
        it('fetches once and serves a subsequent call from cache within the TTL', async () => {
            mockFetch.mockResolvedValueOnce(mockSuccessResponse(ENTITLEMENTS_RESPONSE));

            const first = await getEntitlementsCached();
            const second = await getEntitlementsCached();

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(first).toEqual(second);
            expect(first.plan?.slug).toBe('owner-pro');
        });

        it('de-duplicates concurrent in-flight calls into a single fetch', async () => {
            mockFetch.mockResolvedValueOnce(mockSuccessResponse(ENTITLEMENTS_RESPONSE));

            const [a, b] = await Promise.all([getEntitlementsCached(), getEntitlementsCached()]);

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(a).toEqual(b);
        });

        it('rejects when the response is not ok, and a later call can retry', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: () => Promise.resolve({ error: { message: 'Unauthorized' } })
            });

            await expect(getEntitlementsCached()).rejects.toThrow('Unauthorized');

            // A rejected fetch is never cached — a later call retries.
            mockFetch.mockResolvedValueOnce(mockSuccessResponse(ENTITLEMENTS_RESPONSE));
            const result = await getEntitlementsCached();
            expect(result.plan?.slug).toBe('owner-pro');
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    // -----------------------------------------------------------------------
    // Regression: single shared cache between useMyEntitlements and
    // syncPlanPersonProperties (HOS follow-up "unify entitlements client
    // caches"). Both consumers used to fire independent fetches on the same
    // authenticated page load; they must now share one call per TTL window
    // regardless of call order.
    // -----------------------------------------------------------------------
    describe('cross-consumer dedup: useMyEntitlements + syncPlanPersonProperties', () => {
        it('hits the endpoint once when the hook mounts and the analytics sync runs within the TTL window', async () => {
            mockFetch.mockResolvedValueOnce(mockSuccessResponse(ENTITLEMENTS_RESPONSE));

            const { result } = renderHook(() => useMyEntitlements());
            await syncPlanPersonProperties({ apiUrl: 'https://ignored.test' });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(result.current.has('can_use_rich_description')).toBe(true);
        });

        it('hits the endpoint once even when the analytics sync races in before the hook mounts', async () => {
            mockFetch.mockResolvedValueOnce(mockSuccessResponse(ENTITLEMENTS_RESPONSE));

            const syncPromise = syncPlanPersonProperties({ apiUrl: 'https://ignored.test' });
            const { result } = renderHook(() => useMyEntitlements());

            await syncPromise;
            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('serves a second hook mount from cache without a second analytics-triggered fetch', async () => {
            mockFetch.mockResolvedValueOnce(mockSuccessResponse(ENTITLEMENTS_RESPONSE));

            const { unmount } = renderHook(() => useMyEntitlements());
            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
            unmount();

            // A later analytics sync (e.g. after a soft-nav remount elsewhere)
            // reads the still-fresh cache instead of firing another fetch.
            await syncPlanPersonProperties({ apiUrl: 'https://ignored.test' });

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });
});
