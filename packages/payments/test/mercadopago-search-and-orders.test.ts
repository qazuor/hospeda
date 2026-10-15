import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';
import { startFakeProviderServer } from '../src/fake-server/fake-provider-server';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
const amount = { amountMinor: 1500, currency: 'ARS' } as const;
const servers: Array<{ close(): Promise<void> }> = [];

async function setup() {
    const fake = new FakePaymentProvider({
        clock,
        idNamespace: crypto.randomUUID(),
        honestAbout: [
            { lie: 'M4', why: 'search route tests assert complete provider-side filters' }
        ]
    });
    const server = await startFakeProviderServer({ provider: fake, clock });
    servers.push(server);
    const adapter = new MercadoPagoPaymentProvider({
        clock,
        baseUrl: server.url,
        accessToken: 'test-token'
    });
    return { fake, server, adapter };
}

async function authorization(fake: FakePaymentProvider, reference: string, payerEmail?: string) {
    const created = await fake.authorize({
        reference,
        amount,
        cadence: { everyMonths: 1 },
        reason: 'Plan mensual',
        returnUrl: 'https://example.test/return',
        ...(payerEmail ? { payerEmail } : {})
    });
    await fake.approve({ authorizationId: created.authorizationId });
    return created.authorizationId;
}

afterEach(async () => Promise.all(servers.splice(0).map((server) => server.close())));

describe('HOS-1669 TEST:1669:9 AC:1669:2 searches authorizations over fake HTTP', () => {
    it('filters by payer email, status, exact reference, and supports no filters', async () => {
        const { fake, adapter } = await setup();
        const first = await authorization(fake, 'target-reference', 'target@example.test');
        await authorization(fake, 'other-reference', 'target@example.test');
        await authorization(fake, 'third-reference', 'other@example.test');
        expect(
            (await adapter.searchAuthorizations({ payerEmail: 'target@example.test' }))
                .authorizations
        ).toHaveLength(2);
        expect(
            (await adapter.searchAuthorizations({ status: 'active' })).authorizations
        ).toHaveLength(3);
        expect(
            (
                await adapter.searchAuthorizations({ reference: 'target-reference' })
            ).authorizations.map(({ authorizationId }) => authorizationId)
        ).toEqual([first]);
        expect((await adapter.searchAuthorizations({})).authorizations).toHaveLength(3);
    });

    it('filters reference after collecting more than one page', async () => {
        const { fake, adapter, server } = await setup();
        let expected = '';
        for (let index = 0; index < 22; index += 1) {
            const reference = index === 21 ? 'target-exact' : `target-${index}`;
            const id = await authorization(fake, reference, 'pages@example.test');
            if (index === 21) expected = id;
        }
        const result = await adapter.searchAuthorizations({
            payerEmail: 'pages@example.test',
            reference: 'target-exact'
        });
        expect(result.authorizations.map(({ authorizationId }) => authorizationId)).toEqual([
            expected
        ]);
        expect(
            server.requests().filter(({ path }) => path.startsWith('/preapproval/search'))
        ).toHaveLength(2);
    });

    it('rejects an unknown provider authorization status as unavailable', async () => {
        const fetch = vi.fn(
            async () =>
                new Response(
                    JSON.stringify({
                        paging: { total: 1 },
                        results: [
                            { id: 'a', date_created: clock.now().toISOString(), status: 'mystery' }
                        ]
                    })
                )
        );
        const adapter = new MercadoPagoPaymentProvider({ clock, accessToken: 'test-token', fetch });
        await expect(adapter.searchAuthorizations({})).rejects.toMatchObject({
            code: 'UNAVAILABLE'
        });
    });
});

