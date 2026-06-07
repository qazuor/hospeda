import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    ensureCustomerExists: vi.fn(),
    startTrial: vi.fn(),
    findUserById: vi.fn(),
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: mocks.clearEntitlementCache
}));

vi.mock('../../src/services/billing-customer-sync', () => ({
    BillingCustomerSyncService: class BillingCustomerSyncService {
        ensureCustomerExists = mocks.ensureCustomerExists;
    }
}));

vi.mock('../../src/services/trial.service', () => ({
    TrialService: class TrialService {
        startTrial = mocks.startTrial;
    }
}));

vi.mock('@repo/db', () => ({
    UserModel: class UserModel {
        findById = mocks.findUserById;
    },
    billingCustomers: {},
    billingSubscriptions: {},
    desc: vi.fn(),
    eq: vi.fn(),
    getDb: vi.fn()
}));

import { buildAccommodationPublishDeps } from '../../src/services/accommodation-publish-deps';

describe('buildAccommodationPublishDeps.startTrial', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.findUserById.mockResolvedValue({
            id: 'owner-1',
            email: 'owner@example.com',
            displayName: 'Owner One'
        });
        mocks.ensureCustomerExists.mockResolvedValue('cust_123');
        mocks.startTrial.mockResolvedValue('sub_123');
    });

    it('clears the entitlement cache after creating the first-publish trial', async () => {
        const deps = buildAccommodationPublishDeps(() => ({}) as never);

        const result = await deps.startTrial({ ownerId: 'owner-1' });

        expect(result).toEqual({ subscriptionId: 'sub_123' });
        expect(mocks.clearEntitlementCache).toHaveBeenCalledTimes(1);
        expect(mocks.clearEntitlementCache).toHaveBeenCalledWith('cust_123');
    });
});
