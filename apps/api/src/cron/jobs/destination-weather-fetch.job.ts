/**
 * Destination Weather Fetch Cron Job
 *
 * Refreshes the cached Open-Meteo weather (current conditions + 16-day daily
 * forecast) for every published destination that has coordinates, writing the
 * payload to the `weather_current` jsonb column. Runs every 12 hours.
 *
 * Features:
 * - Open-Meteo (no API key, non-commercial tier)
 * - Tolerates per-destination failures (serves the last cache)
 * - dry-run support (fetches without persisting)
 * - Advisory lock (43031) prevents overlapping executions across replicas
 *
 * @module cron/jobs/destination-weather-fetch
 */

import { DestinationModel, sql, withTransaction } from '@repo/db';
import { OpenMeteoClient, WeatherFetcher } from '@repo/service-core';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Advisory lock key reserved for the destination-weather-fetch cron job.
 *
 * Uses `pg_try_advisory_xact_lock` (transaction-level, non-blocking) so the lock
 * auto-releases on commit/rollback and is safe under PgBouncer / Coolify's
 * pooled-client configuration (see `packages/db/docs/advisory-locks.md`).
 *
 * Key 43031 continues the 4300x non-billing series (SPEC-215).
 */
const ADVISORY_LOCK_KEY = 43031;

/**
 * Discriminated union returned by the withTransaction callback so the outer
 * handler can distinguish lock-skip from real execution results.
 */
type CronTransactionResult =
    | { readonly skipped: true }
    | {
          readonly skipped: false;
          readonly success: boolean;
          readonly message: string;
          readonly processed: number;
          readonly errors: number;
          readonly durationMs: number;
          readonly details?: Record<string, unknown>;
      };

/**
 * Destination weather fetch cron job definition.
 *
 * Schedule: Every 12 hours (0 *\/12 * * *)
 * Purpose: Keep cached destination weather current without per-request external calls.
 */
export const destinationWeatherFetchJob: CronJobDefinition = {
    name: 'destination-weather-fetch',
    description: 'Refresh cached Open-Meteo weather for published destinations with coordinates',
    schedule: '0 */12 * * *', // Every 12 hours
    enabled: true,
    timeoutMs: 120000, // 2 minute timeout

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting destination weather fetch', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        try {
            const cronResult = await withTransaction<CronTransactionResult>(async (_tx) => {
                const lockResult = await _tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}) AS acquired`
                );
                if (!lockResult.rows[0]?.acquired) {
                    return { skipped: true };
                }

                const fetcher = new WeatherFetcher({
                    openMeteoClient: new OpenMeteoClient(),
                    destinationModel: new DestinationModel()
                });

                const summary = await fetcher.fetchAndStoreAll({ dryRun });
                const durationMs = Date.now() - startedAt.getTime();

                logger.info('Destination weather fetch completed', {
                    processed: summary.processed,
                    updated: summary.updated,
                    errors: summary.errors.length,
                    dryRun,
                    durationMs
                });

                return {
                    skipped: false,
                    success: summary.errors.length === 0,
                    message: dryRun
                        ? `Dry run - would refresh weather for ${summary.processed} destinations`
                        : `Refreshed weather for ${summary.updated}/${summary.processed} destinations`,
                    processed: summary.processed,
                    errors: summary.errors.length,
                    durationMs,
                    details: { updated: summary.updated, errorDetails: summary.errors, dryRun }
                };
            });

            const durationMs = Date.now() - startedAt.getTime();

            if (cronResult.skipped) {
                apiLogger.warn(
                    'destination-weather-fetch cron: skipping — previous run still holds advisory lock'
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

            return {
                success: cronResult.success,
                message: cronResult.message,
                processed: cronResult.processed,
                errors: cronResult.errors,
                durationMs: cronResult.durationMs,
                details: cronResult.details
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            logger.error('Destination weather fetch failed', {
                error: errorMessage,
                stack: errorStack
            });

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Failed to fetch destination weather: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs,
                details: { error: errorMessage, stack: errorStack }
            };
        }
    }
    // Note: no finally block needed — pg_try_advisory_xact_lock auto-releases on
    // transaction commit/rollback; withTransaction always commits or rolls back.
};
