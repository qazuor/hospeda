import { z } from 'zod';

/**
 * Schema for a single subscription event in API responses.
 * Represents a recorded transition or action on a subscription lifecycle.
 */
export const SubscriptionEventSchema = z.object({
    /** Unique identifier of the event record */
    id: z
        .string({
            message: 'zodError.billing.subscriptionEvent.id.invalidType'
        })
        .uuid({ message: 'zodError.billing.subscriptionEvent.id.uuid' }),
    /** Identifier of the subscription this event belongs to */
    subscriptionId: z
        .string({
            message: 'zodError.billing.subscriptionEvent.subscriptionId.invalidType'
        })
        .uuid({ message: 'zodError.billing.subscriptionEvent.subscriptionId.uuid' }),
    /** Subscription status before the event occurred */
    previousStatus: z
        .string({
            message: 'zodError.billing.subscriptionEvent.previousStatus.invalidType'
        })
        .max(50, { message: 'zodError.billing.subscriptionEvent.previousStatus.max' }),
    /** Subscription status after the event occurred */
    newStatus: z
        .string({
            message: 'zodError.billing.subscriptionEvent.newStatus.invalidType'
        })
        .max(50, { message: 'zodError.billing.subscriptionEvent.newStatus.max' }),
    /** Source that triggered the event (e.g. 'user', 'system', 'webhook') */
    triggerSource: z
        .string({
            message: 'zodError.billing.subscriptionEvent.triggerSource.invalidType'
        })
        .max(50, { message: 'zodError.billing.subscriptionEvent.triggerSource.max' }),
    /** External provider event ID, null when not originating from a provider webhook */
    providerEventId: z
        .string({
            message: 'zodError.billing.subscriptionEvent.providerEventId.invalidType'
        })
        .max(255, { message: 'zodError.billing.subscriptionEvent.providerEventId.max' })
        .nullable(),
    /** Arbitrary key-value metadata attached to the event */
    metadata: z.record(z.string(), z.unknown()).default({}),
    /** ISO 8601 datetime string of when the event was recorded */
    createdAt: z
        .string({
            message: 'zodError.billing.subscriptionEvent.createdAt.invalidType'
        })
        .datetime({ message: 'zodError.billing.subscriptionEvent.createdAt.invalid' })
});

/** TypeScript type inferred from SubscriptionEventSchema */
export type SubscriptionEvent = z.infer<typeof SubscriptionEventSchema>;

/**
 * Schema for paginated subscription events API response.
 * Used by list endpoints that return multiple events with pagination metadata.
 */
export const SubscriptionEventsResponseSchema = z.object({
    /** Array of subscription event records for the current page */
    data: z.array(SubscriptionEventSchema),
    /** Pagination metadata describing the current result window */
    pagination: z.object({
        /** Current page number (1-based) */
        page: z
            .number({
                message: 'zodError.billing.subscriptionEvent.pagination.page.invalidType'
            })
            .int()
            .positive({ message: 'zodError.billing.subscriptionEvent.pagination.page.positive' }),
        /** Number of items returned per page */
        pageSize: z
            .number({
                message: 'zodError.billing.subscriptionEvent.pagination.pageSize.invalidType'
            })
            .int()
            .positive({
                message: 'zodError.billing.subscriptionEvent.pagination.pageSize.positive'
            }),
        /** Total number of items matching the query */
        totalItems: z
            .number({
                message: 'zodError.billing.subscriptionEvent.pagination.totalItems.invalidType'
            })
            .int()
            .nonnegative({
                message: 'zodError.billing.subscriptionEvent.pagination.totalItems.nonnegative'
            }),
        /** Total number of pages available */
        totalPages: z
            .number({
                message: 'zodError.billing.subscriptionEvent.pagination.totalPages.invalidType'
            })
            .int()
            .nonnegative({
                message: 'zodError.billing.subscriptionEvent.pagination.totalPages.nonnegative'
            })
    })
});

/** TypeScript type inferred from SubscriptionEventsResponseSchema */
export type SubscriptionEventsResponse = z.infer<typeof SubscriptionEventsResponseSchema>;
