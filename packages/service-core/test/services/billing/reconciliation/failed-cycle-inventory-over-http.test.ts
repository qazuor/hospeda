/** TEST:1714:4 AC:1714:4 proves reconciliation sees a complete failed-cycle inventory over HTTP. */
import type { Clock } from '@repo/billing-verticals-contract';
import { MercadoPagoPaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { startFakeProviderServer } from '@repo/payments/fake-server';
import { afterEach, describe, expect, it } from 'vitest';
import { readPeriodCharges } from '../../../../src/services/billing/reconciliation/period-charges/read-period-charges.js';
import { readLastCycleRecordIsOpen } from '../../../../src/services/billing/reconciliation/sweep/last-cycle-record.js';

function fixture() {
    let timestamp = Date.parse('2026-10-12T03:00:00.000Z');
    const clock: Clock & {
        advance(input: { readonly ms: number }): void;
        set(input: { readonly at: Date }): void;
    } = {
        now: () => new Date(timestamp),
        advance: ({ ms }) => {
            timestamp += ms;
        },
        set: ({ at }) => {
            timestamp = at.getTime();
        }
    };
    const instance = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    return { clock, instance };
}

describe('TEST:1714:4 AC:1714:4 reconciliation over fake Mercado Pago HTTP', () => {
    let server: Awaited<ReturnType<typeof startFakeProviderServer>> | undefined;
    afterEach(async () => {
        if (server) await server.close();
        server = undefined;
    });

    it('TEST:1714:4 returns NOT_CHARGED while open and closes the period after expiry', async () => {
        const { clock, instance } = fixture();
        server = await startFakeProviderServer({ provider: instance, clock });
        const adapter = new MercadoPagoPaymentProvider({
            clock,
            baseUrl: server.url,
            accessToken: 'test-token'
        });
        const auth = await instance.authorize({
            reference: 'failed-cycle',
            amount: { amountMinor: 25_000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'reconciliation test',
            returnUrl: 'https://example.test/return'
        });
        await instance.approve({ authorizationId: auth.authorizationId });
        await instance.charge({
            authorizationId: auth.authorizationId,
            amount: { amountMinor: 25_000, currency: 'ARS' },
            reference: 'opening'
        });
        clock.advance({ ms: 60 * 60 * 1000 });
        const failed = await instance.failChargeCycle({
            authorizationId: auth.authorizationId,
            declineReason: 'issuer_declined'
        });
        const expiresAt = (await instance.readCharge(failed)).snapshot.expiresAt!;
        expect(expiresAt).toEqual(expect.any(String));
        clock.set({ at: new Date(Date.parse(expiresAt) - 60_000) });
        const openAct = { kind: 'decision' as const, startedAt: clock.now() };
        const openAuthorizationRead = await adapter.readAuthorization({
            authorizationId: auth.authorizationId
        });
        await expect(
            readPeriodCharges(
                { authorizationRead: openAuthorizationRead, act: openAct },
                { provider: adapter }
            )
        ).resolves.toEqual({ verdict: 'NOT_CHARGED', chargeId: failed.chargeId });
        await expect(
            readLastCycleRecordIsOpen(
                { authorizationRead: openAuthorizationRead, act: openAct },
                { provider: adapter }
            )
        ).resolves.toBe(true);
        clock.set({ at: new Date(Date.parse(expiresAt) + 60_000) });
        const closedAct = { kind: 'decision' as const, startedAt: clock.now() };
        const closedAuthorizationRead = await adapter.readAuthorization({
            authorizationId: auth.authorizationId
        });
        await expect(
            readPeriodCharges(
                { authorizationRead: closedAuthorizationRead, act: closedAct },
                { provider: adapter }
            )
        ).resolves.toEqual({ verdict: 'NO_CURRENT_PERIOD' });
        await expect(
            readLastCycleRecordIsOpen(
                { authorizationRead: closedAuthorizationRead, act: closedAct },
                { provider: adapter }
            )
        ).resolves.toBe(false);
    });
});
