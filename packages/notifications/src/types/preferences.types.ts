import type { NotificationCategory, NotificationType } from './notification.types.js';

/** User notification preferences stored in user.settings JSONB */
export interface NotificationPreferences {
    emailEnabled: boolean;
    disabledCategories: NotificationCategory[];
    disabledTypes: NotificationType[];
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    emailEnabled: true,
    disabledCategories: [],
    disabledTypes: []
};
