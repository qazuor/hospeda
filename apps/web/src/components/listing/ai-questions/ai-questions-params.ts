/**
 * Pure helpers of the «Preguntas a la IA» tab (HOS-2101, split out of
 * `AiQuestionsPanel` by HOS-2503): the endpoint, its query params and the
 * unanswered/others split.
 *
 * @module components/listing/ai-questions/ai-questions-params
 */

import type { AiChatEntityType, AiListingQuestion } from '@repo/schemas';

/** Endpoint behind the panel. */
export const AI_LISTING_QUESTIONS_PATH = '/api/v1/protected/ai/listing-questions';

/**
 * Builds the query params of the list endpoint. `from` / `to` (YYYY-MM-DD, UTC)
 * are sent only when set, so an unfiltered request is identical to the
 * pre-filter one.
 *
 * @param input - Listing identity, optional date range and optional cursor.
 * @returns The params object for `apiClient.getProtected`.
 */
export function buildAiQuestionsParams(input: {
    readonly entityType: AiChatEntityType;
    readonly entityId: string;
    readonly from?: string;
    readonly to?: string;
    readonly othersCursor?: string;
}): Record<string, string> {
    const params: Record<string, string> = {
        entityType: input.entityType,
        entityId: input.entityId
    };
    if (input.from) params.from = input.from;
    if (input.to) params.to = input.to;
    if (input.othersCursor) params.othersCursor = input.othersCursor;
    return params;
}

/**
 * Splits the list into the unanswered block and the rest, keeping the
 * server's newest-first order inside each.
 *
 * @param input - The items as returned by the API.
 * @returns `{ unanswered, others }`.
 */
export function splitAiQuestions(input: { readonly items: readonly AiListingQuestion[] }): {
    readonly unanswered: readonly AiListingQuestion[];
    readonly others: readonly AiListingQuestion[];
} {
    return {
        unanswered: input.items.filter((item) => item.answerStatus === 'unanswered'),
        others: input.items.filter((item) => item.answerStatus !== 'unanswered')
    };
}
