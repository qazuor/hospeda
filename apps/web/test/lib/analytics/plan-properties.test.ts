/**
 * @file plan-properties.test.ts
 * @description Tests for the plan/tier PostHog person-property sync.
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

const API = 'https://api.test';

describe('syncPlanPersonProperties', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        setPersonPropertiesMock.mockClear();
        __resetPlanPropertiesSyncedForTests();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('sets plan + plan_status from the entitlements endpoint', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { plan: { slug: 'host-pro', status: 'active' } } })
        }) as unknown as typeof fetch;

        await syncPlanPersonProperties({ apiUrl: API });

        expect(global.fetch).toHaveBeenCalledWith(`${API}/api/v1/protected/users/me/entitlements`, {
            credentials: 'include'
        });
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

        await syncPlanPersonProperties({ apiUrl: API });

        expect(setPersonPropertiesMock).toHaveBeenCalledWith({
            plan: 'free',
            plan_status: 'none'
        });
    });

    it('does not set properties and allows retry when the request is not ok (e.g. 401)', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

        await syncPlanPersonProperties({ apiUrl: API });
        expect(setPersonPropertiesMock).not.toHaveBeenCalled();

        // A subsequent call retries (guard was released on failure).
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { plan: { slug: 'host-pro', status: 'active' } } })
        }) as unknown as typeof fetch;
        await syncPlanPersonProperties({ apiUrl: API });
        expect(setPersonPropertiesMock).toHaveBeenCalledOnce();
    });

    it('runs at most once per page load on success (guarded against soft-nav refetch)', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { plan: { slug: 'host-pro', status: 'active' } } })
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        await syncPlanPersonProperties({ apiUrl: API });
        await syncPlanPersonProperties({ apiUrl: API });

        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('swallows a thrown fetch and allows retry', async () => {
        global.fetch = vi
            .fn()
            .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

        await expect(syncPlanPersonProperties({ apiUrl: API })).resolves.toBeUndefined();
        expect(setPersonPropertiesMock).not.toHaveBeenCalled();
    });
});
