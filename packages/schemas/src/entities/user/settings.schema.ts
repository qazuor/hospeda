import { z } from 'zod';
import { UserNotificationsSchema } from './notifications.schema';

/**
 * Zod schema for user settings.
 */
export const UserSettingsSchema = z.object({
    darkMode: z
        .boolean({
            required_error: 'error:user.settings.darkmode.required',
            invalid_type_error: 'error:user.settings.darkmode.invalid'
        })
        .optional(),
    language: z
        .string()
        .min(2, 'error:user.settings.language.min_lenght')
        .max(2, 'error:user.settings.language.max_lenght')
        .optional(),
    notifications: UserNotificationsSchema
});

export type UserSettingsInput = z.infer<typeof UserSettingsSchema>;
