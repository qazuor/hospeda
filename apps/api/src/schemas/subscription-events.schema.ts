/**
 * Subscription Events Request/Response Schemas
 *
 * Routing-specific Zod schemas for subscription lifecycle event API endpoints.
 * Response schemas are imported from @repo/schemas (canonical source of truth).
 *
 * @module schemas/subscription-events
 */

import { z } from 'zod';

/**
 * Path parameter for subscription events route
 */
export const SubscriptionEventsParamSchema = z.object({
    /** Subscription UUID */
    id: z.string().uuid()
});

export type SubscriptionEventsParam = z.infer<typeof SubscriptionEventsParamSchema>;

/**
 * Query parameters for listing subscription events with pagination
 */
export const ListSubscriptionEventsQuerySchema = z.object({
    /** Page number (1-based) */
    page: z.coerce.number().int().positive().default(1),
    /** Number of items per page (max 50) */
    pageSize: z.coerce.number().int().positive().max(50).default(10)
});

export type ListSubscriptionEventsQuery = z.infer<typeof ListSubscriptionEventsQuerySchema>;
