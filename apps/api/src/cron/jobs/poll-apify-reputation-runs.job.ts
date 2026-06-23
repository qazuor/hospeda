/**
 * Poll Apify Reputation Runs Cron Job (SPEC-250 Phase 6)
 *
 * Polling job that checks the status of pending/running Apify actor runs
 * queued by the external reputation refresh flow and persists results when
 * runs complete.
 *
 * Lifecycle per row:
 *   - SUCCEEDED  → fetch dataset items → map through adapter → upsert ok data,
 *                  clear run IDs, set run_status='idle'.
 *   - FAILED / ABORTED / TIMED-OUT (Apify terminal) → upsert fetch_status='error',
 *                  clear run IDs, set run_status='idle'.
 *   - READY / RUNNING within timeout  → set run_status='running' (no data change).
 *   - READY / RUNNING past timeout    → upsert fetch_status='error' (timeout sweep),
 *                  clear run IDs, set run_status='idle'.
 *   - Apify unreachable (null status) → warn + skip row (retry next tick).
 *
 * Schedule: read from env `HOSPEDA_EXTREP_POLL_SCHEDULE`
 *           (default `'star/2 * * * *'` — every 2 minutes).
 * Timeout:  read from env `HOSPEDA_EXTREP_APIFY_RUN_TIMEOUT_MS`
 *           (default `600000` — 10 minutes) at tick start (not cached).
 *
 * @module cron/jobs/poll-apify-reputation-runs
 */

import { AccommodationExternalReputationModel } from '@repo/db';
import type { InsertAccommodationExternalReputation, PendingRunRow } from '@repo/db';
import type { ExternalPlatformEnum } from '@repo/schemas';
import {
    emptyReputationResult,
    getApifyDatasetItems,
    getApifyRunStatus,
    getReputationAdapter
} from '@repo/service-core';
import { getReputationAdapterCredentials } from '../../utils/reputation-credentials.js';
import type { CronJobDefinition, CronJobResult } from '../types.js';

/**
 * Default cron schedule for the Apify reputation polling job.
 * Every 2 minutes.
 */
const DEFAULT_POLL_SCHEDULE = '*/2 * * * *';

/**
 * Default timeout in milliseconds before the poller sweeps a run as timed out.
 * 10 minutes.
 */
const DEFAULT_APIFY_RUN_TIMEOUT_MS = 600_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads the Apify run timeout from process.env at call time.
 * Read per-tick (not at module load) so test overrides to `process.env` work.
 *
 * @returns Timeout in milliseconds.
 */
function readRunTimeoutMs(): number {
    const raw = Number.parseInt(
        process.env.HOSPEDA_EXTREP_APIFY_RUN_TIMEOUT_MS ?? String(DEFAULT_APIFY_RUN_TIMEOUT_MS),
        10
    );
    return Number.isNaN(raw) || raw < 1 ? DEFAULT_APIFY_RUN_TIMEOUT_MS : raw;
}

/**
 * Builds a minimal listing-like object for `adapter.mapDatasetItems(items, listing)`.
 *
 * The full `AccommodationExternalListing` type has many required fields. The
 * Apify-backed adapters (Booking, Airbnb) only read `listing.url` inside
 * `mapDatasetItems` to construct a fallback `deepLink`. Providing the URL alone
 * is therefore sufficient; casting via `unknown` avoids fabricating unused fields.
 *
 * @param listingUrl - URL of the external listing from the joined query row.
 * @returns A minimal listing shim typed as the adapter's listing parameter.
 */
function buildMinimalListing(
    listingUrl: string
): Parameters<NonNullable<ReturnType<typeof getReputationAdapter>['mapDatasetItems']>>[1] {
    return { url: listingUrl } as Parameters<
        NonNullable<ReturnType<typeof getReputationAdapter>['mapDatasetItems']>
    >[1];
}

// ---------------------------------------------------------------------------
// Job definition
// ---------------------------------------------------------------------------

