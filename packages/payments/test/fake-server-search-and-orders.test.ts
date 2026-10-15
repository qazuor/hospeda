import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';
import { startFakeProviderServer } from '../src/fake-server/fake-provider-server';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
const servers: Array<{ close(): Promise<void> }> = [];

async function setup() {
    const provider = new FakePaymentProvider({
        clock,
        idNamespace: crypto.randomUUID(),
        honestAbout: [{ lie: 'M4', why: 'HTTP route assertions require complete search results' }]
    });
    const server = await startFakeProviderServer({ provider, clock });
    servers.push(server);
    return { provider, server };
}

async function request(url: string) {
    return fetch(url, { headers: { Authorization: 'Bearer test-token' } });
}

afterEach(async () => Promise.all(servers.splice(0).map((server) => server.close())));

describe('fake server search and orders routes', () => {
    it('requires both order search dates and returns the provider missing-params response', async () => {
        const { server } = await setup();
        const response = await request(`${server.url}/v1/orders?external_reference=r`);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ code: 'missing_required_params' });
    });

    it('ignores external_reference at the authorization search boundary', async () => {
        const { provider, server } = await setup();
        const made = await provider.authorize({
            reference: 'actual-ref',
            amount: { amountMinor: 1500, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'Plan',
            returnUrl: 'https://example.test/return'
        });
        const response = await request(
            `${server.url}/preapproval/search?external_reference=wrong&limit=20&offset=0`
        );
        const body = (await response.json()) as {
            results: Array<{ id: string; external_reference: string; status: string }>;
        };
        expect(body.results).toEqual([
            expect.objectContaining({
                id: made.authorizationId,
                external_reference: 'actual-ref',
                status: 'pending'
            })
        ]);
    });

    it('serves an order read with provider-shaped status, payment, reference, and date', async () => {
        const { provider, server } = await setup();
        const order = provider.placeOrder({ reference: 'order-ref', paid: true });
        const response = await request(
            `${server.url}/v1/orders/${encodeURIComponent(order.orderId)}`
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            id: order.orderId,
            status: 'processed',
            status_detail: 'accredited',
            external_reference: 'order-ref',
            created_date: expect.any(String),
            transactions: {
                payments: [
                    expect.objectContaining({ status: 'approved', reference_id: 'order-ref' })
                ]
            }
        });
    });
});
