/**
 * @route POST /api/v1/protected/newsletter/subscribe
 *
 * Authenticated newsletter subscribe endpoint (SPEC-101 T-101-20).
 *
 * Resolves the subscriber email from the user record (canonical source of
 * truth), captures consent fingerprint (IP + UA + version) from request
 * headers, and delegates to NewsletterSubscriberService.subscribe. Double
 * opt-in is enforced by the service — the response status tells the client
 * whether to render the "check your inbox" UI or the "already subscribed"
 * UI.
 */

import { z } from '@hono/zod-openapi';
import { NewsletterChannelEnum, NewsletterSourceEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';
import { getDefaultNewsletterService, getDefaultUserService } from './_singletons';

/** Stable consent-version identifier persisted on every subscription row. */
const CONSENT_VERSION = 'spec-101-v1';

/** Sources accepted from the client. */
const SUBSCRIBE_SOURCES = ['web_footer', 'account_preferences'] as const;

const SubscribeRequestSchema = z.object({
    locale: z.enum(['es', 'en', 'pt']).optional(),
    source: z.enum(SUBSCRIBE_SOURCES).optional()
});

const SubscribeResponseSchema = z.object({
    status: z.enum(['pending_verification', 'active', 'already_pending'])
});

/**
 * Minimal slice of `UserService` consumed by the subscribe handler. Allows
 * unit tests to stub the service without standing up service-core.
 */
export interface SubscribeUserService {
    getById: (
        actor: ReturnType<typeof getActorFromContext>,
        id: string
    ) => Promise<{
        data: { id: string; email?: string | null; settings?: Record<string, unknown> } | null;
        error: { code: ServiceErrorCode; message: string } | null;
    }>;
}

/**
 * Minimal slice of `NewsletterSubscriberService` consumed by the handler.
 */
export interface SubscribeNewsletterService {
    subscribe: (
        actor: ReturnType<typeof getActorFromContext>,
        input: {
            userId: string;
            email: string;
            channel?: NewsletterChannelEnum;
            locale?: 'es' | 'en' | 'pt';
            source?: NewsletterSourceEnum;
            consentIp?: string;
            consentUa?: string;
            consentVersion?: string;
        }
    ) => Promise<{
        data: { status: 'pending_verification' | 'active' | 'already_pending' } | null;
        error: { code: ServiceErrorCode; message: string } | null;
    }>;
}

/** Body shape (post-Zod-parsed) consumed by the handler. */
export interface SubscribeBody {
    locale?: 'es' | 'en' | 'pt';
    source?: 'web_footer' | 'account_preferences';
}

/**
 * Pure handler for the subscribe route — extractable so the regression test
 * can pass typed stubs without booting the full service-core stack.
 */
export const subscribeHandler = async (
    ctx: Context,
    body: SubscribeBody,
    deps: {
        userService?: SubscribeUserService;
        newsletterService?: SubscribeNewsletterService;
    } = {}
): Promise<{ status: 'pending_verification' | 'active' | 'already_pending' }> => {
    const actor = getActorFromContext(ctx);
    const userSvc =
        // TYPE-WORKAROUND: route declares a narrow SubscribeUserService interface (only getById) for the testability seam; UserService structurally satisfies the narrow shape.
        deps.userService ?? (getDefaultUserService() as unknown as SubscribeUserService);
    const newsletterSvc =
        deps.newsletterService ??
        // TYPE-WORKAROUND: route declares a narrow SubscribeNewsletterService interface for the testability seam; the singleton returns the full concrete class which structurally satisfies the narrow shape.
        (getDefaultNewsletterService() as unknown as SubscribeNewsletterService);

    const userResult = await userSvc.getById(actor, actor.id);
    if (userResult.error) {
        throw new ServiceError(userResult.error.code, userResult.error.message);
    }
    const user = userResult.data;
    if (!user) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
    }
    if (!user.email) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'User has no email on file — cannot subscribe to the newsletter.',
            undefined,
            'USER_EMAIL_MISSING'
        );
    }

    const consentIp =
        ctx.req.header('cf-connecting-ip') ??
        ctx.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
        undefined;
    const consentUa = ctx.req.header('user-agent') ?? undefined;
    const source =
        (body.source as NewsletterSourceEnum | undefined) ??
        NewsletterSourceEnum.ACCOUNT_PREFERENCES;

    const subscribeResult = await newsletterSvc.subscribe(actor, {
        userId: actor.id,
        email: user.email,
        channel: NewsletterChannelEnum.EMAIL,
        locale: body.locale,
        source,
        consentIp,
        consentUa,
        consentVersion: CONSENT_VERSION
    });

    if (subscribeResult.error) {
        throw new ServiceError(subscribeResult.error.code, subscribeResult.error.message);
    }
    if (!subscribeResult.data) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Newsletter subscribe returned no data'
        );
    }

    return { status: subscribeResult.data.status };
};

export const newsletterSubscribeRoute = createProtectedRoute({
    method: 'post',
    path: '/newsletter/subscribe',
    summary: 'Subscribe the authenticated user to the newsletter',
    description:
        'Double opt-in subscribe endpoint. Resolves the email from the user record, captures consent fingerprint, and triggers a verification email when the row is new or returning to pending.',
    tags: ['Newsletter'],
    requestBody: SubscribeRequestSchema,
    responseSchema: SubscribeResponseSchema,
    handler: async (ctx, _params, body) => subscribeHandler(ctx, body as SubscribeBody),
    options: {
        customRateLimit: { requests: 5, windowMs: 60000 }
    }
});
