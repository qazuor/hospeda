/**
 * Admin get event location by ID endpoint
 * Returns full event location information including admin fields
 */
import {
    EventLocationAdminSchema,
    EventLocationIdSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { EventLocationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/event-locations/:id
 * Get event location by ID - Admin endpoint
 */
export const adminGetEventLocationByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get event location by ID (admin)',
    description: 'Retrieves full event location information including admin fields',
    tags: ['Event Locations'],
    requiredPermissions: [PermissionEnum.EVENT_LOCATION_VIEW],
    requestParams: {
        id: EventLocationIdSchema
    },
    responseSchema: EventLocationAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventLocationService.getById(actor, params.id as string);

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
