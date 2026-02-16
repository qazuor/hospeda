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
 *
 * @module cron/jobs/exchange-rate-fetch
 */

import { ExchangeRateModel } from '@repo/db';
import { DolarApiClient, ExchangeRateApiClient, ExchangeRateFetcher } from '@repo/service-core';
import type { CronJobDefinition } from '../types.js';

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
            // Initialize clients
            const dolarApiClient = new DolarApiClient();
            const exchangeRateApiClient = new ExchangeRateApiClient({
                apiKey: process.env.EXCHANGERATE_API_KEY || ''
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

                const totalRates = dolarApiResult.rates.length + exchangeRateApiResult.rates.length;
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
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            logger.error('Exchange rate fetch failed', {
                error: errorMessage,
                stack: errorStack
            });

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
};
