/**
 * Entity Views Purge Job (SPEC-159 T-011)
 *
 * Hard-deletes `entity_views` telemetry rows older than {@link ENTITY_VIEWS_RETENTION_DAYS}
 * days, bounding the append-only table in compliance with GDPR-lite data
 * minimisation principles.
 *
 * **Retention derivation:**
 * Owner decision 2026-11-16 (HOS-2256 OQ-2): 120 days. The widest analytics
 * window the panels show is 90 days (HOS-2261), which leaves 30 days of margin
 * for a nightly cron that did not run. Before that the horizon was 95 days (a
 * 30-day window plus a 65-day buffer, SPEC-159 §5). The same horizon covers
 * `entity_views`, `partner_logo_clicks` and `entity_interactions`. Cost
 * accepted: pseudonymised hashes live 25 days longer.
 *
 * Schedule: Nightly at 3:30 Buenos Aires time — in the existing off-peak maintenance band
 * (03:00–04:00 Buenos Aires time) but 30 minutes after the 3:00 Buenos Aires time batch, avoiding thundering herd.
 *
 * @module cron/jobs/entity-views-purge
 */

import type { CronJobDefinition } from '../types.js';

/**
 * TTL threshold in days for the telemetry tables this job purges.
 *
 * 90-day widest panel window (HOS-2261) + 30-day margin for missed nightly
 * runs = 120 days (owner decision 2026-11-16, HOS-2256 OQ-2).
 */
const ENTITY_VIEWS_RETENTION_DAYS = 120;

/**
 * Entity views purge job definition.
 *
 * Schedule: Daily at 3:30 Buenos Aires time.
 * Purpose: Bound the entity_views append-only telemetry table.
 */
export const entityViewsPurgeJob: CronJobDefinition = {
    name: 'entity-views-purge',
    description: `Purge entity_views, partner_logo_clicks and entity_interactions rows older than ${ENTITY_VIEWS_RETENTION_DAYS} days (GDPR-lite data minimisation)`,
    schedule: '30 3 * * *', // Daily at 3:30 Buenos Aires time
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
            const { entityViewModel, partnerLogoClickModel, entityInteractionModel } = await import(
                '@repo/db'
            );
            const deleted = await entityViewModel.purgeOlderThan({
                days: ENTITY_VIEWS_RETENTION_DAYS
            });

            // `partner_logo_clicks` is purged HERE, on the same horizon, rather
            // than by a second cron (HOS-1063 A-3). It carries the same
            // `visitor_hash` fingerprint and therefore the same data-minimisation
            // obligation, and two crons on the same horizon are two things that
            // can fall out of step. What survives the purge is the monthly
            // rollup, which is exactly why that rollup had to ship with the
            // counting rather than after it.
            const deletedClicks = await partnerLogoClickModel.purgeOlderThan({
                days: ENTITY_VIEWS_RETENTION_DAYS
            });

            // `entity_interactions` (HOS-2256) rides the same cron and horizon for
            // the same reason: one more `visitor_hash` fingerprint, one more
            // thing that must not drift out of step. Its monthly rollup
            // (`view-monthly-rollup`) runs daily at 04:10, long before any row
            // reaches the 120-day horizon.
            const deletedInteractions = await entityInteractionModel.purgeOlderThan({
                days: ENTITY_VIEWS_RETENTION_DAYS
            });

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('Entity views purge job completed', {
                deleted,
                deletedClicks,
                deletedInteractions,
                durationMs
            });

            return {
                success: true,
                message: `Purged ${deleted} entity_views rows ${deletedClicks} partner_logo_clicks rows and ${deletedInteractions} entity_interactions rows older than ${ENTITY_VIEWS_RETENTION_DAYS} days`,
                processed: deleted + deletedClicks + deletedInteractions,
                errors: 0,
                durationMs,
                details: {
                    deleted,
                    deletedClicks,
                    deletedInteractions,
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
