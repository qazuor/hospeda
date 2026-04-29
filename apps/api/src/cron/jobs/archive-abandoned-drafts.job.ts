/**
 * Archive Abandoned Drafts Cron Job
 *
 * Cleans up host onboarding drafts that have been left untouched for too long.
 * Two phases run on every invocation:
 *
 * 1. Warning phase (~24 days of inactivity): pick up DRAFT accommodations whose
 *    `updated_at` falls in the [WARNING_THRESHOLD, ARCHIVE_THRESHOLD) window AND
 *    whose `last_warned_at` is still NULL. Stamp `last_warned_at = NOW()` and
 *    emit a structured log entry per row so the notification layer can hook up
 *    a real email template later without touching this job.
 *
 * 2. Archive phase (>30 days of inactivity): pick up DRAFT accommodations whose
 *    `updated_at` is older than ARCHIVE_THRESHOLD and flip them to
 *    `lifecycleState = 'ARCHIVED'`. The drafts are NOT hard-deleted so an owner
 *    who comes back can be redirected to support to restore them; the archive
 *    decision is auditable through the standard `updated_at` change.
 *
 * Schedule: daily at 3 AM (just after `trial-expiry` at 2 AM).
 *
 * Concurrency: a transaction-level advisory lock (43030) prevents overlapping
 * runs across API replicas, matching the pattern used by
 * `archive-expired-promotions`.
 *
 * @module cron/jobs/archive-abandoned-drafts
 */

import { accommodations, and, eq, isNull, lt, lte, sql, withTransaction } from '@repo/db';
import { LifecycleStatusEnum } from '@repo/schemas';
import * as Sentry from '@sentry/node';
import { inArray } from 'drizzle-orm';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition } from '../types.js';

const ADVISORY_LOCK_ID = 43030;
const LOG_SOURCE = 'cron:archive-abandoned-drafts';

/** Drafts older than this get archived. Spec: 30 days of inactivity. */
const ARCHIVE_THRESHOLD_DAYS = 30;
/** Drafts older than this AND not yet warned get a 7-day-before-archive warning. */
const WARNING_THRESHOLD_DAYS = 23;

/** Hard cap on rows processed per phase per run, to keep the transaction short. */
const BATCH_LIMIT = 100;

const safeReportToSentry = (
    error: unknown,
    context: Parameters<typeof Sentry.captureException>[1]
): void => {
    try {
        Sentry.captureException(error, context);
    } catch (sentryError) {
        const sentryMessage =
            sentryError instanceof Error ? sentryError.message : String(sentryError);
        apiLogger.warn(
            `Sentry.captureException failed in cron handler; original error preserved (sentry: ${sentryMessage})`
        );
    }
};

type CronTransactionResult =
    | { readonly skipped: true }
    | {
          readonly skipped: false;
          readonly dryRun: boolean;
          readonly warned: number;
          readonly archived: number;
      };

