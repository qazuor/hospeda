/**
 * GET /api/v1/public/owner-promotions/listing?page=&pageSize=&seed=
 *
 * One page of the `/promociones/` listing (HOS-2589 D-2, AC-31): the current
 * promotions that hang on one published place, newest activation first, resolved
 * for the reader with the same rule as a detail page. The quota applies per page.
 *
 * Optional actor, per-actor body: `Cache-Control: private, no-store` (AC-22).
 */
import { ownerPromotionTouristModel } from '@repo/db';
import {
    OwnerPromotionEntityTypeEnum,
    PromotionListingQuerySchema,
    PromotionListingResponseSchema
} from '@repo/schemas';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createPublicRoute } from '../../../utils/route-factory';
import { markPerActorResponse, resolveForReader, resolveRequestSeed } from './promotion-visibility';

/** Handler, exported standalone so the route test can call it directly. */
export async function handleListingPromotions(
    ctx: Context,
    query: Record<string, unknown> | undefined
) {
    markPerActorResponse({ ctx });
    const { page, pageSize } = PromotionListingQuerySchema.parse(query ?? {});
    const { items: promotions, total } = await ownerPromotionTouristModel.findActiveListingPage({
        page,
        pageSize
    });
    const accommodationIds = new Set<string>();
    const venueIds = new Set<string>();
    for (const promotion of promotions) {
        if (promotion.entityType === OwnerPromotionEntityTypeEnum.VENUE) {
            if (promotion.entityId) venueIds.add(promotion.entityId);
        } else {
            const id = promotion.entityId ?? promotion.accommodationId;
            if (id) accommodationIds.add(id);
        }
    }
    const places = await ownerPromotionTouristModel.findPublicPlaces({
        accommodationIds: [...accommodationIds],
        venueIds: [...venueIds]
    });
    const { items, meta } = await resolveForReader({
        actor: getActorFromContext(ctx),
        promotions,
        places,
        lockGuest: true,
        seed: `${resolveRequestSeed({ raw: query?.seed })}|p${page}`
    });
    return {
        items,
        meta,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    };
}

export const publicListingOwnerPromotionsRoute = createPublicRoute({
    method: 'get',
    path: '/listing',
    summary: 'The promotions listing, resolved for the reader',
    description:
        'Returns one page of current promotions on published places as visible or locked items, with the same free/VIP rule as a detail page (the quota applies per page). Per-actor and never cached.',
    tags: ['Owner Promotions'],
    requestQuery: PromotionListingQuerySchema.shape,
    responseSchema: PromotionListingResponseSchema,
    handler: async (ctx: Context, _params, _body, query) =>
        handleListingPromotions(ctx, query as Record<string, unknown> | undefined),
    options: { customRateLimit: { requests: 200, windowMs: 60000 } }
});
