/**
 * The receipt for a recurring subscription charge (HOS-1238).
 *
 * The defect: `subscription_authorized_payment` — since HOS-171 the ONLY way a
 * Hospeda subscription is ever charged — recorded the charge and dispatched
 * nothing. Measured in staging on 2026-09-08 across four real subscription
 * charges: zero rows in `billing_notification_log`, and not one API log line
 * about a notification, so the absence of a receipt was indistinguishable from a
 * silent failure.
 *
 * This file covers the dispatcher's own decisions. The two things it must get
 * right in opposite directions:
 *
 * - it must SEND, for all five product domains, monthly and annual, trial
 *   conversion, promo-discounted and comp-adjacent charges alike;
 * - it must NOT send twice, and must not send for money that never arrived.
 *
 * Its wiring into the THREE settlement sites is covered elsewhere:
 * `subscription-payment-handler.test.ts` (the live webhook),
 * `webhook-retry.job.test.ts` (the dead-letter retry) and
 * `payment-reconcile.service.test.ts` (the HOS-765 operator backfill, whose subject
 * is by definition a charge nobody told the customer about). That all three dispatch,
 * and that none of them asserts the charge status instead of deriving it, is frozen
 * by `subscription-charge-receipt-sites.guard.test.ts`.
 *
 * @module test/webhooks/subscription-charge-receipt
 */

import { asMajor } from '@repo/billing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const { mockSendPaymentSuccessNotification } = vi.hoisted(() => ({
    mockSendPaymentSuccessNotification: vi.fn()
}));

vi.mock('../../src/routes/webhooks/mercadopago/notifications', () => ({
    sendPaymentSuccessNotification: (...args: unknown[]) =>
        mockSendPaymentSuccessNotification(...args)
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

/**
 * The notification-log rows the dedupe lookup resolves to. One entry means "a
 * delivered receipt for this payment is already on record".
 */
const logLookupResult: { rows: Array<{ id: string }>; throws: Error | null } = {
    rows: [],
    throws: null
};

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({
        select: vi.fn(() => {
            const builder = {
                from: vi.fn(() => builder),
                where: vi.fn(() => builder),
                limit: vi.fn(() => {
                    if (logLookupResult.throws) {
                        return Promise.reject(logLookupResult.throws);
                    }
                    return Promise.resolve(logLookupResult.rows);
                })
            };
            return builder;
        })
    })),
    billingNotificationLog: {
        id: 'ID_COL',
        type: 'TYPE_COL',
        customerId: 'CUSTOMER_ID_COL',
        status: 'STATUS_COL',
        metadata: 'METADATA_COL'
    },
    and: (...args: unknown[]) => ({ _and: args }),
    eq: (a: unknown, b: unknown) => ({ _eq: [a, b] }),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ _sql: { strings, values } })
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
    dispatchSubscriptionChargeReceipt,
    paymentSuccessIdempotencyKey,
    wasPaymentSuccessAlreadyDispatched
} from '../../src/routes/webhooks/mercadopago/subscription-charge-receipt';
import { apiLogger } from '../../src/utils/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BILLING = { payments: { record: vi.fn() } } as never;

type DispatchParams = Parameters<typeof dispatchSubscriptionChargeReceipt>[0];

function params(overrides: Partial<DispatchParams> = {}): DispatchParams {
    return {
        customerId: 'cust-1',
        planId: 'plan-owner-basico',
        providerPaymentId: '176983176183',
        amountMajor: asMajor(18_000),
        currency: 'ARS',
        chargeStatus: 'succeeded',
        billing: BILLING,
        localSubscriptionId: 'local-sub-1',
        source: 'subscription-authorized-payment-webhook',
        ...overrides
    };
}

/** The positional arguments handed to `sendPaymentSuccessNotification`. */
function sendArgs(): unknown[] {
    return mockSendPaymentSuccessNotification.mock.calls[0] ?? [];
}

beforeEach(() => {
    vi.clearAllMocks();
    logLookupResult.rows = [];
    logLookupResult.throws = null;
    mockSendPaymentSuccessNotification.mockResolvedValue({ delivered: true });
});

// ---------------------------------------------------------------------------

