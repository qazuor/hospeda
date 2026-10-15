import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';
import { startFakeProviderServer } from '../src/fake-server/fake-provider-server';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
const amount = { amountMinor: 1500, currency: 'ARS' } as const;
const authInput = {
    reference: 'sub-list-charges',
    amount,
    cadence: { everyMonths: 12 },
    reason: 'Plan anual',
    returnUrl: 'https://example.test/return'
} as const;
const servers: Array<{ close(): Promise<void> }> = [];

async function setup() {
    const provider = new FakePaymentProvider({
        clock,
        idNamespace: crypto.randomUUID(),
        honestAbout: [{ lie: 'M8', why: 'this case needs immediate charge reads' }],
        withoutBehaviour: [{ behaviour: 'RP12', why: 'this case creates regular charges' }]
    });
    const server = await startFakeProviderServer({ provider, clock });
    servers.push(server);
    const adapter = new MercadoPagoPaymentProvider({
        clock,
        baseUrl: server.url,
        accessToken: 'test-token'
    });
    const authorization = await adapter.authorize(authInput);
    await provider.approve({ authorizationId: authorization.authorizationId });
    return { provider, server, adapter, authorizationId: authorization.authorizationId };
}

async function addCharge(args: {
    provider: FakePaymentProvider;
    authorizationId: string;
    reference: string;
}) {
    return args.provider.charge({
        authorizationId: args.authorizationId,
        amount,
        reference: args.reference
    });
}

afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('HOS-1669 TEST:1669:1 AC:1669:2 listCharges over the measured fake HTTP route', () => {
    it('(a) returns an empty list with one request when there are no charges', async () => {
        const { adapter, server, authorizationId } = await setup();
        expect(await adapter.listCharges({ authorizationId })).toEqual({ chargeIds: [] });
        const requests = server
            .requests()
            .filter(({ path }) => path.startsWith('/authorized_payments/search'));
        expect(requests).toHaveLength(1);
        expect(requests[0]?.path).toContain('limit=10&offset=0');
    });

    it('(b, d) lists payment ids in order and reads each returned payment', async () => {
        const { provider, adapter, authorizationId } = await setup();
        const expected = [];
        for (let index = 0; index < 3; index += 1)
            expected.push(
                await addCharge({ provider, authorizationId, reference: `cycle-${index}` })
            );
        const listed = await adapter.listCharges({ authorizationId });
        expect(listed.chargeIds).toEqual(expected.map(({ chargeId }) => chargeId));
        for (const chargeId of listed.chargeIds)
            expect((await adapter.readCharge({ chargeId })).snapshot.chargeId).toBe(chargeId);
        expect(listed.chargeIds.every((id) => !id.startsWith('ap-'))).toBe(true);
    });

    it('(c) fetches 25 charges in pages of ten', async () => {
        const { provider, adapter, authorizationId, server } = await setup();
        const expected: string[] = [];
        for (let index = 0; index < 25; index += 1) {
            const created = await addCharge({
                provider,
                authorizationId,
                reference: `cycle-${index}`
            });
            expected.push(created.chargeId);
        }
        expect((await adapter.listCharges({ authorizationId })).chargeIds).toEqual(expected);
        const requests = server
            .requests()
            .filter(({ path }) => path.startsWith('/authorized_payments/search'));
        expect(requests).toHaveLength(3);
        expect(
            requests.map(({ path }) =>
                new URL(path, 'http://fake.invalid').searchParams.get('offset')
            )
        ).toEqual(['0', '10', '20']);
        expect(
            requests.map(({ path }) =>
                new URL(path, 'http://fake.invalid').searchParams.get('limit')
            )
        ).toEqual(['10', '10', '10']);
    });

    it('(e) treats an unknown authorization as an empty list', async () => {
        const { adapter } = await setup();
        expect(await adapter.listCharges({ authorizationId: 'unknown-authorization' })).toEqual({
            chargeIds: []
        });
    });
});

