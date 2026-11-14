/**
 * Staff read of the listing AI chat conversations (HOS-2075).
 *
 * Read-only and anonymous: no select list here names `ai_conversations.user_id`,
 * so the asking user cannot reach a response, and every response is built key by
 * key. Text is redacted at read time with {@link redactChatText}; storage stays
 * verbatim. Authorization is the route's job (`PermissionEnum`, never a role).
 *
 * @module apps/api/services/ai-conversations-admin
 */

import { aiConversations, aiMessages, getDb } from '@repo/db';
import type { AiChatEntityType, AiConversationDetail, AiConversationListItem } from '@repo/schemas';
import { and, asc, desc, eq, gte, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { type ChatDateRange, retentionCutoff } from './ai-chat-date-range.js';
import { redactChatText } from './ai-chat-redaction.js';

/** The first question is cut to this many characters in the list. */
export const AI_CONVERSATION_PREVIEW_MAX = 160;

/** One list row before mapping. */
export interface ConversationListRow {
    readonly id: string;
    readonly entityType: string;
    readonly entityId: string;
    readonly startedAt: Date | string;
    readonly lastMessageAt: Date | string;
    readonly messageCount: number | string;
    readonly firstQuestion: string | null;
}

/** One turn row before mapping. */
export interface ConversationTurnRow {
    readonly id: string;
    readonly role: string;
    readonly content: string;
    readonly createdAt: Date | string;
}

const iso = (value: Date | string): string => new Date(value).toISOString();

/**
 * Builds the list response key by key, with the preview redacted then truncated.
 *
 * @param input.rows - Rows as read.
 * @returns The anonymous list items.
 */
export function toConversationListItems(input: {
    readonly rows: readonly ConversationListRow[];
}): readonly AiConversationListItem[] {
    return input.rows.map((row) => ({
        id: row.id,
        entityType: row.entityType as AiChatEntityType,
        entityId: row.entityId,
        startedAt: iso(row.startedAt),
        lastMessageAt: iso(row.lastMessageAt),
        messageCount: Number(row.messageCount),
        firstQuestion: redactChatText({ text: row.firstQuestion ?? '' }).text.slice(
            0,
            AI_CONVERSATION_PREVIEW_MAX
        )
    }));
}

/**
 * Builds the detail response key by key, every turn redacted. Turns keep the
 * order they arrive in (the query orders them chronologically).
 *
 * @param input - Conversation header and its turn rows.
 * @returns The anonymous detail.
 */
export function toConversationDetail(input: {
    readonly id: string;
    readonly entityType: string;
    readonly entityId: string;
    readonly startedAt: Date | string;
    readonly turns: readonly ConversationTurnRow[];
}): AiConversationDetail {
    return {
        id: input.id,
        entityType: input.entityType as AiChatEntityType,
        entityId: input.entityId,
        startedAt: iso(input.startedAt),
        turns: input.turns.map((turn) => ({
            id: turn.id,
            role: turn.role === 'assistant' ? 'assistant' : 'user',
            content: redactChatText({ text: turn.content }).text,
            createdAt: iso(turn.createdAt)
        }))
    };
}

/** Input of {@link listConversations}. */
export interface ListConversationsInput {
    readonly entityType?: AiChatEntityType;
    readonly entityId?: string;
    readonly range?: ChatDateRange;
    readonly page: number;
    readonly pageSize: number;
    readonly now?: Date;
}

/**
 * Lists listing chat conversations inside the retention horizon, newest first.
 *
 * @param input - Filters and pagination.
 * @returns The page of items and the exact total.
 */
export async function listConversations(
    input: ListConversationsInput
): Promise<{ readonly items: readonly AiConversationListItem[]; readonly total: number }> {
    const db = getDb();
    const { cutoff } = retentionCutoff({ now: input.now ?? new Date() });
    const lower =
        input.range?.lowerBound !== undefined && input.range.lowerBound > cutoff
            ? input.range.lowerBound
            : cutoff;
    const where = and(
        isNotNull(aiConversations.listingEntityType),
        isNotNull(aiConversations.listingEntityId),
        isNull(aiConversations.deletedAt),
        input.entityType ? eq(aiConversations.listingEntityType, input.entityType) : undefined,
        input.entityId ? eq(aiConversations.listingEntityId, input.entityId) : undefined,
        gte(aiConversations.createdAt, lower),
        input.range?.upperExclusive
            ? lt(aiConversations.createdAt, input.range.upperExclusive)
            : undefined
    );

    const rows = await db
        .select({
            id: aiConversations.id,
            entityType: aiConversations.listingEntityType,
            entityId: aiConversations.listingEntityId,
            startedAt: aiConversations.createdAt,
            lastMessageAt: sql<Date>`coalesce((select max(m.created_at) from ${aiMessages} m where m.conversation_id = ${aiConversations.id} and m.deleted_at is null), ${aiConversations.createdAt})`,
            messageCount: sql<number>`(select count(*) from ${aiMessages} m where m.conversation_id = ${aiConversations.id} and m.deleted_at is null)`,
            firstQuestion: sql<
                string | null
            >`(select m.content from ${aiMessages} m where m.conversation_id = ${aiConversations.id} and m.role = 'user' and m.deleted_at is null order by m.created_at asc limit 1)`,
            total: sql<number>`count(*) over ()`
        })
        .from(aiConversations)
        .where(where)
        .orderBy(desc(aiConversations.createdAt), desc(aiConversations.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

    const first = rows[0];
    return {
        items: toConversationListItems({
            rows: rows.map((row) => ({
                id: row.id,
                entityType: row.entityType as string,
                entityId: row.entityId as string,
                startedAt: row.startedAt,
                lastMessageAt: row.lastMessageAt,
                messageCount: row.messageCount,
                firstQuestion: row.firstQuestion
            }))
        }),
        total: first === undefined ? 0 : Number(first.total)
    };
}

/**
 * Reads one conversation with its turns in chronological order.
 *
 * @param input.id - Conversation id.
 * @returns The anonymous detail, or `null` when it does not exist, is deleted or
 *   is not a listing conversation.
 */
export async function getConversation(input: {
    readonly id: string;
}): Promise<AiConversationDetail | null> {
    const db = getDb();
    const headers = await db
        .select({
            id: aiConversations.id,
            entityType: aiConversations.listingEntityType,
            entityId: aiConversations.listingEntityId,
            startedAt: aiConversations.createdAt
        })
        .from(aiConversations)
        .where(
            and(
                eq(aiConversations.id, input.id),
                isNull(aiConversations.deletedAt),
                isNotNull(aiConversations.listingEntityType),
                isNotNull(aiConversations.listingEntityId)
            )
        )
        .limit(1);
    const header = headers[0];
    if (!header) return null;

    const turns = await db
        .select({
            id: aiMessages.id,
            role: aiMessages.role,
            content: aiMessages.content,
            createdAt: aiMessages.createdAt
        })
        .from(aiMessages)
        .where(and(eq(aiMessages.conversationId, input.id), isNull(aiMessages.deletedAt)))
        .orderBy(asc(aiMessages.createdAt), asc(aiMessages.id));

    return toConversationDetail({
        id: header.id,
        entityType: header.entityType as string,
        entityId: header.entityId as string,
        startedAt: header.startedAt,
        turns
    });
}
