/**
 * GET /api/v1/public/owner-promotions/visible?entityType=&entityId=&seed=
 *
 * One place's current promotions, resolved for the reader (HOS-2589 §7.5, D-1):
 * a VIP tourist sees every one; anybody else (a free tourist or an anonymous
 * visitor) sees up to the catalog's `max_free_visible_promotions` «para todos»
 * promotions in full, picked by the seed, and the rest as locked items that carry
 * only the value, the type and a placeholder name (AC-5, AC-8, AC-29).
 *
 * Optional actor, per-actor body: `Cache-Control: private, no-store` (AC-22).
 * A place that is not published answers 404.
 */
import {
    type OwnerPromotionEntityTypeEnum,
    PromotionVisibleQuerySchema,
    PromotionVisibleResponseSchema
} from '@repo/schemas';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createPublicRoute } from '../../../utils/route-factory';
import {
    loadPlacePromotions,
    markPerActorResponse,
    resolveForReader,
    resolveRequestSeed
} from './promotion-visibility';

/** Handler, exported standalone so the route test can call it directly. */
export async function handleVisiblePromotions(
    ctx: Context,
    query: Record<string, unknown> | undefined
) {
    markPerActorResponse({ ctx });
    const entityType = query?.entityType as OwnerPromotionEntityTypeEnum;
    const entityId = query?.entityId as string;
    const { promotions, places } = await loadPlacePromotions({ entityType, entityId });
    return resolveForReader({
        actor: getActorFromContext(ctx),
        promotions,
        places,
        seed: resolveRequestSeed({ raw: query?.seed })
    });
}

export const publicVisibleOwnerPromotionsRoute = createPublicRoute({
    method: 'get',
    path: '/visible',
    summary: "One place's promotions, resolved for the reader",
    description:
        'Returns the current promotions of a published accommodation or venue as visible or locked items. VIP tourists see all; free tourists and anonymous visitors see up to the catalog quota of «para todos» promotions, picked by the seed. Per-actor and never cached.',
    tags: ['Owner Promotions'],
    requestQuery: PromotionVisibleQuerySchema.shape,
    responseSchema: PromotionVisibleResponseSchema,
    handler: async (ctx: Context, _params, _body, query) =>
        handleVisiblePromotions(ctx, query as Record<string, unknown> | undefined),
    options: { customRateLimit: { requests: 200, windowMs: 60000 } }
});
