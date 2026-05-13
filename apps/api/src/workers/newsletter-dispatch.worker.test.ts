/**
 * Unit tests for the newsletter dispatch BullMQ worker.
 *
 * All external infrastructure (BullMQ Worker, @sentry/node, NewsletterDeliveryService)
 * is mocked.  No real Redis connection or queue is created.
 *
 * @module workers/newsletter-dispatch.worker.test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mock factories so vi.mock factories can reference them
// ---------------------------------------------------------------------------

const { MockWorker, mockWorkerInstance, mockCaptureException, mockSentryStartSpan } = vi.hoisted(
    () => {
        const onHandlers: Record<string, (...args: unknown[]) => void> = {};

        const mockWorkerInstance = {
            on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
                onHandlers[event] = handler;
                return mockWorkerInstance;
            }),
            // Expose handlers so tests can trigger them directly
            _handlers: onHandlers
        };

        const MockWorker = vi.fn().mockReturnValue(mockWorkerInstance);

        const mockCaptureException = vi.fn();
        const mockSentryStartSpan = vi
            .fn()
            .mockImplementation(async (_opts: unknown, fn: (span: unknown) => Promise<void>) =>
                fn({})
            );

        return { MockWorker, mockWorkerInstance, mockCaptureException, mockSentryStartSpan };
    }
);

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock('bullmq', () => ({
    Worker: MockWorker
}));

vi.mock('@sentry/node', () => ({
    captureException: mockCaptureException,
    startSpan: mockSentryStartSpan,
    isEnabled: vi.fn().mockReturnValue(false)
}));

// ---------------------------------------------------------------------------
// System under test
// ---------------------------------------------------------------------------

import { NEWSLETTER_DISPATCH_QUEUE, startNewsletterWorker } from './newsletter-dispatch.worker.js';
import type { NewsletterWorkerDeps } from './newsletter-dispatch.worker.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal Job mock. */
function makeJob(
    overrides: Partial<{
        id: string;
        data: { campaignId: string; deliveryIds: string[] };
        attemptsMade: number;
    }> = {}
) {
    return {
        id: overrides.id ?? 'job-1',
        data: overrides.data ?? { campaignId: 'campaign-abc', deliveryIds: ['d1', 'd2'] },
        attemptsMade: overrides.attemptsMade ?? 0
    };
}

/** Creates a mock `NewsletterDeliveryService`-like object. */
function makeDeliveryService(
    processBatchImpl?: () => ReturnType<NewsletterWorkerDeps['deliveryService']['processBatch']>
) {
    return {
        processBatch: vi.fn(
            processBatchImpl ??
                (() => Promise.resolve({ data: { delivered: 2, skipped: 0, failed: 0 } }))
        ),
        // bulkMarkFailed is called from worker.on('failed') when attempts exhaust.
        // Default: succeed and return the count.
        bulkMarkFailed: vi.fn(
            (input: { campaignId: string; deliveryIds: string[]; reason: string }) =>
                Promise.resolve({ data: input.deliveryIds.length })
        )
    } as unknown as NewsletterWorkerDeps['deliveryService'];
}

/** Creates a minimal logger mock. */
function makeLogger() {
    return {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    } as unknown as NewsletterWorkerDeps['logger'];
}

/** Creates a minimal Redis connection stub (typed as ConnectionOptions). */
function makeRedis(): NewsletterWorkerDeps['redis'] {
    // BullMQ accepts any ConnectionOptions shape; the stub is never connected in unit tests.
    return { host: 'localhost', port: 6379 };
}

// ---------------------------------------------------------------------------
// Retrieve the processor callback registered with the Worker constructor
// ---------------------------------------------------------------------------

/**
 * Extracts the processor function passed to the BullMQ Worker constructor
 * during `startNewsletterWorker()`.
 */
