import { z } from 'zod';
import { HttpFieldFactories } from '../../utils/http-field.factory.js';
import { CreateNotificationSchema, UpdateNotificationSchema } from './notification.crud.schema.js';
import {
    NotificationAnalyticsSchema,
    SearchNotificationsSchema
} from './notification.query.schema.js';

/**
 * HTTP Create Notification Schema
 * Coerces HTTP string inputs to appropriate types for notification creation
 */
export const HttpCreateNotificationSchema = CreateNotificationSchema.extend({
    // Coerce string dates to Date objects
    scheduledFor: HttpFieldFactories.dateField('scheduledFor'),

    // Coerce string numbers to numbers
    priority: z.coerce.number().int().min(1).max(5).optional(),

    // Channel metadata as JSON string
    channelMetadata: z
        .string()
        .transform((str, ctx) => {
            try {
                return JSON.parse(str);
            } catch {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'zodError.notification.channelMetadata.invalidJson'
                });
                return z.NEVER;
            }
        })
        .optional(),

    // Data as JSON string
    data: z
        .string()
        .transform((str, ctx) => {
            try {
                return JSON.parse(str);
            } catch {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'zodError.notification.data.invalidJson'
                });
                return z.NEVER;
            }
        })
        .optional()
});

/**
 * HTTP Update Notification Schema
 * Coerces HTTP string inputs to appropriate types for notification updates
 */
export const HttpUpdateNotificationSchema = UpdateNotificationSchema.extend({
    // Coerce string dates to Date objects
    sentAt: HttpFieldFactories.dateField('sentAt'),
    deliveredAt: HttpFieldFactories.dateField('deliveredAt'),
    readAt: HttpFieldFactories.dateField('readAt'),
    failedAt: HttpFieldFactories.dateField('failedAt'),

    // Channel metadata as JSON string
    channelMetadata: z
        .string()
        .transform((str, ctx) => {
            try {
                return JSON.parse(str);
            } catch {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'zodError.notification.channelMetadata.invalidJson'
                });
                return z.NEVER;
            }
        })
        .optional()
});

/**
 * HTTP List Notifications Schema
 * Coerces HTTP query parameters for notification listing
 */
export const HttpListNotificationsSchema = SearchNotificationsSchema.extend({
    // Coerce pagination parameters
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),

    // Coerce priority range
    priorityMin: z.coerce.number().int().min(1).max(5).optional(),
    priorityMax: z.coerce.number().int().min(1).max(5).optional(),

    // Coerce date filters
    createdAfter: HttpFieldFactories.dateField('createdAfter'),
    createdBefore: HttpFieldFactories.dateField('createdBefore'),
    sentAfter: HttpFieldFactories.dateField('sentAfter'),
    sentBefore: HttpFieldFactories.dateField('sentBefore'),
    scheduledAfter: HttpFieldFactories.dateField('scheduledAfter'),
    scheduledBefore: HttpFieldFactories.dateField('scheduledBefore'),

    // Coerce boolean filters
    isScheduled: HttpFieldFactories.booleanField('isScheduled'),
    isFailed: HttpFieldFactories.booleanField('isFailed'),
    isRead: HttpFieldFactories.booleanField('isRead'),
    isPending: HttpFieldFactories.booleanField('isPending'),
    hasExternalTracking: HttpFieldFactories.booleanField('hasExternalTracking')
});

/**
 * HTTP Notification Analytics Schema
 * Coerces HTTP parameters for notification analytics
 */
export const HttpNotificationAnalyticsSchema = NotificationAnalyticsSchema.extend({
    // Coerce date range
    fromDate: z.coerce.date({ message: 'zodError.analytics.fromDate.invalidDate' }),
    toDate: z.coerce.date({ message: 'zodError.analytics.toDate.invalidDate' }),

    // Parse array parameters from comma-separated strings
    groupBy: z
        .string()
        .transform((str) => str.split(',').filter(Boolean))
        .pipe(
            z.enum(['type', 'channel', 'status', 'recipient_type', 'day', 'week', 'month']).array()
        )
        .optional(),

    channels: z
        .string()
        .transform((str) => str.split(',').filter(Boolean))
        .optional(),

    types: z
        .string()
        .transform((str) => str.split(',').filter(Boolean))
        .optional(),

    recipientTypes: z
        .string()
        .transform((str) => str.split(',').filter(Boolean))
        .optional(),

    // Coerce boolean metrics flags
    includeDeliveryRates: HttpFieldFactories.booleanField('includeDeliveryRates'),
    includeReadRates: HttpFieldFactories.booleanField('includeReadRates'),
    includeFailureAnalysis: HttpFieldFactories.booleanField('includeFailureAnalysis'),
    includePerformanceMetrics: HttpFieldFactories.booleanField('includePerformanceMetrics')
});

/**
 * HTTP Bulk Notification Operation Schema
 * For processing bulk operations from HTTP requests
 */
export const HttpBulkNotificationOperationSchema = z.object({
    // Operation type
    operation: z.enum(['mark_as_read', 'mark_as_sent', 'delete', 'retry_failed']),

    // Parse notification IDs from comma-separated string or JSON array
    notificationIds: z
        .union([
            z.string().transform((str) => {
                try {
                    const parsed = JSON.parse(str);
                    return Array.isArray(parsed) ? parsed : str.split(',').filter(Boolean);
                } catch {
                    return str.split(',').filter(Boolean);
                }
            }),
            z.array(z.string())
        ])
        .pipe(
            z
                .array(z.string().uuid())
                .min(1, { message: 'zodError.notification.bulk.minSelections' })
                .max(1000, { message: 'zodError.notification.bulk.maxSelections' })
        ),

    // Operation metadata
    reason: z.string().max(500).optional(),

    // Performer ID
    performedById: z.string().uuid()
});

export type HttpCreateNotification = z.infer<typeof HttpCreateNotificationSchema>;
export type HttpUpdateNotification = z.infer<typeof HttpUpdateNotificationSchema>;
export type HttpListNotifications = z.infer<typeof HttpListNotificationsSchema>;
export type HttpNotificationAnalytics = z.infer<typeof HttpNotificationAnalyticsSchema>;
export type HttpBulkNotificationOperation = z.infer<typeof HttpBulkNotificationOperationSchema>;
