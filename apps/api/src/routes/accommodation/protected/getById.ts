/**
 * Protected get own accommodation by ID endpoint
 * Returns a single accommodation only if it is owned by the authenticated user.
 */
import {
    AccommodationIdSchema,
    AccommodationProtectedSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/protected/accommodations/:id
 * Get own accommodation by ID - Protected endpoint
 *
 * Returns the accommodation only if the authenticated user is the owner
 * (`ownerId === actor.id`) or holds ACCOMMODATION_UPDATE_ANY permission.
 * Returns 404 if the record is not found or belongs to a different user.
 */
export const protectedGetOwnAccommodationByIdRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get own accommodation by ID',
    description:
        'Returns a single accommodation owned by the authenticated user. Returns 404 if not found or not owned by the requesting user.',
    tags: ['Accommodations'],
    // No permission gate: the handler enforces ownership in the service
    // layer and returns 404 if the row belongs to a different user. The
    // previous `ACCOMMODATION_LISTING_VIEW` requirement was the admin
    // listing permission, not granted to default HOST users — so hosts
    // could not even read their own properties through the web UI.
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationProtectedSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        const result = await accommodationService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const accommodation = result.data;

        // Ownership check: only return if the actor is the owner.
        // ACCOMMODATION_UPDATE_ANY bypasses the ownership check (admin-level perm).
        const hasUpdateAny = actor.permissions?.includes(PermissionEnum.ACCOMMODATION_UPDATE_ANY);
        if (!hasUpdateAny && accommodation?.ownerId !== actor.id) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
        }

        return accommodation ?? null;
    }
});
