/**
 * Admin benefit-review endpoint (HOS-278 AC-8).
 *
 * ```
 * POST /api/v1/admin/host-trades/:id/review-benefit
 * ```
 *
 * Resolves the pending benefit edit a provider submitted through
 * `PATCH /protected/host-trades/mine`. Approving copies the pending values
 * onto the live ones; rejecting discards them. Either way the listing ends up
 * with nothing pending.
 *
 * @module routes/host-trade/admin/review-benefit
 */

import { HostTradeAdminSchema, HostTradeIdSchema, PermissionEnum } from '@repo/schemas';
import { HostTradeService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const hostTradeService = new HostTradeService({ logger: apiLogger });

/** Body for a benefit review. */
const ReviewBenefitBodySchema = z.object({
    decision: z.enum(['approve', 'reject'], {
        message: 'zodError.hostTrade.benefitReview.decision.invalid'
    })
});

/**
 * POST /api/v1/admin/host-trades/:id/review-benefit
 * Approve or reject a provider's pending benefit edit — Admin endpoint.
 */
export const adminReviewHostTradeBenefitRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/review-benefit',
    summary: "Review a provider's pending benefit edit",
    description:
        'Approves or rejects the pending benefit edit on a host-trade listing. Approving copies the pending type, value and fine print onto the live ones; rejecting discards them and leaves the published benefit untouched. Fails when the listing has nothing pending. Requires HOST_TRADE_UPDATE permission.',
    tags: ['HostTrades'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_UPDATE],
    requestParams: {
        id: HostTradeIdSchema
    },
    requestBody: ReviewBenefitBodySchema,
    responseSchema: HostTradeAdminSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const { decision } = body as z.infer<typeof ReviewBenefitBodySchema>;

        const result = await hostTradeService.reviewPendingBenefit(actor, { id, decision });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data?.trade;
    }
});
