/**
 * Protected exclusive-deals list endpoint (HOS-21 T-008/T-009)
 *
 * Tourist-facing listing of owner promotions scoped by touristAudience tier.
 * Reuses `OwnerPromotionService.findExclusiveDeals` (T-005/T-006) — NOT the
 * public `search()`/`list.ts` path used by `PromotionBanner`, which stays
 * ungated and untouched.
 *
 * Gated by `gateExclusiveDeals()` (EXCLUSIVE_DEALS entitlement — granted to
 * both tourist-plus and tourist-vip). A caller who additionally carries
 * VIP_PROMOTIONS_ACCESS (tourist-vip only) sees 'plus' + 'vip' rows; everyone
 * else sees 'plus' only (HOS-21 D1, additive VIP tier).
 *
 * Mounted at `/exclusive-deals`, a distinct path from `/` (list) and `/{id}`
 * (get/update/patch/delete) — per the Destination Hierarchy Routes precedent
 * (`docs/...`: "the by-path route is registered before :id routes to avoid
 * conflicts"), this file's route is registered before `get.ts` in
 * `protected/index.ts` so the literal path isn't swallowed by `/{id}`.
 */
import { EntitlementKey } from '@repo/billing';
import { OwnerPromotionListItemSchema, TouristAudienceEnum } from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { hasEntitlement } from '../../../middlewares/entitlement';
import { gateExclusiveDeals } from '../../../middlewares/tourist-entitlements';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createProtectedListRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * GET /api/v1/protected/owner-promotions/exclusive-deals
 * List exclusive deals visible to the authenticated tourist's plan tier.
 */
export const protectedListExclusiveDealsRoute = createProtectedListRoute({
    method: 'get',
    path: '/exclusive-deals',
    summary: 'List exclusive deals',
    description:
        "Returns active owner promotions scoped to the authenticated tourist's plan tier (plus vs plus+vip). Excludes deals on accommodations the caller cannot see. Requires the EXCLUSIVE_DEALS entitlement.",
    tags: ['Owner Promotions'],
    requestQuery: {
        accommodationId: z.string().uuid().optional()
    },
    responseSchema: OwnerPromotionListItemSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query ?? {});

        const audienceScope = hasEntitlement(ctx, EntitlementKey.VIP_PROMOTIONS_ACCESS)
            ? [TouristAudienceEnum.PLUS, TouristAudienceEnum.VIP]
            : [TouristAudienceEnum.PLUS];

        const result = await ownerPromotionService.findExclusiveDeals(
            actor,
            {
                page,
                pageSize,
                accommodationId: query?.accommodationId as string | undefined
            },
            audienceScope
        );

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items ?? [],
            pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
        };
    },
    options: {
        middlewares: [gateExclusiveDeals()]
    }
});
