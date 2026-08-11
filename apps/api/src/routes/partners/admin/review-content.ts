/**
 * Admin content-review endpoint (HOS-278 AC-11).
 *
 * ```
 * POST /api/v1/admin/partners/:id/review-content
 * ```
 *
 * Step 4 of the partner flow in §6.3, and the thing that unlocks step 5.
 * Approving promotes the logo and texts the partner submitted onto the live
 * columns and opens the payment step; rejecting discards them and records why.
 *
 * @module routes/partners/admin/review-content
 */

import { PermissionEnum, partnerSchema } from '@repo/schemas';
import { PartnerService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/** Body for a content review. */
const ReviewContentBodySchema = z.object({
    decision: z.enum(['approve', 'reject'], {
        message: 'zodError.partner.contentReview.decision.invalid'
    }),
    /** Required when rejecting — the service enforces it, not this schema. */
    note: z.string().max(1000).optional()
});

/**
 * POST /api/v1/admin/partners/{id}/review-content
 * Approve or reject a partner's pending content submission — Admin endpoint.
 */
export const adminReviewPartnerContentRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/review-content',
    summary: "Review a partner's pending content submission",
    description:
        'Approves or rejects the logo, description and website a partner submitted. Approving copies them onto the live columns and enables the payment step; rejecting discards them and records the reason, which is required. Fails when the partner has nothing pending. Requires PARTNER_MANAGE permission.',
    tags: ['Partners'],
    requiredPermissions: [PermissionEnum.PARTNER_MANAGE],
    requestParams: { id: z.string().uuid() },
    requestBody: ReviewContentBodySchema,
    responseSchema: partnerSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) => {
        const partnerService = new PartnerService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const { decision, note } = body as z.infer<typeof ReviewContentBodySchema>;

        const result = await partnerService.reviewContent(actor, { id, decision, note });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data?.partner;
    }
});
