/**
 * Protected exclusive-deals list endpoint (HOS-21 T-008/T-009)
 *
 * The formerly paid inventory stays hidden while the replacement coverage
 * contract is being built. Keep the endpoint and its response shape so clients
 * can continue to request it safely.
 *
 * Mounted at `/exclusive-deals`, a distinct path from `/` (list) and `/{id}`
 * (get/update/patch/delete) — per the Destination Hierarchy Routes precedent
 * (`docs/...`: "the by-path route is registered before :id routes to avoid
 * conflicts"), this file's route is registered before `get.ts` in
 * `protected/index.ts` so the literal path isn't swallowed by `/{id}`.
 */

import { OwnerPromotionListItemSchema } from '@repo/schemas';
import { z } from 'zod';

import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createProtectedListRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/protected/owner-promotions/exclusive-deals
 * Return the transitional empty exclusive-deals collection.
 */
export const protectedListExclusiveDealsRoute = createProtectedListRoute({
    method: 'get',
    path: '/exclusive-deals',
    summary: 'List exclusive deals',
    description: 'Returns no exclusive deals while replacement coverage is pending.',
    tags: ['Owner Promotions'],
    requestQuery: {
        accommodationId: z.string().uuid().optional()
    },
    responseSchema: OwnerPromotionListItemSchema,
    handler: async (_ctx, _params, _body, query) => {
        const { page, pageSize } = extractPaginationParams(query ?? {});
        // HOS-1352: transitional until V3 (HOS-1357), see PR: the effective capability resolver restores exclusive-deal visibility.
        return {
            items: [],
            pagination: getPaginationResponse(0, { page, pageSize })
        };
    },
    options: {}
});
