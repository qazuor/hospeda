/**
 * Host-trade moderation badge (HOS-376 T-037).
 *
 * ```
 * GET /api/v1/admin/moderation/host-trade-reviews/pending-count
 * ```
 *
 * THE TWO QUEUES ARE REPORTED SEPARATELY, and that is the whole design of this
 * endpoint. They do not mean the same thing:
 *
 * - REVIEWS are born APPROVED (§6.4), so a pending review is BACKLOG. Nobody is
 *   waiting on it; the text is already readable in the directory.
 * - REPLIES are born PENDING, so a pending reply is a provider who cannot
 *   answer a complaint about his own business until a human clears him.
 *
 * Summed into one number, forty harmless backlog items would look exactly like
 * forty blocked providers. The total is still returned — a badge needs one
 * number — but the breakdown is what tells the moderator which pile is urgent.
 *
 * Unlike `reviews-pending-count.ts` (SPEC-166), which had to leave the gate off
 * the route because its two counts answer to DIFFERENT permissions, both counts
 * here answer to `HOST_TRADE_REVIEW_MODERATE`. So the gate goes on the route:
 * there is no partial answer to give an actor who lacks it.
 *
 * @module routes/moderation/admin/host-trade-reviews-pending-count
 */

import { PermissionEnum } from '@repo/schemas';
import { HostTradeReviewReplyService, HostTradeReviewService } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const reviewService = new HostTradeReviewService({ logger: apiLogger });
const replyService = new HostTradeReviewReplyService({ logger: apiLogger });

/** `{ count, byType: { reviews, replies } }`. */
const HostTradePendingCountSchema = z.object({
    count: z.number().int().min(0),
    byType: z.object({
        reviews: z.number().int().min(0),
        replies: z.number().int().min(0)
    })
});

/**
 * GET /api/v1/admin/moderation/host-trade-reviews/pending-count
 *
 * Both counts run in parallel; the route is gated, so neither can be denied
 * while the other succeeds.
 */
export const adminHostTradeReviewsPendingCountRoute = createAdminRoute({
    method: 'get',
    path: '/host-trade-reviews/pending-count',
    summary: 'Count pending host-trade moderation items (admin)',
    description:
        'Returns how many host-trade reviews and provider replies are awaiting moderation, broken down by kind. The two are not interchangeable: a pending review is backlog, since reviews publish on creation, while a pending reply is a provider who cannot answer a complaint until it is cleared.',
    tags: ['HostTrades', 'Moderation'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_REVIEW_MODERATE],
    responseSchema: HostTradePendingCountSchema,
    handler: async (ctx) => {
        const actor = getActorFromContext(ctx);

        const [reviewResult, replyResult] = await Promise.all([
            reviewService.getPendingCount({ actor }),
            replyService.getPendingCount({ actor })
        ]);

        const reviews = reviewResult.data?.count ?? 0;
        const replies = replyResult.data?.count ?? 0;

        return { count: reviews + replies, byType: { reviews, replies } };
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
