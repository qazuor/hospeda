/**
 * Unit Tests: Notification Schedule Cron Job - Renewal Reminders
 *
 * Tests the renewal reminder functionality of the notification-schedule job.
 *
 * Test Coverage:
 * - Subscriptions renewing in 7, 3, or 1 days get RENEWAL_REMINDER
 * - Subscriptions NOT renewing on reminder days are skipped
 * - Duplicate renewal reminders prevented (idempotency)
 * - Dry run mode counts but doesn't send
 * - Customer lookup failure skips notification gracefully
 * - renewalsSent counter in result
 * - Plan name lookup
 * - daysRemaining is included in notification payload
 *
 * @module test/cron/notification-schedule-renewal
 */

import { NotificationType, RetryService } from '@repo/notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    notificationScheduleJob,
    resetSentNotificationsFallback
} from '../../src/cron/jobs/notification-schedule.job';
import type { CronJobContext } from '../../src/cron/types';

// Mock billing middleware
vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

// Mock TrialService
vi.mock('../../src/services/trial.service', () => ({
    TrialService: vi.fn()
}));

// Mock notification helper
vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn()
}));

// Mock customer lookup helper
vi.mock('../../src/utils/customer-lookup', () => ({
    lookupCustomerDetails: vi.fn()
}));

// Mock Redis client (returns undefined = not configured, falls back to in-memory)
vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined)
}));

// Mock notification retry service
vi.mock('../../src/services/notification-retry.service', () => ({
    processDbNotificationRetries: vi.fn().mockResolvedValue({
        processed: 0,
        succeeded: 0,
        failed: 0,
        permanentlyFailed: 0
    })
}));

// Mock @repo/notifications
vi.mock('@repo/notifications', async () => {
    const actual = await vi.importActual('@repo/notifications');
    return {
        ...actual,
        RetryService: vi.fn()
    };
});

// Import mocked modules after mocking
import { getQZPayBilling } from '../../src/middlewares/billing';
import { TrialService } from '../../src/services/trial.service';
import { lookupCustomerDetails } from '../../src/utils/customer-lookup';
import { sendNotification } from '../../src/utils/notification-helper';

/**
 * Helper to create mock CronJobContext
 */
function createMockContext(overrides?: Partial<CronJobContext>): CronJobContext {
    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        },
        startedAt: new Date('2024-06-15T08:00:00Z'),
        dryRun: false,
        ...overrides
    };
}

/**
 * Helper to create mock subscription
 * Note: Uses real Date.now() because the cron job uses `new Date()` internally
 */
let subscriptionCounter = 0;
function createMockSubscription(daysUntilRenewal: number) {
    const now = new Date(); // Use real current time
    const renewalDate = new Date(now);
    renewalDate.setDate(renewalDate.getDate() + daysUntilRenewal);

    subscriptionCounter++;

    return {
        id: `sub-${subscriptionCounter}`,
        customerId: `cust-${subscriptionCounter}`,
        planId: 'plan-owner-basico',
        status: 'active',
        interval: 'month',
        currentPeriodEnd: renewalDate.toISOString()
    };
}

