/**
 * GET /api/v1/admin/exchange-rates/config
 * Returns the current exchange rate configuration
 * Requires authentication and EXCHANGE_RATE_CONFIG_UPDATE permission
 */
import {
    type ExchangeRateConfig,
    ExchangeRateConfigSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { ExchangeRateConfigService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createProtectedRoute } from '../../../utils/route-factory.js';

const exchangeRateConfigService = new ExchangeRateConfigService({ logger: apiLogger });

/**
 * Get exchange rate configuration route
 * Returns current configuration settings
 */
export const getConfigRoute = createProtectedRoute({
    method: 'get',
    path: '/config',
    summary: 'Get exchange rate configuration',
    description:
        'Returns the current exchange rate configuration settings. Requires EXCHANGE_RATE_CONFIG_UPDATE permission.',
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
