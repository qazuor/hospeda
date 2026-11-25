/**
 * Public newsletter routes (SPEC-101 T-101-22 & T-101-23).
 *
 * Browser-facing newsletter endpoints:
 *
 *   GET /api/v1/public/newsletter/verify?token=<hmac>&locale=<es|en|pt>
 *     Double opt-in confirmation. Validates the HMAC verification token,
 *     activates the subscriber row, and 302-redirects to the web success
 *     page (`/{locale}/newsletter/confirmado/`). Bad / expired tokens
 *     redirect to the error page with a `reason` query.
 *
 *   GET /api/v1/public/newsletter/unsubscribe?token=<hmac>&locale=<es|en|pt>
 *     Never unsubscribes (HOS-2617). 302-redirects to the web confirmation
 *     page `/{locale}/newsletter/unsubscribe/?token=…`.
 *
 *   POST /api/v1/public/newsletter/unsubscribe
 *     Performs the unsubscribe (JSON body `{ token }`, or RFC 8058 one-click
 *     with the token in the query). Answers JSON; see `unsubscribe-post.ts`.
 *
 * Both are mounted under `/api/v1/public/newsletter` from routes/index.ts.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { buildNewsletterUnsubscribePageUrl } from '@repo/utils';
import type { Context } from 'hono';
import { createPerRouteRateLimitMiddleware } from '../../../middlewares/rate-limit';
import { createRouter } from '../../../utils/create-app';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { getDefaultNewsletterService } from '../protected/_singletons';
import { newsletterGuestResendRoute } from './resend';
import { newsletterGuestSubscribeRoute } from './subscribe';
import { unsubscribePostHandler } from './unsubscribe-post';

const SUPPORTED_LOCALES = new Set(['es', 'en', 'pt']);

/**
 * Resolves a safe locale prefix for the redirect URL. Falls back to `es`
 * (project default) when the query param is missing or unknown.
 */
function resolveLocale(c: Context): string {
    const raw = (c.req.query('locale') ?? '').trim().toLowerCase();
    return SUPPORTED_LOCALES.has(raw) ? raw : 'es';
}

/**
 * Build a fully-qualified web URL on the configured site.
 * Falls back to localhost only when `HOSPEDA_SITE_URL` is unset (dev).
 */
function buildSiteUrl(path: string): string {
    const base = env.HOSPEDA_SITE_URL ?? 'http://localhost:4321';
    return `${base.replace(/\/$/, '')}${path}`;
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

const verifyRateLimiter = createPerRouteRateLimitMiddleware({
    requests: 10,
    windowMs: 60_000
});

/**
 * Maps a service error to a `/{locale}/newsletter/error/?reason=...` URL.
 */
function buildVerifyErrorRedirect(c: Context, errorCode: string): string {
    const locale = resolveLocale(c);
    const reason = errorCode === 'NEWSLETTER_TOKEN_EXPIRED' ? 'token_expired' : 'invalid_token';
    return buildSiteUrl(`/${locale}/newsletter/error/?reason=${reason}`);
}

async function verifyHandler(c: Context): Promise<Response> {
    const token = (c.req.query('token') ?? '').trim();
    if (!token) {
        return c.redirect(buildVerifyErrorRedirect(c, 'NEWSLETTER_TOKEN_INVALID'), 302);
    }

    try {
        const result = await getDefaultNewsletterService().verifyToken(token);
        if (result.error) {
            const reason = result.error.reason ?? result.error.code ?? '';
            apiLogger.info({ reason }, 'Newsletter verify failed');
            return c.redirect(buildVerifyErrorRedirect(c, reason), 302);
        }
        const locale = resolveLocale(c);
        return c.redirect(buildSiteUrl(`/${locale}/newsletter/confirmado/`), 302);
    } catch (err) {
        if (err instanceof Error && err.message.includes('HOSPEDA_NEWSLETTER_HMAC_SECRET')) {
            // Service-unavailable: redirect to error page rather than 500 the browser
            apiLogger.error({ error: err.message }, 'Newsletter verify: service not configured');
            return c.redirect(
                buildVerifyErrorRedirect(c, ServiceErrorCode.SERVICE_UNAVAILABLE),
                302
            );
        }
        apiLogger.error(
            { error: err instanceof Error ? err.message : String(err) },
            'Newsletter verify: unexpected error'
        );
        return c.redirect(buildVerifyErrorRedirect(c, 'NEWSLETTER_TOKEN_INVALID'), 302);
    }
}

// ---------------------------------------------------------------------------
// Unsubscribe
// ---------------------------------------------------------------------------

const unsubscribeRateLimiter = createPerRouteRateLimitMiddleware({
    requests: 20,
    windowMs: 60_000
});

/**
 * GET twin of the unsubscribe endpoint (HOS-2617). It NEVER unsubscribes:
 * mail scanners and link previewers prefetch GET links, so a state change here
 * would drop people who never asked. It redirects to the web confirmation page
 * (`buildNewsletterUnsubscribePageUrl`), which POSTs once the person clicks.
 * Kept so campaign mails sent before the web page existed keep working.
 */
async function unsubscribeHandler(c: Context): Promise<Response> {
    const token = (c.req.query('token') ?? '').trim();
    const target = buildNewsletterUnsubscribePageUrl({
        siteUrl: env.HOSPEDA_SITE_URL ?? 'http://localhost:4321',
        locale: resolveLocale(c),
        token
    });
    return c.redirect(target, 302);
}

/**
 * Public newsletter router — mounted at `/api/v1/public/newsletter` so the
 * GET redirect handlers live under predictable paths the email templates can
 * hardcode, alongside the POST JSON endpoints for guest subscribe / resend.
 */
export const newsletterPublicRoutes = createRouter()
    .get('/verify', verifyRateLimiter, verifyHandler)
    .get('/unsubscribe', unsubscribeRateLimiter, unsubscribeHandler)
    .post('/unsubscribe', unsubscribeRateLimiter, unsubscribePostHandler)
    .route('/', newsletterGuestSubscribeRoute)
    .route('/', newsletterGuestResendRoute);

export { guestResendHandler } from './resend';
export { guestSubscribeHandler } from './subscribe';
// Re-exports for tests.
export { unsubscribeHandler as _unsubscribeHandler, verifyHandler as _verifyHandler };
