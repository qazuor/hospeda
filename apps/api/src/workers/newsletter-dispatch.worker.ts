/**
 * Newsletter dispatch BullMQ worker.
 *
 * Processes jobs from the `hospeda-newsletter-dispatch` queue.  Each job
 * carries a `campaignId` and a batch of `deliveryIds` that were enqueued by
 * `NewsletterDeliveryService.enqueueBatches()`.
 *
 * Retry behaviour is configured per-job at enqueue time (attempts: 3,
 * exponential back-off of 30 s).  The worker itself does NOT set attempts so
 * BullMQ always honours the job-level setting.
 *
 * @module workers/newsletter-dispatch
 */

import type { ILogger } from '@repo/logger';
import type { NewsletterDeliveryService } from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { Worker } from 'bullmq';
import type { ConnectionOptions, Job } from 'bullmq';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Queue name — MUST match the value used by NewsletterDeliveryService.enqueueBatches(). */
export const NEWSLETTER_DISPATCH_QUEUE = 'hospeda-newsletter-dispatch';

/** BullMQ job attempts limit — mirrors the per-job opts set by enqueueBatches(). */
const JOB_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Shape of data stored in each BullMQ newsletter dispatch job.
 * Must match what `NewsletterDeliveryService.enqueueBatches()` enqueues.
 */
export interface NewsletterDispatchJobData {
    /** UUID of the campaign being sent. */
    readonly campaignId: string;
    /** Array of delivery-row UUIDs that belong to this batch. */
    readonly deliveryIds: readonly string[];
}

/**
 * Dependencies injected into the newsletter dispatch worker.
 * All infra dependencies are passed in so the worker is testable without
 * real Redis or BullMQ connections.
 */
