import type { Clock } from '@repo/billing-verticals-contract';
import { eq, subscriptions } from '@repo/db';
import { registerCaptureHook, unregisterCaptureHook } from '@repo/logger';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoverageNotices } from '../../../src/services/billing/payment/payment-ports.js';
import { applyDueScheduledChanges } from '../../../src/services/billing/subscription/apply-due-scheduled-changes.service.js';
import * as scheduledChangeService from '../../../src/services/billing/subscription/apply-scheduled-change.service.js';
import { SCHEDULED_CHANGE_MAX_ATTEMPTS } from '../../../src/services/billing/subscription/scheduled-change-attempts.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { retirePlanChanges, seedPlanChange } from './support/plan-change-fixtures.js';
import {
    deleteScheduledChanges,
    scheduledChangesOf,
    seedScheduledChange
} from './support/scheduled-change-fixtures.js';

/** The injected failure message; `last_error` stores `error.message` without a stack. */
const FAILURE_MESSAGE = 'injected step: S38 fails persistently for this subscription';
/** The alert message the production logger must emit when a row reaches its cap. */
const EXHAUSTED_MESSAGE =
    'Scheduled change exhausted its attempts and is excluded from the batch until re-enabled';
/** N is imported, never written as a literal: the test tracks the production constant. */
const MAX = SCHEDULED_CHANGE_MAX_ATTEMPTS;

const captured: { error: unknown; extra: Record<string, unknown> }[] = [];

beforeEach(() => {
    captured.length = 0;
    registerCaptureHook((error, extra) => {
        captured.push({ error, extra });
    });
});

afterEach(async () => {
    unregisterCaptureHook();
    vi.restoreAllMocks();
    await retirePlanChanges();
});

afterAll(closeServiceTestPool);

function fixedClock(date: Date): Clock {
    return { now: () => date };
}

function noopNotices(): CoverageNotices {
    return { async emitCoverageChanged() {} };
}

/** Seeds one ACTIVE live predecessor with a distinct target and its due queue entry. */
async function seedDue(status: string, effectiveAt: Date) {
    const row = await seedPlanChange({ status });
    const change = await seedScheduledChange({
        subscriptionId: row.predecessor.id,
        effectiveAt,
        targetPlanVersionId: row.targetPlanVersionId,
        targetBillingOptionId: row.targetBillingOptionId
    });
    return { row, change };
}

/**
 * Injected step (D-10): no real path makes S38 fail persistently for a seeded row
 * without breaking a constraint. The spy throws for the subscriptions in `broken`
 * and delegates the rest to the real applier, like the B8b:15 row-failure template.
 */
function failureSpy(
    options: { readonly onBroken?: (subscriptionId: string) => Promise<void> } = {}
) {
    const broken = new Set<string>();
    const original = scheduledChangeService.applyScheduledChangeInTx;
    const spy = vi.spyOn(scheduledChangeService, 'applyScheduledChangeInTx');
    spy.mockImplementation(async (input) => {
        if (!broken.has(input.subscriptionId)) return original(input);
        if (options.onBroken) await options.onBroken(input.subscriptionId);
        throw new Error(FAILURE_MESSAGE);
    });
    return { broken, spy };
}

async function run(at: Date, limit = 100) {
    return applyDueScheduledChanges(
        { limit },
        { clock: fixedClock(at), coverageNotices: noopNotices() }
    );
}

async function queueRows(subscriptionId: string) {
    return scheduledChangesOf(subscriptionId);
}

async function queueRow(subscriptionId: string) {
    const [row] = await queueRows(subscriptionId);
    return row;
}

