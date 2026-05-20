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
