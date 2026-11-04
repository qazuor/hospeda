import {
    eq,
    isNull,
    reconciliationMarkModel,
    reconciliationSweepRunModel,
    reconciliationSweepRuns,
    subscriptions
} from '@repo/db';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReconciliationComparison } from '../../../src/services/billing/reconciliation/sweep/reconciliation-divergence.js';
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

describe('TEST:B11:24 reconciliation sweep cycle matrix', () => {
    it('persists failed work when another actor closes a worked slice', async () => {
        const { fake } = createReconciliationFake();
        const seeded = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const closeAndFail = async () => {
            const [open] = await getServiceTestDb()
                .select({ id: reconciliationSweepRuns.id })
                .from(reconciliationSweepRuns)
                .where(isNull(reconciliationSweepRuns.outcome));
            if (open) {
                await reconciliationSweepRunModel.closeSlice({
                    id: open.id,
                    outcome: 'ABANDONED',
                    phase: 'ROWS',
                    rowsComplete: false,
                    passesCompleted: [],
                    failedSubscriptionIds: [],
                    rowsRead: 0,
                    rowsFailed: 0
                });
            }
            throw new Error('injected row check failure after lease close');
        };
        const result = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { mode: 'cycle' },
                { provider: fake, clock: reconciliationClock, rowChecks: [closeAndFail] }
            )
        );
        expect(result).toMatchObject({ leaseLost: true, complete: false, pinged: false });
        expect(result.rowsRead).toBeGreaterThanOrEqual(1);
        expect(result.rowsFailed).toBeGreaterThanOrEqual(1);
        expect(result.failures.map(({ subscriptionId }) => subscriptionId)).toContain(
            seeded.subscription.id
        );
        const [closed] = await getServiceTestDb()
            .select({
                outcome: reconciliationSweepRuns.outcome,
                rowsFailed: reconciliationSweepRuns.rowsFailed,
                failedSubscriptionIds: reconciliationSweepRuns.failedSubscriptionIds
            })
            .from(reconciliationSweepRuns)
            .where(eq(reconciliationSweepRuns.id, result.runId));
        expect(closed?.outcome).toBe('ABANDONED');
        expect(closed?.rowsFailed).toBeGreaterThanOrEqual(1);
        expect(closed?.failedSubscriptionIds).toContain(seeded.subscription.id);
    });

    it('stops a zombie slice at the next stamp after another actor closes its run', async () => {
        const { fake } = createReconciliationFake();
        const seeded = await Promise.all([
            seedSubscription({ status: 'ACTIVE', withLink: true, fake }),
            seedSubscription({ status: 'ACTIVE', withLink: true, fake }),
            seedSubscription({ status: 'ACTIVE', withLink: true, fake })
        ]);
        let closed = false;
        const read = fake.readAuthorization.bind(fake);
        vi.spyOn(fake, 'readAuthorization').mockImplementation(async (input) => {
            const result = await read(input);
            if (!closed) {
                const [open] = await getServiceTestDb()
                    .select({ id: reconciliationSweepRuns.id })
                    .from(reconciliationSweepRuns)
                    .where(isNull(reconciliationSweepRuns.outcome));
                if (open) {
                    await reconciliationSweepRunModel.closeSlice({
                        id: open.id,
                        outcome: 'ABANDONED',
                        phase: 'ROWS',
                        rowsComplete: false,
                        passesCompleted: [],
                        failedSubscriptionIds: [],
                        rowsRead: 0,
                        rowsFailed: 0
                    });
                    closed = true;
                }
            }
            return result;
        });
        const result = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { mode: 'cycle' },
                { provider: fake, clock: reconciliationClock }
            )
        );
        expect(result.leaseLost).toBe(true);
        expect(fake.readAuthorization).toHaveBeenCalledTimes(1);
        const stamped = await getServiceTestDb()
            .select({ id: subscriptions.id, lastSweptAt: subscriptions.lastSweptAt })
            .from(subscriptions);
        const own = new Map(seeded.map(({ subscription }) => [subscription.id, subscription]));
        expect(
            stamped.filter(({ id }) => own.has(id)).every(({ lastSweptAt }) => lastSweptAt === null)
        ).toBe(true);
        expect(stamped.filter(({ id }) => own.has(id))).toHaveLength(3);
    });

    it('abandons an expired slice and retries its unstamped row', async () => {
        const { fake } = createReconciliationFake();
        const seeded = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const read = vi.spyOn(fake, 'readAuthorization');
        const open = await reconciliationSweepRunModel.openSlice({
            correlationId: crypto.randomUUID()
        });
        await getServiceTestPool().query(
            "UPDATE reconciliation_sweep_run SET lease_until = now() - interval '1 minute' WHERE id = $1",
            [open.id]
        );
        const result = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { mode: 'cycle' },
                { provider: fake, clock: reconciliationClock }
            )
        );
        expect(result.outcome).toBe('CYCLE_DONE');
        const abandoned = await reconciliationSweepRunModel.findById({ id: open.id });
        expect(abandoned?.outcome).toBe('ABANDONED');
        const [row] = await getServiceTestDb()
            .select({ lastSweptAt: subscriptions.lastSweptAt })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscription.id));
        expect(row?.lastSweptAt).toBeInstanceOf(Date);
        expect(read).toHaveBeenCalledTimes(1);
    });

    it('re-reads a row whose dead slice already opened its mark without opening a second one (AC-21)', async () => {
        const { fake } = createReconciliationFake();
        const seeded = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const comparison: ReconciliationComparison = () => [{ reason: 'DIVERGENCIA_DE_MONTO' }];
        const ports = { provider: fake, clock: reconciliationClock, comparisons: [comparison] };
        // The slice that died read row K and opened its mark, but never stamped the row.
        const dead = await withSeededReconciliationInventory(() =>
            runReconciliationSweep({ mode: 'single' }, ports)
        );
        expect(dead).toMatchObject({ marksOpened: 1 });
        const open = await reconciliationSweepRunModel.openSlice({
            correlationId: crypto.randomUUID()
        });
        await getServiceTestPool().query(
            "UPDATE reconciliation_sweep_run SET lease_until = now() - interval '1 minute' WHERE id = $1",
            [open.id]
        );
        const retried = await withSeededReconciliationInventory(() =>
            runReconciliationSweep({ mode: 'cycle' }, ports)
        );
        expect(retried).toMatchObject({
            outcome: 'CYCLE_DONE',
            divergences: 1,
            marksOpened: 0,
            marksAccumulated: 1
        });
        const marks = await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: seeded.subscription.id }
        });
        expect(marks.filter((item) => item.reason === 'DIVERGENCIA_DE_MONTO')).toHaveLength(1);
    });

    it('includes failed row ids across slices in the completed cycle summary and never pings', async () => {
        let now = reconciliationClock.now();
        const clock = { now: () => new Date(now) };
        const { fake } = createReconciliationFake(clock);
        const seeded = await Promise.all(
            Array.from({ length: 3 }, () =>
                seedSubscription({ status: 'ACTIVE', withLink: true, fake })
            )
        );
        const failedId = seeded[0]!.providerId!;
        const read = fake.readAuthorization.bind(fake);
        vi.spyOn(fake, 'readAuthorization').mockImplementation(async (input) => {
            if (input.authorizationId === failedId) {
                now = new Date(now.getTime() + 2);
                throw new Error('provider read failed');
            }
            const value = await read(input);
            now = new Date(now.getTime() + 2);
            return value;
        });
        const first = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { mode: 'cycle', deadlineAt: new Date(now.getTime() + 1) },
                {
                    provider: fake,
                    clock
                }
            )
        );
        expect(first.outcome).toBe('TIMED_OUT');
        const ping = { ping: vi.fn() };
        const last = await withSeededReconciliationInventory(() =>
            runReconciliationSweep({ mode: 'cycle' }, { provider: fake, clock, livenessPing: ping })
        );
        expect(last.outcome).toBe('CYCLE_DONE');
        expect(last.cycle?.failedSubscriptionIds).toContain(seeded[0]!.subscription.id);
        expect(last.cycle?.rowsFailed).toBe(1);
        expect(ping.ping).not.toHaveBeenCalled();
        const [failedRow] = await getServiceTestDb()
            .select({ lastSweptAt: subscriptions.lastSweptAt })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded[0]!.subscription.id));
        expect(failedRow?.lastSweptAt).toBeInstanceOf(Date);
    });

    it('stores an incomplete last-slot row phase and starts a fresh cycle on request', async () => {
        const { fake } = createReconciliationFake();
        const seeded = await Promise.all(
            Array.from({ length: 3 }, () =>
                seedSubscription({ status: 'ACTIVE', withLink: true, fake })
            )
        );
        let now = reconciliationClock.now();
        const clock = { now: () => new Date(now) };
        const read = fake.readAuthorization.bind(fake);
        vi.spyOn(fake, 'readAuthorization').mockImplementation(async (input) => {
            const value = await read(input);
            now = new Date(now.getTime() + 2);
            return value;
        });
        const first = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                {
                    mode: 'cycle',
                    pageSize: 1,
                    lastSlot: true,
                    deadlineAt: new Date(now.getTime() + 1)
                },
                {
                    provider: fake,
                    clock
                }
            )
        );
        expect(first.incomplete).toBe(true);
        const stored = await reconciliationSweepRunModel.findById({ id: first.runId });
        expect(stored?.rowsComplete).toBe(false);
        const next = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { mode: 'cycle', newCycle: true, pageSize: 1 },
                { provider: fake, clock }
            )
        );
        expect(next.cycleId).not.toBe(first.cycleId);
        expect(next.orphanedCycle).toMatchObject({ cycleId: first.cycleId, rowsFailed: 0 });
        expect(seeded).toHaveLength(3);
    });

    it('does not report an orphan when resuming an incomplete cycle normally', async () => {
        const { fake } = createReconciliationFake();
        const seeded = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const first = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                {
                    mode: 'cycle',
                    lastSlot: true,
                    deadlineAt: new Date(reconciliationClock.now().getTime() - 1)
                },
                { provider: fake, clock: reconciliationClock }
            )
        );
        const resumed = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { mode: 'cycle' },
                { provider: fake, clock: reconciliationClock }
            )
        );
        expect(resumed.cycleId).toBe(first.cycleId);
        expect(resumed.orphanedCycle).toBeUndefined();
        expect(seeded.subscription.id).toBeTruthy();
    });
});
