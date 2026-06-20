/**
 * Refresh External Reputation Cron Job (SPEC-237 T-011)
 *
 * Weekly batch job that refreshes cached reputation data (ratings, review
 * counts, Google Places snippets) for every accommodation that has at least one
 * external listing with `showReviews=true` OR `showLink=true`.
 *
 * Features:
 * - Iterates all enabled external listings grouped by accommodationId.
 * - Prioritises accommodations whose Google snippet is about to expire
 *   (`snippetsFetchedAt` is null or within 5 days of the configured TTL).
 * - Bypasses the per-owner rate limit (the job itself throttles the batch).
 * - Tolerates per-accommodation failures — logs and continues.
 * - dry-run support (logs what would be refreshed without calling adapters).
 *
 * Schedule: read from env `HOSPEDA_EXTREP_CRON_SCHEDULE` (default `'0 2 * * 1'`).
 *
 * @module cron/jobs/refresh-external-reputation
 */

import {
    AccommodationExternalListingModel,
    AccommodationExternalReputationModel,
    AccommodationModel
} from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { AccommodationExternalReputationService } from '@repo/service-core';
import type { Actor } from '@repo/service-core';
import { getReputationAdapterCredentials } from '../../utils/reputation-credentials.js';
import type { CronJobDefinition } from '../types.js';
import {
    getEnabledAccommodationIds,
    getGoogleSnippetTimestamps
} from './refresh-external-reputation.queries.js';

/**
 * Default cron schedule for the external reputation refresh job.
 * Every Monday at 02:00 UTC.
 */
const DEFAULT_CRON_SCHEDULE = '0 2 * * 1';

// ---------------------------------------------------------------------------
// System actor used for cron-initiated refreshes.
// Holds ACCOMMODATION_UPDATE_ANY so the service's ownership check passes for
// every accommodation without loading the owning user from the DB.
// ---------------------------------------------------------------------------

/**
 * Minimal system actor for the external reputation refresh job.
 * Only the permissions required by the refresh() path are included.
 */
const CRON_SYSTEM_ACTOR: Actor = {
    id: '00000000-0000-0000-0000-000000000002',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY] as readonly PermissionEnum[]
} as const;

// ---------------------------------------------------------------------------
// Helper: sort accommodation IDs by Google TTL urgency
// ---------------------------------------------------------------------------

/**
 * Sorts accommodation IDs so that the most urgent (Google snippet about to
 * expire or never fetched) are processed first.
 *
 * Priority order:
 * 1. `snippetsFetchedAt === null` (never fetched) — highest priority
 * 2. `(now - snippetsFetchedAt) > (ttlDays - 5) * 86400_000` — expiring soon
 * 3. All others — lowest priority
 *
 * @param ids - Array of accommodation IDs to sort (mutated in place).
 * @param timestamps - Map of accommodationId → Google snippetsFetchedAt.
 * @param ttlDays - Configured Google snippet TTL in days.
 * @returns The sorted array (same reference as `ids`).
 */
export function sortByGoogleTtlUrgency(
    ids: string[],
    timestamps: Map<string, Date | null>,
    ttlDays: number
): string[] {
    const now = Date.now();
    const urgencyThresholdMs = (ttlDays - 5) * 24 * 60 * 60 * 1000;

    const getPriority = (id: string): number => {
        const ts = timestamps.get(id);
        if (ts === undefined || ts === null) return 0; // never fetched — highest priority
        const age = now - ts.getTime();
        if (age >= urgencyThresholdMs) return 1; // expiring soon
        return 2; // not urgent
    };

    ids.sort((a, b) => getPriority(a) - getPriority(b));
    return ids;
}

// ---------------------------------------------------------------------------
// Job definition
// ---------------------------------------------------------------------------

/**
 * External reputation refresh cron job definition.
 *
 * Schedule: `HOSPEDA_EXTREP_CRON_SCHEDULE` (default `0 2 * * 1` — Monday 02:00 UTC)
 * Purpose: Keep cached platform ratings and Google snippets fresh weekly.
 */
