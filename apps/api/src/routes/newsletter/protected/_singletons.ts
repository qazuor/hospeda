/**
 * Lazy service singletons shared by the protected newsletter routes.
 *
 * Kept in their own module so subscribe.ts and status.ts can both import
 * them without circular imports, and so the test seam (`_resetCaches`) has
 * a single source of truth.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { NewsletterSubscriberService, ServiceError, UserService } from '@repo/service-core';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';

let cachedNewsletterService: NewsletterSubscriberService | null = null;
let cachedUserService: UserService | null = null;

/**
 * Returns a process-wide {@link UserService} instance. First call constructs
 * it, subsequent calls reuse the cached one.
 */
export function getDefaultUserService(): UserService {
    if (!cachedUserService) {
        cachedUserService = new UserService({ logger: apiLogger });
    }
    return cachedUserService;
}

/**
 * Returns a process-wide {@link NewsletterSubscriberService} instance.
 *
 * Throws SERVICE_UNAVAILABLE if {@link env.HOSPEDA_NEWSLETTER_HMAC_SECRET}
 * is unset — the API can boot without it, but any subscribe / verify /
 * unsubscribe call must surface a clear error to the client.
 */
export function getDefaultNewsletterService(): NewsletterSubscriberService {
    if (!cachedNewsletterService) {
        const hmacSecret = env.HOSPEDA_NEWSLETTER_HMAC_SECRET;
        if (!hmacSecret) {
            throw new ServiceError(
                ServiceErrorCode.SERVICE_UNAVAILABLE,
                'Newsletter subscription is not configured. HOSPEDA_NEWSLETTER_HMAC_SECRET must be set.',
                undefined,
                'NEWSLETTER_NOT_CONFIGURED'
            );
        }
        cachedNewsletterService = new NewsletterSubscriberService(
            { logger: apiLogger },
            {
                hmacSecret,
                hmacSecretPrev: env.HOSPEDA_NEWSLETTER_HMAC_SECRET_PREV,
                softCapDays: env.HOSPEDA_NEWSLETTER_SOFTCAP_DAYS
            }
        );
    }
    return cachedNewsletterService;
}

/**
 * Reset both cached singletons. Used by the route tests so each `it()`
 * starts with a clean slate; never call from production code.
 */
export function _resetNewsletterRouteSingletons(): void {
    cachedNewsletterService = null;
    cachedUserService = null;
}
