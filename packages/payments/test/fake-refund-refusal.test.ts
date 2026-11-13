import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';
import { startFakeProviderServer } from '../src/fake-server/fake-provider-server';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
const amount = { amountMinor: 15_000, currency: 'ARS' } as const;

function fakeWithM13() {
    return new FakePaymentProvider({
        clock,
        idNamespace: crypto.randomUUID(),
        honestAbout: [{ lie: 'M8', why: 'the refund refusal test needs an approved charge' }],
        withoutBehaviour: [{ behaviour: 'RP12', why: 'the test creates one ordinary charge' }]
    });
}

describe('TEST:B6:3 M13 refund refusal protocol', () => {
    it('types the fake first partial refusal and accepts a different second amount', async () => {
        const fake = fakeWithM13();
        const authorization = await fake.authorize({
            reference: 'hos1551-refusal',
            amount,
            cadence: { everyMonths: 1 },
            reason: 'Test',
            returnUrl: 'https://example.test/return'
        });
        await fake.approve({ authorizationId: authorization.authorizationId });
        const charge = await fake.charge({
            authorizationId: authorization.authorizationId,
            amount,
            reference: 'hos1551-charge'
        });

        await expect(
            fake.refund({
                chargeId: charge.chargeId,
                amount: { amountMinor: 5_000, currency: 'ARS' },
                reference: 'hos1551-refund-1'
            })
        ).rejects.toMatchObject({ code: 'REJECTED', refundRefusal: 'AMOUNT_NOT_ACCEPTED' });
        await expect(
            fake.refund({
                chargeId: charge.chargeId,
                amount: { amountMinor: 7_000, currency: 'ARS' },
                reference: 'hos1551-refund-2'
            })
        ).resolves.toMatchObject({ refundId: expect.stringMatching(/^fake-refund-/) });
    });

    it('round-trips M13 cause code 2084 through the fake server and Mercado Pago adapter', async () => {
        const fake = fakeWithM13();
        const server = await startFakeProviderServer({ provider: fake, clock });
        try {
            const adapter = new MercadoPagoPaymentProvider({
                clock,
                baseUrl: server.url,
                accessToken: 'test-token'
            });
            const authorization = await adapter.authorize({
                reference: 'hos1551-server-refusal',
                amount,
                cadence: { everyMonths: 1 },
                reason: 'Test',
                returnUrl: 'https://example.test/return'
            });
            await fake.approve({ authorizationId: authorization.authorizationId });
            const charge = await fake.charge({
                authorizationId: authorization.authorizationId,
                amount,
                reference: 'hos1551-server-charge'
            });

            await expect(
                adapter.refund({
                    chargeId: charge.chargeId,
                    amount: { amountMinor: 5_000, currency: 'ARS' },
                    reference: 'hos1551-server-refund'
                })
            ).rejects.toMatchObject({ code: 'REJECTED', refundRefusal: 'AMOUNT_NOT_ACCEPTED' });
        } finally {
            await server.close();
        }
    });
});