describe('HOS-1669 TEST:1669:10 AC:1669:2 orders over fake HTTP', () => {
    it('reads paid and unpaid orders with stamped snapshots and maps missing ids', async () => {
        const { fake, adapter } = await setup();
        const paid = fake.placeOrder({ reference: 'paid-order', paid: true });
        const unpaid = fake.placeOrder({ reference: 'unpaid-order', paid: false });
        const paidRead = await adapter.readOrder({ orderId: paid.orderId });
        expect(paidRead.snapshot).toMatchObject({
            orderId: paid.orderId,
            reference: 'paid-order',
            hasApprovedPayment: true
        });
        expect(paidRead.snapshot.createdAt).toBeTypeOf('string');
        expect(paidRead.readAt).toEqual(clock.now());
        expect(
            (await adapter.readOrder({ orderId: unpaid.orderId })).snapshot.hasApprovedPayment
        ).toBe(false);
        await expect(adapter.readOrder({ orderId: 'missing-order' })).rejects.toMatchObject({
            code: 'NOT_FOUND'
        });
    });

    it.each([
        ['refunded', false],
        ['partially_refunded', true]
    ])('maps order status %s to hasApprovedPayment=%s', async (status, expected) => {
        const fetch = vi.fn(
            async () =>
                new Response(
                    JSON.stringify({
                        id: 'o',
                        status,
                        external_reference: 'r',
                        created_date: clock.now().toISOString()
                    })
                )
        );
        const adapter = new MercadoPagoPaymentProvider({ clock, accessToken: 'test-token', fetch });
        expect((await adapter.readOrder({ orderId: 'o' })).snapshot.hasApprovedPayment).toBe(
            expected
        );
    });

    it('rejects unknown order status and missing creation date', async () => {
        const unknown = new MercadoPagoPaymentProvider({
            clock,
            accessToken: 'test-token',
            fetch: async () => new Response(JSON.stringify({ id: 'o', status: 'mystery' }))
        });
        await expect(unknown.readOrder({ orderId: 'o' })).rejects.toMatchObject({
            code: 'UNAVAILABLE'
        });
        const noDate = new MercadoPagoPaymentProvider({
            clock,
            accessToken: 'test-token',
            fetch: async () => new Response(JSON.stringify({ id: 'o', status: 'processed' }))
        });
        await expect(noDate.readOrder({ orderId: 'o' })).rejects.toMatchObject({
            code: 'UNAVAILABLE'
        });
        const fallbackDate = new MercadoPagoPaymentProvider({
            clock,
            accessToken: 'test-token',
            fetch: async () =>
                new Response(
                    JSON.stringify({
                        id: 'o',
                        status: 'processed',
                        date_created: clock.now().toISOString()
                    })
                )
        });
        expect((await fallbackDate.readOrder({ orderId: 'o' })).snapshot.createdAt).toBe(
            clock.now().toISOString()
        );
    });

    it('searches exact references in-window, rejects wide ranges, and fails incomplete pages', async () => {
        const { fake, adapter } = await setup();
        const from = '2026-10-01T00:00:00.000Z';
        const to = '2026-10-29T00:00:00.000Z';
        const matching = fake.placeOrder({ reference: 'exact-ref', paid: true });
        fake.placeOrder({ reference: 'exact-ref-suffix', paid: true });
        const result = await adapter.searchOrders({
            reference: 'exact-ref',
            createdFrom: from,
            createdTo: to
        });
        expect(result.orders.map(({ orderId }) => orderId)).toEqual([matching.orderId]);
        expect(
            await adapter.searchOrders({ reference: 'absent', createdFrom: from, createdTo: to })
        ).toEqual({ orders: [] });
        await expect(
            adapter.searchOrders({
                reference: 'exact-ref',
                createdFrom: from,
                createdTo: '2026-11-02T00:00:00.000Z'
            })
        ).rejects.toMatchObject({ code: 'REJECTED' });
        const incomplete = new MercadoPagoPaymentProvider({
            clock,
            accessToken: 'test-token',
            fetch: async () => new Response(JSON.stringify({ data: [], paging: { total: 1 } }))
        });
        await expect(
            incomplete.searchOrders({ reference: 'r', createdFrom: from, createdTo: to })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    });
});

describe('HOS-1669 TEST:1669:11 AC:1669:1 deliberate charge rejection', () => {
    it('rejects an on-demand charge without making an HTTP request', async () => {
        const fetch = vi.fn();
        const adapter = new MercadoPagoPaymentProvider({ clock, accessToken: 'test-token', fetch });
        await expect(
            adapter.charge({ authorizationId: 'a', amount, reference: 'r' })
        ).rejects.toMatchObject({
            code: 'REJECTED',
            capability: 'charge',
            message: 'Mercado Pago charges every cycle on its own: there is no on-demand charge'
        });
        expect(fetch).not.toHaveBeenCalled();
    });
});
