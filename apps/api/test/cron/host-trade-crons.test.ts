/**
 * The three host-trade crons (HOS-376 T-042, T-043, T-044 — covered by T-066).
 *
 * Each one is tested for the property that makes it worth having, not for the
 * fact that it runs:
 *
 * - EXPIRY notifies nobody. Silence is not an accusation (§6.6), and a mail
 *   announcing that nothing happened would turn a neutral timeout into a
 *   reproach about a record that never counted.
 * - THE REMINDER stamps AFTER it sends, and only stamps what it sent. The stamp
 *   is the idempotency (AC-8): without it the same row is chased every morning
 *   until it expires.
 * - RECONCILIATION reports what it corrected. A repair nobody can read is a bug
 *   that stays, and drift is the only evidence that a write path has a hole.
 *
 * @module test/cron/host-trade-crons
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExpire, mockListRemindable, mockMarkReminded, mockNotifyReminder, mockReconcile } =
    vi.hoisted(() => ({
        mockExpire: vi.fn(),
        mockListRemindable: vi.fn(),
        mockMarkReminded: vi.fn(),
        mockNotifyReminder: vi.fn(),
        mockReconcile: vi.fn()
    }));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeUsageService: vi.fn().mockImplementation(function () {
            return {
                expireOverdueUsages: mockExpire,
                listRemindableUsages: mockListRemindable,
                markReminderSent: mockMarkReminded
            };
        }),
        reconcileAllHostTradeAggregates: mockReconcile
    };
});

vi.mock('../../src/lib/host-trade-notifications.js', () => ({
    notifyUsageReminder: mockNotifyReminder
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { hostTradeUsageExpiryJob } = await import(
    '../../src/cron/jobs/host-trade-usage-expiry.job.js'
);
const { hostTradeUsageReminderJob } = await import(
    '../../src/cron/jobs/host-trade-usage-reminder.job.js'
);
const { hostTradeStatsReconcileJob } = await import(
    '../../src/cron/jobs/host-trade-stats-reconcile.job.js'
);

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

const runCtx = (dryRun = false) =>
    ({ logger, startedAt: new Date(), dryRun }) as unknown as Parameters<
        typeof hostTradeUsageExpiryJob.handler
    >[0];

beforeEach(() => {
    vi.clearAllMocks();
    mockExpire.mockResolvedValue({ expired: 3 });
    mockListRemindable.mockResolvedValue({ items: [] });
    mockMarkReminded.mockResolvedValue(undefined);
    mockNotifyReminder.mockResolvedValue(undefined);
    mockReconcile.mockResolvedValue({ checked: 10, corrected: [] });
});

describe('host-trade-usage-expiry', () => {
    it('expires the overdue rows and reports how many', async () => {
        const result = await hostTradeUsageExpiryJob.handler(runCtx());

        expect(result.success).toBe(true);
        expect(result.processed).toBe(3);
        expect(mockExpire).toHaveBeenCalled();
    });

    /** §6.6 — the silence that expires a row must not be announced. */
    it('notifies nobody', async () => {
        await hostTradeUsageExpiryJob.handler(runCtx());

        expect(mockNotifyReminder).not.toHaveBeenCalled();
    });

    it('writes nothing on a dry run', async () => {
        const result = await hostTradeUsageExpiryJob.handler(runCtx(true));

        expect(result.success).toBe(true);
        expect(mockExpire).not.toHaveBeenCalled();
    });

    it('reports a failure rather than throwing', async () => {
        mockExpire.mockRejectedValue(new Error('db down'));

        const result = await hostTradeUsageExpiryJob.handler(runCtx());

        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
    });
});

