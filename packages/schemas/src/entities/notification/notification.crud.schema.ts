import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import {
    NotificationChannelEnum,
    NotificationRecipientTypeEnum,
    NotificationStatusEnum,
    NotificationTypeEnum
} from '../../enums/index.js';

/**
 * Create Notification Schema
 * Schema for creating new notifications with channel validation
 */
export const CreateNotificationSchema = z
    .object({
        // Audit fields for creation
        createdById: UserIdSchema,

        // Notification identification
        type: z.nativeEnum(NotificationTypeEnum, {
            message: 'zodError.enums.notificationType.invalid'
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

        // Optional fields
        data: z.record(z.string(), z.unknown()).optional(),

        priority: z
            .number()
            .int({ message: 'zodError.notification.priority.int' })
            .min(1, { message: 'zodError.notification.priority.min' })
            .max(10, { message: 'zodError.notification.priority.max' })
            .default(5),

        scheduledFor: z.date().optional(),

        channelMetadata: z.record(z.string(), z.unknown()).optional(),

        // Status defaults to PENDING on creation
        status: z.nativeEnum(NotificationStatusEnum).default(NotificationStatusEnum.PENDING)
    })
    // Channel-specific validation
    .refine(
        (data: {
            channel: NotificationChannelEnum;
            channelMetadata?: Record<string, unknown>;
        }) => {
            // Email channel validation
            if (data.channel === NotificationChannelEnum.EMAIL) {
                if (!data.channelMetadata?.emailTemplate && !data.channelMetadata?.from) {
                    return false;
                }
            }
            return true;
        },
        {
            message: 'zodError.notification.channel.emailMetadataRequired',
            path: ['channelMetadata']
        }
    )
    .refine(
        (data: {
            channel: NotificationChannelEnum;
            channelMetadata?: Record<string, unknown>;
        }) => {
            // SMS channel validation
            if (data.channel === NotificationChannelEnum.SMS) {
                if (!data.channelMetadata?.phoneNumber) {
                    return false;
                }
            }
            return true;
        },
        {
            message: 'zodError.notification.channel.smsMetadataRequired',
            path: ['channelMetadata']
        }
    )
    .refine(
        (data: {
            scheduledFor?: Date;
        }) => {
            // Scheduled notifications must be in the future
            if (data.scheduledFor && data.scheduledFor <= new Date()) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.notification.scheduledFor.futureDate',
            path: ['scheduledFor']
        }
    );

/**
 * Update Notification Schema
 * Schema for updating existing notifications (primarily status changes)
 */
export const UpdateNotificationSchema = z
    .object({
        // Audit fields for updates
        updatedById: UserIdSchema,

        // Status updates
        status: z.nativeEnum(NotificationStatusEnum).optional(),

        // Tracking timestamps
        sentAt: z.date().optional(),
        deliveredAt: z.date().optional(),
        readAt: z.date().optional(),
        failedAt: z.date().optional(),

        // Failure information
        failureReason: z
            .string()
            .max(500, { message: 'zodError.notification.failureReason.max' })
            .optional(),

        // External tracking updates
        externalTrackingId: z
            .string()
            .max(255, { message: 'zodError.notification.externalTrackingId.max' })
            .optional(),

        // Channel metadata updates
        channelMetadata: z.record(z.string(), z.unknown()).optional()
    })
    // Status transition validation
    .refine(
        (data: {
            status?: NotificationStatusEnum;
            sentAt?: Date;
            deliveredAt?: Date;
            readAt?: Date;
            failedAt?: Date;
            failureReason?: string;
        }) => {
            // If updating to SENT, sentAt must be provided
            if (data.status === NotificationStatusEnum.SENT && !data.sentAt) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.notification.sentAt.requiredForSentStatus',
            path: ['sentAt']
        }
    )
    .refine(
        (data: {
            status?: NotificationStatusEnum;
            sentAt?: Date;
            deliveredAt?: Date;
            readAt?: Date;
            failedAt?: Date;
            failureReason?: string;
        }) => {
            // If updating to DELIVERED, deliveredAt must be provided
            if (data.status === NotificationStatusEnum.DELIVERED && !data.deliveredAt) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.notification.deliveredAt.requiredForDeliveredStatus',
            path: ['deliveredAt']
        }
    )
    .refine(
        (data: {
            status?: NotificationStatusEnum;
            sentAt?: Date;
            deliveredAt?: Date;
            readAt?: Date;
            failedAt?: Date;
            failureReason?: string;
        }) => {
            // If updating to FAILED, failedAt and failureReason must be provided
            if (
                data.status === NotificationStatusEnum.FAILED &&
                (!data.failedAt || !data.failureReason)
            ) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.notification.failureInfo.requiredForFailedStatus',
            path: ['failedAt']
        }
    )
    .refine(
        (data: {
            status?: NotificationStatusEnum;
            sentAt?: Date;
            deliveredAt?: Date;
            readAt?: Date;
            failedAt?: Date;
            failureReason?: string;
        }) => {
            // If updating to READ, readAt must be provided
            if (data.status === NotificationStatusEnum.READ && !data.readAt) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.notification.readAt.requiredForReadStatus',
            path: ['readAt']
        }
    );

export type CreateNotification = z.infer<typeof CreateNotificationSchema>;
export type UpdateNotification = z.infer<typeof UpdateNotificationSchema>;
