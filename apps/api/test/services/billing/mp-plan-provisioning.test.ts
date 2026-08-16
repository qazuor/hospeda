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
    buildPreapprovalPlanShareLink,
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

const BACK_URL = 'https://hospeda.com.ar/es/suscriptores/checkout/success/';

const BASE_INPUT = {
    commercialPlanId: 'plan-uuid',
    billingInterval: 'monthly' as const,
    trialDays: 14,
    amountCentavos: 1_500_000,
    // HOS-244: no signup discount by default (sentinel 0 = full price).
    discountCycle1AmountCentavos: 0,
    // H-137: required, because it is what reserves a trial-bearing variant for
    // one buyer instead of sharing it with everyone.
    customerId: 'cus-1',
    currency: 'ARS',
    planName: 'Basic',
    backUrl: BACK_URL
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
        // The back_url MercadoPago requires on preapproval_plan creation must reach
        // the qzpay price input (qzpay-mercadopago 2.5.0 fails fast without it).
        expect(adapter.prices.create).toHaveBeenCalledWith(
            expect.objectContaining({ backUrl: BACK_URL }),
            expect.any(String)
        );
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

    it('HOS-244: provisions at the DISCOUNTED amount and persists the discount dimension on a miss', async () => {
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row-disc' });
        const adapter = createAdapter();
        adapter.prices.create.mockResolvedValue('mp_plan_discounted');

        const res = await resolveOrProvisionMpPlan({
            adapter,
            ...BASE_INPUT,
            // Full price 1_500_000; cycle-1 discounted to 1_050_000 (30% off).
            discountCycle1AmountCentavos: 1_050_000
        });

        // The MP plan is baked at the DISCOUNTED amount, not the full price — this
        // is what makes the preapproval born discounted.
        expect(adapter.prices.create).toHaveBeenCalledWith(
            expect.objectContaining({ unitAmount: 1_050_000 }),
            // The reason marks the discounted variant so operators can tell it
            // apart. H-83: the marker no longer embeds the formatted amount —
            // that fragment is what broke MercadoPago's 60-character limit.
            expect.stringContaining('promo')
        );
        // The row persists the FULL price as the drift snapshot AND the discount dim.
        expect(create).toHaveBeenCalledWith(
            expect.objectContaining({
                amountArs: 1_500_000,
                discountCycle1AmountArs: 1_050_000,
                mpPreapprovalPlanId: 'mp_plan_discounted'
            })
        );
        // The lookup key carries the discount dimension so discounted and
        // full-price variants of the same plan never collide.
        expect(findOne).toHaveBeenCalledWith(
            expect.objectContaining({ discountCycle1AmountArs: 1_050_000 })
        );
        expect(res).toEqual({ mpPreapprovalPlanId: 'mp_plan_discounted', created: true });
    });

    it('HOS-244: no-discount (sentinel 0) provisions at full price and keys the dimension 0', async () => {
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row-full' });
        const adapter = createAdapter();
        adapter.prices.create.mockResolvedValue('mp_plan_full');

        // BASE_INPUT carries discountCycle1AmountCentavos: 0.
        await resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT });

        expect(adapter.prices.create).toHaveBeenCalledWith(
            expect.objectContaining({ unitAmount: 1_500_000 }),
            expect.any(String)
        );
        // No-discount reason must NOT carry the discount marker.
        const reason = adapter.prices.create.mock.calls[0]?.[1] as string;
        expect(reason).not.toContain('desc.');
        expect(create).toHaveBeenCalledWith(
            expect.objectContaining({ discountCycle1AmountArs: 0, amountArs: 1_500_000 })
        );
        expect(findOne).toHaveBeenCalledWith(
            expect.objectContaining({ discountCycle1AmountArs: 0 })
        );
    });

    it('HOS-244: a discounted variant and a full-price variant of the same plan are distinct keys', async () => {
        // A registry hit at the same FULL amount but for the no-discount key must
        // NOT satisfy a discounted lookup — the discount dimension is part of the
        // key, so the discounted checkout misses and provisions its own plan.
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row-disc2' });
        const adapter = createAdapter();
        adapter.prices.create.mockResolvedValue('mp_plan_disc2');

        await resolveOrProvisionMpPlan({
            adapter,
            ...BASE_INPUT,
            discountCycle1AmountCentavos: 900_000
        });

        // Looked up with the discount dimension, provisioned fresh (a full-price
        // row would not have matched this key).
        expect(findOne).toHaveBeenCalledWith(
            expect.objectContaining({
                commercialPlanId: 'plan-uuid',
                billingInterval: 'monthly',
                trialDays: 14,
                discountCycle1AmountArs: 900_000
            })
        );
        expect(adapter.prices.create).toHaveBeenCalledWith(
            expect.objectContaining({ unitAmount: 900_000 }),
            expect.any(String)
        );
    });

    it('re-provisions and archives the stale plan when the commercial price drifted (CAS won)', async () => {
        findOne.mockResolvedValue({
            id: 'row1',
            mpPreapprovalPlanId: 'mp_old',
            amountArs: 999,
            status: 'active'
        });
        // CAS update matches the row (still points at mp_old) → truthy → we win.
        update.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();
        adapter.prices.create.mockResolvedValue('mp_new');

        const res = await resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT });

        expect(adapter.prices.create).toHaveBeenCalledOnce();
        // The conditional update carries the old id in the where-clause (CAS).
        expect(update).toHaveBeenCalledWith(
            { id: 'row1', mpPreapprovalPlanId: 'mp_old' },
            expect.objectContaining({
                mpPreapprovalPlanId: 'mp_new',
                amountArs: 1_500_000,
                status: 'active'
            })
        );
        // Only after winning do we archive the stale plan (not our new one).
        expect(adapter.prices.archive).toHaveBeenCalledWith('mp_old');
        expect(res).toEqual({ mpPreapprovalPlanId: 'mp_new', created: true });
    });

    it('drift CAS lost: archives our orphan plan and returns the concurrent winner id', async () => {
        findOne
            .mockResolvedValueOnce({
                id: 'row1',
                mpPreapprovalPlanId: 'mp_old',
                amountArs: 999,
                status: 'active'
            })
            // Post-failed-CAS re-read: another request already re-provisioned.
            .mockResolvedValueOnce({
                id: 'row1',
                mpPreapprovalPlanId: 'mp_winner',
                amountArs: 1_500_000,
                status: 'active'
            });
        // CAS update matched 0 rows (someone swapped mp_old first) → null → we lost.
        update.mockResolvedValue(null);
        const adapter = createAdapter();
        adapter.prices.create.mockResolvedValue('mp_our_orphan');

        const res = await resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT });

        // Our just-created plan is the orphan → archived; the stale mp_old is NOT
        // archived by us (the winner already handled it).
        expect(adapter.prices.archive).toHaveBeenCalledWith('mp_our_orphan');
        expect(adapter.prices.archive).not.toHaveBeenCalledWith('mp_old');
        expect(res).toEqual({ mpPreapprovalPlanId: 'mp_winner', created: false });
    });

    it('re-provisions when the stored row is inactive even if the amount matches', async () => {
        findOne.mockResolvedValue({
            id: 'row1',
            mpPreapprovalPlanId: 'mp_inactive',
            amountArs: 1_500_000,
            status: 'inactive'
        });
        update.mockResolvedValue({ id: 'row1' });
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

    it('maps the daily cadence (TEST_DAILY_PLAN) to the qzpay day interval', async () => {
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();

        await resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT, billingInterval: 'daily' });

        expect(adapter.prices.create).toHaveBeenCalledWith(
            expect.objectContaining({ billingInterval: 'day' }),
            expect.any(String)
        );
    });

    // HOS-219: the MP plan `reason` is buyer-visible; Hospeda's default locale is
    // `es`, so cadence + trial fragments must be in Spanish (not "monthly"/"Xd trial").
    it('builds the reason in Spanish for a monthly trial variant', async () => {
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();

        await resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT, planName: 'Plus', trialDays: 14 });

        expect(adapter.prices.create).toHaveBeenCalledWith(
            expect.anything(),
            'Plus — mensual — 14 días de prueba'
        );
    });

    it('builds the reason in Spanish for an annual variant', async () => {
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();

        await resolveOrProvisionMpPlan({
            adapter,
            ...BASE_INPUT,
            planName: 'VIP',
            billingInterval: 'annual'
        });

        expect(adapter.prices.create).toHaveBeenCalledWith(
            expect.anything(),
            'VIP — anual — 14 días de prueba'
        );
    });

    it('builds the reason with "sin prueba" for a no-trial variant', async () => {
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();

        await resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT, planName: 'Basic', trialDays: 0 });

        expect(adapter.prices.create).toHaveBeenCalledWith(
            expect.anything(),
            'Basic — mensual — sin prueba'
        );
    });
});

