import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';
import { startFakeProviderServer } from '../src/fake-server/fake-provider-server';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
const amount = { amountMinor: 1500, currency: 'ARS' } as const;
const servers: Array<{ close(): Promise<void> }> = [];

async function setup() {
    const provider = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    const server = await startFakeProviderServer({ provider, clock });
    servers.push(server);
    const authorization = await provider.authorize({
        reference: 'fake-list-route',
        amount,
        cadence: { everyMonths: 12 },
        reason: 'Plan anual',
        returnUrl: 'https://example.test/return'
    });
    await provider.approve({ authorizationId: authorization.authorizationId });
    return { provider, server, authorizationId: authorization.authorizationId };
}

async function get(url: string, query = '', authenticated = true) {
    return fetch(`${url}/authorized_payments/search${query}`, {
        headers: authenticated ? { authorization: 'Bearer test-token' } : {}
    });
}

afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('HOS-1669 TEST:1669:1 AC:1669:0 fake authorized payment search route', () => {
    it('requires the server bearer token', async () => {
        const { server } = await setup();
        expect((await get(server.url, '', false)).status).toBe(401);
    });

    it('requires an authorization id and rejects limits above ten', async () => {
        const { server, authorizationId } = await setup();
        expect((await get(server.url)).status).toBe(400);
        expect((await get(server.url, `?preapproval_id=${authorizationId}&limit=11`)).status).toBe(
            400
        );
        expect(
            await (await get(server.url, `?preapproval_id=${authorizationId}&limit=11`)).json()
        ).toEqual({ message: 'Invalid value for limit' });
    });

    it('returns an empty result for an unknown authorization', async () => {
        const { server } = await setup();
        const response = await get(server.url, '?preapproval_id=unknown');
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            paging: { total: 0, limit: 10, offset: 0 },
            results: []
        });
    });

    it('serves independent record ids and embedded payment ids', async () => {
        const { server, provider, authorizationId } = await setup();
        const { chargeId } = await provider.charge({
            authorizationId,
            amount,
            reference: 'cycle-1'
        });
        const response = await get(server.url, `?preapproval_id=${authorizationId}`);
        const body = (await response.json()) as {
            paging: unknown;
            results: Array<Record<string, unknown>>;
        };
        expect(response.status).toBe(200);
        expect(body.paging).toEqual({ total: 1, limit: 10, offset: 0 });
        expect(body.results[0]).toMatchObject({
            id: `ap-${chargeId}`,
            preapproval_id: authorizationId,
            external_reference: 'cycle-1',
            payment: { id: chargeId },
            retry_attempt: 1
        });
        expect(body.results[0]?.id).not.toBe(chargeId);
    });

    it('paginates records by the requested offset', async () => {
        const { server, provider, authorizationId } = await setup();
        for (let index = 0; index < 12; index += 1)
            await provider.charge({ authorizationId, amount, reference: `cycle-${index}` });
        const first = (await (
            await get(server.url, `?preapproval_id=${authorizationId}&limit=10&offset=0`)
        ).json()) as { paging: unknown; results: unknown[] };
        const second = (await (
            await get(server.url, `?preapproval_id=${authorizationId}&limit=10&offset=10`)
        ).json()) as { paging: unknown; results: unknown[] };
        expect(first.paging).toEqual({ total: 12, limit: 10, offset: 0 });
        expect(first.results).toHaveLength(10);
        expect(second.paging).toEqual({ total: 12, limit: 10, offset: 10 });
        expect(second.results).toHaveLength(2);
    });
});