export const refreshExternalReputationJob: CronJobDefinition = {
    name: 'refresh-external-reputation',
    description:
        'Weekly refresh of cached external platform reputation data (ratings, review counts, Google snippets) for accommodations with enabled external listings',
    schedule: process.env.HOSPEDA_EXTREP_CRON_SCHEDULE ?? DEFAULT_CRON_SCHEDULE,
    enabled: true,
    timeoutMs: 600_000, // 10 minutes — may process many accommodations

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        const ttlDaysRaw = Number.parseInt(
            process.env.HOSPEDA_EXTREP_GOOGLE_SNIPPET_TTL_DAYS ?? '30',
            10
        );
        const ttlDays = Number.isNaN(ttlDaysRaw) || ttlDaysRaw < 1 ? 30 : ttlDaysRaw;

        logger.info('Starting refresh-external-reputation batch', {
            dryRun,
            ttlDays,
            startedAt: startedAt.toISOString()
        });

        // --- Dry-run early exit ---
        if (dryRun) {
            let dryRunCount = 0;
            try {
                const ids = await getEnabledAccommodationIds();
                dryRunCount = ids.length;
            } catch {
                // ignore — just log 0 if the query fails in dry-run mode
            }
            const durationMs = Date.now() - startedAt.getTime();
            return {
                success: true,
                message: `Dry run — would refresh ${dryRunCount} accommodation(s)`,
                processed: dryRunCount,
                errors: 0,
                durationMs,
                details: { dryRun: true }
            };
        }

        // --- Build service instance ---
        const service = new AccommodationExternalReputationService(
            {},
            {
                listingModel: new AccommodationExternalListingModel(),
                reputationModel: new AccommodationExternalReputationModel(),
                accommodationModel: new AccommodationModel(),
                // Without these, the weekly cron ran every adapter with empty
                // credentials → Google/Booking/Airbnb all degraded to no data.
                adapterCredentials: getReputationAdapterCredentials()
            }
        );

        // --- Collect accommodation IDs to process ---
        let accommodationIds: string[];
        try {
            accommodationIds = await getEnabledAccommodationIds();
        } catch (fetchErr) {
            const errorMessage = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
            const errorStack = fetchErr instanceof Error ? fetchErr.stack : undefined;

            logger.error('Failed to fetch enabled accommodation IDs', {
                error: errorMessage,
                stack: errorStack
            });

            const durationMs = Date.now() - startedAt.getTime();
            return {
                success: false,
                message: `Failed to fetch enabled accommodation IDs: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs,
                details: { error: errorMessage }
            };
        }

        if (accommodationIds.length === 0) {
            const durationMs = Date.now() - startedAt.getTime();
            logger.info('No accommodations with enabled external listings found', { durationMs });
            return {
                success: true,
                message: 'No accommodations with enabled external listings to refresh',
                processed: 0,
                errors: 0,
                durationMs
            };
        }

        // --- Google TTL priority sort ---
        let googleTimestamps = new Map<string, Date | null>();
        try {
            googleTimestamps = await getGoogleSnippetTimestamps();
        } catch {
            // Non-fatal: proceed without TTL ordering
            logger.warn('Could not fetch Google snippet timestamps — TTL ordering skipped');
        }
        sortByGoogleTtlUrgency(accommodationIds, googleTimestamps, ttlDays);

        // --- Process each accommodation ---
        let processed = 0;
        let errors = 0;
        const errorDetails: Array<{ accommodationId: string; error: string }> = [];

        for (const accommodationId of accommodationIds) {
            try {
                const result = await service.refresh(
                    accommodationId,
                    CRON_SYSTEM_ACTOR,
                    undefined,
                    { bypassRateLimit: true }
                );

                if (result.error) {
                    logger.warn('Reputation refresh returned service error', {
                        accommodationId,
                        code: result.error.code,
                        message: result.error.message
                    });
                    errors++;
                    errorDetails.push({ accommodationId, error: result.error.message });
                } else {
                    const { succeeded, failed } = result.data;
                    logger.info('Reputation refresh succeeded for accommodation', {
                        accommodationId,
                        succeeded: succeeded.length,
                        failed: failed.length
                    });
                    if (failed.length > 0) {
                        errors += failed.length;
                        for (const f of failed) {
                            errorDetails.push({
                                accommodationId,
                                error: `${f.platform}: ${f.error}`
                            });
                        }
                    }
                }
            } catch (perAccErr) {
                // Per-accommodation error — log and continue (never abort the batch).
                const errorMessage =
                    perAccErr instanceof Error ? perAccErr.message : String(perAccErr);
                logger.error('Unhandled error refreshing accommodation reputation', {
                    accommodationId,
                    error: errorMessage
                });
                errors++;
                errorDetails.push({ accommodationId, error: errorMessage });
            }
            processed++;
        }

        const durationMs = Date.now() - startedAt.getTime();
        const success = errors === 0;

        logger.info('refresh-external-reputation batch completed', {
            processed,
            errors,
            durationMs
        });

        return {
            success,
            message: `Processed ${processed} accommodation(s) — ${errors} error(s)`,
            processed,
            errors,
            durationMs,
            details: errorDetails.length > 0 ? { errors: errorDetails } : undefined
        };
    }
};
