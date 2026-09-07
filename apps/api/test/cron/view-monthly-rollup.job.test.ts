/**
 * HOS-1063 A-6 — the monthly rollup job.
 *
 * This job exists because the 95-day purge decides "do we keep history?" on the
 * owner's behalf and irreversibly (R-4). The properties tested here are the ones
 * that make it actually do that, rather than merely appear to:
 *
 * - **AC-17: the rollup is not scoped to PARTNER.** A rollup that silently
 *   covered one entity type is indistinguishable from a correct one when only
 *   that type is tested, so the assertion is a STATIC one over the SQL — the
 *   only place the absence of a filter is visible. A behavioural test with a
 *   mocked model cannot see it: the mock returns whatever it is told to.
 * - **Two months per run.** The obvious implementation rolls up "last month" on
 *   the 1st and is one missed run away from a permanent hole, because the next
 *   run does not look back far enough to notice.
 * - **Month arithmetic that survives the 31st.** `setMonth` on 31 March minus
 *   one month yields 3 March, not February — which would roll up the wrong month
 *   on seven days of the year.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rollUpViews = vi.fn();
const rollUpClicks = vi.fn();

vi.mock('@repo/db', () => ({
    entityViewModel: { rollUpMonth: (...args: unknown[]) => rollUpViews(...args) },
    partnerLogoClickModel: { rollUpMonth: (...args: unknown[]) => rollUpClicks(...args) }
}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_FILE = path.resolve(
    __dirname,
    '../../../../packages/db/src/models/entity-view/entity-view.model.ts'
);

const makeCtx = (startedAt: Date, dryRun = false) => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    startedAt,
    dryRun
});

describe('view-monthly-rollup job', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rollUpViews.mockResolvedValue(3);
        rollUpClicks.mockResolvedValue(2);
    });

    it('rolls up the PREVIOUS month and the CURRENT month on every run', async () => {
        // Arrange
        const { viewMonthlyRollupJob } = await import(
            '../../src/cron/jobs/view-monthly-rollup.job'
        );

        // Act — 14 August 2026
        const result = await viewMonthlyRollupJob.handler(
            makeCtx(new Date('2026-08-14T04:10:00.000Z')) as never
        );

        // Assert — July AND August, for BOTH tables.
        expect(rollUpViews).toHaveBeenCalledTimes(2);
        expect(rollUpClicks).toHaveBeenCalledTimes(2);

        const months = rollUpViews.mock.calls.map((c) =>
            (c[0] as { month: Date }).month.toISOString().slice(0, 7)
        );
        expect(months).toEqual(['2026-07', '2026-08']);
        expect(result.success).toBe(true);
        expect(result.processed).toBe(10); // (3 + 2) per month, two months
    });

    /**
     * The regression this arithmetic exists for. On 31 March, naive
     * `date.setMonth(date.getMonth() - 1)` produces 3 March — so the job would
     * roll March up twice and never roll February up at all, on a day nobody
     * tests.
     */
    it('resolves the previous month correctly on the 31st of a long month', async () => {
        const { viewMonthlyRollupJob } = await import(
            '../../src/cron/jobs/view-monthly-rollup.job'
        );

        await viewMonthlyRollupJob.handler(makeCtx(new Date('2026-03-31T04:10:00.000Z')) as never);

        const months = rollUpViews.mock.calls.map((c) =>
            (c[0] as { month: Date }).month.toISOString().slice(0, 7)
        );
        expect(months).toEqual(['2026-02', '2026-03']);
    });

    it('crosses the year boundary correctly in January', async () => {
        const { viewMonthlyRollupJob } = await import(
            '../../src/cron/jobs/view-monthly-rollup.job'
        );

        await viewMonthlyRollupJob.handler(makeCtx(new Date('2026-01-05T04:10:00.000Z')) as never);

        const months = rollUpViews.mock.calls.map((c) =>
            (c[0] as { month: Date }).month.toISOString().slice(0, 7)
        );
        expect(months).toEqual(['2025-12', '2026-01']);
    });

    it('writes nothing in dry-run mode', async () => {
        const { viewMonthlyRollupJob } = await import(
            '../../src/cron/jobs/view-monthly-rollup.job'
        );

        const result = await viewMonthlyRollupJob.handler(
            makeCtx(new Date('2026-08-14T04:10:00.000Z'), true) as never
        );

        expect(rollUpViews).not.toHaveBeenCalled();
        expect(rollUpClicks).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
    });

    it('reports failure instead of throwing when a rollup write fails', async () => {
        const { viewMonthlyRollupJob } = await import(
            '../../src/cron/jobs/view-monthly-rollup.job'
        );
        rollUpViews.mockRejectedValueOnce(new Error('deadlock detected'));

        const result = await viewMonthlyRollupJob.handler(
            makeCtx(new Date('2026-08-14T04:10:00.000Z')) as never
        );

        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
    });

    it('runs AFTER the purge in the same maintenance band', async () => {
        const { viewMonthlyRollupJob } = await import(
            '../../src/cron/jobs/view-monthly-rollup.job'
        );
        const { entityViewsPurgeJob } = await import('../../src/cron/jobs/entity-views-purge.job');

        // A month can only be rolled up while its rows still exist, and the
        // purge is what removes them. Ordering them the other way round would
        // delete a month moments before summarising it.
        const minutes = (schedule: string) => {
            const [min, hour] = schedule.split(' ');
            return Number(hour) * 60 + Number(min);
        };
        expect(minutes(viewMonthlyRollupJob.schedule)).toBeGreaterThan(
            minutes(entityViewsPurgeJob.schedule)
        );
    });
});

describe('HOS-1063 AC-17 — the rollup covers EVERY trackable entity type', () => {
    /**
     * Asserted statically over the SQL rather than behaviourally, because a
     * mocked model returns what it is told and cannot reveal an omitted WHERE
     * clause. A partner-only rollup would be a table that silently returns zeros
     * the first time anyone reads it for accommodations — and it would pass any
     * test that only seeds partners.
     */
    it('the rollUpMonth SQL filters by month and NOT by entity_type', () => {
        const source = readFileSync(MODEL_FILE, 'utf-8');
        const start = source.indexOf('async rollUpMonth');
        expect(start).toBeGreaterThan(-1);

        const body = source.slice(start, source.indexOf('async purgeOlderThan', start));

        // It writes into the rollup table, grouped by entity_type…
        expect(body).toContain('INSERT INTO entity_view_monthly_rollups');
        expect(body).toContain('GROUP BY');
        // …and its WHERE clause mentions only the month, never a type.
        expect(body).not.toMatch(/WHERE[\s\S]*entity_type\s*=/);
        expect(body).not.toContain("'PARTNER'");
    });

    /**
     * The idempotency the retry story depends on. Without ON CONFLICT DO UPDATE
     * the daily re-run of the current month would append a second row per entity
     * per month — or, with the unique index in place, fail outright every day
     * after the first.
     */
    it('the rollUpMonth SQL is an idempotent upsert', () => {
        const source = readFileSync(MODEL_FILE, 'utf-8');
        const start = source.indexOf('async rollUpMonth');
        const body = source.slice(start, source.indexOf('async purgeOlderThan', start));

        expect(body).toContain('ON CONFLICT (entity_type, entity_id, month) DO UPDATE');
    });
});
