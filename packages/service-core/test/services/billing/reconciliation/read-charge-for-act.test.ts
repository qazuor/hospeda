import type { Clock } from '@repo/billing-verticals-contract';
import { runWithProviderReadScope } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { describe, expect, it, vi } from 'vitest';
import { readChargeForAct } from '../../../../src/services/billing/reconciliation/period-charges/read-charge-for-act';

describe('readChargeForAct', () => {
    it('shares only the identical act object and is live outside a scope', async () => {
        const clock: Clock = { now: () => new Date('2026-10-01T00:00:00Z') };
        const provider = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const auth = await provider.authorize({
            reference: 'act-test',
            amount: { amountMinor: 2500, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'test',
            returnUrl: 'https://test.invalid'
        });
        await provider.approve({ authorizationId: auth.authorizationId });
        const { chargeId } = await provider.charge({
            authorizationId: auth.authorizationId,
            amount: { amountMinor: 2500, currency: 'ARS' },
            reference: 'test'
        });
        const spy = vi.spyOn(provider, 'readCharge');
        const act = { kind: 'decision' as const, startedAt: clock.now() };
        const sameInstant = { kind: 'decision' as const, startedAt: clock.now() };
        await runWithProviderReadScope({
            fn: async () => {
                const first = await readChargeForAct({ provider, chargeId, act });
                expect(await readChargeForAct({ provider, chargeId, act })).toBe(first);
                await readChargeForAct({ provider, chargeId, act: sameInstant });
            }
        });
        await readChargeForAct({ provider, chargeId, act });
        await readChargeForAct({ provider, chargeId, act });
        expect(spy).toHaveBeenCalledTimes(4);
    });
});
