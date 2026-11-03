import {
    inArray,
    reconciliationMarkModel,
    reconciliationMarks,
    reconciliationSweepRuns
} from '@repo/db';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers.js';
import {
    createReconciliationFake,
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import {
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures.js';

afterAll(closeServiceTestPool);

const markIds: string[] = [];
beforeEach(async () => {
    resetSeededReconciliationInventory();
    await getServiceTestDb().delete(reconciliationSweepRuns);
});
afterEach(async () => {
    vi.restoreAllMocks();
    if (markIds.length > 0) {
        await getServiceTestDb()
            .delete(reconciliationMarks)
            .where(inArray(reconciliationMarks.id, markIds))
            .catch(() => undefined);
        markIds.length = 0;
    }
});

const MARKS = 5;
const PAGE = 2;

/** Seeds committed, overdue open marks on one subscription each. */
async function seedDueMarks(): Promise<string[]> {
    const db = getServiceTestDb();
    const ids: string[] = [];
    for (let index = 0; index < MARKS; index += 1) {
        const { userId } = await seedCoverageUser(db);
        const plan = await seedCoveragePlanVersion(db, 'accommodation');
        const subject = await seedCoverageSubscription(db, {
            userId,
            vertical: 'accommodation',
            ...plan,
            status: 'ACTIVE'
        });
        const mark = await reconciliationMarkModel.insertOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
            reason: 'DIVERGENCIA_DE_MONTO',
            placedAt: new Date('2026-01-01T00:00:00Z')
        });
        ids.push(mark.id);
        markIds.push(mark.id);
    }
    return ids.sort();
}

/**
 * Restricts the escalation pass to `owned` marks while keeping real keyset paging, and calls
 * `onPage(callNumber)` before each page is served.
 */
function pageMarks(owned: readonly string[], onPage: (call: number) => Promise<void>) {
    const original = reconciliationMarkModel.listOpenUnescalatedPage.bind(reconciliationMarkModel);
    const served: string[][] = [];
    let calls = 0;
    vi.spyOn(reconciliationMarkModel, 'listOpenUnescalatedPage').mockImplementation(
        async (input) => {
            calls += 1;
            await onPage(calls);
            const all = await original({ ...input, afterMarkId: undefined, limit: 10_000 });
            const page = all
                .filter(({ id }) => owned.includes(id))
                .filter(({ id }) => input.afterMarkId === undefined || id > input.afterMarkId)
                .sort((a, b) => (a.id < b.id ? -1 : 1))
                .slice(0, input.limit);
            served.push(page.map(({ id }) => id));
            return page;
        }
    );
    return served;
}

async function leaseUntil(runId: string): Promise<{ readonly live: boolean; readonly at: Date }> {
    const { rows } = await getServiceTestPool().query<{ at: Date; live: boolean }>(
        'SELECT lease_until AS at, lease_until > now() AS live FROM reconciliation_sweep_run WHERE id = $1',
        [runId]
    );
    return { at: rows[0]!.at, live: rows[0]!.live };
}

async function openRunId(): Promise<string> {
    const { rows } = await getServiceTestPool().query<{ id: string }>(
        'SELECT id FROM reconciliation_sweep_run WHERE outcome IS NULL'
    );
    return rows[0]!.id;
}

async function escalationEvents(): Promise<Map<string, number>> {
    const { rows } = await getServiceTestPool().query<{ mark: string; n: string }>(
        `SELECT c ->> 'new' AS mark, count(*)::text AS n
           FROM domain_event e, jsonb_array_elements(e.changes) c
          WHERE e.event_type = 'reconciliation.mark_escalated' AND c ->> 'field' = 'reconciliation_mark.id'
          GROUP BY 1`
    );
    return new Map(rows.map(({ mark, n }) => [mark, Number(n)]));
}

