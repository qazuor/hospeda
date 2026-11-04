import {
    reconciliationCreditedPaymentModel,
    reconciliationSweepRunModel,
    reconciliationSweepRuns,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCreditedPaymentsCheck } from '../../../src/services/billing/reconciliation/sweep/credited-payments-check.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers.js';
import {
    createReconciliationFake,
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';

afterAll(closeServiceTestPool);
beforeEach(async () => {
    resetSeededReconciliationInventory();
    await getServiceTestDb().delete(reconciliationSweepRuns);
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe('the takeover of an abandoned run is conditional on its lease', () => {
    it('does not close a slice whose lease was renewed between the read and the close', async () => {
        const stale = await reconciliationSweepRunModel.openSlice({
            correlationId: crypto.randomUUID()
        });
        await getServiceTestPool().query(
            "UPDATE reconciliation_sweep_run SET lease_until = now() - interval '1 minute' WHERE id = $1",
            [stale.id]
        );
        const read = reconciliationSweepRunModel.findOpenRunsWithLease.bind(
            reconciliationSweepRunModel
        );
        // The slow old slice renews right after the new slice read its (stale) expired view.
        vi.spyOn(reconciliationSweepRunModel, 'findOpenRunsWithLease').mockImplementation(
            async (input) => {
                const rows = await read(input);
                await getServiceTestPool().query(
                    "UPDATE reconciliation_sweep_run SET lease_until = now() + interval '5 minutes' WHERE id = $1",
                    [stale.id]
                );
                return rows;
            }
        );
        const { fake } = createReconciliationFake();
        const result = await runReconciliationSweep(
            { mode: 'cycle', newCycle: true },
            { provider: fake, clock: reconciliationClock }
        );
        expect(result.skipped).toBe('lease_held');
        expect(result.outcome).toBeUndefined();
        const after = await reconciliationSweepRunModel.findById({ id: stale.id });
        expect(after?.outcome).toBeNull();
    });
});

describe('the lease is verified per item in the passes that write to the provider', () => {
    it('heartbeats before every credited payment, not only once per page', async () => {
        const payment = { subscriptionId: null, providerFactId: 'x', id: 'p' };
        const list = vi
            .spyOn(reconciliationCreditedPaymentModel, 'listCreditedPaymentsInWindowPage')
            .mockResolvedValueOnce([
                { ...payment, id: 'p1' },
                { ...payment, id: 'p2' },
                { ...payment, id: 'p3' }
            ] as never);
        list.mockResolvedValue([]);
        const { fake } = createReconciliationFake();
        const heartbeat = vi.fn(async () => undefined);
        await runCreditedPaymentsCheck(
            { correlationId: crypto.randomUUID(), pageSize: 3 },
            { provider: fake, clock: reconciliationClock, heartbeat }
        );
        // 3 items + 2 page boundaries (a full page is followed by an empty one).
        expect(heartbeat).toHaveBeenCalledTimes(5);
    });

    it('stops the pass at an item when the lease is lost', async () => {
        vi.spyOn(
            reconciliationCreditedPaymentModel,
            'listCreditedPaymentsInWindowPage'
        ).mockResolvedValueOnce([
            { subscriptionId: null, providerFactId: 'x', id: 'p1' },
            { subscriptionId: null, providerFactId: 'x', id: 'p2' }
        ] as never);
        const { fake } = createReconciliationFake();
        const heartbeat = vi.fn(async () => {
            throw new Error('lease lost');
        });
        await expect(
            runCreditedPaymentsCheck(
                { correlationId: crypto.randomUUID(), pageSize: 2 },
                { provider: fake, clock: reconciliationClock, heartbeat }
            )
        ).rejects.toThrow('lease lost');
        expect(heartbeat).toHaveBeenCalledTimes(1);
    });
});

describe('a row whose stamp keeps failing cannot stall the cycle', () => {
    it('counts it as failed, skips it, and stamps every other row', async () => {
        const { fake } = createReconciliationFake();
        const seeded = await Promise.all(
            Array.from({ length: 5 }, () =>
                seedSubscription({ status: 'ACTIVE', withLink: true, fake })
            )
        );
        const poison = seeded[0]!.subscription.id;
        const stamp = reconciliationSweepRunModel.stampSweptRow.bind(reconciliationSweepRunModel);
        vi.spyOn(reconciliationSweepRunModel, 'stampSweptRow').mockImplementation(async (input) => {
            if (input.subscriptionId === poison) throw new Error('stamp write failed');
            return stamp(input);
        });
        const reads = vi.spyOn(fake, 'readAuthorization');
        const result = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { mode: 'cycle', pageSize: 2 },
                { provider: fake, clock: reconciliationClock }
            )
        );
        expect(result.outcome).toBe('CYCLE_DONE');
        expect(result.rowsFailed).toBe(1);
        expect(result.failures.map(({ subscriptionId }) => subscriptionId)).toEqual([poison]);
        expect(result.cycle?.failedSubscriptionIds).toContain(poison);
        // The poison row was acted on once in this slice, not looped on.
        expect(reads).toHaveBeenCalledTimes(5);
        const rows = await getServiceTestDb().select().from(subscriptions);
        for (const { subscription } of seeded) {
            const row = rows.find(({ id }) => id === subscription.id);
            expect(row?.lastSweptAt === null).toBe(subscription.id === poison);
        }
    });
});

describe('passes run while rows were unread are not final', () => {
    it('re-runs the passes in a later slice that completes the rows', async () => {
        const { fake } = createReconciliationFake();
        await Promise.all(
            Array.from({ length: 4 }, () =>
                seedSubscription({ status: 'ACTIVE', withLink: true, fake })
            )
        );
        const ports = { provider: fake, clock: reconciliationClock, markEscalation: {} };
        // Last slot already inside the reserve: no row is read, the passes run anyway.
        const reserve = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                {
                    mode: 'cycle',
                    pageSize: 2,
                    lastSlot: true,
                    deadlineAt: new Date(Date.now() + 10 * 60_000),
                    budgetClock: () => new Date()
                },
                ports
            )
        );
        expect(reserve.rowsComplete).toBe(false);
        const stored = await reconciliationSweepRunModel.findById({ id: reserve.runId });
        expect(stored?.passesCompleted).toEqual([]);
        // A later slice of the same cycle (no newCycle) completes the rows and runs them again.
        const later = await withSeededReconciliationInventory(() =>
            runReconciliationSweep({ mode: 'cycle', pageSize: 2 }, ports)
        );
        expect(later.cycleId).toBe(reserve.cycleId);
        expect(later.rowsComplete).toBe(true);
        expect(later.markEscalation).toBeDefined();
        const done = await reconciliationSweepRunModel.findById({ id: later.runId });
        expect(done?.passesCompleted).toContain('markEscalation');
    });
});
