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

describe('fake server search routes', () => {
    it('no longer serves the Orders API (retired by HOS-2179 T-7)', async () => {
        // Arrange
        const { server } = await setup();

        // Act
        const search = await request(`${server.url}/v1/orders?external_reference=r`);
        const read = await request(`${server.url}/v1/orders/ORD-1`);

        // Assert
        expect(search.status).toBe(404);
        expect(read.status).toBe(404);
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
});
