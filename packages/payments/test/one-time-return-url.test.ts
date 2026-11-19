/**
 * HOS-2179 (owner decision): a payment page's return URL is https only in production. Outside
 * production, and only through the provider's own configuration, plain http is accepted for
 * `localhost` and `127.0.0.1` so the flow can be run locally. Any other http host is refused in
 * every environment. The adapter and the fake apply the same rule.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it, vi } from 'vitest';
import { FakePaymentProvider } from '../src/fake/index';
import {
    MercadoPagoPaymentProvider,
    type OneTimePaymentInput,
    OneTimePaymentInputSchema
} from '../src/index';

const NOW = new Date('2026-11-19T12:00:00.000Z');
const clock = createAdjustableClock({ start: NOW });

const LOCAL_HTTP = [
    'http://localhost:4321/es/mi-cuenta/complementos/?compra=p-1',
    'http://127.0.0.1:4321/es/mi-cuenta/complementos/?compra=p-1'
] as const;

const FOREIGN_HTTP = [
    'http://hospeda.example/es/mi-cuenta/complementos/',
    'http://localhost.evil.example/return',
    'http://127.0.0.1.nip.io/return',
    'http://192.168.0.10/return'
] as const;

function input(returnUrl: string): OneTimePaymentInput {
    return {
        reference: 'p-1',
        idempotencyKey: 'page:p-1',
        amount: { amountMinor: 1_000_000, currency: 'ARS' },
        reason: 'Destacado 7 días',
        returnUrl,
        expiresAt: '2026-11-19T13:00:00.000Z'
    };
}

function adapter(options: { readonly allowLocalHttpReturnUrl?: boolean }) {
    const fetch = vi.fn<typeof globalThis.fetch>(
        async () =>
            new Response(
                JSON.stringify({
                    id: 'P',
                    init_point: 'https://mp.example/p',
                    expires: true,
                    expiration_date_to: '2026-11-19T13:00:00.000Z'
                }),
                { status: 201 }
            )
    );
    return {
        fetch,
        provider: new MercadoPagoPaymentProvider({
            clock,
            accessToken: 'test-token',
            fetch,
            ...options
        })
    };
}

function fake(options: { readonly allowLocalHttpReturnUrl?: boolean }) {
    return new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID(), ...options });
}

describe('outside production (allowLocalHttpReturnUrl: true)', () => {
    it.each(LOCAL_HTTP)('the adapter accepts %s and sends it as the return URL', async (url) => {
        const { fetch, provider } = adapter({ allowLocalHttpReturnUrl: true });
        await expect(provider.requestOneTimePayment(input(url))).resolves.toMatchObject({
            paymentPageId: 'P'
        });
        const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
        expect(body.back_urls.success).toBe(url);
    });

    it.each(LOCAL_HTTP)('the fake accepts %s', async (url) => {
        await expect(
            fake({ allowLocalHttpReturnUrl: true }).requestOneTimePayment(input(url))
        ).resolves.toMatchObject({ paymentPageId: expect.any(String) });
    });
});

describe('in production (the default)', () => {
    it.each(LOCAL_HTTP)('the adapter refuses %s before any call', async (url) => {
        for (const options of [{}, { allowLocalHttpReturnUrl: false }]) {
            const { fetch, provider } = adapter(options);
            await expect(provider.requestOneTimePayment(input(url))).rejects.toMatchObject({
                code: 'INVALID_INPUT'
            });
            expect(fetch).not.toHaveBeenCalled();
        }
    });

    it.each(LOCAL_HTTP)('the fake refuses %s', async (url) => {
        for (const options of [{}, { allowLocalHttpReturnUrl: false }])
            await expect(fake(options).requestOneTimePayment(input(url))).rejects.toMatchObject({
                code: 'INVALID_INPUT'
            });
    });

    it.each(LOCAL_HTTP)('the exported production schema refuses %s', (url) => {
        expect(OneTimePaymentInputSchema.safeParse(input(url)).success).toBe(false);
        expect(
            OneTimePaymentInputSchema.safeParse(input('https://hospeda.example/return')).success
        ).toBe(true);
    });

    it('still accepts https', async () => {
        const { provider } = adapter({});
        await expect(
            provider.requestOneTimePayment(input('https://hospeda.example/return'))
        ).resolves.toMatchObject({ paymentPageId: 'P' });
        await expect(
            fake({}).requestOneTimePayment(input('https://hospeda.example/return'))
        ).resolves.toMatchObject({ paymentPageId: expect.any(String) });
    });
});

describe('any other http host, in every environment', () => {
    it.each(FOREIGN_HTTP)('the adapter and the fake refuse %s', async (url) => {
        for (const allowLocalHttpReturnUrl of [true, false]) {
            const { fetch, provider } = adapter({ allowLocalHttpReturnUrl });
            await expect(provider.requestOneTimePayment(input(url))).rejects.toMatchObject({
                code: 'INVALID_INPUT'
            });
            expect(fetch).not.toHaveBeenCalled();
            await expect(
                fake({ allowLocalHttpReturnUrl }).requestOneTimePayment(input(url))
            ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        }
    });
});
