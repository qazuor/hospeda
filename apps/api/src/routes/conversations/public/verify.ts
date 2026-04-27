/**
 * GET /api/v1/public/conversations/verify/:verificationToken
 *
 * Validates a JWT email-verification token and activates the conversation.
 *
 * On success: redirects to `{HOSPEDA_SITE_URL}/{locale}/guest/messages/{rawToken}`.
 * On failure: 401 with reason `VERIFICATION_INVALID`.
 *
 * Rate limit: 20 requests / 10 minutes (IP-based).
 */
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ConversationService } from '@repo/service-core';
import type { Context } from 'hono';
import { createConversationMailer } from '../../../lib/conversation-mailer';
import { createPerRouteRateLimitMiddleware } from '../../../middlewares/rate-limit';
import { createRouter } from '../../../utils/create-app';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createErrorResponse, handleRouteError } from '../../../utils/response-helpers';

/** Minimal system actor for public endpoints that invoke services. */
const PUBLIC_SYSTEM_ACTOR = {
    id: '00000000-0000-0000-0000-000000000001',
    role: RoleEnum.ADMIN,
    permissions: [
        PermissionEnum.CONVERSATION_VIEW_OWN,
        PermissionEnum.CONVERSATION_VIEW_ANY,
        PermissionEnum.CONVERSATION_REPLY_OWN,
        PermissionEnum.CONVERSATION_REPLY_ANY
    ] as readonly PermissionEnum[],
    _isSystemActor: true
} as const;

/** Builds a `ConversationService` instance with API-level deps injected. */
function buildConversationService(): ConversationService {
    return new ConversationService(
        { logger: apiLogger },
        {
            authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
            siteUrl: env.HOSPEDA_SITE_URL,
            mailer: createConversationMailer()
        }
    );
}

/** IP rate limiter: 20 requests per 10 minutes. */
const ipRateLimiter = createPerRouteRateLimitMiddleware({
    requests: 20,
    windowMs: 10 * 60 * 1000
});

/**
 * Route handler for GET /api/v1/public/conversations/verify/:verificationToken.
 *
 * Validates the JWT, activates the conversation, and redirects the guest to their
 * thread page. The locale used in the redirect URL comes from `?locale=` query param
 * (defaults to `'es'`).
 */
async function handler(c: Context): Promise<Response> {
    try {
        const verificationToken = c.req.param('verificationToken');
        if (!verificationToken) {
            return createErrorResponse(
                {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Missing verification token',
                    reason: 'VERIFICATION_INVALID'
                },
                c,
                400
            );
        }

        const locale = (c.req.query('locale') ?? 'es').trim() || 'es';

        const conversationSvc = buildConversationService();
        const result = await conversationSvc.verifyEmailToken(PUBLIC_SYSTEM_ACTOR, {
            verificationToken
        });

        if (result.error) {
            const _reason = result.error.reason ?? 'VERIFICATION_INVALID';
            // For browsers: redirect to the verify-expired page instead of returning JSON
            const expiredRedirectUrl = `${env.HOSPEDA_SITE_URL}/${locale}/guest/messages/verify-expired`;
            return c.redirect(expiredRedirectUrl, 302);
        }

        const { rawToken } = result.data;
        const redirectUrl = `${env.HOSPEDA_SITE_URL}/${locale}/guest/messages/${rawToken}`;
        return c.redirect(redirectUrl, 302);
    } catch (error) {
        // If error has reason VERIFICATION_INVALID, redirect rather than JSON
        const locale = (c.req.query('locale') ?? 'es').trim() || 'es';
        const expiredRedirectUrl = `${env.HOSPEDA_SITE_URL}/${locale}/guest/messages/verify-expired`;
        const isVerificationError =
            error instanceof Error &&
            (error.message.includes('VERIFICATION_INVALID') || error.message.includes('expired'));
        if (isVerificationError) {
            return c.redirect(expiredRedirectUrl, 302);
        }
        return handleRouteError(error, c);
    }
}

/** Public email verification router. */
export const verifyPublicConversationRoute = createRouter()
    .use('*', ipRateLimiter)
    .get('/:verificationToken', handler);
