/**
 * Protected exclusive-deals list endpoint, reshaped by HOS-2589 (D-2, AC-24).
 *
 * The account page that read it (`/mi-cuenta/ofertas-exclusivas`) now redirects to
 * the public `/{lang}/promociones/` page, so this route is kept only for clients
 * still calling it during the rollout. It no longer gates on `exclusive_deals`
 * (a free tourist gets a list, never a 403) and answers exactly what
 * `GET /public/owner-promotions/listing` answers: one page of `visible | locked`
 * items resolved by the free / VIP rule, per-actor and never cached.
 *
 * Mounted at `/exclusive-deals` before `/{id}` in `protected/index.ts` so the
 * literal path is not swallowed by the parameter route.
 */
import { PromotionListingQuerySchema, PromotionListingResponseSchema } from '@repo/schemas';
import type { Context } from 'hono';

import { createProtectedRoute } from '../../../utils/route-factory';
import { handleListingPromotions } from '../public/listing';

/** GET /api/v1/protected/owner-promotions/exclusive-deals */
export const protectedListExclusiveDealsRoute = createProtectedRoute({
    method: 'get',
    path: '/exclusive-deals',
    summary: 'List exclusive deals (deprecated alias of the promotions listing)',
    description:
        'Deprecated: same answer as GET /api/v1/public/owner-promotions/listing for the signed-in tourist. One page of current promotions as visible or locked items under the free / VIP rule. Per-actor and never cached.',
    tags: ['Owner Promotions'],
    requestQuery: PromotionListingQuerySchema.shape,
    responseSchema: PromotionListingResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => handleListingPromotions(ctx, query),
    options: {}
});
