import { ExchangeRateModel } from '@repo/db';
/**
 * Admin exchange rate routes
 * Requires admin role + appropriate permissions
 * These wrap the same service logic as protected routes but enforce admin-level access
 */
import type {
    ExchangeRateConfig,
    ExchangeRateCreateInput,
    ExchangeRateSearchInput,
    ExchangeRateSourceEnum,
    ExchangeRateTypeEnum,
    PriceCurrencyEnum,
    ServiceErrorCode
} from '@repo/schemas';
import {
    ExchangeRateConfigSchema,
    ExchangeRateConfigUpdateInputSchema,
    ExchangeRateCreateInputSchema,
    ExchangeRateSchema,
    ExchangeRateSourceEnumSchema,
    ExchangeRateTypeEnumSchema,
    PermissionEnum,
    PriceCurrencyEnumSchema
} from '@repo/schemas';
import type { ExchangeRateConfigUpdateInput } from '@repo/schemas';
import {
    DolarApiClient,
    ExchangeRateApiClient,
    ExchangeRateConfigService,
    ExchangeRateFetcher,
    ExchangeRateService,
    ServiceError
} from '@repo/service-core';
import type { FetchAllResult } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor.js';
import { createRouter } from '../../../utils/create-app.js';
import { env } from '../../../utils/env.js';
import { apiLogger } from '../../../utils/logger.js';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination.js';
import { createAdminListRoute, createAdminRoute } from '../../../utils/route-factory.js';

const exchangeRateService = new ExchangeRateService({ logger: apiLogger });
const exchangeRateConfigService = new ExchangeRateConfigService({ logger: apiLogger });

/** POST /api/v1/admin/exchange-rates - Create manual override */
const adminCreateRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create manual exchange rate override',
    description:
        'Creates a manual override for exchange rates. Requires admin role and EXCHANGE_RATE_CREATE permission.',
    tags: ['Exchange Rates'],
    requiredPermissions: [PermissionEnum.EXCHANGE_RATE_CREATE],
    requestBody: ExchangeRateCreateInputSchema,
    responseSchema: ExchangeRateCreateInputSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await exchangeRateService.createManualOverride(
            actor,
            body as ExchangeRateCreateInput
        );
        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }
        return result.data;
    }
});

/** DELETE /api/v1/admin/exchange-rates/{id} - Remove manual override */
const adminDeleteRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete manual exchange rate override',
    description:
        'Removes a manual exchange rate override. Requires admin role and EXCHANGE_RATE_DELETE permission.',
    tags: ['Exchange Rates'],
    requiredPermissions: [PermissionEnum.EXCHANGE_RATE_DELETE],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.exchangeRate.id.invalid' })
    },
    responseSchema: z.null(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await exchangeRateService.removeManualOverride(actor, {
            id: params.id as string
        });
        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }
        return null;
    }
});

/** Response schema for fetch-now endpoint */
const FetchNowResponseSchema = z.object({
    stored: z.number(),
    errors: z.array(z.object({ source: z.string(), error: z.string() })),
    fromManualOverride: z.number(),
    fromDolarApi: z.number(),
    fromExchangeRateApi: z.number(),
    fromDbFallback: z.number()
});

/** POST /api/v1/admin/exchange-rates/fetch-now - Trigger immediate fetch */
const adminFetchNowRoute = createAdminRoute({
    method: 'post',
    path: '/fetch-now',
    summary: 'Trigger immediate exchange rate fetch',
    description:
        'Fetches current exchange rates from all configured sources. Requires admin role and EXCHANGE_RATE_FETCH permission.',
    tags: ['Exchange Rates'],
    requiredPermissions: [PermissionEnum.EXCHANGE_RATE_FETCH],
    requestBody: undefined,
    responseSchema: FetchNowResponseSchema,
    handler: async (): Promise<FetchAllResult> => {
        apiLogger.info('Starting manual exchange rate fetch (admin)');
        const exchangeRateModel = new ExchangeRateModel();
        const dolarApiClient = new DolarApiClient({
            baseUrl: 'https://dolarapi.com/v1',
            timeoutMs: 5000
        });
        const exchangeRateApiClient = new ExchangeRateApiClient({
            apiKey: env.HOSPEDA_EXCHANGE_RATE_API_KEY,
            baseUrl: 'https://v6.exchangerate-api.com/v6',
            timeoutMs: 10000
        });
        const fetcher = new ExchangeRateFetcher({
            dolarApiClient,
            exchangeRateApiClient,
            exchangeRateModel
        });
        return fetcher.fetchAndStore();
    }
});

