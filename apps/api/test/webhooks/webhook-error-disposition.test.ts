/**
 * HOS-707 — what the MercadoPago webhook endpoint ANSWERS when dispatch fails.
 *
 * MercadoPago retries on 5xx. Before this fix every dispatch failure answered
 * 500, so a delivery referring to an object that does not exist — the dashboard
 * "test notification" button sends the fictitious id `123456` — became a zombie
 * that bounced forever, writing a stack trace per retry.
 *
 * The three situations that must be distinguishable:
 *
 * 1. the object does not exist at the provider   → 200 (nothing to do, ever)
 * 2. the object exists but is not ours           → 200 (MP answers 404 for a
 *    resource owned by another collector, so it lands on the same wire signal)
 * 3. the provider genuinely failed               → 5xx (we WANT the retry)
 *
 * The end-to-end block drives the REAL `createWebhookRouter` from
 * `@qazuor/qzpay-hono` so the asserted numbers are genuine HTTP statuses off a
 * real `Response`, including the router's own `response.error(message, 500)`
 * fallback for the retryable branch — not a status this test invented.
 *
 * @module test/webhooks/webhook-error-disposition
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (hoisted). Partial wherever the real module is still needed, so
// a future import of something new from these modules cannot silently become
// `undefined`.
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    getDb: vi.fn(),
    billingWebhookEvents: {
        id: 'id',
        providerEventId: 'providerEventId',
        status: 'status',
        provider: 'provider',
        type: 'type',
        payload: 'payload',
        error: 'error',
        processedAt: 'processedAt',
        createdAt: 'createdAt'
    },
    and: vi.fn(),
    or: vi.fn(),
    eq: vi.fn((field: unknown, value: unknown) => ({ field, value }))
}));

vi.mock('@repo/billing', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/billing')>()),
    createMercadoPagoAdapter: vi.fn(),
    getAddonBySlug: vi.fn()
}));

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../src/lib/sentry', () => ({
    captureWebhookError: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

const mockMarkEventProcessedByProviderId = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockMarkEventFailedByProviderId = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../../src/routes/webhooks/mercadopago/utils', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../src/routes/webhooks/mercadopago/utils')>();
    return {
        ...actual,
        markEventProcessedByProviderId: mockMarkEventProcessedByProviderId,
        markEventFailedByProviderId: mockMarkEventFailedByProviderId
    };
});

// ---------------------------------------------------------------------------
// Imports (vi.mock calls above are hoisted, so these are safe)
// ---------------------------------------------------------------------------

import type { QZPayBilling, QZPayPaymentAdapter, QZPayWebhookEvent } from '@qazuor/qzpay-core';
import { createWebhookRouter } from '@qazuor/qzpay-hono';
import { Hono } from 'hono';
import { captureWebhookError } from '../../src/lib/sentry';
import { classifyWebhookError } from '../../src/routes/webhooks/mercadopago/error-classification';
import { handleWebhookError } from '../../src/routes/webhooks/mercadopago/event-handler';

// ---------------------------------------------------------------------------
// Error fixtures — the REAL shapes, verified against the installed packages.
// ---------------------------------------------------------------------------

/**
 * The exact error observed in staging on 2026-08-20.
 *
 * `mercadopago@2.12.0`'s `RestClient.fetch` does `throw await response.json()`
 * on a non-2xx, i.e. it throws MercadoPago's raw error envelope (which carries
 * `status`), not an `Error`. `@qazuor/qzpay-mercadopago`'s `mapMercadoPagoError`
 * then wraps it: `cause` is `[]` so the per-cause-code switch never runs and it
 * falls through to the generic `provider_error` branch, producing
 * `${context} - ${error.message}`. That is why `code` alone cannot separate this
 * from a real outage, and why the nested `status` is the load-bearing signal.
 */
function makeProviderNotFoundError(): Error {
    return Object.assign(
        new Error('Retrieve subscription - The preapproval with id 123456 does not exist'),
        {
            name: 'QZPayMercadoPagoError',
            code: 'provider_error',
            originalError: {
                message: 'The preapproval with id 123456 does not exist',
                error: 'not_found',
                status: 404,
                cause: []
            }
        }
    );
}

/**
 * A preapproval that exists at MercadoPago but belongs to another collector.
 * MercadoPago scopes by collector and answers 404 (never 403), so this is the
 * same wire signal as "does not exist" — and must get the same answer.
 */
function makeForeignResourceError(): Error {
    return Object.assign(new Error('Retrieve subscription - Preapproval not found'), {
        name: 'QZPayMercadoPagoError',
        code: 'provider_error',
        originalError: {
            message: 'Preapproval not found',
            error: 'not_found',
            status: 404,
            cause: []
        }
    });
}

