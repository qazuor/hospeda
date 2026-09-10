/**
 * HOS-1281 — the partner payment-link checkout must hand MercadoPago a
 * `notification_url` the webhook router will actually ACCEPT.
 *
 * ## The bug this reproduces
 *
 * `routes/partners/admin/send-link.ts` built its own `notification_url` with a
 * private copy of the builder:
 *
 *     `${env.HOSPEDA_API_URL}/api/v1/webhooks/mercadopago`
 *
 * — the shared `checkout-return-urls.ts` builder's URL minus the
 * `?source_news=webhooks` marker (`V2_SOURCE_NEWS_MARKER`, HOS-159). The
 * webhook router's first middleware DROPS every delivery lacking that marker as
 * a "legacy IPN duplicate", **answering 200**. So MercadoPago never retries, no
 * `billing_webhook_events` row is written, and nothing anywhere logs an error:
 * the partner subscription sits in `pending_provider` until the polling cron
 * happens to rescue it, or forever.
 *
 * Latent until `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` is on — the Path C
 * share-link branch never sends a `notification_url` at all — which is exactly
 * why nothing had caught it.
 *
 * ## Why this suite drives the REAL router instead of matching a substring
 *
 * A test asserting `url.includes('source_news=webhooks')` pins the STRING, not
 * the EFFECT: it would stay green if the router changed the marker value, moved
 * to a header, or started requiring an extra parameter. So the value asserted
 * here is the one the handler actually passes to
 * `initiatePartnerMonthlySubscription` (captured off the mock, never
 * re-derived), and it is fed to the REAL marker middleware built by
 * `createMercadoPagoWebhookRoutes` — shaped the way MercadoPago delivers it,
 * with MP's own `&data.id=…&type=…` appended. The assertion is the router's own
 * verdict: reached the handler, or dropped as a legacy IPN duplicate.
 *
 * The `@qazuor/qzpay-hono` mock returns a real Hono carrying one catch-all
 * route, so everything up to the dispatch boundary — the rate limiter, the
 * marker middleware, the mount — is the shipped code, and "the delivery got
 * through" is a genuine HTTP response rather than a flag this file set.
 *
 * @module test/routes/partners/admin/send-link.notification-url
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — hoisted above every import.
// ---------------------------------------------------------------------------

const { getByIdMock, customersGetByExternalIdMock, customersCreateMock, initiateMock } = vi.hoisted(
    () => ({
        getByIdMock: vi.fn(),
        customersGetByExternalIdMock: vi.fn(),
        customersCreateMock: vi.fn(),
        initiateMock: vi.fn()
    })
);

vi.mock('../../../../src/utils/env', () => ({
    env: {
        HOSPEDA_API_URL: 'https://api.test',
        HOSPEDA_SITE_URL: 'https://site.test'
    }
}));

// The real factory wires auth/permission middleware that transitively pulls in
// the whole @repo/db surface. This module only needs the extracted handler.
vi.mock('../../../../src/utils/route-factory.js', () => ({
    createAdminRoute: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    class PartnerServiceStub {
        getById = getByIdMock;
        update = vi.fn(async () => ({}));
    }
    return { ...actual, PartnerService: PartnerServiceStub };
});

vi.mock('../../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(() => ({
        customers: {
            getByExternalId: customersGetByExternalIdMock,
            create: customersCreateMock
        }
    }))
}));

vi.mock('../../../../src/services/subscription-checkout.service', () => ({
    initiatePartnerMonthlySubscription: initiateMock,
    SubscriptionCheckoutError: class SubscriptionCheckoutError extends Error {}
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn(() => ({ id: 'admin-1', roles: [], permissions: [] }))
}));

// --- webhook router side -----------------------------------------------------
// `createWebhookRouter` is replaced by a real Hono carrying one catch-all route,
// so a delivery that survives the marker middleware produces a distinguishable
// 200 body instead of a 404 that could be mistaken for either outcome.
vi.mock('@qazuor/qzpay-hono', async () => {
    const { Hono: RealHono } = await import('hono');
    return {
        createWebhookRouter: vi.fn(() => {
            const inner = new RealHono();
            inner.all('*', (c) => c.json({ received: true, reachedDispatch: true }, 200));
            return inner;
        })
    };
});

vi.mock('../../../../src/lib/qzpay-logger', () => ({ qzpayLogger: {} }));

vi.mock('../../../../src/middlewares/rate-limit', () => ({
    createPerRouteRateLimitMiddleware: vi.fn(
        () => async (_c: unknown, next: () => Promise<void>) => {
            await next();
        }
    )
}));

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../../../src/routes/webhooks/mercadopago/utils', () => ({
    getWebhookDependencies: vi.fn(() => ({ billing: {}, paymentAdapter: {} }))
}));

vi.mock('../../../../src/routes/webhooks/mercadopago/payment-handler', () => ({
    handlePaymentCreated: vi.fn(),
    handlePaymentUpdated: vi.fn()
}));

vi.mock('../../../../src/routes/webhooks/mercadopago/subscription-handler', () => ({
    handleSubscriptionPreapprovalEvent: vi.fn()
}));

vi.mock('../../../../src/routes/webhooks/mercadopago/subscription-payment-handler', () => ({
    handleSubscriptionAuthorizedPayment: vi.fn()
}));

vi.mock('../../../../src/routes/webhooks/mercadopago/dispute-handler', () => ({
    handleDisputeOpened: vi.fn()
}));

vi.mock('../../../../src/routes/webhooks/mercadopago/event-handler', () => ({
    handleWebhookEvent: vi.fn(),
    handleWebhookError: vi.fn()
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import type { Hono } from 'hono';
import { sendPartnerPaymentLinkHandler } from '../../../../src/routes/partners/admin/send-link';
import { createMercadoPagoWebhookRoutes } from '../../../../src/routes/webhooks/mercadopago/router';

const PARTNER_ID = '00000000-0000-4000-a000-000000000001';
const PLAN_ID = '00000000-0000-4000-a000-000000000002';

/** How MercadoPago delivers a preapproval event: its own params, appended with `&`. */
const MP_APPENDED_PARAMS = 'data.id=2c938084726fca480172750000000000&type=subscription_preapproval';

