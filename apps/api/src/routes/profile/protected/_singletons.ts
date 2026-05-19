/**
 * Lazy service singletons shared by the protected profile routes (SPEC-113).
 *
 * Kept in their own module so the three route handlers can share service
 * instances without circular imports, and so the test seam (`_resetCaches`)
 * has a single source of truth for cache invalidation.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { NewsletterSubscriberService, ServiceError, UserService } from '@repo/service-core';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';

let cachedUserService: UserService | null = null;
let cachedNewsletterService: NewsletterSubscriberService | null = null;

/**
 * Returns a process-wide {@link UserService} instance.
 * First call constructs it; subsequent calls reuse the cached instance.
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
 * Throws SERVICE_UNAVAILABLE if HOSPEDA_NEWSLETTER_HMAC_SECRET is unset.
 * The API can boot without it, but any newsletter call must surface a clear
 * error to the client.
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
 * Reset all cached singletons.  Used by route tests so each `it()` starts
 * with a clean slate.  Never call from production code.
 */
export function _resetProfileRouteSingletons(): void {
    cachedUserService = null;
    cachedNewsletterService = null;
}
