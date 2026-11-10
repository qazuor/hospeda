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

/**
 * Query of `GET /api/v1/protected/ai/listing-questions`.
 */
export const AiListingQuestionsQuerySchema = z
    .object({
        /** Vertical of the listing. */
        entityType: AiChatEntityTypeSchema,
        /** Listing id. A non-UUID is a 400, never a database round-trip. */
        entityId: z.string().uuid()
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
        answerStatus: AiListingQuestionStatusSchema
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
        truncated: z.boolean()
    })
    .strict();

/** TypeScript type for {@link AiListingQuestionsResponseSchema}. */
export type AiListingQuestionsResponse = z.infer<typeof AiListingQuestionsResponseSchema>;
