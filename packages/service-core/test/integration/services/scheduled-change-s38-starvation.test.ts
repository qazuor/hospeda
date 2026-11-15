import type { Clock, CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { eq, sql, subscriptionScheduledChanges, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { CoverageNotices } from '../../../src/services/billing/payment/payment-ports.js';
import { applyDueScheduledChanges } from '../../../src/services/billing/subscription/apply-due-scheduled-changes.service.js';
import * as scheduledChangeService from '../../../src/services/billing/subscription/apply-scheduled-change.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { retirePlanChanges, seedPlanChange } from './support/plan-change-fixtures.js';
import { scheduledChangesOf, seedScheduledChange } from './support/scheduled-change-fixtures.js';
import { successionClock } from './support/succession-fixtures.js';

/** Captures the warnings emitted by the batch logger (the stall guard is a warning). */
const batchWarnings = vi.hoisted(() => ({ calls: [] as unknown[][] }));

vi.mock('@repo/logger', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/logger')>();
    return {
        ...actual,
        createLogger: (key: string) => {
            const instance = actual.createLogger(key);
            if (key !== 'apply-due-scheduled-changes') return instance;
            return {
                ...instance,
                warn: (...args: unknown[]) => {
                    batchWarnings.calls.push(args);
                }
            };
        }
    };
});

afterEach(async () => {
    vi.restoreAllMocks();
    batchWarnings.calls.length = 0;
    await retirePlanChanges();
});
afterAll(closeServiceTestPool);

function fixedClock(date: Date): Clock {
    return { now: () => date };
}

function notices(onEmit: (event: CoverageChangedEvent) => void): CoverageNotices {
    return {
        async emitCoverageChanged(event) {
            onEmit(event);
        }
    };
}

function noopNotices(): CoverageNotices {
    return { async emitCoverageChanged() {} };
}

/** Seeds one ACTIVE live predecessor with a distinct target and its due queue entry. */
async function seedWithChange(status: string, effectiveAt: Date) {
    const row = await seedPlanChange({ status });
    const change = await seedScheduledChange({
        subscriptionId: row.predecessor.id,
        effectiveAt,
        targetPlanVersionId: row.targetPlanVersionId,
        targetBillingOptionId: row.targetBillingOptionId
    });
    return { row, change };
}

async function seed(status: string, effectiveAt: Date) {
    return (await seedWithChange(status, effectiveAt)).row;
}

/**
 * Injected step: no real path makes S38 fail persistently for a seeded row without
 * breaking a constraint. The spy throws for the given subscriptions and delegates the
 * rest to the real applier, exactly like the B8b:15 row-failure template.
 */
function spyBroken(
    broken: ReadonlySet<string>,
    onFirstSight?: (subscriptionId: string) => Promise<void>
) {
    const original = scheduledChangeService.applyScheduledChangeInTx;
    const seen = new Set<string>();
    const spy = vi.spyOn(scheduledChangeService, 'applyScheduledChangeInTx');
    spy.mockImplementation(async (input) => {
        if (broken.has(input.subscriptionId)) {
            if (onFirstSight && !seen.has(input.subscriptionId)) {
                seen.add(input.subscriptionId);
                await onFirstSight(input.subscriptionId);
            }
            throw new Error('injected step: S38 fails persistently for this subscription');
        }
        return original(input);
    });
    return spy;
}

/**
 * Declared hand-written UPDATE: `seedScheduledChange` only stores millisecond values, so a
 * sub-millisecond `effective_at` can only be produced with raw SQL.
 */
async function setEffectiveAtMicros(changeId: string, literal: string): Promise<void> {
    await getServiceTestDb().execute(
        sql`UPDATE "subscription_scheduled_change"
            SET "effective_at" = ${literal}::timestamptz
            WHERE "id" = ${changeId}`
    );
}

/** The seeded queue row after exactly one recorded failure at `now` (HOS-2104 c2 counter). */
function afterOneFailure(
    row: Awaited<ReturnType<typeof scheduledChangesOf>>[number] | undefined,
    now: Date
) {
    if (!row) throw new Error('seeded queue row is missing');
    return [
        {
            ...row,
            attemptCount: 1,
            lastErrorAt: now,
            lastError: 'injected step: S38 fails persistently for this subscription'
        }
    ];
}

/** Replaces the subscription's queue row from another connection (DELETE + INSERT, new id). */
async function replaceQueueRow(input: {
    readonly subscriptionId: string;
    readonly targetPlanVersionId: string;
    readonly targetBillingOptionId: string;
    readonly effectiveAt: Date;
}): Promise<void> {
    await getServiceTestDb()
        .delete(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, input.subscriptionId));
    await seedScheduledChange({
        subscriptionId: input.subscriptionId,
        effectiveAt: input.effectiveAt,
        targetPlanVersionId: input.targetPlanVersionId,
        targetBillingOptionId: input.targetBillingOptionId
    });
}