describe('Notification Schedule Cron Job - Renewal Reminders', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetSentNotificationsFallback();
        process.env.WEB_URL = 'https://hospeda.com';
        subscriptionCounter = 0; // Reset counter for each test
    });

    describe('Renewal Reminder Sending', () => {
        it('should send renewal reminders for subscriptions renewing in 3 days', async () => {
            // Arrange
            const ctx = createMockContext();

            const mockSubscriptions = [
                createMockSubscription(3), // Renews in 3 days - should send
                createMockSubscription(3) // Another one renewing in 3 days
            ];

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: mockSubscriptions })
                },
                plans: {
                    get: vi.fn().mockResolvedValue({ name: 'Plan Owner Básico' })
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([]) // No trials
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'user@example.com',
                name: 'Test User',
                userId: 'user-123'
            });
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as any
            );

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.renewalsSent).toBe(2);
            expect(sendNotification).toHaveBeenCalledTimes(2);
            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.RENEWAL_REMINDER,
                    recipientEmail: 'user@example.com',
                    recipientName: 'Test User',
                    userId: 'user-123',
                    customerId: expect.stringContaining('cust-'),
                    planName: 'Plan Owner Básico'
                })
            );
        });

        it('should send renewal reminders for subscriptions renewing in 7 days', async () => {
            // Arrange
            const ctx = createMockContext();

            const mockSubscriptions = [
                createMockSubscription(7) // Renews in 7 days - should send
            ];

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: mockSubscriptions })
                },
                plans: {
                    get: vi.fn().mockResolvedValue({ name: 'Plan Owner Básico' })
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'user@example.com',
                name: 'Test User',
                userId: 'user-123'
            });
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as any
            );

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.renewalsSent).toBe(1);
            expect(sendNotification).toHaveBeenCalledTimes(1);
            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.RENEWAL_REMINDER,
                    daysRemaining: 7
                })
            );
        });

        it('should send renewal reminders for subscriptions renewing in 1 day', async () => {
            // Arrange
            const ctx = createMockContext();

            const mockSubscriptions = [
                createMockSubscription(1) // Renews in 1 day - should send
            ];

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: mockSubscriptions })
                },
                plans: {
                    get: vi.fn().mockResolvedValue({ name: 'Plan Owner Pro' })
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'user@example.com',
                name: 'Test User',
                userId: 'user-123'
            });
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as any
            );

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.renewalsSent).toBe(1);
            expect(sendNotification).toHaveBeenCalledTimes(1);
            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.RENEWAL_REMINDER,
                    daysRemaining: 1
                })
            );
        });

        it('should send reminders for all three reminder days (7, 3, 1)', async () => {
            // Arrange
            const ctx = createMockContext();

            const mockSubscriptions = [
                createMockSubscription(7), // 7-day reminder
                createMockSubscription(3), // 3-day reminder
                createMockSubscription(1) // 1-day reminder
            ];

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: mockSubscriptions })
                },
                plans: {
                    get: vi.fn().mockResolvedValue({ name: 'Test Plan' })
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'user@example.com',
                name: 'Test User',
                userId: 'user-123'
            });
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as any
            );

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.renewalsSent).toBe(3);
            expect(sendNotification).toHaveBeenCalledTimes(3);
        });

        it('should NOT send renewal reminders for non-reminder days', async () => {
            // Arrange
            const ctx = createMockContext();

            const mockSubscriptions = [
                createMockSubscription(2), // Renews in 2 days - skip
                createMockSubscription(4), // Renews in 4 days - skip
                createMockSubscription(10), // Renews in 10 days - skip
                createMockSubscription(5) // Renews in 5 days - skip
            ];

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: mockSubscriptions })
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as any
            );

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.renewalsSent).toBe(0);
            expect(sendNotification).not.toHaveBeenCalled();
            expect(lookupCustomerDetails).not.toHaveBeenCalled();
        });

        it('should skip subscriptions without currentPeriodEnd', async () => {
            // Arrange
            const ctx = createMockContext();

            const mockSubscriptions = [
                {
                    id: 'sub-no-end',
                    customerId: 'cust-no-end',
                    planId: 'plan-owner-basico',
                    status: 'active'
                    // No currentPeriodEnd
                }
            ];

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: mockSubscriptions })
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as any
            );

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.renewalsSent).toBe(0);
            expect(sendNotification).not.toHaveBeenCalled();
        });
    });

    describe('Idempotency', () => {
        it('should prevent duplicate renewal reminders', async () => {
            // Arrange
            const ctx = createMockContext();

            const mockSubscription = createMockSubscription(3);

            // Same subscription returned twice (simulating multiple checks)
            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: [mockSubscription, mockSubscription] })
                },
                plans: {
                    get: vi.fn().mockResolvedValue({ name: 'Test Plan' })
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'user@example.com',
                name: 'Test User',
                userId: 'user-123'
            });
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as any
            );

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.renewalsSent).toBe(1); // Only sent once
            expect(sendNotification).toHaveBeenCalledTimes(1);
            expect(ctx.logger.debug).toHaveBeenCalledWith(
                'Skipping duplicate renewal reminder',
                expect.objectContaining({
                    customerId: mockSubscription.customerId
                })
            );
        });
    });

    describe('Customer Lookup', () => {
        it('should skip notification when customer lookup fails', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockSubscription = createMockSubscription(3);

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: [mockSubscription] })
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(lookupCustomerDetails).mockResolvedValue(null); // Lookup failed
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as any
            );

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.renewalsSent).toBe(0);
            expect(sendNotification).not.toHaveBeenCalled();
            expect(ctx.logger.warn).toHaveBeenCalledWith(
                'Could not look up customer for renewal reminder',
                expect.objectContaining({
                    customerId: mockSubscription.customerId
                })
            );
        });

        it('should include customer details in notification', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockSubscription = createMockSubscription(3);

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: [mockSubscription] })
                },
                plans: {
                    get: vi.fn().mockResolvedValue({ name: 'Premium Plan' })
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            const mockCustomerDetails = {
                email: 'specific@example.com',
                name: 'Specific User',
                userId: 'user-specific'
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(lookupCustomerDetails).mockResolvedValue(mockCustomerDetails);
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as any
            );

            // Act
            await notificationScheduleJob.handler(ctx);

            // Assert
            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    recipientEmail: mockCustomerDetails.email,
                    recipientName: mockCustomerDetails.name,
                    userId: mockCustomerDetails.userId
                })
            );
        });
    });

    describe('Plan Name Lookup', () => {
        it('should use plan name from billing API', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockSubscription = createMockSubscription(3);

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: [mockSubscription] })
                },
                plans: {
                    get: vi.fn().mockResolvedValue({ name: 'Custom Plan Name' })
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'user@example.com',
                name: 'User',
                userId: 'user-123'
            });
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as any
            );

            // Act
            await notificationScheduleJob.handler(ctx);

            // Assert
            expect(mockBilling.plans.get).toHaveBeenCalledWith('plan-owner-basico');
            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    planName: 'Custom Plan Name'
                })
            );
        });

        it('should use default plan name when lookup fails', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockSubscription = createMockSubscription(3);

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: [mockSubscription] })
                },
                plans: {
                    get: vi.fn().mockRejectedValue(new Error('Plan not found'))
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'user@example.com',
                name: 'User',
                userId: 'user-123'
            });
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as any
            );

            // Act
            await notificationScheduleJob.handler(ctx);

            // Assert
            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    planName: 'Unknown Plan'
                })
            );
        });
    });

    describe('Dry Run Mode', () => {
        it('should count renewal reminders without sending in dry run mode', async () => {
            // Arrange
            const ctx = createMockContext({ dryRun: true });

            const mockSubscriptions = [
                createMockSubscription(7),
                createMockSubscription(3),
                createMockSubscription(1)
            ];

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: mockSubscriptions })
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.renewalsSent).toBe(3);
            expect(sendNotification).not.toHaveBeenCalled();
            expect(lookupCustomerDetails).not.toHaveBeenCalled();
            expect(ctx.logger.info).toHaveBeenCalledWith(
                'Dry run mode - would send renewal reminders',
                expect.objectContaining({
                    count: 3
                })
            );
        });

        it('should not send in dry run even if subscriptions renewing soon', async () => {
            // Arrange
            const ctx = createMockContext({ dryRun: true });

            const mockSubscriptions = [createMockSubscription(3)];

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: mockSubscriptions })
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(sendNotification).not.toHaveBeenCalled();
            expect(result.details?.dryRun).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle subscription list errors gracefully', async () => {
            // Arrange
            const ctx = createMockContext();

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockRejectedValue(new Error('API error'))
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as any
            );

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true); // Job doesn't fail
            expect(result.details?.renewalsSent).toBe(0);
            expect(ctx.logger.error).toHaveBeenCalledWith(
                'Failed to process renewal reminders',
                expect.objectContaining({
                    error: 'API error'
                })
            );
        });

        it('should continue processing after individual notification error', async () => {
            // Arrange
            const ctx = createMockContext();

            const mockSubscriptions = [createMockSubscription(3), createMockSubscription(3)];

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: mockSubscriptions })
                },
                plans: {
                    get: vi.fn().mockResolvedValue({ name: 'Test Plan' })
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(lookupCustomerDetails)
                .mockResolvedValueOnce({
                    email: 'user1@example.com',
                    name: 'User 1',
                    userId: 'user-1'
                })
                .mockResolvedValueOnce({
                    email: 'user2@example.com',
                    name: 'User 2',
                    userId: 'user-2'
                });

            // First notification fails, second succeeds
            vi.mocked(sendNotification)
                .mockRejectedValueOnce(new Error('Email service down'))
                .mockResolvedValueOnce(undefined);

            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as any
            );

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.renewalsSent).toBe(2); // Both attempted
            // Fire-and-forget pattern means errors are caught and logged but not counted
            expect(result.errors).toBe(0);
            expect(sendNotification).toHaveBeenCalledTimes(2);
        });
    });

    describe('Result Structure', () => {
        it('should include renewalsSent in result details', async () => {
            // Arrange
            const ctx = createMockContext();

            const mockSubscriptions = [createMockSubscription(3), createMockSubscription(3)];

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: mockSubscriptions })
                },
                plans: {
                    get: vi.fn().mockResolvedValue({ name: 'Test Plan' })
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'user@example.com',
                name: 'User',
                userId: 'user-123'
            });
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as any
            );

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.details).toMatchObject({
                renewalsSent: 2,
                trialsEnding3Days: 0,
                trialsEnding1Day: 0
            });
        });
    });

    describe('Renewal Reminder Plan Prices', () => {
        it('should include actual plan price in renewal notification', async () => {
            // Arrange
            const ctx = createMockContext();

            const mockSubscriptions = [
                createMockSubscription(3) // Renews in 3 days
            ];

            const mockPlan = {
                name: 'Plan Owner Pro',
                prices: [
                    { billingInterval: 'month', unitAmount: 2500000 },
                    { billingInterval: 'year', unitAmount: 25000000 }
                ]
            };

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: mockSubscriptions })
                },
                plans: {
                    get: vi.fn().mockResolvedValue(mockPlan)
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(
                mockBilling as unknown as ReturnType<typeof getQZPayBilling>
            );
            vi.mocked(TrialService).mockImplementation(
                () => mockTrialService as unknown as InstanceType<typeof TrialService>
            );
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'owner@example.com',
                name: 'Owner Test',
                userId: 'user-price-1'
            });
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as unknown as InstanceType<typeof RetryService>
            );

            // Act
            await notificationScheduleJob.handler(ctx);

            // Assert
            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.RENEWAL_REMINDER,
                    planName: 'Plan Owner Pro',
                    amount: 2500000,
                    currency: 'ARS'
                })
            );
        });

        it('should omit amount when plan has no matching price', async () => {
            // Arrange
            const ctx = createMockContext();

            const mockSubscriptions = [
                createMockSubscription(3) // Renews in 3 days, interval defaults to 'month'
            ];

            const mockPlan = {
                name: 'Custom Plan',
                prices: [
                    { billingInterval: 'year', unitAmount: 25000000 } // No monthly price
                ]
            };

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: mockSubscriptions })
                },
                plans: {
                    get: vi.fn().mockResolvedValue(mockPlan)
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(
                mockBilling as unknown as ReturnType<typeof getQZPayBilling>
            );
            vi.mocked(TrialService).mockImplementation(
                () => mockTrialService as unknown as InstanceType<typeof TrialService>
            );
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'user@example.com',
                name: 'Test User',
                userId: 'user-price-2'
            });
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as unknown as InstanceType<typeof RetryService>
            );

            // Act
            await notificationScheduleJob.handler(ctx);

            // Assert - amount and currency should NOT be in the notification payload
            const notifCall = vi.mocked(sendNotification).mock.calls[0]?.[0] as unknown as Record<
                string,
                unknown
            >;
            expect(notifCall).toBeDefined();
            expect(notifCall.type).toBe(NotificationType.RENEWAL_REMINDER);
            expect(notifCall.planName).toBe('Custom Plan');
            expect(notifCall).not.toHaveProperty('amount');
            expect(notifCall).not.toHaveProperty('currency');
        });

        it('should omit amount when plan fetch fails', async () => {
            // Arrange
            const ctx = createMockContext();

            const mockSubscriptions = [createMockSubscription(3)];

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: mockSubscriptions })
                },
                plans: {
                    get: vi.fn().mockRejectedValue(new Error('Plan not found'))
                }
            };

            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(
                mockBilling as unknown as ReturnType<typeof getQZPayBilling>
            );
            vi.mocked(TrialService).mockImplementation(
                () => mockTrialService as unknown as InstanceType<typeof TrialService>
            );
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'user@example.com',
                name: 'Test User',
                userId: 'user-price-3'
            });
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 0,
                            succeeded: 0,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as unknown as InstanceType<typeof RetryService>
            );

            // Act
            await notificationScheduleJob.handler(ctx);

            // Assert - amount omitted, planName defaults to 'Unknown Plan'
            const notifCall = vi.mocked(sendNotification).mock.calls[0]?.[0] as unknown as Record<
                string,
                unknown
            >;
            expect(notifCall).toBeDefined();
            expect(notifCall.type).toBe(NotificationType.RENEWAL_REMINDER);
            expect(notifCall.planName).toBe('Unknown Plan');
            expect(notifCall).not.toHaveProperty('amount');
            expect(notifCall).not.toHaveProperty('currency');
        });
    });
});
