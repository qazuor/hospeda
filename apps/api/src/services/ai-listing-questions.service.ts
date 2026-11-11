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
    AI_LISTING_QUESTIONS_DISMISSED_CAP,
    AI_LISTING_QUESTIONS_OTHERS_PAGE_SIZE,
    AI_LISTING_QUESTIONS_RETENTION_MONTHS,
    type AiChatEntityType,
    type AiListingQuestion,
    type AiListingQuestionStatus,
    type AiListingQuestionsResponse
} from '@repo/schemas';
import { and, asc, desc, eq, gte, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
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

/** Checks message existence, user role and listing ownership without revealing foreign ids. */
export async function isQuestionOwnedBy(input: {
    readonly messageId: string;
    readonly userId: string;
}): Promise<{ readonly owned: boolean }> {
    const [row] = await getDb()
        .select({
            entityType: aiConversations.listingEntityType,
            entityId: aiConversations.listingEntityId
        })
        .from(aiMessages)
        .innerJoin(aiConversations, eq(aiConversations.id, aiMessages.conversationId))
        .where(
            and(
                eq(aiMessages.id, input.messageId),
                eq(aiMessages.role, 'user'),
                isNull(aiMessages.deletedAt),
                isNull(aiConversations.deletedAt)
            )
        )
        .limit(1);
    if (!row?.entityType || !row.entityId) return { owned: false };
    return isListingOwnedBy({
        entityType: row.entityType as AiChatEntityType,
        entityId: row.entityId,
        userId: input.userId
    });
}

/** Sets or clears the owner's dismissal timestamp for an owned question. */
export async function setQuestionDismissed(input: {
    readonly messageId: string;
    readonly userId: string;
    readonly dismissed: boolean;
}): Promise<{ readonly ownerDismissedAt: Date | null }> {
    const db = getDb();
    const changed = await db
        .update(aiMessages)
        .set({ ownerDismissedAt: input.dismissed ? new Date() : null })
        .where(
            and(
                eq(aiMessages.id, input.messageId),
                input.dismissed
                    ? isNull(aiMessages.ownerDismissedAt)
                    : isNotNull(aiMessages.ownerDismissedAt)
            )
        )
        .returning({ ownerDismissedAt: aiMessages.ownerDismissedAt });
    if (changed[0]) return { ownerDismissedAt: changed[0].ownerDismissedAt };
    const [current] = await db
        .select({ ownerDismissedAt: aiMessages.ownerDismissedAt })
        .from(aiMessages)
        .where(eq(aiMessages.id, input.messageId))
        .limit(1);
    return { ownerDismissedAt: current?.ownerDismissedAt ?? null };
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

/**
 * At most this many unanswered questions are returned (HOS-2101 review): they
 * are fetched on their own so the «Sin responder» block always matches
 * `unansweredCount` up to this cap, however many answered questions are newer.
 */
export const AI_LISTING_QUESTIONS_UNANSWERED_CAP = 100;

/** The rest of the item budget goes to the latest answered / unclassified ones. */
export const AI_LISTING_QUESTIONS_OTHERS_CAP = AI_LISTING_QUESTIONS_OTHERS_PAGE_SIZE;

/** One row of a listing query, before mapping. */
export interface ListingQuestionRow {
    readonly id: string;
    readonly question: string;
    readonly answer: string;
    readonly askedAt: Date | string;
    readonly answerStatus: string | null;
    /** Rows in the same block over the whole horizon (window count). */
    readonly blockTotal: number | string;
    readonly ownerDismissedAt?: Date | string | null;
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

/** Exact size of a block, read off its first row (window count). */
function blockTotal(rows: readonly ListingQuestionRow[]): number {
    const first = rows[0];
    return first === undefined ? 0 : Number(first.blockTotal);
}

/**
 * Builds the anonymous response from the two blocks. Each item is built key
 * by key, so a column added to a query cannot leak into the response.
 *
 * `truncated` is true exactly when some question in the horizon is not in
 * `items` — in either block.
 *
 * @param input - The unanswered rows and the other rows, each newest first.
 * @returns The response payload (unanswered first, then the rest).
 */
export function toListingQuestionsResponse(input: {
    readonly unansweredRows: readonly ListingQuestionRow[];
    readonly otherRows: readonly ListingQuestionRow[];
}): AiListingQuestionsResponse {
    const unansweredCount = blockTotal(input.unansweredRows);
    const total = unansweredCount + blockTotal(input.otherRows);
    const items: AiListingQuestion[] = [...input.unansweredRows, ...input.otherRows].map((row) => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
        askedAt: (row.askedAt instanceof Date ? row.askedAt : new Date(row.askedAt)).toISOString(),
        answerStatus: toQuestionStatus({ stored: row.answerStatus }).status
    }));
    return {
        items,
        total,
        unansweredCount,
        truncated: total > items.length,
        othersNextCursor: null,
        dismissed: [],
        dismissedCount: 0
    };
}

/** Input of {@link listListingQuestions}. */
export interface ListListingQuestionsInput {
    readonly entityType: AiChatEntityType;
    readonly entityId: string;
    /** Opaque composite cursor received from the previous "others" page. */
    readonly othersCursor?: string;
    /** Reference instant for the retention horizon (injectable for tests). */
    readonly now?: Date;
    /** Block caps (injectable for tests); default to the exported constants. */
    readonly unansweredCap?: number;
    readonly othersCap?: number;
}

/**
 * Reads one block of a listing's questions inside the horizon, newest first.
 *
 * @param input - Listing, cutoff, which block and its cap.
 * @returns The block's rows, each carrying the block's exact size.
 */
async function readQuestionBlock(input: {
    readonly entityType: AiChatEntityType;
    readonly entityId: string;
    readonly cutoff: Date;
    readonly unanswered: boolean;
    readonly limit: number;
    readonly dismissed?: boolean;
    readonly after?: { readonly createdAt: Date; readonly id: string };
}): Promise<ListingQuestionRow[]> {
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

    const statusFilter = input.dismissed
        ? sql`true`
        : input.unanswered
          ? sql`${answer.answerStatus} = 'unanswered'`
          : sql`${answer.answerStatus} is distinct from 'unanswered'`;

    return db
        .select({
            id: question.id,
            question: question.content,
            answer: answer.content,
            askedAt: question.createdAt,
            answerStatus: answer.answerStatus,
            ownerDismissedAt: question.ownerDismissedAt,
            // Window aggregates are computed before LIMIT: the exact block size.
            blockTotal: sql<number>`count(*) over ()`
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
                input.dismissed === undefined
                    ? isNull(question.ownerDismissedAt)
                    : input.dismissed
                      ? sql`${question.ownerDismissedAt} is not null`
                      : isNull(question.ownerDismissedAt),
                gte(question.createdAt, input.cutoff),
                input.after
                    ? or(
                          lt(question.createdAt, input.after.createdAt),
                          and(
                              eq(question.createdAt, input.after.createdAt),
                              lt(question.id, input.after.id)
                          )
                      )
                    : undefined,
                statusFilter
            )
        )
        .orderBy(desc(question.createdAt), desc(question.id))
        .limit(input.limit);
}

/**
 * Lists the questions asked about one listing inside the retention horizon:
 * up to {@link AI_LISTING_QUESTIONS_UNANSWERED_CAP} unanswered ones and up to
 * {@link AI_LISTING_QUESTIONS_OTHERS_CAP} of the rest, each block newest first.
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
    const base = { entityType: input.entityType, entityId: input.entityId, cutoff };
    const after = input.othersCursor ? decodeOthersCursor(input.othersCursor) : undefined;
    const [unansweredRows, otherRows, otherCountRows, dismissedRows] = await Promise.all([
        readQuestionBlock({
            ...base,
            unanswered: true,
            limit: input.unansweredCap ?? AI_LISTING_QUESTIONS_UNANSWERED_CAP
        }),
        readQuestionBlock({
            ...base,
            unanswered: false,
            after,
            limit: (input.othersCap ?? AI_LISTING_QUESTIONS_OTHERS_CAP) + 1
        }),
        after
            ? readQuestionBlock({
                  ...base,
                  unanswered: false,
                  limit: 1
              })
            : Promise.resolve([] as ListingQuestionRow[]),
        readQuestionBlock({
            ...base,
            unanswered: false,
            dismissed: true,
            limit: AI_LISTING_QUESTIONS_DISMISSED_CAP
        })
    ]);
    const hasMore = otherRows.length > (input.othersCap ?? AI_LISTING_QUESTIONS_OTHERS_CAP);
    const pageRows = hasMore ? otherRows.slice(0, -1) : otherRows;
    const mapped = toListingQuestionsResponse({ unansweredRows, otherRows: pageRows });
    const activeOtherCount = after ? blockTotal(otherCountRows) : blockTotal(otherRows);
    const last = pageRows.at(-1);
    const encode = (row: ListingQuestionRow) =>
        Buffer.from(`${new Date(row.askedAt).toISOString()}|${row.id}`).toString('base64url');
    const total = blockTotal(unansweredRows) + activeOtherCount;
    return {
        ...mapped,
        total,
        truncated: total > mapped.items.length,
        dismissed: dismissedRows.map((row) => ({
            ...mapQuestion(row),
            ownerDismissedAt: row.ownerDismissedAt
                ? new Date(row.ownerDismissedAt).toISOString()
                : null
        })),
        dismissedCount: Number(dismissedRows[0]?.blockTotal ?? 0),
        othersNextCursor: hasMore && last ? encode(last) : null
    };
}

function mapQuestion(row: ListingQuestionRow): AiListingQuestion {
    return {
        id: row.id,
        question: row.question,
        answer: row.answer,
        askedAt: new Date(row.askedAt).toISOString(),
        answerStatus: toQuestionStatus({ stored: row.answerStatus }).status
    };
}

function decodeOthersCursor(cursor: string): { readonly createdAt: Date; readonly id: string } {
    try {
        const [date, id] = Buffer.from(cursor, 'base64url').toString().split('|');
        if (!date || !id || Number.isNaN(Date.parse(date)) || !/^[0-9a-f-]{36}$/i.test(id))
            throw new Error();
        return { createdAt: new Date(date), id };
    } catch {
        throw new Error('Invalid others cursor');
    }
}
