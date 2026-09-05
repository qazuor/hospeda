/**
 * Monthly view/click rollup job (HOS-1063 A-6, OQ-1).
 *
 * Writes one aggregate row per (entity, month) into
 * `entity_view_monthly_rollups` and `partner_logo_click_monthly_rollups` before
 * the 95-day purge destroys the events they summarise.
 *
 * ## Why this exists at all
 *
 * `entity-views-purge.job.ts` deletes at `ENTITY_VIEWS_RETENTION_DAYS = 95` and
 * what it deletes cannot be reconstructed. Without a rollup, the question "how
 * did last season go?" has no answer, forever — and the decision to have no
 * answer would have been made by a cron rather than by the owner (R-4). The
 * rollup is the cheapest way to keep that choice open. Whether the panel ever
 * renders a per-month view is a UI decision that can be made at any time
 * PRECISELY BECAUSE this job kept the data: the UI is reversible, the deletion
 * is not.
 *
 * ## Why it rolls up TWO months, not one
 *
 * The obvious implementation rolls up "last month" on the 1st. That is one
 * missed run away from a permanent hole, because next month's run does not look
 * back far enough to notice. So each run rewrites BOTH the previous month and
 * the current month-to-date. Rewriting is safe: both writers are
 * `INSERT … ON CONFLICT DO UPDATE` keyed on (entity, month), so a re-run
 * CORRECTS a month instead of doubling it.
 *
 * That also makes the current month readable while it is still in progress,
 * which costs nothing extra and removes the "the newest month is missing until
 * the 1st" edge the panel would otherwise have to explain.
 *
 * ## Why it runs on the 1st AND daily
 *
 * Daily at 04:10 UTC — inside the off-peak maintenance band, after the 03:30
 * purge. A month can only be rolled up while its rows still exist, and the purge
 * is the thing that removes them; running daily means the longest a month can go
 * un-summarised is one day, against a 95-day horizon. A monthly schedule would
 * make a single failed run at the wrong moment unrecoverable, which is the exact
 * failure mode the job exists to prevent.
 *
 * @module cron/jobs/view-monthly-rollup
 */

import type { CronJobDefinition } from '../types.js';

/**
 * Returns the first instant of the month `monthsAgo` months before `from`.
 *
 * Built with `Date.UTC` rather than by mutating a `Date`: `setMonth` on the 31st
 * of a month rolls forward into the next one (31 March minus one month is 3
 * March, not February), which would silently roll up the wrong month on seven
 * days of the year.
 */
function monthAnchor({ from, monthsAgo }: { from: Date; monthsAgo: number }): Date {
    return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - monthsAgo, 1, 12, 0, 0));
}

/**
 * Monthly rollup job definition.
 *
 * Schedule: daily at 04:10 UTC (after the 03:30 purge, inside the maintenance band).
 */
export const viewMonthlyRollupJob: CronJobDefinition = {
    name: 'view-monthly-rollup',
    description:
        'Aggregate entity_views and partner_logo_clicks into their monthly rollups, so the 95-day purge does not destroy history',
    schedule: '10 4 * * *',
    enabled: true,
    timeoutMs: 120_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        const months = [
            monthAnchor({ from: startedAt, monthsAgo: 1 }),
            monthAnchor({ from: startedAt, monthsAgo: 0 })
        ];

        logger.info('Starting monthly view rollup job', {
            dryRun,
            months: months.map((m) => m.toISOString()),
            startedAt: startedAt.toISOString()
        });

        if (dryRun) {
            logger.info('Dry run mode - skipping actual rollup');
            return {
                success: true,
                message: 'Dry run - no rollups written',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }

        try {
            // Lazy import keeps the singletons out of the module top-level,
            // preventing Vitest fork contamination when tests mock @repo/db.
            const { entityViewModel, partnerLogoClickModel } = await import('@repo/db');

            let viewRows = 0;
            let clickRows = 0;

            for (const month of months) {
                viewRows += await entityViewModel.rollUpMonth({ month });
                clickRows += await partnerLogoClickModel.rollUpMonth({ month });
            }

            const durationMs = Date.now() - startedAt.getTime();
            const processed = viewRows + clickRows;

            logger.info('Monthly view rollup job completed', {
                viewRows,
                clickRows,
                durationMs
            });

            return {
                success: true,
                message: `Rolled up ${viewRows} entity-view rows and ${clickRows} logo-click rows across ${months.length} months`,
                processed,
                errors: 0,
                durationMs,
                details: {
                    viewRows,
                    clickRows,
                    months: months.map((m) => m.toISOString())
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            logger.error('Monthly view rollup job failed', {
                error: errorMessage,
                stack: errorStack
            });

            return {
                success: false,
                message: `Monthly view rollup failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: errorMessage, stack: errorStack }
            };
        }
    }
};
