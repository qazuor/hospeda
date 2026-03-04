/**
 * Unit Tests: Notification Schedule Cron Job Handler
 *
 * Tests the notification-schedule job handler that sends scheduled notifications.
 *
 * Test Coverage:
 * - Sends trial ending reminders (3 days, 1 day)
 * - Processes notification retry queue
 * - Prevents duplicate notifications (idempotency)
 * - Handles no pending notifications gracefully
 * - Returns correct CronJobResult structure
 * - Error handling during processing
 * - Dry run mode behavior
 * - Billing not configured scenario
 *
 * @module test/cron/notification-schedule
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

// Mock notification retry service
vi.mock('../../src/services/notification-retry.service', () => ({
    processDbNotificationRetries: vi.fn().mockResolvedValue({
        processed: 0,
        succeeded: 0,
        failed: 0,
        permanentlyFailed: 0
    })
}));

// Mock Redis client (returns undefined = not configured, falls back to in-memory)
vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined)
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
import { processDbNotificationRetries } from '../../src/services/notification-retry.service';
import { TrialService } from '../../src/services/trial.service';
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

describe('Notification Schedule Cron Job', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetSentNotificationsFallback();
        process.env.WEB_URL = 'https://hospeda.com';
    });

    describe('Job Definition', () => {
        it('should have correct job metadata', () => {
            expect(notificationScheduleJob.name).toBe('notification-schedule');
            expect(notificationScheduleJob.description).toBe(
                'Send scheduled notifications for trials and subscription renewals'
            );
            expect(notificationScheduleJob.schedule).toBe('0 8 * * *');
            expect(notificationScheduleJob.enabled).toBe(true);
            expect(notificationScheduleJob.timeoutMs).toBe(120000);
        });
    });

    describe('Trial Ending Reminders', () => {
        it('should send reminders for trials ending in 3 days', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockTrials3Days = [
                {
                    id: 'sub-1',
                    customerId: 'cust-1',
                    userEmail: 'user1@example.com',
                    userName: 'User One',
                    userId: 'user-1',
                    planSlug: 'owner-basico',
                    trialEnd: new Date('2024-06-18T00:00:00Z'),
                    daysRemaining: 3
                },
                {
                    id: 'sub-2',
                    customerId: 'cust-2',
                    userEmail: 'user2@example.com',
                    userName: 'User Two',
                    userId: 'user-2',
                    planSlug: 'complex-basico',
                    trialEnd: new Date('2024-06-18T00:00:00Z'),
                    daysRemaining: 3
                }
            ];

            const mockBilling = {};
            const mockTrialService = {
                findTrialsEndingSoon: vi
                    .fn()
                    .mockResolvedValueOnce(mockTrials3Days) // 3 days
                    .mockResolvedValueOnce([]) // 1 day
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
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
            expect(result.processed).toBe(2);
            expect(sendNotification).toHaveBeenCalledTimes(2);
            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.TRIAL_ENDING_REMINDER,
                    customerId: 'cust-1',
                    planName: 'owner-basico',
                    daysRemaining: 3
                })
            );
            expect(mockTrialService.findTrialsEndingSoon).toHaveBeenCalledWith({ daysAhead: 3 });
        });

        it('should send reminders for trials ending in 1 day', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockTrials1Day = [
                {
                    id: 'sub-1',
                    customerId: 'cust-1',
                    userEmail: 'user@example.com',
                    userName: 'User',
                    userId: 'user-1',
                    planSlug: 'owner-basico',
                    trialEnd: new Date('2024-06-16T00:00:00Z'),
                    daysRemaining: 1
                }
            ];

            const mockBilling = {};
            const mockTrialService = {
                findTrialsEndingSoon: vi
                    .fn()
                    .mockResolvedValueOnce([]) // 3 days
                    .mockResolvedValueOnce(mockTrials1Day) // 1 day
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
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
            expect(result.processed).toBe(1);
            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.TRIAL_ENDING_REMINDER,
                    daysRemaining: 1
                })
            );
            expect(mockTrialService.findTrialsEndingSoon).toHaveBeenCalledWith({ daysAhead: 1 });
        });

        it('should not send duplicate reminders (idempotency)', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockTrial = {
                id: 'sub-1',
                customerId: 'cust-1',
                userEmail: 'user@example.com',
                userName: 'User',
                userId: 'user-1',
                planSlug: 'owner-basico',
                trialEnd: new Date('2024-06-18T00:00:00Z'),
                daysRemaining: 3
            };

            const mockBilling = {};
            const mockTrialService = {
                findTrialsEndingSoon: vi
                    .fn()
                    .mockResolvedValueOnce([mockTrial]) // 3 days
                    .mockResolvedValueOnce([mockTrial]) // 1 day - same trial
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
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
            expect(result.processed).toBe(1); // Should only count once
            expect(sendNotification).toHaveBeenCalledTimes(1); // Should only send once
        });

        it('should handle no trials ending soon', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockBilling = {};
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
            expect(result.processed).toBe(0);
            expect(sendNotification).not.toHaveBeenCalled();
        });
    });

    describe('Notification Retries', () => {
        it('should process database-based notification retry queue', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockBilling = {};
            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            // Mock database-based retry to return stats
            vi.mocked(processDbNotificationRetries).mockResolvedValue({
                processed: 5,
                succeeded: 3,
                failed: 1,
                permanentlyFailed: 1
            });

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toContain('5 retries');
            expect(result.message).toContain('3 succeeded');
            expect(result.message).toContain('1 re-queued');
            expect(result.message).toContain('1 permanently failed');
            expect(result.details?.retries).toMatchObject({
                processed: 5,
                succeeded: 3,
                failed: 1,
                permanentlyFailed: 1
            });
            expect(processDbNotificationRetries).toHaveBeenCalledTimes(1);
            expect(processDbNotificationRetries).toHaveBeenCalledWith(false); // Not dry run
        });

        it('should continue job execution even if retry processing fails', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockBilling = {};
            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([
                    {
                        id: 'sub-1',
                        customerId: 'cust-1',
                        userEmail: 'user@example.com',
                        userName: 'User',
                        userId: 'user-1',
                        planSlug: 'owner-basico',
                        trialEnd: new Date('2024-06-18T00:00:00Z'),
                        daysRemaining: 3
                    }
                ])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            // Mock database-based retry to fail
            vi.mocked(processDbNotificationRetries).mockRejectedValue(
                new Error('Database connection failed')
            );

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true); // Job should not fail
            expect(result.processed).toBe(1); // Should still process notifications
            expect(ctx.logger.error).toHaveBeenCalledWith(
                'Failed to process notification retries',
                expect.objectContaining({
                    error: 'Database connection failed'
                })
            );
        });
    });

    describe('Dry Run Mode', () => {
        it('should count notifications without sending in dry-run mode', async () => {
            // Arrange
            const ctx = createMockContext({ dryRun: true });
            const mockBilling = {};
            const mockTrialService = {
                findTrialsEndingSoon: vi
                    .fn()
                    .mockResolvedValueOnce([{}, {}]) // 3 days
                    .mockResolvedValueOnce([{}]) // 1 day
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(3);
            expect(sendNotification).not.toHaveBeenCalled();
            expect(result.details?.dryRun).toBe(true);
        });

        it('should skip retry processing in dry-run mode', async () => {
            // Arrange
            const ctx = createMockContext({ dryRun: true });
            const mockBilling = {};
            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };
            const mockRetryService = {
                processRetries: vi.fn()
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(RetryService).mockImplementation(() => mockRetryService as any);

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockRetryService.processRetries).not.toHaveBeenCalled();
        });
    });

    describe('Billing Not Configured', () => {
        it('should skip processing when billing is not configured', async () => {
            // Arrange
            const ctx = createMockContext();
            vi.mocked(getQZPayBilling).mockReturnValue(null);

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toBe('Skipped - Billing not configured');
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(ctx.logger.warn).toHaveBeenCalledWith(
                'Billing not configured, skipping notification schedule'
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle trial service errors gracefully', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockBilling = {};
            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockRejectedValue(new Error('Database error'))
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to process scheduled notifications');
            expect(result.message).toContain('Database error');
            expect(result.errors).toBeGreaterThan(0);
        });

        it('should handle notification failures gracefully', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockBilling = {};
            const mockTrialService = {
                findTrialsEndingSoon: vi
                    .fn()
                    .mockResolvedValueOnce([
                        {
                            id: 'sub-1',
                            customerId: 'cust-1',
                            userEmail: 'user@example.com',
                            userName: 'User',
                            userId: 'user-1',
                            planSlug: 'owner-basico',
                            trialEnd: new Date('2024-06-18T00:00:00Z'),
                            daysRemaining: 3
                        }
                    ])
                    .mockResolvedValueOnce([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(sendNotification).mockRejectedValue(new Error('Email service unavailable'));
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
            expect(result.success).toBe(true); // Job should not fail due to notification errors
            expect(result.processed).toBe(1);
            expect(ctx.logger.debug).toHaveBeenCalled();
        });
    });

    describe('Result Structure', () => {
        it('should return correctly structured CronJobResult', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockBilling = {};
            const mockTrialService = {
                findTrialsEndingSoon: vi.fn().mockResolvedValue([])
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);
            vi.mocked(RetryService).mockImplementation(
                () =>
                    ({
                        processRetries: vi.fn().mockResolvedValue({
                            processed: 2,
                            succeeded: 2,
                            failed: 0,
                            permanentlyFailed: 0
                        })
                    }) as any
            );

            // Act
            const result = await notificationScheduleJob.handler(ctx);

            // Assert
            expect(result).toMatchObject({
                success: expect.any(Boolean),
                message: expect.any(String),
                processed: expect.any(Number),
                errors: expect.any(Number),
                durationMs: expect.any(Number)
            });

            if (result.details) {
                expect(result.details).toMatchObject({
                    trialsEnding3Days: expect.any(Number),
                    trialsEnding1Day: expect.any(Number),
                    retries: expect.objectContaining({
                        processed: expect.any(Number),
                        succeeded: expect.any(Number),
                        failed: expect.any(Number),
                        permanentlyFailed: expect.any(Number)
                    }),
                    dryRun: expect.any(Boolean)
                });
            }
        });
    });
});
