import { reconciliationSweepRunModel } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runNoticeDeferredCancellationRetry } from '../../../src/services/billing/reconciliation/sweep/notice-deferred-cancellation-retry.js';
import { runOurCancellationRetry } from '../../../src/services/billing/reconciliation/sweep/our-cancellation-retry.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    deferredRetryHarness,
    retryClock,
    retryNow,
    seedDeferredRetryRow,
    seedDeferredRetryTombstone
} from './reconciliation-notice-deferred-retry-fixtures.js';
import {
    resetSeededReconciliationInventory,
    withSeededCancellationRetryInventory
} from './reconciliation-sweep-fixtures.js';

const minute = 60_000;
const day = 24 * 60 * minute;
const input = () => ({ correlationId: crypto.randomUUID(), sweepRunMaxAgeMs: 600_000 });
const fresh = { state: 'SENT' as const, settledAgeMs: 30_000 };

beforeAll(() => getServiceTestDb());
afterAll(closeServiceTestPool);
beforeEach(() => {
    vi.restoreAllMocks();
    resetSeededReconciliationInventory();
});

/** Count calls scoped to one seeded fake authorization. */
function callsFor(
    cancel: { mock: { calls: Array<[input: { authorizationId: string }]> } },
    id: string
) {
    return cancel.mock.calls.filter(([call]) => call.authorizationId === id).length;
}

