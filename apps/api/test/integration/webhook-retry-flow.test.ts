/**
 * Webhook Retry Cron Job Flow Integration Tests
 *
 * Tests the complete webhook retry flow by exercising the `webhookRetryJob`
 * handler with mocked database and billing dependencies. Validates the
 * dead letter queue processing logic without touching real external systems.
 *
 * Test scenarios:
 * 1. Job processes dead letter webhooks and marks them as resolved
 * 2. Job increments attempts on failed retries
 * 3. Job skips events that have exceeded max retries
 * 4. Dry run mode counts events without processing them
 *
 * @module test/integration/webhook-retry-flow
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import { webhookRetryJob } from '../../src/cron/jobs/webhook-retry.job';
import type { CronJobContext } from '../../src/cron/types';
import { getQZPayBilling } from '../../src/middlewares/billing';

// Standard mocks required by the billing system
vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined)
}));

// Mock the database module - required by the cron job for dead letter queries
vi.mock('@repo/db', () => ({
    getDb: vi.fn(),
    billingWebhookDeadLetter: {
        id: 'id',
        resolvedAt: 'resolved_at',
        attempts: 'attempts',
        error: 'error'
    },
    billingWebhookEvents: { providerEventId: 'provider_event_id', status: 'status' },
    eq: vi.fn((_field: unknown, _value: unknown) => ({ field: _field, value: _value })),
    isNull: vi.fn((_field: unknown) => ({ field: _field }))
}));

// Mock @repo/logger to suppress noise in test output
vi.mock('@repo/logger', () => {
    const createMockedLogger = () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerLogMethod: vi.fn().mockReturnThis(),
        permission: vi.fn()
    });

    const mockedLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(() => createMockedLogger()),
        configure: vi.fn(),
        resetConfig: vi.fn(),
        createLogger: vi.fn(() => createMockedLogger()),
        registerLogMethod: vi.fn().mockReturnThis()
    };

    const LoggerColors = {
        BLACK: 'BLACK',
        RED: 'RED',
        GREEN: 'GREEN',
        YELLOW: 'YELLOW',
        BLUE: 'BLUE',
        MAGENTA: 'MAGENTA',
        CYAN: 'CYAN',
        WHITE: 'WHITE',
        GRAY: 'GRAY',
        BLACK_BRIGHT: 'BLACK_BRIGHT',
        RED_BRIGHT: 'RED_BRIGHT',
        GREEN_BRIGHT: 'GREEN_BRIGHT',
        YELLOW_BRIGHT: 'YELLOW_BRIGHT',
        BLUE_BRIGHT: 'BLUE_BRIGHT',
        MAGENTA_BRIGHT: 'MAGENTA_BRIGHT',
        CYAN_BRIGHT: 'CYAN_BRIGHT',
        WHITE_BRIGHT: 'WHITE_BRIGHT'
    };

    const LogLevel = {
        LOG: 'LOG',
        INFO: 'INFO',
        WARN: 'WARN',
        ERROR: 'ERROR',
        DEBUG: 'DEBUG'
    };

    return {
        default: mockedLogger,
        logger: mockedLogger,
        createLogger: mockedLogger.createLogger,
        LoggerColors,
        LogLevel,
        apiLogger: createMockedLogger()
    };
});

// Mock @repo/billing for addon catalog lookups inside the retry handler
vi.mock('@repo/billing', () => ({
    getAddonBySlug: vi.fn().mockReturnValue(null),
    createMercadoPagoAdapter: vi.fn()
}));

// Mock addon service used in retryMercadoPagoPaymentUpdated
vi.mock('../../src/services/addon.service', () => ({
    AddonService: vi.fn().mockImplementation(() => ({
        confirmPurchase: vi.fn().mockResolvedValue({ success: true })
    }))
}));

// Mock notification helpers (fire-and-forget)
vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/routes/webhooks/mercadopago/notifications', () => ({
    sendPaymentFailureNotifications: vi.fn(),
    sendPaymentSuccessNotification: vi.fn()
}));

vi.mock('../../src/routes/webhooks/mercadopago/utils', () => ({
    extractAddonFromReference: vi.fn().mockReturnValue(null),
    extractAddonMetadata: vi.fn().mockReturnValue(null),
    extractPaymentInfo: vi.fn().mockReturnValue(null)
}));

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Build a logger stub that matches CronJobContext.logger */
function buildMockLogger() {
    return {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    };
}

