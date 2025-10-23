import { z } from 'zod';
import { NotificationTypeEnum } from './notification-type.enum';

export const NotificationTypeSchema = z.nativeEnum(NotificationTypeEnum, {
    message: 'zodError.enums.notificationType.invalid'
});