async function subscriptionOf(id: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    return row;
}

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-2104 S38 failed rows are counted and stop after N attempts',
    () => {
        it('counts each failure on the row outside the failed transaction (D-4)', async () => {
            const seeded = await seedDue('ACTIVE', new Date('1800-01-01T00:00:00Z'));
            const subscriptionId = seeded.row.predecessor.id;
            const before = await subscriptionOf(subscriptionId);
            const { broken } = failureSpy();
            broken.add(subscriptionId);
            const runClocks = [
                new Date('2026-10-11T13:00:01.000Z'),
                new Date('2026-10-11T13:00:02.000Z')
            ];

            for (const [index, now] of runClocks.entries()) {
                const attempt = index + 1;
                const result = await run(now);
                expect(
                    result.results.filter(
                        (entry) =>
                            entry.subscriptionId === subscriptionId && entry.outcome === 'FAILED'
                    )
                ).toHaveLength(1);
                expect(await queueRow(subscriptionId)).toEqual({
                    ...seeded.change,
                    attemptCount: attempt,
                    lastErrorAt: now,
                    lastError: FAILURE_MESSAGE
                });
                expect(await subscriptionOf(subscriptionId)).toEqual(before);
            }
        });

        it('a row that fails N times is marked and visible', async () => {
            const seeded = await seedDue('ACTIVE', new Date('1800-01-01T00:00:00Z'));
            const subscriptionId = seeded.row.predecessor.id;
            const { broken, spy } = failureSpy();
            broken.add(subscriptionId);
            const start = Date.UTC(2026, 9, 11, 14, 0, 0);
            const callsFor = () =>
                spy.mock.calls.filter(([input]) => input.subscriptionId === subscriptionId).length;

            for (let attempt = 1; attempt <= MAX; attempt += 1)
                await run(new Date(start + attempt * 1000));

            const afterN = {
                ...seeded.change,
                attemptCount: MAX,
                lastErrorAt: new Date(start + MAX * 1000),
                lastError: FAILURE_MESSAGE
            };
            expect(await queueRow(subscriptionId)).toEqual(afterN);
            expect(callsFor()).toBe(MAX);

            const next = await run(new Date(start + (MAX + 1) * 1000));
            expect(callsFor()).toBe(MAX);
            expect(next.results.filter((entry) => entry.subscriptionId === subscriptionId)).toEqual(
                [{ subscriptionId, outcome: 'EXHAUSTED', attemptCount: MAX }]
            );
            expect(next.exhausted).toBeGreaterThanOrEqual(1);
            expect(await queueRow(subscriptionId)).toEqual(afterN);
        });

        it('emits the capture alert exactly once, on the N-th failure', async () => {
            const seeded = await seedDue('ACTIVE', new Date('1800-01-01T00:00:00Z'));
            const subscriptionId = seeded.row.predecessor.id;
            const { broken } = failureSpy();
            broken.add(subscriptionId);
            const start = Date.UTC(2026, 9, 11, 15, 0, 0);
            const alertsFor = () =>
                captured.filter(
                    ({ error }) =>
                        (error as { subscriptionId?: string }).subscriptionId === subscriptionId
                );

            for (let attempt = 1; attempt <= MAX; attempt += 1) {
                await run(new Date(start + attempt * 1000));
                expect(alertsFor()).toHaveLength(attempt === MAX ? 1 : 0);
            }
            await run(new Date(start + (MAX + 1) * 1000));

            const alerts = alertsFor();
            expect(alerts).toHaveLength(1);
            const [alert] = alerts;
            expect(alert?.error).toBeInstanceOf(Error);
            expect(alert?.error).toMatchObject({
                message: EXHAUSTED_MESSAGE,
                scheduledChangeId: seeded.change.id,
                subscriptionId,
                attemptCount: MAX,
                maxAttempts: MAX,
                lastError: FAILURE_MESSAGE
            });
            expect(alert?.extra.label).toBe(EXHAUSTED_MESSAGE);
        });

        it('keeps applying a valid row with limit 1 after two older rows are exhausted', async () => {
            const olderOne = await seedDue('ACTIVE', new Date('1800-01-01T00:00:00Z'));
            const olderTwo = await seedDue('ACTIVE', new Date('1800-01-02T00:00:00Z'));
            const { broken } = failureSpy();
            broken.add(olderOne.row.predecessor.id);
            broken.add(olderTwo.row.predecessor.id);
            const start = Date.UTC(2026, 9, 11, 16, 0, 0);

            for (let attempt = 1; attempt <= MAX; attempt += 1)
                await run(new Date(start + attempt * 1000), 1);

            const valid = await seedDue('ACTIVE', new Date('1800-01-03T00:00:00Z'));
            const next = await run(new Date(start + (MAX + 1) * 1000), 1);
            expect(
                next.results.filter((entry) => entry.subscriptionId === valid.row.predecessor.id)
            ).toEqual([{ subscriptionId: valid.row.predecessor.id, outcome: 'APPLIED' }]);
            expect((await subscriptionOf(valid.row.predecessor.id))?.planVersionId).toBe(
                valid.row.targetPlanVersionId
            );
            expect(await queueRows(valid.row.predecessor.id)).toHaveLength(0);
            expect(await queueRows(olderOne.row.predecessor.id)).toHaveLength(1);
            expect(await queueRows(olderTwo.row.predecessor.id)).toHaveLength(1);
        });

        it('a replacement queue row restarts the attempt counter at zero', async () => {
            const seeded = await seedDue('ACTIVE', new Date('1800-01-01T00:00:00Z'));
            const subscriptionId = seeded.row.predecessor.id;
            const { broken } = failureSpy();
            broken.add(subscriptionId);
            const start = Date.UTC(2026, 9, 11, 17, 0, 0);

            for (let attempt = 1; attempt <= MAX; attempt += 1)
                await run(new Date(start + attempt * 1000));
            expect((await queueRow(subscriptionId))?.attemptCount).toBe(MAX);

            // Declared hand-seeded replacement: mirrors request-plan-change-support.ts:255-257
            // (DELETE + INSERT, new id, defaults).
            await deleteScheduledChanges([subscriptionId]);
            const replacement = await seedScheduledChange({
                subscriptionId,
                effectiveAt: new Date('1800-01-05T00:00:00Z'),
                targetPlanVersionId: seeded.row.targetPlanVersionId,
                targetBillingOptionId: seeded.row.targetBillingOptionId
            });
            expect(replacement.attemptCount).toBe(0);
            expect(replacement.lastErrorAt).toBeNull();
            expect(replacement.lastError).toBeNull();

            broken.delete(subscriptionId);
            const next = await run(new Date(start + (MAX + 1) * 1000));
            expect(
                next.results.filter(
                    (entry) =>
                        entry.subscriptionId === subscriptionId && entry.outcome === 'APPLIED'
                )
            ).toHaveLength(1);
            expect(await queueRows(subscriptionId)).toHaveLength(0);
            expect((await subscriptionOf(subscriptionId))?.planVersionId).toBe(
                seeded.row.targetPlanVersionId
            );
        });

        it('a replaced queue row with a new id does not inherit the failed attempt count', async () => {
            const seeded = await seedDue('ACTIVE', new Date('1800-01-01T00:00:00Z'));
            const subscriptionId = seeded.row.predecessor.id;
            const runNow = new Date('2026-10-11T18:00:00.000Z');
            // The replacement is seeded AFTER `runNow`, so it is not due in this run even
            // while later pages are walked; the counter must still stay untouched.
            const replacementAt = new Date('2026-10-11T19:00:00.000Z');
            const { broken } = failureSpy({
                onBroken: async (id) => {
                    await deleteScheduledChanges([id]);
                    await seedScheduledChange({
                        subscriptionId: id,
                        effectiveAt: replacementAt,
                        targetPlanVersionId: seeded.row.targetPlanVersionId,
                        targetBillingOptionId: seeded.row.targetBillingOptionId
                    });
                }
            });
            broken.add(subscriptionId);

            const result = await run(runNow);
            expect(
                result.results.filter((entry) => entry.subscriptionId === subscriptionId)
            ).toEqual([{ subscriptionId, outcome: 'FAILED' }]);
            const rows = await queueRows(subscriptionId);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.id).not.toBe(seeded.change.id);
            expect(rows[0]?.attemptCount).toBe(0);
            expect(rows[0]?.lastErrorAt).toBeNull();
            expect(rows[0]?.lastError).toBeNull();

            broken.delete(subscriptionId);
            await run(new Date('2026-10-11T20:00:00.000Z'));
            expect((await subscriptionOf(subscriptionId))?.planVersionId).toBe(
                seeded.row.targetPlanVersionId
            );
        });

        it('a queue row deleted between selection and failure recording does not break the run', async () => {
            const brokenRow = await seedDue('ACTIVE', new Date('1800-01-01T00:00:00Z'));
            const valid = await seedDue('ACTIVE', new Date('1800-01-02T00:00:00Z'));
            const subscriptionId = brokenRow.row.predecessor.id;
            const { broken } = failureSpy({
                onBroken: async (id) => {
                    await deleteScheduledChanges([id]);
                }
            });
            broken.add(subscriptionId);

            const result = await run(new Date('2026-10-11T21:00:00.000Z'));

            expect(
                result.results.filter((entry) => entry.subscriptionId === subscriptionId)
            ).toEqual([{ subscriptionId, outcome: 'FAILED' }]);
            expect(await queueRows(subscriptionId)).toHaveLength(0);
            expect(
                result.results.filter(
                    (entry) =>
                        entry.subscriptionId === valid.row.predecessor.id &&
                        entry.outcome === 'APPLIED'
                )
            ).toHaveLength(1);
            expect((await subscriptionOf(valid.row.predecessor.id))?.planVersionId).toBe(
                valid.row.targetPlanVersionId
            );
        });
    }
);
