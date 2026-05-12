/**
 * Lazy service singletons shared by the admin newsletter routes.
 *
 * Kept in their own module so campaigns.ts and future admin route files
 * can import them without circular imports, and so the test seam
 * (`_resetCampaignRouteSingletons`) has a single source of truth.
 *
 * @module routes/newsletter/admin/_singletons
 */

import { ServiceErrorCode } from '@repo/schemas';
import { NewsletterCampaignService, ServiceError } from '@repo/service-core';
import type { INewsletterDeliveryService } from '@repo/service-core/services/newsletter/newsletter-campaign.service';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { getDefaultNewsletterService } from '../protected/_singletons';

let cachedCampaignService: NewsletterCampaignService | null = null;

/**
 * Stub delivery service used in dev/test routes.
 *
 * `enqueueBatches` and `bulkSkipPending` are only reachable through the BullMQ
 * worker path — the route handlers themselves do not call them directly.
 * `sendTestEmail` delegates to the injected transport which is configured from
 * env in production and stubbed in tests.
 *
 * Any call to `enqueueBatches` or `bulkSkipPending` from a route context is a
 * programming error; this stub surfaces it as SERVICE_UNAVAILABLE so it is
 * immediately visible instead of silently discarded.
 */
const stubDeliveryService: INewsletterDeliveryService = {
    async enqueueBatches(_input) {
        throw new ServiceError(
            ServiceErrorCode.SERVICE_UNAVAILABLE,
            'BullMQ dispatch queue is not available in this context. Use the worker process for real sends.',
            undefined,
            'BULLMQ_NOT_CONFIGURED'
        );
    },
    async bulkSkipPending(_input) {
        throw new ServiceError(
            ServiceErrorCode.SERVICE_UNAVAILABLE,
            'BullMQ dispatch queue is not available in this context.',
            undefined,
            'BULLMQ_NOT_CONFIGURED'
        );
    },
    async sendTestEmail(_input) {
        // In production this will use a real Brevo transport.
        // For now surface a clear error so mis-configured apps fail visibly.
        if (!env.HOSPEDA_EMAIL_API_KEY) {
            throw new ServiceError(
                ServiceErrorCode.SERVICE_UNAVAILABLE,
                'Email transport is not configured. HOSPEDA_EMAIL_API_KEY must be set.',
                undefined,
                'EMAIL_NOT_CONFIGURED'
            );
        }
        // Placeholder: real BrevoEmailTransport would be wired here (T-101-16).
        // Until T-101-16 ships the route handler calls this and gets the error.
        throw new ServiceError(
            ServiceErrorCode.SERVICE_UNAVAILABLE,
            'Test email transport not yet wired (T-101-16 pending). Ensure NewsletterDeliveryService is injected.',
            undefined,
            'DELIVERY_SERVICE_NOT_CONFIGURED'
        );
    }
};

/**
 * Returns a process-wide {@link NewsletterCampaignService} instance.
 *
 * First call constructs the service with:
 * - A stub {@link INewsletterDeliveryService} that rejects `enqueueBatches`
 *   and `sendTestEmail` gracefully (test/dev guard) until T-101-16 wires the
 *   real BullMQ + Brevo transport.
 * - The shared {@link NewsletterSubscriberService} singleton from the protected
 *   routes (read-only `getEligibleForCampaign` does not need the HMAC secret).
 *
 * Subsequent calls reuse the cached instance.
 *
 * @throws {ServiceError} SERVICE_UNAVAILABLE when
 *   {@link env.HOSPEDA_NEWSLETTER_HMAC_SECRET} is unset (inherited from the
 *   subscriber service singleton).
 */
export function getDefaultCampaignService(): NewsletterCampaignService {
    if (!cachedCampaignService) {
        const subscriberService = getDefaultNewsletterService();
        cachedCampaignService = new NewsletterCampaignService(
            { logger: apiLogger },
            {
                batchSize: env.HOSPEDA_NEWSLETTER_BATCH_SIZE,
                softCapDays: env.HOSPEDA_NEWSLETTER_SOFTCAP_DAYS,
                deliveryService: stubDeliveryService,
                // Cast: getDefaultNewsletterService() returns NewsletterSubscriberService
                // which is exactly the type expected by the campaign service options.
                // biome-ignore lint/suspicious/noExplicitAny: subscriber service singleton shares the concrete class
                subscriberService: subscriberService as any
            }
        );
    }
    return cachedCampaignService;
}

/**
 * Reset the cached campaign service singleton.
 *
 * Used by route tests so each `it()` starts with a clean slate.
 * **Never call from production code.**
 */
export function _resetCampaignRouteSingletons(): void {
    cachedCampaignService = null;
}
