import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake';
import { startFakeProviderServer } from '../src/fake-server';
import { MercadoPagoPaymentProvider } from '../src/index';

const clock = createAdjustableClock({ start: new Date('2026-10-01T00:00:00Z') });
const input = {
    reference: 'request-1',
    idempotencyKey: 'key-1',
    amount: { amountMinor: 2500, currency: 'ARS' },
    payerEmail: 'buyer@example.test',
    paymentToken: 'token-1',
    paymentBrand: 'master',
    paymentKind: 'credit' as const
};
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
    return { fake, server, adapter };
}
afterEach(async () => Promise.all(servers.splice(0).map((server) => server.close())));

describe('HOS-1554 AC:B6:12 RP15/RP16 fake HTTP order charge', () => {
    it('creates, rereads and replays one paid order', async () => {
        const { fake, adapter } = await setup();
        const first = await adapter.chargeOnce(input);
        expect((await adapter.readOrder({ orderId: first.orderId })).snapshot).toMatchObject({
            orderId: first.orderId,
            reference: input.reference,
            hasApprovedPayment: true
        });
        expect(await adapter.chargeOnce(input)).toEqual(first);
        expect(fake.ordersFor({ reference: input.reference })).toEqual({ orders: 1, paid: 1 });
    });

    it('maps a changed body to KEY_REUSED and keeps one order', async () => {
        const { fake, adapter } = await setup();
        await adapter.chargeOnce(input);
        await expect(
            adapter.chargeOnce({ ...input, paymentToken: 'token-2' })
        ).rejects.toMatchObject({ code: 'REJECTED', refundRefusal: 'KEY_REUSED' });
        expect(fake.ordersFor({ reference: input.reference })).toEqual({ orders: 1, paid: 1 });
    });

    it('returns a declined order id through HTTP 402', async () => {
        const { fake, adapter } = await setup();
        fake.declineOrderPayments({ paymentToken: input.paymentToken });
        const result = await adapter.chargeOnce(input);
        expect(result.declined).toBe(true);
        expect(
            (await adapter.readOrder({ orderId: result.orderId })).snapshot.hasApprovedPayment
        ).toBe(false);
        expect(fake.ordersFor({ reference: input.reference })).toEqual({ orders: 1, paid: 0 });
    });

    it('requires the idempotency key on raw POST', async () => {
        const { server } = await setup();
        const response = await fetch(`${server.url}/v1/orders`, {
            method: 'POST',
            headers: { Authorization: 'Bearer test-token' },
            body: '{}'
        });
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ code: 'empty_required_header' });
    });
});
