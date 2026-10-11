import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
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

describe('TEST:B11:20 LISTA cláusula 1 and TEST:B11:1 inventory source', () => {
    it('TEST:B11:20 LISTA cláusula 1: reads every linked live owned row once by id and never calls M4 search', async () => {
        const { fake } = createReconciliationFake();
        const active = await seedSubscription({
            status: 'ACTIVE',
            class: 'PRINCIPAL',
            withLink: true,
            fake
        });
        const addon = await seedSubscription({
            status: 'ACTIVE',
            class: 'COMPLEMENTO',
            withLink: true,
            fake
        });
        await seedSubscription({ status: 'CANCELLED', withLink: true, fake });
        await seedSubscription({ status: 'ABANDONED', withLink: true, fake });
        await seedSubscription({ status: 'CHARGE_DECLINED', withLink: true, fake });
        await seedSubscription({ status: 'ACTIVE', withLink: false });
        const reads = vi.spyOn(fake, 'readAuthorization');
        const searches = vi.spyOn(fake, 'searchAuthorizations');
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep({}, { provider: fake, clock: reconciliationClock })
        );
        expect(summary.rowsRead).toBe(2);
        expect(reads.mock.calls.map(([input]) => input.authorizationId).sort()).toEqual(
            [active.providerId, addon.providerId].sort()
        );
        expect(searches).not.toHaveBeenCalled();
        const partial = await fake.searchAuthorizations({ status: 'active' });
        expect(partial.authorizations.length).toBeLessThan(5);
        expect(summary.rowsRead).toBe(2);
    });

    it('TEST:B11:1 pages by the final subscription id without repeats or skips', async () => {
        const { fake } = createReconciliationFake();
        const rows = await Promise.all(
            Array.from({ length: 5 }, () =>
                seedSubscription({ status: 'ACTIVE', withLink: true, fake })
            )
        );
        const reads = vi.spyOn(fake, 'readAuthorization');
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep({ pageSize: 2 }, { provider: fake, clock: reconciliationClock })
        );
        expect(summary.rowsRead).toBeGreaterThanOrEqual(5);
        for (const row of rows)
            expect(
                reads.mock.calls.filter(([input]) => input.authorizationId === row.providerId)
            ).toHaveLength(1);
    });

    it('TEST:B11:1 rejects a stale read when freshness starts at the row decision', async () => {
        let instant = new Date('2026-10-11T12:00:00.000Z');
        const clock = { now: () => new Date(instant) };
        const { fake } = createReconciliationFake(clock);
        const owned = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const stale = await fake.readAuthorization({ authorizationId: owned.providerId! });
        instant = new Date(instant.getTime() + 1_000);
        vi.spyOn(fake, 'readAuthorization').mockResolvedValue(stale);
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep({}, { provider: fake, clock })
        );
        expect(summary.rowsFailed).toBe(1);
        expect(summary.failures[0]?.message).toContain('before the act started');
    });

    it('TEST:B11:1 continues after an individual provider read fails', async () => {
        const { fake } = createReconciliationFake();
        const rows = await Promise.all(
            Array.from({ length: 3 }, () =>
                seedSubscription({ status: 'ACTIVE', withLink: true, fake })
            )
        );
        const failedId = rows[0]!.providerId!;
        const read = fake.readAuthorization.bind(fake);
        vi.spyOn(fake, 'readAuthorization').mockImplementation(async (input) => {
            if (input.authorizationId === failedId) throw new Error('read failed');
            return read(input);
        });
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep({}, { provider: fake, clock: reconciliationClock })
        );
        expect(summary.rowsFailed).toBe(1);
        expect(summary.failures).toContainEqual({
            subscriptionId: rows[0]!.subscription.id,
            message: 'read failed'
        });
        expect(summary.rowsRead).toBe(2);
    });
});