describe('HOS-1669 TEST:1669:2 AC:1669:0 listCharges response edges and failures', () => {
    function response(body: unknown, status = 200): Response {
        return new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' }
        });
    }
    function provider(fetch: typeof globalThis.fetch) {
        return new MercadoPagoPaymentProvider({ clock, accessToken: 'test-token', fetch });
    }

    it('(f, j) omits a record without an embedded payment and ignores its status', async () => {
        const fetch = vi.fn(async (_input: unknown) =>
            response({
                paging: { total: 1 },
                results: [
                    {
                        id: 'record',
                        date_created: '2026-10-01',
                        status: 'scheduled',
                        payment: { id: 42, status: 'approved' }
                    }
                ]
            })
        );
        const result = await provider(fetch).listCharges({ authorizationId: 'sub / 1' });
        expect(result.chargeIds).toEqual(['42']);
        expect(String(fetch.mock.calls[0]?.[0])).toContain('preapproval_id=sub%20%2F%201');
        const omitted = provider(
            vi.fn(async () =>
                response({
                    paging: { total: 1 },
                    results: [{ id: 'record', date_created: '2026-10-01' }]
                })
            )
        );
        expect(await omitted.listCharges({ authorizationId: 'a' })).toEqual({ chargeIds: [] });
    });

    it('(g) fails closed when a later page is empty before the advertised total', async () => {
        const fetch = vi
            .fn()
            .mockResolvedValueOnce(
                response({
                    paging: { total: 12 },
                    results: Array.from({ length: 10 }, (_, id) => ({
                        id,
                        date_created: `2026-10-${String(id + 1).padStart(2, '0')}`,
                        payment: { id }
                    }))
                })
            )
            .mockResolvedValueOnce(response({ paging: { total: 12 }, results: [] }))
            .mockResolvedValue(response({ paging: { total: 12 }, results: [] }));
        await expect(provider(fetch).listCharges({ authorizationId: 'a' })).rejects.toMatchObject({
            code: 'UNAVAILABLE'
        });
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('(h) maps HTTP errors, timeout, missing credentials, and invalid JSON to provider errors', async () => {
        await expect(
            provider(async () => response({}, 400)).listCharges({ authorizationId: 'a' })
        ).rejects.toMatchObject({ code: 'REJECTED' });
        await expect(
            provider(async () => response({}, 409)).listCharges({ authorizationId: 'a' })
        ).rejects.toMatchObject({ code: 'REJECTED' });
        await expect(
            provider(async () => response({}, 503)).listCharges({ authorizationId: 'a' })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        await expect(
            provider(async () => {
                throw new Error('timeout');
            }).listCharges({ authorizationId: 'a' })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        await expect(
            new MercadoPagoPaymentProvider({ clock }).listCharges({ authorizationId: 'a' })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        await expect(
            provider(async () => new Response('bad json')).listCharges({ authorizationId: 'a' })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    });

    it('(i) sorts returned payment ids by record creation time', async () => {
        const fetch = async () =>
            response({
                paging: { total: 3 },
                results: [
                    { id: 'c', date_created: '2026-10-03T00:00:00Z', payment: { id: '3' } },
                    { id: 'a', date_created: '2026-10-01T00:00:00Z', payment: { id: '1' } },
                    { id: 'b', date_created: '2026-10-02T00:00:00Z', payment: { id: '2' } }
                ]
            });
        expect((await provider(fetch).listCharges({ authorizationId: 'a' })).chargeIds).toEqual([
            '1',
            '2',
            '3'
        ]);
    });
});

describe('HOS-1669 TEST:1669:3 AC:1669:6 RC-8 payment ids remain readable', () => {
    it('lists a charged-back payment and a wholly refunded payment with their state intact', async () => {
        const { provider, adapter, authorizationId } = await setup();
        const chargedBack = await addCharge({
            provider,
            authorizationId,
            reference: 'cycle-disputed'
        });
        const refunded = await addCharge({
            provider,
            authorizationId,
            reference: 'cycle-refunded'
        });
        await provider.chargeBack({ chargeId: chargedBack.chargeId });
        await provider.refund({ chargeId: refunded.chargeId, amount, reference: 'refund-full' });
        const listed = await adapter.listCharges({ authorizationId });
        expect(listed.chargeIds).toEqual([chargedBack.chargeId, refunded.chargeId]);
        expect(
            (await adapter.readCharge({ chargeId: chargedBack.chargeId })).snapshot
        ).toMatchObject({ chargedBack: true, status: 'approved' });
        expect((await adapter.readCharge({ chargeId: refunded.chargeId })).snapshot).toMatchObject({
            refundedAmount: amount,
            status: 'approved'
        });
    });
});
