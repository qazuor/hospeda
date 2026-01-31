import { NOTIFICATION_CATEGORY_MAP } from '../config/notification-categories.js';
import { NotificationCategory, type NotificationType } from '../types/notification.types.js';
import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    type NotificationPreferences
} from '../types/preferences.types.js';

/**
 * Dependencies for PreferenceService
 */
export interface PreferenceServiceDeps {
    /** Function to get user preferences from DB */
    getUserSettings: (userId: string) => Promise<Record<string, unknown> | null>;
    /** Function to update user settings in DB */
    updateUserSettings: (userId: string, settings: Record<string, unknown>) => Promise<void>;
}

/**
 * PreferenceService
 * Manages user notification preferences for opt-in/opt-out per category/type
 */
export class PreferenceService {
    constructor(private deps: PreferenceServiceDeps) {}

    /**
     * Get notification preferences for a user
     *
     * @param userId - User ID to get preferences for
     * @returns User's notification preferences or defaults if not found
     */
    async getPreferences(userId: string): Promise<NotificationPreferences> {
        const settings = await this.deps.getUserSettings(userId);

        if (!settings || !settings.notifications) {
            return DEFAULT_NOTIFICATION_PREFERENCES;
        }

        const prefs = settings.notifications as NotificationPreferences;

        // Ensure all required fields exist with defaults
        return {
            emailEnabled: prefs.emailEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.emailEnabled,
            disabledCategories:
                prefs.disabledCategories ?? DEFAULT_NOTIFICATION_PREFERENCES.disabledCategories,
            disabledTypes: prefs.disabledTypes ?? DEFAULT_NOTIFICATION_PREFERENCES.disabledTypes
        };
    }

    /**
     * Update notification preferences for a user
     *
     * @param userId - User ID to update preferences for
     * @param preferences - Partial preferences to update (will merge with existing)
     */
    async updatePreferences(
        userId: string,
        preferences: Partial<NotificationPreferences>
    ): Promise<void> {
        const currentSettings = await this.deps.getUserSettings(userId);
        const currentPrefs = await this.getPreferences(userId);

        // Merge with existing preferences
        const updatedPrefs: NotificationPreferences = {
            emailEnabled:
                preferences.emailEnabled !== undefined
                    ? preferences.emailEnabled
                    : currentPrefs.emailEnabled,
            disabledCategories:
                preferences.disabledCategories !== undefined
                    ? preferences.disabledCategories
                    : currentPrefs.disabledCategories,
            disabledTypes:
                preferences.disabledTypes !== undefined
                    ? preferences.disabledTypes
                    : currentPrefs.disabledTypes
        };

        // Update settings in DB
        await this.deps.updateUserSettings(userId, {
            ...currentSettings,
            notifications: updatedPrefs
        });
    }

    /**
     * Check if a notification should be sent to a user
     *
     * @param userId - User ID to check (null for admin/system notifications)
     * @param notificationType - Type of notification to check
     * @returns True if notification should be sent, false if user has opted out
     */
    async shouldSendNotification(
        userId: string | null,
        notificationType: NotificationType
    ): Promise<boolean> {
        // If no userId, this is an admin or system notification - always send
        if (!userId) {
            return true;
        }

        // Get the category for this notification type
        const category = NOTIFICATION_CATEGORY_MAP[notificationType];

        // TRANSACTIONAL notifications always send (cannot be opted out)
        if (category === NotificationCategory.TRANSACTIONAL) {
            return true;
        }

        // ADMIN notifications always send (goes to admin list, not user)
        if (category === NotificationCategory.ADMIN) {
            return true;
        }

        // For REMINDER category, check user preferences
        const preferences = await this.getPreferences(userId);

        // Check if email is globally disabled
        if (!preferences.emailEnabled) {
            return false;
        }

        // Check if category is disabled
        if (preferences.disabledCategories.includes(category)) {
            return false;
        }

        // Check if specific type is disabled
        if (preferences.disabledTypes.includes(notificationType)) {
            return false;
        }

        return true;
    }
}
