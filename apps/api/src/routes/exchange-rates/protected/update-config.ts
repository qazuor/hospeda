/**
 * PUT /api/v1/protected/exchange-rates/config
 * Updates exchange rate configuration settings
 * Requires authentication and EXCHANGE_RATE_CONFIG_UPDATE permission
 */
import {
    type ExchangeRateConfig,
    ExchangeRateConfigSchema,
    type ExchangeRateConfigUpdateInput,
    ExchangeRateConfigUpdateInputSchema,
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
 * Update exchange rate configuration route
 * Allows partial updates to configuration settings
 */
export const updateConfigRoute = createProtectedRoute({
    method: 'put',
    path: '/config',
    summary: 'Update exchange rate configuration',
    description:
        'Updates exchange rate configuration settings. Supports partial updates. Requires EXCHANGE_RATE_CONFIG_UPDATE permission.',
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

        // Call service method to update configuration
        // Body is already validated by the route factory, safe to cast
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
