/**
 * Regression guard for `initiatePaidMonthlySubscription` with the HOS-937
 * step 1 own-preapproval flag OFF (`HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED`
 * unset — the production default).
 *
 * The existing `subscription-checkout.service.test.ts` suite already covers
 * the unmodified Path C behavior end to end; this file adds the ONE
 * assertion that suite cannot make because it never imports the new module:
 * `createOwnPreapprovalSubscription` is not called when the flag is off.
 * Kept separate from the flag-ON suite for the same reason documented there
 * (env is read at module scope; flipping it per-file avoids resetModules
 * gymnastics).
 *
 * @module test/services/subscription-checkout-own-preapproval-flag-off
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/env', () => ({
    env: {}
}));

vi.mock('../../src/services/billing/mp-plan-provisioning.service', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../src/services/billing/mp-plan-provisioning.service')
        >();
    return {
        ...actual,
        resolveCheckoutMpPlanId: vi.fn().mockResolvedValue('mp_plan_test'),
        resolveOrProvisionMpPlan: vi.fn()
    };
});

vi.mock('../../src/services/billing/pending-provider-subscription-create', () => ({
    createPendingProviderSubscription: vi.fn()
}));

vi.mock('../../src/services/billing/own-preapproval-subscription-create', () => ({
    createOwnPreapprovalSubscription: vi.fn()
}));

import { createOwnPreapprovalSubscription } from '../../src/services/billing/own-preapproval-subscription-create';
import { createPendingProviderSubscription } from '../../src/services/billing/pending-provider-subscription-create';
import { initiatePaidMonthlySubscription } from '../../src/services/subscription-checkout.service';

const CUSTOMER_ID = 'cust_owner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const MONTHLY_PRICE_ID = 'price_monthly_1';

const MONTHLY_PRICE = {
    id: MONTHLY_PRICE_ID,
    billingInterval: 'month' as const,
    intervalCount: 1,
    active: true
};

const URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/billing/return',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

const CUSTOMER_FIXTURE = {
    id: CUSTOMER_ID,
    email: 'host@hospeda.test',
    name: 'Maria Rodriguez',
    livemode: false
};

function createPlan() {
    return {
        id: PLAN_ID,
        name: 'owner-premium',
        prices: [MONTHLY_PRICE]
    };
}

function createBillingMock() {
    return {
        plans: {
            listAll: vi.fn().mockResolvedValue([createPlan()])
        },
        customers: {
            get: vi.fn().mockResolvedValue(CUSTOMER_FIXTURE)
        },
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([])
        }
    };
}

const PENDING_RESULT = {
    localSubscriptionId: 'pending-sub-1',
    nonce: 'nonce-test-1234',
    expiresAt: '2099-01-01T00:00:00.000Z'
};

describe('initiatePaidMonthlySubscription (HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED unset)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(createPendingProviderSubscription).mockResolvedValue(PENDING_RESULT);
    });

    it('keeps calling createPendingProviderSubscription and never calls createOwnPreapprovalSubscription', async () => {
        const billing = createBillingMock();

        await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS
        });

        expect(createPendingProviderSubscription).toHaveBeenCalledTimes(1);
        expect(createOwnPreapprovalSubscription).not.toHaveBeenCalled();
    });
});
