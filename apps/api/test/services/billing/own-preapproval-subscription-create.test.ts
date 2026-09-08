/**
 * Unit tests for the own-preapproval subscription creator (HOS-937 step 1,
 * extended step 4).
 *
 * Covers:
 * - `external_reference`: Hospeda's call to `billing.subscriptions.create`
 *   never passes an `externalReference` field (qzpay-core generates and
 *   assigns it internally — see the module docblock and the HOS-937 design
 *   doc §2). A regression that started overriding it would be caught here.
 * - `mp_subscription_id` / status: after a successful `createPaidSubscription`
 *   call, the local row's status is normalized to `pending_provider` via a
 *   direct DB write (Hueco B), keyed by the SAME local subscription id
 *   `createPaidSubscription` returned.
 * - Hueco A (design doc §3): when that DB write fails, the just-created MP
 *   preapproval is cancelled best-effort before the error propagates, so no
 *   untracked orphan survives.
 * - HOS-937 step 1 follow-up: `pendingDiscount` / `pendingTrialExtension`
 *   are snapshotted onto the row's own `metadata` (JSON-stringified) when
 *   supplied, and left off entirely when not — this is the ONLY write this
 *   flow does at creation time; the actual redemption is deferred to the
 *   webhook (`subscription-logic.ts`, tested separately).
 * - HOS-937 step 4: `productDomain` is stamped only when the caller supplies
 *   it (accommodation monthly/annual never do, relying on the column's own
 *   DB default); `domainMetadata` + the resolved `checkoutUrl` are merged
 *   onto `metadata` and `writeDomainLinkRow` is invoked inside the SAME local
 *   transaction, ONLY when the caller supplies a bridge-row writer
 *   (commerce/partner).
 * - HOS-1221: `mpPreapprovalPlanId` is BOOKKEEPING — it lands on the row's
 *   `metadata` (where §6.6-B's reuse check and the retry recovery read it) and
 *   never reaches `billing.subscriptions.create`. Passing the plan id to the
 *   provider instead (`providerPriceId`) builds MercadoPago's "subscription
 *   WITH an associated plan" request, which it rejects with "card_token_id is
 *   required" — every checkout behind the flag answered 500 for that. The one
 *   caller that still supplies `providerPriceId` is the recurring add-on, which
 *   borrows another price row and needs its own MP plan to charge the right
 *   amount; its stamp still works, which the sibling test below pins.
 *
 * @module test/services/billing/own-preapproval-subscription-create
 */

import { SubscriptionStatusEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    createOwnPreapprovalSubscription,
    PENDING_DISCOUNT_METADATA_KEY,
    PENDING_TRIAL_EXTENSION_METADATA_KEY
} from '../../../src/services/billing/own-preapproval-subscription-create';

const CUSTOMER_ID = 'cust_owner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const PRICE_ID = 'price_monthly_1';
const LOCAL_SUB_ID = '11111111-1111-4111-8111-111111111111';
const MP_SUBSCRIPTION_ID = 'mp_preapproval_abc';

const URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/billing/return',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

function createBillingMock() {
    return {
        subscriptions: {
            create: vi.fn().mockResolvedValue({
                id: LOCAL_SUB_ID,
                providerInitPoint: 'https://mp.test/checkout/abc',
                providerSubscriptionIds: { mercadopago: MP_SUBSCRIPTION_ID }
            }),
            cancel: vi.fn().mockResolvedValue(undefined)
        }
    };
}

/** Builds a Drizzle client mock for the `.update().set().where()` chain. */
function createDbMock(opts: { failUpdate?: boolean } = {}) {
    const whereMock = vi.fn().mockImplementation(async () => {
        if (opts.failUpdate) {
            throw new Error('connection reset');
        }
        return undefined;
    });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });
    return { update: updateMock, __setMock: setMock, __whereMock: whereMock };
}

