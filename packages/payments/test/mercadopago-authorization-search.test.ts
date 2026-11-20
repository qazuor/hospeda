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
