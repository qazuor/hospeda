/**
 * Schemas for the host-facing AI questions panel (HOS-2101).
 *
 * The listing owner reads the questions tourists asked their listing's AI chat.
 * Everything here is deliberately ANONYMOUS: the response carries the question,
 * the bot's answer, the date and the classifier verdict — never the asking
 * user's id, name or contact, and never the conversation id (which would let a
 * client correlate several questions to one person). The asking user stays
 * stored on `ai_conversations.user_id`; exposing it is an open owner decision.
 *
 * @module schemas/entities/ai/ai-listing-questions
 */

import { z } from 'zod';
import { AiChatEntityTypeSchema } from './ai-chat.schema.js';

/**
 * Persisted verdict of the chat-answer classifier, as stored in
 * `ai_messages.answer_status`. `NULL` in the column means "not classified".
 */
export const AiAnswerStatusSchema = z.enum(['answered', 'unanswered']);

/** TypeScript type for {@link AiAnswerStatusSchema}. */
export type AiAnswerStatus = z.infer<typeof AiAnswerStatusSchema>;

/**
 * Verdict as the panel shows it: the stored verdict, or `unclassified` when
 * the classifier has not run or failed. `unclassified` is never read as
 * either verdict.
 */
export const AiListingQuestionStatusSchema = z.enum(['answered', 'unanswered', 'unclassified']);

/** TypeScript type for {@link AiListingQuestionStatusSchema}. */
export type AiListingQuestionStatus = z.infer<typeof AiListingQuestionStatusSchema>;

/** Retention horizon of chat questions, in months (owner decision, HOS-2101). */
export const AI_LISTING_QUESTIONS_RETENTION_MONTHS = 12;

/** Maximum questions one panel response carries; `truncated` reports the rest. */
export const AI_LISTING_QUESTIONS_MAX_ITEMS = 200;
/** Page size for active answered and unclassified questions. */
export const AI_LISTING_QUESTIONS_OTHERS_PAGE_SIZE = 50;
/** Maximum dismissed questions in the response. */
export const AI_LISTING_QUESTIONS_DISMISSED_CAP = 50;

/** Checks the timestamp and message UUID inside a base64url page cursor. */
function isValidOthersCursor(cursor: string): boolean {
    try {
        if (!/^[A-Za-z0-9_-]+$/.test(cursor)) return false;
        const base64 = cursor.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
        const [askedAt, messageId, extra] = decoded.split('|');
        const validDate = z.string().datetime().safeParse(askedAt).success;
        return (
            extra === undefined &&
            validDate &&
            new Date(askedAt as string).toISOString() === askedAt &&
            z.string().uuid().safeParse(messageId).success
        );
    } catch {
        return false;
    }
}

/**
 * Query of `GET /api/v1/protected/ai/listing-questions`.
 */
export const AiListingQuestionsQuerySchema = z
    .object({
        /** Vertical of the listing. */
        entityType: AiChatEntityTypeSchema,
        /** Listing id. A non-UUID is a 400, never a database round-trip. */
        entityId: z.string().uuid(),
        /** Opaque composite cursor for the next "others" page. */
        othersCursor: z
            .string()
            .max(128)
            .refine(isValidOthersCursor, 'Invalid others cursor')
            .optional()
    })
    .strict();

/** TypeScript type for {@link AiListingQuestionsQuerySchema}. */
export type AiListingQuestionsQuery = z.infer<typeof AiListingQuestionsQuerySchema>;

/**
 * One question as the owner sees it. `.strict()` so a future field that
 * identifies the tourist cannot be added to the response by accident without
 * failing validation.
 */
export const AiListingQuestionSchema = z
    .object({
        /** Id of the tourist's message row (opaque, not the conversation). */
        id: z.string().uuid(),
        /** The tourist's question, verbatim. */
        question: z.string(),
        /** The bot's answer, verbatim. */
        answer: z.string(),
        /** When the question was asked (ISO 8601). */
        askedAt: z.string(),
        /** Classifier verdict. */
        answerStatus: AiListingQuestionStatusSchema,
        /** When the owner dismissed the question, when present in the dismissed block. */
        ownerDismissedAt: z.string().datetime().nullable().optional()
    })
    .strict();

/** TypeScript type for {@link AiListingQuestionSchema}. */
export type AiListingQuestion = z.infer<typeof AiListingQuestionSchema>;

/**
 * Response of `GET /api/v1/protected/ai/listing-questions`.
 */
export const AiListingQuestionsResponseSchema = z
    .object({
        /**
         * At most {@link AI_LISTING_QUESTIONS_MAX_ITEMS}: up to 100 unanswered
         * questions first, then the latest of the rest; each block newest first.
         */
        items: z.array(AiListingQuestionSchema),
        /** Exact number of questions inside the retention horizon. */
        total: z.number().int().nonnegative(),
        /** Exact number of unanswered questions inside the retention horizon. */
        unansweredCount: z.number().int().nonnegative(),
        /** True when some question inside the horizon is not in `items`. */
        truncated: z.boolean(),
        /** Cursor for fetching another page of active "other" questions. */
        othersNextCursor: z.string().nullable(),
        dismissed: z.array(AiListingQuestionSchema),
        dismissedCount: z.number().int().nonnegative()
    })
    .strict();

/** TypeScript type for {@link AiListingQuestionsResponseSchema}. */
export type AiListingQuestionsResponse = z.infer<typeof AiListingQuestionsResponseSchema>;
