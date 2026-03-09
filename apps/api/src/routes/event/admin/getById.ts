/**
 * Admin get event by ID endpoint
 * Returns full event information including admin fields
 */
import { EventAdminSchema, EventIdSchema, PermissionEnum } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * GET /api/v1/admin/events/:id
 * Get event by ID - Admin endpoint
 */
export const adminGetEventByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get event by ID (admin)',
    description: 'Retrieves full event information including admin fields',
    tags: ['Events'],
    requiredPermissions: [PermissionEnum.EVENT_VIEW_ALL],
    requestParams: {
        id: EventIdSchema
    },
    responseSchema: EventAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventService.getById(actor, params.id as string);

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