async function subscriptionOf(id: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    return row;
}

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-2104 S38 due-change batch walks every due row',
    () => {
        it('with limit 2 and 2 due rows that always fail, a third valid row is still applied', async () => {
            const now = successionClock.now();
            const brokenOne = await seed('ACTIVE', new Date('1800-01-01T00:00:00Z'));
            const brokenTwo = await seed('ACTIVE', new Date('1800-01-02T00:00:00Z'));
            const valid = await seed('ACTIVE', new Date('1800-01-03T00:00:00Z'));
            const brokenOneQueue = await scheduledChangesOf(brokenOne.predecessor.id);
            const brokenTwoQueue = await scheduledChangesOf(brokenTwo.predecessor.id);
            spyBroken(new Set([brokenOne.predecessor.id, brokenTwo.predecessor.id]));

            const result = await applyDueScheduledChanges(
                { limit: 2 },
                { clock: fixedClock(now), coverageNotices: noopNotices() }
            );

            const ownIds = new Set([
                brokenOne.predecessor.id,
                brokenTwo.predecessor.id,
                valid.predecessor.id
            ]);
            const ownResults = result.results.filter((row) => ownIds.has(row.subscriptionId));
            expect(
                ownResults.filter(
                    (row) =>
                        row.subscriptionId === valid.predecessor.id && row.outcome === 'APPLIED'
                )
            ).toHaveLength(1);
            expect(
                ownResults.filter(
                    (row) =>
                        row.subscriptionId === brokenOne.predecessor.id && row.outcome === 'FAILED'
                )
            ).toHaveLength(1);
            expect(
                ownResults.filter(
                    (row) =>
                        row.subscriptionId === brokenTwo.predecessor.id && row.outcome === 'FAILED'
                )
            ).toHaveLength(1);

            const validRow = await subscriptionOf(valid.predecessor.id);
            expect(validRow?.planVersionId).toBe(valid.targetPlanVersionId);
            expect(await scheduledChangesOf(valid.predecessor.id)).toHaveLength(0);

            const brokenOneRow = await subscriptionOf(brokenOne.predecessor.id);
            expect(brokenOneRow?.planVersionId).toBe(brokenOne.planVersionId);
            expect(await scheduledChangesOf(brokenOne.predecessor.id)).toEqual(
                afterOneFailure(brokenOneQueue[0], now)
            );

            const brokenTwoRow = await subscriptionOf(brokenTwo.predecessor.id);
            expect(brokenTwoRow?.planVersionId).toBe(brokenTwo.planVersionId);
            expect(await scheduledChangesOf(brokenTwo.predecessor.id)).toEqual(
                afterOneFailure(brokenTwoQueue[0], now)
            );
        });

        it('keeps the applied row committed when its page neighbour fails', async () => {
            const now = successionClock.now();
            const valid = await seed('ACTIVE', new Date('1800-01-01T00:00:00Z'));
            const broken = await seed('ACTIVE', new Date('1800-01-02T00:00:00Z'));
            const brokenQueue = await scheduledChangesOf(broken.predecessor.id);
            spyBroken(new Set([broken.predecessor.id]));

            const result = await applyDueScheduledChanges(
                { limit: 2 },
                { clock: fixedClock(now), coverageNotices: noopNotices() }
            );

            expect(
                result.results.filter(
                    (row) =>
                        row.subscriptionId === valid.predecessor.id && row.outcome === 'APPLIED'
                )
            ).toHaveLength(1);
            expect(
                result.results.filter(
                    (row) =>
                        row.subscriptionId === broken.predecessor.id && row.outcome === 'FAILED'
                )
            ).toHaveLength(1);

            const validRow = await subscriptionOf(valid.predecessor.id);
            expect(validRow?.planVersionId).toBe(valid.targetPlanVersionId);
            expect(await scheduledChangesOf(valid.predecessor.id)).toHaveLength(0);
            const brokenRow = await subscriptionOf(broken.predecessor.id);
            expect(brokenRow?.planVersionId).toBe(broken.planVersionId);
            expect(await scheduledChangesOf(broken.predecessor.id)).toEqual(
                afterOneFailure(brokenQueue[0], now)
            );
        });

        it('applies every tied row on a page boundary exactly once', async () => {
            const now = successionClock.now();
            const tiedAt = new Date('1800-04-01T00:00:00Z');
            const rows = [];
            for (let index = 0; index < 5; index += 1) rows.push(await seed('ACTIVE', tiedAt));

            const result = await applyDueScheduledChanges(
                { limit: 2 },
                { clock: fixedClock(now), coverageNotices: noopNotices() }
            );

            for (const row of rows) {
                const id = row.predecessor.id;
                expect(
                    result.results.filter(
                        (entry) => entry.subscriptionId === id && entry.outcome === 'APPLIED'
                    )
                ).toHaveLength(1);
                const applied = await subscriptionOf(id);
                expect(applied?.planVersionId).toBe(row.targetPlanVersionId);
                expect(await scheduledChangesOf(id)).toHaveLength(0);
            }
        });

        it('advances the cursor without losing sub-millisecond precision', async () => {
            const now = successionClock.now();
            // A first valid row holds microseconds. B is injected to fail and persist so a
            // millisecond-truncated cursor would re-select it and starve the later rows.
            const microValid = await seedWithChange('ACTIVE', new Date('1800-02-01T00:00:00Z'));
            await setEffectiveAtMicros(microValid.change.id, '1800-02-01 00:00:00.123456+00');
            const microBroken = await seedWithChange('ACTIVE', new Date('1800-02-01T00:00:00Z'));
            await setEffectiveAtMicros(microBroken.change.id, '1800-02-01 00:00:00.123999+00');
            const laterOne = await seed('ACTIVE', new Date('1800-02-02T00:00:00Z'));
            const laterTwo = await seed('ACTIVE', new Date('1800-02-03T00:00:00Z'));
            spyBroken(new Set([microBroken.row.predecessor.id]));

            const result = await applyDueScheduledChanges(
                { limit: 1 },
                { clock: fixedClock(now), coverageNotices: noopNotices() }
            );

            for (const row of [microValid.row, laterOne, laterTwo]) {
                const id = row.predecessor.id;
                expect(
                    result.results.filter(
                        (entry) => entry.subscriptionId === id && entry.outcome === 'APPLIED'
                    )
                ).toHaveLength(1);
                expect(await scheduledChangesOf(id)).toHaveLength(0);
            }
            expect(
                result.results.filter(
                    (entry) =>
                        entry.subscriptionId === microBroken.row.predecessor.id &&
                        entry.outcome === 'FAILED'
                )
            ).toHaveLength(1);
            expect(await scheduledChangesOf(microBroken.row.predecessor.id)).toHaveLength(1);
        });

        it('visits a subscription once even when its queue row is replaced mid-run', async () => {
            const now = successionClock.now();
            const target = await seedWithChange('ACTIVE', new Date('1800-03-01T00:00:00Z'));
            const replacementAt = new Date('1800-03-02T00:00:00Z');
            // Injected step: the row is deleted + reinserted (new id) from another connection
            // before the applier throws, mimicking a client replacing its queued change.
            spyBroken(new Set([target.row.predecessor.id]), async (subscriptionId) => {
                await replaceQueueRow({
                    subscriptionId,
                    targetPlanVersionId: target.row.targetPlanVersionId,
                    targetBillingOptionId: target.row.targetBillingOptionId,
                    effectiveAt: replacementAt
                });
            });

            const result = await applyDueScheduledChanges(
                { limit: 1 },
                { clock: fixedClock(now), coverageNotices: noopNotices() }
            );

            const own = result.results.filter(
                (entry) => entry.subscriptionId === target.row.predecessor.id
            );
            expect(own).toHaveLength(1);
            expect(own[0]?.outcome).toBe('FAILED');
            const queue = await scheduledChangesOf(target.row.predecessor.id);
            expect(queue).toHaveLength(1);
            expect(queue[0]?.id).not.toBe(target.change.id);
            const unchanged = await subscriptionOf(target.row.predecessor.id);
            expect(unchanged?.planVersionId).toBe(target.row.planVersionId);
        });

        it('keeps walking when a full page holds only a replaced subscription and applies the later valid row', async () => {
            const now = successionClock.now();
            const replaced = await seedWithChange('ACTIVE', new Date('1800-07-01T00:00:00Z'));
            // The replacement sorts after the page that already consumed its subscription,
            // so with `limit: 1` the next page holds only an already-visited subscription.
            const replacementAt = new Date('1800-07-02T00:00:00Z');
            const valid = await seed('ACTIVE', new Date('1800-07-03T00:00:00Z'));
            spyBroken(new Set([replaced.row.predecessor.id]), async (subscriptionId) => {
                await replaceQueueRow({
                    subscriptionId,
                    targetPlanVersionId: replaced.row.targetPlanVersionId,
                    targetBillingOptionId: replaced.row.targetBillingOptionId,
                    effectiveAt: replacementAt
                });
            });

            const result = await applyDueScheduledChanges(
                { limit: 1 },
                { clock: fixedClock(now), coverageNotices: noopNotices() }
            );

            expect(
                result.results.filter(
                    (entry) =>
                        entry.subscriptionId === valid.predecessor.id && entry.outcome === 'APPLIED'
                )
            ).toHaveLength(1);
            const applied = await subscriptionOf(valid.predecessor.id);
            expect(applied?.planVersionId).toBe(valid.targetPlanVersionId);
            expect(await scheduledChangesOf(valid.predecessor.id)).toHaveLength(0);
            // The replaced subscription is still visited exactly once in this run.
            expect(
                result.results.filter(
                    (entry) => entry.subscriptionId === replaced.row.predecessor.id
                )
            ).toHaveLength(1);
        });

        it('does not warn about a stalled cursor on a normal multi-page walk', async () => {
            const now = successionClock.now();
            const rows = [];
            for (let index = 0; index < 3; index += 1)
                rows.push(await seed('ACTIVE', new Date(`1800-08-0${index + 1}T00:00:00Z`)));

            const result = await applyDueScheduledChanges(
                { limit: 1 },
                { clock: fixedClock(now), coverageNotices: noopNotices() }
            );

            for (const row of rows) {
                const id = row.predecessor.id;
                expect(
                    result.results.filter(
                        (entry) => entry.subscriptionId === id && entry.outcome === 'APPLIED'
                    )
                ).toHaveLength(1);
            }
            expect(batchWarnings.calls).toHaveLength(0);
        });

        it('does not duplicate applications or notices across two consecutive runs', async () => {
            const now = successionClock.now();
            const first = await seed('ACTIVE', new Date('1800-06-01T00:00:00Z'));
            const second = await seed('ACTIVE', new Date('1800-06-02T00:00:00Z'));
            const ownIds = new Set([first.predecessor.id, second.predecessor.id]);
            const ourUserIds = new Set([first.user.id, second.user.id]);
            const emitted: CoverageChangedEvent[] = [];
            const ports = {
                clock: fixedClock(now),
                coverageNotices: notices((event) => {
                    if (ourUserIds.has(event.userId)) emitted.push(event);
                })
            };

            const runOne = await applyDueScheduledChanges({ limit: 10 }, ports);
            expect(
                runOne.results.filter(
                    (entry) => ownIds.has(entry.subscriptionId) && entry.outcome === 'APPLIED'
                )
            ).toHaveLength(2);
            expect(emitted).toHaveLength(2);
            const afterFirstRun = emitted.map((event) => ({ ...event }));

            const runTwo = await applyDueScheduledChanges({ limit: 10 }, ports);
            expect(
                runTwo.results.filter(
                    (entry) => ownIds.has(entry.subscriptionId) && entry.outcome === 'APPLIED'
                )
            ).toHaveLength(0);
            expect(emitted).toEqual(afterFirstRun);
        });
    }
);
