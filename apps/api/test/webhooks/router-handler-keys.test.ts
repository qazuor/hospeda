/**
 * Regression tests: HOS-191 FIX #4 — MercadoPago webhook `handlers` map keys.
 *
 * `@qazuor/qzpay-mercadopago`'s webhook adapter NORMALIZES every inbound MP
 * event type before `@qazuor/qzpay-hono`'s `createWebhookRouter` dispatches it
 * via `handlers[event.type]` (see `MERCADOPAGO_WEBHOOK_EVENTS` /
 * `MERCADOPAGO_WEBHOOK_EVENTS_EXTENDED` in `@qazuor/qzpay-mercadopago`'s
 * `types.ts`):
 *
 *   subscription_preapproval.created        -> subscription.created
 *   subscription_preapproval.updated        -> subscription.updated
 *   subscription_authorized_payment.created -> invoice.paid
 *   subscription_authorized_payment.updated -> invoice.updated
 *   chargebacks.created / chargebacks.updated / chargebacks -> dispute.created / dispute.updated
 *   payment.created / payment.updated       -> unchanged
 *
 * `router.ts` used to register the RAW MP keys, which never match the
 * normalized `event.type` qzpay-hono actually dispatches on — the router
 * would log "Webhook event has no registered handler" and every
 * subscription/invoice/dispute webhook would silently no-op. This is the
 * exact root cause of a launch-blocking prod incident (paid/trial
 * subscriptions never activating).
 *
 * These tests capture the `handlers` object passed to `createWebhookRouter`
 * and assert it is keyed by the NORMALIZED qzpay event types.
 *
 * @module test/webhooks/router-handler-keys
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Capture the config passed to createWebhookRouter so tests can inspect the
// `handlers` map without needing a live billing/adapter setup. Must be
// `vi.hoisted` since `vi.mock` factories are hoisted above all other
// top-level statements and cannot reference un-hoisted bindings.
const capturedConfigs = vi.hoisted((): Array<{ handlers?: Record<string, unknown> }> => []);

vi.mock('@qazuor/qzpay-hono', async () => {
    const { Hono: RealHono } = await import('hono');
    return {
        createWebhookRouter: vi.fn((config: { handlers?: Record<string, unknown> }) => {
            capturedConfigs.push(config);
            return new RealHono();
        })
    };
});

vi.mock('../../src/lib/qzpay-logger', () => ({
    qzpayLogger: {}
}));

vi.mock('../../src/middlewares/rate-limit', () => ({
    createPerRouteRateLimitMiddleware: vi.fn(
        () => async (_c: unknown, next: () => Promise<void>) => {
            await next();
        }
    )
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/routes/webhooks/mercadopago/utils', () => ({
    getWebhookDependencies: vi.fn(() => ({ billing: {}, paymentAdapter: {} }))
}));

const handlePaymentCreatedMock = vi.hoisted(() => vi.fn());
const handlePaymentUpdatedMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/routes/webhooks/mercadopago/payment-handler', () => ({
    handlePaymentCreated: handlePaymentCreatedMock,
    handlePaymentUpdated: handlePaymentUpdatedMock
}));

const handleSubscriptionPreapprovalEventMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/routes/webhooks/mercadopago/subscription-handler', () => ({
    handleSubscriptionPreapprovalEvent: handleSubscriptionPreapprovalEventMock
}));

const handleSubscriptionAuthorizedPaymentMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/routes/webhooks/mercadopago/subscription-payment-handler', () => ({
    handleSubscriptionAuthorizedPayment: handleSubscriptionAuthorizedPaymentMock
}));

const handleDisputeOpenedMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/routes/webhooks/mercadopago/dispute-handler', () => ({
    handleDisputeOpened: handleDisputeOpenedMock
}));

vi.mock('../../src/routes/webhooks/mercadopago/event-handler', () => ({
    handleWebhookEvent: vi.fn(),
    handleWebhookError: vi.fn()
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createMercadoPagoWebhookRoutes } from '../../src/routes/webhooks/mercadopago/router';

describe('MercadoPago webhook router — handler map keys (HOS-191 FIX #4)', () => {
    beforeEach(() => {
        capturedConfigs.length = 0;
        vi.clearAllMocks();
    });

    function buildHandlersMap(): Record<string, unknown> {
        const router = createMercadoPagoWebhookRoutes();
        expect(router).not.toBeNull();
        expect(capturedConfigs).toHaveLength(1);
        const { handlers } = capturedConfigs[0] as { handlers: Record<string, unknown> };
        return handlers;
    }

    it('registers the NORMALIZED subscription.* keys, not the raw subscription_preapproval.* MP keys', () => {
        const handlers = buildHandlersMap();

        expect(handlers['subscription.created']).toBe(handleSubscriptionPreapprovalEventMock);
        expect(handlers['subscription.updated']).toBe(handleSubscriptionPreapprovalEventMock);
        expect(handlers['subscription_preapproval.created']).toBeUndefined();
        expect(handlers['subscription_preapproval.updated']).toBeUndefined();
    });

    it('registers the NORMALIZED invoice.* keys, not the raw subscription_authorized_payment.* MP keys', () => {
        const handlers = buildHandlersMap();

        expect(handlers['invoice.paid']).toBe(handleSubscriptionAuthorizedPaymentMock);
        expect(handlers['invoice.updated']).toBe(handleSubscriptionAuthorizedPaymentMock);
        expect(handlers['subscription_authorized_payment.created']).toBeUndefined();
        expect(handlers['subscription_authorized_payment.updated']).toBeUndefined();
    });

    it('registers the NORMALIZED dispute.* keys, not the raw chargebacks / invented payment.dispute keys', () => {
        const handlers = buildHandlersMap();

        expect(handlers['dispute.created']).toBe(handleDisputeOpenedMock);
        expect(handlers['dispute.updated']).toBe(handleDisputeOpenedMock);
        expect(handlers.chargebacks).toBeUndefined();
        expect(handlers['payment.dispute']).toBeUndefined();
    });

    it('keeps the unchanged payment.created / payment.updated keys', () => {
        const handlers = buildHandlersMap();

        expect(handlers['payment.created']).toBe(handlePaymentCreatedMock);
        expect(handlers['payment.updated']).toBe(handlePaymentUpdatedMock);
    });

    it('dispatch-level: qzpay-hono style lookup resolves the subscription-created handler for the normalized event type', async () => {
        const handlers = buildHandlersMap();

        // Mirrors qzpay-hono's `const handler = handlers[event.type]` dispatch
        // (createWebhookRouter, apps/api's dependency @qazuor/qzpay-hono) against
        // an already-normalized event, proving the registered key actually
        // resolves to the intended handler function.
        const normalizedEvent = { id: 'evt-1', type: 'subscription.created', data: {} };
        const handler = handlers[normalizedEvent.type] as
            | ((c: unknown, event: unknown) => Promise<unknown>)
            | undefined;

        expect(handler).toBeDefined();
        await handler?.({} as never, normalizedEvent as never);
        expect(handleSubscriptionPreapprovalEventMock).toHaveBeenCalledWith(
            expect.anything(),
            normalizedEvent
        );
    });

    it('dispatch-level: qzpay-hono style lookup resolves the invoice-paid handler for the normalized event type', async () => {
        const handlers = buildHandlersMap();

        const normalizedEvent = { id: 'evt-2', type: 'invoice.paid', data: {} };
        const handler = handlers[normalizedEvent.type] as
            | ((c: unknown, event: unknown) => Promise<unknown>)
            | undefined;

        expect(handler).toBeDefined();
        await handler?.({} as never, normalizedEvent as never);
        expect(handleSubscriptionAuthorizedPaymentMock).toHaveBeenCalledWith(
            expect.anything(),
            normalizedEvent
        );
    });
});
