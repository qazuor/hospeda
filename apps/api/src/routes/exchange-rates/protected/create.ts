/**
 * Protected create exchange rate endpoint
 * Creates a manual override for exchange rates
 * Requires authentication and EXCHANGE_RATE_CREATE permission
 */
import {
    type ExchangeRate,
    type ExchangeRateCreateInput,
    ExchangeRateCreateInputSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { ExchangeRateService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createProtectedRoute } from '../../../utils/route-factory.js';

const exchangeRateService = new ExchangeRateService({ logger: apiLogger });

/**
 * POST /api/v1/protected/exchange-rates
 * Create manual exchange rate override - Protected endpoint
 */
export const protectedCreateExchangeRateRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Create manual exchange rate override',
    description:
        'Creates a manual override for exchange rates. Automatically sets source to MANUAL, isManualOverride to true, and calculates inverse rate. Requires EXCHANGE_RATE_CREATE permission.',
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

        // Call service method to create manual override
        // Body is already validated by the route factory, safe to cast
        const result = await exchangeRateService.createManualOverride(
            actor,
            body as ExchangeRateCreateInput
        );

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data as ExchangeRate;
    }
});
