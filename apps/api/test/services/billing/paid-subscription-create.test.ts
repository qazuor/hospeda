/**
 * Unit tests for the shared paid-subscription-create helper (HOS-114 T-002).
 *
 * Covers:
 * - Happy path: `subscriptions.create` is called with `mode: 'paid'` +
 *   the passed `priceId` + `paymentMethodReturnUrl`, and the result carries
 *   the live `providerInitPoint` as `checkoutUrl`.
 * - Sandbox fallback: `providerInitPoint` absent, `providerSandboxInitPoint`
 *   present -> `checkoutUrl` resolves to the sandbox URL.
 * - Fail-closed: both init points absent -> throws
 *   `SubscriptionCheckoutError('MISSING_INIT_POINT')` with NO further side
 *   effects (nothing else is called on the billing mock).
 *
 * @module test/services/billing/paid-subscription-create
 */

import { getDb } from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPaidSubscription } from '../../../src/services/billing/paid-subscription-create';
import { SubscriptionCheckoutError } from '../../../src/services/billing/subscription-checkout-error';
import { mockPlanDomainRead, mockPlanDomainReadMissing } from '../../helpers/plan-domain-read';

const CUSTOMER_ID = 'cust_owner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const PRICE_ID = 'price_monthly_1';
const LOCAL_SUB_ID = '11111111-1111-4111-8111-111111111111';

const URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/billing/return',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

interface BillingMockOpts {
    subscription?: {
        id: string;
        providerInitPoint?: string;
        providerSandboxInitPoint?: string;
        providerSubscriptionIds?: { mercadopago?: string };
    };
}

function createBillingMock(opts: BillingMockOpts = {}) {
    const subscription = opts.subscription ?? {
        id: LOCAL_SUB_ID,
        providerInitPoint: 'https://mp.test/checkout/abc',
        providerSandboxInitPoint: 'https://sandbox.mp.test/checkout/abc',
        // HOS-151 Bug C: a valid paid preapproval always carries a provider
        // subscription id — the helper now rejects a response without one.
        providerSubscriptionIds: { mercadopago: 'mp_preapproval_abc' }
    };

    return {
        subscriptions: {
            create: vi.fn().mockResolvedValue(subscription),
            cancel: vi.fn().mockResolvedValue(undefined)
        }
    };
}

