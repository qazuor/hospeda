import { z } from 'zod';

/**
 * User Settings schema definition using Zod for validation.
 * Represents the settings and preferences for a user.
 */

export const UserNotificationsSchema = z.object({
    enabled: z.boolean({ message: 'zodError.user.settings.notifications.enabled.required' }),
    allowEmails: z.boolean({
        message: 'zodError.user.settings.notifications.allowEmails.required'
    }),
    allowSms: z.boolean({
        message: 'zodError.user.settings.notifications.allowSms.required'
    }),
    allowPush: z.boolean({
        message: 'zodError.user.settings.notifications.allowPush.required'
    })
});

export const UserSettingsSchema = z.object({
    darkMode: z.boolean().optional(),
    language: z
        .string()
        .min(2, { message: 'zodError.user.settings.language.min' })
        .max(10, { message: 'zodError.user.settings.language.max' })
        .optional(),
    notifications: UserNotificationsSchema
});

/**
 * Type exports for User Settings
 */
export type UserNotifications = z.infer<typeof UserNotificationsSchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;
