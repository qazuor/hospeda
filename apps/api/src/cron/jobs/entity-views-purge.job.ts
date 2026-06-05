/**
 * Entity Views Purge Job (SPEC-159 T-011)
 *
 * Hard-deletes `entity_views` telemetry rows older than {@link ENTITY_VIEWS_RETENTION_DAYS}
 * days, bounding the append-only table in compliance with GDPR-lite data
 * minimisation principles.
 *
 * **Retention derivation:**
 * The widest analytics window exposed via the API is 30 days (SPEC-159 §5).
 * A 65-day buffer is added so the cron can miss several nightly runs without
 * silently truncating any live analytics window. 30 + 65 = 95 days.
 *
 * Schedule: Nightly at 3:30 UTC — in the existing off-peak maintenance band
 * (3–4 UTC) but 30 minutes after the 3:00 UTC batch, avoiding thundering herd.
 *
 * @module cron/jobs/entity-views-purge
 */

import type { CronJobDefinition } from '../types.js';

/**
 * TTL threshold in days for `entity_views` rows.
 *
 * Derived from: 30-day widest analytics window (SPEC-159 §5)
 * + 65-day operational buffer to survive missed nightly runs
 * = 95 days total.
 */
const ENTITY_VIEWS_RETENTION_DAYS = 95;

/**
 * Entity views purge job definition.
 *
 * Schedule: Daily at 3:30 UTC.
 * Purpose: Bound the entity_views append-only telemetry table.
 */
export const entityViewsPurgeJob: CronJobDefinition = {
    name: 'entity-views-purge',
    description: `Purge entity_views rows older than ${ENTITY_VIEWS_RETENTION_DAYS} days (GDPR-lite data minimisation)`,
    schedule: '30 3 * * *', // Daily at 3:30 UTC
    enabled: true,
    timeoutMs: 120_000, // 2 minutes — table can grow large; allow for bulk deletes

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting entity views purge job', {
            dryRun,
            retentionDays: ENTITY_VIEWS_RETENTION_DAYS,
            startedAt: startedAt.toISOString()
        });

        if (dryRun) {
            logger.info('Dry run mode - skipping actual purge');
            return {
                success: true,
                message: 'Dry run - no records purged',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }

        try {
            // Lazy import keeps the singleton out of the module top-level, preventing
            // Vitest fork contamination when tests partially mock @repo/db.
            const { entityViewModel } = await import('@repo/db');
            const deleted = await entityViewModel.purgeOlderThan({
                days: ENTITY_VIEWS_RETENTION_DAYS
            });

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('Entity views purge job completed', { deleted, durationMs });

            return {
                success: true,
                message: `Purged ${deleted} entity_views rows older than ${ENTITY_VIEWS_RETENTION_DAYS} days`,
                processed: deleted,
                errors: 0,
                durationMs,
                details: {
                    deleted,
                    retentionDays: ENTITY_VIEWS_RETENTION_DAYS
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            logger.error('Entity views purge job failed', {
                error: errorMessage,
                stack: errorStack
            });

            return {
                success: false,
                message: `Entity views purge failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: errorMessage, stack: errorStack }
            };
        }
    }
};
