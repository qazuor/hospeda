import { z } from 'zod';
import { NotificationRecipientSideEnum } from './notification-recipient-side.enum.js';

/**
 * Notification recipient side enum schema for validation
 */
export const NotificationRecipientSideEnumSchema = z.nativeEnum(NotificationRecipientSideEnum, {
    message: 'zodError.enums.notificationRecipientSide.invalid'
});
export type NotificationRecipientSideSchema = z.infer<typeof NotificationRecipientSideEnumSchema>;
