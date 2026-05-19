/**
 * @route POST /api/v1/protected/newsletter/resend-verification
 *
 * Re-sends the double opt-in verification email for the authenticated user
 * (SPEC-101 T-101-21). Used when:
 *   - The pending-verification banner asks the user to resend a lost email.
 *   - The verification page detects an expired token and offers a resend.
 *
 * No body. The service is idempotent — calling it for a row that's already
 * active returns `{ sent: true }` without enqueuing another email (handled
 * internally by NewsletterSubscriberService.resendVerification).
 */

import { z } from '@hono/zod-openapi';
import type { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';
import { getDefaultNewsletterService } from './_singletons';

const ResendResponseSchema = z.object({ sent: z.literal(true) });

/** Minimal slice of NewsletterSubscriberService consumed by the handler. */
export interface ResendNewsletterService {
    resendVerification: (
        actor: ReturnType<typeof getActorFromContext>,
        userId: string
    ) => Promise<{
        data: { sent: true } | null;
        error: { code: ServiceErrorCode; message: string } | null;
    }>;
}

/**
 * Pure resend handler — extractable so unit tests can stub the service.
 */
export const resendHandler = async (
    ctx: Context,
    deps: { newsletterService?: ResendNewsletterService } = {}
): Promise<{ sent: true }> => {
    const actor = getActorFromContext(ctx);
    const svc =
        deps.newsletterService ??
        // TYPE-WORKAROUND: route declares a narrow ResendNewsletterService interface for the testability seam; the singleton returns the full concrete class which structurally satisfies the narrow shape.
        (getDefaultNewsletterService() as unknown as ResendNewsletterService);

    const result = await svc.resendVerification(actor, actor.id);
    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }
    return { sent: true };
};

export const newsletterResendRoute = createProtectedRoute({
    method: 'post',
    path: '/newsletter/resend-verification',
    summary: 'Re-send the double opt-in verification email',
    description:
        'Idempotent: triggers a new verification email if the row is in pending_verification or unsubscribed; no-op for already-active subscribers. Tight rate limit to prevent abuse.',
    tags: ['Newsletter'],
    responseSchema: ResendResponseSchema,
    handler: async (ctx) => resendHandler(ctx),
    options: {
        customRateLimit: { requests: 3, windowMs: 60000 }
    }
});
