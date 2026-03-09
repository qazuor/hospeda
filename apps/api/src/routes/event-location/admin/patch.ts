/**
 * Admin patch event location endpoint
 * Allows admins to partially update any event location
 */
import {
    EventLocationAdminSchema,
    EventLocationIdSchema,
    EventLocationPatchInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { EventLocationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createAdminRoute } from '../../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/event-locations/:id
 * Partial update event location - Admin endpoint
 */
export const adminPatchEventLocationRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update event location (admin)',
    description: 'Updates specific fields of any event location. Admin only.',
    tags: ['Event Locations'],
    requiredPermissions: [PermissionEnum.EVENT_LOCATION_UPDATE],
    requestParams: { id: EventLocationIdSchema },
    requestBody: EventLocationPatchInputSchema,
    responseSchema: EventLocationAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const domainInput = transformApiInputToDomain(body);
        const result = await eventLocationService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: { customRateLimit: { requests: 20, windowMs: 60000 } }
});