/**
 * Poll Apify reputation runs cron job definition.
 *
 * Schedule: `HOSPEDA_EXTREP_POLL_SCHEDULE` (default every 2 min)
 * Purpose:  Resolve pending/running Apify actor runs and persist results so that
 *           reputation data becomes eventually consistent without blocking any
 *           HTTP handler.
 */
export const pollApifyReputationRunsJob: CronJobDefinition = {
    name: 'poll-apify-reputation-runs',
    description:
        'Checks the status of pending/running Apify actor runs for external reputation data and persists results when runs complete.',
    schedule: process.env.HOSPEDA_EXTREP_POLL_SCHEDULE ?? DEFAULT_POLL_SCHEDULE,
    enabled: true,
    timeoutMs: 60_000, // 1 minute — each tick only does fast HTTP status checks

    handler: async (ctx): Promise<CronJobResult> => {
        const { logger, startedAt } = ctx;

        // Read timeout from env at tick start (not cached) so test overrides work.
        const timeoutMs = readRunTimeoutMs();

        const creds = getReputationAdapterCredentials();

        logger.info('Starting poll-apify-reputation-runs tick', {
            startedAt: startedAt.toISOString(),
            timeoutMs
        });

        // -------------------------------------------------------------------------
        // 1. Discover all rows awaiting resolution.
        // -------------------------------------------------------------------------
        const reputationModel = new AccommodationExternalReputationModel();
        let pendingRows: PendingRunRow[];

        try {
            pendingRows = await reputationModel.findPendingRuns();
        } catch (fetchErr) {
            const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
            logger.error('Failed to fetch pending runs from database', { error: msg });
            const durationMs = Date.now() - startedAt.getTime();
            return {
                success: false,
                message: `Failed to fetch pending runs: ${msg}`,
                processed: 0,
                errors: 1,
                durationMs
            };
        }

        // -------------------------------------------------------------------------
        // 2. Early exit — nothing to do this tick.
        // -------------------------------------------------------------------------
        if (pendingRows.length === 0) {
            const durationMs = Date.now() - startedAt.getTime();
            logger.info('No pending Apify runs found — tick complete', { durationMs });
            return {
                success: true,
                message: 'No pending runs',
                processed: 0,
                errors: 0,
                durationMs
            };
        }

        logger.info('Found pending Apify runs to process', { count: pendingRows.length });

        // -------------------------------------------------------------------------
        // 3. Process each row.
        // -------------------------------------------------------------------------
        let processed = 0;
        let errors = 0;

        for (const row of pendingRows) {
            try {
                // Guard: apifyRunId is non-null by model construction (OQ-1 guarantee),
                // but we verify defensively to avoid a runtime error.
                const runId = row.apifyRunId;
                if (!runId) {
                    logger.warn('Skipping pending row with null apifyRunId (should not happen)', {
                        rowId: row.id,
                        accommodationId: row.accommodationId,
                        platform: row.platform
                    });
                    continue;
                }

                const apifyToken = creds.apifyToken ?? '';
                const status = await getApifyRunStatus({ token: apifyToken, runId });

                if (!status) {
                    // Apify API unreachable — skip this tick, retry next.
                    logger.warn('Could not get Apify run status — will retry next tick', {
                        runId,
                        accommodationId: row.accommodationId,
                        platform: row.platform
                    });
                    continue;
                }

                if (status.status === 'SUCCEEDED') {
                    // ---------------------------------------------------------------
                    // SUCCEEDED: fetch items, map, upsert ok data.
                    // ---------------------------------------------------------------
                    const items = await getApifyDatasetItems({
                        token: apifyToken,
                        datasetId: status.defaultDatasetId
                    });

                    const adapter = getReputationAdapter(
                        row.platform as ExternalPlatformEnum,
                        creds
                    );

                    const listing = buildMinimalListing(row.listingUrl);
                    const result =
                        adapter.mapDatasetItems?.(items, listing) ?? emptyReputationResult();

                    await reputationModel.upsertReputation({
                        accommodationId: row.accommodationId,
                        platform: row.platform as InsertAccommodationExternalReputation['platform'],
                        listingId: row.listingId,
                        rating: result.rating,
                        reviewsCount: result.reviewsCount,
                        deepLink: result.deepLink,
                        snippets:
                            result.snippets as InsertAccommodationExternalReputation['snippets'],
                        fetchStatus: 'ok',
                        fetchMessage: null,
                        runStatus: 'idle',
                        apifyRunId: null,
                        apifyDatasetId: null,
                        aggregateFetchedAt: new Date()
                    });

                    logger.info('Apify run SUCCEEDED — reputation upserted', {
                        runId,
                        accommodationId: row.accommodationId,
                        platform: row.platform
                    });
                    processed++;
                } else if (
                    status.status === 'FAILED' ||
                    status.status === 'ABORTED' ||
                    status.status === 'TIMED-OUT'
                ) {
                    // ---------------------------------------------------------------
                    // Terminal Apify failure — mark error, clear run IDs.
                    // ---------------------------------------------------------------
                    await reputationModel.upsertReputation({
                        accommodationId: row.accommodationId,
                        platform: row.platform as InsertAccommodationExternalReputation['platform'],
                        listingId: row.listingId,
                        fetchStatus: 'error',
                        fetchMessage: `Apify run ${status.status.toLowerCase()}`,
                        runStatus: 'idle',
                        apifyRunId: null,
                        apifyDatasetId: null
                    });

                    logger.warn('Apify run ended with terminal failure', {
                        runId,
                        apifyStatus: status.status,
                        accommodationId: row.accommodationId,
                        platform: row.platform
                    });
                    errors++;
                } else {
                    // ---------------------------------------------------------------
                    // READY or RUNNING — check age against timeout sweep.
                    // ---------------------------------------------------------------
                    const runStartedAtMs = row.runStartedAt?.getTime() ?? 0;
                    const age = Date.now() - runStartedAtMs;

                    if (age > timeoutMs) {
                        // Timeout sweep — run has been active too long; mark error.
                        await reputationModel.upsertReputation({
                            accommodationId: row.accommodationId,
                            platform:
                                row.platform as InsertAccommodationExternalReputation['platform'],
                            listingId: row.listingId,
                            fetchStatus: 'error',
                            fetchMessage: 'Apify run timed out',
                            runStatus: 'idle',
                            apifyRunId: null,
                            apifyDatasetId: null
                        });

                        logger.warn('Apify run timed out — marked as error', {
                            runId,
                            ageMs: age,
                            timeoutMs,
                            accommodationId: row.accommodationId,
                            platform: row.platform
                        });
                        errors++;
                    } else if (row.runStatus !== 'running') {
                        // Still within timeout but not yet updated to 'running'.
                        await reputationModel.updateRunStatus({
                            id: row.id,
                            status: 'running'
                        });

                        logger.info('Apify run still in progress — updated to running', {
                            runId,
                            apifyStatus: status.status,
                            ageMs: age,
                            accommodationId: row.accommodationId,
                            platform: row.platform
                        });
                    }
                    // If already 'running' and within timeout: no change needed this tick.
                }
            } catch (rowErr) {
                // Per-row error — log and continue (idempotent on next tick).
                const msg = rowErr instanceof Error ? rowErr.message : String(rowErr);
                logger.error('Unhandled error processing pending run', {
                    rowId: row.id,
                    runId: row.apifyRunId,
                    accommodationId: row.accommodationId,
                    platform: row.platform,
                    error: msg
                });
                errors++;
            }
        }

        const durationMs = Date.now() - startedAt.getTime();
        const success = errors === 0;

        logger.info('poll-apify-reputation-runs tick completed', {
            processed,
            errors,
            durationMs
        });

        return {
            success,
            message: `Processed ${processed} completed run(s) — ${errors} error(s)`,
            processed,
            errors,
            durationMs
        };
    }
};
