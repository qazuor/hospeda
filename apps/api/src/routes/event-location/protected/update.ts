/**
 * Protected update event location endpoint
 * Requires authentication and ownership
 */
import {
    EventLocationIdSchema,
    EventLocationProtectedSchema,
    type EventLocationUpdateHttp,
    EventLocationUpdateHttpSchema,
    type EventLocationUpdateInput,
    httpToDomainEventLocationUpdate,
    PermissionEnum
} from '@repo/schemas';
import { EventLocationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

/**
 * PUT /api/v1/protected/event-locations/:id
 * Update event location - Protected endpoint with ownership check
 */
export const protectedUpdateEventLocationRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update event location',
    description:
        'Updates an existing event location. Requires ownership or EVENT_LOCATION_UPDATE permission.',
    tags: ['Event Locations'],
    requestParams: {
        id: EventLocationIdSchema
    },
    requestBody: EventLocationUpdateHttpSchema,
    responseSchema: EventLocationProtectedSchema,
    ownership: {
        entityType: 'eventLocation',
        ownershipFields: ['ownerId', 'createdById'],
        bypassPermission: PermissionEnum.EVENT_LOCATION_UPDATE
    },
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        // `httpToDomainEventLocationUpdate` nests `latitude`/`longitude` into
        // `coordinates.{lat,long}` as strings. This route used to forward the raw
        // body, and `EventLocationUpdateInputSchema` is `.strict()`, so the flat
        // pair arrived unrecognized and the request 400'd (HOS-573).
        const domainInput: EventLocationUpdateInput = httpToDomainEventLocationUpdate(
            body as EventLocationUpdateHttp
        );
        const result = await eventLocationService.update(actor, params.id as string, domainInput);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
