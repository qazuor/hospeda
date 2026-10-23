import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it, vi } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { PaymentProviderError } from '../src/provider/errors';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
const authorization = {
    reference: 'sub-error-body',
    amount: { amountMinor: 1500, currency: 'ARS' },
    cadence: { everyMonths: 1 },
    reason: 'Error body test',
    returnUrl: 'https://example.test/return',
    payerEmail: 'someone@local.test'
} as const;

function provider(fetch: typeof globalThis.fetch, sleep?: (ms: number) => Promise<void>) {
    return new MercadoPagoPaymentProvider({
        clock,
        accessToken: 'unit-test-token',
        fetch,
        ...(sleep ? { sleep } : {})
    });
}

function jsonResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' }
    });
}

async function providerFailure<T>(operation: Promise<T>): Promise<PaymentProviderError> {
    try {
        await operation;
    } catch (error) {
        if (error instanceof PaymentProviderError) return error;
        throw error;
    }
    throw new Error('Expected a PaymentProviderError');
}

function bodyOf(error: PaymentProviderError): unknown {
    return (error.cause as { readonly body: unknown }).body;
}

describe('Mercado Pago error body (TEST:1746:1, TEST:1746:2)', () => {
    it('TEST:1746:1 preserves a sanitized provider rejection in cause', async () => {
        // This invented payload verifies local sanitization; it is not a captured Mercado Pago body.
        const inventedBody = {
            message: 'invalid payer_email',
            error: 'bad_request',
            status: 400,
            cause: [{ code: 2034, description: 'Invalid users involved' }],
            payer_email: 'someone@local.test',
            detail: 'payer someone@local.test rejected'
        };
        const adapter = provider(async () => jsonResponse(400, inventedBody));

        const failure = await providerFailure(adapter.authorize(authorization));

        expect(failure).toBeInstanceOf(PaymentProviderError);
        expect(failure).toMatchObject({
            code: 'REJECTED',
            capability: 'authorize',
            message: 'Mercado Pago request failed (400)',
            cause: {
                status: 400,
                body: {
                    message: 'invalid payer_email',
                    cause: [{ code: 2034 }],
                    payer_email: '[REDACTED]'
                }
            }
        });
        expect(JSON.stringify(failure.cause)).not.toContain('someone@local.test');
    });

    it('TEST:1746:2 keeps text and empty bodies and truncates oversized JSON text', async () => {
        const text = 'provider rejected this request';
        const textFailure = await providerFailure(
            provider(async () => new Response(text, { status: 400 })).authorize(authorization)
        );
        expect(bodyOf(textFailure)).toBe(text);

        const emptyFailure = await providerFailure(
            provider(async () => new Response('', { status: 400 })).authorize(authorization)
        );
        expect(bodyOf(emptyFailure)).toBe('');

        const oversizedFailure = await providerFailure(
            provider(async () => new Response('x'.repeat(5000), { status: 400 })).authorize(
                authorization
            )
        );
        expect(bodyOf(oversizedFailure)).toBe(
            `${JSON.stringify('x'.repeat(5000)).slice(0, 2000)}…[truncated]`
        );

        const notFound = await providerFailure(
            provider(async () => jsonResponse(404, { message: 'missing' })).readAuthorization({
                authorizationId: 'missing'
            })
        );
        expect(notFound).toMatchObject({ code: 'NOT_FOUND', cause: { status: 404 } });

        const sleep = vi.fn(async (_ms: number) => {});
        const unavailable = await providerFailure(
            provider(
                async () => jsonResponse(503, { message: 'temporarily unavailable' }),
                sleep
            ).readAuthorization({ authorizationId: 'auth-x' })
        );
        expect(unavailable).toMatchObject({ code: 'UNAVAILABLE', cause: { status: 503 } });
        expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([500, 1000]);
    });
});
