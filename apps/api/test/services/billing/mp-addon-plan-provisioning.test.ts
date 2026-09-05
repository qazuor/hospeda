/**
 * Unit tests for the HOS-847 MercadoPago ADD-ON plan provisioning service.
 *
 * Covers the resolution branches of {@link resolveOrProvisionMpAddonPlan}:
 * - registry hit at the same amount → reuse the stored id, no MP call;
 * - registry hit with amount drift → re-provision + archive the stale plan;
 * - miss → provision + insert;
 * - lost CAS / lost insert race → archive the orphan, return the winner's id;
 * plus a genuine (non-race) failure that must surface, the cadence mapping, the
 * buyer-visible `reason`, and — the point of the whole file — the BEHAVIOURAL
 * assertion that the `QZPayCreatePriceInput` actually handed to the price adapter
 * carries `trialDays: 0`.
 *
 * ## Why the trial assertion is the load-bearing one
 *
 * `scripts/check-no-trial-to-mercadopago.sh` (guard G-1) bans
 * `freeTrialDays|freeTrial|free_trial|start_date` in object-literal position, but
 * NOT `trialDays` — which is the real spelling of the qzpay price field. So a free
 * trial can reach MercadoPago through this exact field without CI noticing. The
 * closure is a module constant plus these tests, not a wider guard (widening the
 * guard would break the legitimate call site in `mp-plan-provisioning.service.ts`
 * and end in a bolted-on escape hatch).
 *
 * The assertions below use `toStrictEqual` on the WHOLE payload rather than
 * `expect.objectContaining`, deliberately: `objectContaining` is blind to a field
 * that disappears from the payload under a rename, and `toEqual` ignores keys whose
 * value is `undefined` — either would let `trialDays` quietly stop being sent.
 *
 * @module test/services/billing/mp-addon-plan-provisioning
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findOne, create, update, getBillingPaymentAdapter } = vi.hoisted(() => ({
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    getBillingPaymentAdapter: vi.fn()
}));

vi.mock('@repo/db', () => ({
    billingMpAddonPlanModel: { findOne, create, update }
}));

vi.mock('../../../src/middlewares/billing', () => ({
    getBillingPaymentAdapter
}));

import {
    resolveCheckoutMpAddonPlanId,
    resolveOrProvisionMpAddonPlan
} from '../../../src/services/billing/mp-addon-plan-provisioning.service';
import { SubscriptionCheckoutError } from '../../../src/services/billing/subscription-checkout-error';

function createAdapter() {
    return {
        prices: {
            create: vi.fn().mockResolvedValue('mp_addon_plan_new'),
            archive: vi.fn().mockResolvedValue(undefined)
        }
        // Partial adapter stub: only the `prices` slot is under test.
    } as any;
}

const BACK_URL = 'https://hospeda.com.ar/es/suscriptores/addons/success/';

const BASE_INPUT = {
    addonId: 'addon-uuid',
    billingInterval: 'monthly' as const,
    amountCentavos: 500_000,
    currency: 'ARS',
    addonName: 'Visibility Boost',
    backUrl: BACK_URL
};

/** The exact `QZPayCreatePriceInput` BASE_INPUT must produce — every key, no extras. */
const EXPECTED_BASE_PRICE_INPUT = {
    planId: 'addon-uuid',
    currency: 'ARS',
    unitAmount: 500_000,
    billingInterval: 'month',
    intervalCount: 1,
    trialDays: 0,
    backUrl: BACK_URL
};

/**
 * The `QZPayCreatePriceInput` handed to the adapter on its first (or only) call.
 * `adapter` is the untyped stub from {@link createAdapter}.
 */
function priceInputOf(adapter: any): Record<string, unknown> {
    return adapter.prices.create.mock.calls[0]?.[0] as Record<string, unknown>;
}

beforeEach(() => {
    findOne.mockReset();
    create.mockReset();
    update.mockReset();
    getBillingPaymentAdapter.mockReset();
});