describe('AC-22 an interrupted pass restarts from its beginning in the next slice', () => {
    it('escalates every mark exactly once when slice 1 stops mid-pass and slice 2 finishes it', async () => {
        const owned = await seedDueMarks();
        const controller = new AbortController();
        const served = pageMarks(owned, async (call) => {
            if (call === 2) controller.abort();
        });
        const { fake } = createReconciliationFake();

        const first = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { mode: 'cycle', pageSize: PAGE, signal: controller.signal },
                { provider: fake, clock: reconciliationClock, markEscalation: {} }
            )
        );
        expect(first.outcome).toBe('TIMED_OUT');
        const stored = await getServiceTestPool().query<{ passes: string[] }>(
            'SELECT passes_completed AS passes FROM reconciliation_sweep_run WHERE id = $1',
            [first.runId]
        );
        expect(stored.rows[0]?.passes).not.toContain('markEscalation');
        const afterFirst = await escalationEvents();
        expect([...afterFirst.keys()].filter((id) => owned.includes(id))).toHaveLength(PAGE * 2);

        const second = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { mode: 'cycle', pageSize: PAGE },
                { provider: fake, clock: reconciliationClock, markEscalation: {} }
            )
        );
        expect(second.outcome).toBe('CYCLE_DONE');
        expect(second.markEscalation?.examined).toBe(MARKS - PAGE * 2);
        const events = await escalationEvents();
        for (const id of owned) expect(events.get(id)).toBe(1);
        // Pages served: 1st slice walked pages 1 and 2, the 2nd slice only what was left.
        expect(served.flat().filter((id) => owned.includes(id))).toHaveLength(MARKS);
        const done = await getServiceTestPool().query<{ passes: string[] }>(
            'SELECT passes_completed AS passes FROM reconciliation_sweep_run WHERE id = $1',
            [second.runId]
        );
        expect(done.rows[0]?.passes).toContain('markEscalation');
    });
});

describe('lease renewal during a multi-page pass', () => {
    it('renews lease_until on every page, so an expired lease is live again and blocks a takeover', async () => {
        const owned = await seedDueMarks();
        const observed: { live: boolean; at: Date }[] = [];
        let takeover: unknown;
        pageMarks(owned, async (call) => {
            const runId = await openRunId();
            if (call === 2) {
                // The TTL "elapsed" while page 1 was being served; the heartbeat after page 1
                // must already have renewed the lease, so it is live right now.
                observed.push(await leaseUntil(runId));
                await getServiceTestPool().query(
                    "UPDATE reconciliation_sweep_run SET lease_until = now() - interval '1 minute' WHERE id = $1",
                    [runId]
                );
            }
            if (call === 3) {
                // Page 2's heartbeat renewed the expired lease: still live, and a concurrent
                // open of a new slice must be refused while this one is alive.
                observed.push(await leaseUntil(runId));
                const { reconciliationSweepRunModel } = await import('@repo/db');
                takeover = await reconciliationSweepRunModel
                    .openSlice({ correlationId: crypto.randomUUID() })
                    .then(() => 'opened')
                    .catch((error: Error) => error.name);
            }
        });
        const { fake } = createReconciliationFake();
        const result = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { mode: 'cycle', pageSize: PAGE },
                { provider: fake, clock: reconciliationClock, markEscalation: {} }
            )
        );
        expect(result.outcome).toBe('CYCLE_DONE');
        expect(observed).toHaveLength(2);
        expect(observed[0]?.live).toBe(true);
        expect(observed[1]?.live).toBe(true);
        expect(takeover).toBe('ReconciliationSweepSliceAlreadyOpenError');
    });
});