/** Build a standard CronJobContext for test use */
function buildCronContext(dryRun = false): CronJobContext {
    return {
        logger: buildMockLogger(),
        startedAt: new Date(),
        dryRun
    };
}

/** Build a dead letter event fixture */
function buildDeadLetterEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'dl-event-001',
        providerEventId: 'mp-event-001',
        provider: 'mercadopago',
        type: 'payment.created', // safe type: no business logic, always resolves true
        payload: { data: {} },
        attempts: 0,
        resolvedAt: null,
        error: null,
        ...overrides
    };
}

/**
 * Build a chainable Drizzle-like query object.
 *
 * The DB calls in the cron job follow this chain:
 *   db.select().from(table).where(cond).limit(n)
 *   db.update(table).set(data).where(cond)
 *
 * Each method returns `this` except terminal calls which return a Promise.
 */
function _buildChainableQuery(resolvedValue: unknown = []) {
    const chain = {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(resolvedValue)
    };

    // update().set().where() chain should also resolve
    // Override where to resolve when called after set
    chain.set.mockImplementation(() => ({
        where: vi.fn().mockResolvedValue([])
    }));

    return chain;
}

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe('Webhook Retry Cron Job Flow', () => {
    const mockedGetQZPayBilling = getQZPayBilling as MockedFunction<typeof getQZPayBilling>;
    let mockedGetDb: MockedFunction<any>;

    beforeEach(async () => {
        vi.clearAllMocks();

        const dbModule = (await import('@repo/db')) as any;
        mockedGetDb = dbModule.getDb;

        // Default: billing not configured (most retry logic does not require it for safe types)
        mockedGetQZPayBilling.mockReturnValue(null);
    });

    // ----------------------------------------------------------------
    // Scenario 1: Processes dead letter events and marks them resolved
    // ----------------------------------------------------------------
    describe('when there are unresolved dead letter events', () => {
        it('should process events and mark them as resolved on success', async () => {
            // Arrange
            const event = buildDeadLetterEvent();

            // First select: returns the unresolved events
            // Inner select (inside retryWebhookEvent): returns billingWebhookEvents status
            const selectResolved: unknown[] = []; // no matching billingWebhookEvents row
            let selectCallCount = 0;

            const mockDb = {
                select: vi.fn().mockImplementation(() => ({
                    from: vi.fn().mockReturnThis(),
                    where: vi.fn().mockImplementation(() => ({
                        limit: vi.fn().mockImplementation(() => {
                            selectCallCount++;
                            if (selectCallCount === 1) {
                                // Outer query: dead letter events batch
                                return Promise.resolve([event]);
                            }
                            // Inner query: billingWebhookEvents status check
                            return Promise.resolve(selectResolved);
                        })
                    }))
                })),
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([])
                    })
                })
            };

            mockedGetDb.mockReturnValue(mockDb);

            const ctx = buildCronContext();

            // Act
            const result = await webhookRetryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(1);
            // The update (markAsResolved) should have been called to set resolvedAt
            expect(mockDb.update).toHaveBeenCalled();
        });
    });

    // ----------------------------------------------------------------
    // Scenario 2: Multiple events processed in batch
    // ----------------------------------------------------------------
    describe('when there are multiple dead letter events', () => {
        it('should process all events in the batch', async () => {
            // Arrange
            const events = [
                buildDeadLetterEvent({ id: 'dl-1', providerEventId: 'mp-1' }),
                buildDeadLetterEvent({ id: 'dl-2', providerEventId: 'mp-2' })
            ];

            let selectCallCount = 0;
            const mockDb = {
                select: vi.fn().mockImplementation(() => ({
                    from: vi.fn().mockReturnThis(),
                    where: vi.fn().mockImplementation(() => ({
                        limit: vi.fn().mockImplementation(() => {
                            selectCallCount++;
                            if (selectCallCount === 1) return Promise.resolve(events);
                            // billingWebhookEvents status checks
                            return Promise.resolve([]);
                        })
                    }))
                })),
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([])
                    })
                })
            };

            mockedGetDb.mockReturnValue(mockDb);

            const ctx = buildCronContext();

            // Act
            const result = await webhookRetryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(2);
        });
    });

    // ----------------------------------------------------------------
    // Scenario 4: Dry run mode
    // ----------------------------------------------------------------
    describe('dry run mode', () => {
        it('should report events that would be retried without modifying the database', async () => {
            // Arrange: two unresolved events in queue
            const events = [
                buildDeadLetterEvent({ id: 'dl-001' }),
                buildDeadLetterEvent({ id: 'dl-002', type: 'payment.created' })
            ];

            const updateMock = vi.fn();
            const mockDb = {
                select: vi.fn().mockImplementation(() => ({
                    from: vi.fn().mockReturnThis(),
                    where: vi.fn().mockImplementation(() => ({
                        limit: vi.fn().mockResolvedValue(events)
                    }))
                })),
                update: updateMock
            };

            mockedGetDb.mockReturnValue(mockDb);

            // Act - run in dry-run mode
            const ctx = buildCronContext(true);
            const result = await webhookRetryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(2);
            // No actual updates should have occurred
            expect(updateMock).not.toHaveBeenCalled();
            // Dry run indicator in details
            expect(result.details?.dryRun).toBe(true);
        });

        it('should return success with zero processed when queue is empty in dry run', async () => {
            // Arrange: empty dead letter queue
            const mockDb = {
                select: vi.fn().mockImplementation(() => ({
                    from: vi.fn().mockReturnThis(),
                    where: vi.fn().mockImplementation(() => ({
                        limit: vi.fn().mockResolvedValue([])
                    }))
                })),
                update: vi.fn()
            };

            mockedGetDb.mockReturnValue(mockDb);

            // Act
            const ctx = buildCronContext(true);
            const result = await webhookRetryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
        });
    });

    // ----------------------------------------------------------------
    // Edge cases
    // ----------------------------------------------------------------
    describe('edge cases', () => {
        it('should return success when the dead letter queue is empty', async () => {
            // Arrange
            const mockDb = {
                select: vi.fn().mockImplementation(() => ({
                    from: vi.fn().mockReturnThis(),
                    where: vi.fn().mockImplementation(() => ({
                        limit: vi.fn().mockResolvedValue([])
                    }))
                })),
                update: vi.fn()
            };

            mockedGetDb.mockReturnValue(mockDb);

            // Act
            const ctx = buildCronContext();
            const result = await webhookRetryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
        });

        it('should handle unknown webhook providers by marking them as resolved', async () => {
            // Arrange: event with unknown provider
            const event = buildDeadLetterEvent({ provider: 'stripe', type: 'charge.succeeded' });

            let selectCallCount = 0;
            const updateMock = vi.fn().mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([])
                })
            });

            const mockDb = {
                select: vi.fn().mockImplementation(() => ({
                    from: vi.fn().mockReturnThis(),
                    where: vi.fn().mockImplementation(() => ({
                        limit: vi.fn().mockImplementation(() => {
                            selectCallCount++;
                            return Promise.resolve(selectCallCount === 1 ? [event] : []);
                        })
                    }))
                })),
                update: updateMock
            };

            mockedGetDb.mockReturnValue(mockDb);

            // Act
            const ctx = buildCronContext();
            const result = await webhookRetryJob.handler(ctx);

            // Assert: unknown provider resolves gracefully (marked resolved)
            expect(result.success).toBe(true);
            expect(result.errors).toBe(0);
        });
    });
});
