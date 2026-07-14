/**
 * Admin point-of-interest ↔ destination relation routes (HOS-143 T-011).
 *
 * Mounted under `/{id}/destinations` on the point-of-interest admin router.
 * Permission decision (spec §7.5 Decision 1): every route here uses
 * `POINT_OF_INTEREST_*` permissions, NOT a dedicated
 * `DESTINATION_POINT_OF_INTEREST_MANAGE` permission — consistent with
 * `point-of-interest.permissions.ts`'s file-level convention (create≈add,
 * update≈update-relation, delete≈remove), and mirroring
 * `PointOfInterestService._canUpdatePointOfInterestDestinationRelation`'s own
 * deviation note.
 */
import {
    DestinationIdSchema,
    DestinationPointOfInterestRelationSchema,
    PermissionEnum,
    PointOfInterestAddToDestinationInputSchema,
    type PointOfInterestDestinationListItem,
    PointOfInterestDestinationListItemSchema,
    PointOfInterestDestinationRelationEnum,
    PointOfInterestIdSchema,
    type PointOfInterestUpdateDestinationRelationInput,
    PointOfInterestUpdateDestinationRelationInputSchema
} from '@repo/schemas';
import { PointOfInterestService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const pointOfInterestService = new PointOfInterestService({ logger: apiLogger });

/**
 * GET /api/v1/admin/points-of-interest/:id/destinations
 *
 * Lists every destination a point of interest is associated with, including
 * the relation kind (PRIMARY/NEARBY, HOS-140) per destination.
 *
 * `PointOfInterestService.getDestinationsByPointOfInterest` is deliberately
 * relation-blind (documented on the service method itself — the reverse
 * question "which destinations reference this POI" doesn't distinguish
 * PRIMARY/NEARBY), so it only returns the destination rows themselves. The
 * relation kind for each one is resolved via the reverse, relation-aware
 * lookup (`getPointsOfInterestForDestination` with `relation: 'ALL'`) and
 * matched back to this POI's id. This is an N+1 over destinations, which is
 * acceptable here: a POI rarely belongs to more than a handful of
 * destinations, and this is an admin-only detail listing, not a hot path.
 */
export const adminGetPointOfInterestDestinationsRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/destinations',
    summary: 'List destinations for a point of interest (admin)',
    description:
        'Retrieves every destination a point of interest is associated with, including the PRIMARY/NEARBY relation kind per destination.',
    tags: ['PointsOfInterest'],
    requiredPermissions: [PermissionEnum.POINT_OF_INTEREST_VIEW],
    requestParams: {
        id: PointOfInterestIdSchema
    },
    responseSchema: z.array(PointOfInterestDestinationListItemSchema),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const pointOfInterestId = params.id as string;

        const destinationsResult = await pointOfInterestService.getDestinationsByPointOfInterest(
            actor,
            // page/pageSize are accepted by the schema but unused by this
            // method's execute() — it always returns the full relation set.
            { pointOfInterestId, page: 1, pageSize: 100 }
        );
        if (destinationsResult.error) {
            throw new ServiceError(destinationsResult.error.code, destinationsResult.error.message);
        }

        const destinations = destinationsResult.data?.destinations ?? [];

        const items: PointOfInterestDestinationListItem[] = await Promise.all(
            destinations.map(async (destination) => {
                const relationResult =
                    await pointOfInterestService.getPointsOfInterestForDestination(
                        actor,
                        // page/pageSize are accepted by the schema but unused by
                        // this method's execute() — it always returns the full set.
                        { destinationId: destination.id, relation: 'ALL', page: 1, pageSize: 100 }
                    );
                if (relationResult.error) {
                    throw new ServiceError(relationResult.error.code, relationResult.error.message);
                }

                const match = relationResult.data?.pointsOfInterest.find(
                    (poi) => poi.id === pointOfInterestId
                );

                return {
                    destinationId: destination.id,
                    destinationName: destination.name,
                    destinationSlug: destination.slug,
                    relation: match?.relation ?? PointOfInterestDestinationRelationEnum.PRIMARY
                };
            })
        );

        return items;
    }
});

