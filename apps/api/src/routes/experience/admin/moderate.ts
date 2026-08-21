/**
 * Admin moderate experience listing endpoint — HOS-686.
 *
 * The experience twin of `routes/gastronomy/admin/moderate.ts`. Both delegate
 * to the SAME implementation: `moderate()` lives on
 * `BaseCommerceListingService`, which `ExperienceService` and
 * `GastronomyService` both extend, so the two verticals cannot drift apart
 * (HOS-589 G-2). Only the service instance, the response schema and the OpenAPI
 * copy differ here.
 *
 * ## Not to be confused with the review route
 *
 * `POST /reviews/{id}/moderate` (already registered on this router) moderates
 * reviews written ABOUT a listing and is gated by `COMMERCE_MODERATE_REVIEW`.
 * This one moderates the listing itself and is gated by
 * `COMMERCE_MODERATION_CHANGE`. Two authorities, two permissions.
 *
 * @module routes/experience/admin/moderate
 */
import {
    ContentModerationChangeInputSchema,
    ExperienceAdminSchema,
    PermissionEnum
} from '@repo/schemas';
import { ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * POST /api/v1/admin/experiences/:id/moderate
 *
 * @throws 400 if `moderationState` is not a valid moderation status.
 * @throws 403 if the actor lacks `COMMERCE_MODERATION_CHANGE`.
 * @throws 404 if the listing does not exist or is soft-deleted.
 */
export const adminModerateExperienceRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/moderate',
    summary: 'Moderate an experience listing (admin)',
    description:
        'Sets the experience listing moderation state (PENDING | APPROVED | REJECTED). ' +
        'Does not touch visibility directly — the commerce visibility reconciler reacts to ' +
        'REJECTED by flipping the listing to PRIVATE/INACTIVE. Rejecting schedules an edge ' +
        'cache purge so the destination page stops serving it. Requires COMMERCE_MODERATION_CHANGE.',
    tags: ['Experiences', 'Admin'],
    requiredPermissions: [PermissionEnum.COMMERCE_MODERATION_CHANGE],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: ContentModerationChangeInputSchema,
    responseSchema: ExperienceAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { moderationState } = ContentModerationChangeInputSchema.parse(body);

        const result = await experienceService.moderate({
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
