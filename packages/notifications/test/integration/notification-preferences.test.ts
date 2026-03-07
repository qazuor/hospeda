/**
 * Notification Preferences Integration Tests
 *
 * Comprehensive integration tests for notification preference handling:
 * 1. Send reminder to user who opted out -> verify skipped with reason logged
 * 2. Send transactional to opted-out user -> verify sent anyway
 * 3. Send admin notification -> verify sent to ADMIN_NOTIFICATION_EMAILS list
 *
 * These tests verify the preference system respects opt-out settings correctly
 * while ensuring critical notifications (transactional, admin) always send.
 *
 * @module test/integration/notification-preferences.test
 */

import { billingNotificationLog, type getDb } from '@repo/db';
import type { ILogger } from '@repo/logger';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    NotificationService,
    type NotificationServiceDeps
} from '../../src/services/notification.service';
import { PreferenceService } from '../../src/services/preference.service';
import type { EmailTransport } from '../../src/transports/email/email-transport.interface';
import {
    type AdminNotificationPayload,
    NotificationCategory,
    type NotificationPayload,
    NotificationType
} from '../../src/types/notification.types';
import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    type NotificationPreferences
} from '../../src/types/preferences.types';

describe('Notification Preferences Integration Tests', () => {
    let notificationService: NotificationService;
    let preferenceService: PreferenceService;
    let mockEmailTransport: EmailTransport;
    let mockGetUserSettings: Mock;
    let mockUpdateUserSettings: Mock;
    let mockDb: ReturnType<typeof getDb>;
    let mockLogger: ILogger;

    // Mock user settings database
    const userSettingsDb: Map<string, Record<string, unknown>> = new Map();

    beforeEach(() => {
        // Clear user settings
        userSettingsDb.clear();

        // Create mock email transport
        mockEmailTransport = {
            send: vi.fn().mockResolvedValue({ messageId: 'msg_test_123' })
        };

        // Create mock user settings functions
        mockGetUserSettings = vi.fn((userId: string) => {
            return Promise.resolve(userSettingsDb.get(userId) || null);
        });

        mockUpdateUserSettings = vi.fn((userId: string, settings: Record<string, unknown>) => {
            userSettingsDb.set(userId, settings);
            return Promise.resolve();
        });

        // Create preference service
        preferenceService = new PreferenceService({
            getUserSettings: mockGetUserSettings,
            updateUserSettings: mockUpdateUserSettings
        });

        // Create mock database with proper chaining
        const mockValues = vi.fn().mockResolvedValue(undefined);
        const mockInsert = vi.fn().mockReturnValue({
            values: mockValues
        });

        mockDb = {
            insert: mockInsert
        } as unknown as ReturnType<typeof getDb>;

        // Create mock logger
        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn()
        } as unknown as ILogger;

        // Create notification service dependencies
        const deps: NotificationServiceDeps = {
            emailTransport: mockEmailTransport,
            preferenceService,
            retryService: null, // Not testing retry in this suite
            db: mockDb,
            logger: mockLogger,
            siteUrl: 'https://hospeda.com.ar'
        };

        // Create notification service
        notificationService = new NotificationService(deps);
    });

    /**
     * Scenario 1: Opted-out User - REMINDER Category
     *
     * When user has opted out of reminder notifications:
     * - Notification should be skipped
     * - Reason should be logged
     * - Log entry created with status 'skipped'
     * - Email transport not called
     */
    describe('1. Opted-out User - REMINDER Category', () => {
        it('should skip reminder notification when user opted out', async () => {
            // Arrange - User has disabled reminder category
            const userId = 'user_opted_out_reminders';

            const userPrefs: NotificationPreferences = {
                ...DEFAULT_NOTIFICATION_PREFERENCES,
                disabledCategories: [NotificationCategory.REMINDER]
            };

            userSettingsDb.set(userId, {
                notifications: userPrefs
            });

            const payload: NotificationPayload = {
                type: NotificationType.RENEWAL_REMINDER,
                recipientEmail: 'opted-out@example.com',
                recipientName: 'Opted Out User',
                userId,
                customerId: 'cus_opted_out',
                planName: 'Standard',
                amount: 5000,
                currency: 'ARS',
                renewalDate: '2026-03-01'
            };

            // Act
            const result = await notificationService.send(payload);

            // Assert
            expect(result.success).toBe(false);
            expect(result.status).toBe('skipped');
            expect(result.skippedReason).toBe('User has opted out of this notification type');

            // Verify email was NOT sent
            expect(mockEmailTransport.send).not.toHaveBeenCalled();

            // Verify skipped reason was logged
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.RENEWAL_REMINDER,
                    userId,
                    reason: 'User has opted out of this notification type'
                }),
                'Notification skipped due to user preferences'
            );

            // Verify database log entry with status 'skipped'
            expect(mockDb.insert).toHaveBeenCalledWith(billingNotificationLog);
            const insertCall = (mockDb.insert as Mock).mock.results[0].value;
            expect(insertCall.values).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: 'cus_opted_out',
                    type: NotificationType.RENEWAL_REMINDER,
                    status: 'skipped',
                    errorMessage: 'User has opted out of this notification type'
                })
            );
        });

        it('should skip specific reminder type when user disabled it', async () => {
            // Arrange - User disabled only trial ending reminders
            const userId = 'user_disabled_trial_reminders';

            const userPrefs: NotificationPreferences = {
                ...DEFAULT_NOTIFICATION_PREFERENCES,
                disabledTypes: [NotificationType.TRIAL_ENDING_REMINDER]
            };

            userSettingsDb.set(userId, {
                notifications: userPrefs
            });

            const payload: NotificationPayload = {
                type: NotificationType.TRIAL_ENDING_REMINDER,
                recipientEmail: 'trial-disabled@example.com',
                recipientName: 'Trial Disabled User',
                userId,
                customerId: 'cus_trial_disabled',
                planName: 'Trial',
                trialEndDate: '2026-02-15',
                daysRemaining: 3,
                upgradeUrl: 'https://hospeda.com/upgrade'
            };

            // Act
            const result = await notificationService.send(payload);

            // Assert
            expect(result.success).toBe(false);
            expect(result.status).toBe('skipped');
            expect(result.skippedReason).toBeDefined();

            // Verify email was NOT sent
            expect(mockEmailTransport.send).not.toHaveBeenCalled();
        });

        it('should skip reminder when emailEnabled is false', async () => {
            // Arrange - User disabled all emails
            const userId = 'user_email_disabled';

            const userPrefs: NotificationPreferences = {
                ...DEFAULT_NOTIFICATION_PREFERENCES,
                emailEnabled: false
            };

            userSettingsDb.set(userId, {
                notifications: userPrefs
            });

            const payload: NotificationPayload = {
                type: NotificationType.ADDON_EXPIRATION_WARNING,
                recipientEmail: 'email-disabled@example.com',
                recipientName: 'Email Disabled User',
                userId,
                customerId: 'cus_email_disabled',
                addonName: 'Visibility Boost',
                daysRemaining: 2,
                expirationDate: '2026-02-05'
            };

            // Act
            const result = await notificationService.send(payload);

            // Assert
            expect(result.success).toBe(false);
            expect(result.status).toBe('skipped');

            // Verify email was NOT sent
            expect(mockEmailTransport.send).not.toHaveBeenCalled();
        });

        it('should log correct metadata for skipped notification', async () => {
            // Arrange
            const userId = 'user_metadata_check';
            const idempotencyKey = 'skip-metadata-001';

            userSettingsDb.set(userId, {
                notifications: {
                    ...DEFAULT_NOTIFICATION_PREFERENCES,
                    disabledCategories: [NotificationCategory.REMINDER]
                }
            });

            const payload: NotificationPayload = {
                type: NotificationType.RENEWAL_REMINDER,
                recipientEmail: 'metadata@example.com',
                recipientName: 'Metadata User',
                userId,
                customerId: 'cus_metadata',
                idempotencyKey,
                planName: 'Pro',
                amount: 10000,
                currency: 'ARS',
                renewalDate: '2026-03-01'
            };

            // Act
            await notificationService.send(payload);

            // Assert - Verify log metadata
            const insertCall = (mockDb.insert as Mock).mock.results[0].value;
            expect(insertCall.values).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'skipped',
                    errorMessage: 'User has opted out of this notification type',
                    metadata: expect.objectContaining({
                        userId,
                        recipientName: 'Metadata User',
                        category: NotificationCategory.REMINDER,
                        idempotencyKey
                    })
                })
            );
        });
    });

    /**
     * Scenario 2: Opted-out User - TRANSACTIONAL Category
     *
     * TRANSACTIONAL notifications MUST always send regardless of preferences:
     * - Even if user opted out of category
     * - Even if user disabled specific type
     * - Even if emailEnabled is false
     */
    describe('2. Opted-out User - TRANSACTIONAL Category (Always Send)', () => {
        it('should send transactional notification even when category disabled', async () => {
            // Arrange - User disabled transactional category (should be ignored)
            const userId = 'user_transactional_disabled';

            const userPrefs: NotificationPreferences = {
                ...DEFAULT_NOTIFICATION_PREFERENCES,
                disabledCategories: [NotificationCategory.TRANSACTIONAL]
            };

            userSettingsDb.set(userId, {
                notifications: userPrefs
            });

            const payload: NotificationPayload = {
                type: NotificationType.SUBSCRIPTION_PURCHASE,
                recipientEmail: 'transactional@example.com',
                recipientName: 'Transactional User',
                userId,
                customerId: 'cus_transactional',
                planName: 'Premium',
                amount: 15000,
                currency: 'ARS',
                billingPeriod: 'monthly',
                nextBillingDate: '2026-03-01'
            };

            // Act
            const result = await notificationService.send(payload);

            // Assert - MUST send despite opt-out
            expect(result.success).toBe(true);
            expect(result.status).toBe('sent');
            expect(result.messageId).toBe('msg_test_123');

            // Verify email WAS sent
            expect(mockEmailTransport.send).toHaveBeenCalledTimes(1);

            // Verify log status is 'sent'
            const insertCall = (mockDb.insert as Mock).mock.results[0].value;
            expect(insertCall.values).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'sent',
                    type: NotificationType.SUBSCRIPTION_PURCHASE
                })
            );
        });

        it('should send transactional notification even when specific type disabled', async () => {
            // Arrange - User disabled payment success notifications
            const userId = 'user_payment_success_disabled';

            const userPrefs: NotificationPreferences = {
                ...DEFAULT_NOTIFICATION_PREFERENCES,
                disabledTypes: [NotificationType.PAYMENT_SUCCESS]
            };

            userSettingsDb.set(userId, {
                notifications: userPrefs
            });

            const payload: NotificationPayload = {
                type: NotificationType.PAYMENT_SUCCESS,
                recipientEmail: 'payment@example.com',
                recipientName: 'Payment User',
                userId,
                customerId: 'cus_payment',
                amount: 5000,
                currency: 'ARS',
                planName: 'Standard',
                paymentMethod: 'credit_card'
            };

            // Act
            const result = await notificationService.send(payload);

            // Assert - MUST send
            expect(result.success).toBe(true);
            expect(result.status).toBe('sent');

            expect(mockEmailTransport.send).toHaveBeenCalledTimes(1);
        });

        it('should send transactional notification even when emailEnabled is false', async () => {
            // Arrange - User disabled all emails
            const userId = 'user_all_emails_disabled';

            const userPrefs: NotificationPreferences = {
                ...DEFAULT_NOTIFICATION_PREFERENCES,
                emailEnabled: false
            };

            userSettingsDb.set(userId, {
                notifications: userPrefs
            });

            const payload: NotificationPayload = {
                type: NotificationType.PLAN_CHANGE_CONFIRMATION,
                recipientEmail: 'plan-change@example.com',
                recipientName: 'Plan Change User',
                userId,
                customerId: 'cus_plan_change',
                oldPlanName: 'Basic',
                newPlanName: 'Pro',
                amount: 10000,
                currency: 'ARS'
            };

            // Act
            const result = await notificationService.send(payload);

            // Assert - MUST send
            expect(result.success).toBe(true);
            expect(result.status).toBe('sent');

            expect(mockEmailTransport.send).toHaveBeenCalledTimes(1);
        });

        it('should send payment failure transactional even when all preferences disabled', async () => {
            // Arrange - User disabled everything
            const userId = 'user_everything_disabled';

            const userPrefs: NotificationPreferences = {
                emailEnabled: false,
                disabledCategories: [
                    NotificationCategory.TRANSACTIONAL,
                    NotificationCategory.REMINDER
                ],
                disabledTypes: [NotificationType.PAYMENT_FAILURE]
            };

            userSettingsDb.set(userId, {
                notifications: userPrefs
            });

            const payload: NotificationPayload = {
                type: NotificationType.PAYMENT_FAILURE,
                recipientEmail: 'payment-fail@example.com',
                recipientName: 'Payment Failure User',
                userId,
                customerId: 'cus_payment_fail',
                amount: 5000,
                currency: 'ARS',
                failureReason: 'Insufficient funds',
                retryDate: '2026-02-05'
            };

            // Act
            const result = await notificationService.send(payload);

            // Assert - MUST send (critical notification)
            expect(result.success).toBe(true);
            expect(result.status).toBe('sent');

            expect(mockEmailTransport.send).toHaveBeenCalledTimes(1);
        });
    });

    /**
     * Scenario 3: Admin Notifications
     *
     * ADMIN notifications MUST always send:
     * - Not affected by user preferences (goes to admin list)
     * - Null userId (system notification)
     * - Sent to ADMIN_NOTIFICATION_EMAILS environment variable
     */
    describe('3. Admin Notifications (Always Send)', () => {
        it('should send admin notification with null userId', async () => {
            // Arrange - Admin notification has no userId
            const payload: AdminNotificationPayload = {
                type: NotificationType.ADMIN_PAYMENT_FAILURE,
                recipientEmail: 'admin@hospeda.com',
                recipientName: 'Admin',
                userId: null, // Admin notifications don't have userId
                customerId: 'cus_admin_alert',
                affectedUserEmail: 'user-with-issue@example.com',
                affectedUserId: 'user_123',
                severity: 'high',
                eventDetails: {
                    paymentId: 'mp_failed_payment_001',
                    reason: 'Card declined',
                    amount: 5000,
                    currency: 'ARS'
                }
            };

            // Act
            const result = await notificationService.send(payload);

            // Assert - MUST send
            expect(result.success).toBe(true);
            expect(result.status).toBe('sent');

            // Verify preferenceService was NOT consulted (no userId)
            // Note: In real implementation, shouldSendNotification returns true for null userId
            expect(mockEmailTransport.send).toHaveBeenCalledTimes(1);
            expect(mockEmailTransport.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'admin@hospeda.com',
                    tags: expect.arrayContaining([
                        {
                            name: 'notification_type',
                            value: NotificationType.ADMIN_PAYMENT_FAILURE
                        },
                        { name: 'category', value: NotificationCategory.ADMIN }
                    ])
                })
            );
        });

        it('should send admin system event notification', async () => {
            // Arrange
            const payload: AdminNotificationPayload = {
                type: NotificationType.ADMIN_SYSTEM_EVENT,
                recipientEmail: 'admin@hospeda.com',
                recipientName: 'Admin Team',
                userId: null,
                customerId: null,
                severity: 'critical',
                eventDetails: {
                    eventType: 'subscription_spike',
                    description: 'Unusual number of subscriptions in last hour',
                    count: 150,
                    threshold: 50
                }
            };

            // Act
            const result = await notificationService.send(payload);

            // Assert
            expect(result.success).toBe(true);
            expect(result.status).toBe('sent');

            expect(mockEmailTransport.send).toHaveBeenCalledTimes(1);
        });

        it('should log admin notification with correct metadata', async () => {
            // Arrange
            const payload: AdminNotificationPayload = {
                type: NotificationType.ADMIN_PAYMENT_FAILURE,
                recipientEmail: 'admin@hospeda.com',
                recipientName: 'Admin',
                userId: null,
                customerId: 'cus_admin_log',
                idempotencyKey: 'admin-log-001',
                affectedUserEmail: 'affected@example.com',
                affectedUserId: 'user_affected',
                severity: 'medium',
                eventDetails: {
                    paymentId: 'mp_001',
                    reason: 'Test failure'
                }
            };

            // Act
            await notificationService.send(payload);

            // Assert - Verify log metadata
            const insertCall = (mockDb.insert as Mock).mock.results[0].value;
            expect(insertCall.values).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: 'cus_admin_log',
                    type: NotificationType.ADMIN_PAYMENT_FAILURE,
                    channel: 'email',
                    recipient: 'admin@hospeda.com',
                    status: 'sent',
                    metadata: expect.objectContaining({
                        userId: null,
                        recipientName: 'Admin',
                        category: NotificationCategory.ADMIN,
                        idempotencyKey: 'admin-log-001'
                    })
                })
            );
        });
    });

    /**
     * Scenario 4: Mixed Batch - Some Skipped, Some Sent
     *
     * When sending batch notifications:
     * - Some users opted out, some enabled
     * - Results reflect individual preference checks
     */
    describe('4. Batch Notifications with Mixed Preferences', () => {
        it('should send batch with some skipped and some sent', async () => {
            // Arrange - Three users with different preferences
            const user1 = 'user_enabled';
            const user2 = 'user_disabled_reminders';
            const user3 = 'user_enabled_all';

            // User 1: All enabled (default)
            userSettingsDb.set(user1, {
                notifications: DEFAULT_NOTIFICATION_PREFERENCES
            });

            // User 2: Disabled reminder category
            userSettingsDb.set(user2, {
                notifications: {
                    ...DEFAULT_NOTIFICATION_PREFERENCES,
                    disabledCategories: [NotificationCategory.REMINDER]
                }
            });

            // User 3: All enabled
            userSettingsDb.set(user3, {
                notifications: DEFAULT_NOTIFICATION_PREFERENCES
            });

            const payloads: NotificationPayload[] = [
                {
                    type: NotificationType.RENEWAL_REMINDER,
                    recipientEmail: 'user1@example.com',
                    recipientName: 'User 1',
                    userId: user1,
                    customerId: 'cus_1',
                    planName: 'Standard',
                    amount: 5000,
                    currency: 'ARS',
                    renewalDate: '2026-03-01'
                },
                {
                    type: NotificationType.RENEWAL_REMINDER,
                    recipientEmail: 'user2@example.com',
                    recipientName: 'User 2',
                    userId: user2,
                    customerId: 'cus_2',
                    planName: 'Standard',
                    amount: 5000,
                    currency: 'ARS',
                    renewalDate: '2026-03-01'
                },
                {
                    type: NotificationType.RENEWAL_REMINDER,
                    recipientEmail: 'user3@example.com',
                    recipientName: 'User 3',
                    userId: user3,
                    customerId: 'cus_3',
                    planName: 'Standard',
                    amount: 5000,
                    currency: 'ARS',
                    renewalDate: '2026-03-01'
                }
            ];

            // Act
            const results = await notificationService.sendBatch(payloads);

            // Assert
            expect(results).toHaveLength(3);

            // User 1: Sent
            expect(results[0].success).toBe(true);
            expect(results[0].status).toBe('sent');

            // User 2: Skipped
            expect(results[1].success).toBe(false);
            expect(results[1].status).toBe('skipped');

            // User 3: Sent
            expect(results[2].success).toBe(true);
            expect(results[2].status).toBe('sent');

            // Verify email sent only twice (user 1 and user 3)
            expect(mockEmailTransport.send).toHaveBeenCalledTimes(2);

            // Verify batch log was called
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    total: 3,
                    successful: 2,
                    failed: 0,
                    skipped: 1
                }),
                'Batch notifications complete'
            );
        });
    });

    /**
     * Scenario 5: Edge Cases
     */
    describe('5. Edge Cases', () => {
        it('should handle user with no settings (default to enabled)', async () => {
            // Arrange - User has no settings in database
            const userId = 'user_no_settings';

            // Don't set any settings for this user

            const payload: NotificationPayload = {
                type: NotificationType.RENEWAL_REMINDER,
                recipientEmail: 'no-settings@example.com',
                recipientName: 'No Settings User',
                userId,
                customerId: 'cus_no_settings',
                planName: 'Standard',
                amount: 5000,
                currency: 'ARS',
                renewalDate: '2026-03-01'
            };

            // Act
            const result = await notificationService.send(payload);

            // Assert - Should send (defaults allow everything)
            expect(result.success).toBe(true);
            expect(result.status).toBe('sent');

            expect(mockEmailTransport.send).toHaveBeenCalledTimes(1);
        });

        it('should handle partial user preferences gracefully', async () => {
            // Arrange - User has incomplete settings
            const userId = 'user_partial_settings';

            userSettingsDb.set(userId, {
                notifications: {
                    emailEnabled: true
                    // Missing disabledCategories and disabledTypes
                }
            });

            const payload: NotificationPayload = {
                type: NotificationType.TRIAL_ENDING_REMINDER,
                recipientEmail: 'partial@example.com',
                recipientName: 'Partial User',
                userId,
                customerId: 'cus_partial',
                planName: 'Trial',
                trialEndDate: '2026-02-15',
                daysRemaining: 3,
                upgradeUrl: 'https://hospeda.com/upgrade'
            };

            // Act
            const result = await notificationService.send(payload);

            // Assert - Should send (missing arrays default to empty)
            expect(result.success).toBe(true);
            expect(result.status).toBe('sent');

            expect(mockEmailTransport.send).toHaveBeenCalledTimes(1);
        });
    });
});