describe('paymentSuccessIdempotencyKey', () => {
    it('keys on the MercadoPago payment id', () => {
        expect(paymentSuccessIdempotencyKey('176983176183')).toBe(
            'payment-success:mercadopago:176983176183'
        );
    });

    // The whole point of keying on the PAYMENT rather than the path: the
    // subscription dispatch and `payment-logic.ts`'s preference dispatch produce
    // the SAME key for one charge, so they suppress each other. A path-scoped key
    // would have been the easy change and would have let one charge mail twice.
    it('is path-independent, so two producers for one charge collide deliberately', () => {
        const fromSubscriptionPath = paymentSuccessIdempotencyKey('9001');
        const fromPreferencePath = paymentSuccessIdempotencyKey('9001');
        expect(fromSubscriptionPath).toBe(fromPreferencePath);
        expect(paymentSuccessIdempotencyKey('9002')).not.toBe(fromSubscriptionPath);
    });
});

describe('wasPaymentSuccessAlreadyDispatched', () => {
    it('reports a delivered receipt already on record', async () => {
        logLookupResult.rows = [{ id: 'log-row-1' }];

        await expect(
            wasPaymentSuccessAlreadyDispatched({
                customerId: 'cust-1',
                providerPaymentId: '9001',
                source: 'test'
            })
        ).resolves.toBe(true);
    });

    it('reports no receipt when the log holds none', async () => {
        logLookupResult.rows = [];

        await expect(
            wasPaymentSuccessAlreadyDispatched({
                customerId: 'cust-1',
                providerPaymentId: '9001',
                source: 'test'
            })
        ).resolves.toBe(false);
    });

    // FAIL-OPEN, deliberately. A lookup that cannot run must not silence a receipt
    // the customer is owed: the worst case here is the duplicate it was trying to
    // prevent, and the worst case the other way is a paying customer told nothing.
    it('fails OPEN when the lookup itself throws, and says so at warn', async () => {
        logLookupResult.throws = new Error('db down');

        await expect(
            wasPaymentSuccessAlreadyDispatched({
                customerId: 'cust-1',
                providerPaymentId: '9001',
                source: 'test'
            })
        ).resolves.toBe(false);
        expect(apiLogger.warn).toHaveBeenCalled();
    });
});

