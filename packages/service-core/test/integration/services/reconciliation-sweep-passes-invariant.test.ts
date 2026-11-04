import {
    eq,
    extendRunLease,
    reconciliationInventoryModel,
    reconciliationSweepRunModel,
    reconciliationSweepRuns
} from '@repo/db';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    runReconciliationSweep,
    SWEEP_PASS_RESERVE_MS
} from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    createReconciliationFake,
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

const leaseWrites = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        extendRunLease: vi.fn(async (input: Parameters<typeof actual.extendRunLease>[0]) => {
            if (input.set) leaseWrites.push({ ...input.set });
            return actual.extendRunLease(input);
        })
    };
});

afterAll(closeServiceTestPool);
beforeEach(async () => {
    resetSeededReconciliationInventory();
    leaseWrites.length = 0;
    await getServiceTestDb().delete(reconciliationSweepRuns);
});
afterEach(() => vi.restoreAllMocks());

describe('HOS-1999 passes_completed is stored only with complete rows', () => {
    it('a FAILED slice with incomplete rows persists no completed passes', async () => {
        const prior = await reconciliationSweepRunModel.openSlice({
            correlationId: crypto.randomUUID()
        });
        await reconciliationSweepRunModel.closeSlice({
            id: prior.id,
            outcome: 'TIMED_OUT',
            phase: 'PASSES',
            rowsComplete: true,
            passesCompleted: ['cancellationRetry'],
            failedSubscriptionIds: [],
            rowsRead: 0,
            rowsFailed: 0
        });
        vi.spyOn(reconciliationInventoryModel, 'listSweepInventoryPage').mockRejectedValue(
            new Error('injected inventory failure')
        );
        const { fake } = createReconciliationFake();
        await expect(
            runReconciliationSweep(
                { mode: 'cycle' },
                { provider: fake, clock: reconciliationClock }
            )
        ).rejects.toThrow('injected inventory failure');
        const [failed] = await getServiceTestDb()
            .select({
                outcome: reconciliationSweepRuns.outcome,
                rowsComplete: reconciliationSweepRuns.rowsComplete,
                passesCompleted: reconciliationSweepRuns.passesCompleted
            })
            .from(reconciliationSweepRuns)
            .where(eq(reconciliationSweepRuns.sliceIndex, 1));
        expect(failed).toMatchObject({ outcome: 'FAILED', rowsComplete: false });
        expect(failed?.passesCompleted).toEqual([]);
    });

    it('a pass finishing while rows are incomplete heartbeats no completed passes', async () => {
        const { fake } = createReconciliationFake();
        await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const now = reconciliationClock.now();
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                {
                    mode: 'cycle',
                    lastSlot: true,
                    // Inside the pass reserve: the row loop stops at once, every pass still runs.
                    deadlineAt: new Date(now.getTime() + SWEEP_PASS_RESERVE_MS - 60_000),
                    budgetClock: () => now
                },
                {
                    provider: fake,
                    clock: reconciliationClock,
                    cancellationRetry: { beforeCancelNotice: outboxBeforeCancelNotice() }
                }
            )
        );
        expect(summary.rowsComplete).toBe(false);
        expect(vi.mocked(extendRunLease).mock.calls.length).toBeGreaterThan(0);
        const passWrites = leaseWrites.filter((write) => 'passesCompleted' in write);
        expect(passWrites.length).toBeGreaterThan(0);
        for (const write of passWrites) {
            expect(write.passesCompleted).toEqual([]);
            expect(write.rowsComplete).toBe(false);
        }
        const [closed] = await getServiceTestDb()
            .select({ passesCompleted: reconciliationSweepRuns.passesCompleted })
            .from(reconciliationSweepRuns)
            .where(eq(reconciliationSweepRuns.id, summary.runId));
        expect(closed?.passesCompleted).toEqual([]);
    });
});
