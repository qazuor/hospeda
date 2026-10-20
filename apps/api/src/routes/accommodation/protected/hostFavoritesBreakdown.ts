/**
 * Host favorites per-accommodation breakdown endpoint — SPEC-155 T-005.
 *
 * Returns a per-accommodation bookmark count for every accommodation owned by
 * the authenticated host. The result is scoped strictly to `ownerId = actor.id`
 * so a host can never observe counts for another owner's listings.
 *
 * @route GET /api/v1/protected/accommodations/my/favorites-breakdown
 */

import { EntityTypeEnum, HostFavoritesBreakdownSchema, VerticalEnum } from '@repo/schemas';
import { AccommodationService, ServiceError, UserBookmarkService } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { enforceUserGate } from '../../../utils/listing-access/user-gate';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });
const bookmarkService = new UserBookmarkService({ logger: apiLogger });

/**
 * GET /api/v1/protected/accommodations/my/favorites-breakdown
 *
 * For each accommodation owned by the authenticated host, returns the total
 * number of bookmarks/favorites that accommodation has received from any user.
 *
 * Scope enforcement:
 * - `ownerId` is always derived from `actor.id` — never from a query param.
 * - The host only sees their own accommodations, regardless of volume.
 *
 * No pagination: the number of accommodations per host is bounded and small
 * enough to return in full for dashboard use cases.
 * Reads the owner's effective view_advanced_stats capability before returning statistics.
 */
export const hostFavoritesBreakdownRoute = createProtectedRoute({
    method: 'get',
    path: '/my/favorites-breakdown',
    summary: 'Get favorites count per accommodation (host)',
    description:
        'Returns the bookmark/favorites count for each accommodation owned by the ' +
        'authenticated host. Scoped to ownerId = actor.id. Intended for the host ' +
        'dashboard (SPEC-155 T-005).',
    tags: ['Accommodations'],
    responseSchema: HostFavoritesBreakdownSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);
        await enforceUserGate({
            userId: actor.id,
            vertical: VerticalEnum.ACCOMMODATION,
            keys: ['view_advanced_stats']
        });

        // List all accommodations owned by this host (all lifecycle states so the
        // host sees bookmarks on drafts / archived listings too).
        const listResult = await accommodationService.list(actor, {
            where: { ownerId: actor.id },
            page: 1,
            // A single host is unlikely to exceed this; for very prolific hosts
            // this is still a reasonable upper bound for a dashboard widget.
            pageSize: 500,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        });

        if (listResult.error) {
            throw new ServiceError(listResult.error.code, listResult.error.message);
        }

        const accommodations = listResult.data?.items ?? [];

        // Count bookmarks for each accommodation in parallel.
        const breakdown = await Promise.all(
            accommodations.map(async (accommodation) => {
                const countResult = await bookmarkService.countBookmarksForEntity(actor, {
                    entityId: accommodation.id,
                    entityType: EntityTypeEnum.ACCOMMODATION
                });

                const bookmarkCount = countResult.data?.count ?? 0;

                return {
                    accommodationId: accommodation.id,
                    slug: accommodation.slug,
                    bookmarkCount
                };
            })
        );

        return breakdown;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
