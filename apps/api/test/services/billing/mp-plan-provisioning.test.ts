/**
 * Unit tests for the HOS-191 MercadoPago plan provisioning service.
 *
 * Covers the four resolution branches of {@link resolveOrProvisionMpPlan}:
 * - registry hit at the same amount → reuse stored id, no MP call;
 * - registry hit with amount drift → re-provision + archive the stale plan;
 * - miss → provision + insert;
 * - lost insert race → archive the orphan plan, return the winner's id;
 * plus a genuine (non-race) create failure that must surface, and the
 * trial-days / interval mapping passed to the price adapter.
 *
 * @module test/services/billing/mp-plan-provisioning
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findOne, create, update, getBillingPaymentAdapter } = vi.hoisted(() => ({
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    getBillingPaymentAdapter: vi.fn()
}));

vi.mock('@repo/db', () => ({
    billingMpPlanModel: { findOne, create, update }
}));

vi.mock('../../../src/middlewares/billing', () => ({
    getBillingPaymentAdapter
}));

import {
    resolveCheckoutMpPlanId,
    resolveOrProvisionMpPlan
} from '../../../src/services/billing/mp-plan-provisioning.service';
import { SubscriptionCheckoutError } from '../../../src/services/billing/subscription-checkout-error';

function createAdapter() {
    return {
        prices: {
            create: vi.fn().mockResolvedValue('mp_plan_new'),
            archive: vi.fn().mockResolvedValue(undefined)
        }
        // biome-ignore lint/suspicious/noExplicitAny: partial adapter stub for the prices slot under test
    } as any;
}

const BASE_INPUT = {
    commercialPlanId: 'plan-uuid',
    billingInterval: 'monthly' as const,
    trialDays: 14,
    amountCentavos: 1_500_000,
    currency: 'ARS',
    planName: 'Basic'
};

beforeEach(() => {
    findOne.mockReset();
    create.mockReset();
    update.mockReset();
    getBillingPaymentAdapter.mockReset();
});

describe('resolveOrProvisionMpPlan', () => {
    it('reuses the stored id without an MP call on a registry hit at the same amount', async () => {
        findOne.mockResolvedValue({
            id: 'row1',
            mpPreapprovalPlanId: 'mp_existing',
            amountArs: 1_500_000,
            status: 'active'
        });
        const adapter = createAdapter();

        const res = await resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT });

        expect(res).toEqual({ mpPreapprovalPlanId: 'mp_existing', created: false });
        expect(adapter.prices.create).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('provisions and inserts on a registry miss', async () => {
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();
        adapter.prices.create.mockResolvedValue('mp_plan_new');

        const res = await resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT });

        expect(adapter.prices.create).toHaveBeenCalledOnce();
        expect(create).toHaveBeenCalledWith(
            expect.objectContaining({
                commercialPlanId: 'plan-uuid',
                billingInterval: 'monthly',
                trialDays: 14,
                mpPreapprovalPlanId: 'mp_plan_new',
                amountArs: 1_500_000,
                status: 'active'
            })
        );
        expect(res).toEqual({ mpPreapprovalPlanId: 'mp_plan_new', created: true });
    });

    it('re-provisions and archives the stale plan when the commercial price drifted', async () => {
        findOne.mockResolvedValue({
            id: 'row1',
            mpPreapprovalPlanId: 'mp_old',
            amountArs: 999,
            status: 'active'
        });
        const adapter = createAdapter();
        adapter.prices.create.mockResolvedValue('mp_new');

        const res = await resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT });

        expect(adapter.prices.create).toHaveBeenCalledOnce();
        expect(adapter.prices.archive).toHaveBeenCalledWith('mp_old');
        expect(update).toHaveBeenCalledWith(
            { id: 'row1' },
            expect.objectContaining({
                mpPreapprovalPlanId: 'mp_new',
                amountArs: 1_500_000,
                status: 'active'
            })
        );
        expect(res).toEqual({ mpPreapprovalPlanId: 'mp_new', created: true });
    });

    it('re-provisions when the stored row is inactive even if the amount matches', async () => {
        findOne.mockResolvedValue({
            id: 'row1',
            mpPreapprovalPlanId: 'mp_inactive',
            amountArs: 1_500_000,
            status: 'inactive'
        });
        const adapter = createAdapter();
        adapter.prices.create.mockResolvedValue('mp_reactivated');

        const res = await resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT });

        expect(adapter.prices.create).toHaveBeenCalledOnce();
        expect(res).toEqual({ mpPreapprovalPlanId: 'mp_reactivated', created: true });
    });

    it('recovers from a lost insert race: archives the orphan, returns the winner id', async () => {
        findOne
            .mockResolvedValueOnce(null) // pre-insert lookup: miss
            .mockResolvedValueOnce({
                // post-conflict re-read: the winner
                id: 'row-winner',
                mpPreapprovalPlanId: 'mp_winner',
                amountArs: 1_500_000,
                status: 'active'
            });
        create.mockRejectedValue(new Error('duplicate key value violates unique constraint'));
        const adapter = createAdapter();
        adapter.prices.create.mockResolvedValue('mp_orphan');

        const res = await resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT });

        expect(adapter.prices.archive).toHaveBeenCalledWith('mp_orphan');
        expect(res).toEqual({ mpPreapprovalPlanId: 'mp_winner', created: false });
    });

    it('rethrows a create failure that is not the insert race (no winner appears)', async () => {
        findOne.mockResolvedValue(null); // both lookups miss → not the race
        create.mockRejectedValue(new Error('db connection lost'));
        const adapter = createAdapter();

        await expect(resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT })).rejects.toThrow(
            'db connection lost'
        );
    });

    it('passes trialDays 0 (no free trial) and month interval for a notrial monthly variant', async () => {
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();

        await resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT, trialDays: 0 });

        expect(adapter.prices.create).toHaveBeenCalledWith(
            expect.objectContaining({ trialDays: 0, billingInterval: 'month' }),
            expect.any(String)
        );
    });

    it('maps the annual cadence to the qzpay year interval', async () => {
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();

        await resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT, billingInterval: 'annual' });

        expect(adapter.prices.create).toHaveBeenCalledWith(
            expect.objectContaining({ billingInterval: 'year' }),
            expect.any(String)
        );
    });
});

describe('resolveCheckoutMpPlanId', () => {
    const CHECKOUT_INPUT = {
        commercialPlanId: 'plan-uuid',
        planName: 'Basic',
        amountCentavos: 1_500_000,
        currency: 'ARS',
        billingInterval: 'monthly' as const,
        trialDays: 14
    };

    it('throws MP_PLAN_PROVISIONING_FAILED when the payment adapter is unavailable', async () => {
        getBillingPaymentAdapter.mockReturnValue(null);

        await expect(resolveCheckoutMpPlanId(CHECKOUT_INPUT)).rejects.toBeInstanceOf(
            SubscriptionCheckoutError
        );
        await expect(resolveCheckoutMpPlanId(CHECKOUT_INPUT)).rejects.toMatchObject({
            code: 'MP_PLAN_PROVISIONING_FAILED'
        });
    });

    it('returns the resolved MP plan id when the adapter is available', async () => {
        getBillingPaymentAdapter.mockReturnValue(createAdapter());
        findOne.mockResolvedValue({
            id: 'row1',
            mpPreapprovalPlanId: 'mp_existing',
            amountArs: 1_500_000,
            status: 'active'
        });

        const id = await resolveCheckoutMpPlanId(CHECKOUT_INPUT);

        expect(id).toBe('mp_existing');
    });
});
