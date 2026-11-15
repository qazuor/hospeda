/**
 * Types and search-param helpers for the staff AI conversations screens (HOS-2075).
 *
 * @module features/ai-conversations/types
 */

import { AiChatEntityTypeSchema } from '@repo/schemas';
import { z } from 'zod';

/** Default list page size. */
export const AI_CONVERSATIONS_DEFAULT_PAGE_SIZE = 20;

/**
 * URL search params of the conversations list route. Every field degrades to
 * `undefined` on a malformed value so a hand-edited URL never breaks the page.
 */
export const AiConversationsSearchSchema = z.object({
    entityType: AiChatEntityTypeSchema.optional().catch(undefined),
    entityId: z.string().uuid().optional().catch(undefined),
    from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .catch(undefined),
    to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .catch(undefined),
    page: z.coerce.number().int().min(1).catch(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).catch(20).default(20)
});

/** Resolved search params of the conversations list. */
export type AiConversationsSearch = z.infer<typeof AiConversationsSearchSchema>;

/**
 * Builds the query string of `GET /api/v1/admin/ai/conversations`, dropping
 * undefined and empty values.
 *
 * @param filters - Resolved list filters.
 * @returns URLSearchParams ready to append to the path.
 */
export const buildAiConversationsSearchParams = (
    filters: Readonly<Record<string, string | number | undefined>>
): URLSearchParams => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== '') {
            params.append(key, String(value));
        }
    }
    return params;
};
