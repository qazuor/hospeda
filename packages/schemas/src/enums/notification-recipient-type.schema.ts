import { z } from 'zod';

import { NotificationRecipientTypeEnum } from './notification-recipient-type.enum.js';

export const NotificationRecipientTypeSchema = z
    .nativeEnum(NotificationRecipientTypeEnum, {
        message: 'zodError.enums.notificationRecipientType.invalid'
    })
    .describe('Notification recipient type validation schema');
