/**
 * @module entities/conversation/conversation.query.schema
 *
 * Public / protected query schemas for conversation endpoints (SPEC-085).
 *
 * Covers:
 * - `ThreadQuerySchema`      — cursor-based pagination for fetching thread messages
 * - `GuestInboxQuerySchema`  — page-based pagination for the guest inbox list
 */

import { z } from 'zod';

// ============================================================================
// ThreadQuerySchema
// ============================================================================

/**
 * Query parameters for thread message pagination.
 *
 * Used by both the public (guest token) and protected (authenticated user)
 * thread GET endpoints.  Implements cursor-based pagination — the `cursor`
 * is the ISO-8601 timestamp of the oldest message in the current page, used
 * to fetch the preceding (older) page.
 *
 * `limit` is coerced from string so that it works with URL query parameters.
 *
 * @example
 * ```ts
 * const query = ThreadQuerySchema.parse({ limit: '20', cursor: '2025-04-01T00:00:00.000Z' });
 * ```
 */
export const ThreadQuerySchema = z.object({
    /**
     * ISO-8601 datetime cursor for fetching older messages.
     * Omit to get the most recent page.
     */
    cursor: z.string().datetime().optional(),

    /**
     * Number of messages to return per page (1..100, default 50).
     * Coerced from string for URL query parameter compatibility.
     */
    limit: z.coerce.number().int().min(1).max(100).default(50)
});

/** TypeScript type inferred from {@link ThreadQuerySchema}. */
export type ThreadQuery = z.infer<typeof ThreadQuerySchema>;

// ============================================================================
// GuestInboxQuerySchema
// ============================================================================

/**
 * Query parameters for the guest inbox list (anonymous token or authenticated).
 *
 * Implements classic page-based pagination.  `archivedByGuest` is coerced from
 * string (`"true"` / `"false"`) for URL query parameter compatibility.
 *
 * @example
 * ```ts
 * const query = GuestInboxQuerySchema.parse({ page: '2', pageSize: '10', archivedByGuest: 'false' });
 * ```
 */
export const GuestInboxQuerySchema = z.object({
    /**
     * Page number (1-based, default 1).
     * Coerced from string for URL query parameter compatibility.
     */
    page: z.coerce.number().int().min(1).default(1),

    /**
     * Number of conversations per page (1..100, default 20).
     * Coerced from string for URL query parameter compatibility.
     */
    pageSize: z.coerce.number().int().min(1).max(100).default(20),

    /**
     * When `true`, return only archived conversations.
     * When `false`, return only non-archived conversations.
     * When omitted, return all conversations regardless of archive state.
     *
     * Coerced from string (`"true"` / `"false"`) for URL query param support.
     */
    archivedByGuest: z.coerce.boolean().optional(),

    /**
     * When set, return only conversations attached to this accommodation.
     * Used by the accommodation detail page to decide whether the visitor
     * has already contacted the host (and is therefore eligible to leave
     * a review). Omitted = no filter.
     */
    accommodationId: z.string().uuid().optional()
});

/** TypeScript type inferred from {@link GuestInboxQuerySchema}. */
export type GuestInboxQuery = z.infer<typeof GuestInboxQuerySchema>;

// ============================================================================
// HostConversationResponseRateSchema (SPEC-155 T-006)
// ============================================================================

/**
 * Response schema for the host conversation response-rate endpoint.
 *
 * `GET /api/v1/protected/conversations/me/response-rate`
 *
 * Aggregated KPIs scoped to the authenticated host's own conversations:
 * - `responseRatePct`:       percentage of conversations that received at least
 *                            one owner reply (ownerMessageCount > 0), rounded
 *                            to one decimal place. Returns 0 when there are no
 *                            conversations.
 * - `avgResponseTimeMinutes`: average time (in minutes) between the first guest
 *                             message and the first owner reply, across all
 *                             conversations that have both timestamps. Returns
 *                             null when no conversations have been replied to.
 *
 * @example
 * ```ts
 * // Valid response
 * const result = HostConversationResponseRateSchema.parse({
 *   responseRatePct: 83.3,
 *   avgResponseTimeMinutes: 47
 * });
 * ```
 */
export const HostConversationResponseRateSchema = z.object({
    /**
     * Percentage of the host's conversations that received at least one
     * owner reply (i.e. ownerMessageCount > 0).  Value is in the range
     * [0, 100], rounded to one decimal place.  Returns 0 when no
     * conversations exist.
     */
    responseRatePct: z.number().min(0).max(100),

    /**
     * Average time in minutes between the first guest message and the first
     * owner reply, across all replied conversations.  Null when no
     * conversations have been replied to yet.
     */
    avgResponseTimeMinutes: z.number().min(0).nullable()
});

/** TypeScript type inferred from {@link HostConversationResponseRateSchema}. */
export type HostConversationResponseRate = z.infer<typeof HostConversationResponseRateSchema>;
