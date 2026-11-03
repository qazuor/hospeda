import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';
import { startFakeProviderServer } from '../src/fake-server/fake-provider-server';
import { ProviderTrafficGovernor } from '../src/provider/traffic-governor';

const amount = { amountMinor: 1500, currency: 'ARS' } as const;

async function inventory(args: { readonly withGovernor: boolean }) {
    const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
    const fake = new FakePaymentProvider({
        clock,
        idNamespace: 'governor-parity',
        honestAbout: [{ lie: 'M8', why: 'the parity case needs immediate charge reads' }],
        withoutBehaviour: [
            { behaviour: 'RP12', why: 'the parity case creates twelve charge records' }
        ]
    });
    const server = await startFakeProviderServer({ provider: fake, clock });
    try {
        const provider = new MercadoPagoPaymentProvider({
            clock,
            baseUrl: server.url,
            accessToken: 'test-token',
            ...(args.withGovernor
                ? { governor: new ProviderTrafficGovernor({ mode: 'observe' }) }
                : {})
        });
        const authorization = await provider.authorize({
            reference: 'traffic-governor-parity',
            amount,
            cadence: { everyMonths: 1 },
            reason: 'Monthly plan',
            returnUrl: 'https://example.test/return'
        });
        await fake.approve({ authorizationId: authorization.authorizationId });
        for (let index = 0; index < 12; index += 1) {
            await fake.charge({
                authorizationId: authorization.authorizationId,
                amount,
                reference: `cycle-${index}`
            });
        }
        const firstRequest = server.requests().length;
        await provider.readAuthorization({ authorizationId: authorization.authorizationId });
        for (let pass = 0; pass < 2; pass += 1) {
            const listed = await provider.listCharges({
                authorizationId: authorization.authorizationId
            });
            await Promise.all(
                listed.chargeIds.map((chargeId) => provider.readCharge({ chargeId }))
            );
        }
        const requests = server
            .requests()
            .slice(firstRequest)
            .map(({ method, path }) => ({ method, path }));
        return requests;
    } finally {
        await server.close();
    }
}

describe('observe-mode request count parity', () => {
    it('preserves the 77 wire requests for the common 12-record row (kills observe transport changes)', async () => {
        const legacy = await inventory({ withGovernor: false });
        const observed = await inventory({ withGovernor: true });
        expect(legacy).toHaveLength(77);
        expect(observed).toHaveLength(77);
        expect(observed).toEqual(legacy);
    });
});