/**
 * MercadoPago itself failed — 500 from their side. The retry is the whole point.
 */
function makeProviderOutageError(): Error {
    return Object.assign(new Error('Retrieve subscription - Internal server error'), {
        name: 'QZPayMercadoPagoError',
        code: 'provider_error',
        originalError: {
            message: 'Internal server error',
            error: 'internal_error',
            status: 500,
            cause: []
        }
    });
}

/** The socket died mid-request. The provider never answered at all. */
function makeNetworkError(): Error {
    return Object.assign(new Error('request to https://api.mercadopago.com failed'), {
        name: 'FetchError',
        code: 'ECONNRESET'
    });
}

// ---------------------------------------------------------------------------
// End-to-end: real qzpay-hono router, real HTTP statuses
// ---------------------------------------------------------------------------

/**
 * Mount the REAL `createWebhookRouter` with a handler that throws `error`, and
 * return the status the endpoint actually answers.
 *
 * Signature verification is stubbed to pass so the request reaches dispatch;
 * everything downstream (the try/catch, the `onError` call, the
 * `response.error(message, 500)` fallback) is the shipped library code.
 *
 * @param error - What the event handler throws.
 * @returns The HTTP status and parsed JSON body of the endpoint's response.
 */
async function statusForThrownError(
    error: unknown
): Promise<{ status: number; body: Record<string, unknown> }> {
    const event: QZPayWebhookEvent = {
        id: '123456',
        type: 'subscription.updated',
        data: { id: '123456' },
        created: new Date()
    } as QZPayWebhookEvent;

    const paymentAdapter = {
        provider: 'mercadopago',
        webhooks: {
            verifySignature: () => true,
            constructEvent: () => event
        }
    } as unknown as QZPayPaymentAdapter;

    const router = createWebhookRouter({
        billing: {} as unknown as QZPayBilling,
        paymentAdapter,
        signatureHeader: 'x-signature',
        handlers: {
            'subscription.updated': async () => {
                throw error;
            }
        },
        onError: handleWebhookError
    });

    const app = new Hono();
    // TYPE-WORKAROUND: the qzpay router carries its own typed Hono variables.
    app.route('/', router as unknown as Hono);

    const response = await app.request(
        '/?source_news=webhooks&data.id=123456&type=subscription_authorized_payment',
        {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-signature': 'ts=1,v1=abc' },
            body: JSON.stringify({ id: 123456, type: 'subscription_preapproval' })
        }
    );

    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('MercadoPago webhook — response status per failure situation (HOS-707)', () => {
    it('situation 1: the object does not exist at the provider → 200, not 500', async () => {
        // Arrange
        const error = makeProviderNotFoundError();

        // Act
        const { status, body } = await statusForThrownError(error);

        // Assert
        expect(status).toBe(200);
        expect(body).toEqual({ received: true, ignored: 'provider-resource-missing' });
    });

    it('situation 2: the object exists but belongs to another collector → 200, not 500', async () => {
        // Arrange
        const error = makeForeignResourceError();

        // Act
        const { status, body } = await statusForThrownError(error);

        // Assert
        expect(status).toBe(200);
        expect(body).toEqual({ received: true, ignored: 'provider-resource-missing' });
    });

    it('situation 3: the provider genuinely failed (5xx) → 500 so MercadoPago retries', async () => {
        // Arrange
        const error = makeProviderOutageError();

        // Act
        const { status } = await statusForThrownError(error);

        // Assert
        expect(status).toBe(500);
    });

    it('situation 3b: the provider was unreachable (socket error) → 500 so MercadoPago retries', async () => {
        // Arrange
        const error = makeNetworkError();

        // Act
        const { status } = await statusForThrownError(error);

        // Assert
        expect(status).toBe(500);
    });

    it('an error with no provider signal at all stays 500 (fail-safe default)', async () => {
        // Arrange — e.g. SubscriptionNotResolvedError (HOS-276), deliberately
        // thrown so a settled charge with no local subscription IS retried.
        const error = Object.assign(new Error('Subscription not resolved for payment'), {
            name: 'SubscriptionNotResolvedError'
        });

        // Act
        const { status } = await statusForThrownError(error);

        // Assert
        expect(status).toBe(500);
    });
});

describe('MercadoPago webhook — bookkeeping and noise per situation (HOS-707)', () => {
    /**
     * Build a minimal Hono context whose `json()` returns a real `Response`.
     */
    function makeContext(requestId = 'req-hos-707') {
        const store: Record<string, unknown> = { requestId };
        return {
            get: (key: string) => store[key],
            set: (key: string, value: unknown) => {
                store[key] = value;
            },
            json: (data: unknown, status: number) =>
                new Response(JSON.stringify(data), {
                    status,
                    headers: { 'content-type': 'application/json' }
                })
        } as unknown as Parameters<typeof handleWebhookError>[1];
    }

    it('a terminal condition is NOT reported to Sentry', async () => {
        // Arrange
        const error = makeProviderNotFoundError();

        // Act
        await handleWebhookError(error, makeContext());

        // Assert — a 404 at the provider is not a fault of ours (HOS-682 family:
        // the log must not overstate its own severity).
        expect(captureWebhookError).not.toHaveBeenCalled();
    });

    it('a genuine provider failure IS reported to Sentry', async () => {
        // Arrange
        const error = makeProviderOutageError();

        // Act
        await handleWebhookError(error, makeContext());

        // Assert
        expect(captureWebhookError).toHaveBeenCalledTimes(1);
    });

    it('returns a 200 Response for terminal and undefined for retryable', async () => {
        // Act
        const terminal = await handleWebhookError(makeProviderNotFoundError(), makeContext('a'));
        const retryable = await handleWebhookError(makeProviderOutageError(), makeContext('b'));

        // Assert — `undefined` is what makes the qzpay-hono router fall through
        // to its own `response.error(message, 500)`.
        expect(terminal).toBeInstanceOf(Response);
        expect(terminal?.status).toBe(200);
        expect(retryable).toBeUndefined();
    });
});

describe('classifyWebhookError', () => {
    it.each([
        [
            'nested provider 404',
            makeProviderNotFoundError(),
            'terminal',
            'provider-resource-missing'
        ],
        ['nested provider 500', makeProviderOutageError(), 'retryable', 'provider-unavailable'],
        ['socket error', makeNetworkError(), 'retryable', 'provider-unreachable'],
        ['plain Error', new Error('boom'), 'retryable', 'unclassified']
    ])('classifies %s as %s/%s', (_label, error, disposition, reason) => {
        // Act
        const result = classifyWebhookError(error);

        // Assert
        expect(result.disposition).toBe(disposition);
        expect(result.reason).toBe(reason);
    });

    it('treats the adapter code resource_not_found as terminal even with no numeric status', () => {
        // Arrange — the shape mapMercadoPagoError produces when MP DOES return a
        // populated `cause` array with code "404".
        const error = Object.assign(new Error('Retrieve subscription - Resource not found: x'), {
            name: 'QZPayMercadoPagoError',
            code: 'resource_not_found'
        });

        // Act
        const result = classifyWebhookError(error);

        // Assert
        expect(result).toMatchObject({
            disposition: 'terminal',
            reason: 'provider-resource-missing'
        });
    });

    it('follows a QZPayProviderSyncError-style `cause` chain down to the provider status', () => {
        // Arrange
        const error = Object.assign(new Error('provider sync failed'), {
            name: 'QZPayProviderSyncError',
            cause: makeProviderNotFoundError()
        });

        // Act
        const result = classifyWebhookError(error);

        // Assert
        expect(result.disposition).toBe('terminal');
        expect(result.providerStatus).toBe(404);
    });

    it('keeps 429 retryable — a rate limit is exactly what a retry is for', () => {
        // Arrange
        const error = Object.assign(new Error('Retrieve subscription - Rate limit exceeded'), {
            name: 'QZPayMercadoPagoError',
            code: 'rate_limit_error',
            originalError: { status: 429 }
        });

        // Act
        const result = classifyWebhookError(error);

        // Assert
        expect(result.disposition).toBe('retryable');
        expect(result.reason).toBe('provider-unavailable');
    });

    it('keeps a provider 401 retryable — that is our credential, not a missing object', () => {
        // Arrange
        const error = Object.assign(new Error('Retrieve subscription - Authentication failed'), {
            name: 'QZPayMercadoPagoError',
            code: 'authentication_error',
            originalError: { status: 401 }
        });

        // Act
        const result = classifyWebhookError(error);

        // Assert
        expect(result.disposition).toBe('retryable');
    });

    it('survives a cyclic cause chain without hanging', () => {
        // Arrange
        const outer = new Error('outer') as Error & { cause?: unknown };
        const inner = new Error('inner') as Error & { cause?: unknown };
        outer.cause = inner;
        inner.cause = outer;

        // Act
        const result = classifyWebhookError(outer);

        // Assert
        expect(result.disposition).toBe('retryable');
    });
});
