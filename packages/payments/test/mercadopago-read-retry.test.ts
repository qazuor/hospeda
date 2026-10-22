import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it, vi } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import type { MercadoPagoReadRetryPolicy } from '../src/adapters/mercadopago/mercadopago-read-retry';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
const auth = {
    id: 'preapproval-1',
    external_reference: 'sub-1',
    status: 'authorized',
    auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 15,
        currency_id: 'ARS'
    }
};
const authorizeInput = {
    reference: 'sub-1',
    amount: { amountMinor: 1500, currency: 'ARS' },
    cadence: { everyMonths: 1 },
    reason: 'Plan',
    returnUrl: 'https://example.test/return'
} as const;

function response(status: number, headers?: Record<string, string>): Response {
    return new Response(status === 200 ? JSON.stringify(auth) : null, { status, headers });
}

function setup(
    fetch: typeof globalThis.fetch,
    extra: {
        readonly sleep?: (ms: number) => Promise<void>;
        readonly readRetry?: MercadoPagoReadRetryPolicy;
    } = {}
) {
    return new MercadoPagoPaymentProvider({
        clock,
        accessToken: 'unit-test-token',
        fetch,
        ...extra
    });
}

describe('MercadoPago GET retry policy', () => {
    it('TEST:1737:1 retries a 429 and resolves on the next authorization read', async () => {
        const fetch = vi
            .fn<typeof globalThis.fetch>()
            .mockResolvedValueOnce(response(429))
            .mockResolvedValueOnce(response(200));
        const sleep = vi.fn(async (_ms: number) => {});
        await expect(
            setup(fetch, { sleep }).readAuthorization({ authorizationId: 'preapproval-1' })
        ).resolves.toMatchObject({ snapshot: { status: 'active' } });
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(sleep).toHaveBeenCalledExactlyOnceWith(500);
    });

    it('TEST:1737:2 returns the final 429 as UNAVAILABLE after three attempts', async () => {
        const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response(429));
        const sleep = vi.fn(async (_ms: number) => {});
        await expect(
            setup(fetch, { sleep }).readAuthorization({ authorizationId: 'preapproval-1' })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE', message: expect.stringContaining('(429)') });
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([500, 1000]);
    });

    it('TEST:1737:3 never retries POST or PUT writes', async () => {
        for (const run of [
            (provider: MercadoPagoPaymentProvider) => provider.authorize(authorizeInput),
            (provider: MercadoPagoPaymentProvider) =>
                provider.cancel({ authorizationId: 'preapproval-1' })
        ]) {
            const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response(429));
            const sleep = vi.fn(async (_ms: number) => {});
            await expect(run(setup(fetch, { sleep }))).rejects.toMatchObject({
                code: 'UNAVAILABLE'
            });
            expect(fetch).toHaveBeenCalledTimes(1);
            expect(sleep).not.toHaveBeenCalled();
        }
    });

    it('TEST:1737:4 does not retry 404 or 400 reads', async () => {
        for (const [status, code] of [
            [404, 'NOT_FOUND'],
            [400, 'REJECTED']
        ] as const) {
            const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response(status));
            const provider = setup(fetch, { sleep: vi.fn(async () => {}) });
            await expect(
                provider.readAuthorization({ authorizationId: 'missing' })
            ).rejects.toMatchObject({ code });
            expect(fetch).toHaveBeenCalledTimes(1);
        }
    });

    it('TEST:1737:5 retries a transient fetch rejection', async () => {
        const fetch = vi
            .fn<typeof globalThis.fetch>()
            .mockRejectedValueOnce(new TypeError('fetch failed'))
            .mockResolvedValueOnce(response(200));
        const provider = setup(fetch, { sleep: vi.fn(async () => {}) });
        await expect(
            provider.readAuthorization({ authorizationId: 'preapproval-1' })
        ).resolves.toMatchObject({ snapshot: { status: 'active' } });
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('TEST:1737:6 honors Retry-After, caps each delay and enforces the total delay budget', async () => {
        const delayFor = async (header: string) => {
            const fetch = vi
                .fn<typeof globalThis.fetch>()
                .mockResolvedValueOnce(response(429, { 'Retry-After': header }))
                .mockResolvedValueOnce(response(200));
            const sleep = vi.fn(async (_ms: number) => {});
            await setup(fetch, { sleep }).readAuthorization({ authorizationId: 'preapproval-1' });
            return sleep.mock.calls[0]?.[0];
        };
        expect(await delayFor('1')).toBe(1000);
        expect(await delayFor('30')).toBe(2000);
        expect(await delayFor(new Date(clock.now().getTime() + 1000).toUTCString())).toBe(1000);
        const policy = {
            maxAttempts: 3,
            baseDelayMs: 500,
            maxDelayMs: 2000,
            maxTotalDelayMs: 2500
        };
        const fetch = vi
            .fn<typeof globalThis.fetch>()
            .mockResolvedValue(response(429, { 'Retry-After': '2' }));
        const sleep = vi.fn(async (_ms: number) => {});
        await expect(
            setup(fetch, { sleep, readRetry: policy }).readAuthorization({
                authorizationId: 'preapproval-1'
            })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([2000]);
    });

    it('TEST:1737:9 retries readCharge through the same GET path', async () => {
        const charge = {
            id: 'charge-1',
            date_created: '2026-10-01T03:00:00.000Z',
            status: 'pending',
            transaction_amount: 15,
            currency_id: 'ARS'
        };
        const fetch = vi
            .fn<typeof globalThis.fetch>()
            .mockResolvedValueOnce(response(429))
            .mockResolvedValueOnce(new Response(JSON.stringify(charge), { status: 200 }));
        const sleep = vi.fn(async (_ms: number) => {});
        await expect(
            setup(fetch, { sleep }).readCharge({ chargeId: 'charge-1' })
        ).resolves.toMatchObject({ snapshot: { chargeId: 'charge-1' } });
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(sleep).toHaveBeenCalledExactlyOnceWith(500);
    });
});
