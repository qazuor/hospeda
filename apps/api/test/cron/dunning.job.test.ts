/**
 * Unit tests for the Dunning Cron Job
 *
 * Tests cover:
 * - Job metadata (name, schedule, enabled, timeout)
 * - Billing not configured (skip path)
 * - Dry-run mode (count past-due subscriptions without mutating)
 * - Production mode (processRetries + processCancellations)
 * - Unexpected error handling
 *
 * @module test/cron/dunning.job
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const {
    mockGetQZPayBilling,
    mockCreateSubscriptionLifecycle,
    mockDbInsert,
    mockLoadBillingSettings
} = vi.hoisted(() => {
    const mockValues = vi.fn().mockResolvedValue(undefined);
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
    return {
        mockGetQZPayBilling: vi.fn(),
        mockCreateSubscriptionLifecycle: vi.fn(),
        mockDbInsert: mockInsert,
        mockLoadBillingSettings: vi.fn().mockResolvedValue({
            gracePeriodDays: 7,
            maxPaymentRetries: 4,
            retryIntervalHours: 24,
            trialExpiryReminderDays: 3,
            sendTrialExpiryReminder: true,
            sendPaymentFailedNotification: true
        })
    };
});

vi.mock('@qazuor/qzpay-core', () => ({
    createSubscriptionLifecycle: mockCreateSubscriptionLifecycle
}));

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: mockGetQZPayBilling
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn().mockReturnValue({ insert: mockDbInsert }),
    billingDunningAttempts: { _: 'billingDunningAttempts' }
}));

vi.mock('@repo/billing', () => ({
    DUNNING_RETRY_INTERVALS: [1, 3, 5, 7],
    DUNNING_GRACE_PERIOD_DAYS: 7
}));

vi.mock('../../src/utils/billing-settings', () => ({
    loadBillingSettings: mockLoadBillingSettings
}));

vi.mock('../../src/routes/webhooks/mercadopago/notifications', () => ({
    sendSubscriptionCancelledNotification: vi.fn().mockResolvedValue(undefined)
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { dunningJob } from '../../src/cron/jobs/dunning.job';
import type { CronJobContext } from '../../src/cron/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCronContext(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        },
        startedAt: new Date(),
        dryRun: false,
        ...overrides
    };
}

function makeBillingMock(subscriptionListData: unknown[] = []) {
    return {
        getStorage: vi.fn().mockReturnValue({
            paymentMethods: {
                findDefaultByCustomerId: vi.fn().mockResolvedValue(null)
            }
        }),
        subscriptions: {
            list: vi.fn().mockResolvedValue({ data: subscriptionListData })
        },
        payments: {
            process: vi.fn().mockResolvedValue({ id: 'pay_1', status: 'succeeded' })
        }
    };
}

function makeLifecycleMock(
    retriesResult: { processed: number; succeeded: number; failed: number; details: unknown[] } = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        details: []
    },
    cancellationsResult: { processed: number; details: unknown[] } = { processed: 0, details: [] }
) {
    return {
        processRetries: vi.fn().mockResolvedValue(retriesResult),
        processCancellations: vi.fn().mockResolvedValue(cancellationsResult)
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dunningJob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // Job metadata
    // -----------------------------------------------------------------------

    describe('metadata', () => {
        it('should have correct name', () => {
            expect(dunningJob.name).toBe('dunning');
        });

        it('should run daily at 6:00 AM UTC', () => {
            expect(dunningJob.schedule).toBe('0 6 * * *');
        });

        it('should be enabled by default', () => {
            expect(dunningJob.enabled).toBe(true);
        });

        it('should have 5 minute timeout', () => {
            expect(dunningJob.timeoutMs).toBe(300000);
        });
    });

    // -----------------------------------------------------------------------
    // Billing not configured
    // -----------------------------------------------------------------------

    describe('when billing is not configured', () => {
        it('should return success with skip message', async () => {
            // Arrange
            mockGetQZPayBilling.mockReturnValue(null);
            const ctx = makeCronContext();

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toContain('Billing not configured');
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(mockCreateSubscriptionLifecycle).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Dry-run mode
    // -----------------------------------------------------------------------

    describe('dry-run mode', () => {
        it('should count past-due subscriptions without processing', async () => {
            // Arrange
            const billing = makeBillingMock([
                { id: 'sub_1', status: 'past_due' },
                { id: 'sub_2', status: 'active' },
                { id: 'sub_3', status: 'past_due' }
            ]);
            mockGetQZPayBilling.mockReturnValue(billing);
            mockCreateSubscriptionLifecycle.mockReturnValue(makeLifecycleMock());

            const ctx = makeCronContext({ dryRun: true });

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(2); // only past_due counted
            expect(result.errors).toBe(0);
            expect(result.message).toContain('Dry run');
            expect(result.message).toContain('2');
            expect(result.details).toMatchObject({
                dryRun: true,
                pastDueCount: 2,
                gracePeriodDays: 7
            });
        });

        it('should handle empty subscription list in dry-run', async () => {
            // Arrange
            const billing = makeBillingMock([]);
            mockGetQZPayBilling.mockReturnValue(billing);
            mockCreateSubscriptionLifecycle.mockReturnValue(makeLifecycleMock());

            const ctx = makeCronContext({ dryRun: true });

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
        });

        it('should handle null data from subscriptions.list()', async () => {
            // Arrange
            const billing = makeBillingMock();
            billing.subscriptions.list.mockResolvedValue({ data: null });
            mockGetQZPayBilling.mockReturnValue(billing);
            mockCreateSubscriptionLifecycle.mockReturnValue(makeLifecycleMock());

            const ctx = makeCronContext({ dryRun: true });

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // Production mode
    // -----------------------------------------------------------------------

    describe('production mode', () => {
        it('should call processRetries and processCancellations', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            const lifecycle = makeLifecycleMock(
                { processed: 3, succeeded: 2, failed: 1, details: [] },
                { processed: 1, details: [] }
            );
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            const ctx = makeCronContext();

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(lifecycle.processRetries).toHaveBeenCalledOnce();
            expect(lifecycle.processCancellations).toHaveBeenCalledOnce();
            expect(result.success).toBe(true);
            expect(result.processed).toBe(4); // 3 retries + 1 cancellation
            expect(result.errors).toBe(1); // failed retries
        });

        it('should include retry and cancellation details in result', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            const lifecycle = makeLifecycleMock(
                { processed: 5, succeeded: 4, failed: 1, details: ['retry-detail'] },
                { processed: 2, details: ['cancel-detail'] }
            );
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            const ctx = makeCronContext();

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.message).toContain('4/5 succeeded');
            expect(result.message).toContain('2 processed');
            expect(result.details).toMatchObject({
                retries: {
                    processed: 5,
                    succeeded: 4,
                    failed: 1,
                    details: ['retry-detail']
                },
                cancellations: {
                    processed: 2,
                    details: ['cancel-detail']
                }
            });
        });

        it('should run retries before cancellations (sequential, not parallel)', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            const callOrder: string[] = [];

            const lifecycle = {
                processRetries: vi.fn().mockImplementation(async () => {
                    callOrder.push('retries');
                    return { processed: 1, succeeded: 1, failed: 0, details: [] };
                }),
                processCancellations: vi.fn().mockImplementation(async () => {
                    callOrder.push('cancellations');
                    return { processed: 1, details: [] };
                })
            };
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            const ctx = makeCronContext();

            // Act
            await dunningJob.handler(ctx);

            // Assert - retries must run first
            expect(callOrder).toEqual(['retries', 'cancellations']);
        });

        it('should include cancellation failures in totalErrors', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            const lifecycle = makeLifecycleMock(
                { processed: 2, succeeded: 1, failed: 1, details: [] },
                { processed: 3, details: [], failed: 2 } as {
                    processed: number;
                    details: unknown[];
                    failed?: number;
                }
            );
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            const ctx = makeCronContext();

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert - totalErrors = retriesResult.failed (1) + cancellationsResult.failed (2)
            expect(result.errors).toBe(3);
        });

        it('should return zero counts when no subscriptions need processing', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            const lifecycle = makeLifecycleMock();
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            const ctx = makeCronContext();

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
        });

        it('should pass correct config to createSubscriptionLifecycle', async () => {
            // Arrange
            const billing = makeBillingMock();
            const storage = billing.getStorage();
            mockGetQZPayBilling.mockReturnValue(billing);

            const lifecycle = makeLifecycleMock();
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            const ctx = makeCronContext();

            // Act
            await dunningJob.handler(ctx);

            // Assert
            expect(mockCreateSubscriptionLifecycle).toHaveBeenCalledOnce();
            const [billingArg, storageArg, configArg] =
                mockCreateSubscriptionLifecycle.mock.calls[0]!;
            expect(billingArg).toBe(billing);
            expect(storageArg).toBe(storage);
            expect(configArg.gracePeriodDays).toBe(7);
            expect(configArg.retryIntervals).toEqual([1, 3, 5, 7]);
            expect(configArg.trialConversionDays).toBe(0);
            expect(typeof configArg.processPayment).toBe('function');
            expect(typeof configArg.getDefaultPaymentMethod).toBe('function');
            expect(typeof configArg.onEvent).toBe('function');
        });
    });

    // -----------------------------------------------------------------------
    // Error handling
    // -----------------------------------------------------------------------

    describe('error handling', () => {
        it('should return failure result when an unexpected error occurs', async () => {
            // Arrange
            mockGetQZPayBilling.mockImplementation(() => {
                throw new Error('Database connection lost');
            });
            const ctx = makeCronContext();

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Database connection lost');
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(1);
            expect(result.details).toMatchObject({
                error: 'Database connection lost'
            });
        });

        it('should handle non-Error thrown values', async () => {
            // Arrange
            mockGetQZPayBilling.mockImplementation(() => {
                throw 'string error';
            });
            const ctx = makeCronContext();

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('string error');
        });

        it('should handle processRetries failure', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            const lifecycle = {
                processRetries: vi.fn().mockRejectedValue(new Error('Retry service down')),
                processCancellations: vi.fn().mockResolvedValue({ processed: 0, details: [] })
            };
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            const ctx = makeCronContext();

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Retry service down');
        });
    });

    // -----------------------------------------------------------------------
    // Dunning attempt audit logging
    // -----------------------------------------------------------------------

    describe('audit logging via onEvent', () => {
        it('should record retry_succeeded event in billing_dunning_attempts', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            let capturedOnEvent: ((event: unknown) => Promise<void>) | undefined;
            mockCreateSubscriptionLifecycle.mockImplementation(
                (
                    _b: unknown,
                    _s: unknown,
                    config: { onEvent?: (event: unknown) => Promise<void> }
                ) => {
                    capturedOnEvent = config.onEvent;
                    return makeLifecycleMock();
                }
            );

            const ctx = makeCronContext();
            await dunningJob.handler(ctx);

            // Act
            const event = {
                type: 'subscription.retry_succeeded',
                subscriptionId: 'sub_123',
                customerId: 'cust_456',
                timestamp: new Date('2026-03-02T06:00:00Z'),
                data: {
                    attemptNumber: 2,
                    amount: 150000,
                    currency: 'ARS',
                    paymentId: 'pay_789',
                    provider: 'mercadopago'
                }
            };
            await capturedOnEvent!(event);

            // Assert
            expect(mockDbInsert).toHaveBeenCalledOnce();
        });

        it('should record retry_failed event in billing_dunning_attempts', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            let capturedOnEvent: ((event: unknown) => Promise<void>) | undefined;
            mockCreateSubscriptionLifecycle.mockImplementation(
                (
                    _b: unknown,
                    _s: unknown,
                    config: { onEvent?: (event: unknown) => Promise<void> }
                ) => {
                    capturedOnEvent = config.onEvent;
                    return makeLifecycleMock();
                }
            );

            const ctx = makeCronContext();
            await dunningJob.handler(ctx);

            // Act
            const event = {
                type: 'subscription.retry_failed',
                subscriptionId: 'sub_123',
                customerId: 'cust_456',
                timestamp: new Date('2026-03-02T06:00:00Z'),
                data: {
                    attemptNumber: 3,
                    error: 'Insufficient funds',
                    failureCode: 'card_declined'
                }
            };
            await capturedOnEvent!(event);

            // Assert
            expect(mockDbInsert).toHaveBeenCalledOnce();
        });

        it('should NOT record non-retry events (e.g. canceled_nonpayment)', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            let capturedOnEvent: ((event: unknown) => Promise<void>) | undefined;
            mockCreateSubscriptionLifecycle.mockImplementation(
                (
                    _b: unknown,
                    _s: unknown,
                    config: { onEvent?: (event: unknown) => Promise<void> }
                ) => {
                    capturedOnEvent = config.onEvent;
                    return makeLifecycleMock();
                }
            );

            const ctx = makeCronContext();
            await dunningJob.handler(ctx);

            // Act
            const event = {
                type: 'subscription.canceled_nonpayment',
                subscriptionId: 'sub_123',
                customerId: 'cust_456',
                timestamp: new Date(),
                data: { reason: 'grace period expired' }
            };
            await capturedOnEvent!(event);

            // Assert
            expect(mockDbInsert).not.toHaveBeenCalled();
        });

        it('should not throw if DB insert fails (best-effort)', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            mockDbInsert.mockReturnValueOnce({
                values: vi.fn().mockRejectedValue(new Error('DB connection lost'))
            });

            let capturedOnEvent: ((event: unknown) => Promise<void>) | undefined;
            mockCreateSubscriptionLifecycle.mockImplementation(
                (
                    _b: unknown,
                    _s: unknown,
                    config: { onEvent?: (event: unknown) => Promise<void> }
                ) => {
                    capturedOnEvent = config.onEvent;
                    return makeLifecycleMock();
                }
            );

            const ctx = makeCronContext();
            await dunningJob.handler(ctx);

            // Act & Assert - should not throw
            const event = {
                type: 'subscription.retry_failed',
                subscriptionId: 'sub_123',
                customerId: 'cust_456',
                timestamp: new Date(),
                data: { attemptNumber: 1, error: 'timeout' }
            };
            await expect(capturedOnEvent!(event)).resolves.toBeUndefined();
        });
    });
});
