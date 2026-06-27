/**
 * POST /api/v1/protected/accommodations/:id/external-listings
 *
 * Adds a new external listing config for the accommodation.
 *
 * SPEC-237 T-008 — protected owner route.
 * Permission: ACCOMMODATION_UPDATE_OWN (service enforces ownership).
 * Returns 400 when the same platform already has a listing (DUPLICATE_PLATFORM).
 */
import { AccommodationExternalListingModel, AccommodationModel } from '@repo/db';
import {
    AccommodationExternalListingSchema,
    AccommodationIdSchema,
    CreateAccommodationExternalListingSchema,
    type ServiceErrorCode
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
 * POST /api/v1/protected/accommodations/:id/external-listings
 *
 * Creates a new external listing configuration. Returns 201 on success.
 * Returns 400 when the same platform already has a listing for this accommodation.
 */
export const protectedAddExternalListingRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/external-listings',
    summary: 'Add external listing config',
    description:
        'Registers a new external platform listing for the accommodation. Each platform may only be registered once per accommodation.',
    tags: ['Accommodations', 'External Reputation'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: CreateAccommodationExternalListingSchema.omit({ accommodationId: true }),
    responseSchema: AccommodationExternalListingSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        const result = await listingService.add(actor, {
            accommodationId,
            ...body
        } as Parameters<typeof listingService.add>[1]);

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
