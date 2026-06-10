/**
 * Public destination reviews list endpoint
 * Returns paginated list of reviews for a specific destination.
 * Each review includes `user: { name, image }` from the users table.
 */
import { getDb, users } from '@repo/db';
import {
    DestinationIdSchema,
    DestinationReviewPublicSchema,
    DestinationReviewsByDestinationHttpSchema
} from '@repo/schemas';
import { DestinationReviewService, ServiceError } from '@repo/service-core';
import { inArray } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
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
 * Response shape for this endpoint: review fields + a deliberately-narrower
 * user projection (name + image) so we can batch-enrich without exposing the
 * full UserPublicSchema. Mirrors the accommodation public reviews route.
 */
const PublicReviewWithUserSchema = DestinationReviewPublicSchema.omit({
    user: true,
    destination: true
}).extend({
    user: z.object({
        name: z.string().nullable(),
        image: z.string().nullable()
    })
});

/**
 * GET /api/v1/public/destinations/:destinationId/reviews
 * List destination reviews - Public endpoint
 *
 * Uses `DestinationReviewService.listByDestination()` which force-filters
 * `destinationId` and `lifecycleState=ACTIVE` (GAP-002 / SPEC-063-gaps T-003).
 * Without this, the route silently ignored the `destinationId` path param and
 * returned a global cross-destination review list leaking DRAFT rows.
 */
export const publicListDestinationReviewsRoute = createPublicListRoute({
    method: 'get',
    path: '/{destinationId}/reviews',
    summary: 'List destination reviews',
    description: 'Returns a paginated list of reviews for a specific destination',
    tags: ['Destinations', 'Reviews'],
    requestParams: {
        destinationId: DestinationIdSchema
    },
    requestQuery: DestinationReviewsByDestinationHttpSchema.shape,
    responseSchema: PublicReviewWithUserSchema,
    handler: async (ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const service = new DestinationReviewService({ logger: apiLogger });
        const result = await service.listByDestination(actor, {
            destinationId: params.destinationId as string,
            page,
            pageSize,
            sortBy: 'createdAt' as const,
            sortOrder: 'desc' as const
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);

        const reviews = result.data.data ?? [];

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
                    image: users.image,
                    profile: users.profile
                })
                .from(users)
                .where(inArray(users.id, userIds));

            for (const u of userRows) {
                const name =
                    u.displayName ??
                    (u.firstName && u.lastName
                        ? `${u.firstName} ${u.lastName.charAt(0)}.`
                        : (u.firstName ?? null));
                // The dedicated `users.image` column is currently unpopulated
                // for seeded users; the canonical avatar lives in
                // `profile.avatar` (see `routes/user/public/getBySlug.ts`).
                // Prefer `image` when present so social-login data still wins.
                const profileAvatar =
                    (u.profile as { avatar?: string | null } | null)?.avatar ?? null;
                // Treat empty strings as null so the UI falls back to initials
                // instead of attempting to render an empty <img src="">.
                const image = u.image || profileAvatar || null;
                userMap.set(u.id, { name, image });
            }
        }

        // AC-005: strip admin-only fields (lifecycleState, audit fields, adminInfo)
        // before the response leaves the public tier, then attach the narrow
        // user projection (matches `PublicReviewWithUserSchema`).
        const ReviewWithoutRelations = DestinationReviewPublicSchema.omit({
            user: true,
            destination: true
        });

        const items = reviews.map((review) => {
            const userId = (review as Record<string, unknown>).userId as string | undefined;
            const userInfo = userId ? userMap.get(userId) : undefined;
            const stripped = ReviewWithoutRelations.parse(review);
            return {
                ...stripped,
                user: userInfo ?? { name: null, image: null }
            };
        });

        return {
            items,
            pagination: getPaginationResponse(result.data.pagination.total, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
