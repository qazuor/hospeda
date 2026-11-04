import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake';
import { startFakeProviderServer } from '../src/fake-server';
import { MercadoPagoPaymentProvider } from '../src/index';

const clock = createAdjustableClock({ start: new Date('2026-10-01T00:00:00Z') });
const servers: Array<{ close(): Promise<void> }> = [];

async function setup() {
    const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    const server = await startFakeProviderServer({ provider: fake, clock });
    servers.push(server);
    const adapter = new MercadoPagoPaymentProvider({
        clock,
        accessToken: 'test-token',
        baseUrl: server.url
    });
    const { orderId } = fake.placeOrder({
        reference: 'purchase',
        paid: true,
        amount: { amountMinor: 10_000, currency: 'ARS' }
    });
    const paymentTransactionId =
        (await adapter.readOrder({ orderId })).snapshot.paymentTransactionId ?? '';
    const input = {
        orderId,
        reference: 'key',
        scope: {
            kind: 'partial' as const,
            transactionId: paymentTransactionId,
            amount: { amountMinor: 2500, currency: 'ARS' }
        }
    };
    return { fake, server, adapter, orderId, input };
}

afterEach(async () => Promise.all(servers.splice(0).map((server) => server.close())));

describe('HOS-1553 AC:B6:8 TEST:B6:6 fake HTTP order refunds', () => {
    it('round trips the partial refund and replays the first result', async () => {
        const { adapter, orderId, input } = await setup();
        const first = await adapter.refundOrder(input);
        const read = await adapter.readOrder({ orderId });
        expect(read.snapshot.refunds).toStrictEqual(first.refunds);
        expect(first.refunds).toMatchObject([{ amountMinor: 2500, accredited: true }]);
        expect(await adapter.refundOrder(input)).toStrictEqual(first);
        expect((await adapter.readOrder({ orderId })).snapshot.refunds).toHaveLength(1);
    });

    it('returns KEY_REUSED for the same key with another amount', async () => {
        const { adapter, input } = await setup();
        await adapter.refundOrder(input);
        await expect(
            adapter.refundOrder({
                ...input,
                scope: { ...input.scope, amount: { amountMinor: 3000, currency: 'ARS' } }
            })
        ).rejects.toMatchObject({ code: 'REJECTED', refundRefusal: 'KEY_REUSED' });
    });

    it('requires the idempotency header on raw POST', async () => {
        const { server, orderId } = await setup();
        const response = await fetch(`${server.url}/v1/orders/${orderId}/refund`, {
            method: 'POST',
            headers: { Authorization: 'Bearer test-token' }
        });
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ code: 'empty_required_header' });
    });

    it('serializes a pending refund and reads it without accreditation', async () => {
        const { fake, server, adapter, orderId, input } = await setup();
        const result = await adapter.refundOrder(input);
        fake.holdOrderRefund({ orderId, refundId: result.refunds[0]?.refundId ?? '' });
        const raw = await fetch(`${server.url}/v1/orders/${orderId}`, {
            headers: { Authorization: 'Bearer test-token' }
        });
        const body = (await raw.json()) as { transactions: { refunds: Array<{ status: string }> } };
        expect(body.transactions.refunds[0]?.status).toBe('in_process');
        expect((await adapter.readOrder({ orderId })).snapshot.refunds[0]?.accredited).toBe(false);
    });
});
