/**
 * Unit tests for `applyImmediatePaidPlanSwap` (HOS-222).
 *
 * The immediate paid plan-swap flow used for an equal-or-cheaper cross-category
 * rank-UP change on an ACTIVE (non-trial) subscription. It mutates the live MP
 * preapproval to the new plan/amount (with a display `reason`) and commits the
 * plan locally with NO charge and NO proration.
 *
 * Covers:
 * - Happy path: MP preapproval mutated to the new plan/amount + reason; plan
 *   committed locally with `prorationBehavior: 'none'`; entitlement cache cleared.
 * - Fail-closed: an MP rejection (or a missing preapproval id) leaves the plan
 *   unchanged (no `changePlan`, no cache clear) and surfaces
 *   MP_PREAPPROVAL_MUTATION_FAILED.
 * - Fail-loud drift: MP mutation succeeds but the local commit fails →
 *   IMMEDIATE_SWAP_LOCAL_APPLY_FAILED, paged via `{ capture: true }`.
 *
 * @module test/services/immediate-plan-swap.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (declared before importing the SUT).
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({}))
}));

vi.mock('@repo/service-core', () => ({
    resolveOwnerPlanGrantsFeatured: vi.fn().mockResolvedValue(false),
    syncFeaturedByEntitlementForOwner: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../src/services/addon-plan-change.service', () => ({
    handlePlanChangeAddonRecalculation: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/services/plan-upgrade-restoration.service', () => ({
    applyUpgradeRestorationsOrWarn: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/services/subscription-downgrade.service', () => ({
    clearPendingScheduledPlanChange: vi.fn().mockResolvedValue({ cleared: false })
}));

// resolveOwnerUserId → null short-circuits the best-effort restoration chain,
// keeping this suite focused on the MP-mutate + local-commit contract.
vi.mock('../../src/services/subscription-pause.service', () => ({
    resolveOwnerUserId: vi.fn().mockResolvedValue(null)
}));

vi.mock('../../src/services/billing/plan-change-reason', () => ({
    resolvePlanChangeReason: vi.fn().mockResolvedValue('Basic')
}));

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { clearEntitlementCache } from '../../src/middlewares/entitlement';
import { applyImmediatePaidPlanSwap } from '../../src/services/billing/immediate-plan-swap.service';
import { SubscriptionCheckoutError } from '../../src/services/billing/subscription-checkout-error';
import { apiLogger } from '../../src/utils/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUB_ID = 'sub_active_1';
const CUSTOMER_ID = 'cust_1';
const OLD_PLAN_ID = 'plan_tourist_vip';
const NEW_PLAN_ID = 'plan_owner_basico';
const NEW_PRICE_ID = 'price_owner_basico_month';
const TARGET_AMOUNT_MAJOR = 15_000;
const MP_SUB_ID = 'mp_preapproval_1';

function makeBilling(mpUpdateImpl?: () => Promise<void>) {
    const changedSubscription = {
        id: SUB_ID,
        planId: NEW_PLAN_ID,
        customerId: CUSTOMER_ID
    };
    const changePlan = vi.fn().mockResolvedValue({
        subscription: changedSubscription,
        proration: null
    });
    const mpUpdate = vi.fn().mockImplementation(mpUpdateImpl ?? (async () => undefined));
    const paymentAdapter = { subscriptions: { update: mpUpdate } };
    const billing = {
        subscriptions: {
            changePlan,
            // Read by clearPendingScheduledPlanChange (mocked out) — unused here.
            get: vi.fn().mockResolvedValue({ scheduledPlanChange: null }),
            update: vi.fn()
        },
        getPaymentAdapter: vi.fn(() => paymentAdapter)
    };
    return { billing, changePlan, mpUpdate };
}

function baseInput(billing: unknown) {
    return {
        billing: billing as never,
        subscriptionId: SUB_ID,
        oldPlanId: OLD_PLAN_ID,
        newPlanId: NEW_PLAN_ID,
        newPriceId: NEW_PRICE_ID,
        targetTransactionAmountMajor: TARGET_AMOUNT_MAJOR,
        mpSubscriptionId: MP_SUB_ID
    };
}

describe('applyImmediatePaidPlanSwap', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('mutates the MP preapproval and commits the plan with no charge or proration', async () => {
        const { billing, changePlan, mpUpdate } = makeBilling();

        const result = await applyImmediatePaidPlanSwap(baseInput(billing));

        expect(result).toEqual({
            subscriptionId: SUB_ID,
            previousPlanId: OLD_PLAN_ID,
            newPlanId: NEW_PLAN_ID
        });

        // MP mutated to the new plan + amount + display reason.
        expect(mpUpdate).toHaveBeenCalledWith(MP_SUB_ID, {
            planId: NEW_PLAN_ID,
            transactionAmount: TARGET_AMOUNT_MAJOR,
            reason: 'Basic'
        });

        // Local plan committed with no proration.
        expect(changePlan).toHaveBeenCalledWith(SUB_ID, {
            newPlanId: NEW_PLAN_ID,
            newPriceId: NEW_PRICE_ID,
            prorationBehavior: 'none',
            applyAt: 'immediately'
        });
        expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
    });

    it('fails closed when MP rejects the mutation (plan unchanged)', async () => {
        const { billing, changePlan } = makeBilling(async () => {
            throw new Error('MP rejected');
        });

        await expect(applyImmediatePaidPlanSwap(baseInput(billing))).rejects.toMatchObject({
            code: 'MP_PREAPPROVAL_MUTATION_FAILED'
        });
        expect(changePlan).not.toHaveBeenCalled();
        expect(clearEntitlementCache).not.toHaveBeenCalled();
    });

    it('fails closed when there is no linked MP preapproval', async () => {
        const { billing, changePlan, mpUpdate } = makeBilling();

        await expect(
            applyImmediatePaidPlanSwap({ ...baseInput(billing), mpSubscriptionId: undefined })
        ).rejects.toBeInstanceOf(SubscriptionCheckoutError);
        expect(mpUpdate).not.toHaveBeenCalled();
        expect(changePlan).not.toHaveBeenCalled();
    });

    it('fails loud (drift) when MP mutation succeeds but the local commit fails', async () => {
        const { billing, changePlan, mpUpdate } = makeBilling();
        changePlan.mockRejectedValueOnce(new Error('DB lost mid-commit'));

        await expect(applyImmediatePaidPlanSwap(baseInput(billing))).rejects.toMatchObject({
            code: 'IMMEDIATE_SWAP_LOCAL_APPLY_FAILED'
        });

        // The MP mutation DID go through — this is the drift condition.
        expect(mpUpdate).toHaveBeenCalled();
        expect(clearEntitlementCache).not.toHaveBeenCalled();

        // Paged via the { capture: true } Sentry-forwarding convention.
        expect(apiLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ subscriptionId: SUB_ID, mpSubscriptionId: MP_SUB_ID }),
            expect.stringContaining('manual reconcile required'),
            { capture: true }
        );
    });
});