// The handler only reads `params`; the Hono context is unused on this path.
const ctx = {} as unknown as Parameters<typeof sendPartnerPaymentLinkHandler>[0];

/**
 * Run the partner send-link handler and return the `notification_url` it
 * actually handed the checkout service.
 *
 * Read off the captured call rather than re-derived from env, so the assertion
 * cannot drift from what production would send.
 */
async function captureNotificationUrl(): Promise<string> {
    getByIdMock.mockResolvedValue({
        data: {
            id: PARTNER_ID,
            name: 'Acme Turismo',
            planId: PLAN_ID,
            contentApprovedAt: new Date('2026-07-10T12:00:00Z')
        }
    });

    await sendPartnerPaymentLinkHandler(ctx, { id: PARTNER_ID });

    expect(initiateMock).toHaveBeenCalledTimes(1);
    const call = initiateMock.mock.calls[0]?.[0] as {
        urls: { notificationUrl: string };
    };
    return call.urls.notificationUrl;
}

/**
 * Deliver `notificationUrl` to the REAL webhook router the way MercadoPago
 * would, and report the router's verdict.
 *
 * @param notificationUrl - The absolute URL configured as `notification_url`.
 * @returns The HTTP status and parsed body of the router's own response.
 */
async function deliverToWebhookRouter(
    notificationUrl: string
): Promise<{ status: number; body: Record<string, unknown> }> {
    const router = createMercadoPagoWebhookRoutes();
    expect(router).not.toBeNull();

    const configured = new URL(notificationUrl);
    // MP appends its params with `&` when the configured URL already has a
    // query string, and with `?` when it does not — reproduced faithfully so
    // the request path is the one production receives, not a normalized one.
    const separator = configured.search === '' ? '?' : '&';
    const requestPath = `${configured.pathname}${configured.search}${separator}${MP_APPENDED_PARAMS}`;

    // The router is mounted at the webhook path in `routes/index.ts`; requesting
    // it standalone means the path below is relative to its own mount point.
    const relativePath = requestPath.replace('/api/v1/webhooks/mercadopago', '') || '/';

    const response = await (router as unknown as Hono).request(relativePath, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-signature': 'ts=1,v1=abc' },
        body: JSON.stringify({ type: 'subscription_preapproval', data: { id: 'pre_1' } })
    });

    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

