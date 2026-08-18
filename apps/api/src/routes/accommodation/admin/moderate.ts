/**
 * Admin moderate accommodation endpoint — H-102.
 *
 * Applies the platform's moderation verdict to one accommodation. Delegates to
 * `AccommodationService.moderate()`, which gates the action on
 * {@link PermissionEnum.ACCOMMODATION_MODERATION_CHANGE} and writes
 * `moderationState` and nothing else.
 *
 * ## Why this route did not exist
 *
 * Posts and events each had one; accommodations did not. The only moderation
 * route under `routes/accommodation/` moderates REVIEWS, not the listing, so
 * `moderationState` could be written on a listing at creation and never again.
 * Every accommodation row in production sat at `PENDING` — all seven, the two
 * published ones included — while `ModerationAggregationService` counted those
 * pending rows for the admin panel. A queue that counts work nobody can do can
 * only grow.
 *
 * ## What this deliberately does NOT do
 *
 * It does not gate public visibility. Approving does not publish and rejecting
 * does not unpublish; `lifecycleState` and `visibility` keep that job alone.
 * That matches every other content entity — no public read of an
 * accommodation, post, event or destination filters on `moderationState`, so
 * making this one enforce it would have pulled live listings off the site on
 * deploy and left accommodations stricter than posts and events.
 *
 * @module routes/accommodation/admin/moderate
 */
import {
    AccommodationAdminSchema,
    AccommodationIdSchema,
    ContentModerationChangeInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/admin/accommodations/:id/moderate
 *
 * @throws 400 if `moderationState` is not a valid moderation status.
 * @throws 403 if the actor lacks `ACCOMMODATION_MODERATION_CHANGE`.
 * @throws 404 if the accommodation does not exist.
 */
export const adminModerateAccommodationRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/moderate',
    summary: 'Moderate an accommodation (admin)',
    description:
        'Sets the accommodation moderation state (PENDING | APPROVED | REJECTED). Does not touch ' +
        'visibility, so approving does not publish and rejecting does not unpublish. ' +
        'Requires ACCOMMODATION_MODERATION_CHANGE.',
    tags: ['Accommodations', 'Admin'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_MODERATION_CHANGE],
    requestParams: { id: AccommodationIdSchema },
    requestBody: ContentModerationChangeInputSchema,
    responseSchema: AccommodationAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { moderationState } = ContentModerationChangeInputSchema.parse(body);

        const result = await accommodationService.moderate({
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
