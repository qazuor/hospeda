/**
 * Admin list of host replies to accommodation reviews (HOS-2675).
 *
 * The moderation queue for replies: without this an admin can act on a reply id
 * but has no way to find one. Newest first, live replies only.
 *
 * @route GET /api/v1/admin/accommodations/reviews/replies
 */
import {
    AccommodationReviewReplyAdminItemSchema,
    type AccommodationReviewReplyAdminListQuery,
    AccommodationReviewReplyAdminListQuerySchema,
    PermissionEnum
} from '@repo/schemas';
import { AccommodationReviewReplyAdminService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

const replyAdminService = new AccommodationReviewReplyAdminService({ logger: apiLogger });

export const adminListAccommodationReviewRepliesRoute = createAdminListRoute({
    method: 'get',
    path: '/replies',
    summary: 'List host replies to accommodation reviews (admin)',
    description:
        'Returns a paginated moderation queue of live host replies, newest first. Requires ACCOMMODATION_REVIEW_MODERATE.',
    tags: ['Accommodation Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_REVIEW_MODERATE],
    requestQuery: AccommodationReviewReplyAdminListQuerySchema.omit({
        page: true,
        pageSize: true
    }).shape,
    responseSchema: AccommodationReviewReplyAdminItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const filters = (query || {}) as Partial<AccommodationReviewReplyAdminListQuery>;

        const result = await replyAdminService.listForModeration({
            page,
            pageSize,
            accommodationId: filters.accommodationId,
            moderationState: filters.moderationState,
            actor
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items ?? [],
            pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
        };
    }
});
