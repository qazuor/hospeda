/**
 * Admin get destination by ID endpoint
 * Returns full destination information including admin fields
 */
import {
    DestinationAdminSchema,
    DestinationIdSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/destinations/:id
 * Get destination by ID - Admin endpoint
 */
export const adminGetDestinationByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get destination by ID (admin)',
    description: 'Retrieves full destination information including admin fields',
    tags: ['Destinations'],
    requiredPermissions: [PermissionEnum.DESTINATION_VIEW_ALL],
    requestParams: {
        id: DestinationIdSchema
    },
    responseSchema: DestinationAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await destinationService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
