import type { Clock } from '@repo/billing-verticals-contract';
import { FakePaymentProvider } from '@repo/payments/fake';
import { describe, expect, it } from 'vitest';
import { readPeriodCharges } from '../../../../src/services/billing/reconciliation/period-charges/read-period-charges.js';

function fixture() {
    let now = Date.parse('2026-10-12T03:00:00.000Z');
    const clock: Clock = { now: () => new Date(now) };
    const provider = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    return {
        clock,
        provider,
        advance: ({ ms }: { readonly ms: number }) => {
            now += ms;
        }
    };
}

async function authorization(provider: FakePaymentProvider) {
    const result = await provider.authorize({
        reference: crypto.randomUUID(),
        amount: { amountMinor: 25_000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'current period read test',
        returnUrl: 'https://example.test/return'
    });
    await provider.approve({ authorizationId: result.authorizationId });
    return result.authorizationId;
}

describe('readPeriodCharges', () => {
    it('returns NOT_CHARGED for a complete inventory whose current record is rejected', async () => {
        const { clock, provider } = fixture();
        const authorizationId = await authorization(provider);
        const { chargeId } = await provider.declineCharge({
            authorizationId,
            declineReason: 'issuer_declined'
        });
        const act = { kind: 'decision' as const, startedAt: clock.now() };
        const authorizationRead = await provider.readAuthorization({ authorizationId });

        await expect(readPeriodCharges({ authorizationRead, act }, { provider })).resolves.toEqual({
            verdict: 'NOT_CHARGED',
            chargeId
        });
    });

    it('returns CHARGED only from an approved current record read by id', async () => {
        const { clock, provider, advance } = fixture();
        const authorizationId = await authorization(provider);
        const { chargeId } = await provider.charge({
            authorizationId,
            amount: { amountMinor: 25_000, currency: 'ARS' },
            reference: crypto.randomUUID()
        });
        advance({ ms: 60 * 60 * 1000 });
        const act = { kind: 'decision' as const, startedAt: clock.now() };
        const authorizationRead = await provider.readAuthorization({ authorizationId });

        await expect(readPeriodCharges({ authorizationRead, act }, { provider })).resolves.toEqual({
            verdict: 'CHARGED',
            chargeId
        });
    });
});
