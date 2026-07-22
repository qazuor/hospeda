/**
 * Unit tests for `applyTrialingPlanUpgrade` (HOS-171 / HOS-231).
 *
 * The trial-time plan-upgrade flow mutates the live MP preapproval to the new
 * plan/amount and commits the plan locally, with no charge (the trial defers
 * the first charge). HOS-231: it now passes a human `reason` (the plan display
 * name) to the MP preapproval `update`, so the buyer sees e.g. "VIP" instead of
 * the raw plan UUID ("Plan updated to: <uuid>") — the last cross-plan path that
 * still omitted it after HOS-220.
 *
 * Covers:
 * - Happy path: MP preapproval mutated to the new plan/amount + display reason.
 * - Idempotency: same plan AND same price → no MP mutation.
 * - Fail-closed: a missing preapproval id never touches MP.
 *
 * @module test/services/trialing-plan-upgrade.service
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
// keeping this suite focused on the MP-mutate + reason contract.
vi.mock('../../src/services/subscription-pause.service', () => ({
    resolveOwnerUserId: vi.fn().mockResolvedValue(null)
}));

vi.mock('../../src/services/billing/plan-change-reason', () => ({
    resolvePlanChangeReason: vi.fn().mockResolvedValue('VIP')
}));

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { resolvePlanChangeReason } from '../../src/services/billing/plan-change-reason';
import { SubscriptionCheckoutError } from '../../src/services/billing/subscription-checkout-error';
import { applyTrialingPlanUpgrade } from '../../src/services/billing/trialing-plan-upgrade.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUB_ID = 'sub_trialing_1';
const CUSTOMER_ID = 'cust_1';
const OLD_PLAN_ID = 'plan_tourist_plus';
const NEW_PLAN_ID = 'plan_tourist_vip';
const OLD_PRICE_ID = 'price_plus_month';
const NEW_PRICE_ID = 'price_vip_month';
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
        currentPriceId: OLD_PRICE_ID,
        targetTransactionAmountMajor: TARGET_AMOUNT_MAJOR,
        mpSubscriptionId: MP_SUB_ID
    };
}

describe('applyTrialingPlanUpgrade', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // HOS-231: the core regression — the MP preapproval `update` must carry the
    // resolved display-name `reason`, not fall back to the raw-UUID synthetic.
    it('mutates the MP preapproval to the new plan/amount WITH the display reason', async () => {
        const { billing, mpUpdate } = makeBilling();

        const result = await applyTrialingPlanUpgrade(baseInput(billing));

        expect(result).toEqual({
            subscriptionId: SUB_ID,
            previousPlanId: OLD_PLAN_ID,
            newPlanId: NEW_PLAN_ID,
            alreadyOnTargetPlan: false
        });

        expect(resolvePlanChangeReason).toHaveBeenCalledWith({ planId: NEW_PLAN_ID });
        expect(mpUpdate).toHaveBeenCalledWith(MP_SUB_ID, {
            planId: NEW_PLAN_ID,
            transactionAmount: TARGET_AMOUNT_MAJOR,
            reason: 'VIP'
        });
    });

    // When the plan name cannot be resolved the caller omits nothing special —
    // it forwards `undefined`, letting the adapter keep its synthetic fallback
    // (never blocks the upgrade on a cosmetic label lookup).
    it('forwards reason: undefined when the plan name cannot be resolved', async () => {
        vi.mocked(resolvePlanChangeReason).mockResolvedValueOnce(undefined);
        const { billing, mpUpdate } = makeBilling();

        await applyTrialingPlanUpgrade(baseInput(billing));

        expect(mpUpdate).toHaveBeenCalledWith(MP_SUB_ID, {
            planId: NEW_PLAN_ID,
            transactionAmount: TARGET_AMOUNT_MAJOR,
            reason: undefined
        });
    });

    it('is an idempotent no-op when already on the target plan AND price (no MP mutation)', async () => {
        const { billing, mpUpdate } = makeBilling();

        const result = await applyTrialingPlanUpgrade({
            ...baseInput(billing),
            oldPlanId: NEW_PLAN_ID,
            currentPriceId: NEW_PRICE_ID
        });

        expect(result.alreadyOnTargetPlan).toBe(true);
        expect(mpUpdate).not.toHaveBeenCalled();
        expect(resolvePlanChangeReason).not.toHaveBeenCalled();
    });

    it('fails closed when there is no linked MP preapproval (never touches MP)', async () => {
        const { billing, mpUpdate, changePlan } = makeBilling();

        await expect(
            applyTrialingPlanUpgrade({ ...baseInput(billing), mpSubscriptionId: undefined })
        ).rejects.toBeInstanceOf(SubscriptionCheckoutError);
        expect(mpUpdate).not.toHaveBeenCalled();
        expect(changePlan).not.toHaveBeenCalled();
    });

    it('fails closed when MP rejects the mutation (plan NOT changed locally)', async () => {
        const { billing, changePlan } = makeBilling(async () => {
            throw new Error('MP rejected');
        });

        await expect(applyTrialingPlanUpgrade(baseInput(billing))).rejects.toMatchObject({
            code: 'MP_PREAPPROVAL_MUTATION_FAILED'
        });
        expect(changePlan).not.toHaveBeenCalled();
    });
});
