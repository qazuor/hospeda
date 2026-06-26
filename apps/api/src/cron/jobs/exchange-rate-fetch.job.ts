/**
 * Exchange Rate Fetch Cron Job
 *
 * Fetches latest exchange rates from DolarAPI and ExchangeRate-API.
 * Runs every 15 minutes to keep rates current.
 *
 * Features:
 * - Fetches from DolarAPI (ARS-specific rates)
 * - Fetches from ExchangeRate-API (international rates)
 * - Respects manual overrides (admin-set rates take priority)
 * - Falls back to stale DB rates if API unavailable
 * - Logs all fetch/store operations
 * - Advisory lock (1008) prevents overlapping executions across replicas
 *
 * @module cron/jobs/exchange-rate-fetch
 */

import { ExchangeRateModel, sql, withTransaction } from '@repo/db';
import { DolarApiClient, ExchangeRateApiClient, ExchangeRateFetcher } from '@repo/service-core';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Advisory lock key reserved for the exchange-rate-fetch cron job.
 *
 * Uses `pg_try_advisory_xact_lock` (transaction-level, non-blocking) so
 * the lock auto-releases on commit/rollback and is safe under PgBouncer /
 * Coolify's pooled-client configuration (project policy — see
 * `packages/db/docs/advisory-locks.md`).
 *
 * Lock key 1008 is next in the billing/cron sequence (SPEC-194 T-020):
 *   1001 webhook-retry  | 1002 notification-schedule | 1003 dunning
 *   1004 block-expired-trials | 1005 trial-pre-end-notif
 *   1006 abandoned-pending-subs | 1007 subscription-poll
 *   1008 exchange-rate-fetch  ← this job
 */
const ADVISORY_LOCK_KEY = 1008;

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
 * Exchange rate fetch cron job definition
 *
 * Schedule: Every 15 minutes (*\/15 * * * *)
 * Purpose: Keep exchange rates current by fetching from external APIs
 */
export const exchangeRateFetchJob: CronJobDefinition = {
    name: 'exchange-rate-fetch',
    description: 'Fetch latest exchange rates from DolarAPI and ExchangeRate-API',
    schedule: '*/15 * * * *', // Every 15 minutes
    enabled: true,
    timeoutMs: 60000, // 1 minute timeout

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting exchange rate fetch', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        try {
            // Prevent overlapping cron executions via PostgreSQL advisory lock (SPEC-194 T-020).
            // Lock key 1008 is reserved for this job. Uses pg_try_advisory_xact_lock
            // (transaction-level) instead of pg_try_advisory_lock (session-level) so the
            // lock auto-releases on commit/rollback and is safe under PgBouncer /
            // Coolify's pooled-client configuration. See packages/db/docs/advisory-locks.md.
            const cronResult = await withTransaction<CronTransactionResult>(async (_tx) => {
                const lockResult = await _tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}) AS acquired`
                );
                if (!lockResult.rows[0]?.acquired) {
                    return { skipped: true };
                }

                // Initialize clients
                const dolarApiClient = new DolarApiClient();
                const exchangeRateApiClient = new ExchangeRateApiClient({
                    apiKey: env.HOSPEDA_EXCHANGE_RATE_API_KEY
                });
                const exchangeRateModel = new ExchangeRateModel();

                // Create fetcher instance
                const fetcher = new ExchangeRateFetcher({
                    dolarApiClient,
                    exchangeRateApiClient,
                    exchangeRateModel
                });

                if (dryRun) {
                    // Dry run mode - just log what would be fetched without storing
                    logger.info('Running in dry-run mode - simulating fetch');

                    // Fetch from both sources but don't store
                    const dolarApiResult = await dolarApiClient.fetchAll();
                    const exchangeRateApiResult = await exchangeRateApiClient.fetchLatestRates();

                    const totalRates =
                        dolarApiResult.rates.length + exchangeRateApiResult.rates.length;
                    const totalErrors =
                        dolarApiResult.errors.length + exchangeRateApiResult.errors.length;

                    logger.info('Dry-run fetch completed', {
                        dolarApiRates: dolarApiResult.rates.length,
                        dolarApiErrors: dolarApiResult.errors.length,
                        exchangeRateApiRates: exchangeRateApiResult.rates.length,
                        exchangeRateApiErrors: exchangeRateApiResult.errors.length,
                        totalRates,
                        totalErrors
                    });

                    const durationMs = Date.now() - startedAt.getTime();

                    return {
                        skipped: false,
                        success: true,
                        message: `Dry run - Would fetch ${totalRates} exchange rates from ${dolarApiResult.rates.length > 0 ? 'DolarAPI' : ''} ${exchangeRateApiResult.rates.length > 0 ? 'ExchangeRate-API' : ''}`,
                        processed: totalRates,
                        errors: totalErrors,
                        durationMs,
                        details: {
                            dryRun: true,
                            fromDolarApi: dolarApiResult.rates.length,
                            fromExchangeRateApi: exchangeRateApiResult.rates.length,
                            dolarApiErrors: dolarApiResult.errors,
                            exchangeRateApiErrors: exchangeRateApiResult.errors
                        }
                    };
                }

                // Production mode - actually fetch and store
                logger.info('Running in production mode - fetching and storing rates');

                const result = await fetcher.fetchAndStore();

                logger.info('Exchange rate fetch completed', {
                    stored: result.stored,
                    errors: result.errors.length,
                    fromManualOverride: result.fromManualOverride,
                    fromDolarApi: result.fromDolarApi,
                    fromExchangeRateApi: result.fromExchangeRateApi,
                    fromDbFallback: result.fromDbFallback,
                    durationMs: Date.now() - startedAt.getTime()
                });

                const durationMs = Date.now() - startedAt.getTime();

                return {
                    skipped: false,
                    success: result.errors.length === 0,
                    message:
                        result.errors.length === 0
                            ? `Successfully fetched and stored ${result.stored} exchange rates`
                            : `Fetched ${result.stored} rates with ${result.errors.length} errors`,
                    processed: result.stored,
                    errors: result.errors.length,
                    durationMs,
                    details: {
                        stored: result.stored,
                        fromManualOverride: result.fromManualOverride,
                        fromDolarApi: result.fromDolarApi,
                        fromExchangeRateApi: result.fromExchangeRateApi,
                        fromDbFallback: result.fromDbFallback,
                        errorDetails: result.errors
                    }
                };
            });

            const durationMs = Date.now() - startedAt.getTime();

            if (cronResult.skipped) {
                apiLogger.warn(
                    'exchange-rate-fetch cron: skipping — previous run still holds advisory lock'
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

            // SPEC-180: exchange rate fetch failure is actionable — forward to Sentry.
            logger.error(
                'Exchange rate fetch failed',
                { error: errorMessage, stack: errorStack },
                { capture: true }
            );

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Failed to fetch exchange rates: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs,
                details: {
                    error: errorMessage,
                    stack: errorStack
                }
            };
        }
    }
    // Note: no finally block needed — pg_try_advisory_xact_lock auto-releases on
    // transaction commit/rollback; withTransaction always commits or rolls back.
};
