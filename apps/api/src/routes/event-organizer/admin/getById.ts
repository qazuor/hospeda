/**
 * Admin get event organizer by ID endpoint
 * Returns full event organizer information including admin fields
 */
import { EventOrganizerAdminSchema, EventOrganizerIdSchema, PermissionEnum } from '@repo/schemas';
import { EventOrganizerService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventOrganizerService = new EventOrganizerService({ logger: apiLogger });

/**
 * GET /api/v1/admin/event-organizers/:id
 * Get event organizer by ID - Admin endpoint
 */
export const adminGetEventOrganizerByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get event organizer by ID (admin)',
    description: 'Retrieves full event organizer information including admin fields',
    tags: ['Event Organizers'],
    requiredPermissions: [PermissionEnum.EVENT_ORGANIZER_VIEW],
    requestParams: {
        id: EventOrganizerIdSchema
    },
    responseSchema: EventOrganizerAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventOrganizerService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
