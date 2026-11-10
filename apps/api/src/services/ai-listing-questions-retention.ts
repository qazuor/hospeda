/**
 * 12-month retention of AI chat questions (HOS-2101, owner decision).
 *
 * Hard-deletes chat messages older than the horizon and then the chat
 * conversations left with no message. Scoped to the chat feature: search,
 * text-improve and the rest keep their own lifecycle.
 *
 * "Chat" is `feature = 'chat'` — `persistChatTurn` writes that value for all
 * three verticals — OR a listing reference, so a row whose `feature` were ever
 * written differently is still covered.
 *
 * @module apps/api/services/ai-listing-questions-retention
 */

import { aiConversations, aiMessages, getDb } from '@repo/db';
import { and, eq, exists, isNotNull, lt, or, sql } from 'drizzle-orm';
import { retentionCutoff } from './ai-listing-questions.service.js';

/** Input of {@link purgeExpiredChatQuestions}. */
export interface PurgeExpiredChatQuestionsInput {
    /** Reference instant (injectable for tests). */
    readonly now?: Date;
}

/** Output of {@link purgeExpiredChatQuestions}. */
export interface PurgeExpiredChatQuestionsOutput {
    readonly deletedMessages: number;
    readonly deletedConversations: number;
    readonly cutoff: Date;
}

/**
 * Deletes chat messages older than the retention horizon, then the chat
 * conversations that no longer hold any message.
 *
 * Messages first, conversations second: deleting a conversation by its own
 * `created_at` would cascade away the RECENT turns of a long-lived thread.
 *
 * @param input - Optional reference instant.
 * @returns The deleted counts and the cutoff used.
 */
export async function purgeExpiredChatQuestions(
    input: PurgeExpiredChatQuestionsInput = {}
): Promise<PurgeExpiredChatQuestionsOutput> {
    const { cutoff } = retentionCutoff({ now: input.now ?? new Date() });
    const db = getDb();
    const isChat = or(
        eq(aiConversations.feature, 'chat'),
        isNotNull(aiConversations.listingEntityId)
    );

    const deletedMessages = await db
        .delete(aiMessages)
        .where(
            and(
                lt(aiMessages.createdAt, cutoff),
                exists(
                    db
                        .select({ one: sql`1` })
                        .from(aiConversations)
                        .where(and(eq(aiConversations.id, aiMessages.conversationId), isChat))
                )
            )
        )
        .returning({ id: aiMessages.id });

    const deletedConversations = await db
        .delete(aiConversations)
        .where(
            and(
                isChat,
                lt(aiConversations.createdAt, cutoff),
                sql`not exists (select 1 from ${aiMessages} where ${aiMessages.conversationId} = ${aiConversations.id})`
            )
        )
        .returning({ id: aiConversations.id });

    return {
        deletedMessages: deletedMessages.length,
        deletedConversations: deletedConversations.length,
        cutoff
    };
}
