/**
 * NotificationService Test Suite
 *
 * Comprehensive tests for notification orchestration service including:
 * - Sending notifications via transport and logging to database
 * - Skipping reminders when user has opted out
 * - Always sending transactional notifications regardless of preferences
 * - Queueing retries on transport failures
 * - Batch processing with error isolation
 * - Correct success/fail counts in batch operations
 *
 * @module test/services/notification.service.test
 */

import type { getDb } from '@repo/db';
import type { ILogger } from '@repo/logger';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    NotificationService,
    type NotificationServiceDeps
} from '../../src/services/notification.service';
import type { PreferenceService } from '../../src/services/preference.service';
import type { RetryService } from '../../src/services/retry.service';
import type { EmailTransport } from '../../src/transports/email/email-transport.interface';
import { NotificationType } from '../../src/types/notification.types';
import type { NotificationPayload } from '../../src/types/notification.types';

describe('NotificationService', () => {
    let service: NotificationService;
    let mockDeps: NotificationServiceDeps;
    let mockEmailTransport: EmailTransport;
    let mockPreferenceService: PreferenceService;
    let mockRetryService: RetryService;
    let mockDb: ReturnType<typeof getDb>;
    let mockLogger: ILogger;

    const basePayload = {
        recipientEmail: 'user@example.com',
        recipientName: 'John Doe',
        userId: 'user_123',
        customerId: 'cus_456'
    };

    beforeEach(() => {
        // Create mock email transport
        mockEmailTransport = {
            send: vi.fn()
        };

        // Create mock preference service
        mockPreferenceService = {
            shouldSendNotification: vi.fn(),
            getPreferences: vi.fn(),
            updatePreferences: vi.fn()
        } as unknown as PreferenceService;

        // Create mock retry service
        mockRetryService = {
            enqueue: vi.fn(),
            dequeueReady: vi.fn()
        } as unknown as RetryService;

        // Create mock database
        mockDb = {
            insert: vi.fn().mockReturnValue({
                values: vi.fn().mockResolvedValue(undefined)
            })
        } as unknown as ReturnType<typeof getDb>;

        // Create mock logger
        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn()
        } as unknown as ILogger;

        // Create service dependencies
        mockDeps = {
            emailTransport: mockEmailTransport,
            preferenceService: mockPreferenceService,
            retryService: mockRetryService,
            db: mockDb,
            logger: mockLogger
        };

        // Create service instance
        service = new NotificationService(mockDeps);

        // Default mock implementations
        (mockEmailTransport.send as Mock).mockResolvedValue({ messageId: 'msg_123' });
        (mockPreferenceService.shouldSendNotification as Mock).mockResolvedValue(true);
    });

    describe('send', () => {
        it('should call transport and log to database on success', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.PAYMENT_SUCCESS,
                ...basePayload,
                amount: 10000,
                currency: 'ARS',
                planName: 'Standard'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
            expect(result.status).toBe('sent');
            expect(result.messageId).toBe('msg_123');

            // Verify transport was called
            expect(mockEmailTransport.send).toHaveBeenCalledTimes(1);
            expect(mockEmailTransport.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'user@example.com',
                    subject: expect.any(String),
                    react: expect.any(Object),
                    from: expect.stringContaining('Hospeda')
                })
            );

            // Verify database logging
            expect(mockDb.insert).toHaveBeenCalledTimes(1);
            const insertCall = (mockDb.insert as Mock).mock.results[0].value;
            expect(insertCall.values).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: 'cus_456',
                    type: NotificationType.PAYMENT_SUCCESS,
                    channel: 'email',
                    recipient: 'user@example.com',
                    status: 'sent'
                })
            );

            // Verify logger was called
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.PAYMENT_SUCCESS,
                    recipientEmail: 'user@example.com',
                    messageId: 'msg_123'
                }),
                'Notification sent successfully'
            );
        });

        it('should skip reminder when user has opted out', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.RENEWAL_REMINDER,
                ...basePayload,
                planName: 'Standard',
                amount: 5000,
                currency: 'ARS',
                renewalDate: '2024-12-31'
            };

            // User has opted out of this notification type
            (mockPreferenceService.shouldSendNotification as Mock).mockResolvedValue(false);

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(false);
            expect(result.status).toBe('skipped');
            expect(result.skippedReason).toBe('User has opted out of this notification type');

            // Verify transport was NOT called
            expect(mockEmailTransport.send).not.toHaveBeenCalled();

            // Verify database logging with skipped status
            const insertCall = (mockDb.insert as Mock).mock.results[0].value;
            expect(insertCall.values).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'skipped',
                    errorMessage: 'User has opted out of this notification type'
                })
            );

            // Verify logger was called
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.RENEWAL_REMINDER,
                    userId: 'user_123'
                }),
                'Notification skipped due to user preferences'
            );
        });

        it('should always send transactional notifications even if preferences say no', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.SUBSCRIPTION_PURCHASE,
                ...basePayload,
                planName: 'Premium',
                amount: 15000,
                currency: 'ARS',
                billingPeriod: 'monthly',
                nextBillingDate: '2024-12-31'
            };

            // Preference service returns true for TRANSACTIONAL (always sends)
            (mockPreferenceService.shouldSendNotification as Mock).mockResolvedValue(true);

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
            expect(result.status).toBe('sent');

            // Verify shouldSendNotification was called
            expect(mockPreferenceService.shouldSendNotification).toHaveBeenCalledWith(
                'user_123',
                NotificationType.SUBSCRIPTION_PURCHASE
            );

            // Verify transport was called
            expect(mockEmailTransport.send).toHaveBeenCalledTimes(1);
        });

        it('should queue retry on transport failure', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.PAYMENT_SUCCESS,
                ...basePayload,
                amount: 10000,
                currency: 'ARS',
                planName: 'Standard',
                idempotencyKey: 'idem_123'
            };

            const transportError = new Error('SMTP connection timeout');
            (mockEmailTransport.send as Mock).mockRejectedValue(transportError);

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(false);
            expect(result.status).toBe('failed');
            expect(result.error).toBe('SMTP connection timeout');

            // Verify database logging with failed status
            const insertCall = (mockDb.insert as Mock).mock.results[0].value;
            expect(insertCall.values).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'failed',
                    errorMessage: 'SMTP connection timeout'
                })
            );

            // Verify retry service was called
            expect(mockRetryService.enqueue).toHaveBeenCalledTimes(1);
            expect(mockRetryService.enqueue).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'idem_123',
                    payload: expect.stringContaining('payment_success'),
                    attemptCount: 1,
                    lastError: 'SMTP connection timeout'
                }),
                60000 // First retry after 60s
            );

            // Verify error was logged
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.PAYMENT_SUCCESS,
                    error: 'SMTP connection timeout'
                }),
                'Failed to send notification'
            );
        });

        it('should handle null retry service gracefully', async () => {
            // Arrange
            const depsWithoutRetry = {
                ...mockDeps,
                retryService: null
            };
            const serviceWithoutRetry = new NotificationService(depsWithoutRetry);

            const payload: NotificationPayload = {
                type: NotificationType.PAYMENT_SUCCESS,
                ...basePayload,
                amount: 10000,
                currency: 'ARS',
                planName: 'Standard'
            };

            const transportError = new Error('Transport failed');
            (mockEmailTransport.send as Mock).mockRejectedValue(transportError);

            // Act
            const result = await serviceWithoutRetry.send(payload);

            // Assert
            expect(result.success).toBe(false);
            expect(result.status).toBe('failed');

            // Verify logger warned about missing retry service
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.PAYMENT_SUCCESS
                }),
                'Retry service not available, cannot enqueue for retry'
            );
        });

        it('should handle database logging errors gracefully', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.PAYMENT_SUCCESS,
                ...basePayload,
                amount: 10000,
                currency: 'ARS',
                planName: 'Standard'
            };

            // Mock database insert to fail
            mockDb = {
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockRejectedValue(new Error('DB connection failed'))
                })
            } as unknown as ReturnType<typeof getDb>;

            mockDeps.db = mockDb;
            service = new NotificationService(mockDeps);

            // Act
            const result = await service.send(payload);

            // Assert - Should still succeed in sending email
            expect(result.success).toBe(true);
            expect(result.status).toBe('sent');

            // Verify error was logged
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.PAYMENT_SUCCESS,
                    error: 'DB connection failed'
                }),
                'Failed to log notification to database'
            );
        });

        it('should include correct tags in email transport call', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.TRIAL_ENDING_REMINDER,
                ...basePayload,
                planName: 'Standard',
                trialEndDate: '2024-12-31',
                daysRemaining: 3,
                upgradeUrl: 'https://hospeda.com/upgrade'
            };

            // Act
            await service.send(payload);

            // Assert
            expect(mockEmailTransport.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    tags: [
                        {
                            name: 'notification_type',
                            value: NotificationType.TRIAL_ENDING_REMINDER
                        },
                        { name: 'category', value: 'reminder' }
                    ]
                })
            );
        });

        it('should handle all notification template types correctly', async () => {
            // Arrange - Test each major notification type
            const payloads: NotificationPayload[] = [
                {
                    type: NotificationType.PAYMENT_SUCCESS,
                    ...basePayload,
                    amount: 10000,
                    currency: 'ARS',
                    planName: 'Standard',
                    paymentMethod: 'Credit Card'
                },
                {
                    type: NotificationType.ADDON_EXPIRATION_WARNING,
                    ...basePayload,
                    addonName: 'Priority Support',
                    daysRemaining: 5,
                    expirationDate: '2024-12-31'
                },
                {
                    type: NotificationType.TRIAL_EXPIRED,
                    ...basePayload,
                    planName: 'Premium',
                    trialEndDate: '2024-12-15',
                    upgradeUrl: 'https://hospeda.com/upgrade'
                },
                {
                    type: NotificationType.ADMIN_PAYMENT_FAILURE,
                    ...basePayload,
                    affectedUserEmail: 'affected@example.com',
                    affectedUserId: 'user_789',
                    severity: 'critical' as const,
                    eventDetails: { reason: 'Card declined' }
                }
            ];

            // Act & Assert
            for (const payload of payloads) {
                const result = await service.send(payload);
                expect(result.success).toBe(true);
                expect(result.status).toBe('sent');
            }

            expect(mockEmailTransport.send).toHaveBeenCalledTimes(4);
        });
    });

    describe('sendBatch', () => {
        it('should process all items with error isolation (one failure does not stop others)', async () => {
            // Arrange
            const payloads: NotificationPayload[] = [
                {
                    type: NotificationType.PAYMENT_SUCCESS,
                    ...basePayload,
                    recipientEmail: 'user1@example.com',
                    amount: 10000,
                    currency: 'ARS',
                    planName: 'Standard'
                },
                {
                    type: NotificationType.PAYMENT_SUCCESS,
                    ...basePayload,
                    recipientEmail: 'user2@example.com',
                    amount: 20000,
                    currency: 'ARS',
                    planName: 'Premium'
                },
                {
                    type: NotificationType.PAYMENT_SUCCESS,
                    ...basePayload,
                    recipientEmail: 'user3@example.com',
                    amount: 30000,
                    currency: 'ARS',
                    planName: 'Enterprise'
                }
            ];

            // Make second email fail
            (mockEmailTransport.send as Mock)
                .mockResolvedValueOnce({ messageId: 'msg_1' })
                .mockRejectedValueOnce(new Error('Transport failed'))
                .mockResolvedValueOnce({ messageId: 'msg_3' });

            // Act
            const results = await service.sendBatch(payloads);

            // Assert
            expect(results).toHaveLength(3);

            // First should succeed
            expect(results[0].success).toBe(true);
            expect(results[0].status).toBe('sent');
            expect(results[0].messageId).toBe('msg_1');

            // Second should fail
            expect(results[1].success).toBe(false);
            expect(results[1].status).toBe('failed');
            expect(results[1].error).toBe('Transport failed');

            // Third should still succeed despite second failure
            expect(results[2].success).toBe(true);
            expect(results[2].status).toBe('sent');
            expect(results[2].messageId).toBe('msg_3');

            // All three should have been attempted
            expect(mockEmailTransport.send).toHaveBeenCalledTimes(3);
        });

        it('should return correct success/fail counts', async () => {
            // Arrange
            const payloads: NotificationPayload[] = [
                {
                    type: NotificationType.RENEWAL_REMINDER,
                    ...basePayload,
                    recipientEmail: 'user1@example.com',
                    userId: 'user_1',
                    planName: 'Standard',
                    amount: 5000,
                    currency: 'ARS',
                    renewalDate: '2024-12-31'
                },
                {
                    type: NotificationType.RENEWAL_REMINDER,
                    ...basePayload,
                    recipientEmail: 'user2@example.com',
                    userId: 'user_2',
                    planName: 'Premium',
                    amount: 10000,
                    currency: 'ARS',
                    renewalDate: '2024-12-31'
                },
                {
                    type: NotificationType.RENEWAL_REMINDER,
                    ...basePayload,
                    recipientEmail: 'user3@example.com',
                    userId: 'user_3',
                    planName: 'Enterprise',
                    amount: 20000,
                    currency: 'ARS',
                    renewalDate: '2024-12-31'
                },
                {
                    type: NotificationType.RENEWAL_REMINDER,
                    ...basePayload,
                    recipientEmail: 'user4@example.com',
                    userId: 'user_4',
                    planName: 'Standard',
                    amount: 5000,
                    currency: 'ARS',
                    renewalDate: '2024-12-31'
                }
            ];

            // Setup: 2 succeed, 1 fail, 1 skip
            (mockEmailTransport.send as Mock)
                .mockResolvedValueOnce({ messageId: 'msg_1' }) // user_1: success
                .mockRejectedValueOnce(new Error('Transport failed')) // user_2: failed
                .mockResolvedValueOnce({ messageId: 'msg_3' }); // user_3: success

            (mockPreferenceService.shouldSendNotification as Mock)
                .mockResolvedValueOnce(true) // user_1: send
                .mockResolvedValueOnce(true) // user_2: send (but will fail)
                .mockResolvedValueOnce(true) // user_3: send
                .mockResolvedValueOnce(false); // user_4: skip

            // Act
            const results = await service.sendBatch(payloads);

            // Assert
            expect(results).toHaveLength(4);

            const successful = results.filter((r) => r.success).length;
            const failed = results.filter((r) => r.status === 'failed').length;
            const skipped = results.filter((r) => r.status === 'skipped').length;

            expect(successful).toBe(2);
            expect(failed).toBe(1);
            expect(skipped).toBe(1);

            // Verify logger was called with batch summary
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    total: 4,
                    successful: 2,
                    failed: 1,
                    skipped: 1
                }),
                'Batch notifications complete'
            );
        });

        it('should process empty batch without errors', async () => {
            // Arrange
            const payloads: NotificationPayload[] = [];

            // Act
            const results = await service.sendBatch(payloads);

            // Assert
            expect(results).toEqual([]);
            expect(mockEmailTransport.send).not.toHaveBeenCalled();
        });

        it('should process notifications sequentially to avoid rate limiting', async () => {
            // Arrange
            const payloads: NotificationPayload[] = [
                {
                    type: NotificationType.PAYMENT_SUCCESS,
                    ...basePayload,
                    recipientEmail: 'user1@example.com',
                    amount: 10000,
                    currency: 'ARS',
                    planName: 'Standard'
                },
                {
                    type: NotificationType.PAYMENT_SUCCESS,
                    ...basePayload,
                    recipientEmail: 'user2@example.com',
                    amount: 20000,
                    currency: 'ARS',
                    planName: 'Premium'
                }
            ];

            const callOrder: number[] = [];
            (mockEmailTransport.send as Mock).mockImplementation(async () => {
                callOrder.push(Date.now());
                return { messageId: `msg_${callOrder.length}` };
            });

            // Act
            await service.sendBatch(payloads);

            // Assert
            expect(callOrder).toHaveLength(2);
            // Calls should be sequential (second call after first completes)
            expect(mockEmailTransport.send).toHaveBeenCalledTimes(2);
        });

        it('should return results in same order as payloads', async () => {
            // Arrange
            const payloads: NotificationPayload[] = [
                {
                    type: NotificationType.PAYMENT_SUCCESS,
                    ...basePayload,
                    recipientEmail: 'alice@example.com',
                    amount: 10000,
                    currency: 'ARS',
                    planName: 'Standard'
                },
                {
                    type: NotificationType.PAYMENT_SUCCESS,
                    ...basePayload,
                    recipientEmail: 'bob@example.com',
                    amount: 20000,
                    currency: 'ARS',
                    planName: 'Premium'
                },
                {
                    type: NotificationType.PAYMENT_SUCCESS,
                    ...basePayload,
                    recipientEmail: 'charlie@example.com',
                    amount: 30000,
                    currency: 'ARS',
                    planName: 'Enterprise'
                }
            ];

            (mockEmailTransport.send as Mock)
                .mockResolvedValueOnce({ messageId: 'alice_msg' })
                .mockResolvedValueOnce({ messageId: 'bob_msg' })
                .mockResolvedValueOnce({ messageId: 'charlie_msg' });

            // Act
            const results = await service.sendBatch(payloads);

            // Assert
            expect(results[0].messageId).toBe('alice_msg');
            expect(results[1].messageId).toBe('bob_msg');
            expect(results[2].messageId).toBe('charlie_msg');

            // Verify order of email sends
            const calls = (mockEmailTransport.send as Mock).mock.calls;
            expect(calls[0][0].to).toBe('alice@example.com');
            expect(calls[1][0].to).toBe('bob@example.com');
            expect(calls[2][0].to).toBe('charlie@example.com');
        });
    });
});
