/**
 * `sendPaymentSuccessNotification` — the REAL producer (HOS-1238).
 *
 * ## Why this file exists
 *
 * The rest of HOS-1238's coverage exercises wiring: the handler test mocks the
 * receipt dispatcher and asserts the `planId` it was handed, and the dispatcher
 * test mocks this producer and asserts the argument it forwards. Neither loads the
 * four lines that ARE the plan fix, and the one suite that does load this producer
 * (`mercadopago.test.ts`) only ever reaches it with the argument OMITTED, so it
 * exercises the fallback and nothing else.
 *
 * The review proved the gap with a surviving mutation: replacing the preference
 * with `let resolvedPlanId = null` left all 57 tests green while every
 * multi-vertical account silently went back to being named by
 * `getByCustomerId()[0]`. That is the "injecting the consumer's input never checks
 * the producer" pattern, and this file is the producer-side check.
 *
 * The account shape under test is the real one: `host-provider@local.test` is
 * seeded because one account holds several subscriptions at once across the five
 * product domains.
 *
 * @module test/webhooks/payment-success-notification
 */

import { asMajor } from '@repo/billing';
import { NotificationType } from '@repo/notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const { mockTrySendNotification, mockResolvePlanDisplayName } = vi.hoisted(() => ({
    mockTrySendNotification: vi.fn(),
    mockResolvePlanDisplayName: vi.fn()
}));

// Both exports are listed even though only one is reached, because this is a
// whole-module mock: an omitted key arrives as `undefined` and throws inside the
// producer's own best-effort catch, which reads as "no notification was sent"
// rather than as a missing mock. That is how HOS-1238 first broke
// `mercadopago.test.ts`.
vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn(),
    trySendNotification: (...args: unknown[]) => mockTrySendNotification(...args)
}));

