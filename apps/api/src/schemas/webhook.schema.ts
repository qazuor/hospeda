/**
 * Webhook Event Request/Response Schemas
 *
 * Zod schemas for validating webhook event and dead letter queue API requests and responses.
 * These schemas define the structure for querying and managing webhook events.
 *
 * @module schemas/webhook
 */

import { z } from 'zod';

/**
 * Query parameters for listing webhook events
 */
export const ListWebhookEventsQuerySchema = z.object({
    /** Filter by event status */
    status: z.enum(['pending', 'processing', 'processed', 'failed']).optional(),
    /** Filter by event type */
    type: z.string().optional(),
    /** Filter by provider */
    provider: z.string().optional(),
    /** Filter by livemode */
    livemode: z.coerce.boolean().optional(),
    /** Filter by start date (ISO 8601) */
    startDate: z.string().datetime().optional(),
    /** Filter by end date (ISO 8601) */
    endDate: z.string().datetime().optional(),
    /** Number of items to return (max 100) */
    limit: z.coerce.number().int().min(1).max(100).default(50),
    /** Number of items to skip */
    offset: z.coerce.number().int().min(0).default(0)
});

export type ListWebhookEventsQuery = z.infer<typeof ListWebhookEventsQuerySchema>;

/**
 * Webhook event response item
 */
export const WebhookEventResponseSchema = z.object({
    id: z.string().uuid(),
    providerEventId: z.string(),
    provider: z.string(),
    type: z.string(),
    status: z.string(),
    payload: z.record(z.unknown()),
    processedAt: z.string().datetime().nullable(),
    error: z.string().nullable(),
    attempts: z.number().int(),
    livemode: z.boolean(),
    createdAt: z.string().datetime()
});

export type WebhookEventResponse = z.infer<typeof WebhookEventResponseSchema>;

/**
 * Paginated webhook events response
 */
export const WebhookEventsListResponseSchema = z.object({
    data: z.array(WebhookEventResponseSchema),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int()
});

export type WebhookEventsListResponse = z.infer<typeof WebhookEventsListResponseSchema>;

/**
 * Query parameters for listing dead letter queue entries
 */
export const ListDeadLetterQueueQuerySchema = z.object({
    /** Filter by provider */
    provider: z.string().optional(),
    /** Filter by event type */
    type: z.string().optional(),
    /** Filter by resolved status */
    resolved: z.coerce.boolean().optional(),
    /** Filter by livemode */
    livemode: z.coerce.boolean().optional(),
    /** Filter by start date (ISO 8601) */
    startDate: z.string().datetime().optional(),
    /** Filter by end date (ISO 8601) */
    endDate: z.string().datetime().optional(),
    /** Number of items to return (max 100) */
    limit: z.coerce.number().int().min(1).max(100).default(50),
    /** Number of items to skip */
    offset: z.coerce.number().int().min(0).default(0)
});

export type ListDeadLetterQueueQuery = z.infer<typeof ListDeadLetterQueueQuerySchema>;

/**
 * Dead letter queue entry response item
 */
export const DeadLetterEntryResponseSchema = z.object({
    id: z.string().uuid(),
    providerEventId: z.string(),
    provider: z.string(),
    type: z.string(),
    payload: z.record(z.unknown()),
    error: z.string(),
    attempts: z.number().int(),
    resolvedAt: z.string().datetime().nullable(),
    livemode: z.boolean(),
    createdAt: z.string().datetime()
});

export type DeadLetterEntryResponse = z.infer<typeof DeadLetterEntryResponseSchema>;

/**
 * Paginated dead letter queue response
 */
export const DeadLetterQueueListResponseSchema = z.object({
    data: z.array(DeadLetterEntryResponseSchema),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int()
});

export type DeadLetterQueueListResponse = z.infer<typeof DeadLetterQueueListResponseSchema>;

/**
 * Dead letter retry response
 */
export const DeadLetterRetryResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    eventId: z.string().uuid().optional()
});

export type DeadLetterRetryResponse = z.infer<typeof DeadLetterRetryResponseSchema>;
