/**
 * Admin patch event endpoint
 * Allows admins to partially update any event
 */
import {
    EventAdminSchema,
    EventIdSchema,
    EventPatchInputSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createAdminRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/events/:id
 * Partial update event - Admin endpoint
 */
export const adminPatchEventRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update event (admin)',
    description: 'Updates specific fields of any event. Admin only.',
    tags: ['Events'],
    requiredPermissions: [PermissionEnum.EVENT_UPDATE],
    requestParams: { id: EventIdSchema },
    requestBody: EventPatchInputSchema,
    responseSchema: EventAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const domainInput = transformApiInputToDomain(body);

        const result = await eventService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 }
    }
});