describe('notice-deferred cancellation retry (HOS-1955)', () => {
    it('TEST:1955:1 rejects a maxRows override above the D-5 provider retry cap', async () => {
        const h = deferredRetryHarness();
        await expect(
            runNoticeDeferredCancellationRetry({ ...input(), maxRows: 11 }, h.ports)
        ).rejects.toThrow();
        expect(h.read).toHaveBeenCalledTimes(0);
        expect(h.cancel).toHaveBeenCalledTimes(0);
    });

    it('TEST:1955:5 waits for S40 notice, then retries with its original kind and default occurrence', async () => {
        const h = deferredRetryHarness();
        const row = await seedDeferredRetryRow({ fake: h.fake, transition: 'S40', pending: true });
        h.notices.set(row.subscription.id, { state: 'PENDING', settledAgeMs: null });
        const first = await withSeededCancellationRetryInventory(() =>
            runNoticeDeferredCancellationRetry(input(), h.ports)
        );
        expect(first).toMatchObject({ noticePending: 1, rowsRead: 0, retried: { confirmed: 0 } });
        expect(callsFor(h.cancel, row.providerId)).toBe(0);
        expect(
            (await h.fake.readAuthorization({ authorizationId: row.providerId })).snapshot.status
        ).toBe('pending');
        h.notices.set(row.subscription.id, fresh);
        const second = await withSeededCancellationRetryInventory(() =>
            runNoticeDeferredCancellationRetry(input(), h.ports)
        );
        expect(second).toMatchObject({ retried: { confirmed: 1 }, rowsRead: 1, rowsFailed: 0 });
        expect(callsFor(h.cancel, row.providerId)).toBe(1);
        expect(
            (await h.fake.readAuthorization({ authorizationId: row.providerId })).snapshot.status
        ).toBe('cancelled');
        expect(h.beforeCancel).toHaveBeenCalledTimes(1);
        expect(h.beforeCancel).toHaveBeenCalledWith({
            subscriptionId: row.subscription.id,
            userId: row.subscription.userId,
            kind: 'ATTEMPT_CANCELLED'
        });
        expect(h.read).toHaveBeenCalledWith({
            subscriptionId: row.subscription.id,
            userId: row.subscription.userId,
            kind: 'ATTEMPT_CANCELLED'
        });
    });

    it('TEST:1955:1 filters and classifies candidates before provider reads, then caps retries', async () => {
        const h = deferredRetryHarness();
        const old = await seedDeferredRetryRow({
            fake: h.fake,
            transition: 'S40',
            decidedAt: new Date(retryNow.getTime() - 4 * day)
        });
        const settled = await seedDeferredRetryRow({ fake: h.fake, transition: 'S40' });
        const absent = await seedDeferredRetryRow({ fake: h.fake, transition: 'S40' });
        const tombstone = await seedDeferredRetryTombstone();
        const undeclared = await seedDeferredRetryRow({ fake: h.fake, transition: 'S22' });
        h.notices.set(old.subscription.id, fresh);
        h.notices.set(settled.subscription.id, { state: 'SENT', settledAgeMs: 2 * 60 * minute });
        const eligible = [];
        for (let i = 0; i < 12; i++) {
            const row = await seedDeferredRetryRow({ fake: h.fake, transition: 'S40' });
            eligible.push(row);
            h.notices.set(row.subscription.id, fresh);
        }
        const result = await withSeededCancellationRetryInventory(() =>
            runNoticeDeferredCancellationRetry({ ...input(), maxRows: 10 }, h.ports)
        );
        expect(result).toMatchObject({
            candidates: 16,
            noRecipient: 1,
            undeclared: 1,
            noticePending: 0,
            noticeAbsent: 1,
            settledLongAgo: 1,
            deferredToNextRun: 2,
            retried: { confirmed: 10 },
            rowsRead: 10,
            rowsFailed: 0
        });
        expect(
            h.read.mock.calls.filter(([request]) => request.subscriptionId === old.subscription.id)
        ).toHaveLength(0);
        expect(
            h.read.mock.calls.filter(([request]) => request.subscriptionId === tombstone.id)
        ).toHaveLength(0);
        expect(
            h.read.mock.calls.filter(
                ([request]) => request.subscriptionId === undeclared.subscription.id
            )
        ).toHaveLength(0);
        for (const row of [old, settled, absent, undeclared])
            expect(callsFor(h.cancel, row.providerId)).toBe(0);
        const callCounts = eligible.map((row) => callsFor(h.cancel, row.providerId));
        expect(callCounts.filter((count) => count === 1)).toHaveLength(10);
        expect(callCounts.filter((count) => count === 0)).toHaveLength(2);
    });

    it('TEST:1955:2 skips a recent open sweep, ignores an old one, and shares idempotence with the sweep pass', async () => {
        const h = deferredRetryHarness();
        const row = await seedDeferredRetryRow({ fake: h.fake, transition: 'S40' });
        h.notices.set(row.subscription.id, fresh);
        const recent = await reconciliationSweepRunModel.open({
            correlationId: crypto.randomUUID(),
            startedAt: new Date(retryNow.getTime() - minute)
        });
        try {
            const skipped = await withSeededCancellationRetryInventory(() =>
                runNoticeDeferredCancellationRetry(input(), h.ports)
            );
            expect(skipped).toMatchObject({ skipped: 'SWEEP_RUNNING', candidates: 0, rowsRead: 0 });
            expect(h.read).not.toHaveBeenCalled();
            expect(callsFor(h.cancel, row.providerId)).toBe(0);
        } finally {
            await reconciliationSweepRunModel.close({
                id: recent.id,
                finishedAt: retryNow,
                rowsRead: 0,
                rowsFailed: 0
            });
        }
        const old = await reconciliationSweepRunModel.open({
            correlationId: crypto.randomUUID(),
            startedAt: new Date(retryNow.getTime() - 20 * minute)
        });
        try {
            const result = await withSeededCancellationRetryInventory(() =>
                runNoticeDeferredCancellationRetry(input(), h.ports)
            );
            expect(result.retried.confirmed).toBe(1);
            expect(callsFor(h.cancel, row.providerId)).toBe(1);
            const sweepPass = await withSeededCancellationRetryInventory(() =>
                runOurCancellationRetry(
                    { correlationId: crypto.randomUUID(), pageSize: 100 },
                    h.ports
                )
            );
            expect(sweepPass.confirmed).toBe(1);
            expect(callsFor(h.cancel, row.providerId)).toBe(1);
        } finally {
            await reconciliationSweepRunModel.close({
                id: old.id,
                finishedAt: retryNow,
                rowsRead: 0,
                rowsFailed: 0
            });
        }
    });

    it('TEST:1955:3 confirms an already-cancelled authorization without calling it again', async () => {
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock: retryClock
        });
        const row = await seedDeferredRetryRow({ fake, transition: 'S40' });
        await fake.cancel({ authorizationId: row.providerId });
        const h = deferredRetryHarness(fake);
        h.notices.set(row.subscription.id, fresh);
        const result = await withSeededCancellationRetryInventory(() =>
            runNoticeDeferredCancellationRetry(input(), h.ports)
        );
        expect(result.retried.confirmed).toBe(1);
        expect(callsFor(h.cancel, row.providerId)).toBe(0);
        expect(h.beforeCancel).not.toHaveBeenCalled();
    });

    it('TEST:1955:4 retries an undeliverable notice despite exhausted mail delivery', async () => {
        const h = deferredRetryHarness();
        const row = await seedDeferredRetryRow({ fake: h.fake, transition: 'S40' });
        h.notices.set(row.subscription.id, { state: 'UNDELIVERABLE', settledAgeMs: minute });
        h.beforeCancel.mockResolvedValue('DELIVERY_EXHAUSTED');
        const result = await withSeededCancellationRetryInventory(() =>
            runNoticeDeferredCancellationRetry(input(), h.ports)
        );
        expect(result.retried.confirmed).toBe(1);
        expect(callsFor(h.cancel, row.providerId)).toBe(1);
        expect(
            (await h.fake.readAuthorization({ authorizationId: row.providerId })).snapshot.status
        ).toBe('cancelled');
    });

    it('TEST:1955:1 counts CALL_FAILED and continues with the next eligible row (D-8)', async () => {
        const h = deferredRetryHarness();
        const rows = [
            await seedDeferredRetryRow({ fake: h.fake, transition: 'S40' }),
            await seedDeferredRetryRow({ fake: h.fake, transition: 'S40' })
        ].sort((left, right) => left.subscription.id.localeCompare(right.subscription.id));
        const [failed, next] = rows;
        if (!failed || !next) throw new Error('Expected two seeded rows');
        h.notices.set(failed.subscription.id, fresh);
        h.notices.set(next.subscription.id, fresh);
        h.cancel.mockImplementation(async (request) => {
            if (request.authorizationId === failed.providerId) {
                throw new Error('Simulated provider refusal');
            }
            return FakePaymentProvider.prototype.cancel.call(h.fake, request);
        });

        const result = await withSeededCancellationRetryInventory(() =>
            runNoticeDeferredCancellationRetry(input(), h.ports)
        );
        expect(result).toMatchObject({
            candidates: 2,
            noRecipient: 0,
            undeclared: 0,
            noticePending: 0,
            noticeAbsent: 0,
            settledLongAgo: 0,
            deferredToNextRun: 0,
            retried: { callFailed: 1, confirmed: 1 },
            rowsRead: 2,
            rowsFailed: 0,
            failures: []
        });
        expect(callsFor(h.cancel, failed.providerId)).toBe(1);
        expect(callsFor(h.cancel, next.providerId)).toBe(1);
        expect(
            (await h.fake.readAuthorization({ authorizationId: failed.providerId })).snapshot.status
        ).toBe('active');
        expect(
            (await h.fake.readAuthorization({ authorizationId: next.providerId })).snapshot.status
        ).toBe('cancelled');
    });
});
