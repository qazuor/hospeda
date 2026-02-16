/**
 * DELETE /api/v1/protected/exchange-rates/:id
 * Removes a manual exchange rate override
 */
import { PermissionEnum, type ServiceErrorCode } from '@repo/schemas';
import { ExchangeRateService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createProtectedRoute } from '../../../utils/route-factory.js';

const exchangeRateService = new ExchangeRateService({ logger: apiLogger });

/**
 * Delete exchange rate override route
 * Only allows deleting manual overrides (isManualOverride=true)
 */
export const deleteExchangeRateRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete manual exchange rate override',
    description:
        'Removes a manual exchange rate override. Only manual overrides can be deleted, not rates fetched from external APIs.',
    tags: ['Exchange Rates'],
    requiredPermissions: [PermissionEnum.EXCHANGE_RATE_DELETE],
    requestParams: {
        id: z.string().uuid({
            message: 'zodError.exchangeRate.id.invalid'
        })
    },
    responseSchema: z.null(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await exchangeRateService.removeManualOverride(actor, { id: id as string });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        // Return null for 204 No Content
        return null;
    }
});