/**
 * H-83 regression suite — the MercadoPago `reason` length budget.
 *
 * MercadoPago rejects `POST /preapproval_plan` with `Reason has more than 60
 * characters`, which qzpay surfaces as `Create price - Reason has more than 60
 * characters` and the checkout maps to a 502. Reproduced in production on
 * 2026-08-13 with `LANZAMIENTO50` on the Basic plan: EVERY discounted checkout
 * failed, because the old discount suffix embedded the formatted price
 * (`— desc. 1er ciclo $9000.00`, 27 chars).
 *
 * The three tests above pin the exact wording; these pin the INVARIANT. The
 * pre-existing suite asserted the reason's content but never its length, which
 * is precisely why it stayed green while production could not sell a single
 * discounted subscription.
 */
describe('H-137: a trial-bearing MP plan variant is reserved for one customer', () => {
    it('keys the registry lookup by customer when the variant carries a trial', async () => {
        // Arrange — MercadoPago grants free_trial once per (payer, plan). While
        // the trial variant was shared, a payer who had already used it there was
        // charged instead, whichever Hospeda account they were buying from.
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();

        // Act
        await resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT, trialDays: 14 });

        // Assert
        expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ customerScope: 'cus-1' }));
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ customerScope: 'cus-1' }));
    });

    it('keeps a no-trial variant shared across every buyer', async () => {
        // Arrange — a trialDays=0 variant carries no free_trial, so MercadoPago
        // has nothing to refuse. A plan per customer would multiply rows in the
        // provider dashboard for no benefit.
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();

        // Act
        await resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT, trialDays: 0 });

        // Assert
        expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ customerScope: 'shared' }));
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ customerScope: 'shared' }));
    });

    it('gives two customers on the same plan variant two different MP plans', async () => {
        // Arrange — this is the whole point. Same commercial plan, same cadence,
        // same trial length: under the old key these two collapsed onto one
        // preapproval_plan, and the second buyer inherited the first one's spent
        // trial whenever they shared a MercadoPago account.
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();
        adapter.prices.create
            .mockResolvedValueOnce('mp_plan_for_a')
            .mockResolvedValueOnce('mp_plan_for_b');

        // Act
        const first = await resolveOrProvisionMpPlan({
            adapter,
            ...BASE_INPUT,
            customerId: 'cus-a'
        });
        const second = await resolveOrProvisionMpPlan({
            adapter,
            ...BASE_INPUT,
            customerId: 'cus-b'
        });

        // Assert
        expect(first.mpPreapprovalPlanId).toBe('mp_plan_for_a');
        expect(second.mpPreapprovalPlanId).toBe('mp_plan_for_b');
        expect(findOne).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ customerScope: 'cus-a' })
        );
        expect(findOne).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ customerScope: 'cus-b' })
        );
    });

    it('still reuses the SAME customer’s existing trial variant instead of re-provisioning', async () => {
        // Arrange — scoping must not turn every checkout attempt into a new
        // provider plan. A customer who abandons the hosted checkout and retries
        // has to land back on the plan already created for them.
        findOne.mockResolvedValue({
            id: 'row1',
            mpPreapprovalPlanId: 'mp_existing_for_cus_1',
            amountArs: 1_500_000,
            status: 'active'
        });
        const adapter = createAdapter();

        // Act
        const res = await resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT });

        // Assert
        expect(res).toEqual({ mpPreapprovalPlanId: 'mp_existing_for_cus_1', created: false });
        expect(adapter.prices.create).not.toHaveBeenCalled();
    });
});

