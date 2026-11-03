import { reconciliationSweepRuns, sql, subscriptions } from '@repo/db';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

const ROWS = 60;
const PER_SLICE = 25;

describe('AC-19 the cycle covers every row exactly once across slices', () => {
    for (const offsetMs of [0, 10 * 60_000, -10 * 60_000]) {
        it(`reads each row once and stamps it, with the app clock ${offsetMs / 60_000} min off`, async () => {
            const clock = { now: () => new Date(reconciliationClock.now().getTime() + offsetMs) };
            const { fake } = createReconciliationFake(clock);
            const seeded = await Promise.all(
                Array.from({ length: ROWS }, () =>
                    seedSubscription({ status: 'ACTIVE', withLink: true, fake })
                )
            );
            const reads = new Map<string, number>();
            const base = fake.readAuthorization.bind(fake);
            let controller = new AbortController();
            let sliceReads = 0;
            vi.spyOn(fake, 'readAuthorization').mockImplementation(async (input) => {
                reads.set(input.authorizationId, (reads.get(input.authorizationId) ?? 0) + 1);
                sliceReads += 1;
                if (sliceReads >= PER_SLICE) controller.abort();
                return base(input);
            });
            const runLimited = async () => {
                controller = new AbortController();
                sliceReads = 0;
                return withSeededReconciliationInventory(() =>
                    runReconciliationSweep(
                        { pageSize: 10, signal: controller.signal },
                        { provider: fake, clock }
                    )
                );
            };
            const first = await runLimited();
            const second = await runLimited();
            sliceReads = Number.NEGATIVE_INFINITY;
            const third = await withSeededReconciliationInventory(() =>
                runReconciliationSweep({ pageSize: 10 }, { provider: fake, clock })
            );
            expect(first.outcome).toBe('TIMED_OUT');
            expect(second.outcome).toBe('TIMED_OUT');
            expect(third.outcome).toBe('CYCLE_DONE');
            expect(third.cycleId).toBe(first.cycleId);
            expect(third.sliceIndex).toBe(2);
            for (const { providerId } of seeded) {
                expect(reads.get(providerId as string)).toBe(1);
            }
            const { rows } = await getServiceTestPool().query<{ unstamped: string }>(
                `SELECT count(*)::text AS unstamped FROM subscription s, reconciliation_sweep_run r
                 WHERE r.id = $1 AND s.id = ANY($2::uuid[])
                   AND (s.last_swept_at IS NULL OR s.last_swept_at < r.cycle_started_at)`,
                [first.runId, seeded.map(({ subscription }) => subscription.id)]
            );
            expect(rows[0]?.unstamped).toBe('0');
            const stamped = await getServiceTestDb()
                .select({ n: sql<number>`count(*)::int` })
                .from(subscriptions)
                .where(sql`${subscriptions.lastSweptAt} IS NOT NULL`);
            expect(stamped[0]?.n).toBeGreaterThanOrEqual(ROWS);
        });
    }
});

describe('the budget is measured on wall time, not on the injected clock', () => {
    it('sweeps normally when the injected clock is ten days ahead of a real deadline', async () => {
        const clock = {
            now: () => new Date(Date.now() + 10 * 24 * 3_600_000)
        };
        const { fake } = createReconciliationFake(clock);
        await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const read = vi.spyOn(fake, 'readAuthorization');
        const result = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                {
                    lastSlot: true,
                    deadlineAt: new Date(Date.now() + 45 * 60_000),
                    budgetClock: () => new Date()
                },
                { provider: fake, clock }
            )
        );
        expect(result.outcome).toBe('CYCLE_DONE');
        expect(result.rowsComplete).toBe(true);
        expect(read).toHaveBeenCalledTimes(1);
    });
});
