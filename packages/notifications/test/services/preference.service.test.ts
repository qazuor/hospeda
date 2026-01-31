/**
 * PreferenceService Test Suite
 *
 * Comprehensive tests for notification preference service including:
 * - Getting preferences with defaults for new users
 * - Updating preferences correctly
 * - Checking if notifications should be sent
 * - Category-based preference handling (TRANSACTIONAL, REMINDER, ADMIN)
 * - Handling missing/null user settings gracefully
 *
 * @module test/services/preference.service.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    PreferenceService,
    type PreferenceServiceDeps
} from '../../src/services/preference.service';
import { NotificationCategory, NotificationType } from '../../src/types/notification.types';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../../src/types/preferences.types';

describe('PreferenceService', () => {
    let service: PreferenceService;
    let mockDeps: PreferenceServiceDeps;

    const mockUserId = 'user_123';

    beforeEach(() => {
        // Create mock dependencies
        mockDeps = {
            getUserSettings: vi.fn(),
            updateUserSettings: vi.fn()
        };

        // Create service instance
        service = new PreferenceService(mockDeps);
    });

    describe('getPreferences', () => {
        it('should return defaults for new user (all enabled)', async () => {
            // Arrange
            mockDeps.getUserSettings = vi.fn().mockResolvedValue(null);

            // Act
            const result = await service.getPreferences(mockUserId);

            // Assert
            expect(result).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
            expect(result.emailEnabled).toBe(true);
            expect(result.disabledCategories).toEqual([]);
            expect(result.disabledTypes).toEqual([]);
            expect(mockDeps.getUserSettings).toHaveBeenCalledWith(mockUserId);
        });

        it('should return defaults when settings exist but notifications is undefined', async () => {
            // Arrange
            mockDeps.getUserSettings = vi.fn().mockResolvedValue({
                theme: 'dark',
                language: 'es'
                // No notifications key
            });

            // Act
            const result = await service.getPreferences(mockUserId);

            // Assert
            expect(result).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
        });

        it('should return user preferences when they exist', async () => {
            // Arrange
            const userPrefs = {
                emailEnabled: false,
                disabledCategories: [NotificationCategory.REMINDER],
                disabledTypes: [NotificationType.RENEWAL_REMINDER]
            };

            mockDeps.getUserSettings = vi.fn().mockResolvedValue({
                notifications: userPrefs
            });

            // Act
            const result = await service.getPreferences(mockUserId);

            // Assert
            expect(result).toEqual(userPrefs);
            expect(result.emailEnabled).toBe(false);
            expect(result.disabledCategories).toContain(NotificationCategory.REMINDER);
            expect(result.disabledTypes).toContain(NotificationType.RENEWAL_REMINDER);
        });

        it('should merge partial preferences with defaults', async () => {
            // Arrange - Only emailEnabled is set
            mockDeps.getUserSettings = vi.fn().mockResolvedValue({
                notifications: {
                    emailEnabled: false
                    // Missing disabledCategories and disabledTypes
                }
            });

            // Act
            const result = await service.getPreferences(mockUserId);

            // Assert
            expect(result.emailEnabled).toBe(false);
            expect(result.disabledCategories).toEqual(
                DEFAULT_NOTIFICATION_PREFERENCES.disabledCategories
            );
            expect(result.disabledTypes).toEqual(DEFAULT_NOTIFICATION_PREFERENCES.disabledTypes);
        });

        it('should handle null settings gracefully', async () => {
            // Arrange
            mockDeps.getUserSettings = vi.fn().mockResolvedValue(null);

            // Act
            const result = await service.getPreferences(mockUserId);

            // Assert
            expect(result).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
        });
    });

    describe('updatePreferences', () => {
        it('should update preferences correctly', async () => {
            // Arrange
            const existingSettings = {
                theme: 'dark',
                notifications: DEFAULT_NOTIFICATION_PREFERENCES
            };

            mockDeps.getUserSettings = vi.fn().mockResolvedValue(existingSettings);
            mockDeps.updateUserSettings = vi.fn().mockResolvedValue(undefined);

            const newPrefs = {
                emailEnabled: false,
                disabledCategories: [NotificationCategory.REMINDER]
            };

            // Act
            await service.updatePreferences(mockUserId, newPrefs);

            // Assert
            expect(mockDeps.updateUserSettings).toHaveBeenCalledWith(mockUserId, {
                theme: 'dark',
                notifications: {
                    emailEnabled: false,
                    disabledCategories: [NotificationCategory.REMINDER],
                    disabledTypes: DEFAULT_NOTIFICATION_PREFERENCES.disabledTypes
                }
            });
        });

        it('should merge partial updates with existing preferences', async () => {
            // Arrange
            const existingPrefs = {
                emailEnabled: true,
                disabledCategories: [NotificationCategory.REMINDER],
                disabledTypes: [NotificationType.RENEWAL_REMINDER]
            };

            mockDeps.getUserSettings = vi.fn().mockResolvedValue({
                notifications: existingPrefs
            });
            mockDeps.updateUserSettings = vi.fn().mockResolvedValue(undefined);

            // Update only emailEnabled
            const updates = { emailEnabled: false };

            // Act
            await service.updatePreferences(mockUserId, updates);

            // Assert
            expect(mockDeps.updateUserSettings).toHaveBeenCalledWith(mockUserId, {
                notifications: {
                    emailEnabled: false,
                    disabledCategories: existingPrefs.disabledCategories,
                    disabledTypes: existingPrefs.disabledTypes
                }
            });
        });

        it('should preserve other settings when updating preferences', async () => {
            // Arrange
            const existingSettings = {
                theme: 'dark',
                language: 'es',
                notifications: DEFAULT_NOTIFICATION_PREFERENCES
            };

            mockDeps.getUserSettings = vi.fn().mockResolvedValue(existingSettings);
            mockDeps.updateUserSettings = vi.fn().mockResolvedValue(undefined);

            const updates = { emailEnabled: false };

            // Act
            await service.updatePreferences(mockUserId, updates);

            // Assert
            const call = vi.mocked(mockDeps.updateUserSettings).mock.calls[0];
            expect(call[1]).toHaveProperty('theme', 'dark');
            expect(call[1]).toHaveProperty('language', 'es');
            expect(call[1]).toHaveProperty('notifications');
        });

        it('should handle updates for users with no existing settings', async () => {
            // Arrange
            mockDeps.getUserSettings = vi.fn().mockResolvedValue(null);
            mockDeps.updateUserSettings = vi.fn().mockResolvedValue(undefined);

            const newPrefs = {
                emailEnabled: false,
                disabledCategories: [NotificationCategory.REMINDER]
            };

            // Act
            await service.updatePreferences(mockUserId, newPrefs);

            // Assert
            expect(mockDeps.updateUserSettings).toHaveBeenCalledWith(mockUserId, {
                notifications: {
                    emailEnabled: false,
                    disabledCategories: [NotificationCategory.REMINDER],
                    disabledTypes: DEFAULT_NOTIFICATION_PREFERENCES.disabledTypes
                }
            });
        });
    });

    describe('shouldSendNotification', () => {
        it('should always return true for TRANSACTIONAL category', async () => {
            // Arrange
            mockDeps.getUserSettings = vi.fn().mockResolvedValue({
                notifications: {
                    emailEnabled: false,
                    disabledCategories: [NotificationCategory.TRANSACTIONAL],
                    disabledTypes: [NotificationType.SUBSCRIPTION_PURCHASE]
                }
            });

            // Act
            const result = await service.shouldSendNotification(
                mockUserId,
                NotificationType.SUBSCRIPTION_PURCHASE
            );

            // Assert
            expect(result).toBe(true); // TRANSACTIONAL always sends
        });

        it('should check user prefs for REMINDER category', async () => {
            // Arrange
            mockDeps.getUserSettings = vi.fn().mockResolvedValue({
                notifications: {
                    emailEnabled: true,
                    disabledCategories: [],
                    disabledTypes: [NotificationType.RENEWAL_REMINDER]
                }
            });

            // Act
            const result = await service.shouldSendNotification(
                mockUserId,
                NotificationType.RENEWAL_REMINDER
            );

            // Assert
            expect(result).toBe(false); // User disabled this specific type
        });

        it('should always return true for ADMIN category', async () => {
            // Arrange
            mockDeps.getUserSettings = vi.fn().mockResolvedValue({
                notifications: {
                    emailEnabled: false,
                    disabledCategories: [NotificationCategory.ADMIN],
                    disabledTypes: [NotificationType.ADMIN_PAYMENT_FAILURE]
                }
            });

            // Act
            const result = await service.shouldSendNotification(
                mockUserId,
                NotificationType.ADMIN_PAYMENT_FAILURE
            );

            // Assert
            expect(result).toBe(true); // ADMIN always sends
        });

        it('should return false if emailEnabled is false for REMINDER', async () => {
            // Arrange
            mockDeps.getUserSettings = vi.fn().mockResolvedValue({
                notifications: {
                    emailEnabled: false,
                    disabledCategories: [],
                    disabledTypes: []
                }
            });

            // Act
            const result = await service.shouldSendNotification(
                mockUserId,
                NotificationType.RENEWAL_REMINDER
            );

            // Assert
            expect(result).toBe(false);
        });

        it('should return false if category is disabled', async () => {
            // Arrange
            mockDeps.getUserSettings = vi.fn().mockResolvedValue({
                notifications: {
                    emailEnabled: true,
                    disabledCategories: [NotificationCategory.REMINDER],
                    disabledTypes: []
                }
            });

            // Act
            const result = await service.shouldSendNotification(
                mockUserId,
                NotificationType.TRIAL_ENDING_REMINDER
            );

            // Assert
            expect(result).toBe(false);
        });

        it('should return false if specific type is disabled', async () => {
            // Arrange
            mockDeps.getUserSettings = vi.fn().mockResolvedValue({
                notifications: {
                    emailEnabled: true,
                    disabledCategories: [],
                    disabledTypes: [NotificationType.ADDON_EXPIRATION_WARNING]
                }
            });

            // Act
            const result = await service.shouldSendNotification(
                mockUserId,
                NotificationType.ADDON_EXPIRATION_WARNING
            );

            // Assert
            expect(result).toBe(false);
        });

        it('should return true if user has enabled everything for REMINDER', async () => {
            // Arrange
            mockDeps.getUserSettings = vi.fn().mockResolvedValue({
                notifications: {
                    emailEnabled: true,
                    disabledCategories: [],
                    disabledTypes: []
                }
            });

            // Act
            const result = await service.shouldSendNotification(
                mockUserId,
                NotificationType.RENEWAL_REMINDER
            );

            // Assert
            expect(result).toBe(true);
        });

        it('should return true for null userId (admin/system notifications)', async () => {
            // Arrange - No need to mock getUserSettings as it should not be called

            // Act
            const result = await service.shouldSendNotification(
                null,
                NotificationType.ADMIN_PAYMENT_FAILURE
            );

            // Assert
            expect(result).toBe(true);
            expect(mockDeps.getUserSettings).not.toHaveBeenCalled();
        });

        it('should handle missing user settings gracefully', async () => {
            // Arrange
            mockDeps.getUserSettings = vi.fn().mockResolvedValue(null);

            // Act
            const result = await service.shouldSendNotification(
                mockUserId,
                NotificationType.RENEWAL_REMINDER
            );

            // Assert
            expect(result).toBe(true); // Defaults allow all notifications
        });
    });
});
