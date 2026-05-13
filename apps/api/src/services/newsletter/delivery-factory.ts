/**
 * Factory for the real `NewsletterDeliveryService` wired with BullMQ,
 * the Brevo batch transport, and the campaign template renderer.
 *
 * Used by both the admin route singletons (campaign `send()` enqueues
 * BullMQ jobs through this service) and the embedded BullMQ worker
 * (`processBatch()` is driven from `apps/api/src/index.ts`).
 *
 * The factory is a lazy process-wide singleton: the first call constructs
 * the service against the supplied Redis connection; subsequent calls
 * return the cached instance regardless of the argument. This matches the
 * existing notification-service singleton pattern in this app.
 *
 * @module services/newsletter/delivery-factory
 */

import {
    BrevoEmailTransport,
    NewsletterCampaign,
    createEmailClient,
    renderTiptapEmailContent,
    sendBatch
} from '@repo/notifications';
import { NewsletterDeliveryService } from '@repo/service-core';
import { Queue } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import { renderToStaticMarkup } from 'react-dom/server';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';

/** BullMQ queue name — must match `NewsletterDeliveryService.enqueueBatches()`. */
export const NEWSLETTER_DISPATCH_QUEUE_NAME = 'hospeda-newsletter-dispatch';

let cachedQueue: Queue | null = null;
let cachedService: NewsletterDeliveryService | null = null;

/**
 * Returns the lazily-initialised BullMQ `Queue` for the newsletter dispatch.
 *
 * `redis` is typed as `ConnectionOptions` (BullMQ's union) rather than the
 * `Redis` class from `ioredis` directly. Pnpm sometimes resolves two
 * incompatible ioredis patch versions across workspaces; the BullMQ union
 * accepts the same instance without the structural mismatch.
 *
 * @param redis - Active ioredis connection (or BullMQ-compatible options).
 */
export function getNewsletterDispatchQueue(redis: ConnectionOptions): Queue {
    if (!cachedQueue) {
        cachedQueue = new Queue(NEWSLETTER_DISPATCH_QUEUE_NAME, { connection: redis });
    }
    return cachedQueue;
}

/**
 * Returns the lazily-initialised real {@link NewsletterDeliveryService}.
 *
 * Constructed with the full production DI surface:
 * - BullMQ queue (for `enqueueBatches` from the admin route).
 * - `BrevoEmailTransport` (for `sendTestEmail`).
 * - `sendBatch` from `@repo/notifications` (for `processBatch`).
 * - TipTap renderer + React-email template renderer.
 * - HMAC + Brevo API + site URL config from env.
 *
 * @param redis - Active ioredis connection.
 * @throws Error when `HOSPEDA_EMAIL_API_KEY` is missing in env.
 */
export function getNewsletterDeliveryService(redis: ConnectionOptions): NewsletterDeliveryService {
    if (cachedService) return cachedService;

    if (!env.HOSPEDA_EMAIL_API_KEY) {
        throw new Error(
            'HOSPEDA_EMAIL_API_KEY is not set — NewsletterDeliveryService cannot be initialised.'
        );
    }

    const emailClient = createEmailClient({ apiKey: env.HOSPEDA_EMAIL_API_KEY });
    const senderEmail = env.HOSPEDA_EMAIL_FROM_EMAIL ?? 'noreply@hospeda.com.ar';
    const senderName = env.HOSPEDA_EMAIL_FROM_NAME ?? 'Hospeda';

    const emailTransport = new BrevoEmailTransport(emailClient, {
        fromEmail: senderEmail,
        fromName: senderName
    });

    const queue = getNewsletterDispatchQueue(redis);

    cachedService = new NewsletterDeliveryService(
        { logger: apiLogger },
        {
            queue,
            emailTransport,
            sendBatchFn: sendBatch,
            renderTiptapEmailFn: ({ content }) =>
                renderTiptapEmailContent({ content: content as never }),
            renderCampaignEmailFn: ({ subject, bodyHtml, unsubscribeUrl, isTest }) => {
                const element = NewsletterCampaign({
                    subject,
                    bodyHtml,
                    unsubscribeUrl,
                    isTest
                });
                // `renderToStaticMarkup` is synchronous and produces valid HTML
                // for the @react-email/components used by the template. We avoid
                // @react-email/render here because its v2 API is async-only,
                // which would force RenderCampaignEmailFn to return a Promise.
                return renderToStaticMarkup(element);
            },
            buildCampaignReactElementFn: ({ subject, bodyHtml, unsubscribeUrl, isTest }) =>
                NewsletterCampaign({
                    subject,
                    bodyHtml,
                    unsubscribeUrl,
                    isTest
                    // TYPE-WORKAROUND: service-core declares OpaqueReactElement (Record<string, unknown>) on its DI seam so it never has to import react; the runtime value IS a real React element.
                }) as unknown as Record<string, unknown>,
            apiKey: env.HOSPEDA_EMAIL_API_KEY,
            senderEmail,
            senderName,
            siteUrl: env.HOSPEDA_SITE_URL ?? 'https://hospeda.com.ar',
            hmacSecret: env.HOSPEDA_NEWSLETTER_HMAC_SECRET
        }
    );

    return cachedService;
}

/**
 * Resets the cached singletons. **Only for tests.**
 */
export function _resetNewsletterDeliveryFactory(): void {
    cachedQueue = null;
    cachedService = null;
}
