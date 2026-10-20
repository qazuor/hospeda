/**
 * Protected exclusive-deals list endpoint (HOS-21 T-008/T-009)
 *
 * Tourist-facing listing of owner promotions scoped by touristAudience tier.
 * Reuses `OwnerPromotionService.findExclusiveDeals` — not the public search path.
 *
 * Mounted at `/exclusive-deals` before `/{id}` in `protected/index.ts` so the
 * literal path is not swallowed by the parameter route.
 */

import { OwnerPromotionListItemSchema, TouristAudienceEnum, VerticalEnum } from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

import { getActorFromContext } from '../../../utils/actor';
import { enforceUserGate, readEffectiveKeys } from '../../../utils/listing-access/user-gate';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createProtectedListRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/** GET /api/v1/protected/owner-promotions/exclusive-deals */
export const protectedListExclusiveDealsRoute = createProtectedListRoute({
    method: 'get',
    path: '/exclusive-deals',
    summary: 'List exclusive deals',
    description:
        "Returns active owner promotions scoped to the authenticated tourist's effective plan tier.",
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

        await enforceUserGate({
            userId: actor.id,
            vertical: VerticalEnum.TOURIST,
            keys: ['exclusive_deals']
        });

        const effectiveKeys = await readEffectiveKeys({
            userId: actor.id,
            vertical: VerticalEnum.TOURIST,
            keys: ['vip_promotions_access']
        });
        const audienceScope = effectiveKeys.vip_promotions_access
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
    options: {}
});
