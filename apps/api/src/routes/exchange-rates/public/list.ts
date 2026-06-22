import type {
    ExchangeRateSearchInput,
    ExchangeRateTypeEnum,
    PriceCurrencyEnum
} from '@repo/schemas';
import {
    ExchangeRatePublicSchema,
    ExchangeRateTypeEnumSchema,
    PriceCurrencyEnumSchema
} from '@repo/schemas';
import { ExchangeRateService, ServiceError } from '@repo/service-core';
/**
 * Public exchange rates list endpoint
 * Returns current exchange rates with optional filters
 */
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination.js';
import { createPublicListRoute } from '../../../utils/route-factory.js';

const exchangeRateService = new ExchangeRateService({ logger: apiLogger });

/**
 * HTTP-compatible search schema for the PUBLIC exchange rates endpoint.
 *
 * Only exposes currency-pair and rate-type filters that are safe for public
 * consumers. The `source` and `isManualOverride` fields are intentionally
 * EXCLUDED — they expose internal data-source bookkeeping and override flags
 * that public callers have no business querying. SPEC-210: query-param tier leak fix.
 */
const ExchangeRateSearchHttpSchema = z.object({
    fromCurrency: PriceCurrencyEnumSchema.optional(),
    toCurrency: PriceCurrencyEnumSchema.optional(),
    rateType: ExchangeRateTypeEnumSchema.optional()
});

/**
 * GET /api/v1/public/exchange-rates
 * List exchange rates with optional filters - Public endpoint
 */
export const publicListExchangeRatesRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List exchange rates',
    description: 'Returns current exchange rates with optional filters',
    tags: ['Exchange Rates'],
    requestQuery: ExchangeRateSearchHttpSchema.shape,
    responseSchema: ExchangeRatePublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Build filters from query parameters, including pagination
        const filters: ExchangeRateSearchInput & { page?: number; pageSize?: number } = {
            page,
            pageSize
        };

        if (query?.fromCurrency) {
            filters.fromCurrency = query.fromCurrency as PriceCurrencyEnum;
        }

        if (query?.toCurrency) {
            filters.toCurrency = query.toCurrency as PriceCurrencyEnum;
        }

        if (query?.rateType) {
            filters.rateType = query.rateType as ExchangeRateTypeEnum;
        }

        // Always use search for consistency (it handles pagination internally)
        const result = await exchangeRateService.search(actor, filters);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300, // Cache for 5 minutes
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
