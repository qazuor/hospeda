import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it, vi } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/index';

const clock = createAdjustableClock({ start: new Date('2026-10-01T00:00:00.000Z') });
const refunds = [
    { id: 'REF1', amount: '25.00', status: 'processed' },
    { id: 'REF2', amount: 10, status: 'in_process' }
];
const mapped = [
    { refundId: 'REF1', amountMinor: 2500, accredited: true },
    { refundId: 'REF2', amountMinor: 1000, accredited: false }
];

function setup(response: { readonly status: number; readonly body?: unknown }) {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response(response.body === undefined ? undefined : JSON.stringify(response.body), {
            status: response.status
        })
    );
    return {
        fetch,
        provider: new MercadoPagoPaymentProvider({ clock, accessToken: 'test-token', fetch })
    };
}

describe('HOS-1553 AC:B6:8 TEST:B6:6 Mercado Pago order refunds', () => {
    it('sends a total without a body and with the persisted key', async () => {
        const { provider, fetch } = setup({ status: 201, body: { transactions: { refunds: [] } } });
        await provider.refundOrder({
            orderId: 'ORD1',
            reference: 'key-1',
            scope: { kind: 'total' }
        });
        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, init] = fetch.mock.calls[0] ?? [];
        expect(url).toBe('https://api.mercadopago.com/v1/orders/ORD1/refund');
        expect(init?.method).toBe('POST');
        expect(new Headers(init?.headers).get('X-Idempotency-Key')).toBe('key-1');
        expect(init?.body).toBeUndefined();
    });

    it('sends the exact measured partial body and maps all returned refunds', async () => {
        const { provider, fetch } = setup({ status: 201, body: { transactions: { refunds } } });
        const result = await provider.refundOrder({
            orderId: 'ORD1',
            reference: 'key-2',
            scope: {
                kind: 'partial',
                transactionId: 'PAY1',
                amount: { amountMinor: 2500, currency: 'ARS' }
            }
        });
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0]?.[1]?.body).toBe(
            '{"transactions":[{"id":"PAY1","amount":"25.00"}]}'
        );
        expect(result.refunds).toStrictEqual(mapped);
    });

    it.each([
        { status: 409, code: 'REJECTED', refusal: 'KEY_REUSED' },
        { status: 404, code: 'NOT_FOUND', refusal: undefined },
        { status: 400, code: 'REJECTED', refusal: undefined },
        { status: 500, code: 'UNAVAILABLE', refusal: undefined }
    ])('maps HTTP $status to $code', async ({ status, code, refusal }) => {
        const { provider } = setup({ status, body: { code: 'idempotency_key_already_used' } });
        await expect(
            provider.refundOrder({ orderId: 'ORD1', reference: 'key', scope: { kind: 'total' } })
        ).rejects.toMatchObject({ code, refundRefusal: refusal });
    });

    it('refuses malformed refund amounts and unexpected success statuses', async () => {
        const malformed = setup({
            status: 201,
            body: { transactions: { refunds: [{ id: 'R', amount: 'abc', status: 'processed' }] } }
        });
        await expect(
            malformed.provider.refundOrder({
                orderId: 'O',
                reference: 'k',
                scope: { kind: 'total' }
            })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        const unexpected = setup({ status: 200, body: {} });
        await expect(
            unexpected.provider.refundOrder({
                orderId: 'O',
                reference: 'k',
                scope: { kind: 'total' }
            })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    });

    it('rejects a finite POST amount that overflows minor units', async () => {
        const { provider } = setup({
            status: 201,
            body: { transactions: { refunds: [{ id: 'R', amount: '1e307', status: 'processed' }] } }
        });
        await expect(
            provider.refundOrder({ orderId: 'O', reference: 'k', scope: { kind: 'total' } })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE', capability: 'refund' });
    });

    it('rejects a finite read amount that overflows minor units', async () => {
        const { provider } = setup({
            status: 200,
            body: {
                id: 'ORD1',
                status: 'processed',
                created_date: '2026-09-30T00:00:00Z',
                transactions: { refunds: [{ id: 'R', amount: '1e307', status: 'processed' }] }
            }
        });
        await expect(provider.readOrder({ orderId: 'ORD1' })).rejects.toMatchObject({
            code: 'UNAVAILABLE',
            capability: 'read'
        });
    });

    it('reads transaction and refunds by order id, and defaults absent transactions', async () => {
        const order = {
            id: 'ORD1',
            status: 'processed',
            created_date: '2026-09-30T00:00:00Z',
            transactions: { payments: [{ id: 'PAY1' }], refunds }
        };
        const present = setup({ status: 200, body: order });
        expect((await present.provider.readOrder({ orderId: 'ORD1' })).snapshot).toMatchObject({
            paymentTransactionId: 'PAY1',
            refunds: mapped
        });
        const absent = setup({
            status: 200,
            body: { id: 'ORD1', status: 'processed', created_date: order.created_date }
        });
        expect((await absent.provider.readOrder({ orderId: 'ORD1' })).snapshot).toMatchObject({
            paymentTransactionId: null,
            refunds: []
        });
    });

    it.each([
        { orderId: '', reference: 'k', scope: { kind: 'total' } },
        { orderId: 'O', reference: 'k', scope: { transactionId: 'PAY1' } }
    ])('rejects invalid input before fetch', async (input) => {
        const { provider, fetch } = setup({ status: 201, body: {} });
        await expect(
            provider.refundOrder(input as Parameters<typeof provider.refundOrder>[0])
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        expect(fetch).toHaveBeenCalledTimes(0);
    });
});