function getRegisteredProcessor(): (job: ReturnType<typeof makeJob>) => Promise<void> {
    // The second argument to the Worker constructor is the processor function
    const constructorArgs = MockWorker.mock.calls[0];
    if (!constructorArgs) {
        throw new Error('Worker constructor was not called');
    }
    return constructorArgs[1] as (job: ReturnType<typeof makeJob>) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('startNewsletterWorker', () => {
    let deliveryService: ReturnType<typeof makeDeliveryService>;
    let logger: ReturnType<typeof makeLogger>;

    beforeEach(() => {
        MockWorker.mockClear();
        mockWorkerInstance.on.mockClear();
        mockCaptureException.mockClear();
        mockSentryStartSpan.mockClear();

        deliveryService = makeDeliveryService();
        logger = makeLogger();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // 1. Worker setup
    // -----------------------------------------------------------------------

    describe('worker initialisation', () => {
        it('should create a Worker bound to the correct queue name', () => {
            startNewsletterWorker({
                redis: makeRedis(),
                deliveryService,
                logger,
                concurrency: 5
            });

            expect(MockWorker).toHaveBeenCalledOnce();
            const [queueName] = MockWorker.mock.calls[0] as [string, ...unknown[]];
            expect(queueName).toBe(NEWSLETTER_DISPATCH_QUEUE);
            expect(queueName).toBe('hospeda-newsletter-dispatch');
        });

        it('should forward the concurrency parameter to the Worker constructor', () => {
            const concurrency = 8;
            startNewsletterWorker({
                redis: makeRedis(),
                deliveryService,
                logger,
                concurrency
            });

            expect(MockWorker).toHaveBeenCalledOnce();
            const opts = MockWorker.mock.calls[0]?.[2] as Record<string, unknown>;
            expect(opts.concurrency).toBe(concurrency);
        });

        it('should register completed and failed event handlers', () => {
            startNewsletterWorker({
                redis: makeRedis(),
                deliveryService,
                logger,
                concurrency: 5
            });

            const registeredEvents = mockWorkerInstance.on.mock.calls.map((call) => call[0]);
            expect(registeredEvents).toContain('completed');
            expect(registeredEvents).toContain('failed');
        });

        it('should return the Worker instance', () => {
            const result = startNewsletterWorker({
                redis: makeRedis(),
                deliveryService,
                logger,
                concurrency: 5
            });

            expect(result).toBe(mockWorkerInstance);
        });
    });

    // -----------------------------------------------------------------------
    // 2. Processor — success path
    // -----------------------------------------------------------------------

    describe('processor — success path', () => {
        it('should call deliveryService.processBatch with job data', async () => {
            startNewsletterWorker({ redis: makeRedis(), deliveryService, logger, concurrency: 5 });

            const processor = getRegisteredProcessor();
            const job = makeJob({
                data: { campaignId: 'camp-1', deliveryIds: ['d1', 'd2', 'd3'] }
            });

            await processor(job);

            expect(deliveryService.processBatch).toHaveBeenCalledOnce();
            expect(deliveryService.processBatch).toHaveBeenCalledWith({
                campaignId: 'camp-1',
                deliveryIds: ['d1', 'd2', 'd3']
            });
        });

        it('should log newsletter.batch.attempt before calling processBatch', async () => {
            startNewsletterWorker({ redis: makeRedis(), deliveryService, logger, concurrency: 5 });
            const processor = getRegisteredProcessor();
            await processor(makeJob());

            // First logger.info call must be the attempt log
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({ campaignId: 'campaign-abc' }),
                'newsletter.batch.attempt'
            );
        });

        it('should log newsletter.batch.success on a successful processBatch result', async () => {
            deliveryService = makeDeliveryService(() =>
                Promise.resolve({ data: { delivered: 5, skipped: 1, failed: 0 } })
            );
            startNewsletterWorker({ redis: makeRedis(), deliveryService, logger, concurrency: 5 });
            const processor = getRegisteredProcessor();

            await processor(makeJob());

            const successCall = (logger.info as ReturnType<typeof vi.fn>).mock.calls.find(
                (c: unknown[]) => c[1] === 'newsletter.batch.success'
            );
            expect(successCall).toBeDefined();
            const [meta] = successCall as [Record<string, unknown>];
            expect(meta.delivered).toBe(5);
            expect(meta.skipped).toBe(1);
            expect(meta.failed).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // 3. Processor — hard failure (throw)
    // -----------------------------------------------------------------------

    describe('processor — hard failure path', () => {
        it('should re-throw when processBatch throws (triggers BullMQ retry)', async () => {
            const brevoError = new Error('Brevo HTTP 503');
            deliveryService = makeDeliveryService(() => Promise.reject(brevoError));

            startNewsletterWorker({ redis: makeRedis(), deliveryService, logger, concurrency: 5 });
            const processor = getRegisteredProcessor();

            await expect(processor(makeJob())).rejects.toThrow('Brevo HTTP 503');
        });

        it('should log newsletter.batch.failure before re-throwing', async () => {
            deliveryService = makeDeliveryService(() => Promise.reject(new Error('Brevo 500')));
            startNewsletterWorker({ redis: makeRedis(), deliveryService, logger, concurrency: 5 });
            const processor = getRegisteredProcessor();

            await expect(processor(makeJob())).rejects.toThrow();

            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Brevo 500',
                    campaignId: 'campaign-abc'
                }),
                'newsletter.batch.failure'
            );
        });

        it('should capture the exception in Sentry before re-throwing', async () => {
            const brevoError = new Error('Brevo network failure');
            deliveryService = makeDeliveryService(() => Promise.reject(brevoError));

            startNewsletterWorker({ redis: makeRedis(), deliveryService, logger, concurrency: 5 });
            const processor = getRegisteredProcessor();

            await expect(processor(makeJob())).rejects.toThrow();

            expect(mockCaptureException).toHaveBeenCalledWith(
                brevoError,
                expect.objectContaining({
                    tags: expect.objectContaining({ subsystem: 'newsletter' })
                })
            );
        });
    });

    // -----------------------------------------------------------------------
    // 4. Processor — soft failure (result.error set)
    // -----------------------------------------------------------------------

    describe('processor — soft failure path', () => {
        it('should NOT throw when processBatch returns result.error (soft failure)', async () => {
            deliveryService = makeDeliveryService(() =>
                Promise.resolve({
                    error: {
                        code: 'NOT_FOUND' as never,
                        message: 'Campaign not found'
                    }
                })
            );

            startNewsletterWorker({ redis: makeRedis(), deliveryService, logger, concurrency: 5 });
            const processor = getRegisteredProcessor();

            // Should resolve without throwing
            await expect(processor(makeJob())).resolves.toBeUndefined();
        });

        it('should log newsletter.batch.soft-failure when result.error is set', async () => {
            deliveryService = makeDeliveryService(() =>
                Promise.resolve({
                    error: {
                        code: 'NOT_FOUND' as never,
                        message: 'Campaign not found',
                        reason: 'CAMPAIGN_NOT_FOUND'
                    }
                })
            );

            startNewsletterWorker({ redis: makeRedis(), deliveryService, logger, concurrency: 5 });
            const processor = getRegisteredProcessor();

            await processor(makeJob());

            expect(logger.warn).toHaveBeenCalledWith(
                expect.objectContaining({ errorMessage: 'Campaign not found' }),
                'newsletter.batch.soft-failure'
            );
        });
    });

    describe('failed event handler — retry exhaustion', () => {
        it('should call deliveryService.bulkMarkFailed once attempts are exhausted', async () => {
            startNewsletterWorker({ redis: makeRedis(), deliveryService, logger, concurrency: 5 });

            // Pull the failed handler registered via worker.on('failed', ...)
            const failedHandler = (
                mockWorkerInstance as unknown as {
                    _handlers: Record<string, (...args: unknown[]) => Promise<void>>;
                }
            )._handlers.failed as (...args: unknown[]) => Promise<void>;
            expect(failedHandler).toBeDefined();

            const exhaustedJob = makeJob({
                attemptsMade: 3, // JOB_ATTEMPTS = 3 → exhausted
                data: { campaignId: 'campaign-x', deliveryIds: ['d1', 'd2', 'd3'] }
            });
            const err = new Error('Brevo 503');

            await failedHandler(exhaustedJob, err);

            expect(deliveryService.bulkMarkFailed).toHaveBeenCalledOnce();
            expect(deliveryService.bulkMarkFailed).toHaveBeenCalledWith({
                campaignId: 'campaign-x',
                deliveryIds: ['d1', 'd2', 'd3'],
                reason: expect.stringContaining('exhausted retries')
            });
        });

        it('should NOT call bulkMarkFailed when attempts are not yet exhausted', async () => {
            startNewsletterWorker({ redis: makeRedis(), deliveryService, logger, concurrency: 5 });

            const failedHandler = (
                mockWorkerInstance as unknown as {
                    _handlers: Record<string, (...args: unknown[]) => Promise<void>>;
                }
            )._handlers.failed as (...args: unknown[]) => Promise<void>;

            // attemptsMade=1 < JOB_ATTEMPTS=3 → BullMQ will retry, do not mark failed.
            const retryJob = makeJob({ attemptsMade: 1 });
            const err = new Error('Brevo 500 transient');

            await failedHandler(retryJob, err);

            expect(deliveryService.bulkMarkFailed).not.toHaveBeenCalled();
        });

        it('should log bulkMarkFailed errors without throwing out of the failed handler', async () => {
            // bulkMarkFailed itself returns a ServiceOutput error (soft failure path).
            deliveryService = makeDeliveryService();
            (
                deliveryService.bulkMarkFailed as unknown as ReturnType<typeof vi.fn>
            ).mockResolvedValueOnce({
                error: { code: 'INTERNAL_ERROR' as never, message: 'DB unavailable' }
            });

            startNewsletterWorker({ redis: makeRedis(), deliveryService, logger, concurrency: 5 });
            const failedHandler = (
                mockWorkerInstance as unknown as {
                    _handlers: Record<string, (...args: unknown[]) => Promise<void>>;
                }
            )._handlers.failed as (...args: unknown[]) => Promise<void>;

            const exhaustedJob = makeJob({ attemptsMade: 3 });
            await failedHandler(exhaustedJob, new Error('Brevo 503'));

            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({ errorMessage: 'DB unavailable' }),
                'newsletter.batch.mark-failed-error'
            );
        });
    });
});
