/**
 * @route POST /api/v1/public/newsletter/subscribe
 *
 * Guest (unauthenticated) newsletter subscribe endpoint. Stores the email in
 * an anonymous `newsletter_subscribers` row (`user_id IS NULL`) with
 * `status = 'pending_verification'` and dispatches a double opt-in
 * verification email. The HMAC token in that email is what flips the row to
 * `active`.
 *
 * Authenticated users go through the protected subscribe route instead — it
 * skips the double opt-in when their account email is verified.
 *
 * Service-layer behavior (see NewsletterSubscriberService.subscribeGuest):
 *   - Active row exists → idempotent `'active'`.
 *   - Anonymous pending / unsubscribed row → refresh / reactivate + email.
 *   - Linked-to-user row → no side effects, returns `'already_pending'` for
 *     privacy (we don't reveal that the email is registered).
 *   - Bounced / complained → blocked.
 */

import { z } from '@hono/zod-openapi';
import { NewsletterSourceEnum, type ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { createPublicRoute } from '../../../utils/route-factory';
import { getDefaultNewsletterService } from '../protected/_singletons';

const CONSENT_VERSION = 'spec-101-v1';

const SUBSCRIBE_SOURCES = ['web_footer', 'web_landing'] as const;

const GuestSubscribeRequestSchema = z.object({
    email: z.string().email().max(255),
    locale: z.enum(['es', 'en', 'pt']).optional(),
    source: z.enum(SUBSCRIBE_SOURCES).optional()
});

const GuestSubscribeResponseSchema = z.object({
    status: z.enum(['pending_verification', 'active', 'already_pending'])
});

/** Body shape (post-Zod-parsed) consumed by the handler. */
export type GuestSubscribeBody = z.infer<typeof GuestSubscribeRequestSchema>;

/** Minimal slice of `NewsletterSubscriberService` consumed by the handler. */
export interface GuestSubscribeNewsletterService {
    subscribeGuest: (input: {
        email: string;
        locale?: 'es' | 'en' | 'pt';
        source?: NewsletterSourceEnum;
        consentIp?: string;
        consentUa?: string;
        consentVersion?: string;
    }) => Promise<{
        data: { status: 'pending_verification' | 'active' | 'already_pending' } | null;
        error: { code: ServiceErrorCode; message: string } | null;
    }>;
}

/** Pure handler — extractable so unit tests can stub the service. */
export const guestSubscribeHandler = async (
    ctx: Context,
    body: GuestSubscribeBody,
    deps: { newsletterService?: GuestSubscribeNewsletterService } = {}
): Promise<{ status: 'pending_verification' | 'active' | 'already_pending' }> => {
    const svc =
        deps.newsletterService ??
        // TYPE-WORKAROUND: route declares a narrow GuestSubscribeNewsletterService interface (only subscribeGuest) for the testability seam; the singleton returns the full concrete class which structurally satisfies the narrow shape.
        (getDefaultNewsletterService() as unknown as GuestSubscribeNewsletterService);

    const consentIp =
        ctx.req.header('cf-connecting-ip') ??
        ctx.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
        undefined;
    const consentUa = ctx.req.header('user-agent') ?? undefined;

    const result = await svc.subscribeGuest({
        email: body.email,
        locale: body.locale,
        source:
            (body.source as NewsletterSourceEnum | undefined) ?? NewsletterSourceEnum.WEB_FOOTER,
        consentIp,
        consentUa,
        consentVersion: CONSENT_VERSION
    });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }
    if (!result.data) {
        throw new ServiceError(
            'INTERNAL_ERROR' as ServiceErrorCode,
            'subscribeGuest returned no data'
        );
    }
    return { status: result.data.status };
};

export const newsletterGuestSubscribeRoute = createPublicRoute({
    method: 'post',
    path: '/subscribe',
    summary: 'Subscribe a guest (unauthenticated) visitor to the newsletter',
    description:
        'Stores the email as an anonymous pending row and dispatches a double opt-in verification email. The HMAC link in that email flips the row to active. Authenticated users should use the protected subscribe route instead.',
    tags: ['Newsletter'],
    requestBody: GuestSubscribeRequestSchema,
    responseSchema: GuestSubscribeResponseSchema,
    handler: async (ctx, _params, body) => guestSubscribeHandler(ctx, body as GuestSubscribeBody),
    options: {
        // Tight per-IP throttle: 3 attempts per minute is enough for an honest
        // visitor that mistyped or wants to retry, but blocks scripted flooding
        // of the verification mailer.
        customRateLimit: { requests: 3, windowMs: 60_000 }
    }
});
