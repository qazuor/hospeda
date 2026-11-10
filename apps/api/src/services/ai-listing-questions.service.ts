/**
 * Reads behind the host AI questions panel (HOS-2101).
 *
 * Two queries:
 *
 * - {@link isListingOwnedBy} — whether a listing exists, is not deleted and
 *   belongs to the actor. The route answers 404 when it is not, for a missing
 *   listing and a foreign one alike (error contract: a 403 would confirm the
 *   id exists).
 * - {@link listListingQuestions} — the listing's questions inside the
 *   retention horizon, newest first, ANONYMOUS by construction: the select list
 *   never names `ai_conversations.user_id` nor the conversation id.
 *
 * ## Pairing a question with its answer
 *
 * The chat persists one `user` row and then one `assistant` row per request,
 * in two separate statements, so the answer to a question is the earliest
 * assistant row of the same conversation created at or after it. A LATERAL
 * subquery picks exactly that row. A question whose answer row is missing
 * (the second insert failed) is dropped rather than shown with no answer.
 *
 * @module apps/api/services/ai-listing-questions
 */

import { accommodations, aiConversations, aiMessages, experiences, getDb, venues } from '@repo/db';
import {
    AI_LISTING_QUESTIONS_MAX_ITEMS,
    AI_LISTING_QUESTIONS_RETENTION_MONTHS,
    type AiChatEntityType,
    type AiListingQuestion,
    type AiListingQuestionStatus,
    type AiListingQuestionsResponse
} from '@repo/schemas';
import { and, asc, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

/**
 * Listing table per chat vertical — total over `AiChatEntityType`.
 *
 * A function, not a module-level constant: reading the table exports at import
 * time breaks every suite that loads the app over a partial `@repo/db` mock
 * (the chat route reads them inside its handler for the same reason).
 */
function listingTableFor(entityType: AiChatEntityType) {
    const tables = {
        accommodation: accommodations,
        venue: venues,
        experience: experiences
    } as const;
    return tables[entityType];
}

/** Input of {@link isListingOwnedBy}. */
export interface IsListingOwnedByInput {
    readonly entityType: AiChatEntityType;
    readonly entityId: string;
    readonly userId: string;
}

/** Output of {@link isListingOwnedBy}. */
export interface IsListingOwnedByOutput {
    /** True only for an existing, non-deleted listing owned by `userId`. */
    readonly owned: boolean;
}

/**
 * Checks that a listing exists, is not soft-deleted and is owned by the user.
 *
 * @param input - Vertical, listing id and the actor's user id.
 * @returns `{ owned }`.
 */
export async function isListingOwnedBy(
    input: IsListingOwnedByInput
): Promise<IsListingOwnedByOutput> {
    const table = listingTableFor(input.entityType);
    const rows = await getDb()
        .select({ ownerId: table.ownerId })
        .from(table)
        .where(and(eq(table.id, input.entityId), isNull(table.deletedAt)))
        .limit(1);
    const row = rows[0];
    return { owned: row !== undefined && row.ownerId === input.userId };
}

/**
 * The start of the retention horizon relative to `now`.
 *
 * @param input - The reference instant.
 * @returns `{ cutoff }`, {@link AI_LISTING_QUESTIONS_RETENTION_MONTHS} months earlier.
 */
export function retentionCutoff(input: { readonly now: Date }): { readonly cutoff: Date } {
    const cutoff = new Date(input.now.getTime());
    cutoff.setUTCMonth(cutoff.getUTCMonth() - AI_LISTING_QUESTIONS_RETENTION_MONTHS);
    return { cutoff };
}

/** One row of the listing query, before mapping. */
export interface ListingQuestionRow {
    readonly id: string;
    readonly question: string;
    readonly answer: string;
    readonly askedAt: Date | string;
    readonly answerStatus: string | null;
    readonly total: number | string;
    readonly unansweredCount: number | string;
}

/**
 * Maps a stored `answer_status` to what the panel shows. Anything that is not
 * one of the two verdicts — `NULL`, a value written by a future classifier —
 * reads as `unclassified`, never as a verdict.
 *
 * @param input - The stored value.
 * @returns `{ status }`.
 */
export function toQuestionStatus(input: { readonly stored: string | null }): {
    readonly status: AiListingQuestionStatus;
} {
    if (input.stored === 'answered' || input.stored === 'unanswered') {
        return { status: input.stored };
    }
    return { status: 'unclassified' };
}

/**
 * Builds the anonymous response from query rows. Each item is built key by
 * key, so a column added to the query cannot leak into the response.
 *
 * @param input - The rows (each carries the window counts).
 * @returns The response payload.
 */
export function toListingQuestionsResponse(input: {
    readonly rows: readonly ListingQuestionRow[];
}): AiListingQuestionsResponse {
    const first = input.rows[0];
    const total = first === undefined ? 0 : Number(first.total);
    const unansweredCount = first === undefined ? 0 : Number(first.unansweredCount);
    const items: AiListingQuestion[] = input.rows.map((row) => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
        askedAt: (row.askedAt instanceof Date ? row.askedAt : new Date(row.askedAt)).toISOString(),
        answerStatus: toQuestionStatus({ stored: row.answerStatus }).status
    }));
    return { items, total, unansweredCount, truncated: total > items.length };
}

/** Input of {@link listListingQuestions}. */
export interface ListListingQuestionsInput {
    readonly entityType: AiChatEntityType;
    readonly entityId: string;
    /** Reference instant for the retention horizon (injectable for tests). */
    readonly now?: Date;
}

/**
 * Lists the questions asked about one listing inside the retention horizon.
 *
 * Ownership is NOT checked here — the route checks it first with
 * {@link isListingOwnedBy}.
 *
 * @param input - Vertical, listing id and optional reference instant.
 * @returns The anonymous response payload.
 */
export async function listListingQuestions(
    input: ListListingQuestionsInput
): Promise<AiListingQuestionsResponse> {
    const { cutoff } = retentionCutoff({ now: input.now ?? new Date() });
    const db = getDb();
    const question = alias(aiMessages, 'question');

    const answer = db
        .select({
            content: aiMessages.content,
            answerStatus: aiMessages.answerStatus
        })
        .from(aiMessages)
        .where(
            and(
                eq(aiMessages.conversationId, question.conversationId),
                eq(aiMessages.role, 'assistant'),
                isNull(aiMessages.deletedAt),
                gte(aiMessages.createdAt, question.createdAt)
            )
        )
        .orderBy(asc(aiMessages.createdAt))
        .limit(1)
        .as('answer');

    const rows = await db
        .select({
            id: question.id,
            question: question.content,
            answer: answer.content,
            askedAt: question.createdAt,
            answerStatus: answer.answerStatus,
            // Window aggregates are computed before LIMIT, so every row carries
            // the exact counts over the whole horizon.
            total: sql<number>`count(*) over ()`,
            unansweredCount: sql<number>`count(*) filter (where ${answer.answerStatus} = 'unanswered') over ()`
        })
        .from(question)
        .innerJoin(aiConversations, eq(aiConversations.id, question.conversationId))
        .innerJoinLateral(answer, sql`true`)
        .where(
            and(
                eq(aiConversations.listingEntityType, input.entityType),
                eq(aiConversations.listingEntityId, input.entityId),
                isNull(aiConversations.deletedAt),
                eq(question.role, 'user'),
                isNull(question.deletedAt),
                gte(question.createdAt, cutoff)
            )
        )
        .orderBy(desc(question.createdAt))
        .limit(AI_LISTING_QUESTIONS_MAX_ITEMS);

    return toListingQuestionsResponse({ rows });
}
