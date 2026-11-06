import type { Clock, CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { eq, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { CoverageNotices } from '../../../src/services/billing/payment/payment-ports.js';
import { applyDueScheduledChanges } from '../../../src/services/billing/subscription/apply-due-scheduled-changes.service.js';
import * as scheduledChangeService from '../../../src/services/billing/subscription/apply-scheduled-change.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { retirePlanChanges, seedPlanChange } from './support/plan-change-fixtures.js';
import { scheduledChangesOf, seedScheduledChange } from './support/scheduled-change-fixtures.js';
import { successionClock } from './support/succession-fixtures.js';

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePlanChanges();
});
afterAll(closeServiceTestPool);

function fixedClock(date: Date): Clock {
    return { now: () => date };
}

async function seed(status: string, effectiveAt: Date) {
    const row = await seedPlanChange({ status });
    await seedScheduledChange({
        subscriptionId: row.predecessor.id,
        effectiveAt,
        targetPlanVersionId: row.targetPlanVersionId,
        targetBillingOptionId: row.targetBillingOptionId
    });
    return row;
}

function notices(onEmit: (event: CoverageChangedEvent) => void): CoverageNotices {
    return {
        async emitCoverageChanged(event) {
            onEmit(event);
        }
    };
}

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:15 S38 due-change batch', () => {
    it('applies due live rows, counts paused rows waiting, skips future rows and emits one post-commit notice', async () => {
        const now = successionClock.now();
        const active = await seed('ACTIVE', new Date('2000-01-01T00:00:00Z'));
        const paused = await seed('PAUSED', new Date('2000-01-02T00:00:00Z'));
        const future = await seed('ACTIVE', new Date(now.getTime() + 60_000));
        const pausedQueue = await scheduledChangesOf(paused.predecessor.id);
        const emitted: CoverageChangedEvent[] = [];
        const result = await applyDueScheduledChanges(
            { limit: 100 },
            {
                clock: fixedClock(now),
                coverageNotices: notices((event) => {
                    if (event.userId === active.user.id) emitted.push(event);
                })
            }
        );
        const [applied] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, active.predecessor.id));
        const [waiting] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, paused.predecessor.id));
        const activeQueue = await scheduledChangesOf(active.predecessor.id);
        const [notDue] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, future.predecessor.id));
        const activeResult = result.results.find(
            (row) => row.subscriptionId === active.predecessor.id
        );
        if (activeResult) expect(activeResult.outcome).toBe('APPLIED');
        expect(activeQueue).toHaveLength(0);
        const pausedResult = result.results.find(
            (row) => row.subscriptionId === paused.predecessor.id
        );
        if (pausedResult)
            expect(pausedResult).toMatchObject({
                outcome: 'NOT_APPLICABLE',
                reason: 'WAITS_PAUSED'
            });
        expect(
            result.results.filter((row) => row.subscriptionId === paused.predecessor.id)
        ).toHaveLength(1);
        expect(result.results.some((row) => row.subscriptionId === future.predecessor.id)).toBe(
            false
        );
        expect(applied?.planVersionId).toBe(active.targetPlanVersionId);
        expect(waiting?.planVersionId).toBe(paused.planVersionId);
        expect(await scheduledChangesOf(paused.predecessor.id)).toEqual(pausedQueue);
        expect(notDue?.planVersionId).toBe(future.planVersionId);
        expect(emitted).toEqual([
            {
                userId: active.user.id,
                vertical: 'accommodation',
                sourceType: 'SUBSCRIPTION',
                change: 'CHANGED'
            }
        ]);
    });

    it('keeps the committed change and returns a warning when coverage delivery fails', async () => {
        const now = successionClock.now();
        const active = await seed('ACTIVE', new Date('1900-01-01T00:00:00Z'));
        const failingNotices: CoverageNotices = {
            async emitCoverageChanged() {
                throw new Error('notice unavailable');
            }
        };
        const result = await applyDueScheduledChanges(
            { limit: 1 },
            { clock: fixedClock(now), coverageNotices: failingNotices }
        );
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, active.predecessor.id));
        expect(row?.planVersionId).toBe(active.targetPlanVersionId);
        expect(result.results).toContainEqual({
            subscriptionId: active.predecessor.id,
            outcome: 'APPLIED'
        });
        expect(result.warnings).toContain('COVERAGE_NOTICE_FAILED');
    });

    it('counts a row failure and continues with the next due subscription', async () => {
        const now = successionClock.now();
        const first = await seed('ACTIVE', new Date('2000-01-01T00:00:00Z'));
        const second = await seed('ACTIVE', new Date('2000-01-02T00:00:00Z'));
        const original = scheduledChangeService.applyScheduledChangeInTx;
        const applySpy = vi.spyOn(scheduledChangeService, 'applyScheduledChangeInTx');
        applySpy.mockImplementation(async (input) => {
            if (input.subscriptionId === first.predecessor.id) throw new Error('row failure');
            return original(input);
        });
        const emitted: CoverageChangedEvent[] = [];
        const result = await applyDueScheduledChanges(
            { limit: 100 },
            {
                clock: fixedClock(now),
                coverageNotices: notices((event) => {
                    if (event.userId === first.user.id || event.userId === second.user.id)
                        emitted.push(event);
                })
            }
        );
        const [firstRow] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, first.predecessor.id));
        const [secondRow] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, second.predecessor.id));
        expect(result.results).toEqual(
            expect.arrayContaining([
                { subscriptionId: first.predecessor.id, outcome: 'FAILED' },
                { subscriptionId: second.predecessor.id, outcome: 'APPLIED' }
            ])
        );
        expect(firstRow?.planVersionId).toBe(first.planVersionId);
        expect(secondRow?.planVersionId).toBe(second.targetPlanVersionId);
        expect(emitted).toHaveLength(1);
    });
});
