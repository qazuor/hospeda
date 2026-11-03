import {
    eq,
    inArray,
    isReconciliationSweepRunComplete,
    reconciliationSweepRunModel,
    reconciliationSweepRuns,
    subscriptions
} from '@repo/db';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
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

describe('TEST:B11:24 reconciliation sweep run and liveness ping', () => {
    it('skips a live slice lease, including when a fresh cycle is requested', async () => {
        getServiceTestDb();
        const correlationId = crypto.randomUUID();
        const liveRun = await reconciliationSweepRunModel.openSlice({ correlationId });
        const { fake } = createReconciliationFake();
        const read = vi.spyOn(fake, 'readAuthorization');
        const summary = await runReconciliationSweep(
            { newCycle: true },
            { provider: fake, clock: reconciliationClock }
        );
        expect(summary.skipped).toBe('lease_held');
        expect(read).not.toHaveBeenCalled();
        const stillOpen = await reconciliationSweepRunModel.findById({ id: liveRun.id });
        expect(stillOpen?.outcome).toBeNull();
        await reconciliationSweepRunModel.closeAbandoned({ id: liveRun.id });
    });

    it('records a skipped run when today’s cycle has already completed', async () => {
        getServiceTestDb();
        const { fake } = createReconciliationFake();
        const read = vi.spyOn(fake, 'readAuthorization');
        const first = await withSeededReconciliationInventory(() =>
            runReconciliationSweep({}, { provider: fake, clock: reconciliationClock })
        );
        expect(first.outcome).toBe('CYCLE_DONE');

        const second = await runReconciliationSweep(
            {},
            { provider: fake, clock: reconciliationClock }
        );
        expect(second.skipped).toBe('cycle_done');
        const skippedRun = await reconciliationSweepRunModel.findById({ id: second.runId });
        expect(skippedRun?.outcome).toBe('SKIPPED_CYCLE_DONE');
        expect(read).not.toHaveBeenCalled();
    });

    it('reserves the final-slot pass budget and still runs the post-row pass', async () => {
        const { fake } = createReconciliationFake();
        await Promise.all([
            seedSubscription({ status: 'ACTIVE', withLink: true, fake }),
            seedSubscription({ status: 'ACTIVE', withLink: true, fake })
        ]);
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                {
                    lastSlot: true,
                    deadlineAt: new Date(reconciliationClock.now().getTime() + 14 * 60_000)
                },
                { provider: fake, clock: reconciliationClock, creditedPayments: {} }
            )
        );
        expect(summary).toMatchObject({
            outcome: 'CYCLE_DONE',
            phase: 'DONE',
            rowsComplete: false,
            incomplete: true
        });
        const run = await reconciliationSweepRunModel.findById({ id: summary.runId });
        expect(run?.passesCompleted).toContain('creditedPayments');
    });

    it('stamps a row completed at the deadline and resumes with only the unswept row', async () => {
        let currentTime = reconciliationClock.now();
        const clock = { now: () => new Date(currentTime) };
        const { fake } = createReconciliationFake(clock);
        const seeded = await Promise.all([
            seedSubscription({ status: 'ACTIVE', withLink: true, fake }),
            seedSubscription({ status: 'ACTIVE', withLink: true, fake })
        ]);
        const deadlineAt = new Date(currentTime.getTime() + 1_000);
        const originalRead = fake.readAuthorization.bind(fake);
        const read = vi.spyOn(fake, 'readAuthorization');
        read.mockImplementation(async (input) => {
            const result = await originalRead(input);
            currentTime = deadlineAt;
            return result;
        });

        const first = await withSeededReconciliationInventory(() =>
            runReconciliationSweep({ deadlineAt }, { provider: fake, clock })
        );
        expect(first).toMatchObject({ outcome: 'TIMED_OUT', stoppedOnBudget: true, rowsRead: 1 });
        expect(read).toHaveBeenCalledTimes(1);

        const second = await withSeededReconciliationInventory(() =>
            runReconciliationSweep({}, { provider: fake, clock })
        );
        expect(second).toMatchObject({ outcome: 'CYCLE_DONE', rowsComplete: true, rowsRead: 1 });
        expect(read).toHaveBeenCalledTimes(2);
        expect(new Set(read.mock.calls.map(([call]) => call.authorizationId)).size).toBe(2);
        const stored = await getServiceTestDb()
            .select({ id: subscriptions.id, lastSweptAt: subscriptions.lastSweptAt })
            .from(subscriptions)
            .where(
                inArray(
                    subscriptions.id,
                    seeded.map(({ subscription }) => subscription.id)
                )
            );
        expect(stored).toHaveLength(2);
        expect(stored.every(({ lastSweptAt }) => lastSweptAt instanceof Date)).toBe(true);
    });

    it('records a partial run and does not ping', async () => {
        const { fake } = createReconciliationFake();
        const rows = await Promise.all(
            Array.from({ length: 3 }, () =>
                seedSubscription({ status: 'ACTIVE', withLink: true, fake })
            )
        );
        const failId = rows[0]!.providerId!;
        const read = fake.readAuthorization.bind(fake);
        vi.spyOn(fake, 'readAuthorization').mockImplementation(async (input) =>
            input.authorizationId === failId
                ? Promise.reject(new Error('read failed'))
                : read(input)
        );
        const correlationId = crypto.randomUUID();
        const ping = { ping: vi.fn() };
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { correlationId },
                { provider: fake, clock: reconciliationClock, livenessPing: ping }
            )
        );
        const [run] = await getServiceTestDb()
            .select()
            .from(reconciliationSweepRuns)
            .where(eq(reconciliationSweepRuns.correlationId, correlationId));
        expect(run).toMatchObject({ rowsRead: 2, rowsFailed: 1 });
        expect(run?.startedAt).toBeInstanceOf(Date);
        expect(run?.finishedAt).toBeInstanceOf(Date);
        expect(
            isReconciliationSweepRunComplete({
                finishedAt: run!.finishedAt,
                rowsFailed: run!.rowsFailed
            })
        ).toBe(false);
        expect(summary.complete).toBe(false);
        expect(ping.ping).not.toHaveBeenCalled();
    });

    it('stops before starting the next inventory row when its budget signal aborts', async () => {
        const { fake } = createReconciliationFake();
        const rows = await Promise.all([
            seedSubscription({ status: 'ACTIVE', withLink: true, fake }),
            seedSubscription({ status: 'ACTIVE', withLink: true, fake })
        ]);
        const controller = new AbortController();
        const read = fake.readAuthorization.bind(fake);
        vi.spyOn(fake, 'readAuthorization').mockImplementation(async (input) => {
            const result = await read(input);
            controller.abort();
            return result;
        });
        const correlationId = crypto.randomUUID();
        const ping = { ping: vi.fn() };
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { correlationId, signal: controller.signal },
                { provider: fake, clock: reconciliationClock, livenessPing: ping }
            )
        );
        expect(summary).toMatchObject({ rowsRead: 1, stoppedOnBudget: true, complete: false });
        // HOS-1999 M2: only CONFIGURED passes count as skipped; none were here.
        expect(summary.skippedPasses).toEqual([]);
        expect(fake.readAuthorization).toHaveBeenCalledTimes(1);
        expect(ping.ping).not.toHaveBeenCalled();
        const [run] = await getServiceTestDb()
            .select()
            .from(reconciliationSweepRuns)
            .where(eq(reconciliationSweepRuns.correlationId, correlationId));
        expect(run?.finishedAt).toBeInstanceOf(Date);
        expect(rows).toHaveLength(2);
    });

    it('HOS-1999 M2: names every configured pass a budget stop skipped, in order', async () => {
        const { fake } = createReconciliationFake();
        await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const controller = new AbortController();
        controller.abort();
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { correlationId: crypto.randomUUID(), signal: controller.signal },
                {
                    provider: fake,
                    clock: reconciliationClock,
                    creditedPayments: {},
                    paidOrders: {},
                    pauseGifts: {}
                }
            )
        );
        expect(summary.stoppedOnBudget).toBe(true);
        expect(summary.skippedPasses).toEqual(['creditedPayments', 'paidOrders', 'pauseGifts']);
    });

    it('closes before one successful ping', async () => {
        const { fake } = createReconciliationFake();
        await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const correlationId = crypto.randomUUID();
        let saved = false;
        const ping = {
            ping: vi.fn(async ({ runId }: { runId: string }) => {
                saved = Boolean(
                    await reconciliationSweepRunModel
                        .findById({ id: runId })
                        .then((run) => run?.finishedAt)
                );
            })
        };
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { correlationId },
                { provider: fake, clock: reconciliationClock, livenessPing: ping }
            )
        );
        expect(summary).toMatchObject({ complete: true, pinged: true });
        expect(ping.ping).toHaveBeenCalledTimes(1);
        expect(ping.ping).toHaveBeenCalledWith({
            sweep: 'RECONCILIATION',
            runId: summary.runId,
            finishedAt: summary.finishedAt
        });
        expect(saved).toBe(true);
    });

    it('closes a failed run when inventory paging throws', async () => {
        await seedSubscription({ status: 'ACTIVE' });
        const correlationId = crypto.randomUUID();
        const ping = { ping: vi.fn() };
        const pageRead = vi
            .spyOn(
                (await import('@repo/db')).reconciliationInventoryModel,
                'listSweepInventoryPage'
            )
            .mockRejectedValueOnce(new Error('page failed'));
        await expect(
            runReconciliationSweep(
                { correlationId },
                {
                    provider: createReconciliationFake().fake,
                    clock: reconciliationClock,
                    livenessPing: ping
                }
            )
        ).rejects.toThrow('page failed');
        pageRead.mockRestore();
        const [run] = await getServiceTestDb()
            .select()
            .from(reconciliationSweepRuns)
            .where(eq(reconciliationSweepRuns.correlationId, correlationId));
        expect(run?.outcome).toBe('FAILED');
        expect(run?.finishedAt).toBeInstanceOf(Date);
        expect(ping.ping).not.toHaveBeenCalled();
    });

    it('keeps a complete run successful when ping fails and supports no ping port', async () => {
        const correlationId = crypto.randomUUID();
        const { fake } = createReconciliationFake();
        const ping = { ping: vi.fn().mockRejectedValue(new Error('monitor down')) };
        const first = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { correlationId },
                { provider: fake, clock: reconciliationClock, livenessPing: ping }
            )
        );
        expect(first).toMatchObject({ complete: true, pinged: false });
        const noPingCorrelationId = crypto.randomUUID();
        const second = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { correlationId: noPingCorrelationId },
                { provider: fake, clock: reconciliationClock }
            )
        );
        expect(second.complete).toBe(true);
        expect(second.pinged).toBe(false);
        const [recorded] = await getServiceTestDb()
            .select()
            .from(reconciliationSweepRuns)
            .where(eq(reconciliationSweepRuns.correlationId, noPingCorrelationId));
        expect(recorded?.finishedAt).toBeInstanceOf(Date);
    });
});
