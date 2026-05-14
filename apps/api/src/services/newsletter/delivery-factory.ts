/**
 * Factory for the real `NewsletterDeliveryService` wired with BullMQ,
 * the Brevo batch transport, and the campaign template renderer.
 *
 * Used by both the admin route singletons (campaign `send()` enqueues
 * BullMQ jobs through this service) and the embedded BullMQ worker
 * (`processBatch()` is driven from `apps/api/src/index.ts`).
 *
 * The factory is a lazy process-wide singleton: the first call constructs
 * a dedicated BullMQ Redis connection and wires up the delivery service
 * against it; subsequent calls return the cached instance. This matches
 * the existing notification-service singleton pattern in this app.
 *
 * Why a dedicated Redis connection (not the shared `getRedisClient()`):
 * BullMQ workers issue blocking commands (BRPOPLPUSH) that require the
 * underlying ioredis client to be configured with
 * `maxRetriesPerRequest: null` and `enableReadyCheck: false`. The shared
 * client in `apps/api/src/utils/redis.ts` is configured the opposite way
 * (fail-fast `maxRetriesPerRequest: 3`) for the auth-lockout and
 * notification-retry consumers. A dedicated BullMQ connection keeps both
 * camps happy.
 *
 * @module services/newsletter/delivery-factory
 */

import { render } from '@react-email/render';
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
import IORedis from 'ioredis';
import type { Redis } from 'ioredis';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';

/** BullMQ queue name — must match `NewsletterDeliveryService.enqueueBatches()`. */
export const NEWSLETTER_DISPATCH_QUEUE_NAME = 'hospeda-newsletter-dispatch';

let cachedBullMQConnection: Redis | null = null;
let cachedQueue: Queue | null = null;
let cachedService: NewsletterDeliveryService | null = null;

/**
 * Returns the lazily-initialised ioredis connection dedicated to BullMQ.
 *
 * The connection is configured for BullMQ's blocking-command requirements
 * (`maxRetriesPerRequest: null`, `enableReadyCheck: false`) so workers can
 * issue `BRPOPLPUSH` without ioredis aborting on retry-count exhaustion.
 *
 * Returns `null` when `HOSPEDA_REDIS_URL` is unset (dev environments
 * without Docker, or staging before env vars are wired) so the caller
 * can decide to either skip startup or fall back to a stub.
 */
export function getBullMQConnection(): Redis | null {
    if (cachedBullMQConnection) return cachedBullMQConnection;
    if (!env.HOSPEDA_REDIS_URL) return null;

    cachedBullMQConnection = new IORedis(env.HOSPEDA_REDIS_URL, {
        // Required by BullMQ — workers use blocking commands that conflict
        // with the shared client's `maxRetriesPerRequest: 3`.
        maxRetriesPerRequest: null,
        // BullMQ recommends disabling the ready check because blocking
        // commands hold the connection open and the ready check probe
        // would race with them.
        enableReadyCheck: false,
        lazyConnect: false
    });

    cachedBullMQConnection.on('error', (err) => {
        apiLogger.error({ error: err.message }, 'BullMQ Redis connection error');
    });

    return cachedBullMQConnection;
}

/**
 * Returns the lazily-initialised BullMQ `Queue` for the newsletter dispatch.
 *
 * Returns `null` when no BullMQ connection can be established (Redis
 * unconfigured).
 */
export function getNewsletterDispatchQueue(): Queue | null {
    if (cachedQueue) return cachedQueue;
    const connection = getBullMQConnection();
    if (!connection) return null;
    // TYPE-WORKAROUND: pnpm resolves ioredis at two patch versions (apps/api uses 5.10.0; bullmq pulls 5.10.1). The runtime instance is structurally compatible with BullMQ's ConnectionOptions; the cast walks past the duplicated-type-identity friction.
    cachedQueue = new Queue(NEWSLETTER_DISPATCH_QUEUE_NAME, {
        connection: connection as unknown as ConnectionOptions
    });
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
 * Returns `null` when prerequisites (Redis URL, Brevo API key) are
 * missing — caller is responsible for falling back to a stub service.
 */
export function getNewsletterDeliveryService(): NewsletterDeliveryService | null {
    if (cachedService) return cachedService;

    if (!env.HOSPEDA_EMAIL_API_KEY) {
        apiLogger.warn('getNewsletterDeliveryService skipped — HOSPEDA_EMAIL_API_KEY unset.');
        return null;
    }

    const queue = getNewsletterDispatchQueue();
    if (!queue) {
        apiLogger.warn(
            'getNewsletterDeliveryService skipped — Redis connection unavailable (HOSPEDA_REDIS_URL unset).'
        );
        return null;
    }

    const emailClient = createEmailClient({ apiKey: env.HOSPEDA_EMAIL_API_KEY });
    const senderEmail = env.HOSPEDA_EMAIL_FROM_EMAIL ?? 'noreply@hospeda.com.ar';
    const senderName = env.HOSPEDA_EMAIL_FROM_NAME ?? 'Hospeda';

    const emailTransport = new BrevoEmailTransport(emailClient, {
        fromEmail: senderEmail,
        fromName: senderName
    });

    cachedService = new NewsletterDeliveryService(
        { logger: apiLogger },
        {
            queue,
            emailTransport,
            sendBatchFn: sendBatch,
            renderTiptapEmailFn: ({ content }) =>
                renderTiptapEmailContent({ content: content as never }),
            renderCampaignEmailFn: async ({ subject, bodyHtml, unsubscribeUrl, isTest }) => {
                // Async render through `@react-email/render` so the template
                // gets the CSS inlining + Tailwind passes that the sync
                // `renderToStaticMarkup` path skipped (SPEC-108 T-108-01).
                const element = NewsletterCampaign({
                    subject,
                    bodyHtml,
                    unsubscribeUrl,
                    isTest
                });
                return await render(element);
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
 * Closes the cached BullMQ dispatch queue, the dedicated BullMQ Redis
 * connection, and drops the cached delivery-service singleton.
 *
 * Used by `gracefulShutdown` in apps/api/src/index.ts so the BullMQ side
 * of the connection pool is closed cleanly BEFORE the shared Redis client
 * is disconnected, avoiding stray "Connection closed" warnings.
 *
 * The Worker is closed separately by its host (see index.ts).
 *
 * Safe to call when nothing was constructed — no-op in that case.
 */
export async function closeNewsletterDispatchResources(): Promise<void> {
    if (cachedQueue) {
        try {
            await cachedQueue.close();
        } finally {
            cachedQueue = null;
        }
    }
    if (cachedBullMQConnection) {
        try {
            await cachedBullMQConnection.quit();
        } catch (err) {
            apiLogger.warn(
                { error: err instanceof Error ? err.message : String(err) },
                'BullMQ Redis connection.quit() failed; forcing disconnect'
            );
            cachedBullMQConnection.disconnect();
        } finally {
            cachedBullMQConnection = null;
        }
    }
    cachedService = null;
}

/**
 * Resets the cached singletons. **Only for tests.**
 */
export function _resetNewsletterDeliveryFactory(): void {
    cachedBullMQConnection = null;
    cachedQueue = null;
    cachedService = null;
}
