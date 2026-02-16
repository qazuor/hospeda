import type {
    ExchangeRateSearchInput,
    ExchangeRateSourceEnum,
    ExchangeRateTypeEnum,
    PriceCurrencyEnum,
    ServiceErrorCode
} from '@repo/schemas';
import {
    ExchangeRateSchema,
    ExchangeRateSourceEnumSchema,
    ExchangeRateTypeEnumSchema,
    PermissionEnum,
    PriceCurrencyEnumSchema
} from '@repo/schemas';
import { ExchangeRateService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
/**
 * Protected exchange rates history endpoint
 * Returns historical exchange rates with pagination and date range filters
 * Requires authentication and EXCHANGE_RATE_VIEW permission
 */
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination.js';
import { createProtectedListRoute } from '../../../utils/route-factory.js';

const exchangeRateService = new ExchangeRateService({ logger: apiLogger });

/**
 * HTTP-compatible search schema for exchange rate history
 * Extends base search with date range filters
 * All fields optional for flexible filtering
 */
const ExchangeRateHistoryHttpSchema = z.object({
    fromCurrency: PriceCurrencyEnumSchema.optional(),
    toCurrency: PriceCurrencyEnumSchema.optional(),
    rateType: ExchangeRateTypeEnumSchema.optional(),
    source: ExchangeRateSourceEnumSchema.optional(),
    from: z.coerce
        .date({
            message: 'zodError.exchangeRate.history.from.invalidDate'
        })
        .optional(),
    to: z.coerce
        .date({
            message: 'zodError.exchangeRate.history.to.invalidDate'
        })
        .optional()
});

/**
 * GET /api/v1/protected/exchange-rates/history
 * List exchange rate history with date range filters - Protected endpoint
 * Requires EXCHANGE_RATE_VIEW permission
 */
export const exchangeRateHistoryRoute = createProtectedListRoute({
    method: 'get',
    path: '/history',
    summary: 'List exchange rate history',
    description:
        'Returns historical exchange rates with optional date range and currency filters. Includes audit log of all rate changes. Requires EXCHANGE_RATE_VIEW permission.',
    tags: ['Exchange Rates'],
    requiredPermissions: [PermissionEnum.EXCHANGE_RATE_VIEW],
    requestQuery: ExchangeRateHistoryHttpSchema.shape,
    responseSchema: ExchangeRateSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
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

        if (query?.source) {
            filters.source = query.source as ExchangeRateSourceEnum;
        }

        if (query?.from) {
            filters.fromDate = query.from as Date;
        }

        if (query?.to) {
            filters.toDate = query.to as Date;
        }

        // Use search method for consistency (it handles pagination internally)
        const result = await exchangeRateService.search(actor, filters);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 60, // Cache for 1 minute (shorter than public list due to admin nature)
        customRateLimit: { requests: 100, windowMs: 60000 } // More restrictive than public
    }
});
