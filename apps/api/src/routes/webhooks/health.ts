/**
 * Webhook Health Monitoring Endpoint
 *
 * Provides health and statistics monitoring for webhook processing.
 * Protected by CRON_SECRET or admin authentication.
 *
 * @module routes/webhooks/health
 */

import { billingWebhookDeadLetter, billingWebhookEvents, getDb, sql } from '@repo/db';
import { Hono } from 'hono';
import { cronAuthMiddleware } from '../../cron/middleware';
import type { AppBindings } from '../../types';
import { apiLogger } from '../../utils/logger';

/**
 * Webhook health monitoring router
 *
 * Provides statistics about webhook processing:
 * - Total events in last 24h
 * - Processed, failed, and pending counts
 * - Last event timestamp
 * - Dead letter queue count
 * - Average processing time
 *
 * Protected by CRON_SECRET authentication (same as cron jobs)
 * or admin authentication.
 */
export const webhookHealthRoutes = new Hono<AppBindings>();

/**
 * GET /health
 *
 * Returns webhook system health metrics
 *
 * @returns Health metrics including:
 * - last24h: Event counts by status
 * - lastEventAt: Most recent event timestamp
 * - deadLetterCount: Failed events requiring manual intervention
 * - avgProcessingTimeMs: Average time to process events
 */
webhookHealthRoutes.get('/health', cronAuthMiddleware, async (c) => {
    try {
        const db = getDb();

        // Calculate 24 hours ago
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        // Query webhook events from last 24h
        const last24hStats = await db
            .select({
                status: billingWebhookEvents.status,
                count: sql<number>`count(*)::int`
            })
            .from(billingWebhookEvents)
            .where(sql`${billingWebhookEvents.createdAt} >= ${twentyFourHoursAgo}`)
            .groupBy(billingWebhookEvents.status);

        // Calculate totals
        let total = 0;
        let processed = 0;
        let failed = 0;
        let pending = 0;

        for (const stat of last24hStats) {
            const count = stat.count || 0;
            total += count;

            if (stat.status === 'processed') {
                processed = count;
            } else if (stat.status === 'failed') {
                failed = count;
            } else if (stat.status === 'pending') {
                pending = count;
            }
        }

        // Get last event timestamp
        const lastEventResult = await db
            .select({
                createdAt: billingWebhookEvents.createdAt
            })
            .from(billingWebhookEvents)
            .orderBy(sql`${billingWebhookEvents.createdAt} DESC`)
            .limit(1);

        const lastEventAt = lastEventResult[0]?.createdAt || null;

        // Count dead letter events
        const deadLetterResult = await db
            .select({
                count: sql<number>`count(*)::int`
            })
            .from(billingWebhookDeadLetter);

        const deadLetterCount = deadLetterResult[0]?.count || 0;

        // Calculate average processing time for successfully processed events in last 24h
        const avgProcessingResult = await db
            .select({
                avgMs: sql<number>`
                    COALESCE(
                        AVG(EXTRACT(EPOCH FROM (processed_at - created_at)) * 1000)::int,
                        0
                    )
                `
            })
            .from(billingWebhookEvents)
            .where(
                sql`${billingWebhookEvents.status} = 'processed'
                    AND ${billingWebhookEvents.processedAt} IS NOT NULL
                    AND ${billingWebhookEvents.createdAt} >= ${twentyFourHoursAgo}`
            );

        const avgProcessingTimeMs = avgProcessingResult[0]?.avgMs || 0;

        // Log health check
        apiLogger.debug(
            {
                total,
                processed,
                failed,
                pending,
                deadLetterCount,
                avgProcessingTimeMs
            },
            'Webhook health check performed'
        );

        return c.json(
            {
                success: true,
                data: {
                    last24h: {
                        total,
                        processed,
                        failed,
                        pending
                    },
                    lastEventAt: lastEventAt ? lastEventAt.toISOString() : null,
                    deadLetterCount,
                    avgProcessingTimeMs
                }
            },
            200
        );
    } catch (error) {
        apiLogger.error(
            {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            },
            'Failed to retrieve webhook health metrics'
        );

        return c.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve webhook health metrics'
                }
            },
            500
        );
    }
});
