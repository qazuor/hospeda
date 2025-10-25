import { z } from 'zod';
import { PaginationSchema, SortingSchema } from '../../common/pagination.schema.js';
import {
    NotificationChannelEnum,
    NotificationRecipientTypeEnum,
    NotificationStatusEnum,
    NotificationTypeEnum
} from '../../enums/index.js';

/**
 * Search Notifications Schema
 * Schema for notification queries with comprehensive filtering
 */
export const SearchNotificationsSchema = z
    .object({
        // Pagination and sorting
        ...PaginationSchema.shape,
        ...SortingSchema.shape,

        // Text search
        q: z
            .string()
            .min(1, { message: 'zodError.common.search.min' })
            .max(100, { message: 'zodError.common.search.max' })
            .optional(),

        // Type filter
        type: z.nativeEnum(NotificationTypeEnum).optional(),

        // Status filter
        status: z.nativeEnum(NotificationStatusEnum).optional(),

        // Channel filter
        channel: z.nativeEnum(NotificationChannelEnum).optional(),

        // Recipient filters
        recipientType: z.nativeEnum(NotificationRecipientTypeEnum).optional(),

        recipientId: z
            .string()
            .uuid({ message: 'zodError.notification.recipientId.invalidFormat' })
            .optional(),

        // Priority filters
        priorityMin: z
            .number()
            .int()
            .min(1, { message: 'zodError.notification.priority.min' })
            .max(10, { message: 'zodError.notification.priority.max' })
            .optional(),

        priorityMax: z
            .number()
            .int()
            .min(1, { message: 'zodError.notification.priority.min' })
            .max(10, { message: 'zodError.notification.priority.max' })
            .optional(),

        // Date range filters
        createdAfter: z.date().optional(),
        createdBefore: z.date().optional(),
        sentAfter: z.date().optional(),
        sentBefore: z.date().optional(),
        scheduledAfter: z.date().optional(),
        scheduledBefore: z.date().optional(),

        // Status-specific filters
        isScheduled: z.boolean().optional(),
        isFailed: z.boolean().optional(),
        isRead: z.boolean().optional(),
        isPending: z.boolean().optional(),

        // Delivery tracking
        hasExternalTracking: z.boolean().optional(),

        // Bulk operation filters
        bulkOperationId: z.string().uuid().optional()
    })
    // Date range validation
    .refine(
        (data: {
            priorityMin?: number;
            priorityMax?: number;
        }) => {
            if (data.priorityMin && data.priorityMax && data.priorityMin > data.priorityMax) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.notification.priority.invalidRange',
            path: ['priorityMax']
        }
    )
    .refine(
        (data: {
            createdAfter?: Date;
            createdBefore?: Date;
        }) => {
            if (data.createdAfter && data.createdBefore && data.createdAfter > data.createdBefore) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.notification.createdDate.invalidRange',
            path: ['createdBefore']
        }
    )
    .refine(
        (data: {
            sentAfter?: Date;
            sentBefore?: Date;
        }) => {
            if (data.sentAfter && data.sentBefore && data.sentAfter > data.sentBefore) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.notification.sentDate.invalidRange',
            path: ['sentBefore']
        }
    )
    .refine(
        (data: {
            scheduledAfter?: Date;
            scheduledBefore?: Date;
        }) => {
            if (
                data.scheduledAfter &&
                data.scheduledBefore &&
                data.scheduledAfter > data.scheduledBefore
            ) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.notification.scheduledDate.invalidRange',
            path: ['scheduledBefore']
        }
    );

/**
 * Notification Analytics Query Schema
 * Schema for notification analytics and reporting
 */
export const NotificationAnalyticsSchema = z
    .object({
        // Time period for analytics
        fromDate: z.date(),
        toDate: z.date(),

        // Grouping options
        groupBy: z
            .enum(['type', 'channel', 'status', 'recipient_type', 'day', 'week', 'month'])
            .array()
            .default([]),

        // Filter options
        channels: z.nativeEnum(NotificationChannelEnum).array().optional(),

        types: z.nativeEnum(NotificationTypeEnum).array().optional(),

        recipientTypes: z.nativeEnum(NotificationRecipientTypeEnum).array().optional(),

        // Metrics to include
        includeDeliveryRates: z.boolean().default(true),
        includeReadRates: z.boolean().default(true),
        includeFailureAnalysis: z.boolean().default(true),
        includePerformanceMetrics: z.boolean().default(false)
    })
    .refine(
        (data: {
            fromDate: Date;
            toDate: Date;
        }) => {
            return data.fromDate < data.toDate;
        },
        {
            message: 'zodError.notification.analytics.invalidDateRange',
            path: ['toDate']
        }
    );

/**
 * Bulk Notification Operations Schema
 * Schema for bulk notification actions
 */
export const BulkNotificationOperationSchema = z.object({
    // Operation type
    operation: z.enum(['mark_as_read', 'mark_as_sent', 'delete', 'retry_failed']),

    // Target notifications
    notificationIds: z
        .string()
        .uuid()
        .array()
        .min(1, { message: 'zodError.notification.bulk.minSelections' })
        .max(1000, { message: 'zodError.notification.bulk.maxSelections' }),

    // Operation metadata
    reason: z.string().max(500).optional(),

    // Performer
    performedById: z.string().uuid()
});

export type SearchNotifications = z.infer<typeof SearchNotificationsSchema>;
export type NotificationAnalytics = z.infer<typeof NotificationAnalyticsSchema>;
export type BulkNotificationOperation = z.infer<typeof BulkNotificationOperationSchema>;
