/**
 * Notification Log Request/Response Schemas
 *
 * Zod schemas for validating notification log API requests and responses.
 * These schemas define the structure for querying and displaying notification logs.
 *
 * @module schemas/notification
 */

import { z } from 'zod';

/**
 * Query parameters for listing notification logs
 */
export const ListNotificationLogsQuerySchema = z.object({
    /** Filter by notification type */
    type: z.string().optional(),
    /** Filter by notification status */
    status: z.enum(['queued', 'sent', 'failed', 'pending']).optional(),
    /** Filter by start date (ISO 8601) */
    startDate: z.string().datetime().optional(),
    /** Filter by end date (ISO 8601) */
    endDate: z.string().datetime().optional(),
    /** Number of items to return (max 100) */
    limit: z.coerce.number().int().min(1).max(100).default(50),
    /** Number of items to skip */
    offset: z.coerce.number().int().min(0).default(0)
});

export type ListNotificationLogsQuery = z.infer<typeof ListNotificationLogsQuerySchema>;

/**
 * Notification log response item
 */
export const NotificationLogResponseSchema = z.object({
    id: z.string().uuid(),
    customerId: z.string().uuid().nullable(),
    type: z.string(),
    channel: z.string(),
    recipient: z.string(),
    subject: z.string(),
    templateId: z.string().nullable(),
    status: z.string(),
    sentAt: z.string().datetime().nullable(),
    errorMessage: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    createdAt: z.string().datetime()
});

export type NotificationLogResponse = z.infer<typeof NotificationLogResponseSchema>;

/**
 * Paginated notification logs response
 */
export const NotificationLogsListResponseSchema = z.object({
    data: z.array(NotificationLogResponseSchema),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int()
});

export type NotificationLogsListResponse = z.infer<typeof NotificationLogsListResponseSchema>;
