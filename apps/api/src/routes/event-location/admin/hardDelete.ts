/**
 * Admin hard delete event location endpoint
 * Permanently deletes an event location
 */
import { EventLocationIdSchema, PermissionEnum, type ServiceErrorCode } from '@repo/schemas';
import { EventLocationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/event-locations/:id/hard
 * Hard delete event location - Admin endpoint
 */
export const adminHardDeleteEventLocationRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete event location',
    description:
        'Permanently deletes an event location. Requires EVENT_LOCATION_HARD_DELETE permission.',
    tags: ['Event Locations'],
    requiredPermissions: [PermissionEnum.EVENT_LOCATION_HARD_DELETE],
    requestParams: {
        id: EventLocationIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventLocationService.hardDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            success: true,
            message: 'Event location permanently deleted'
        };
    }
});
