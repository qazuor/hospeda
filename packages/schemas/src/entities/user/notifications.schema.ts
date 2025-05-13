import { z } from 'zod';

/**
 * Zod schema for user notifications.
 */
export const UserNotificationsSchema = z.object({
    enabled: z.boolean({
        required_error: 'error:user.notification.enabled.required',
        invalid_type_error: 'error:user.notification.enabled.invalid_type'
    }),
    allowEmails: z.boolean({
        required_error: 'error:user.notification.allowEmails.required',
        invalid_type_error: 'error:user.notification.allowEmails.invalid_type'
    }),
    allowSms: z.boolean({
        required_error: 'error:user.notification.allowSms.required',
        invalid_type_error: 'error:user.notification.allowSms.invalid_type'
    }),
    allowPush: z.boolean({
        required_error: 'error:user.notification.allowPush.required',
        invalid_type_error: 'error:user.notification.allowPush.invalid_type'
    })
});

export type UserNotificationsInput = z.infer<typeof UserNotificationsSchema>;
