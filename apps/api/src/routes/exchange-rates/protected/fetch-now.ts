import { z } from '@hono/zod-openapi';
/**
 * Protected fetch-now exchange rate endpoint
 * Triggers immediate rate fetching from all sources
 * Requires authentication and EXCHANGE_RATE_FETCH permission
 */
import { ExchangeRateModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { DolarApiClient, ExchangeRateApiClient, ExchangeRateFetcher } from '@repo/service-core';
import type { FetchAllResult } from '@repo/service-core';
import type { Context } from 'hono';
import { env } from '../../../utils/env.js';
import { apiLogger } from '../../../utils/logger.js';
import { createProtectedRoute } from '../../../utils/route-factory.js';

/**
 * Response schema for fetch-now endpoint
 */
const FetchNowResponseSchema = z.object({
    stored: z.number().describe('Number of rates successfully stored'),
    errors: z
        .array(
            z.object({
                source: z.string().describe('Source that produced the error'),
                error: z.string().describe('Error message')
            })
        )
        .describe('Errors encountered during fetch/store operations'),
    fromManualOverride: z.number().describe('Number of rates from manual overrides'),
    fromDolarApi: z.number().describe('Number of rates from DolarAPI'),
    fromExchangeRateApi: z.number().describe('Number of rates from ExchangeRate-API'),
    fromDbFallback: z.number().describe('Number of rates from DB fallback')
});

/**
 * POST /api/v1/protected/exchange-rates/fetch-now
 * Trigger immediate exchange rate fetch from all sources - Protected endpoint
 */
export const fetchNowExchangeRateRoute = createProtectedRoute({
    method: 'post',
    path: '/fetch-now',
    summary: 'Trigger immediate exchange rate fetch',
    description:
        'Fetches current exchange rates from all configured sources (DolarAPI and ExchangeRate-API). Manual overrides take priority over fetched rates. Returns detailed breakdown of stored rates and any errors encountered. Requires EXCHANGE_RATE_FETCH permission.',
    tags: ['Exchange Rates'],
    requestBody: undefined, // No request body for this endpoint
    responseSchema: FetchNowResponseSchema,
    requiredPermissions: [PermissionEnum.EXCHANGE_RATE_FETCH],
    handler: async (
        _ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>
    ): Promise<FetchAllResult> => {
        apiLogger.info('Starting manual exchange rate fetch');

        // Initialize model
        const exchangeRateModel = new ExchangeRateModel();

        // Initialize DolarAPI client
        const dolarApiClient = new DolarApiClient({
            baseUrl: 'https://dolarapi.com/v1',
            timeoutMs: 5000
        });

        // Initialize ExchangeRate-API client
        const exchangeRateApiClient = new ExchangeRateApiClient({
            apiKey: env.HOSPEDA_EXCHANGE_RATE_API_KEY,
            baseUrl: 'https://v6.exchangerate-api.com/v6',
            timeoutMs: 10000
        });

        // Initialize fetcher
        const fetcher = new ExchangeRateFetcher({
            dolarApiClient,
            exchangeRateApiClient,
            exchangeRateModel
        });

        // Fetch and store rates
        const result = await fetcher.fetchAndStore();

        // Log summary
        if (result.errors.length > 0) {
            apiLogger.warn(
                {
                    stored: result.stored,
                    errors: result.errors,
                    fromManualOverride: result.fromManualOverride,
                    fromDolarApi: result.fromDolarApi,
                    fromExchangeRateApi: result.fromExchangeRateApi
                },
                'Manual fetch completed with errors'
            );
        } else {
            apiLogger.info(
                {
                    stored: result.stored,
                    fromManualOverride: result.fromManualOverride,
                    fromDolarApi: result.fromDolarApi,
                    fromExchangeRateApi: result.fromExchangeRateApi
                },
                'Manual fetch completed successfully'
            );
        }

        return result;
    }
});
