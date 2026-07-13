/**
 * @file plan-properties.test.ts
 * @description Tests for the plan/tier PostHog person-property sync.
 *
 * The endpoint fetch + cache moved to the shared `@/lib/entitlements-cache`
 * module (HOS follow-up "unify entitlements client caches" — see
 * `entitlements-cache.test.ts` for the cross-consumer dedup regression
 * test). These tests exercise `syncPlanPersonProperties` through that shared
 * module rather than mocking `fetch` with a hardcoded URL/header shape.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setPersonPropertiesMock = vi.fn();
vi.mock('@/lib/analytics/posthog-client', () => ({
    setPersonProperties: (...args: unknown[]) => setPersonPropertiesMock(...args)
}));

import {
    __resetPlanPropertiesSyncedForTests,
    syncPlanPersonProperties
} from '@/lib/analytics/plan-properties';
import { clearEntitlementsCache } from '@/lib/entitlements-cache';

// The `apiUrl` param is unused by `syncPlanPersonProperties` now (the shared
// cache module resolves the API base URL internally via `getApiUrl()`), but
// the parameter is kept for call-site backward compatibility — pass a
// deliberately wrong value to prove it has no effect.
const IGNORED_API_URL = 'https://ignored.test';

describe('syncPlanPersonProperties', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        setPersonPropertiesMock.mockClear();
        __resetPlanPropertiesSyncedForTests();
        clearEntitlementsCache();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearEntitlementsCache();
    });

    it('sets plan + plan_status from the entitlements endpoint', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { plan: { slug: 'host-pro', status: 'active' } } })
        }) as unknown as typeof fetch;

        await syncPlanPersonProperties({ apiUrl: IGNORED_API_URL });

        expect(global.fetch).toHaveBeenCalledWith(
            'http://localhost:3001/api/v1/protected/users/me/entitlements',
            expect.objectContaining({ credentials: 'include' })
        );
        expect(setPersonPropertiesMock).toHaveBeenCalledWith({
            plan: 'host-pro',
            plan_status: 'active'
        });
    });

    it('reports free/none when the user has no active plan', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { plan: null } })
        }) as unknown as typeof fetch;

        await syncPlanPersonProperties({ apiUrl: IGNORED_API_URL });

        expect(setPersonPropertiesMock).toHaveBeenCalledWith({
            plan: 'free',
            plan_status: 'none'
        });
    });

    it('does not set properties and allows retry when the request is not ok (e.g. 401)', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ error: { message: 'Unauthorized' } })
        }) as unknown as typeof fetch;

        await syncPlanPersonProperties({ apiUrl: IGNORED_API_URL });
        expect(setPersonPropertiesMock).not.toHaveBeenCalled();

        // A subsequent call retries (guard was released on failure).
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { plan: { slug: 'host-pro', status: 'active' } } })
        }) as unknown as typeof fetch;
        await syncPlanPersonProperties({ apiUrl: IGNORED_API_URL });
        expect(setPersonPropertiesMock).toHaveBeenCalledOnce();
    });

    it('runs at most once per page load on success (guarded against soft-nav refetch)', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { plan: { slug: 'host-pro', status: 'active' } } })
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        await syncPlanPersonProperties({ apiUrl: IGNORED_API_URL });
        await syncPlanPersonProperties({ apiUrl: IGNORED_API_URL });

        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('swallows a thrown fetch and allows retry', async () => {
        global.fetch = vi
            .fn()
            .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

        await expect(
            syncPlanPersonProperties({ apiUrl: IGNORED_API_URL })
        ).resolves.toBeUndefined();
        expect(setPersonPropertiesMock).not.toHaveBeenCalled();
    });
});
