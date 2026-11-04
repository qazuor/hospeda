import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';
import { type FakeProviderServer, startFakeProviderServer } from '../src/fake-server';

let server: FakeProviderServer | undefined;
afterEach(async () => {
    await server?.close();
    server = undefined;
});

async function start() {
    const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
    const provider = new FakePaymentProvider({ clock });
    server = await startFakeProviderServer({ provider, clock });
    return server;
}

describe('fake provider server throttle', () => {
    it('records throttled requests and restores routing after clearing throttle (kills pre-record throttling)', async () => {
        const http = await start();
        http.setThrottle({ throttle: { afterRequests: 0, status: 429, retryAfter: 7 } });
        const throttled = await fetch(`${http.url}/preapproval/missing`, {
            headers: { authorization: 'Bearer test' }
        });
        expect(throttled.status).toBe(429);
        expect(throttled.headers.get('Retry-After')).toBe('7');
        expect(http.requests()).toHaveLength(1);
        http.setThrottle({ throttle: undefined });
        const normal = await fetch(`${http.url}/preapproval/missing`, {
            headers: { authorization: 'Bearer test' }
        });
        expect(normal.status).toBe(404);
        expect(http.requests()).toHaveLength(2);
    });

    it('throttles every nth matching path only (kills global request counting)', async () => {
        const http = await start();
        http.setThrottle({ throttle: { everyNth: 2, paths: ['/preapproval/'], status: 429 } });
        const get = (path: string) =>
            fetch(`${http.url}${path}`, { headers: { authorization: 'Bearer test' } });
        expect((await get('/preapproval/a')).status).toBe(404);
        expect((await get('/authorized_payments/search')).status).toBe(400);
        expect((await get('/preapproval/b')).status).toBe(429);
        expect(http.requests()).toHaveLength(3);
    });

    it('surfaces fake-server throttling as a rate-limited provider error (kills 429 misclassification)', async () => {
        const http = await start();
        http.setThrottle({ throttle: { status: 429, retryAfter: 3 } });
        const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
        const provider = new MercadoPagoPaymentProvider({
            clock,
            baseUrl: http.url,
            accessToken: 'test-token',
            sleep: async () => undefined,
            readRetry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, maxTotalDelayMs: 0 }
        });
        await expect(
            provider.readAuthorization({ authorizationId: 'missing' })
        ).rejects.toMatchObject({
            transient: { kind: 'RATE_LIMITED', retryAfterSeconds: 3 }
        });
    });
});
