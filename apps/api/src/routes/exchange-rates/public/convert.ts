import { ExchangeRateModel } from '@repo/db';
/**
 * Public currency conversion endpoint
 * Converts amount between currencies using current exchange rates
 */
import type { ExchangeRateTypeEnum, PriceCurrencyEnum } from '@repo/schemas';
import { ExchangeRateConvertHttpInputSchema, ExchangeRateConvertOutputSchema } from '@repo/schemas';
import {
    DolarApiClient,
    ExchangeRateApiClient,
    ExchangeRateConfigService,
    ExchangeRateFetcher,
    ServiceError,
    convertAmount
} from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor.js';
import { env } from '../../../utils/env.js';
import { apiLogger } from '../../../utils/logger.js';
import { createPublicRoute } from '../../../utils/route-factory.js';

/**
 * GET /api/v1/public/exchange-rates/convert
 * Convert currency amount - Public endpoint
 */
export const publicConvertExchangeRateRoute = createPublicRoute({
    method: 'get',
    path: '/convert',
    summary: 'Convert currency amount',
    description: 'Converts an amount from one currency to another using current exchange rates',
    tags: ['Exchange Rates'],
    requestQuery: ExchangeRateConvertHttpInputSchema.shape,
    responseSchema: ExchangeRateConvertOutputSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);

        // Validate required parameters (types are enforced by Zod schema)
        if (!query?.from || !query?.to || query?.amount === undefined) {
            throw new ServiceError(
                'VALIDATION_ERROR',
                'Missing required query parameters: from, to, amount'
            );
        }

        // Initialize dependencies inside handler for testability
        const exchangeRateModel = new ExchangeRateModel();
        const dolarApiClient = new DolarApiClient();
        const exchangeRateApiClient = new ExchangeRateApiClient({
            apiKey: env.HOSPEDA_EXCHANGE_RATE_API_KEY
        });
        const fetcher = new ExchangeRateFetcher({
            dolarApiClient,
            exchangeRateApiClient,
            exchangeRateModel
        });
        const configService = new ExchangeRateConfigService({ logger: apiLogger });

        // Get config to determine default rate type and disclaimer
        const configResult = await configService.getConfig({ actor });
        const config = configResult.data;

        if (!config) {
            throw new ServiceError(
                'INTERNAL_ERROR',
                'Failed to retrieve exchange rate configuration'
            );
        }

        // Use provided rateType or fallback to config default
        const rateType = query.rateType || config.defaultRateType;

        // Get exchange rate using fetcher with fallback chain
        const rateResult = await fetcher.getRateWithFallback({
            fromCurrency: query.from as PriceCurrencyEnum,
            toCurrency: query.to as PriceCurrencyEnum,
            rateType: rateType as ExchangeRateTypeEnum,
            maxAgeMinutes: 60
        });

        if (!rateResult.rate) {
            throw new ServiceError(
                'NOT_FOUND',
                `Exchange rate not found for ${query.from} to ${query.to}`
            );
        }

        const rate = rateResult.rate;

        // Perform conversion using helper
        const convertedAmount = convertAmount({
            amount: query.amount as number,
            rate: rate.rate
        });

        // Prepare disclaimer
        const disclaimer = config.showConversionDisclaimer
            ? config.disclaimerText ||
              'Las tasas de cambio son aproximadas y pueden variar. No nos hacemos responsables por diferencias en el tipo de cambio real.'
            : undefined;

        // Return conversion result
        return {
            convertedAmount,
            rate: rate.rate,
            rateType: rate.rateType,
            source: rate.source,
            lastUpdated: rate.fetchedAt,
            disclaimer
        };
    },
    options: {
        cacheTTL: 60, // Cache for 1 minute (rates change frequently)
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
