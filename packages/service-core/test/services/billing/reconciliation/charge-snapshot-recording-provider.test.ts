import type { Clock } from '@repo/billing-verticals-contract';
import { FakePaymentProvider } from '@repo/payments/fake';
import { describe, expect, it, vi } from 'vitest';
import { createChargeSnapshotRecordingProvider } from '../../../../src/services/billing/reconciliation/charge-snapshots/charge-snapshot-recording-provider.js';

describe('createChargeSnapshotRecordingProvider', () => {
    it('records the exact live read, swallows recorder errors, and wraps idempotently', async () => {
        const clock: Clock = { now: () => new Date('2026-10-12T00:00:00Z') };
        const provider = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorization = await provider.authorize({
            reference: 'record',
            amount: { amountMinor: 2_000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'test',
            returnUrl: 'https://example.test'
        });
        await provider.approve({ authorizationId: authorization.authorizationId });
        const charge = await provider.charge({
            authorizationId: authorization.authorizationId,
            amount: { amountMinor: 2_000, currency: 'ARS' },
            reference: 'charge'
        });
        const recorder = { record: vi.fn() };
        const wrapped = createChargeSnapshotRecordingProvider({ provider, recorder });
        const read = await wrapped.readCharge({ chargeId: charge.chargeId });
        // The recorder gets the very ProviderRead (its instant is the observation instant).
        expect(recorder.record).toHaveBeenCalledExactlyOnceWith({ read });
        expect(recorder.record.mock.calls[0]?.[0].read).toBe(read);
        expect(createChargeSnapshotRecordingProvider({ provider: wrapped, recorder })).toBe(
            wrapped
        );
        recorder.record.mockRejectedValueOnce(new Error('store unavailable'));
        await expect(wrapped.readCharge({ chargeId: charge.chargeId })).resolves.toBeDefined();
        const listResult = await wrapped.listCharges({
            authorizationId: authorization.authorizationId
        });
        expect(listResult).toEqual(
            await provider.listCharges({ authorizationId: authorization.authorizationId })
        );
        const authRead = await wrapped.readAuthorization({
            authorizationId: authorization.authorizationId
        });
        expect(authRead).toEqual(
            await provider.readAuthorization({ authorizationId: authorization.authorizationId })
        );
        expect(recorder.record).toHaveBeenCalledTimes(2);
    });
});
