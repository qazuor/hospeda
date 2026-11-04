import type { Clock } from '@repo/billing-verticals-contract';
import { FakePaymentProvider } from '@repo/payments/fake';
import { describe, expect, it, vi } from 'vitest';
import type { ClosedChargeSnapshots } from '../../../../src/services/billing/reconciliation/charge-snapshots/closed-charge-snapshot.js';
import { readChargeInventory } from '../../../../src/services/billing/reconciliation/period-charges/read-charge-inventory.js';

describe('readChargeInventory', () => {
    it('keeps closed ids out of live reads and re-reads a newer closed snapshot', async () => {
        let now = Date.parse('2026-10-12T03:00:00Z');
        const clock: Clock = { now: () => new Date(now) };
        const provider = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorization = await provider.authorize({
            reference: 'inventory',
            amount: { amountMinor: 25_000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'inventory',
            returnUrl: 'https://example.test'
        });
        await provider.approve({ authorizationId: authorization.authorizationId });
        const older = await provider.charge({
            authorizationId: authorization.authorizationId,
            amount: { amountMinor: 2_000, currency: 'ARS' },
            reference: 'older'
        });
        now += 60_000;
        const latest = await provider.charge({
            authorizationId: authorization.authorizationId,
            amount: { amountMinor: 2_500, currency: 'ARS' },
            reference: 'latest'
        });
        const readCharge = vi.spyOn(provider, 'readCharge');
        const closedChargeSnapshots: ClosedChargeSnapshots = {
            find: vi.fn(async () => [
                {
                    chargeId: 'not-requested',
                    providerCreatedAt: '2027-02-12T02:00:00.000Z',
                    status: 'approved' as const,
                    purpose: 'charge',
                    authorizationId: authorization.authorizationId,
                    reference: 'extra',
                    amountMinor: 2_500,
                    currency: 'ARS',
                    refundedAmountMinor: 0,
                    chargedBack: false
                },
                {
                    chargeId: older.chargeId,
                    providerCreatedAt: '2027-01-11T02:00:00.000Z',
                    status: 'approved' as const,
                    purpose: 'charge',
                    authorizationId: authorization.authorizationId,
                    reference: 'older',
                    amountMinor: 2_000,
                    currency: 'ARS',
                    refundedAmountMinor: 0,
                    chargedBack: false
                },
                {
                    chargeId: latest.chargeId,
                    providerCreatedAt: '2027-01-12T02:00:00.000Z',
                    status: 'approved' as const,
                    purpose: 'charge',
                    authorizationId: authorization.authorizationId,
                    reference: 'latest',
                    amountMinor: 2_500,
                    currency: 'ARS',
                    refundedAmountMinor: 0,
                    chargedBack: false
                }
            ])
        };
        const result = await readChargeInventory({
            provider,
            chargeIds: [older.chargeId, latest.chargeId],
            act: { kind: 'decision', startedAt: clock.now() },
            closedChargeSnapshots
        });
        expect(readCharge).toHaveBeenCalledTimes(1);
        expect(readCharge.mock.calls.map(([input]) => input.chargeId)).toEqual([latest.chargeId]);
        expect(result.closed.map(({ chargeId }) => chargeId)).toEqual([older.chargeId]);
        expect(result.live.map(({ snapshot }) => snapshot.chargeId)).toEqual([latest.chargeId]);
    });

    it('falls back to all live reads when find rejects or no snapshot port is supplied', async () => {
        const clock: Clock = { now: () => new Date('2026-10-12T03:00:00Z') };
        const provider = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorization = await provider.authorize({
            reference: 'inventory',
            amount: { amountMinor: 2_000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'inventory',
            returnUrl: 'https://example.test'
        });
        await provider.approve({ authorizationId: authorization.authorizationId });
        const charge = await provider.charge({
            authorizationId: authorization.authorizationId,
            amount: { amountMinor: 2_000, currency: 'ARS' },
            reference: 'charge'
        });
        const act = { kind: 'decision' as const, startedAt: clock.now() };
        const closedChargeSnapshots: ClosedChargeSnapshots = {
            find: vi.fn(async () => {
                throw new Error('offline');
            })
        };
        await expect(
            readChargeInventory({
                provider,
                chargeIds: [charge.chargeId],
                act,
                closedChargeSnapshots
            })
        ).resolves.toMatchObject({
            closed: [],
            live: [{ snapshot: { chargeId: charge.chargeId } }]
        });
        await expect(
            readChargeInventory({ provider, chargeIds: [charge.chargeId], act })
        ).resolves.toMatchObject({
            closed: [],
            live: [{ snapshot: { chargeId: charge.chargeId } }]
        });
    });
});
