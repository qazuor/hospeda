/**
 * Host favorites per-accommodation breakdown endpoint — SPEC-155 T-005.
 *
 * Returns a per-accommodation bookmark count for every accommodation owned by
 * the authenticated host. The result is scoped strictly to `ownerId = actor.id`
 * so a host can never observe counts for another owner's listings.
 *
 * @route GET /api/v1/protected/accommodations/my/favorites-breakdown
 */
import { EntitlementKey } from '@repo/billing';
import { EntityTypeEnum, HostFavoritesBreakdownSchema } from '@repo/schemas';
import { AccommodationService, ServiceError, UserBookmarkService } from '@repo/service-core';
import type { Context } from 'hono';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { getActorFromContext } from '../../../utils/actor';
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
        // SPEC-145 T-006: VIEW_ADVANCED_STATS gate — per-accommodation bookmark
        // analytics are an advanced stats feature gated behind owner-pro / owner-premium
        // / complex-pro / complex-premium plans.
        middlewares: [requireEntitlement(EntitlementKey.VIEW_ADVANCED_STATS)],
        cacheTTL: 60,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
