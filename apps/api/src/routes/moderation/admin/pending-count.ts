/**
 * Admin moderation pending-count endpoint — SPEC-155 T-010.
 *
 * Returns the total count of content items in PENDING moderation state across
 * the four main content entities (accommodations, destinations, posts, events).
 * Intended for the admin dashboard moderation widget.
 *
 * Permission: ACCOMMODATION_MODERATION_CHANGE — the only cross-entity moderation
 * permission currently present in PermissionEnum. Any admin actor that can change
 * moderation state is implicitly authorised to read the pending-count aggregate.
 *
 * @module routes/moderation/admin/pending-count
 * @see SPEC-155 T-010
 */
import { ModerationPendingCountSchema, PermissionEnum } from '@repo/schemas';
import { ModerationAggregationService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const moderationService = new ModerationAggregationService();

/**
 * GET /api/v1/admin/moderation/pending-count
 *
 * Returns `{ total, byEntity }` where `byEntity` is a breakdown per entity
 * (accommodations, destinations, posts, events) of items awaiting moderation review.
 *
 * Only non-deleted rows are counted. The four queries run in parallel.
 * Response is cached for 60 seconds to reduce DB load on repeated dashboard loads.
 */
export const adminModerationPendingCountRoute = createAdminRoute({
    method: 'get',
    path: '/pending-count',
    summary: 'Get moderation pending count (admin)',
    description:
        'Returns the count of PENDING moderation items across accommodations, destinations, ' +
        'posts, and events. Intended for the admin dashboard moderation widget. ' +
        'Requires ACCOMMODATION_MODERATION_CHANGE permission.',
    tags: ['Moderation'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_MODERATION_CHANGE],
    responseSchema: ModerationPendingCountSchema,
    handler: async (ctx) => {
        const actor = getActorFromContext(ctx);

        const result = await moderationService.getPendingCount(actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        apiLogger.debug({ total: result.data?.total }, 'adminModerationPendingCountRoute: result');

        return result.data;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
