/**
 * GET /api/v1/protected/accommodations/:id/external-listings
 *
 * Returns all (non-deleted) external listing configs for the accommodation.
 *
 * SPEC-237 T-008 — protected owner route.
 * Permission: ACCOMMODATION_UPDATE_OWN (the service pattern enforces ownership;
 * this read-only list applies the same check inline).
 */
import { AccommodationExternalListingModel, AccommodationModel } from '@repo/db';
import {
    AccommodationExternalListingSchema,
    AccommodationIdSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const listingModel = new AccommodationExternalListingModel();
const accommodationModel = new AccommodationModel();

/**
 * GET /api/v1/protected/accommodations/:id/external-listings
 *
 * Lists all non-deleted external listing configurations for the accommodation.
 * The actor must own the accommodation or hold ACCOMMODATION_UPDATE_ANY.
 */
export const protectedListExternalListingsRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/external-listings',
    summary: 'List external listing configs',
    description:
        'Returns all non-deleted external platform listing configs registered for the accommodation. Requires ownership or ACCOMMODATION_UPDATE_ANY.',
    tags: ['Accommodations', 'External Reputation'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: z.array(AccommodationExternalListingSchema),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        const accommodation = await accommodationModel.findById(accommodationId);
        if (!accommodation || accommodation.deletedAt !== null) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                `Accommodation not found: ${accommodationId}`
            );
        }

        const hasAny = (actor.permissions ?? []).includes(PermissionEnum.ACCOMMODATION_UPDATE_ANY);
        const hasOwn = (actor.permissions ?? []).includes(PermissionEnum.ACCOMMODATION_UPDATE_OWN);

        if (!hasAny && !(hasOwn && actor.id === accommodation.ownerId)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: ACCOMMODATION_UPDATE_OWN required and actor must own the accommodation'
            );
        }

        const rows = await listingModel.findByAccommodation(accommodationId);

        apiLogger.debug({
            message: 'Listed external listings',
            accommodationId,
            count: rows.length,
            actorId: actor.id
        });

        return rows;
    }
});