export const archiveAbandonedDraftsJob: CronJobDefinition = {
    name: 'archive-abandoned-drafts',
    description:
        'Warn at 23d and archive at 30d host-onboarding DRAFT accommodations that the owner has stopped editing',
    schedule: '0 3 * * *',
    enabled: true,
    timeoutMs: 60_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting archive-abandoned-drafts job', {
            source: LOG_SOURCE,
            dryRun,
            startedAt: startedAt.toISOString()
        });

        try {
            const result = await withTransaction<CronTransactionResult>(async (tx) => {
                const lockResult = await tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_ID}) as acquired`
                );
                const lockRow = lockResult.rows?.[0] as Record<string, unknown> | undefined;
                const acquired = lockRow?.acquired;

                if (!lockRow || typeof acquired !== 'boolean') {
                    throw new Error(
                        `archive-abandoned-drafts: pg_try_advisory_xact_lock returned malformed result (rows=${JSON.stringify(lockResult.rows)})`
                    );
                }

                if (!acquired) {
                    return { skipped: true };
                }

                await tx.execute(sql`SET LOCAL statement_timeout = '60000'`);

                const archiveCutoff = sql`NOW() - INTERVAL '${sql.raw(String(ARCHIVE_THRESHOLD_DAYS))} days'`;
                const warningCutoff = sql`NOW() - INTERVAL '${sql.raw(String(WARNING_THRESHOLD_DAYS))} days'`;

                // ── Warning phase ──────────────────────────────────────────────
                // Drafts in [WARNING_THRESHOLD, ARCHIVE_THRESHOLD) that have NOT
                // been warned yet. We stamp `last_warned_at` here so each draft
                // is warned at most once.
                const warningCandidates = await tx
                    .select({
                        id: accommodations.id,
                        ownerId: accommodations.ownerId,
                        slug: accommodations.slug,
                        updatedAt: accommodations.updatedAt
                    })
                    .from(accommodations)
                    .where(
                        and(
                            eq(accommodations.lifecycleState, LifecycleStatusEnum.DRAFT),
                            isNull(accommodations.deletedAt),
                            isNull(accommodations.lastWarnedAt),
                            lte(accommodations.updatedAt, warningCutoff),
                            // Not yet old enough to archive; the archive phase below
                            // catches those. This guarantees a draft can only be in
                            // ONE of the two phases per run.
                            sql`${accommodations.updatedAt} > ${archiveCutoff}`
                        )
                    )
                    .limit(BATCH_LIMIT);

                // ── Archive phase ──────────────────────────────────────────────
                const archiveCandidates = await tx
                    .select({
                        id: accommodations.id,
                        ownerId: accommodations.ownerId,
                        slug: accommodations.slug,
                        updatedAt: accommodations.updatedAt
                    })
                    .from(accommodations)
                    .where(
                        and(
                            eq(accommodations.lifecycleState, LifecycleStatusEnum.DRAFT),
                            isNull(accommodations.deletedAt),
                            lt(accommodations.updatedAt, archiveCutoff)
                        )
                    )
                    .limit(BATCH_LIMIT);

                if (dryRun) {
                    logger.info('Dry run mode - would warn and archive abandoned drafts', {
                        source: LOG_SOURCE,
                        wouldWarn: warningCandidates.length,
                        wouldArchive: archiveCandidates.length
                    });
                    return {
                        skipped: false,
                        dryRun: true,
                        warned: warningCandidates.length,
                        archived: archiveCandidates.length
                    };
                }

                // Apply the warning stamp first. The actual email dispatch is a
                // best-effort log entry today; once a NotificationService template
                // exists, hook it up here without touching the schema.
                if (warningCandidates.length > 0) {
                    const warningIds = warningCandidates.map((row) => row.id);
                    await tx
                        .update(accommodations)
                        .set({ lastWarnedAt: new Date() })
                        .where(inArray(accommodations.id, warningIds));

                    for (const row of warningCandidates) {
                        logger.info('Draft abandonment warning issued', {
                            source: LOG_SOURCE,
                            event: 'draft_abandoned_warning',
                            accommodationId: row.id,
                            ownerId: row.ownerId,
                            slug: row.slug,
                            inactiveSince: row.updatedAt.toISOString()
                        });
                    }
                }

                if (archiveCandidates.length > 0) {
                    const archiveIds = archiveCandidates.map((row) => row.id);
                    await tx
                        .update(accommodations)
                        .set({
                            lifecycleState: LifecycleStatusEnum.ARCHIVED,
                            updatedAt: new Date(),
                            updatedById: null
                        })
                        .where(inArray(accommodations.id, archiveIds));

                    logger.info('Archived abandoned drafts', {
                        source: LOG_SOURCE,
                        event: 'drafts_archived',
                        count: archiveIds.length,
                        ids: archiveIds
                    });
                }

                return {
                    skipped: false,
                    dryRun: false,
                    warned: warningCandidates.length,
                    archived: archiveCandidates.length
                };
            });

            const durationMs = Date.now() - startedAt.getTime();

            if (result.skipped) {
                apiLogger.warn(
                    'archive-abandoned-drafts cron: skipping — previous run still holds advisory lock'
                );
                return {
                    success: true,
                    message: 'Skipped: previous run still active (advisory lock not acquired)',
                    processed: 0,
                    errors: 0,
                    durationMs,
                    details: { skipped: true, reason: 'lock_not_acquired' }
                };
            }

            const processed = result.warned + result.archived;

            if (result.dryRun) {
                return {
                    success: true,
                    message: `Dry run: would warn ${result.warned} and archive ${result.archived} abandoned drafts`,
                    processed,
                    errors: 0,
                    durationMs,
                    details: {
                        dryRun: true,
                        wouldWarn: result.warned,
                        wouldArchive: result.archived
                    }
                };
            }

            return {
                success: true,
                message: `Warned ${result.warned} and archived ${result.archived} abandoned drafts`,
                processed,
                errors: 0,
                durationMs,
                details: {
                    warned: result.warned,
                    archived: result.archived
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            safeReportToSentry(error, {
                tags: { cronJob: 'archive-abandoned-drafts', phase: 'top-level' }
            });

            apiLogger.error(
                `archive-abandoned-drafts cron failed (source=${LOG_SOURCE}): ${errorMessage}${errorStack ? `\n${errorStack}` : ''}`
            );

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs,
                details: { error: errorMessage }
            };
        }
    }
};
