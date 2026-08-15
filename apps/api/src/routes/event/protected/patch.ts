/**
 * Protected patch event endpoint
 * Requires authentication and ownership
 */
import {
    EventIdSchema,
    EventProtectedSchema,
    EventUpdateHttpSchema,
    PermissionEnum
} from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { toEventDomainUpdate } from './to-domain-update';

const eventService = new EventService({ logger: apiLogger });

/**
 * PATCH /api/v1/protected/events/:id
 * Partial update event - Protected endpoint with ownership check
 */
export const protectedPatchEventRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Patch event',
    description: 'Partially updates an event. Requires ownership or EVENT_UPDATE_ANY permission.',
    tags: ['Events'],
    requestParams: {
        id: EventIdSchema
    },
    requestBody: EventUpdateHttpSchema.partial(),
    responseSchema: EventProtectedSchema,
    ownership: {
        entityType: 'event',
        ownershipFields: ['authorId'],
        bypassPermission: PermissionEnum.EVENT_UPDATE
    },
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        // Convert HTTP input to domain input, through the same helper the PUT on
        // this resource uses. This route used to forward the raw body straight
        // to the service, so `startDate`/`endDate` arrived under their HTTP
        // names and the strict domain schema rejected them with a 400, while
        // `summary` (derived from `description`) was never produced at all
        // (H-30).
        const domainInput = toEventDomainUpdate({ body });
        const result = await eventService.update(actor, params.id as string, domainInput);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