describe('host-trade-usage-reminder', () => {
    const usage = (id: string) => ({ id, hostTradeId: 'ht', hostUserId: 'host' });

    it('sends one reminder per candidate and stamps each', async () => {
        mockListRemindable.mockResolvedValue({ items: [usage('a'), usage('b')] });

        const result = await hostTradeUsageReminderJob.handler(runCtx());

        expect(result.processed).toBe(2);
        expect(mockNotifyReminder).toHaveBeenCalledTimes(2);
        expect(mockMarkReminded).toHaveBeenCalledWith({ usageId: 'a' });
        expect(mockMarkReminded).toHaveBeenCalledWith({ usageId: 'b' });
    });

    /**
     * AC-8. The stamp is what makes a second run send nothing — the query that
     * feeds this job excludes stamped rows, so a job that sent without stamping
     * would chase the same person every morning until the row expired.
     */
    it('stamps only after the send succeeds', async () => {
        const order: string[] = [];
        mockListRemindable.mockResolvedValue({ items: [usage('a')] });
        mockNotifyReminder.mockImplementation(async () => {
            order.push('sent');
        });
        mockMarkReminded.mockImplementation(async () => {
            order.push('stamped');
        });

        await hostTradeUsageReminderJob.handler(runCtx());

        expect(order).toEqual(['sent', 'stamped']);
    });

    /**
     * A send that failed must NOT be stamped: leaving the row unstamped is what
     * makes tomorrow's run retry it. Stamping regardless would turn a transient
     * outage into a reminder nobody ever gets.
     */
    it('leaves a failed send unstamped so tomorrow retries it', async () => {
        mockListRemindable.mockResolvedValue({ items: [usage('a')] });
        mockNotifyReminder.mockRejectedValue(new Error('smtp down'));

        const result = await hostTradeUsageReminderJob.handler(runCtx());

        expect(mockMarkReminded).not.toHaveBeenCalled();
        expect(result.errors).toBe(1);
    });

    /** One unreachable recipient must not cost the rest their reminder. */
    it('keeps going after one failure', async () => {
        mockListRemindable.mockResolvedValue({ items: [usage('a'), usage('b')] });
        mockNotifyReminder.mockRejectedValueOnce(new Error('smtp down'));

        const result = await hostTradeUsageReminderJob.handler(runCtx());

        expect(mockNotifyReminder).toHaveBeenCalledTimes(2);
        expect(result.processed).toBe(1);
        expect(result.errors).toBe(1);
    });

    it('sends nothing on a dry run', async () => {
        mockListRemindable.mockResolvedValue({ items: [usage('a')] });

        const result = await hostTradeUsageReminderJob.handler(runCtx(true));

        expect(mockNotifyReminder).not.toHaveBeenCalled();
        expect(mockMarkReminded).not.toHaveBeenCalled();
        expect(result.details).toMatchObject({ wouldRemind: 1 });
    });
});

describe('host-trade-stats-reconcile', () => {
    it('reports a clean week without warning about anything', async () => {
        const result = await hostTradeStatsReconcileJob.handler(runCtx());

        expect(result.success).toBe(true);
        expect(result.processed).toBe(10);
        expect(logger.warn).not.toHaveBeenCalled();
    });

    /**
     * AC-29. Drift is the finding — it means one of the synchronous write paths
     * has a hole — so a corrected counter that nobody can read is worse than
     * useless.
     */
    it('warns with the detail of every listing it corrected', async () => {
        mockReconcile.mockResolvedValue({
            checked: 10,
            corrected: [
                {
                    hostTradeId: 'ht-1',
                    stored: { confirmedUsesCount: 37 },
                    recomputed: { confirmedUsesCount: 36 }
                }
            ]
        });

        const result = await hostTradeStatsReconcileJob.handler(runCtx());

        expect(logger.warn).toHaveBeenCalled();
        const [, payload] = logger.warn.mock.calls[0] as [string, Record<string, unknown>];
        expect(JSON.stringify(payload)).toContain('ht-1');
        expect(result.details).toMatchObject({ checked: 10 });
    });

    it('passes the dry-run flag through so nothing is written', async () => {
        await hostTradeStatsReconcileJob.handler(runCtx(true));

        expect(mockReconcile).toHaveBeenCalledWith({ dryRun: true });
    });
});
