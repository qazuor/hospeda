/**
 * Admin create event location endpoint
 * Allows admins to create new event locations
 */
import {
    EventLocationAdminSchema,
    type EventLocationCreateInput,
    EventLocationCreateInputSchema,
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
 * POST /api/v1/admin/event-locations
 * Create event location - Admin endpoint
 */
export const adminCreateEventLocationRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create event location',
    description: 'Creates a new event location. Admin only.',
    tags: ['Event Locations'],
    requiredPermissions: [PermissionEnum.EVENT_LOCATION_CREATE],
    requestBody: EventLocationCreateInputSchema,
    responseSchema: EventLocationAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as EventLocationCreateInput;
        const result = await eventLocationService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
