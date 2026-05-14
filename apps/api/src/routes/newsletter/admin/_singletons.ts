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
import { getNewsletterDeliveryService } from '../../../services/newsletter/delivery-factory';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { getDefaultNewsletterService } from '../protected/_singletons';

let cachedCampaignService: NewsletterCampaignService | null = null;

/**
 * Stub delivery service used as the fallback when Redis is not configured.
 *
 * Triggered when `HOSPEDA_REDIS_URL` is unset (dev without Docker, tests).
 * Calls to `enqueueBatches` / `bulkSkipPending` / `sendTestEmail` surface
 * a SERVICE_UNAVAILABLE error so misconfigured environments fail visibly
 * instead of silently dropping work.
 */
const stubDeliveryService: INewsletterDeliveryService = {
    async enqueueBatches(_input) {
        throw new ServiceError(
            ServiceErrorCode.SERVICE_UNAVAILABLE,
            'BullMQ dispatch queue is not available (Redis not configured).',
            undefined,
            'BULLMQ_NOT_CONFIGURED'
        );
    },
    async bulkSkipPending(_input) {
        throw new ServiceError(
            ServiceErrorCode.SERVICE_UNAVAILABLE,
            'BullMQ dispatch queue is not available (Redis not configured).',
            undefined,
            'BULLMQ_NOT_CONFIGURED'
        );
    },
    async sendTestEmail(_input) {
        throw new ServiceError(
            ServiceErrorCode.SERVICE_UNAVAILABLE,
            'Newsletter delivery service is not configured (Redis or HOSPEDA_EMAIL_API_KEY missing).',
            undefined,
            'DELIVERY_SERVICE_NOT_CONFIGURED'
        );
    }
};

/**
 * Returns a process-wide {@link NewsletterCampaignService} instance.
 *
 * First call constructs the service with:
 * - The real {@link NewsletterDeliveryService} from the dispatch factory when
 *   Redis is available — this is the production path; `enqueueBatches` writes
 *   real BullMQ jobs and `sendTestEmail` uses the live Brevo transport.
 * - A stub delivery service that rejects all calls with SERVICE_UNAVAILABLE
 *   when Redis is unreachable — used in local dev without Docker and in tests.
 * - The shared {@link NewsletterSubscriberService} singleton from the
 *   protected routes (read-only `getEligibleForCampaign` does not need the
 *   HMAC secret).
 *
 * Subsequent calls reuse the cached instance.
 *
 * @throws {ServiceError} SERVICE_UNAVAILABLE when
 *   {@link env.HOSPEDA_NEWSLETTER_HMAC_SECRET} is unset (inherited from the
 *   subscriber service singleton).
 */
export async function getDefaultCampaignService(): Promise<NewsletterCampaignService> {
    if (cachedCampaignService) return cachedCampaignService;

    const subscriberService = getDefaultNewsletterService();

    let deliveryService: INewsletterDeliveryService = stubDeliveryService;
    try {
        // The factory now manages its own dedicated BullMQ Redis connection
        // (BullMQ requires `maxRetriesPerRequest: null` which is incompatible
        // with the shared client's fail-fast config). The factory returns
        // null when prerequisites are missing — we fall back to the stub.
        const real = getNewsletterDeliveryService();
        if (real) {
            deliveryService = real;
        } else {
            apiLogger.warn(
                'Newsletter delivery service falling back to stub (Redis or HOSPEDA_EMAIL_API_KEY missing).'
            );
        }
    } catch (error) {
        apiLogger.error(
            'Failed to initialise NewsletterDeliveryService — falling back to stub',
            error instanceof Error ? error.message : String(error)
        );
    }

    cachedCampaignService = new NewsletterCampaignService(
        { logger: apiLogger },
        {
            batchSize: env.HOSPEDA_NEWSLETTER_BATCH_SIZE,
            softCapDays: env.HOSPEDA_NEWSLETTER_SOFTCAP_DAYS,
            deliveryService,
            // Cast: getDefaultNewsletterService() returns NewsletterSubscriberService
            // which is exactly the type expected by the campaign service options.
            // biome-ignore lint/suspicious/noExplicitAny: subscriber service singleton shares the concrete class
            subscriberService: subscriberService as any
        }
    );
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
