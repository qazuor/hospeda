import { beforeEach, describe, expect, it, vi } from 'vitest';

const postProtected = vi.fn();
const post = vi.fn();

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
        postProtected: (args: unknown) => postProtected(args),
        // Non-credentialed variant: exposed so tests can assert that protected
        // mutations do NOT route through it (would send no session cookie → 401).
        post: (args: unknown) => post(args)
    }
}));

import { accommodationCalendarSyncApi, billingApi } from '../../../src/lib/api/endpoints-protected';

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

describe('accommodationCalendarSyncApi credentialed mutations (HOS-157 regression)', () => {
    beforeEach(() => {
        postProtected.mockReset();
        post.mockReset();
        postProtected.mockResolvedValue({ ok: true, data: {} });
        post.mockResolvedValue({ ok: true, data: {} });
    });

    // Regression: connectGoogle/sync hit /protected/* mutation routes, so they
    // must send the session cookie. They previously used the non-credentialed
    // `apiClient.post`, which omits `credentials: 'include'` → the browser POST
    // carried no cookie → 401 before the route could run. They must route
    // through `postProtected`.
    it('connectGoogle uses the credentialed postProtected (never plain post)', async () => {
        await accommodationCalendarSyncApi.connectGoogle({ id: 'acc-1', returnTo: '/es/x/' });

        expect(postProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/accommodations/acc-1/calendar-sync/connect-google',
            body: { returnTo: '/es/x/' }
        });
        expect(post).not.toHaveBeenCalled();
    });

    it('sync uses the credentialed postProtected (never plain post)', async () => {
        await accommodationCalendarSyncApi.sync({ id: 'acc-1' });

        expect(postProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/accommodations/acc-1/calendar-sync/sync',
            body: {}
        });
        expect(post).not.toHaveBeenCalled();
    });
});
