/**
 * DELETE /api/v1/protected/accommodations/:id/external-listings/:listingId
 *
 * Soft-deletes an external listing config.
 *
 * SPEC-237 T-008 — protected owner route.
 * Permission: ACCOMMODATION_UPDATE_OWN (service enforces ownership).
 * Returns 204 No Content on success.
 */
import { AccommodationExternalListingModel, AccommodationModel } from '@repo/db';
import {
    AccommodationExternalListingIdSchema,
    AccommodationIdSchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { AccommodationExternalListingService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
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
 * DELETE /api/v1/protected/accommodations/:id/external-listings/:listingId
 *
 * Soft-deletes the external listing config. The reputation cache row is
 * preserved but will no longer be surfaced to public consumers.
 * Returns 204 No Content on success.
 */
export const protectedRemoveExternalListingRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}/external-listings/{listingId}',
    summary: 'Remove external listing config',
    description:
        'Soft-deletes an external listing config. The cached reputation data is preserved but no longer shown publicly.',
    tags: ['Accommodations', 'External Reputation'],
    requestParams: {
        id: AccommodationIdSchema,
        listingId: AccommodationExternalListingIdSchema
    },
    responseSchema: z.object({ deleted: z.boolean() }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const listingId = params.listingId as string;

        const result = await listingService.remove(actor, listingId);

        if (result.error) {
            throw new ServiceError(
                result.error.code as ServiceErrorCode,
                result.error.message,
                result.error.details
            );
        }

        return { deleted: true };
    }
});