/**
 * Builds a Drizzle client mock exposing BOTH `.update().set().where()` and
 * `.transaction(cb)` — the `writeDomainLinkRow` branch (HOS-937 step 4) opens
 * a nested `client.transaction(...)` and hands its callback the SAME `tx`
 * this mock's own `.update()` chain lives on, so assertions can verify
 * `writeDomainLinkRow` really received the transaction client, not the
 * outer one.
 */
function createTxDbMock(opts: { failUpdate?: boolean; failLinkRow?: boolean } = {}) {
    const whereMock = vi.fn().mockImplementation(async () => {
        if (opts.failUpdate) {
            throw new Error('connection reset');
        }
        return undefined;
    });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });
    const tx = { update: updateMock };
    const transactionMock = vi
        .fn()
        .mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
            await cb(tx);
        });
    return {
        transaction: transactionMock,
        __tx: tx,
        __setMock: setMock,
        __whereMock: whereMock
    };
}

describe('createOwnPreapprovalSubscription', () => {
    it('never passes an externalReference to billing.subscriptions.create (qzpay-core owns it)', async () => {
        const billing = createBillingMock();
        const db = createDbMock();

        await createOwnPreapprovalSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            // HOS-1221 D3: required on this input — omitting it makes qzpay inherit
            // the price row's own trialDays and mint a phantom local trial.
            trialDays: 0,
            db: db as any
        });

        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call).not.toHaveProperty('externalReference');
    });

    it('normalizes status to pending_provider for the SAME id createPaidSubscription returned, after it already resolved', async () => {
        const billing = createBillingMock();
        const db = createDbMock();

        const result = await createOwnPreapprovalSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            // HOS-1221 D3: required on this input — omitting it makes qzpay inherit
            // the price row's own trialDays and mint a phantom local trial.
            trialDays: 0,
            db: db as any
        });

        expect(result.subscription.id).toBe(LOCAL_SUB_ID);
        expect(result.subscription.providerSubscriptionIds?.mercadopago).toBe(MP_SUBSCRIPTION_ID);
        // HOS-937 step 3: checkoutUrl + billingInterval are now ALWAYS stamped
        // on metadata (not just the commerce/partner branch) so the retry
        // recovery flow can resolve the SAME object's init_point for every
        // flow, not just commerce/partner.
        expect(db.__setMock).toHaveBeenCalledWith({
            status: SubscriptionStatusEnum.PENDING_PROVIDER,
            metadata: {
                checkoutUrl: 'https://mp.test/checkout/abc',
                billingInterval: 'monthly'
            }
        });
        expect(db.__whereMock).toHaveBeenCalledTimes(1);
        expect(billing.subscriptions.cancel).not.toHaveBeenCalled();
    });

    // HOS-937 step 3, coverage requested on review: the four call sites in
    // `subscription-checkout.service.ts` are accommodation-monthly (default
    // billingInterval, covered above), accommodation-ANNUAL (this test —
    // passes billingInterval:'annual' explicitly, the one dimension the
    // default-argument test above cannot exercise), commerce (below, no
    // writeDomainLinkRow variant + with writeDomainLinkRow variant), and
    // partner (below, with writeDomainLinkRow). All four go through this
    // SAME shared function, so these branch-combination tests are exhaustive
    // for the metadata-stamping guarantee, not just the flow this module was
    // originally written against.
    it('HOS-937 step 3: stamps billingInterval=annual (accommodation ANNUAL flow) when the caller passes it explicitly', async () => {
        const billing = createBillingMock();
        const db = createDbMock();

        await createOwnPreapprovalSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            billingInterval: 'annual',
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            // HOS-1221 D3: required on this input — omitting it makes qzpay inherit
            // the price row's own trialDays and mint a phantom local trial.
            trialDays: 0,
            db: db as any
        });

        expect(db.__setMock).toHaveBeenCalledWith({
            status: SubscriptionStatusEnum.PENDING_PROVIDER,
            metadata: {
                checkoutUrl: 'https://mp.test/checkout/abc',
                billingInterval: 'annual'
            }
        });
    });

    it('Hueco A: cancels the just-created MP preapproval when the status-normalize UPDATE fails, then rethrows the DB error', async () => {
        const billing = createBillingMock();
        const db = createDbMock({ failUpdate: true });

        await expect(
            createOwnPreapprovalSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl,
                // HOS-1221 D3: required on this input — omitting it makes qzpay inherit
                // the price row's own trialDays and mint a phantom local trial.
                trialDays: 0,
                db: db as any
            })
        ).rejects.toThrow('connection reset');

        expect(billing.subscriptions.cancel).toHaveBeenCalledTimes(1);
        expect(billing.subscriptions.cancel).toHaveBeenCalledWith(LOCAL_SUB_ID);
    });

    it('Hueco A: still rethrows the ORIGINAL DB error (not the cancel error) when the compensating cancel itself fails', async () => {
        const billing = createBillingMock();
        billing.subscriptions.cancel.mockRejectedValueOnce(new Error('MP unreachable'));
        const db = createDbMock({ failUpdate: true });

        await expect(
            createOwnPreapprovalSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl,
                // HOS-1221 D3: required on this input — omitting it makes qzpay inherit
                // the price row's own trialDays and mint a phantom local trial.
                trialDays: 0,
                db: db as any
            })
        ).rejects.toThrow('connection reset');

        expect(billing.subscriptions.cancel).toHaveBeenCalledTimes(1);
    });

    it('HOS-937 follow-up: snapshots pendingDiscount onto the row metadata as JSON, redeems nothing itself', async () => {
        const billing = createBillingMock();
        const db = createDbMock();
        const pendingDiscount = {
            promoCodeId: 'promo-1',
            finalAmountCentavos: 7500,
            durationCycles: 3
        };

        await createOwnPreapprovalSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            // HOS-1221 D3: required on this input — omitting it makes qzpay inherit
            // the price row's own trialDays and mint a phantom local trial.
            trialDays: 0,
            pendingDiscount,
            db: db as any
        });

        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        const metadata = call.metadata as Record<string, string>;
        expect(metadata[PENDING_DISCOUNT_METADATA_KEY]).toBe(JSON.stringify(pendingDiscount));
        expect(metadata[PENDING_TRIAL_EXTENSION_METADATA_KEY]).toBeUndefined();
    });

    it('HOS-937 follow-up: snapshots pendingTrialExtension onto the row metadata as JSON', async () => {
        const billing = createBillingMock();
        const db = createDbMock();
        const pendingTrialExtension = { promoCodeId: 'promo-2', code: 'EXTRA7' };

        await createOwnPreapprovalSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            // HOS-1221 D3: required on this input — omitting it makes qzpay inherit
            // the price row's own trialDays and mint a phantom local trial.
            trialDays: 0,
            pendingTrialExtension,
            db: db as any
        });

        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        const metadata = call.metadata as Record<string, string>;
        expect(metadata[PENDING_TRIAL_EXTENSION_METADATA_KEY]).toBe(
            JSON.stringify(pendingTrialExtension)
        );
        expect(metadata[PENDING_DISCOUNT_METADATA_KEY]).toBeUndefined();
    });

    it('HOS-937 follow-up: writes no metadata at all when neither snapshot is supplied', async () => {
        const billing = createBillingMock();
        const db = createDbMock();

        await createOwnPreapprovalSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            // HOS-1221 D3: required on this input — omitting it makes qzpay inherit
            // the price row's own trialDays and mint a phantom local trial.
            trialDays: 0,
            db: db as any
        });

        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call).not.toHaveProperty('metadata');
    });

    it('HOS-937 step 4: omits productDomain from the UPDATE when the caller does not supply one (accommodation monthly/annual)', async () => {
        const billing = createBillingMock();
        const db = createDbMock();

        await createOwnPreapprovalSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            // HOS-1221 D3: required on this input — omitting it makes qzpay inherit
            // the price row's own trialDays and mint a phantom local trial.
            trialDays: 0,
            db: db as any
        });

        expect(db.__setMock).toHaveBeenCalledWith({
            status: SubscriptionStatusEnum.PENDING_PROVIDER,
            metadata: {
                checkoutUrl: 'https://mp.test/checkout/abc',
                billingInterval: 'monthly'
            }
        });
    });

    it('HOS-937 step 4: stamps the SUPPLIED productDomain onto the status UPDATE when no domain link row is needed', async () => {
        const billing = createBillingMock();
        const db = createDbMock();

        await createOwnPreapprovalSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            // HOS-1221 D3: required on this input — omitting it makes qzpay inherit
            // the price row's own trialDays and mint a phantom local trial.
            trialDays: 0,
            productDomain: 'gastronomy',
            db: db as any
        });

        expect(db.__setMock).toHaveBeenCalledWith({
            status: SubscriptionStatusEnum.PENDING_PROVIDER,
            productDomain: 'gastronomy',
            metadata: {
                checkoutUrl: 'https://mp.test/checkout/abc',
                billingInterval: 'monthly'
            }
        });
    });

    it('HOS-937 step 4: with writeDomainLinkRow supplied, opens a local transaction, stamps productDomain + domainMetadata + checkoutUrl on metadata, and invokes writeDomainLinkRow with the TRANSACTION client', async () => {
        const billing = createBillingMock();
        const db = createTxDbMock();
        const writeDomainLinkRow = vi.fn().mockResolvedValue(undefined);

        await createOwnPreapprovalSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            // HOS-1221 D3: required on this input — omitting it makes qzpay inherit
            // the price row's own trialDays and mint a phantom local trial.
            trialDays: 0,
            productDomain: 'partner',
            domainMetadata: { partnerId: 'partner-123' },
            writeDomainLinkRow,
            db: db as any
        });

        expect(db.transaction).toHaveBeenCalledTimes(1);
        expect(db.__setMock).toHaveBeenCalledWith({
            status: SubscriptionStatusEnum.PENDING_PROVIDER,
            productDomain: 'partner',
            metadata: {
                checkoutUrl: 'https://mp.test/checkout/abc',
                billingInterval: 'monthly',
                partnerId: 'partner-123'
            }
        });
        expect(writeDomainLinkRow).toHaveBeenCalledTimes(1);
        expect(writeDomainLinkRow).toHaveBeenCalledWith({
            tx: db.__tx,
            localSubscriptionId: LOCAL_SUB_ID
        });
    });

    it('HOS-1221: stamps mpPreapprovalPlanId onto metadata WITHOUT forwarding it to the provider create call', async () => {
        const billing = createBillingMock();
        const db = createDbMock();

        await createOwnPreapprovalSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            // HOS-1221 D3: required on this input — omitting it makes qzpay inherit
            // the price row's own trialDays and mint a phantom local trial.
            trialDays: 0,
            mpPreapprovalPlanId: 'mp_plan_recorded_only',
            db: db as any
        });

        // The bookkeeping key still lands on the row — `decideOwnPreapprovalReuse`
        // (§6.6-B) and `mintRetryPreapprovalAttempt` both read it back.
        expect(db.__setMock).toHaveBeenCalledWith({
            status: SubscriptionStatusEnum.PENDING_PROVIDER,
            metadata: {
                checkoutUrl: 'https://mp.test/checkout/abc',
                billingInterval: 'monthly',
                mpPreapprovalPlanId: 'mp_plan_recorded_only'
            }
        });

        // ...and does NOT reach MercadoPago. `providerPriceId` is the forwarded
        // field; with it set the preapproval becomes the plan-based request
        // MercadoPago answers with "card_token_id is required". Asserted as an
        // absence on the captured body, since an `objectContaining` shape
        // cannot see a field that should not be there.
        const createCall = billing.subscriptions.create.mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(createCall.mode).toBe('paid');
        expect(createCall).not.toHaveProperty('providerPriceId');
        expect(createCall).not.toHaveProperty('mpPreapprovalPlanId');
    });

    it('HOS-847: mpPreapprovalPlanId is the ONLY source of the metadata stamp — providerPriceId no longer back-fills it', async () => {
        // This test used to assert the opposite: that a `providerPriceId` fell
        // through to the `mpPreapprovalPlanId` metadata stamp. That fallback
        // existed for exactly one caller, the recurring add-on, which was the
        // last path still subscribing against a real MercadoPago plan — and it
        // was doing so as part of the HOS-1221 defect (MercadoPago 400s that
        // request). With the add-on ported to state its amount instead, the
        // fallback had no caller left, and it was removed rather than kept:
        // while it existed, reintroducing `providerPriceId` anywhere would have
        // kept this stamp looking correct, hiding the very regression the stamp
        // would otherwise have made visible.
        const billing = createBillingMock();
        const db = createTxDbMock();
        const writeDomainLinkRow = vi.fn().mockResolvedValue(undefined);

        await createOwnPreapprovalSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            // HOS-1221 D3: required on this input — omitting it makes qzpay inherit
            // the price row's own trialDays and mint a phantom local trial.
            trialDays: 0,
            // Supplied deliberately, and it must NOT reach the stamp.
            providerPriceId: 'mp_plan_gastronomy',
            mpPreapprovalPlanId: 'mp_plan_gastronomy_bookkeeping',
            productDomain: 'gastronomy',
            domainMetadata: { commerceEntityType: 'gastronomy', commerceEntityId: 'ent-1' },
            writeDomainLinkRow,
            db: db as any
        });

        expect(db.__setMock).toHaveBeenCalledWith({
            status: SubscriptionStatusEnum.PENDING_PROVIDER,
            productDomain: 'gastronomy',
            metadata: {
                checkoutUrl: 'https://mp.test/checkout/abc',
                billingInterval: 'monthly',
                // The bookkeeping field, NOT the forwarded one.
                mpPreapprovalPlanId: 'mp_plan_gastronomy_bookkeeping',
                commerceEntityType: 'gastronomy',
                commerceEntityId: 'ent-1'
            }
        });
    });

    it('HOS-847: a providerPriceId with no mpPreapprovalPlanId stamps NOTHING', async () => {
        // The other half of the removal, and the one an `objectContaining`
        // could not see: with the fallback gone, a caller that supplies only the
        // forwarded field leaves the stamp ABSENT rather than back-filled.
        const billing = createBillingMock();
        const db = createTxDbMock();
        const writeDomainLinkRow = vi.fn().mockResolvedValue(undefined);

        await createOwnPreapprovalSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            trialDays: 0,
            providerPriceId: 'mp_plan_gastronomy',
            productDomain: 'gastronomy',
            domainMetadata: { commerceEntityType: 'gastronomy', commerceEntityId: 'ent-1' },
            writeDomainLinkRow,
            db: db as any
        });

        expect(db.__setMock).toHaveBeenCalledWith({
            status: SubscriptionStatusEnum.PENDING_PROVIDER,
            productDomain: 'gastronomy',
            metadata: {
                checkoutUrl: 'https://mp.test/checkout/abc',
                billingInterval: 'monthly',
                commerceEntityType: 'gastronomy',
                commerceEntityId: 'ent-1'
            }
        });
    });

    it('HOS-937 step 4, Hueco A: cancels the MP preapproval and rethrows when writeDomainLinkRow itself fails inside the transaction', async () => {
        const billing = createBillingMock();
        const db = createTxDbMock();
        const writeDomainLinkRow = vi.fn().mockRejectedValue(new Error('bridge row insert failed'));

        await expect(
            createOwnPreapprovalSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl,
                // HOS-1221 D3: required on this input — omitting it makes qzpay inherit
                // the price row's own trialDays and mint a phantom local trial.
                trialDays: 0,
                productDomain: 'partner',
                domainMetadata: { partnerId: 'partner-123' },
                writeDomainLinkRow,
                db: db as any
            })
        ).rejects.toThrow('bridge row insert failed');

        expect(billing.subscriptions.cancel).toHaveBeenCalledTimes(1);
        expect(billing.subscriptions.cancel).toHaveBeenCalledWith(LOCAL_SUB_ID);
    });
});
