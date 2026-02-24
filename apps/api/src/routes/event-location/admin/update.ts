/**
 * Admin update event location endpoint
 * Allows admins to update any event location
 */
import {
    EventLocationAdminSchema,
    EventLocationIdSchema,
    type EventLocationUpdateInput,
    EventLocationUpdateInputSchema,
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
 * PUT /api/v1/admin/event-locations/:id
 * Update event location - Admin endpoint
 */
export const adminUpdateEventLocationRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update event location (admin)',
    description: 'Updates any event location. Admin only.',
    tags: ['Event Locations'],
    requiredPermissions: [PermissionEnum.EVENT_LOCATION_UPDATE],
    requestParams: {
        id: EventLocationIdSchema
    },
    requestBody: EventLocationUpdateInputSchema,
    responseSchema: EventLocationAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const data = body as EventLocationUpdateInput;
        const result = await eventLocationService.update(actor, id as string, data);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
