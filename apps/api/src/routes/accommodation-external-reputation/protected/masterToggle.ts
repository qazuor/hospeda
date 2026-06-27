/**
 * PATCH /api/v1/protected/accommodations/:id/external-reputation/master-toggle
 *
 * Flips the `accommodations.showExternalReputation` master toggle.
 *
 * SPEC-237 T-008 — protected owner route.
 * Permission: ACCOMMODATION_UPDATE_OWN (service enforces ownership).
 */
import { AccommodationExternalListingModel, AccommodationModel } from '@repo/db';
import { AccommodationIdSchema, type ServiceErrorCode } from '@repo/schemas';
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

/** Request body for the master-toggle endpoint. */
const MasterToggleBodySchema = z.object({
    /**
     * New value for `accommodations.showExternalReputation`.
     * When false, all external reputation blocks are hidden from the public
     * detail page regardless of individual listing flags.
     */
    value: z.boolean({ error: 'value must be a boolean and is required' })
});

const MasterToggleResponseSchema = z.object({ updated: z.boolean() });

/**
 * PATCH /api/v1/protected/accommodations/:id/external-reputation/master-toggle
 *
 * Sets the master visibility toggle for the external reputation block.
 * Returns `{ updated: true }` on success.
 */
export const protectedMasterToggleRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}/external-reputation/master-toggle',
    summary: 'Set external reputation master toggle',
    description:
        'Flips the master show/hide switch for the external reputation block on the public accommodation detail page.',
    tags: ['Accommodations', 'External Reputation'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: MasterToggleBodySchema,
    responseSchema: MasterToggleResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;
        const { value } = body as { value: boolean };

        const result = await listingService.setMasterToggle(actor, accommodationId, value);

        if (result.error) {
            throw new ServiceError(
                result.error.code as ServiceErrorCode,
                result.error.message,
                result.error.details
            );
        }

        return { updated: true };
    }
});