describe('createPaidSubscription', () => {
    beforeEach(() => {
        // HOS-1233 T-032: the helper reads the plan's own product_domain before
        // creating the preapproval, and fails closed when it finds no plan.
        mockPlanDomainRead();
    });

    // The two assertions AC-15e is actually about. They are written as a PAIR
    // because the spec's §9 says so in as many words: both checkouts arrive
    // here down the same code path with only `planId` telling them apart, so a
    // hardcoded forward would satisfy one and not the other. One test alone
    // cannot tell "resolved from the plan" from "always accommodation".
    it('states the domain the ACCOMMODATION plan reports', async () => {
        const billing = createBillingMock();
        mockPlanDomainRead(ProductDomainEnum.ACCOMMODATION);

        await createPaidSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl
        });

        expect(billing.subscriptions.create).toHaveBeenCalledWith(
            expect.objectContaining({ productDomain: ProductDomainEnum.ACCOMMODATION })
        );
    });

    it('states the domain the TOURIST plan reports, from the same code path', async () => {
        const billing = createBillingMock();
        mockPlanDomainRead(ProductDomainEnum.TOURIST);

        await createPaidSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl
        });

        expect(billing.subscriptions.create).toHaveBeenCalledWith(
            expect.objectContaining({ productDomain: ProductDomainEnum.TOURIST })
        );
    });

    it('fails CLOSED when the plan cannot be found — it does not guess a domain', async () => {
        const billing = createBillingMock();
        mockPlanDomainReadMissing();

        await expect(
            createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl
            })
        ).rejects.toMatchObject({ code: 'PLAN_NOT_FOUND' });

        // And no preapproval is created at MercadoPago on the way out.
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('returns checkoutUrl + subscription when the provider init point is present', async () => {
        const billing = createBillingMock();

        const result = await createPaidSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl
        });

        expect(result.checkoutUrl).toBe('https://mp.test/checkout/abc');
        expect(result.subscription.id).toBe(LOCAL_SUB_ID);
    });

    it('falls back to the sandbox init point when the provider init point is absent', async () => {
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID,
                providerSandboxInitPoint: 'https://sandbox.mp.test/checkout/xyz',
                providerSubscriptionIds: { mercadopago: 'mp_preapproval_xyz' }
            }
        });

        const result = await createPaidSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl
        });

        expect(result.checkoutUrl).toBe('https://sandbox.mp.test/checkout/xyz');
    });

    it('throws SubscriptionCheckoutError(MISSING_INIT_POINT) when both init points are absent, with no further side effects', async () => {
        const billing = createBillingMock({
            subscription: { id: LOCAL_SUB_ID }
        });

        await expect(
            createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl
            })
        ).rejects.toMatchObject({
            name: 'SubscriptionCheckoutError',
            code: 'MISSING_INIT_POINT'
        });

        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
        expect(billing.subscriptions.cancel).not.toHaveBeenCalled();
    });

    it('throws a real SubscriptionCheckoutError instance', async () => {
        const billing = createBillingMock({ subscription: { id: LOCAL_SUB_ID } });

        try {
            await createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl
            });
            expect.unreachable('createPaidSubscription should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(SubscriptionCheckoutError);
        }
    });

    it('calls subscriptions.create with mode:"paid", the passed priceId, and paymentMethodReturnUrl', async () => {
        const billing = createBillingMock();

        await createPaidSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            metadata: { source: 'unit-test' }
        });

        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call).toMatchObject({
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            mode: 'paid',
            billingInterval: 'monthly',
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            metadata: { source: 'unit-test' }
        });
    });

    // HOS-1012: `freeTrialDays` is no longer part of the input at all, so this
    // is now unconditional rather than a "when not supplied" case — there is no
    // supplied case left. See `check-no-trial-to-mercadopago.sh` (guard G-1).
    it('never puts a trial field in the create payload, and omits metadata when not supplied', async () => {
        const billing = createBillingMock();

        await createPaidSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl
        });

        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call).not.toHaveProperty('freeTrialDays');
        expect(call).not.toHaveProperty('free_trial');
        expect(call).not.toHaveProperty('startDate');
        expect(call).not.toHaveProperty('start_date');
        expect(call).not.toHaveProperty('metadata');
    });

    // ── HOS-1221 D2: the amount override ─────────────────────────────────────
    // `providerUnitAmountOverride` is what carries a signup discount now that
    // the discount can no longer be baked into a MercadoPago plan. qzpay and
    // the MercadoPago adapter both read it with `!== undefined` because `0` is
    // a legitimate override, so this helper has to forward it by the same rule.

    it('forwards providerUnitAmountOverride and planDisplayName when supplied', async () => {
        const billing = createBillingMock();

        await createPaidSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            providerUnitAmountOverride: 900_000,
            planDisplayName: 'Anfitrión Básico'
        });

        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.providerUnitAmountOverride).toBe(900_000);
        expect(call.planDisplayName).toBe('Anfitrión Básico');
    });

    it('omits both when they are not supplied', async () => {
        const billing = createBillingMock();

        await createPaidSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl
        });

        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        // Absent, not `undefined`-valued: qzpay distinguishes the two.
        expect(call).not.toHaveProperty('providerUnitAmountOverride');
        expect(call).not.toHaveProperty('planDisplayName');
    });

    /**
     * The case a truthiness check gets wrong, and the reason the forwarding is
     * written `=== undefined ? {} : {...}`.
     *
     * `0` means "charge nothing this cycle", which is a real instruction — not
     * "no override". A `providerUnitAmountOverride ? ... : ...` here drops it
     * and the buyer is charged the full price row instead, silently. That is
     * the same class of bug as the plan-id one this issue is about: a value
     * that looks absent because of how it was tested.
     */
    it('forwards an override of 0 — it is an amount, not an absence', async () => {
        const billing = createBillingMock();

        await createPaidSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            providerUnitAmountOverride: 0
        });

        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call).toHaveProperty('providerUnitAmountOverride');
        expect(call.providerUnitAmountOverride).toBe(0);
    });

    it('forwards an empty planDisplayName rather than second-guessing it', async () => {
        const billing = createBillingMock();

        await createPaidSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            planDisplayName: '   '
        });

        // The adapter already trims and falls back on a blank value. Deciding
        // that here too would put the same rule in two places, free to drift.
        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.planDisplayName).toBe('   ');
    });

    // ── HOS-151 Bug C: reject an id-less MP preapproval ───────────────────────
    // MP can return a 2xx preapproval with no provider subscription id. Before
    // the fix this persisted a live `incomplete` row with `mp_subscription_id =
    // ''` that could never activate (webhook lookup keys on the id) and whose
    // preapproval could never be located to cancel. The helper must now fail
    // loudly with MISSING_PROVIDER_SUBSCRIPTION_ID after cleaning up the row.

    it('throws MISSING_PROVIDER_SUBSCRIPTION_ID and cancels the row when the provider id is an empty string', async () => {
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID,
                providerInitPoint: 'https://mp.test/checkout/abc',
                providerSubscriptionIds: { mercadopago: '' }
            }
        });

        await expect(
            createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl
            })
        ).rejects.toMatchObject({
            name: 'SubscriptionCheckoutError',
            code: 'MISSING_PROVIDER_SUBSCRIPTION_ID'
        });

        // The just-created local row is cancelled (fail-closed) so no unlinkable
        // `incomplete` row survives.
        expect(billing.subscriptions.cancel).toHaveBeenCalledTimes(1);
        expect(billing.subscriptions.cancel).toHaveBeenCalledWith(LOCAL_SUB_ID);
    });

    it('throws MISSING_PROVIDER_SUBSCRIPTION_ID when providerSubscriptionIds is entirely absent', async () => {
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID,
                providerInitPoint: 'https://mp.test/checkout/abc'
                // no providerSubscriptionIds at all
            }
        });

        await expect(
            createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl
            })
        ).rejects.toMatchObject({ code: 'MISSING_PROVIDER_SUBSCRIPTION_ID' });

        expect(billing.subscriptions.cancel).toHaveBeenCalledTimes(1);
    });

    it('still throws MISSING_PROVIDER_SUBSCRIPTION_ID when the best-effort cleanup cancel itself fails', async () => {
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID,
                providerInitPoint: 'https://mp.test/checkout/abc',
                providerSubscriptionIds: { mercadopago: '' }
            }
        });
        // The cleanup cancel fails — the abandoned-pending cron is the backstop;
        // the original id-less error must still surface (cleanup is best-effort).
        billing.subscriptions.cancel.mockRejectedValueOnce(new Error('MP unreachable'));

        await expect(
            createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl
            })
        ).rejects.toMatchObject({ code: 'MISSING_PROVIDER_SUBSCRIPTION_ID' });

        expect(billing.subscriptions.cancel).toHaveBeenCalledTimes(1);
    });

    // ── HOS-1310: the cleanup must land on a status the liveness predicates
    // refuse. qzpay's cancel() leaves `canceled`, and qzpay stamped
    // `current_period_end = now + 30 days` at INSERT before any payment — so a
    // `canceled` row from a never-authorized checkout reads as LIVE to
    // `isSubscriptionLive` (its `cancelled` branch grants access while the
    // period end is in the future) and short-circuits the owner's local trial.

    /**
     * Arms `getDb()` with a capturing `update().set().where()` chain, merged onto
     * whatever the suite already armed (the plan-domain read) rather than
     * replacing it — the same merge discipline `mockPlanDomainRead` documents.
     */
    function captureTerminalStatusWrite() {
        const where = vi.fn().mockResolvedValue(undefined);
        const set = vi.fn((_values: Record<string, unknown>) => ({ where }));
        const update = vi.fn((_table: unknown) => ({ set }));
        const existing = (vi.mocked(getDb).getMockImplementation()?.() ?? {}) as Record<
            string,
            unknown
        >;
        vi.mocked(getDb).mockReturnValue({ ...existing, update } as never);
        return { update, set, where };
    }

    it('writes the terminal abandoned status after the cleanup cancel (HOS-1310)', async () => {
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID,
                providerInitPoint: 'https://mp.test/checkout/abc',
                providerSubscriptionIds: { mercadopago: '' }
            }
        });
        const { update, set } = captureTerminalStatusWrite();

        await expect(
            createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl
            })
        ).rejects.toMatchObject({ code: 'MISSING_PROVIDER_SUBSCRIPTION_ID' });

        // Asserted, not assumed: the write sits inside a try/catch that only
        // logs, so a chain that threw would leave this test green without it.
        expect(update).toHaveBeenCalledOnce();
        expect(set).toHaveBeenCalledOnce();
        const written = set.mock.calls[0]?.[0] ?? {};
        expect(written.status).toBe('abandoned');
        // NOT qzpay's spelling, and not the British one either: both reach
        // `isSubscriptionLive`'s paid-through branch, which is the bug.
        expect(written.status).not.toBe('canceled');
        expect(written.status).not.toBe('cancelled');
    });

    it('still writes the terminal status when the cleanup cancel itself failed (HOS-1310)', async () => {
        // The ordering that matters: a cancel that threw must not skip the
        // terminal write, or the row keeps whatever status it had (`incomplete`)
        // with a 30-day period end and waits on the cron.
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID,
                providerInitPoint: 'https://mp.test/checkout/abc',
                providerSubscriptionIds: { mercadopago: '' }
            }
        });
        billing.subscriptions.cancel.mockRejectedValueOnce(new Error('MP unreachable'));
        const { set } = captureTerminalStatusWrite();

        await expect(
            createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl
            })
        ).rejects.toMatchObject({ code: 'MISSING_PROVIDER_SUBSCRIPTION_ID' });

        expect(set).toHaveBeenCalledOnce();
        expect(set.mock.calls[0]?.[0]?.status).toBe('abandoned');
    });

    it('does NOT reach the provider-id guard when the checkout URL is missing (MISSING_INIT_POINT wins first)', async () => {
        // A response missing BOTH the init point and the provider id fails at the
        // init-point guard first, with no cleanup cancel — preserving the
        // pre-existing MISSING_INIT_POINT contract.
        const billing = createBillingMock({
            subscription: { id: LOCAL_SUB_ID, providerSubscriptionIds: { mercadopago: '' } }
        });

        await expect(
            createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl
            })
        ).rejects.toMatchObject({ code: 'MISSING_INIT_POINT' });

        expect(billing.subscriptions.cancel).not.toHaveBeenCalled();
    });
});
