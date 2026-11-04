import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it, vi } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/index';

const clock = createAdjustableClock({ start: new Date('2026-10-01T00:00:00Z') });
const input = {
    reference: 'request-1',
    idempotencyKey: 'persisted-key',
    amount: { amountMinor: 2500, currency: 'ARS' },
    payerEmail: 'buyer@example.test',
    paymentToken: 'token-1',
    paymentBrand: 'master',
    paymentKind: 'credit' as const
};
function setup(status: number, body: unknown) {
    const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response(JSON.stringify(body), { status }));
    return {
        fetch,
        adapter: new MercadoPagoPaymentProvider({ clock, accessToken: 'test-token', fetch })
    };
}

describe('HOS-1554 AC:B6:12 MP:EX-41/EX-30 order charge adapter', () => {
    it('sends the exact measured body and persisted header, then returns the created id', async () => {
        const { adapter, fetch } = setup(201, { id: 'ORD1', status: 'processed' });
        expect(await adapter.chargeOnce(input)).toEqual({ orderId: 'ORD1', declined: false });
        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, init] = fetch.mock.calls[0] ?? [];
        expect(url).toBe('https://api.mercadopago.com/v1/orders');
        expect(new Headers(init?.headers).get('X-Idempotency-Key')).toBe('persisted-key');
        expect(JSON.parse(String(init?.body))).toEqual({
            type: 'online',
            external_reference: 'request-1',
            total_amount: '25.00',
            processing_mode: 'automatic',
            payer: { email: 'buyer@example.test' },
            transactions: {
                payments: [
                    {
                        amount: '25.00',
                        payment_method: {
                            id: 'master',
                            type: 'credit_card',
                            token: 'token-1',
                            installments: 1
                        }
                    }
                ]
            }
        });
    });

    it('returns the failed order id from a 402 error body', async () => {
        const { adapter } = setup(402, { data: { id: 'FAILED1', status: 'failed' } });
        expect(await adapter.chargeOnce(input)).toEqual({ orderId: 'FAILED1', declined: true });
    });

    it.each([
        [402, {}, 'UNAVAILABLE', undefined],
        [409, { code: 'idempotency_key_already_used' }, 'REJECTED', 'KEY_REUSED'],
        [400, { code: 'bad_request' }, 'REJECTED', undefined],
        [500, { code: 'server_error' }, 'UNAVAILABLE', undefined]
    ] as const)('maps HTTP %i to %s', async (status, body, code, refundRefusal) => {
        const { adapter } = setup(status, body);
        await expect(adapter.chargeOnce(input)).rejects.toMatchObject({ code, refundRefusal });
    });
});
