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

import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPaidSubscription } from '../../../src/services/billing/paid-subscription-create';
import { SubscriptionCheckoutError } from '../../../src/services/billing/subscription-checkout-error';
import { matchesCondition } from '../../helpers/drizzle-condition';
import {
    mockExistingSubscriptionsRead,
    mockPlanDomainRead,
    mockPlanDomainReadMissing
} from '../../helpers/plan-domain-read';

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

/**
 * A `db` stand-in for the HOS-151 Bug C cleanup write, holding ONE mutable
 * `billing_subscriptions` row (HOS-1326).
 *
 * The cleanup's UPDATE is guarded on the row still being pending AND still
 * unlinked, so a mock that echoed a row unconditionally could not tell "wrote
 * the terminal status" from "matched nothing and moved on". This one applies the
 * same precondition the SQL does and exposes the status the row ends up with —
 * the assertion that separates `abandoned` (right) from the `canceled` that
 * `billing.subscriptions.cancel()` used to leave here: the wrong word for a
 * checkout that never started, in the qzpay spelling of it.
 *
 * Passed explicitly as `input.db` rather than leaning on the suite-wide `getDb`
 * mock, so the assertion is about this write and not about what some other
 * helper happened to arm.
 *
 * @param initial - The row as qzpay-core's `mode: 'paid'` insert leaves it.
 */
function makeCleanupDbMock(
    initial: { status: string; mpSubscriptionId: string | null } = {
        status: 'incomplete',
        // HOS-1326 follow-up: `''`, NOT `null`, is what the column actually holds
        // on the only path that reaches this cleanup. MercadoPago answers 2xx with
        // no `id`; `mapToProviderSubscription` maps that to `id: preapproval.id ?? ''`;
        // qzpay-drizzle's `toUpdate` writes any non-undefined value through, so the
        // EMPTY STRING lands in `mp_subscription_id`. Its `toDomain` then hides it
        // again behind a truthiness check, which is why the caller's guard reads
        // `undefined` and fires. Defaulting this fixture to `null` was injecting
        // the consumer's view of the value instead of what the producer persisted —
        // and it certified an `IS NULL`-only WHERE as healthy.
        mpSubscriptionId: ''
    }
) {
    const row = { ...initial };
    const writes: Array<Record<string, unknown>> = [];
    /** Every condition object the write's `.where(...)` was handed, in order. */
    const conditions: unknown[] = [];
    const update = vi.fn(() => ({
        set: (patch: Record<string, unknown>) => {
            writes.push(patch);
            return {
                where: (condition: unknown) => {
                    conditions.push(condition);
                    return {
                        returning: async () => {
                            // The precondition is read off the ACTUAL condition
                            // tree the code built, not re-declared here: the
                            // suite-wide `@repo/db` mock renders `and`/`inArray`/
                            // `isNull` as plain objects, so the row can be
                            // matched against the real WHERE. A mock that
                            // hard-coded the rule instead would keep answering
                            // correctly after the guard was deleted from the
                            // query — which is how a guard test ends up
                            // asserting the mock rather than the code.
                            if (
                                !matchesCondition(condition, {
                                    id: LOCAL_SUB_ID,
                                    status: row.status,
                                    mp_subscription_id: row.mpSubscriptionId,
                                    deleted_at: null
                                })
                            ) {
                                return [];
                            }
                            if (typeof patch.status === 'string') {
                                row.status = patch.status;
                            }
                            return [{ id: LOCAL_SUB_ID }];
                        }
                    };
                }
            };
        }
    }));

    // `input.db` is the ONE client this helper uses, so it must also answer the
    // plan-domain SELECT that runs before the preapproval is created — otherwise
    // the call fails closed on PLAN_NOT_FOUND and never reaches the cleanup.
    const limit = vi.fn(() =>
        Promise.resolve([{ productDomain: ProductDomainEnum.ACCOMMODATION, createdAt: new Date() }])
    );
    const select = vi.fn(() => ({
        from: vi.fn(() => ({
            where: vi.fn(() => ({
                limit,
                orderBy: vi.fn(() => ({ limit })),
                // HOS-1322: the duplicate guard's scan awaits `.where()` with no
                // `.limit()` after it, so this client has to be awaitable too.
                // It resolves to NO existing subscription: this fixture is about
                // the Bug C cleanup write, and a customer who already held one
                // would be refused long before reaching it.
                // biome-ignore lint/suspicious/noThenProperty: imitating an awaitable query builder is exactly the point.
                then: (
                    onFulfilled?: ((value: unknown[]) => unknown) | null,
                    onRejected?: ((reason: unknown) => unknown) | null
                ) => Promise.resolve([]).then(onFulfilled, onRejected)
            }))
        }))
    }));

    return { db: { select, update } as never, row, update, writes, conditions };
}