describe('resolveOrProvisionMpAddonPlan', () => {
    it('reuses the stored id without an MP call on a registry hit at the same amount', async () => {
        findOne.mockResolvedValue({
            id: 'row1',
            mpPreapprovalPlanId: 'mp_addon_existing',
            amountArs: 500_000,
            status: 'active'
        });
        const adapter = createAdapter();

        const res = await resolveOrProvisionMpAddonPlan({ adapter, ...BASE_INPUT });

        expect(res).toEqual({ mpPreapprovalPlanId: 'mp_addon_existing', created: false });
        expect(adapter.prices.create).not.toHaveBeenCalled();
        expect(adapter.prices.archive).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('looks the variant up by (addonId, billingInterval) and nothing else', async () => {
        // The add-on registry has no trial_days / discount dimension. A key carrying
        // extra fields would never match a row written by a different call site.
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();

        await resolveOrProvisionMpAddonPlan({ adapter, ...BASE_INPUT });

        expect(findOne).toHaveBeenCalledWith({
            addonId: 'addon-uuid',
            billingInterval: 'monthly'
        });
    });

    it('provisions and inserts on a registry miss', async () => {
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();
        adapter.prices.create.mockResolvedValue('mp_addon_new');

        const res = await resolveOrProvisionMpAddonPlan({ adapter, ...BASE_INPUT });

        expect(adapter.prices.create).toHaveBeenCalledOnce();
        expect(create).toHaveBeenCalledWith({
            addonId: 'addon-uuid',
            billingInterval: 'monthly',
            mpPreapprovalPlanId: 'mp_addon_new',
            amountArs: 500_000,
            status: 'active'
        });
        expect(res).toEqual({ mpPreapprovalPlanId: 'mp_addon_new', created: true });
    });

    it('re-provisions and archives the stale plan when the catalog price drifted (CAS won)', async () => {
        findOne.mockResolvedValue({
            id: 'row1',
            mpPreapprovalPlanId: 'mp_addon_old',
            amountArs: 300_000,
            status: 'active'
        });
        // CAS update matches the row (still points at mp_addon_old) → truthy → we win.
        update.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();
        adapter.prices.create.mockResolvedValue('mp_addon_new');

        const res = await resolveOrProvisionMpAddonPlan({ adapter, ...BASE_INPUT });

        expect(adapter.prices.create).toHaveBeenCalledOnce();
        // The conditional update carries the old id in the where-clause (CAS).
        expect(update).toHaveBeenCalledWith(
            { id: 'row1', mpPreapprovalPlanId: 'mp_addon_old' },
            {
                mpPreapprovalPlanId: 'mp_addon_new',
                amountArs: 500_000,
                status: 'active'
            }
        );
        // Only after winning do we archive the stale plan (not our new one).
        expect(adapter.prices.archive).toHaveBeenCalledWith('mp_addon_old');
        expect(adapter.prices.archive).not.toHaveBeenCalledWith('mp_addon_new');
        expect(res).toEqual({ mpPreapprovalPlanId: 'mp_addon_new', created: true });
    });

    it('drift CAS lost: archives our orphan plan and returns the concurrent winner id', async () => {
        findOne
            .mockResolvedValueOnce({
                id: 'row1',
                mpPreapprovalPlanId: 'mp_addon_old',
                amountArs: 300_000,
                status: 'active'
            })
            // Post-failed-CAS re-read: another request already re-provisioned.
            .mockResolvedValueOnce({
                id: 'row1',
                mpPreapprovalPlanId: 'mp_addon_winner',
                amountArs: 500_000,
                status: 'active'
            });
        // CAS update matched 0 rows (someone swapped the id first) → null → we lost.
        update.mockResolvedValue(null);
        const adapter = createAdapter();
        adapter.prices.create.mockResolvedValue('mp_addon_our_orphan');

        const res = await resolveOrProvisionMpAddonPlan({ adapter, ...BASE_INPUT });

        // Our just-created plan is the orphan → archived; the stale old plan is NOT
        // archived by us (the winner already handled it).
        expect(adapter.prices.archive).toHaveBeenCalledWith('mp_addon_our_orphan');
        expect(adapter.prices.archive).not.toHaveBeenCalledWith('mp_addon_old');
        expect(res).toEqual({ mpPreapprovalPlanId: 'mp_addon_winner', created: false });
    });

    it('drift CAS lost with the row gone: keeps our new plan instead of archiving what it returns', async () => {
        // Pathological (nothing deletes billing_mp_addon_plans today), but the order
        // matters: archiving before re-reading would retire the very id handed back.
        findOne
            .mockResolvedValueOnce({
                id: 'row1',
                mpPreapprovalPlanId: 'mp_addon_old',
                amountArs: 300_000,
                status: 'active'
            })
            .mockResolvedValueOnce(null);
        update.mockResolvedValue(null);
        const adapter = createAdapter();
        adapter.prices.create.mockResolvedValue('mp_addon_ours');

        const res = await resolveOrProvisionMpAddonPlan({ adapter, ...BASE_INPUT });

        expect(res).toEqual({ mpPreapprovalPlanId: 'mp_addon_ours', created: true });
        expect(adapter.prices.archive).not.toHaveBeenCalledWith('mp_addon_ours');
    });

    it('re-provisions when the stored row is archived even if the amount matches', async () => {
        findOne.mockResolvedValue({
            id: 'row1',
            mpPreapprovalPlanId: 'mp_addon_inactive',
            amountArs: 500_000,
            status: 'inactive'
        });
        update.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();
        adapter.prices.create.mockResolvedValue('mp_addon_reactivated');

        const res = await resolveOrProvisionMpAddonPlan({ adapter, ...BASE_INPUT });

        expect(adapter.prices.create).toHaveBeenCalledOnce();
        expect(res).toEqual({ mpPreapprovalPlanId: 'mp_addon_reactivated', created: true });
    });

    it('recovers from a lost insert race: archives the orphan, returns the winner id', async () => {
        findOne
            .mockResolvedValueOnce(null) // pre-insert lookup: miss
            .mockResolvedValueOnce({
                // post-conflict re-read: the winner
                id: 'row-winner',
                mpPreapprovalPlanId: 'mp_addon_winner',
                amountArs: 500_000,
                status: 'active'
            });
        create.mockRejectedValue(new Error('duplicate key value violates unique constraint'));
        const adapter = createAdapter();
        adapter.prices.create.mockResolvedValue('mp_addon_orphan');

        const res = await resolveOrProvisionMpAddonPlan({ adapter, ...BASE_INPUT });

        expect(adapter.prices.archive).toHaveBeenCalledWith('mp_addon_orphan');
        expect(res).toEqual({ mpPreapprovalPlanId: 'mp_addon_winner', created: false });
    });

    it('rethrows an insert failure that is not the race (no winner appears)', async () => {
        findOne.mockResolvedValue(null); // both lookups miss → not the race
        create.mockRejectedValue(new Error('db connection lost'));
        const adapter = createAdapter();

        await expect(resolveOrProvisionMpAddonPlan({ adapter, ...BASE_INPUT })).rejects.toThrow(
            'db connection lost'
        );
    });

    it('propagates a genuine MercadoPago failure instead of swallowing it', async () => {
        findOne.mockResolvedValue(null);
        const adapter = createAdapter();
        adapter.prices.create.mockRejectedValue(new Error('MP 503 Service Unavailable'));

        await expect(resolveOrProvisionMpAddonPlan({ adapter, ...BASE_INPUT })).rejects.toThrow(
            'MP 503 Service Unavailable'
        );
        // Nothing was written when the provider refused to create the plan.
        expect(create).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('maps the annual cadence to the qzpay year interval', async () => {
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();

        await resolveOrProvisionMpAddonPlan({
            adapter,
            ...BASE_INPUT,
            billingInterval: 'annual'
        });

        expect(priceInputOf(adapter)).toStrictEqual({
            ...EXPECTED_BASE_PRICE_INPUT,
            billingInterval: 'year'
        });
    });
});

/**
 * HOS-847 §2.2 — the behavioural half of the trial closure.
 *
 * `trialDays` is a module constant of `0`, not an input field. These tests assert
 * the payload actually built and handed to `adapter.prices.create`, never a
 * constant re-declared in this file.
 */
describe('the price input sent to MercadoPago never carries a free trial', () => {
    it('builds a price input with trialDays: 0 and nothing else (whole-payload shape)', async () => {
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();

        await resolveOrProvisionMpAddonPlan({ adapter, ...BASE_INPUT });

        // toStrictEqual, not objectContaining: a renamed/dropped `trialDays` must
        // fail here, and a key whose value is `undefined` must not pass as absent.
        expect(priceInputOf(adapter)).toStrictEqual(EXPECTED_BASE_PRICE_INPUT);
    });

    it('sends a trialDays the MercadoPago adapter treats as "no free trial"', async () => {
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();

        await resolveOrProvisionMpAddonPlan({ adapter, ...BASE_INPUT });

        const priceInput = priceInputOf(adapter);
        // The MercadoPago price adapter gates on `if (input.trialDays)` — a TRUTHY
        // check — so a falsy value makes it omit `auto_recurring.free_trial` from
        // the MP payload entirely. Any positive number would promise free days
        // (HOS-522: MP advertised 14 and charged ARS 18.000 in 118 seconds).
        expect(priceInput.trialDays).toBe(0);
        expect(priceInput.trialDays).toBeFalsy();
    });

    it('ignores a trialDays smuggled onto the input: the constant wins', async () => {
        // The input type has no `trialDays` field, so this cast is the only way a
        // caller could try. If the implementation ever read the input instead of the
        // module constant, this is what catches it.
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();

        await resolveOrProvisionMpAddonPlan({
            adapter,
            ...BASE_INPUT,
            trialDays: 30
            // The cast is the violation: the input contract has no such field.
        } as any);

        expect(priceInputOf(adapter)).toStrictEqual(EXPECTED_BASE_PRICE_INPUT);
    });

    it('holds on every cadence', async () => {
        for (const billingInterval of ['monthly', 'annual'] as const) {
            findOne.mockResolvedValue(null);
            create.mockResolvedValue({ id: 'row1' });
            const adapter = createAdapter();

            await resolveOrProvisionMpAddonPlan({ adapter, ...BASE_INPUT, billingInterval });

            expect(priceInputOf(adapter).trialDays, `cadence ${billingInterval}`).toBe(0);
        }
    });

    it('holds on the drift re-provisioning path too, not just the first provision', async () => {
        findOne.mockResolvedValue({
            id: 'row1',
            mpPreapprovalPlanId: 'mp_addon_old',
            amountArs: 300_000,
            status: 'active'
        });
        update.mockResolvedValue({ id: 'row1' });
        const adapter = createAdapter();

        await resolveOrProvisionMpAddonPlan({ adapter, ...BASE_INPUT });

        expect(priceInputOf(adapter)).toStrictEqual(EXPECTED_BASE_PRICE_INPUT);
    });
});

/**
 * The `reason` is the add-on's NAME on the buyer's MercadoPago account, so it is
 * product copy: it must read in Spanish (Hospeda's default locale) and must fit
 * MercadoPago's 60-character cap, which rejects the plan outright when exceeded.
 */
describe('the buyer-visible MP add-on plan reason', () => {
    /** MercadoPago's limit, restated as a literal so an edit to our own constant cannot relax it. */
    const MP_LIMIT = 60;

    async function reasonFor(overrides: Record<string, unknown>): Promise<string> {
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row-reason' });
        const adapter = createAdapter();
        await resolveOrProvisionMpAddonPlan({ adapter, ...BASE_INPUT, ...overrides });
        return adapter.prices.create.mock.calls[0]?.[1] as string;
    }

    it.each([
        [
            { addonName: 'Visibility Boost', billingInterval: 'monthly' },
            'Visibility Boost — mensual'
        ],
        [{ addonName: 'Visibility Boost', billingInterval: 'annual' }, 'Visibility Boost — anual']
    ])('renders %o as %s', async (overrides, expected) => {
        const reason = await reasonFor(overrides);
        expect(reason).toBe(expected);
        expect(reason.length).toBeLessThanOrEqual(MP_LIMIT);
    });

    it('never leaks the English cadence literal', async () => {
        const reason = await reasonFor({ billingInterval: 'annual' });
        expect(reason).not.toContain('annual');
        expect(reason).not.toContain('monthly');
    });

    it('truncates an add-on name that cannot fit rather than letting MercadoPago reject the plan', async () => {
        // Add-on display names are admin-editable and unbounded, so the builder must
        // degrade instead of failing checkout with MP's opaque 400.
        const reason = await reasonFor({ addonName: 'A'.repeat(120), billingInterval: 'annual' });

        expect(reason.length).toBeLessThanOrEqual(MP_LIMIT);
        // The cadence is what disambiguates two plans for the same add-on, so it is
        // the fragment that must survive — the name is what gives ground.
        expect(reason).toContain('anual');
        expect(reason).toContain('…');
    });
});

describe('resolveCheckoutMpAddonPlanId', () => {
    const CHECKOUT_INPUT = {
        addonId: 'addon-uuid',
        addonName: 'Visibility Boost',
        amountCentavos: 500_000,
        currency: 'ARS',
        billingInterval: 'monthly' as const,
        backUrl: BACK_URL
    };

    it('throws MP_PLAN_PROVISIONING_FAILED when the payment adapter is unavailable', async () => {
        getBillingPaymentAdapter.mockReturnValue(null);

        await expect(resolveCheckoutMpAddonPlanId(CHECKOUT_INPUT)).rejects.toBeInstanceOf(
            SubscriptionCheckoutError
        );
        await expect(resolveCheckoutMpAddonPlanId(CHECKOUT_INPUT)).rejects.toMatchObject({
            code: 'MP_PLAN_PROVISIONING_FAILED'
        });
    });

    it('returns the resolved MP plan id when the adapter is available', async () => {
        getBillingPaymentAdapter.mockReturnValue(createAdapter());
        findOne.mockResolvedValue({
            id: 'row1',
            mpPreapprovalPlanId: 'mp_addon_existing',
            amountArs: 500_000,
            status: 'active'
        });

        const id = await resolveCheckoutMpAddonPlanId(CHECKOUT_INPUT);

        expect(id).toBe('mp_addon_existing');
    });

    it('wraps a provisioning failure (MP prices.create / registry error) as MP_PLAN_PROVISIONING_FAILED', async () => {
        const adapter = createAdapter();
        adapter.prices.create.mockRejectedValue(new Error('MP 503 Service Unavailable'));
        getBillingPaymentAdapter.mockReturnValue(adapter);
        findOne.mockResolvedValue(null); // miss → provisioning attempted → throws

        await expect(resolveCheckoutMpAddonPlanId(CHECKOUT_INPUT)).rejects.toMatchObject({
            code: 'MP_PLAN_PROVISIONING_FAILED'
        });
    });

    it('sends trialDays: 0 through the checkout entry point as well', async () => {
        const adapter = createAdapter();
        getBillingPaymentAdapter.mockReturnValue(adapter);
        findOne.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'row1' });

        await resolveCheckoutMpAddonPlanId(CHECKOUT_INPUT);

        expect(priceInputOf(adapter)).toStrictEqual(EXPECTED_BASE_PRICE_INPUT);
    });
});
