/**
 * Search Index Refresh Cron Job
 *
 * Refreshes the `search_index` materialized view so full-text search
 * results stay up-to-date with recently created or updated content.
 *
 * Schedule: Every 6 hours (0 *​/6 * * *)
 * The materialized view is refreshed CONCURRENTLY so reads are not blocked.
 *
 * @module cron/jobs/search-index-refresh
 */

import { getDb } from '@repo/db';
import { sql } from 'drizzle-orm';
import type { CronJobDefinition } from '../types.js';

/**
 * Search index refresh cron job definition
 *
 * Schedule: Every 6 hours
 * Purpose: Keep the search_index materialized view current
 */
export const searchIndexRefreshJob: CronJobDefinition = {
    name: 'search-index-refresh',
    description: 'Refresh the search_index materialized view for full-text search',
    schedule: '0 */6 * * *',
    enabled: true,
    timeoutMs: 120_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting search index refresh', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        if (dryRun) {
            const durationMs = Date.now() - startedAt.getTime();
            return {
                success: true,
                message: 'Dry run - Would refresh search_index materialized view',
                processed: 0,
                errors: 0,
                durationMs,
                details: { dryRun: true }
            };
        }

        try {
            const db = getDb();
            await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY search_index`);

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('Search index refresh completed', { durationMs });

            return {
                success: true,
                message: `Successfully refreshed search_index materialized view in ${durationMs}ms`,
                processed: 1,
                errors: 0,
                durationMs
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            logger.error('Search index refresh failed', {
                error: errorMessage,
                stack: errorStack
            });

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Failed to refresh search_index: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs,
                details: { error: errorMessage, stack: errorStack }
            };
        }
    }
};
