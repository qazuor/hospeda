/**
 * Public accommodation reviews list endpoint
 * Returns paginated list of reviews for a specific accommodation.
 * Each review includes `user: { name, image }` from the users table.
 */
import { getDb, users } from '@repo/db';
import {
    AccommodationIdSchema,
    AccommodationReviewPublicSchema,
    AccommodationReviewsByAccommodationHttpSchema
} from '@repo/schemas';
import { AccommodationReviewService, ServiceError } from '@repo/service-core';
import { inArray } from 'drizzle-orm';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createPublicListRoute } from '../../../../utils/route-factory';

/** Safe user fields exposed in public review responses. */
interface PublicUserInfo {
    readonly name: string | null;
    readonly image: string | null;
}

/**
 * GET /api/v1/public/accommodations/:accommodationId/reviews
 * List accommodation reviews - Public endpoint
 */
export const publicListAccommodationReviewsRoute = createPublicListRoute({
    method: 'get',
    path: '/{accommodationId}/reviews',
    summary: 'List accommodation reviews',
    description: 'Returns a paginated list of reviews for a specific accommodation',
    tags: ['Accommodation Reviews'],
    requestParams: {
        accommodationId: AccommodationIdSchema
    },
    requestQuery: AccommodationReviewsByAccommodationHttpSchema.shape,
    responseSchema: AccommodationReviewPublicSchema,
    handler: async (ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const service = new AccommodationReviewService({ logger: apiLogger });
        const result = await service.listByAccommodation(actor, {
            accommodationId: params.accommodationId as string,
            page,
            pageSize,
            sortBy: 'createdAt' as const,
            sortOrder: 'desc' as const
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);

        const reviews = result.data.accommodationReviews || [];

        // Batch-fetch user info for all reviews
        const userIds = [
            ...new Set(
                reviews
                    .map((r) => (r as Record<string, unknown>).userId as string | undefined)
                    .filter((id): id is string => typeof id === 'string')
            )
        ];

        const userMap = new Map<string, PublicUserInfo>();
        if (userIds.length > 0) {
            /**
             * @remarks getDb() is used directly here to batch-fetch a narrow set of
             * non-sensitive user fields (displayName, firstName, lastName, image) for
             * multiple user IDs in a single query. UserService._canView() enforces that
             * only the user themselves or actors with USER_READ_ALL can retrieve a user
             * record, making it incompatible with this public batch enrichment pattern.
             */
            const db = getDb();
            const userRows = await db
                .select({
                    id: users.id,
                    displayName: users.displayName,
                    firstName: users.firstName,
                    lastName: users.lastName,
                    image: users.image
                })
                .from(users)
                .where(inArray(users.id, userIds));

            for (const u of userRows) {
                const name =
                    u.displayName ??
                    (u.firstName && u.lastName
                        ? `${u.firstName} ${u.lastName.charAt(0)}.`
                        : (u.firstName ?? null));
                userMap.set(u.id, { name, image: u.image ?? null });
            }
        }

        const itemsWithUser = reviews.map((review) => {
            const userId = (review as Record<string, unknown>).userId as string | undefined;
            const userInfo = userId ? userMap.get(userId) : undefined;
            return {
                ...review,
                user: userInfo ?? { name: null, image: null }
            };
        });

        return {
            items: itemsWithUser,
            pagination: getPaginationResponse(result.data.total || 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
