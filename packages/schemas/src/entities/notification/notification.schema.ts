import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { NotificationIdSchema } from '../../common/id.schema.js';
import {
    NotificationChannelEnum,
    NotificationRecipientTypeEnum,
    NotificationStatusEnum,
    NotificationTypeEnum
} from '../../enums/index.js';

/**
 * Notification Schema
 * Core schema for system notifications across all channels
 */
export const NotificationSchema = z
    .object({
        // Base fields
        id: NotificationIdSchema,
        ...BaseAuditFields,

        // Notification identification
        type: z.nativeEnum(NotificationTypeEnum, {
            message: 'zodError.enums.notificationType.invalid'
        }),

        status: z.nativeEnum(NotificationStatusEnum, {
            message: 'zodError.enums.notificationStatus.invalid'
        }),

        channel: z.nativeEnum(NotificationChannelEnum, {
            message: 'zodError.enums.notificationChannel.invalid'
        }),

        // Recipient information (polymorphic)
        recipientType: z.nativeEnum(NotificationRecipientTypeEnum, {
            message: 'zodError.enums.notificationRecipientType.invalid'
        }),

        recipientId: z
            .string({
                message: 'zodError.notification.recipientId.required'
            })
            .uuid({ message: 'zodError.notification.recipientId.invalidFormat' }),

        // Notification content
        title: z
            .string({
                message: 'zodError.notification.title.required'
            })
            .min(1, { message: 'zodError.notification.title.min' })
            .max(200, { message: 'zodError.notification.title.max' }),

        message: z
            .string({
                message: 'zodError.notification.message.required'
            })
            .min(1, { message: 'zodError.notification.message.min' })
            .max(2000, { message: 'zodError.notification.message.max' }),

        // Optional rich content
        data: z.record(z.string(), z.unknown()).optional(),

        // Delivery tracking
        sentAt: z.date().optional(),
        deliveredAt: z.date().optional(),
        readAt: z.date().optional(),
        failedAt: z.date().optional(),

        // Failure information
        failureReason: z
            .string()
            .max(500, { message: 'zodError.notification.failureReason.max' })
            .optional(),

        // Priority and scheduling
        priority: z
            .number()
            .int({ message: 'zodError.notification.priority.int' })
            .min(1, { message: 'zodError.notification.priority.min' })
            .max(10, { message: 'zodError.notification.priority.max' })
            .default(5),

        scheduledFor: z.date().optional(),

        // Channel-specific metadata
        channelMetadata: z.record(z.string(), z.unknown()).optional(),

        // External tracking (for email providers, SMS services, etc.)
        externalTrackingId: z
            .string()
            .max(255, { message: 'zodError.notification.externalTrackingId.max' })
            .optional()
    })
    // Validation refinements
    .refine(
        (data: {
            status: NotificationStatusEnum;
            sentAt?: Date;
            deliveredAt?: Date;
            readAt?: Date;
            failedAt?: Date;
            failureReason?: string;
        }) => {
            // If status is SENT, sentAt must be present
            if (data.status === NotificationStatusEnum.SENT && !data.sentAt) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.notification.sentAt.requiredWhenSent',
            path: ['sentAt']
        }
    )
    .refine(
        (data: {
            status: NotificationStatusEnum;
            sentAt?: Date;
            deliveredAt?: Date;
            readAt?: Date;
            failedAt?: Date;
            failureReason?: string;
        }) => {
            // If status is DELIVERED, deliveredAt must be present
            if (data.status === NotificationStatusEnum.DELIVERED && !data.deliveredAt) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.notification.deliveredAt.requiredWhenDelivered',
            path: ['deliveredAt']
        }
    )
    .refine(
        (data: {
            status: NotificationStatusEnum;
            sentAt?: Date;
            deliveredAt?: Date;
            readAt?: Date;
            failedAt?: Date;
            failureReason?: string;
        }) => {
            // If status is FAILED, failedAt and failureReason must be present
            if (
                data.status === NotificationStatusEnum.FAILED &&
                (!data.failedAt || !data.failureReason)
            ) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.notification.failureInfo.requiredWhenFailed',
            path: ['failedAt']
        }
    )
    .refine(
        (data: {
            status: NotificationStatusEnum;
            sentAt?: Date;
            deliveredAt?: Date;
            readAt?: Date;
            failedAt?: Date;
            failureReason?: string;
        }) => {
            // If status is READ, readAt must be present
            if (data.status === NotificationStatusEnum.READ && !data.readAt) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.notification.readAt.requiredWhenRead',
            path: ['readAt']
        }
    )
    .refine(
        (data: {
            status: NotificationStatusEnum;
            sentAt?: Date;
            deliveredAt?: Date;
            readAt?: Date;
            failedAt?: Date;
            failureReason?: string;
        }) => {
            // Delivery sequence validation: sentAt <= deliveredAt <= readAt
            if (data.sentAt && data.deliveredAt && data.sentAt > data.deliveredAt) {
                return false;
            }
            if (data.deliveredAt && data.readAt && data.deliveredAt > data.readAt) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.notification.timestamps.invalidSequence',
            path: ['deliveredAt']
        }
    );
export type Notification = z.infer<typeof NotificationSchema>;
