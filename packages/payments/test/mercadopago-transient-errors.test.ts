import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { PaymentProviderError } from '../src/provider/errors';

const clock = createAdjustableClock({ start: new Date('2026-10-30T12:00:00.000Z') });
const authorizeInput = {
    reference: '976f2c54-0000-4000-8000-000000000001',
    amount: { amountMinor: 1800000, currency: 'ARS' as const },
    cadence: { everyMonths: 1 },
    reason: 'Plan',
    returnUrl: 'https://example.test/back',
    payerEmail: 'payer@example.test'
};

function adapter(fetchImpl: typeof globalThis.fetch) {
    return new MercadoPagoPaymentProvider({
        clock,
        accessToken: 'unit-test-token',
        fetch: fetchImpl
    });
}

async function failureOf(operation: Promise<unknown>): Promise<PaymentProviderError> {
    try {
        await operation;
    } catch (error) {
        if (error instanceof PaymentProviderError) return error;
        throw error;
    }
    throw new Error('Expected a PaymentProviderError');
}

describe('TEST:1968 transient Mercado Pago failures are classified on authorize', () => {
    it('marks a 429 as RATE_LIMITED and carries Retry-After seconds', async () => {
        const error = await failureOf(
            adapter(
                async () =>
                    new Response(JSON.stringify({ message: 'local_rate_limited' }), {
                        status: 429,
                        headers: { 'Retry-After': '17' }
                    })
            ).authorize(authorizeInput)
        );
        expect(error.code).toBe('UNAVAILABLE');
        expect(error.transient).toEqual({ kind: 'RATE_LIMITED', retryAfterSeconds: 17 });
    });

    it('measures an HTTP-date Retry-After against the injected clock (HOS-1976)', async () => {
        const date = new Date(clock.now().getTime() + 42_000).toUTCString();
        const error = await failureOf(
            adapter(
                async () => new Response('', { status: 429, headers: { 'Retry-After': date } })
            ).authorize(authorizeInput)
        );
        expect(error.transient).toEqual({ kind: 'RATE_LIMITED', retryAfterSeconds: 42 });
    });

    it('clamps an HTTP-date Retry-After already in the past to zero (HOS-1976)', async () => {
        const date = new Date(clock.now().getTime() - 60_000).toUTCString();
        const error = await failureOf(
            adapter(
                async () => new Response('', { status: 503, headers: { 'Retry-After': date } })
            ).authorize(authorizeInput)
        );
        expect(error.transient).toEqual({ kind: 'UNAVAILABLE', retryAfterSeconds: 0 });
    });

    it('marks a 429 without Retry-After as RATE_LIMITED with no hint', async () => {
        const error = await failureOf(
            adapter(
                async () => new Response('{"message":"local_rate_limited"}', { status: 429 })
            ).authorize(authorizeInput)
        );
        expect(error.transient).toEqual({ kind: 'RATE_LIMITED' });
    });

    it.each([500, 502, 503, 504])('marks a %i as UNAVAILABLE', async (status) => {
        const error = await failureOf(
            adapter(async () => new Response('', { status })).authorize(authorizeInput)
        );
        expect(error.transient).toEqual({ kind: 'UNAVAILABLE' });
    });

    it('marks a transport failure as UNAVAILABLE', async () => {
        const error = await failureOf(
            adapter(async () => {
                throw new TypeError('fetch failed');
            }).authorize(authorizeInput)
        );
        expect(error.code).toBe('UNAVAILABLE');
        expect(error.transient).toEqual({ kind: 'UNAVAILABLE' });
    });

    it('leaves a 400 rejection and a malformed 200 body non-transient', async () => {
        const rejected = await failureOf(
            adapter(
                async () => new Response('{"message":"invalid payer_email"}', { status: 400 })
            ).authorize(authorizeInput)
        );
        expect(rejected.code).toBe('REJECTED');
        expect(rejected.transient).toBeUndefined();

        const malformed = await failureOf(
            adapter(async () => new Response('{"unexpected":true}', { status: 200 })).authorize(
                authorizeInput
            )
        );
        expect(malformed.code).toBe('UNAVAILABLE');
        expect(malformed.transient).toBeUndefined();
    });
});
