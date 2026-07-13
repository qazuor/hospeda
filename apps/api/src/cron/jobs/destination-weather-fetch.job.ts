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
 * - Advisory lock (43031) prevents overlapping WRITE phases across replicas
 *
 * ## Why fetch and persist run as two separate steps
 *
 * `WeatherFetcher.fetchAll()` makes a sequential HTTP call to Open-Meteo (up
 * to 10s each, timeout) per destination. Wrapping that loop in a database
 * transaction previously held the connection idle across every `fetch()`
 * call, tripping Postgres's `idle_in_transaction_session_timeout` (30s) in
 * production and crashing the process — the `pg` driver surfaces a
 * connection killed mid-transaction as an unhandled `'error'` event, not a
 * catchable query rejection. See `packages/service-core/CLAUDE.md`: external
 * API calls MUST stay OUTSIDE the transaction callback.
 *
 * This job now runs:
 *  1. `fetcher.fetchAll()` — remote fetch only. No transaction is open at
 *     any point during this step.
 *  2. `withTransaction(...)` — a short transaction whose FIRST statement is
 *     `pg_try_advisory_xact_lock(43031)` (the repo's standard cron-lock
 *     pattern per `docs/decisions/ADR-019-billing-transaction-isolation.md`
 *     — transaction-scoped locks only, no session-scoped locks), followed
 *     only by `fetcher.persist(...)`, i.e. per-destination DB writes. No
 *     external I/O happens inside this transaction, so it can never sit idle
 *     long enough to hit the timeout.
 *
 * ## Trade-off: the lock now only guards the WRITE phase
 *
 * Because the advisory lock is acquired inside the (write-only) transaction,
 * two overlapping invocations both perform the fetch phase — only one of
 * them goes on to persist; the other's transaction fails to acquire the
 * lock and returns the usual `skipped` result. Acceptable for a 12h cron
 * against a free, unauthenticated API; this is what keeps the fix within
 * ADR-019's "transaction-scoped locks only" rule instead of introducing a
 * session-scoped lock.
 *
 * ## Write atomicity: all-or-nothing (deliberate, no savepoints)
 *
 * All destination writes run inside the single write transaction — if one
 * `update()` fails, the whole batch rolls back. The per-destination
 * `errors` already reported in the summary come from the (out-of-transaction)
 * fetch phase, where per-destination tolerance genuinely matters (a single
 * slow/broken upstream response must not fail the whole run). A write-phase
 * failure is an unexpected error, not an expected per-destination outcome,
 * so no savepoint-based partial-commit logic is used here — keep it simple.
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
 * Transaction-scoped (`pg_try_advisory_xact_lock`, auto-releases on
 * commit/rollback), acquired as the first statement inside the write-only
 * transaction — see the module doc-comment above. Key 43031 continues the
 * 4300x non-billing series (SPEC-215); registered in
 * `packages/db/docs/advisory-locks.md`.
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
 * Schedule: 06:00 and 18:00 UTC (03:00 / 15:00 ART).
 * Purpose: Keep cached destination weather current without per-request external calls.
 *
 * HOS-154: moved off the previous `0 *\/12 * * *` (00:00/12:00 UTC = 21:00/09:00
 * ART) — the 21:00 ART tick landed on a traffic peak, and the extra event-loop
 * pressure was tripping the per-request Open-Meteo timeout for a subset of
 * destinations every run. 06:00/18:00 UTC lands on lower-traffic windows. The
 * job timeout is also raised to 3 min to leave headroom for the client's
 * per-destination retries.
 */
export const destinationWeatherFetchJob: CronJobDefinition = {
    name: 'destination-weather-fetch',
    description: 'Refresh cached Open-Meteo weather for published destinations with coordinates',
    schedule: '0 6,18 * * *', // 06:00 & 18:00 UTC (03:00 / 15:00 ART) — off-peak (HOS-154)
    enabled: true,
    timeoutMs: 180000, // 3 minute timeout — headroom for per-destination retries (HOS-154)

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting destination weather fetch', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        try {
            const fetcher = new WeatherFetcher({
                openMeteoClient: new OpenMeteoClient(),
                destinationModel: new DestinationModel()
            });

            // Phase 1: remote fetch only — no transaction open here. This is
            // exactly the step that must never share a connection with an
            // open transaction (see module doc-comment).
            const fetchResults = await fetcher.fetchAll();

            // Phase 2: short transaction — advisory lock as the first
            // statement, then only DB writes. No HTTP calls happen from
            // here on, so this transaction can never sit idle.
            const cronResult = await withTransaction<CronTransactionResult>(async (tx) => {
                const lockResult = await tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}) AS acquired`
                );
                if (!lockResult.rows[0]?.acquired) {
                    return { skipped: true };
                }

                const summary = await fetcher.persist(fetchResults, { dryRun, tx });
                const durationMs = Date.now() - startedAt.getTime();

                logger.info('Destination weather fetch completed', {
                    processed: summary.processed,
                    updated: summary.updated,
                    errors: summary.errors.length,
                    dryRun,
                    durationMs
                });

                // HOS-154: surface WHICH destinations failed and why, not just the
                // count. Without this the soft-failure was indiagnosable from logs.
                if (summary.errors.length > 0) {
                    logger.warn('Destination weather fetch had per-destination failures', {
                        failedCount: summary.errors.length,
                        processed: summary.processed,
                        failures: summary.errors.map((e) => `${e.slug}: ${e.error}`)
                    });
                }

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