vi.mock('../../src/services/billing/plan-change-reason', () => ({
    resolvePlanDisplayName: (...args: unknown[]) => mockResolvePlanDisplayName(...args)
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_ADMIN_NOTIFICATION_EMAILS: '' }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { sendPaymentSuccessNotification } from '../../src/routes/webhooks/mercadopago/notifications';
import { apiLogger } from '../../src/utils/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER = {
    id: 'cust-dual',
    email: 'host-provider@local.test',
    metadata: { name: 'Host And Provider', userId: 'user-dual' }
};

/**
 * A billing facade for a DUAL-ROLE account: the accommodation subscription comes
 * FIRST, so any implementation that reaches for `getByCustomerId()[0]` names the
 * accommodation plan no matter which subscription was actually charged.
 */
function makeBilling(options: { subscriptions?: Array<{ planId: string }> } = {}) {
    const getByCustomerId = vi
        .fn()
        .mockResolvedValue(
            options.subscriptions ?? [
                { planId: 'plan-owner-basico' },
                { planId: 'plan-gastronomy-1' }
            ]
        );
    return {
        billing: {
            customers: { get: vi.fn().mockResolvedValue(CUSTOMER) },
            subscriptions: { getByCustomerId }
        },
        getByCustomerId
    };
}

/** The payload handed to the notification transport. */
function sentPayload(): Record<string, unknown> {
    return (mockTrySendNotification.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockTrySendNotification.mockResolvedValue({ delivered: true });
    mockResolvePlanDisplayName.mockImplementation(async ({ planId }: { planId: string }) =>
        planId === 'plan-gastronomy-1' ? 'Gastronomía Plus' : 'Owner Básico'
    );
});

// ---------------------------------------------------------------------------

describe('sendPaymentSuccessNotification — the plan the receipt names', () => {
    // THE test the surviving mutation demanded. The charged subscription is the
    // gastronomy one; the accommodation subscription is first in the customer's
    // list. Resolving from the list names the wrong plan, and the customer reads a
    // receipt for a plan they were not charged for.
    it('resolves the plan from the CHARGED subscription, not the customer’s first', async () => {
        const { billing, getByCustomerId } = makeBilling();

        const outcome = await sendPaymentSuccessNotification(
            'cust-dual',
            asMajor(18_000),
            'ARS',
            null,
            billing as never,
            'payment-success:mercadopago:9001',
            'plan-gastronomy-1'
        );

        expect(outcome).toEqual({ delivered: true });
        expect(mockResolvePlanDisplayName).toHaveBeenCalledWith({ planId: 'plan-gastronomy-1' });
        // And the wrong plan was never even asked about.
        expect(mockResolvePlanDisplayName).not.toHaveBeenCalledWith({
            planId: 'plan-owner-basico'
        });
        // The list is not consulted at all: a caller that knows has already answered
        // the question, so the guess must not run (nor cost a query).
        expect(getByCustomerId).not.toHaveBeenCalled();
        expect(sentPayload().planName).toBe('Gastronomía Plus');
    });

    it.each([
        ['accommodation', 'plan-owner-basico'],
        ['gastronomy', 'plan-gastronomy-1'],
        ['experience', 'plan-experience-3'],
        ['partner', 'plan-partner-gold'],
        ['tourist', 'plan-tourist-plus']
    ])('uses the supplied %s plan id verbatim', async (_domain, planId) => {
        const { billing, getByCustomerId } = makeBilling();
        mockResolvePlanDisplayName.mockResolvedValue('Resolved Label');

        await sendPaymentSuccessNotification(
            'cust-dual',
            asMajor(18_000),
            'ARS',
            null,
            billing as never,
            undefined,
            planId
        );

        expect(mockResolvePlanDisplayName).toHaveBeenCalledWith({ planId });
        expect(getByCustomerId).not.toHaveBeenCalled();
    });

    // The fallback still exists and is still correct for the ONE caller that cannot
    // know which subscription a payment belongs to — the preference/add-on path in
    // `payment-logic.ts`, which passes no plan id (pre-existing from HOS-763, left
    // to its own issue). Omitting the argument must keep working.
    it('falls back to the customer’s first subscription when the caller omits the plan', async () => {
        const { billing, getByCustomerId } = makeBilling();

        await sendPaymentSuccessNotification(
            'cust-dual',
            asMajor(5_000),
            'ARS',
            'visa',
            billing as never
        );

        expect(getByCustomerId).toHaveBeenCalledWith('cust-dual');
        expect(mockResolvePlanDisplayName).toHaveBeenCalledWith({ planId: 'plan-owner-basico' });
    });

    // `null` and "omitted" are DIFFERENT answers, and collapsing them with `??` was
    // the bug the review found under a docblock claiming the opposite. `null` means
    // the caller knows and the charged subscription has no plan: degrade to the
    // generic label, never to another subscription's.
    it('degrades an explicit null plan to the generic label, without guessing', async () => {
        const { billing, getByCustomerId } = makeBilling();

        await sendPaymentSuccessNotification(
            'cust-dual',
            asMajor(18_000),
            'ARS',
            null,
            billing as never,
            undefined,
            null
        );

        expect(getByCustomerId).not.toHaveBeenCalled();
        expect(mockResolvePlanDisplayName).not.toHaveBeenCalled();
        expect(sentPayload().planName).toBe('Subscription');
    });

    it('keeps the generic label when the plan cannot be resolved', async () => {
        const { billing } = makeBilling();
        mockResolvePlanDisplayName.mockResolvedValue(undefined);

        await sendPaymentSuccessNotification(
            'cust-dual',
            asMajor(18_000),
            'ARS',
            null,
            billing as never,
            undefined,
            'plan-gastronomy-1'
        );

        expect(sentPayload().planName).toBe('Subscription');
    });
});

describe('sendPaymentSuccessNotification — the rest of the payload', () => {
    it('sends the MAJOR amount and the idempotency key through unchanged', async () => {
        const { billing } = makeBilling();

        await sendPaymentSuccessNotification(
            'cust-dual',
            asMajor(18_000),
            'ARS',
            'master',
            billing as never,
            'payment-success:mercadopago:176983176183',
            'plan-gastronomy-1'
        );

        const payload = sentPayload();
        // The REAL enum value. `@repo/notifications` is deliberately not mocked in
        // this file, so this is the string the transport actually receives —
        // `mercadopago.test.ts` asserts `'PAYMENT_SUCCESS'` only because it stubs the
        // enum with uppercase placeholders.
        expect(payload.type).toBe(NotificationType.PAYMENT_SUCCESS);
        expect(payload.type).toBe('payment_success');
        expect(payload.recipientEmail).toBe('host-provider@local.test');
        expect(payload.recipientName).toBe('Host And Provider');
        expect(payload.userId).toBe('user-dual');
        expect(payload.customerId).toBe('cust-dual');
        // 18.000 pesos, not 1800000 centavos (HOS-713).
        expect(payload.amount).toBe(18_000);
        expect(payload.currency).toBe('ARS');
        expect(payload.paymentMethod).toBe('master');
        expect(payload.idempotencyKey).toBe('payment-success:mercadopago:176983176183');
    });

    // Omitting the key must leave it ABSENT, not present-and-undefined: the
    // notification service writes `metadata` from this object, and an explicit
    // `undefined` is what the spread guard exists to avoid.
    it('omits the idempotency key entirely when none is given', async () => {
        const { billing } = makeBilling();

        await sendPaymentSuccessNotification(
            'cust-dual',
            asMajor(18_000),
            'ARS',
            null,
            billing as never
        );

        expect('idempotencyKey' in sentPayload()).toBe(false);
        // A missing payment method is omitted too, rather than sent as an empty one.
        expect(sentPayload().paymentMethod).toBeUndefined();
    });
});

describe('sendPaymentSuccessNotification — reporting a receipt that did not go out', () => {
    it('reports a non-delivery rather than returning as if it had sent', async () => {
        const { billing } = makeBilling();
        mockTrySendNotification.mockResolvedValue({ delivered: false });

        await expect(
            sendPaymentSuccessNotification(
                'cust-dual',
                asMajor(18_000),
                'ARS',
                null,
                billing as never
            )
        ).resolves.toEqual({ delivered: false });
    });

    // This used to return in total silence — no log at any level — so a customer
    // whose billing record had drifted simply never got a receipt and nothing said
    // so. `warn`, not `debug`: production's `LOG_LEVEL` defaults to `info`.
    it('warns, and does not send, when the customer cannot be resolved', async () => {
        const billing = {
            customers: { get: vi.fn().mockResolvedValue(null) },
            subscriptions: { getByCustomerId: vi.fn() }
        };

        const outcome = await sendPaymentSuccessNotification(
            'cust-missing',
            asMajor(18_000),
            'ARS',
            null,
            billing as never
        );

        expect(outcome).toEqual({ delivered: false });
        expect(mockTrySendNotification).not.toHaveBeenCalled();
        expect(apiLogger.warn).toHaveBeenCalledTimes(1);
        expect(apiLogger.debug).not.toHaveBeenCalled();
    });

    it('reports an unconfigured billing facade instead of pretending to send', async () => {
        const outcome = await sendPaymentSuccessNotification(
            'cust-dual',
            asMajor(18_000),
            'ARS',
            null,
            undefined as never
        );

        expect(outcome).toEqual({ delivered: false });
        expect(mockTrySendNotification).not.toHaveBeenCalled();
    });

    // Never throws — the charge already settled. But it must say so at a level
    // production emits, which `debug` is not.
    it('never throws when the customer lookup blows up, and escalates', async () => {
        const billing = {
            customers: { get: vi.fn().mockRejectedValue(new Error('billing down')) },
            subscriptions: { getByCustomerId: vi.fn() }
        };

        const outcome = await sendPaymentSuccessNotification(
            'cust-dual',
            asMajor(18_000),
            'ARS',
            null,
            billing as never
        );

        expect(outcome).toEqual({ delivered: false });
        expect(apiLogger.error).toHaveBeenCalledTimes(1);
        expect(vi.mocked(apiLogger.error).mock.calls[0]?.[2]).toEqual({ capture: true });
        expect(apiLogger.debug).not.toHaveBeenCalled();
    });
});
