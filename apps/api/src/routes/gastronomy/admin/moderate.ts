/**
 * Admin moderate gastronomy listing endpoint — HOS-686.
 *
 * Applies the platform's moderation verdict to one gastronomy listing.
 * Delegates to `GastronomyService.moderate()`, inherited unchanged from
 * `BaseCommerceListingService` so this route and its experience twin resolve to
 * ONE implementation (HOS-589 G-2).
 *
 * ## Why this route did not exist
 *
 * The commerce visibility reconciler already reads
 * `moderationState === REJECTED` and flips the listing to `PRIVATE` /
 * `INACTIVE`, but nothing could write that value: the owner update schemas
 * strip the field on purpose (and a test freezes that), and no commerce service
 * exposed a moderate action. Removing the pre-publication admin gate without
 * this route would leave commerce with no control in either direction.
 *
 * ## Not to be confused with the review route
 *
 * `POST /reviews/{id}/moderate` (already registered on this router) moderates
 * reviews written ABOUT a listing and is gated by `COMMERCE_MODERATE_REVIEW`.
 * This one moderates the listing itself and is gated by
 * `COMMERCE_MODERATION_CHANGE`. Two authorities, two permissions.
 *
 * @module routes/gastronomy/admin/moderate
 */
import {
    ContentModerationChangeInputSchema,
    GastronomyAdminSchema,
    PermissionEnum
} from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * POST /api/v1/admin/gastronomies/:id/moderate
 *
 * @throws 400 if `moderationState` is not a valid moderation status.
 * @throws 403 if the actor lacks `COMMERCE_MODERATION_CHANGE`.
 * @throws 404 if the listing does not exist or is soft-deleted.
 */
export const adminModerateGastronomyRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/moderate',
    summary: 'Moderate a gastronomy listing (admin)',
    description:
        'Sets the gastronomy listing moderation state (PENDING | APPROVED | REJECTED). ' +
        'Does not touch visibility directly — the commerce visibility reconciler reacts to ' +
        'REJECTED by flipping the listing to PRIVATE/INACTIVE. Rejecting schedules an edge ' +
        'cache purge so the destination page stops serving it. Requires COMMERCE_MODERATION_CHANGE.',
    tags: ['Gastronomy', 'Admin'],
    requiredPermissions: [PermissionEnum.COMMERCE_MODERATION_CHANGE],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: ContentModerationChangeInputSchema,
    responseSchema: GastronomyAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { moderationState } = ContentModerationChangeInputSchema.parse(body);

        const result = await gastronomyService.moderate({
            actor,
            id: params.id as string,
            moderationState
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
