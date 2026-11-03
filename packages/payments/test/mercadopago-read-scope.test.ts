import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';
import { startFakeProviderServer } from '../src/fake-server/fake-provider-server';
import { runWithProviderReadScope } from '../src/provider/provider-read-scope';

const servers: Array<{ close(): Promise<void> }> = [];

afterEach(async () => Promise.all(servers.splice(0).map((server) => server.close())));

describe('Mercado Pago provider read scope', () => {
    it('shares authorization records across listing and charge reads while stamping each read live', async () => {
        const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00Z') });
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const server = await startFakeProviderServer({ provider: fake, clock });
        servers.push(server);
        const provider = new MercadoPagoPaymentProvider({
            clock,
            baseUrl: server.url,
            accessToken: 'test-token'
        });
        const authorization = await provider.authorize({
            reference: 'scope-test',
            amount: { amountMinor: 2500, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'test',
            returnUrl: 'https://test.invalid'
        });
        await fake.approve({ authorizationId: authorization.authorizationId });
        const chargeIds: string[] = [];
        for (let index = 0; index < 3; index += 1)
            chargeIds.push(
                (
                    await fake.charge({
                        authorizationId: authorization.authorizationId,
                        amount: { amountMinor: 2500, currency: 'ARS' },
                        reference: `cycle-${index}`
                    })
                ).chargeId
            );
        const before = server.requests().length;
        const first = await runWithProviderReadScope({
            fn: async () => {
                const listing = await provider.listCharges({
                    authorizationId: authorization.authorizationId
                });
                const reads = await Promise.all(
                    listing.chargeIds.map((chargeId) => provider.readCharge({ chargeId }))
                );
                return reads[0];
            }
        });
        const measured = server.requests().length - before;
        expect(measured).toBe(4); // one listing page plus three live payment reads
        const beforeOutside = server.requests().length;
        await provider.listCharges({ authorizationId: authorization.authorizationId });
        await provider.readCharge({ chargeId: chargeIds[0]! });
        expect(server.requests().length - beforeOutside).toBe(3);
        clock.advance({ ms: 1 });
        const reads = await runWithProviderReadScope({
            fn: async () =>
                Promise.all([
                    provider.readCharge({ chargeId: chargeIds[0]! }),
                    provider.readCharge({ chargeId: chargeIds[0]! })
                ])
        });
        expect(reads[0]).not.toBe(reads[1]);
        expect(reads[0]?.readAt.getTime()).toBe(clock.now().getTime());
        expect(reads[0]!.readAt.getTime()).toBeGreaterThan(first!.readAt.getTime());
    });
});