/** GET /api/v1/admin/exchange-rates/config - Get configuration */
const adminGetConfigRoute = createAdminRoute({
    method: 'get',
    path: '/config',
    summary: 'Get exchange rate configuration',
    description:
        'Returns the current exchange rate configuration. Requires admin role and EXCHANGE_RATE_CONFIG_UPDATE permission.',
    tags: ['Exchange Rates'],
    requiredPermissions: [PermissionEnum.EXCHANGE_RATE_CONFIG_UPDATE],
    responseSchema: ExchangeRateConfigSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);
        const result = await exchangeRateConfigService.getConfig({ actor });
        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }
        return result.data as ExchangeRateConfig;
    }
});

/** PUT /api/v1/admin/exchange-rates/config - Update configuration */
const adminUpdateConfigRoute = createAdminRoute({
    method: 'put',
    path: '/config',
    summary: 'Update exchange rate configuration',
    description:
        'Updates exchange rate configuration settings. Requires admin role and EXCHANGE_RATE_CONFIG_UPDATE permission.',
    tags: ['Exchange Rates'],
    requiredPermissions: [PermissionEnum.EXCHANGE_RATE_CONFIG_UPDATE],
    requestBody: ExchangeRateConfigUpdateInputSchema,
    responseSchema: ExchangeRateConfigSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await exchangeRateConfigService.updateConfig({
            actor,
            data: body as ExchangeRateConfigUpdateInput
        });
        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }
        return result.data as ExchangeRateConfig;
    }
});

/** HTTP schema for history query */
const ExchangeRateHistoryHttpSchema = z.object({
    fromCurrency: PriceCurrencyEnumSchema.optional(),
    toCurrency: PriceCurrencyEnumSchema.optional(),
    rateType: ExchangeRateTypeEnumSchema.optional(),
    source: ExchangeRateSourceEnumSchema.optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional()
});

/** GET /api/v1/admin/exchange-rates/history - List history */
const adminHistoryRoute = createAdminListRoute({
    method: 'get',
    path: '/history',
    summary: 'List exchange rate history',
    description:
        'Returns historical exchange rates with filters. Requires admin role and EXCHANGE_RATE_VIEW permission.',
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
        const filters: ExchangeRateSearchInput & { page?: number; pageSize?: number } = {
            page,
            pageSize
        };

        if (query?.fromCurrency) filters.fromCurrency = query.fromCurrency as PriceCurrencyEnum;
        if (query?.toCurrency) filters.toCurrency = query.toCurrency as PriceCurrencyEnum;
        if (query?.rateType) filters.rateType = query.rateType as ExchangeRateTypeEnum;
        if (query?.source) filters.source = query.source as ExchangeRateSourceEnum;
        if (query?.from) filters.fromDate = query.from as Date;
        if (query?.to) filters.toDate = query.to as Date;

        const result = await exchangeRateService.search(actor, filters);
        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }
        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});

const router = createRouter();

router.route('/', adminCreateRoute);
router.route('/', adminDeleteRoute);
router.route('/', adminFetchNowRoute);
router.route('/', adminGetConfigRoute);
router.route('/', adminUpdateConfigRoute);
router.route('/', adminHistoryRoute);

export { router as adminExchangeRateRoutes };
