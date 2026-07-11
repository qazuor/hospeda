import { beforeEach, describe, expect, it, vi } from 'vitest';

const postProtected = vi.fn();

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
        postProtected: (args: unknown) => postProtected(args)
    }
}));

import { billingApi } from '../../../src/lib/api/endpoints-protected';

describe('billingApi.reactivateSubscription (HOS-123 T-015)', () => {
    beforeEach(() => {
        postProtected.mockReset();
        postProtected.mockResolvedValue({ success: true, data: {} });
    });

    it('forwards only planId when billingInterval is omitted (monthly default)', async () => {
        await billingApi.reactivateSubscription({ planId: 'plan-uuid' });

        expect(postProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/billing/trial/reactivate-subscription',
            body: { planId: 'plan-uuid' }
        });
    });

    it('forwards billingInterval when set to annual', async () => {
        await billingApi.reactivateSubscription({
            planId: 'plan-uuid',
            billingInterval: 'annual'
        });

        expect(postProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/billing/trial/reactivate-subscription',
            body: { planId: 'plan-uuid', billingInterval: 'annual' }
        });
    });

    it('forwards billingInterval when set to monthly explicitly', async () => {
        await billingApi.reactivateSubscription({
            planId: 'plan-uuid',
            billingInterval: 'monthly'
        });

        expect(postProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/billing/trial/reactivate-subscription',
            body: { planId: 'plan-uuid', billingInterval: 'monthly' }
        });
    });
});
