/**
 * Protected venue get-by-ID endpoint (T-043)
 * Returns a venue listing with owner-tier projection for the authenticated
 * owner. Non-owners without the VENUE_VIEW_ALL bypass permission receive
 * NOT_FOUND so that owner-private fields (contactInfo, ownerId,
 * lifecycleState, richDescription, audit dates) are never leaked.
 */
import { PermissionEnum, VenueProtectedSchema } from '@repo/schemas';
import { entityNotFoundError, ServiceError, VenueService } from '@repo/service-core';
import { readListingAccessFacts, resolveResourceStep } from '@repo/verticals';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * GET /api/v1/protected/venues/:id
 * Get venue listing by ID — Protected endpoint (owner view only).
 *
 * The resource step admits only the owner, or an actor
 * holding VENUE_VIEW_ALL (staff / admin) may retrieve this endpoint.
 * Non-owners receive NOT_FOUND to prevent leaking owner-private fields exposed
 * by VenueProtectedSchema (contactInfo, lifecycleState, audit dates).
 * The write path (updateOwn) retains its own ownership gate and is unaffected.
 */
export const protectedGetVenueByIdRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get gastronomy listing by ID (protected)',
    description:
        'Returns a gastronomy listing with owner-tier fields. Only the owner or staff with VENUE_VIEW_ALL may access this endpoint.',
    tags: ['Venue'],
    emailUnverifiedOperation: 'READ_OWN',
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: VenueProtectedSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await venueService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const entity = result.data;

        // Ownership gate: only the owner or a staff actor with VENUE_VIEW_ALL
        // may read owner-private fields through the protected tier.
        // HOS-600: composed by the shared helper so this branch is byte-identical
        // to the missing-row 404 the service raises above. The literal it replaces
        // (`'Venue not found'`) differed from the service's
        // `'venue not found'` by one capital letter, which was enough to tell
        // a caller that the id they were holding is real.
        const hasViewAll = actor.permissions?.includes(PermissionEnum.VENUE_VIEW_ALL);
        if (!hasViewAll) {
            const access = resolveResourceStep({
                actorId: actor.id,
                facts: readListingAccessFacts({ entity }),
                operation: 'READ_OWN'
            });
            if (!access.allowed) {
                throw entityNotFoundError({ entityName: VenueService.ENTITY_NAME });
            }
        }

        if (!entity) {
            return null;
        }

        // Seed the owner editor's amenity/feature multi-select: the protected
        // schema carries these read-back IDs, which the entity projection does
        // not include (junction relations live in separate tables).
        const { amenityIds, featureIds } = await venueService.loadJunctionIds(entity.id);
        return { ...entity, amenityIds, featureIds };
    }
});