describe('H-83: the MP plan reason never exceeds MercadoPago’s 60-character limit', () => {
    /**
     * MercadoPago's hard limit, restated as a literal rather than imported from
     * the implementation: this is the PROVIDER's contract, so a future edit to
     * our own constant must not be able to relax the assertion with it.
     */
    const MP_LIMIT = 60;

    /** Provision one variant and return the `reason` handed to the price adapter. */
    async function reasonFor(overrides: Record<string, unknown>): Promise<string> {
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row-len' });
        const adapter = createAdapter();
        await resolveOrProvisionMpPlan({ adapter, ...BASE_INPUT, ...overrides });
        return adapter.prices.create.mock.calls[0]?.[1] as string;
    }

    it('reproduces the exact production failure: longest plan name + a discount coupon', async () => {
        // `Test Daily (internal)` is the longest display name in production
        // (21 chars), 30 days is the live accommodation trial, and 1_050_000 is
        // a real cycle-1 discount. Under the old builder this produced a
        // 60+-char reason and MercadoPago rejected the plan outright.
        const reason = await reasonFor({
            planName: 'Test Daily (internal)',
            trialDays: 30,
            amountCentavos: 1_800_000,
            discountCycle1AmountCentavos: 1_050_000
        });

        expect(reason.length).toBeLessThanOrEqual(MP_LIMIT);
        // Truncation alone is not the fix: the buyer must still recognise their
        // own plan, so the plan name has to survive intact at this length.
        expect(reason).toContain('Test Daily (internal)');
    });

    // The whole live catalogue crossed with the live promo shapes. `trialDays`
    // covers 0 (no trial), the 30-day base, and 76 (base + GRUPO_WHATSAPP's 46
    // extra days) — the longest trial actually reachable in production today.
    const PROD_PLAN_NAMES = [
        'Test Daily (internal)',
        'Complex Professional',
        'Commerce Listing',
        'Partner Listing',
        'Complex Premium',
        'Partner Silver',
        'Complex Basic',
        'Professional',
        'Partner Gold',
        'Premium',
        'Basic',
        'Plus',
        'Free',
        'VIP'
    ] as const;

    const INTERVALS = ['monthly', 'annual', 'daily'] as const;
    const TRIAL_DAYS = [0, 30, 76] as const;

    it.each(
        PROD_PLAN_NAMES
    )('stays within the limit for every cadence, trial and discount of plan %s', async (planName) => {
        for (const billingInterval of INTERVALS) {
            for (const trialDays of TRIAL_DAYS) {
                for (const discountCycle1AmountCentavos of [0, 1_050_000]) {
                    const reason = await reasonFor({
                        planName,
                        billingInterval,
                        trialDays,
                        discountCycle1AmountCentavos
                    });
                    expect(
                        reason.length,
                        `${planName}/${billingInterval}/${trialDays}d/disc=${discountCycle1AmountCentavos} produced ${reason.length} chars: "${reason}"`
                    ).toBeLessThanOrEqual(MP_LIMIT);
                }
            }
        }
    });

    // Pins the buyer-visible copy itself, not just its length. This string is the
    // subscription's NAME on the customer's MercadoPago account, so it is product
    // copy: it must read as a plan, and a reviewer must see it change in the diff.
    it.each([
        [
            { planName: 'Basic', trialDays: 30, discountCycle1AmountCentavos: 900_000 },
            'Basic — mensual — 30 días de prueba — promo'
        ],
        [
            { planName: 'Basic', trialDays: 30, discountCycle1AmountCentavos: 0 },
            'Basic — mensual — 30 días de prueba'
        ],
        [
            {
                planName: 'Test Daily (internal)',
                trialDays: 30,
                discountCycle1AmountCentavos: 900_000
            },
            'Test Daily (internal) — mensual — 30 días de prueba — promo'
        ],
        [
            { planName: 'Professional', trialDays: 0, discountCycle1AmountCentavos: 900_000 },
            'Professional — mensual — sin prueba — promo'
        ]
    ])('renders the buyer-visible reason as %o → %s', async (overrides, expected) => {
        const reason = await reasonFor(overrides);
        expect(reason).toBe(expected);
        expect(reason.length).toBeLessThanOrEqual(MP_LIMIT);
    });

    it('marks a discounted variant without embedding the price, which is what blew the budget', async () => {
        const reason = await reasonFor({
            planName: 'Basic',
            trialDays: 30,
            discountCycle1AmountCentavos: 900_000
        });

        // The marker is still there, so an operator can tell a discounted MP
        // plan apart from the full-price one in the dashboard.
        expect(reason).toContain('promo');
        // But the formatted amount is gone. Beyond the length, the old label was
        // also a lie waiting to happen: the promo engine mutates
        // `transaction_amount` back to full price after the discounted cycles,
        // while the plan NAME would have kept advertising the old amount forever.
        expect(reason).not.toContain('$');
        expect(reason).not.toMatch(/\d{3,}/);
    });

    it('leaves a full-price variant unmarked', async () => {
        const reason = await reasonFor({ planName: 'Basic', discountCycle1AmountCentavos: 0 });
        expect(reason).not.toContain('promo');
    });

    it('truncates a plan name that cannot fit rather than letting MercadoPago reject the plan', async () => {
        // No plan is named like this today, but the display name is admin-editable
        // and unbounded, so the builder must degrade instead of failing checkout.
        const reason = await reasonFor({
            planName: 'A'.repeat(120),
            trialDays: 76,
            discountCycle1AmountCentavos: 1_050_000
        });

        expect(reason.length).toBeLessThanOrEqual(MP_LIMIT);
        // The variant fragments are what disambiguate the plan, so they must be
        // the part that survives — the name is the field that gives ground.
        expect(reason).toContain('mensual');
        expect(reason).toContain('promo');
    });

    it('holds even when the trial length is absurd, so no input can produce a 502', async () => {
        const reason = await reasonFor({
            planName: 'Complex Professional',
            trialDays: 999_999,
            discountCycle1AmountCentavos: 1_050_000
        });
        expect(reason.length).toBeLessThanOrEqual(MP_LIMIT);
    });
});

