/**
 * Unit tests for the own-preapproval subscription creator (HOS-937 step 1).
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
            db: db as any
        });

        expect(result.subscription.id).toBe(LOCAL_SUB_ID);
        expect(result.subscription.providerSubscriptionIds?.mercadopago).toBe(MP_SUBSCRIPTION_ID);
        expect(db.__setMock).toHaveBeenCalledWith({
            status: SubscriptionStatusEnum.PENDING_PROVIDER
        });
        expect(db.__whereMock).toHaveBeenCalledTimes(1);
        expect(billing.subscriptions.cancel).not.toHaveBeenCalled();
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
            db: db as any
        });

        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call).not.toHaveProperty('metadata');
    });
});
