import {
    eq,
    isReconciliationSweepRunComplete,
    reconciliationSweepRunModel,
    reconciliationSweepRuns
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
beforeEach(resetSeededReconciliationInventory);

describe('TEST:B11:24 reconciliation sweep run and liveness ping', () => {
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

    it('leaves a run open when inventory paging throws', async () => {
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
        expect(run?.finishedAt).toBeNull();
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
