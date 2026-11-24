/**
 * @file provider-tab-counts-endpoint.test.ts
 * @description Owner decision 22: the provider's tab counts are ONE protected
 * read, and the pause of an owner promotion is a one-key PATCH (decision 18).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getProtected, patch } = vi.hoisted(() => ({ getProtected: vi.fn(), patch: vi.fn() }));

vi.mock('../../../src/lib/api/client', () => ({ apiClient: { getProtected, patch } }));

import { hostTradesApi, ownerPromotionApi } from '../../../src/lib/api/endpoints-protected';

describe('hostTradesApi.tabCounts', () => {
    beforeEach(() =>
        getProtected
            .mockReset()
            .mockResolvedValue({ ok: true, data: { pendingUsages: 2, reviews: 5 } })
    );

    it('reads the aggregated endpoint, forwarding the SSR cookie', async () => {
        const result = await hostTradesApi.tabCounts({ cookieHeader: 'session=abc' });

        expect(getProtected).toHaveBeenCalledExactlyOnceWith({
            path: '/api/v1/protected/host-trades/mine/tab-counts',
            cookieHeader: 'session=abc'
        });
        expect(result).toEqual({ ok: true, data: { pendingUsages: 2, reviews: 5 } });
    });
});

describe('ownerPromotionApi.pause', () => {
    beforeEach(() => patch.mockReset().mockResolvedValue({ ok: true, data: {} }));

    it('sends ONLY the lifecycle state, so the API reads it as a pause', async () => {
        await ownerPromotionApi.pause({ id: 'promo-1' });

        expect(patch).toHaveBeenCalledExactlyOnceWith({
            path: '/api/v1/protected/owner-promotions/promo-1',
            body: { lifecycleState: 'INACTIVE' }
        });
    });
});
