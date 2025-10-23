import { z } from 'zod';

import { NotificationChannelEnum } from './notification-channel.enum.js';

export const NotificationChannelSchema = z
    .nativeEnum(NotificationChannelEnum, {
        message: 'zodError.enums.notificationChannel.invalid'
    })
    .describe('Notification channel validation schema');
