import { z } from 'zod';

import { NotificationStatusEnum } from './notification-status.enum.js';

export const NotificationStatusSchema = z
    .nativeEnum(NotificationStatusEnum, {
        message: 'zodError.enums.notificationStatus.invalid'
    })
    .describe('Notification status validation schema');