describe('multi-slice ordering inside one cycle (AC-25, AC-37)', () => {
    it('slots run in order, the last slot applies the pass reserve, and the next cycle reads unreached rows first', async () => {
        const { fake } = createReconciliationFake();
        const seeded = await Promise.all(
            Array.from({ length: 12 }, () =>
                seedSubscription({ status: 'ACTIVE', withLink: true, fake })
            )
        );
        const order: string[] = [];
        let controller = new AbortController();
        let reads = 0;
        const limit = 4;
        const base = fake.readAuthorization;
        vi.spyOn(fake, 'readAuthorization').mockImplementation(async (input) => {
            reads += 1;
            order.push(input.authorizationId);
            if (reads >= limit) controller.abort();
            return base.call(fake, input);
        });
        const slice = (extra: Record<string, unknown>) => {
            controller = new AbortController();
            reads = 0;
            return withSeededReconciliationInventory(() =>
                runReconciliationSweep(
                    { mode: 'cycle', pageSize: 3, signal: controller.signal, ...extra },
                    { provider: fake, clock: reconciliationClock }
                )
            );
        };
        const s0 = await slice({});
        const s1 = await slice({});
        expect([s0.sliceIndex, s1.sliceIndex]).toEqual([0, 1]);
        expect(s1.cycleId).toBe(s0.cycleId);
        // No row of slice 0 is read again in slice 1.
        const providerIds = seeded.map(({ providerId }) => providerId as string);
        const slice0Reads = order.slice(0, limit);
        const slice1Reads = order.slice(limit, limit * 2);
        expect(slice1Reads.filter((id) => slice0Reads.includes(id))).toEqual([]);
        // Last slot: the deadline is inside the 15 min reserve, so no row is read, every pass
        // runs, and the cycle is reported incomplete.
        reads = Number.NEGATIVE_INFINITY;
        controller = new AbortController();
        const s2 = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                {
                    mode: 'cycle',
                    pageSize: 3,
                    lastSlot: true,
                    deadlineAt: new Date(Date.now() + 10 * 60_000),
                    budgetClock: () => new Date()
                },
                { provider: fake, clock: reconciliationClock }
            )
        );
        expect(s2.sliceIndex).toBe(2);
        expect(s2.rowsComplete).toBe(false);
        expect(s2.incomplete).toBe(true);
        expect(order).toHaveLength(limit * 2);
        const unreached = providerIds.filter((id) => !order.includes(id));
        expect(unreached).toHaveLength(12 - limit * 2);

        // Next night: a fresh cycle reads the rows nobody reached before any already swept.
        reads = Number.NEGATIVE_INFINITY;
        order.length = 0;
        await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { mode: 'cycle', newCycle: true, pageSize: 3 },
                { provider: fake, clock: reconciliationClock }
            )
        );
        expect(new Set(order.slice(0, unreached.length))).toEqual(new Set(unreached));
    });

    it('reads a row created mid-cycle (NULL stamp) before swept rows it has not reached', async () => {
        const { fake } = createReconciliationFake();
        await Promise.all(
            Array.from({ length: 6 }, () =>
                seedSubscription({ status: 'ACTIVE', withLink: true, fake })
            )
        );
        // Cycle A sweeps everyone, so every stamp is old.
        await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { mode: 'cycle', pageSize: 3 },
                { provider: fake, clock: reconciliationClock }
            )
        );
        const order: string[] = [];
        let controller = new AbortController();
        let reads = 0;
        const base = fake.readAuthorization;
        vi.spyOn(fake, 'readAuthorization').mockImplementation(async (input) => {
            reads += 1;
            order.push(input.authorizationId);
            if (reads >= 2) controller.abort();
            return base.call(fake, input);
        });
        order.length = 0;
        const run = (extra: Record<string, unknown>) =>
            withSeededReconciliationInventory(() =>
                runReconciliationSweep(
                    { mode: 'cycle', pageSize: 3, signal: controller.signal, ...extra },
                    { provider: fake, clock: reconciliationClock }
                )
            );
        controller = new AbortController();
        await run({ newCycle: true });
        const late = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        order.length = 0;
        reads = 0;
        controller = new AbortController();
        await run({});
        expect(order[0]).toBe(late.providerId);
    });
});
