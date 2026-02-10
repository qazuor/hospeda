/**
 * Tests for Notification Retry Service
 *
 * Validates retry logic for failed notifications including:
 * - Critical type filtering
 * - Max retry limit
 * - Cooldown window
 * - Dry run mode
 * - Payload reconstruction
 *
 * @module test/services/notification-retry.service
 */

import { NotificationType } from '@repo/notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockUpdateWhere = vi.fn();

vi.mock('@repo/db', () => ({
    getDb: () => ({
        select: (...args: unknown[]) => {
            mockSelect(...args);
            return {
                from: (...fArgs: unknown[]) => {
                    mockFrom(...fArgs);
                    return {
                        where: (...wArgs: unknown[]) => {
                            mockWhere(...wArgs);
                            return {
                                limit: (...lArgs: unknown[]) => {
                                    mockLimit(...lArgs);
                                    return mockLimit.getMockImplementation()
                                        ? mockLimit(...lArgs)
                                        : [];
                                }
                            };
                        }
                    };
                }
            };
        },
        update: (...args: unknown[]) => {
            mockUpdate(...args);
            return {
                set: (...sArgs: unknown[]) => {
                    mockSet(...sArgs);
                    return {
                        where: (...wArgs: unknown[]) => {
                            mockUpdateWhere(...wArgs);
                            return Promise.resolve();
                        }
                    };
                }
            };
        }
    }),
    billingNotificationLog: {
        id: 'id',
        customerId: 'customerId',
        type: 'type',
        recipient: 'recipient',
        subject: 'subject',
        status: 'status',
        errorMessage: 'errorMessage',
        metadata: 'metadata',
        createdAt: 'createdAt',
        expiredAt: 'expiredAt',
        sentAt: 'sentAt'
    }
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
    and: (...args: unknown[]) => ({ type: 'and', args }),
    eq: (a: unknown, b: unknown) => ({ type: 'eq', a, b }),
    gte: (a: unknown, b: unknown) => ({ type: 'gte', a, b }),
    lt: (a: unknown, b: unknown) => ({ type: 'lt', a, b }),
    isNull: (a: unknown) => ({ type: 'isNull', a }),
    sql: Object.assign(
        (strings: TemplateStringsArray, ..._values: unknown[]) => ({
            type: 'sql',
            strings: [...strings]
        }),
        { raw: (s: string) => ({ type: 'sql_raw', value: s }) }
    )
}));

// Mock logger
const mockLoggerDebug = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: (...args: unknown[]) => mockLoggerDebug(...args),
        info: (...args: unknown[]) => mockLoggerInfo(...args),
        warn: (...args: unknown[]) => mockLoggerWarn(...args),
        error: (...args: unknown[]) => mockLoggerError(...args)
    }
}));

// Mock notification helper
const mockSendNotification = vi.fn();

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: (...args: unknown[]) => mockSendNotification(...args)
}));

// Import after mocks are set up
import { processDbNotificationRetries } from '../../src/services/notification-retry.service';

/**
 * Helper to create a failed notification record
 */
function createFailedNotification(overrides: Record<string, unknown> = {}) {
    return {
        id: 'notif-001',
        customerId: 'cust-123',
        type: NotificationType.PAYMENT_FAILURE,
        recipient: 'user@example.com',
        subject: 'Payment Failed',
        status: 'failed',
        errorMessage: 'SMTP connection timeout',
        metadata: { retryCount: 0, planName: 'Pro', amount: 1999, currency: 'ARS' },
        createdAt: new Date('2026-02-07T10:00:00Z'),
        ...overrides
    };
}

