import { PaymentProviderError } from '@repo/payments';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import {
    createSweepPacedProvider,
    RECONCILIATION_SWEEP_PROVIDER_PACING
} from '../../../src/services/billing/reconciliation/sweep/sweep-provider-pacing.js';
import { closeServiceTestPool } from './helpers.js';
import {
    createReconciliationFake,
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';

afterAll(closeServiceTestPool);
beforeEach(resetSeededReconciliationInventory);

describe('HOS-1737 reconciliation sweep provider pacing', () => {
    it('TEST:1737:10 completes after a 429 burst with the sweep budget', async () => {
        const { fake } = createReconciliationFake();
        const row = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const authorizationId = row.providerId!;
        // Four failures exceed the webhook adapter’s three-attempt policy.
        const original = fake.readAuthorization.bind(fake);
        let failuresLeft = 4;
        const read = vi.spyOn(fake, 'readAuthorization').mockImplementation(async (input) => {
            if (input.authorizationId === authorizationId && failuresLeft-- > 0) {
                throw new PaymentProviderError({
                    code: 'UNAVAILABLE',
                    capability: 'read',
                    message: 'Mercado Pago request failed (429)'
                });
            }
            return original(input);
        });
        const sleep = vi.fn(async (_ms: number) => {});
        const ping = { ping: vi.fn() };
        const correlationId = crypto.randomUUID();
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { correlationId },
                {
                    provider: createSweepPacedProvider({
                        provider: fake,
                        pacing: { ...RECONCILIATION_SWEEP_PROVIDER_PACING, minIntervalMs: 0 },
                        sleep
                    }),
                    clock: reconciliationClock,
                    livenessPing: ping
                }
            )
        );
        expect(summary.complete).toBe(true);
        expect(summary.rowsFailed).toBe(0);
        expect(summary.failures.map(({ subscriptionId }) => subscriptionId)).not.toContain(
            row.subscription.id
        );
        expect(summary.pinged).toBe(true);
        expect(ping.ping).toHaveBeenCalledTimes(1);
        expect(
            read.mock.calls.filter(([input]) => input.authorizationId === authorizationId)
        ).toHaveLength(5);
        expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([2000, 4000, 8000, 16000]);
    });

    it('TEST:1737:11 leaves the row failed without the decorator', async () => {
        const { fake } = createReconciliationFake();
        const row = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        // The same four-failure burst reaches the sweep without decorator retries.
        const original = fake.readAuthorization.bind(fake);
        let failuresLeft = 4;
        vi.spyOn(fake, 'readAuthorization').mockImplementation(async (input) => {
            if (input.authorizationId === row.providerId && failuresLeft-- > 0) {
                throw new PaymentProviderError({
                    code: 'UNAVAILABLE',
                    capability: 'read',
                    message: 'Mercado Pago request failed (429)'
                });
            }
            return original(input);
        });
        const ping = { ping: vi.fn() };
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { correlationId: crypto.randomUUID() },
                { provider: fake, clock: reconciliationClock, livenessPing: ping }
            )
        );
        expect(summary.complete).toBe(false);
        expect(summary.pinged).toBe(false);
        expect(summary.failures).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    subscriptionId: row.subscription.id,
                    message: expect.stringContaining('(429)')
                })
            ])
        );
    });
});
