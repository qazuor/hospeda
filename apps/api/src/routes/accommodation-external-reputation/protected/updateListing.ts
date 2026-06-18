/**
 * PATCH /api/v1/protected/accommodations/:id/external-listings/:listingId
 *
 * Updates URL / toggle flags on an existing external listing config.
 *
 * SPEC-237 T-008 — protected owner route.
 * Permission: ACCOMMODATION_UPDATE_OWN (service enforces ownership).
 */
import { AccommodationExternalListingModel, AccommodationModel } from '@repo/db';
import {
    AccommodationExternalListingIdSchema,
    AccommodationExternalListingSchema,
    AccommodationIdSchema,
    type ServiceErrorCode,
    UpdateAccommodationExternalListingSchema
} from '@repo/schemas';
import { AccommodationExternalListingService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const listingModel = new AccommodationExternalListingModel();
const accommodationModel = new AccommodationModel();
const listingService = new AccommodationExternalListingService(
    { logger: apiLogger },
    listingModel,
    accommodationModel
);

/**
 * PATCH /api/v1/protected/accommodations/:id/external-listings/:listingId
 *
 * Updates URL and/or toggle flags on an existing external listing config.
 * Platform is immutable — change it by deleting and re-creating the listing.
 */
export const protectedUpdateExternalListingRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}/external-listings/{listingId}',
    summary: 'Update external listing config',
    description:
        'Updates URL and/or visibility toggle flags on an external listing config. Platform cannot be changed after creation.',
    tags: ['Accommodations', 'External Reputation'],
    requestParams: {
        id: AccommodationIdSchema,
        listingId: AccommodationExternalListingIdSchema
    },
    requestBody: UpdateAccommodationExternalListingSchema,
    responseSchema: AccommodationExternalListingSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const listingId = params.listingId as string;

        const result = await listingService.update(
            actor,
            listingId,
            body as Parameters<typeof listingService.update>[2]
        );

        if (result.error) {
            throw new ServiceError(
                result.error.code as ServiceErrorCode,
                result.error.message,
                result.error.details
            );
        }

        return result.data;
    }
});