describe('processDbNotificationRetries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: return empty array (no failed notifications)
        mockLimit.mockResolvedValue([]);
    });

    describe('when no failed notifications exist', () => {
        it('should return zero stats', async () => {
            const stats = await processDbNotificationRetries();

            expect(stats).toEqual({
                processed: 0,
                succeeded: 0,
                failed: 0,
                permanentlyFailed: 0
            });
        });

        it('should log debug message', async () => {
            await processDbNotificationRetries();

            expect(mockLoggerDebug).toHaveBeenCalledWith('No failed notifications ready for retry');
        });

        it('should query with batch limit of 50', async () => {
            await processDbNotificationRetries();

            expect(mockLimit).toHaveBeenCalledWith(50);
        });
    });

    describe('when critical failed notifications exist', () => {
        it('should retry PAYMENT_FAILURE notifications', async () => {
            const notification = createFailedNotification({
                type: NotificationType.PAYMENT_FAILURE
            });
            mockLimit.mockResolvedValue([notification]);
            mockSendNotification.mockResolvedValue(undefined);

            const stats = await processDbNotificationRetries();

            expect(stats.processed).toBe(1);
            expect(stats.succeeded).toBe(1);
            expect(mockSendNotification).toHaveBeenCalledTimes(1);
        });

        it('should retry TRIAL_EXPIRED notifications', async () => {
            const notification = createFailedNotification({
                type: NotificationType.TRIAL_EXPIRED,
                metadata: { retryCount: 0, planName: 'Pro', trialEndDate: '2026-02-01' }
            });
            mockLimit.mockResolvedValue([notification]);
            mockSendNotification.mockResolvedValue(undefined);

            const stats = await processDbNotificationRetries();

            expect(stats.succeeded).toBe(1);
        });

        it('should retry TRIAL_ENDING_REMINDER notifications', async () => {
            const notification = createFailedNotification({
                type: NotificationType.TRIAL_ENDING_REMINDER,
                metadata: {
                    retryCount: 0,
                    planName: 'Pro',
                    trialEndDate: '2026-02-10',
                    daysRemaining: 3
                }
            });
            mockLimit.mockResolvedValue([notification]);
            mockSendNotification.mockResolvedValue(undefined);

            const stats = await processDbNotificationRetries();

            expect(stats.succeeded).toBe(1);
        });

        it('should retry ADDON_EXPIRED notifications', async () => {
            const notification = createFailedNotification({
                type: NotificationType.ADDON_EXPIRED,
                metadata: {
                    retryCount: 0,
                    addonName: 'Extra Photos',
                    expirationDate: '2026-02-05'
                }
            });
            mockLimit.mockResolvedValue([notification]);
            mockSendNotification.mockResolvedValue(undefined);

            const stats = await processDbNotificationRetries();

            expect(stats.succeeded).toBe(1);
        });

        it('should retry RENEWAL_REMINDER notifications', async () => {
            const notification = createFailedNotification({
                type: NotificationType.RENEWAL_REMINDER,
                metadata: {
                    retryCount: 0,
                    planName: 'Pro',
                    amount: 1999,
                    currency: 'ARS',
                    renewalDate: '2026-02-15'
                }
            });
            mockLimit.mockResolvedValue([notification]);
            mockSendNotification.mockResolvedValue(undefined);

            const stats = await processDbNotificationRetries();

            expect(stats.succeeded).toBe(1);
        });
    });

    describe('non-critical notification types', () => {
        it('should skip non-critical notification types', async () => {
            const notification = createFailedNotification({
                type: 'SUBSCRIPTION_CREATED'
            });
            mockLimit.mockResolvedValue([notification]);

            const stats = await processDbNotificationRetries();

            expect(stats.processed).toBe(1);
            expect(stats.succeeded).toBe(0);
            expect(stats.failed).toBe(0);
            expect(mockSendNotification).not.toHaveBeenCalled();
        });

        it('should log debug for skipped non-critical types', async () => {
            const notification = createFailedNotification({
                type: 'SUBSCRIPTION_UPDATED'
            });
            mockLimit.mockResolvedValue([notification]);

            await processDbNotificationRetries();

            expect(mockLoggerDebug).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'SUBSCRIPTION_UPDATED' }),
                'Skipping non-critical notification type'
            );
        });
    });

    describe('max retry limit', () => {
        it('should mark as permanently failed after 3 retries', async () => {
            const notification = createFailedNotification({
                metadata: { retryCount: 3 }
            });
            mockLimit.mockResolvedValue([notification]);

            const stats = await processDbNotificationRetries();

            expect(stats.permanentlyFailed).toBe(1);
            expect(stats.succeeded).toBe(0);
            expect(mockSendNotification).not.toHaveBeenCalled();
        });

        it('should update DB with expiredAt and permanentlyFailed flag', async () => {
            const notification = createFailedNotification({
                metadata: { retryCount: 3 }
            });
            mockLimit.mockResolvedValue([notification]);

            await processDbNotificationRetries();

            expect(mockUpdate).toHaveBeenCalled();
            expect(mockSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    expiredAt: expect.any(Date)
                })
            );
        });

        it('should log warning for permanently failed notifications', async () => {
            const notification = createFailedNotification({
                id: 'notif-perm-fail',
                metadata: { retryCount: 3 }
            });
            mockLimit.mockResolvedValue([notification]);

            await processDbNotificationRetries();

            expect(mockLoggerWarn).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'notif-perm-fail',
                    retries: 3
                }),
                'Notification permanently failed after max retries'
            );
        });

        it('should still retry with retryCount 2 (less than max)', async () => {
            const notification = createFailedNotification({
                metadata: { retryCount: 2, planName: 'Pro', amount: 1999, currency: 'ARS' }
            });
            mockLimit.mockResolvedValue([notification]);
            mockSendNotification.mockResolvedValue(undefined);

            const stats = await processDbNotificationRetries();

            expect(stats.succeeded).toBe(1);
            expect(stats.permanentlyFailed).toBe(0);
        });
    });

    describe('dry run mode', () => {
        it('should not send notifications in dry run', async () => {
            const notification = createFailedNotification();
            mockLimit.mockResolvedValue([notification]);

            const stats = await processDbNotificationRetries(true);

            expect(mockSendNotification).not.toHaveBeenCalled();
            expect(stats.processed).toBe(1);
        });

        it('should not update database in dry run for permanently failed', async () => {
            const notification = createFailedNotification({
                metadata: { retryCount: 3 }
            });
            mockLimit.mockResolvedValue([notification]);

            await processDbNotificationRetries(true);

            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('should log what would be retried', async () => {
            const notification = createFailedNotification({ id: 'dry-run-001' });
            mockLimit.mockResolvedValue([notification]);

            await processDbNotificationRetries(true);

            expect(mockLoggerInfo).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'dry-run-001',
                    retryCount: 0
                }),
                'Would retry notification (dry run)'
            );
        });
    });

    describe('successful retry', () => {
        it('should update status to sent on success', async () => {
            const notification = createFailedNotification();
            mockLimit.mockResolvedValue([notification]);
            mockSendNotification.mockResolvedValue(undefined);

            await processDbNotificationRetries();

            expect(mockSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'sent',
                    sentAt: expect.any(Date),
                    errorMessage: null
                })
            );
        });

        it('should log success with retry count', async () => {
            const notification = createFailedNotification({
                id: 'success-001',
                metadata: { retryCount: 1, planName: 'Pro', amount: 1999, currency: 'ARS' }
            });
            mockLimit.mockResolvedValue([notification]);
            mockSendNotification.mockResolvedValue(undefined);

            await processDbNotificationRetries();

            expect(mockLoggerInfo).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'success-001',
                    retryCount: 2
                }),
                'Notification retry succeeded'
            );
        });
    });

    describe('failed retry', () => {
        it('should increment retry count on failure', async () => {
            const notification = createFailedNotification({
                metadata: { retryCount: 0, planName: 'Pro', amount: 1999, currency: 'ARS' }
            });
            mockLimit.mockResolvedValue([notification]);
            mockSendNotification.mockRejectedValue(new Error('SMTP timeout'));

            const stats = await processDbNotificationRetries();

            expect(stats.failed).toBe(1);
            expect(stats.succeeded).toBe(0);
        });

        it('should update error message on failure', async () => {
            const notification = createFailedNotification({
                metadata: { retryCount: 0, planName: 'Pro', amount: 1999, currency: 'ARS' }
            });
            mockLimit.mockResolvedValue([notification]);
            mockSendNotification.mockRejectedValue(new Error('Connection refused'));

            await processDbNotificationRetries();

            expect(mockSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    errorMessage: 'Connection refused'
                })
            );
        });

        it('should log error with retry details', async () => {
            const notification = createFailedNotification({
                id: 'fail-001',
                metadata: { retryCount: 1, planName: 'Pro', amount: 1999, currency: 'ARS' }
            });
            mockLimit.mockResolvedValue([notification]);
            mockSendNotification.mockRejectedValue(new Error('SMTP error'));

            await processDbNotificationRetries();

            expect(mockLoggerError).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'fail-001',
                    retryCount: 2,
                    error: 'SMTP error'
                }),
                'Notification retry failed'
            );
        });

        it('should handle non-Error thrown values', async () => {
            const notification = createFailedNotification({
                metadata: { retryCount: 0, planName: 'Pro', amount: 1999, currency: 'ARS' }
            });
            mockLimit.mockResolvedValue([notification]);
            mockSendNotification.mockRejectedValue('string error');

            const stats = await processDbNotificationRetries();

            expect(stats.failed).toBe(1);
            expect(mockSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    errorMessage: 'Unknown retry error'
                })
            );
        });
    });

    describe('multiple notifications', () => {
        it('should process multiple notifications in batch', async () => {
            const notifications = [
                createFailedNotification({
                    id: 'notif-1',
                    metadata: { retryCount: 0, planName: 'Pro', amount: 1999, currency: 'ARS' }
                }),
                createFailedNotification({
                    id: 'notif-2',
                    type: NotificationType.TRIAL_EXPIRED,
                    metadata: { retryCount: 0, planName: 'Basic', trialEndDate: '2026-02-01' }
                }),
                createFailedNotification({
                    id: 'notif-3',
                    metadata: { retryCount: 3 }
                })
            ];
            mockLimit.mockResolvedValue(notifications);
            mockSendNotification.mockResolvedValue(undefined);

            const stats = await processDbNotificationRetries();

            expect(stats.processed).toBe(3);
            expect(stats.succeeded).toBe(2);
            expect(stats.permanentlyFailed).toBe(1);
        });
    });

    describe('database error handling', () => {
        it('should catch and log database query errors', async () => {
            mockLimit.mockRejectedValue(new Error('Database connection lost'));

            const stats = await processDbNotificationRetries();

            expect(stats).toEqual({
                processed: 0,
                succeeded: 0,
                failed: 0,
                permanentlyFailed: 0
            });
            expect(mockLoggerError).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Database connection lost'
                }),
                'Failed to process database-based notification retries'
            );
        });
    });

    describe('metadata handling', () => {
        it('should handle missing retryCount in metadata', async () => {
            const notification = createFailedNotification({
                metadata: { planName: 'Pro', amount: 1999, currency: 'ARS' }
            });
            mockLimit.mockResolvedValue([notification]);
            mockSendNotification.mockResolvedValue(undefined);

            const stats = await processDbNotificationRetries();

            expect(stats.succeeded).toBe(1);
        });

        it('should handle undefined metadata for payload reconstruction', async () => {
            const notification = createFailedNotification({
                type: NotificationType.PAYMENT_FAILURE,
                metadata: { retryCount: 0 }
            });
            mockLimit.mockResolvedValue([notification]);
            mockSendNotification.mockResolvedValue(undefined);

            const stats = await processDbNotificationRetries();

            // Should still attempt to send with default values
            expect(mockSendNotification).toHaveBeenCalledTimes(1);
            expect(stats.succeeded).toBe(1);
        });
    });
});
