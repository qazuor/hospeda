/**
 * Admin payment-review endpoint (HOS-1299).
 *
 * ```
 * POST /api/v1/admin/partners/:id/review-payment
 * ```
 *
 * The human half of the owner's decision (2026-09-09). The
 * `partner-payment-review` cron detects that a partner activated outside
 * MercadoPago has run past their confirmed period and asks; this is where the
 * answer lands. Nothing about the partner has changed when the question is
 * asked, so a partner who did pay is never worse off for having been doubted.
 *
 * Shaped after `review-content.ts` on purpose — same permission, same
 * `decision` body, same `ServiceError` re-raise — because it is the same kind of
 * gesture: an admin resolving something the system queued for them.
 *
 * @module routes/partners/admin/review-payment
 */

import { PermissionEnum, partnerSchema } from '@repo/schemas';
import { PartnerService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/** Body for a payment review. */
const ReviewPaymentBodySchema = z.object({
    decision: z.enum(['confirmed-paid', 'not-paid'], {
        message: 'zodError.partner.paymentReview.decision.invalid'
    }),
    /**
     * How far the confirmed period runs. Optional — omitted means one more
     * standard window from today. Ignored on `not-paid`.
     */
    confirmedThrough: z.string().datetime().optional()
});

/**
 * POST /api/v1/admin/partners/{id}/review-payment
 * Answer the payment question the review cron raised — Admin endpoint.
 */
export const adminReviewPartnerPaymentRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/review-payment',
    summary: "Answer a partner's pending payment review",
    description:
        'Confirms that a partner activated outside MercadoPago is paid up, or records that they are not. ' +
        'Confirming clears the flag and moves the confirmed period forward; `not-paid` archives them the ' +
        'same way the expiry cron would, without marking them revoked — a partner who stopped paying is a ' +
        'temporary outage and must be able to come back, so they earn a reversible 404 rather than a ' +
        'permanent 410. Fails when nothing was asked about this partner. Requires PARTNER_MANAGE permission.',
    tags: ['Partners'],
    requiredPermissions: [PermissionEnum.PARTNER_MANAGE],
    requestParams: { id: z.string().uuid() },
    requestBody: ReviewPaymentBodySchema,
    responseSchema: partnerSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) => {
        const partnerService = new PartnerService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const { decision, confirmedThrough } = body as z.infer<typeof ReviewPaymentBodySchema>;

        const result = await partnerService.reviewPayment(actor, {
            id,
            decision,
            ...(confirmedThrough ? { confirmedThrough: new Date(confirmedThrough) } : {})
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // Audited because this is the moment a human took responsibility for a
        // partner staying up or coming down. The cron's flag records that the
        // question was asked; only this records who answered it and how.
        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'update',
            resourceType: 'partner-payment-review',
            resourceId: id,
            metadata: { decision, ...(confirmedThrough ? { confirmedThrough } : {}) }
        });

        return result.data?.partner;
    }
});
