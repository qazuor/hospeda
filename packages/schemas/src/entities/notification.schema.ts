import { z } from 'zod';
import {
    NotificationChannelEnumSchema,
    NotificationStateEnumSchema,
    NotificationTypeEnumSchema,
    RoleTypeEnumSchema
} from '../enums.schema';

/**
 * Targeting options for sending notifications.
 * Supports: all users, specific roles, or a single user.
 */
export const NotificationTargetSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('all')
    }),

    z.object({
        type: z.literal('roles'),
        roles: z.array(RoleTypeEnumSchema).min(1, {
            message: 'error:notification.rolesRequired'
        })
    }),

    z.object({
        type: z.literal('user'),
        userId: z.string().uuid({
            message: 'error:notification.userIdInvalid'
        })
    })
]);

/**
 * Full schema for creating or managing a notification.
 */
export const NotificationSchema = z.object({
    /**
     * Notification category (e.g. SYSTEM, REMINDER).
     */
    type: NotificationTypeEnumSchema,

    /**
     * Title shown to the user.
     */
    title: z.string().min(1, {
        message: 'error:notification.titleRequired'
    }),

    /**
     * Plain message content.
     */
    message: z.string().min(1, {
        message: 'error:notification.messageRequired'
    }),

    /**
     * Optional rich HTML version of the message.
     */
    htmlMessage: z.string().optional(),

    /**
     * List of delivery channels to use (e.g. PUSH, EMAIL).
     */
    channels: z.array(NotificationChannelEnumSchema).min(1, {
        message: 'error:notification.channelsRequired'
    }),

    /**
     * Target audience configuration.
     */
    target: NotificationTargetSchema,

    /**
     * Scheduled send time (optional).
     */
    scheduledAt: z.date().optional(),

    /**
     * Date when notification was actually sent.
     */
    sentAt: z.date().optional(),

    /**
     * Current delivery state of the notification.
     */
    status: NotificationStateEnumSchema,

    /**
     * Optional extra data (e.g., related entity IDs).
     */
    metadata: z.record(z.unknown()).optional()
});