describe('createPaidSubscription', () => {
    beforeEach(() => {
        // HOS-1233 T-032: the helper reads the plan's own product_domain before
        // creating the preapproval, and fails closed when it finds no plan.
        // It also resets HOS-1322's existing-subscription rows to empty.
        mockPlanDomainRead();
    });

    // -----------------------------------------------------------------------
    // HOS-1322 — the duplicate guard, inside the primitive
    // -----------------------------------------------------------------------
    describe('the duplicate guard (HOS-1322)', () => {
        function callWith(planDomain: ProductDomainValue) {
            const billing = createBillingMock();
            mockPlanDomainRead(planDomain);
            return { billing };
        }

        it('refuses a second preapproval when a live subscription exists in the SAME domain', async () => {
            const { billing } = callWith(ProductDomainEnum.ACCOMMODATION);
            mockExistingSubscriptionsRead([
                { id: 'sub_live', status: 'active', productDomain: 'accommodation' }
            ]);

            await expect(
                createPaidSubscription({
                    billing: billing as any,
                    customerId: CUSTOMER_ID,
                    planId: PLAN_ID,
                    priceId: PRICE_ID,
                    paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                    notificationUrl: URLS.notificationUrl
                })
            ).rejects.toThrow(/already have a live 'accommodation' subscription/);

            // The whole point: MercadoPago is never asked for a second preapproval.
            expect(billing.subscriptions.create).not.toHaveBeenCalled();
        });

        it('still creates it when the live subscription is in ANOTHER domain (the dual owner)', async () => {
            // A host who already pays for accommodation, buying gastronomy.
            // Without this pair the case above passes just as well with a
            // customer-wide check that refuses a legitimate purchase.
            const { billing } = callWith(ProductDomainEnum.GASTRONOMY);
            mockExistingSubscriptionsRead([
                { id: 'sub_accommodation', status: 'active', productDomain: 'accommodation' }
            ]);

            await createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl
            });

            expect(billing.subscriptions.create).toHaveBeenCalledWith(
                expect.objectContaining({ productDomain: ProductDomainEnum.GASTRONOMY })
            );
        });

        it('exempts the named superseded subscription, and only it', async () => {
            // The trial → paid conversion: the trialing row stays live until the
            // webhook confirms the new preapproval, so naming it is what keeps
            // the conversion working.
            const { billing } = callWith(ProductDomainEnum.ACCOMMODATION);
            mockExistingSubscriptionsRead([
                { id: 'sub_trial', status: 'trialing', productDomain: 'accommodation' }
            ]);

            await createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl,
                supersedesSubscriptionIds: ['sub_trial']
            });

            expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
        });

        it('still refuses a live row that is NOT the named superseded one', async () => {
            // The exemption is a list of ids, not an off switch.
            const { billing } = callWith(ProductDomainEnum.ACCOMMODATION);
            mockExistingSubscriptionsRead([
                { id: 'sub_trial', status: 'trialing', productDomain: 'accommodation' },
                { id: 'sub_other', status: 'active', productDomain: 'accommodation' }
            ]);

            await expect(
                createPaidSubscription({
                    billing: billing as any,
                    customerId: CUSTOMER_ID,
                    planId: PLAN_ID,
                    priceId: PRICE_ID,
                    paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                    notificationUrl: URLS.notificationUrl,
                    supersedesSubscriptionIds: ['sub_trial']
                })
            ).rejects.toThrow(/already have a live 'accommodation' subscription/);
        });

        it('exempts the ADDON domain — an owner legitimately holds several recurring add-ons', async () => {
            // The add-on borrows the OWNER's plan row for its price, so the
            // plan-resolved domain here is `accommodation` while the row it
            // writes is `addon`. Without both halves of the exemption every
            // add-on purchase by a subscribed host would be refused.
            const { billing } = callWith(ProductDomainEnum.ACCOMMODATION);
            mockExistingSubscriptionsRead([
                { id: 'sub_plan', status: 'active', productDomain: 'accommodation' },
                { id: 'sub_addon_1', status: 'active', productDomain: 'addon' }
            ]);

            await createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl,
                subscriptionProductDomain: ProductDomainEnum.ADDON
            });

            expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
        });
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
    //
    // HOS-1326 changed WHAT that cleanup writes. It used to call
    // `billing.subscriptions.cancel(row.id)`, which — on a row with no provider
    // id, which is the only row that reaches here — does no provider work at all
    // (qzpay resolves the preapproval from `providerSubscriptionIds` and finds
    // nothing) and whose entire effect is a local `status: 'canceled'` write.
    // These assertions are therefore about the ROW's terminal status, not about
    // a call having been made: an abandoned checkout is `abandoned`, and the
    // provider-cancel call must be absent because there is nothing to cancel.

    // Driven over BOTH spellings the column can actually hold. `''` is what the
    // qzpay chain persists on this path and is therefore the case that matters
    // (see `makeCleanupDbMock`); `null` is the shape every JS-side read reports,
    // and is what the first version of this WHERE tested for — exclusively, which
    // is how an `IS NULL` predicate that matches nothing was certified healthy.
    // Neither is hypothetical, so neither gets to be the only one asserted.
    it.each([
        ['an empty string (what the column really holds)', ''],
        ['null (a row whose link write never ran)', null]
    ])('throws MISSING_PROVIDER_SUBSCRIPTION_ID and ABANDONS the row when mp_subscription_id is %s', async (_label, storedMpId) => {
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID,
                providerInitPoint: 'https://mp.test/checkout/abc',
                providerSubscriptionIds: { mercadopago: '' }
            }
        });
        const cleanup = makeCleanupDbMock({
            status: 'incomplete',
            mpSubscriptionId: storedMpId
        });

        await expect(
            createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl,
                db: cleanup.db
            })
        ).rejects.toMatchObject({
            name: 'SubscriptionCheckoutError',
            code: 'MISSING_PROVIDER_SUBSCRIPTION_ID'
        });

        expect(cleanup.row.status).toBe('abandoned');
        expect(cleanup.writes[0]?.status).not.toBe('canceled');
        expect(cleanup.writes[0]?.status).not.toBe('cancelled');
        expect(billing.subscriptions.cancel).not.toHaveBeenCalled();
    });

    it('throws MISSING_PROVIDER_SUBSCRIPTION_ID and ABANDONS the row when the provider id is an empty string', async () => {
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID,
                providerInitPoint: 'https://mp.test/checkout/abc',
                providerSubscriptionIds: { mercadopago: '' }
            }
        });
        const cleanup = makeCleanupDbMock();

        await expect(
            createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl,
                db: cleanup.db
            })
        ).rejects.toMatchObject({
            name: 'SubscriptionCheckoutError',
            code: 'MISSING_PROVIDER_SUBSCRIPTION_ID'
        });

        // The just-created local row gets its own terminal status so no
        // unlinkable `incomplete` row survives...
        expect(cleanup.row.status).toBe('abandoned');
        expect(cleanup.writes).toHaveLength(1);
        // ...and it is NOT filed as a cancellation, in either spelling.
        expect(cleanup.writes[0]?.status).not.toBe('canceled');
        expect(cleanup.writes[0]?.status).not.toBe('cancelled');
        // Nothing is cancelled at the provider: there is no preapproval id, which
        // is the very condition that got us here.
        expect(billing.subscriptions.cancel).not.toHaveBeenCalled();
    });

    it('throws MISSING_PROVIDER_SUBSCRIPTION_ID when providerSubscriptionIds is entirely absent', async () => {
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID,
                providerInitPoint: 'https://mp.test/checkout/abc'
                // no providerSubscriptionIds at all
            }
        });
        const cleanup = makeCleanupDbMock();

        await expect(
            createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl,
                db: cleanup.db
            })
        ).rejects.toMatchObject({ code: 'MISSING_PROVIDER_SUBSCRIPTION_ID' });

        expect(cleanup.row.status).toBe('abandoned');
        expect(billing.subscriptions.cancel).not.toHaveBeenCalled();
    });

    it('still throws MISSING_PROVIDER_SUBSCRIPTION_ID when the best-effort cleanup write itself fails', async () => {
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID,
                providerInitPoint: 'https://mp.test/checkout/abc',
                providerSubscriptionIds: { mercadopago: '' }
            }
        });
        // The cleanup write blows up — the abandoned-pending cron is the
        // backstop; the original id-less error must still surface.
        const cleanup = makeCleanupDbMock();
        cleanup.update.mockImplementationOnce(() => {
            throw new Error('DB unreachable');
        });

        await expect(
            createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl,
                db: cleanup.db
            })
        ).rejects.toMatchObject({ code: 'MISSING_PROVIDER_SUBSCRIPTION_ID' });

        expect(cleanup.update).toHaveBeenCalledTimes(1);
        expect(cleanup.row.status).toBe('incomplete');
    });

    it('HOS-1326: leaves the row ALONE if a preapproval got linked to it between the read and the cleanup write', async () => {
        // A linker attaching an `mp_subscription_id` mid-flight turns this row
        // into one that holds a LIVE chargeable authorization. Writing a terminal
        // status on it would strand that preapproval with nothing local
        // explaining it — the split-brain the hourly reaper exists to avoid. The
        // guarded WHERE makes the write a no-op instead, and the reaper
        // re-evaluates the row with the provider in the loop.
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID,
                providerInitPoint: 'https://mp.test/checkout/abc',
                providerSubscriptionIds: { mercadopago: '' }
            }
        });
        const cleanup = makeCleanupDbMock({
            status: 'incomplete',
            mpSubscriptionId: 'mp_linked_mid_flight'
        });

        await expect(
            createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl,
                db: cleanup.db
            })
        ).rejects.toMatchObject({ code: 'MISSING_PROVIDER_SUBSCRIPTION_ID' });

        expect(cleanup.row.status).toBe('incomplete');
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