beforeEach(() => {
    vi.clearAllMocks();
    customersGetByExternalIdMock.mockResolvedValue({ id: 'cus_1' });
    initiateMock.mockResolvedValue({
        checkoutUrl: 'https://mp.example.com/checkout',
        localSubscriptionId: 'sub_1'
    });
});

describe('HOS-1281 — partner send-link notification_url survives the webhook router', () => {
    it('is not dropped as a legacy IPN duplicate when MercadoPago delivers to it', async () => {
        // Arrange — the URL the handler really produces.
        const notificationUrl = await captureNotificationUrl();

        // Act — the real marker middleware judges it.
        const { status, body } = await deliverToWebhookRouter(notificationUrl);

        // Assert — the router's own verdict, not a substring of the URL. Before
        // the fix this body was `{ received: true, dropped: 'legacy-ipn-duplicate' }`
        // with the same 200 status, which is precisely why the failure was
        // invisible in production.
        expect(body.dropped).toBeUndefined();
        expect(body.reachedDispatch).toBe(true);
        expect(status).toBe(200);
    });

    it('the router DOES drop the same URL stripped of its query string (the detector is not vacuous)', async () => {
        // Arrange — a guard that never fails proves nothing. This is the exact
        // pre-fix URL: the same builder output with the marker removed.
        const notificationUrl = await captureNotificationUrl();
        const withoutMarker = new URL(notificationUrl);
        withoutMarker.search = '';

        // Act
        const { status, body } = await deliverToWebhookRouter(withoutMarker.toString());

        // Assert — dropped, and dropped with a 200: the silent-loss shape.
        expect(body.dropped).toBe('legacy-ipn-duplicate');
        expect(body.reachedDispatch).toBeUndefined();
        expect(status).toBe(200);
    });

    it('the router rejects a DIFFERENT marker value, so the accepted URL carries the one it demands', async () => {
        // Arrange — closes the "any marker will do" reading of test 1: a URL
        // carrying `?source_news=<anything else>` must still be dropped, so
        // test 1 passing means the handler emits the router's exact expected
        // value and not merely some query string.
        const notificationUrl = await captureNotificationUrl();
        const wrongMarker = new URL(notificationUrl);
        wrongMarker.search = '?source_news=ipn';

        // Act
        const { status, body } = await deliverToWebhookRouter(wrongMarker.toString());

        // Assert
        expect(body.dropped).toBe('legacy-ipn-duplicate');
        expect(status).toBe(200);
    });

    it('emits the SAME notification_url as the shared builder every other checkout uses', async () => {
        // Arrange + Act — a second, independent anchor: the partner flow must
        // not merely satisfy the router, it must not own a private copy that
        // can drift again. Compared against the shared builder's live output
        // rather than a literal, so a deliberate change to the marker updates
        // both sides at once.
        const { buildNotificationUrl } = await import(
            '../../../../src/routes/billing/checkout-return-urls'
        );
        const notificationUrl = await captureNotificationUrl();

        // Assert
        expect(notificationUrl).toBe(buildNotificationUrl());
    });
});