describe('resolveCheckoutMpPlanId', () => {
    const CHECKOUT_INPUT = {
        commercialPlanId: 'plan-uuid',
        planName: 'Basic',
        amountCentavos: 1_500_000,
        currency: 'ARS',
        billingInterval: 'monthly' as const,
        trialDays: 14,
        // H-137 made this required: an optional customer id let a caller fall
        // back to the shared trial variant with no type error.
        customerId: 'cus-1',
        backUrl: BACK_URL
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

    it('wraps a provisioning failure (MP prices.create / registry error) as MP_PLAN_PROVISIONING_FAILED', async () => {
        const adapter = createAdapter();
        adapter.prices.create.mockRejectedValue(new Error('MP 503 Service Unavailable'));
        getBillingPaymentAdapter.mockReturnValue(adapter);
        findOne.mockResolvedValue(null); // miss → provisioning attempted → throws

        await expect(resolveCheckoutMpPlanId(CHECKOUT_INPUT)).rejects.toMatchObject({
            code: 'MP_PLAN_PROVISIONING_FAILED'
        });
    });
});

// ---------------------------------------------------------------------------
// buildPreapprovalPlanShareLink (HOS-209)
// ---------------------------------------------------------------------------

describe('buildPreapprovalPlanShareLink', () => {
    it('builds the hosted checkout URL with the preapproval_plan_id (no external_reference by default)', () => {
        const link = buildPreapprovalPlanShareLink({ mpPreapprovalPlanId: 'mp_plan_abc' });

        const url = new URL(link);
        expect(url.origin + url.pathname).toBe(
            'https://www.mercadopago.com.ar/subscriptions/checkout'
        );
        expect(url.searchParams.get('preapproval_plan_id')).toBe('mp_plan_abc');
        // Backward-compat: no external_reference when the nonce is omitted.
        expect(url.searchParams.has('external_reference')).toBe(false);
    });

    it('appends the nonce as external_reference when provided (HOS-209)', () => {
        const link = buildPreapprovalPlanShareLink({
            mpPreapprovalPlanId: 'mp_plan_abc',
            externalReference: 'nonce-abc-123'
        });

        const url = new URL(link);
        expect(url.searchParams.get('preapproval_plan_id')).toBe('mp_plan_abc');
        expect(url.searchParams.get('external_reference')).toBe('nonce-abc-123');
    });

    it('URL-encodes an external_reference containing reserved characters', () => {
        // Nonces are hex today, but the builder must not emit an invalid URL if
        // a value ever contains reserved characters.
        const link = buildPreapprovalPlanShareLink({
            mpPreapprovalPlanId: 'mp_plan_abc',
            externalReference: 'a b&c=d'
        });

        // The raw string must be percent-encoded in the URL...
        expect(link).toContain('external_reference=a+b%26c%3Dd');
        // ...and round-trip back to the original value when parsed.
        expect(new URL(link).searchParams.get('external_reference')).toBe('a b&c=d');
    });

    // Future-proofing: the real nonce is always a non-empty 32-char hex string
    // (randomBytes), so this short-circuit is defensive for the general-purpose
    // builder rather than a reachable production case.
    it('does not append external_reference for an empty-string nonce', () => {
        const link = buildPreapprovalPlanShareLink({
            mpPreapprovalPlanId: 'mp_plan_abc',
            externalReference: ''
        });

        expect(new URL(link).searchParams.has('external_reference')).toBe(false);
    });
});
