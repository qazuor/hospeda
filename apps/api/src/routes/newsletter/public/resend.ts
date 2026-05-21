/**
 * @route POST /api/v1/public/newsletter/resend
 *
 * Guest "didn't receive the email" resend endpoint. Re-dispatches the
 * double opt-in verification email for an anonymous pending row matched by
 * email. Anti-enumeration: ALWAYS returns `{ sent: true }` regardless of
 * whether a matching row exists, so the response can't be used to probe
 * which emails are subscribed.
 *
 * Tight per-IP rate limit (1 req/min) to keep attackers from flooding the
 * mailer even with valid emails.
 */

import { z } from '@hono/zod-openapi';
import type { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { createPublicRoute } from '../../../utils/route-factory';
import { getDefaultNewsletterService } from '../protected/_singletons';

const GuestResendRequestSchema = z.object({
    email: z.string().email().max(255)
});

const GuestResendResponseSchema = z.object({
    sent: z.literal(true)
});

/** Body shape (post-Zod-parsed) consumed by the handler. */
export type GuestResendBody = z.infer<typeof GuestResendRequestSchema>;

/** Minimal slice of NewsletterSubscriberService consumed by the handler. */
export interface GuestResendNewsletterService {
    resendGuestVerification: (input: { email: string }) => Promise<{
        data: { sent: true } | null;
        error: { code: ServiceErrorCode; message: string } | null;
    }>;
}

/** Pure handler — extractable so unit tests can stub the service. */
export const guestResendHandler = async (
    _ctx: Context,
    body: GuestResendBody,
    deps: { newsletterService?: GuestResendNewsletterService } = {}
): Promise<{ sent: true }> => {
    const svc =
        deps.newsletterService ??
        // TYPE-WORKAROUND: route declares a narrow GuestResendNewsletterService interface (only resendGuestVerification) for the testability seam; the singleton returns the full concrete class which structurally satisfies the narrow shape.
        (getDefaultNewsletterService() as unknown as GuestResendNewsletterService);

    const result = await svc.resendGuestVerification({ email: body.email });
    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }
    // Service is anti-enumeration-safe: it always returns `{ sent: true }` on
    // success, even when there's nothing to send. We mirror that here.
    return { sent: true };
};

export const newsletterGuestResendRoute = createPublicRoute({
    method: 'post',
    path: '/resend',
    summary: 'Re-send the double opt-in verification email for a guest pending row',
    description:
        'Anti-enumeration: always returns `{ sent: true }` regardless of whether the email matches a pending anonymous row. Tight rate limit to prevent mailer abuse.',
    tags: ['Newsletter'],
    requestBody: GuestResendRequestSchema,
    responseSchema: GuestResendResponseSchema,
    handler: async (ctx, _params, body) => guestResendHandler(ctx, body as GuestResendBody),
    options: {
        customRateLimit: { requests: 1, windowMs: 60_000 }
    }
});