/**
 * POST /api/v1/admin/points-of-interest/:id/destinations
 *
 * Links a point of interest to a destination. `relation` (HOS-140) is
 * optional in the body and defaults to `PRIMARY`. Returns 409 ALREADY_EXISTS
 * when the pair is already linked (AC-3).
 */
export const adminAddPointOfInterestDestinationRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/destinations',
    summary: 'Add point of interest to a destination (admin)',
    description:
        'Links a point of interest to a destination with the given relation kind (PRIMARY/NEARBY, HOS-140). Defaults to PRIMARY when omitted. Fails with ALREADY_EXISTS if the pair is already linked.',
    tags: ['PointsOfInterest'],
    requiredPermissions: [PermissionEnum.POINT_OF_INTEREST_CREATE],
    requestParams: {
        id: PointOfInterestIdSchema
    },
    requestBody: PointOfInterestAddToDestinationInputSchema.omit({ pointOfInterestId: true }),
    responseSchema: z.object({ relation: DestinationPointOfInterestRelationSchema }),
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const pointOfInterestId = params.id as string;
        const { destinationId, relation } = body as {
            destinationId: string;
            relation: PointOfInterestDestinationRelationEnum;
        };

        const result = await pointOfInterestService.addPointOfInterestToDestination(actor, {
            pointOfInterestId,
            destinationId,
            relation
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

/**
 * PATCH /api/v1/admin/points-of-interest/:id/destinations/:destinationId
 *
 * Updates the relation kind (PRIMARY/NEARBY, HOS-140) of an EXISTING
 * point-of-interest-destination link. Never creates the link — returns 404
 * NOT_FOUND if it doesn't already exist (AC-4). Use the POST route above to
 * create a new link.
 */
export const adminUpdatePointOfInterestDestinationRelationRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}/destinations/{destinationId}',
    summary: 'Update a point-of-interest-destination relation kind (admin)',
    description:
        "Updates the PRIMARY/NEARBY relation kind of an EXISTING point-of-interest-destination link. Does NOT create the link — returns NOT_FOUND if it doesn't already exist.",
    tags: ['PointsOfInterest'],
    requiredPermissions: [PermissionEnum.POINT_OF_INTEREST_UPDATE],
    requestParams: {
        id: PointOfInterestIdSchema,
        destinationId: DestinationIdSchema
    },
    requestBody: PointOfInterestUpdateDestinationRelationInputSchema.omit({
        destinationId: true,
        pointOfInterestId: true
    }),
    responseSchema: z.object({ relation: DestinationPointOfInterestRelationSchema }),
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const pointOfInterestId = params.id as string;
        const destinationId = params.destinationId as string;
        const { relation } = body as Pick<
            PointOfInterestUpdateDestinationRelationInput,
            'relation'
        >;

        const result = await pointOfInterestService.updatePointOfInterestDestinationRelation(
            actor,
            {
                pointOfInterestId,
                destinationId,
                relation
            }
        );

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

/**
 * DELETE /api/v1/admin/points-of-interest/:id/destinations/:destinationId
 *
 * Soft-deletes the point-of-interest-destination link.
 */
export const adminRemovePointOfInterestDestinationRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/destinations/{destinationId}',
    summary: 'Remove point of interest from a destination (admin)',
    description: 'Soft-deletes the point-of-interest-destination link.',
    tags: ['PointsOfInterest'],
    requiredPermissions: [PermissionEnum.POINT_OF_INTEREST_DELETE],
    requestParams: {
        id: PointOfInterestIdSchema,
        destinationId: DestinationIdSchema
    },
    responseSchema: z.object({ deleted: z.boolean() }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const pointOfInterestId = params.id as string;
        const destinationId = params.destinationId as string;

        const result = await pointOfInterestService.removePointOfInterestFromDestination(actor, {
            pointOfInterestId,
            destinationId
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { deleted: true };
    }
});