describe('dispatchSubscriptionChargeReceipt', () => {
    it('dispatches a receipt for a cleared charge', async () => {
        const outcome = await dispatchSubscriptionChargeReceipt(params());

        expect(outcome).toEqual({ dispatched: true });
        expect(mockSendPaymentSuccessNotification).toHaveBeenCalledTimes(1);
    });

    // Each argument asserted by position and value. `objectContaining` would not
    // have helped here anyway, but the failure mode it hides — a field that
    // silently went missing — is the one this spells out.
    it('passes the amount in MAJOR units and the payment-scoped key', async () => {
        await dispatchSubscriptionChargeReceipt(
            params({ amountMajor: asMajor(18_000), providerPaymentId: '176983176183' })
        );

        const args = sendArgs();
        expect(args[0]).toBe('cust-1');
        // 18.000 pesos. The ledger stores 1800000 centavos; handing that over is
        // HOS-713 — a real charge announced a hundredfold too large.
        expect(args[1]).toBe(18_000);
        expect(args[1]).not.toBe(1_800_000);
        expect(args[2]).toBe('ARS');
        // The authorized-payment payload carries no payment method.
        expect(args[3]).toBeNull();
        expect(args[4]).toBe(BILLING);
        expect(args[5]).toBe('payment-success:mercadopago:176983176183');
        expect(args[6]).toBe('plan-owner-basico');
    });

    // Eje 1, the five product domains. One account can hold several subscriptions
    // at once, so the plan id must be the one the caller resolved from THIS
    // preapproval and must reach the sender untouched — otherwise a gastronomy
    // renewal prints the owner's accommodation plan.
    it.each([
        ['accommodation', 'plan-owner-basico'],
        ['gastronomy', 'plan-gastronomy-1'],
        ['experience', 'plan-experience-3'],
        ['partner', 'plan-partner-gold'],
        ['tourist', 'plan-tourist-plus']
    ])('forwards the %s plan id verbatim to the sender', async (_domain, planId) => {
        await dispatchSubscriptionChargeReceipt(params({ planId }));

        expect(sendArgs()[6]).toBe(planId);
    });

    it('forwards a null plan id rather than letting the sender guess one', async () => {
        await dispatchSubscriptionChargeReceipt(params({ planId: null }));

        expect(sendArgs()[6]).toBeNull();
    });

    // Monthly and annual are the same preapproval cadence since HOS-171, so the
    // only thing that differs is the amount — which must survive as MAJOR units at
    // either magnitude.
    it.each([
        ['monthly', 18_000],
        ['annual', 180_000]
    ])('dispatches a %s charge with its own major amount', async (_cadence, amount) => {
        await dispatchSubscriptionChargeReceipt(params({ amountMajor: asMajor(amount) }));

        expect(sendArgs()[1]).toBe(amount);
    });

    // A promo-discounted cycle charges less than the plan price. The receipt must
    // state what was actually debited, not the list price.
    it('dispatches the discounted amount on a promo cycle, not the plan price', async () => {
        await dispatchSubscriptionChargeReceipt(params({ amountMajor: asMajor(9_000) }));

        expect(sendArgs()[1]).toBe(9_000);
    });

    it('dispatches for a non-ARS charge without reinterpreting the amount', async () => {
        await dispatchSubscriptionChargeReceipt(
            params({ currency: 'USD', amountMajor: asMajor(12.5) })
        );

        expect(sendArgs()[1]).toBe(12.5);
        expect(sendArgs()[2]).toBe('USD');
    });

    // ---- the NOT-sending half ------------------------------------------------

    // The gate is INSIDE this function, not replicated at its call sites — a gate
    // copied to N sites is one that N-1 of them eventually forget.
    //
    // `'processing'` is the one worth naming: it is NOT terminal (MercadoPago's
    // `in_process` / `in_mediation` can still become `rejected`), so a receipt for
    // it announces money that may never arrive.
    it.each([
        'failed',
        'pending',
        'processing',
        'canceled',
        'refunded',
        'SUCCEEDED',
        ''
    ])('does NOT dispatch for a charge whose status is "%s"', async (chargeStatus) => {
        const outcome = await dispatchSubscriptionChargeReceipt(params({ chargeStatus }));

        expect(outcome).toEqual({ dispatched: false, reason: 'charge-not-settled' });
        expect(mockSendPaymentSuccessNotification).not.toHaveBeenCalled();
    });

    // The duplicate, at this level: a DELIVERED receipt for this same payment is
    // already on record. This is the cross-path defence — it fires whether the
    // earlier receipt came from this path, from `payment-logic.ts`, or from the
    // dead-letter retry cron, because the key names the payment and not the path.
    it('does NOT dispatch a second receipt for a payment already acknowledged', async () => {
        logLookupResult.rows = [{ id: 'log-row-1' }];

        const outcome = await dispatchSubscriptionChargeReceipt(params());

        expect(outcome).toEqual({ dispatched: false, reason: 'already-dispatched' });
        expect(mockSendPaymentSuccessNotification).not.toHaveBeenCalled();
    });

    // Two callers, one charge — the live webhook and the dead-letter retry cron
    // racing over the same `paymentId`. Exactly one receipt.
    it('two settlement sites over one charge send exactly one receipt', async () => {
        const first = await dispatchSubscriptionChargeReceipt(
            params({ source: 'subscription-authorized-payment-webhook' })
        );
        // The first send is now on record, which is what the second caller reads.
        logLookupResult.rows = [{ id: 'log-row-1' }];
        const second = await dispatchSubscriptionChargeReceipt(
            params({ source: 'webhook-retry-dead-letter' })
        );

        expect(first.dispatched).toBe(true);
        expect(second.dispatched).toBe(false);
        expect(second.reason).toBe('already-dispatched');
        expect(mockSendPaymentSuccessNotification).toHaveBeenCalledTimes(1);
    });

    // ---- loudness ------------------------------------------------------------

    // The issue's second half: "ese silencio no queda registrado en ningún lado".
    // `LOG_LEVEL` defaults to `info` in production, so a `debug` line here would be
    // invisible exactly where it is needed. Every non-delivery is therefore LOGGED —
    // but escalation is narrower, and the two are asserted separately below.
    it('escalates a receipt that threw inside the sender, with capture', async () => {
        mockSendPaymentSuccessNotification.mockResolvedValue({
            delivered: false,
            disposition: 'error'
        });

        const outcome = await dispatchSubscriptionChargeReceipt(params());

        expect(outcome).toEqual({ dispatched: false, reason: 'not-delivered' });
        expect(apiLogger.error).toHaveBeenCalledTimes(1);
        const [, message, options] = vi.mocked(apiLogger.error).mock.calls[0] ?? [];
        expect(message).toMatch(/NOT delivered/);
        expect(options).toEqual({ capture: true });
        expect(apiLogger.debug).not.toHaveBeenCalled();
    });

    // The false-positive the review predicted. `NotificationService.send` enqueues a
    // retry BEFORE returning `success: false`, so a transport refusal usually becomes
    // a delivery ~60s later; `'skipped'` is the customer's own preference; and
    // `'unavailable'` is an environment with no email key, which would otherwise
    // escalate once per charge. All are reported, none are paged.
    it.each([
        'send-failed',
        'skipped',
        'unavailable'
    ])('reports a %s receipt at warn, without escalating', async (disposition) => {
        mockSendPaymentSuccessNotification.mockResolvedValue({
            delivered: false,
            disposition
        });

        const outcome = await dispatchSubscriptionChargeReceipt(params());

        expect(outcome).toEqual({ dispatched: false, reason: 'not-delivered' });
        expect(apiLogger.error).not.toHaveBeenCalled();
        expect(apiLogger.warn).toHaveBeenCalledTimes(1);
        // The disposition has to reach the log line, or the warn cannot be told
        // apart from the other two by whoever reads it.
        expect(vi.mocked(apiLogger.warn).mock.calls[0]?.[0]).toMatchObject({ disposition });
        expect(apiLogger.debug).not.toHaveBeenCalled();
    });

    // A sender that reports no disposition at all must still be LOGGED — the silence
    // is the thing this issue is about — just not escalated on a guess.
    it('reports a non-delivery with no disposition at warn, not silently', async () => {
        mockSendPaymentSuccessNotification.mockResolvedValue({ delivered: false });

        const outcome = await dispatchSubscriptionChargeReceipt(params());

        expect(outcome).toEqual({ dispatched: false, reason: 'not-delivered' });
        expect(apiLogger.warn).toHaveBeenCalledTimes(1);
        expect(vi.mocked(apiLogger.warn).mock.calls[0]?.[0]).toMatchObject({
            disposition: 'unknown'
        });
        expect(apiLogger.error).not.toHaveBeenCalled();
    });

    it('records a delivered receipt at info, so the silence is observable', async () => {
        await dispatchSubscriptionChargeReceipt(params());

        expect(apiLogger.info).toHaveBeenCalledTimes(1);
        const [context, message] = vi.mocked(apiLogger.info).mock.calls[0] ?? [];
        expect(message).toMatch(/receipt dispatched/);
        expect(context).toMatchObject({
            customerId: 'cust-1',
            providerPaymentId: '176983176183',
            localSubscriptionId: 'local-sub-1'
        });
    });

    it('logs at info — not debug — when it withholds a receipt for an uncleared charge', async () => {
        await dispatchSubscriptionChargeReceipt(params({ chargeStatus: 'failed' }));

        expect(apiLogger.info).toHaveBeenCalledTimes(1);
        expect(apiLogger.debug).not.toHaveBeenCalled();
    });

    // ---- the never-throws guarantee ------------------------------------------

    // In `webhook-retry.job.ts` this call sits inside the try whose catch enqueues
    // an ORPHAN PAYMENT. A throw from here would file a "ledger write failed"
    // alert about a row that was written perfectly, so the guarantee has to hold
    // at the function, not at each call site.
    it('never throws when the sender throws, and says so loudly', async () => {
        mockSendPaymentSuccessNotification.mockRejectedValue(new Error('brevo exploded'));

        const outcome = await dispatchSubscriptionChargeReceipt(params());

        expect(outcome).toEqual({ dispatched: false, reason: 'dispatch-threw' });
        expect(apiLogger.error).toHaveBeenCalledTimes(1);
        expect(vi.mocked(apiLogger.error).mock.calls[0]?.[2]).toEqual({ capture: true });
    });

    // The dedupe lookup failing must not suppress the receipt — it fails open, so
    // the send still happens.
    it('still sends when the idempotency lookup is unavailable', async () => {
        logLookupResult.throws = new Error('db down');

        const outcome = await dispatchSubscriptionChargeReceipt(params());

        expect(outcome).toEqual({ dispatched: true });
        expect(mockSendPaymentSuccessNotification).toHaveBeenCalledTimes(1);
    });
});