export interface NewsletterWorkerDeps {
    /**
     * Active Redis connection to pass to BullMQ.
     * Typed as `ConnectionOptions` (from bullmq) to avoid structural
     * incompatibility when pnpm resolves multiple ioredis patch versions.
     */
    readonly redis: ConnectionOptions;
    /** Service responsible for executing the batch delivery logic. */
    readonly deliveryService: NewsletterDeliveryService;
    /** Structured logger (ILogger from @repo/logger). */
    readonly logger: ILogger;
    /** BullMQ worker concurrency — from env.HOSPEDA_NEWSLETTER_WORKER_CONCURRENCY (default 5). */
    readonly concurrency: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates and starts the BullMQ newsletter dispatch worker.
 *
 * The worker connects to the `hospeda-newsletter-dispatch` queue via the
 * supplied Redis connection and calls `deliveryService.processBatch()` for
 * each job.
 *
 * Failure semantics:
 * - If `processBatch` **throws** (e.g. Brevo HTTP error), the processor
 *   re-throws so BullMQ can retry the job according to the per-job retry
 *   config (attempts: 3, exponential back-off of 30 s).
 * - If `processBatch` returns a `ServiceOutput` with `result.error` set
 *   (soft failure — campaign not found, all deliveries skipped, etc.), the
 *   processor logs the error but does NOT throw, treating it as a terminal
 *   non-retriable outcome.
 *
 * @param deps - Injected dependencies for the worker.
 * @returns The running BullMQ `Worker` instance.
 *
 * @example
 * ```ts
 * const worker = startNewsletterWorker({
 *   redis,
 *   deliveryService,
 *   logger: apiLogger,
 *   concurrency: env.HOSPEDA_NEWSLETTER_WORKER_CONCURRENCY,
 * });
 * ```
 */
export function startNewsletterWorker(deps: NewsletterWorkerDeps): Worker {
    const { redis, deliveryService, logger, concurrency } = deps;

    /**
     * BullMQ processor — invoked once per job.
     * Returns void on success; throws to trigger BullMQ retry.
     */
    const processor = async (job: Job<NewsletterDispatchJobData>): Promise<void> => {
        const { campaignId, deliveryIds } = job.data;
        const startMs = Date.now();
        const attempt = job.attemptsMade + 1;

        logger.info(
            {
                jobId: job.id,
                campaignId,
                batchSize: deliveryIds.length,
                attempt
            },
            'newsletter.batch.attempt'
        );

        await Sentry.startSpan(
            {
                name: 'newsletter.batch.process',
                op: 'queue.process',
                attributes: {
                    'newsletter.campaign_id': campaignId,
                    'newsletter.batch_size': deliveryIds.length,
                    'job.id': job.id ?? 'unknown',
                    'job.attempt': attempt
                }
            },
            async () => {
                try {
                    const result = await deliveryService.processBatch({
                        campaignId,
                        deliveryIds: deliveryIds as string[]
                    });

                    if (result.error) {
                        // Soft failure: service-level error (e.g. campaign not found,
                        // all deliveries already processed).  Log it and return without
                        // throwing so BullMQ marks the job as completed, not failed.
                        logger.warn(
                            {
                                jobId: job.id,
                                campaignId,
                                errorCode: result.error.code,
                                errorMessage: result.error.message,
                                reason: result.error.reason,
                                durationMs: Date.now() - startMs
                            },
                            'newsletter.batch.soft-failure'
                        );
                        return;
                    }

                    const { delivered, skipped, failed } = result.data;

                    logger.info(
                        {
                            jobId: job.id,
                            campaignId,
                            delivered,
                            skipped,
                            failed,
                            durationMs: Date.now() - startMs
                        },
                        'newsletter.batch.success'
                    );
                } catch (err) {
                    // Hard failure: Brevo HTTP error or unexpected throw.
                    // Re-throw so BullMQ increments the attempt counter and retries.
                    const willRetry = attempt < JOB_ATTEMPTS;

                    logger.error(
                        {
                            jobId: job.id,
                            campaignId,
                            attempt,
                            error: err instanceof Error ? err.message : String(err),
                            willRetry
                        },
                        'newsletter.batch.failure'
                    );

                    Sentry.captureException(err, {
                        tags: {
                            subsystem: 'newsletter',
                            action: 'batch_process',
                            campaignId
                        },
                        extra: {
                            jobId: job.id,
                            attempt,
                            batchSize: deliveryIds.length,
                            willRetry
                        }
                    });

                    throw err;
                }
            }
        );
    };

    const worker = new Worker<NewsletterDispatchJobData>(NEWSLETTER_DISPATCH_QUEUE, processor, {
        connection: redis,
        concurrency,
        removeOnComplete: { age: 3600 }, // 1 hour
        removeOnFail: { age: 86400 } // 24 hours
    });

    // -----------------------------------------------------------------------
    // Event handlers
    // -----------------------------------------------------------------------

    worker.on('completed', (job: Job<NewsletterDispatchJobData>) => {
        logger.info(
            {
                jobId: job.id,
                campaignId: job.data.campaignId,
                batchSize: job.data.deliveryIds.length
            },
            'newsletter.worker.job-completed'
        );
    });

    worker.on('failed', async (job: Job<NewsletterDispatchJobData> | undefined, err: Error) => {
        if (!job) {
            logger.error({ error: err.message }, 'newsletter.worker.unknown-job-failed');
            return;
        }

        const isExhausted = job.attemptsMade >= JOB_ATTEMPTS;

        logger.error(
            {
                jobId: job.id,
                campaignId: job.data.campaignId,
                batchSize: job.data.deliveryIds.length,
                attemptsMade: job.attemptsMade,
                exhausted: isExhausted,
                error: err.message
            },
            'newsletter.batch.exhausted'
        );

        if (isExhausted) {
            Sentry.captureException(err, {
                tags: {
                    subsystem: 'newsletter',
                    action: 'batch_exhausted',
                    campaignId: job.data.campaignId
                },
                extra: {
                    jobId: job.id,
                    attemptsMade: job.attemptsMade,
                    deliveryIds: job.data.deliveryIds
                }
            });

            // Flip the still-pending deliveries to status='failed' so the
            // `closeSentCampaigns` cron can transition the campaign to `sent`
            // once every row reaches a terminal state. Without this write,
            // exhausted batches leave deliveries permanently `pending` and
            // the campaign would never close.
            try {
                const reason =
                    `BullMQ exhausted retries (${job.attemptsMade} attempts): ${err.message}`.slice(
                        0,
                        500
                    );
                const markResult = await deliveryService.bulkMarkFailed({
                    campaignId: job.data.campaignId,
                    deliveryIds: job.data.deliveryIds as string[],
                    reason
                });

                if (markResult.error) {
                    logger.error(
                        {
                            jobId: job.id,
                            campaignId: job.data.campaignId,
                            errorCode: markResult.error.code,
                            errorMessage: markResult.error.message
                        },
                        'newsletter.batch.mark-failed-error'
                    );
                } else {
                    logger.info(
                        {
                            jobId: job.id,
                            campaignId: job.data.campaignId,
                            markedFailed: markResult.data
                        },
                        'newsletter.batch.marked-failed'
                    );
                }
            } catch (markErr) {
                logger.error(
                    {
                        jobId: job.id,
                        campaignId: job.data.campaignId,
                        error: markErr instanceof Error ? markErr.message : String(markErr)
                    },
                    'newsletter.batch.mark-failed-threw'
                );
                Sentry.captureException(markErr, {
                    tags: {
                        subsystem: 'newsletter',
                        action: 'bulk_mark_failed_threw',
                        campaignId: job.data.campaignId
                    }
                });
            }
        }
    });

    return worker;
}
