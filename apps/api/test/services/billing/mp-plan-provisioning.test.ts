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

describe('resolveCheckoutMpPlanId', () => {
    const CHECKOUT_INPUT = {
        commercialPlanId: 'plan-uuid',
        planName: 'Basic',
        amountCentavos: 1_500_000,
        currency: 'ARS',
        billingInterval: 'monthly' as const,
        trialDays: 14,
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
