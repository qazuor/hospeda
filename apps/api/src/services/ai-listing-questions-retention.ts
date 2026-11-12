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
import { sql } from 'drizzle-orm';
import { retentionCutoff } from './ai-listing-questions.service.js';

/** Rows deleted per statement: bounded locks and memory on a large backlog. */
export const RETENTION_BATCH_SIZE = 1000;

/** Input of {@link purgeExpiredChatQuestions}. */
export interface PurgeExpiredChatQuestionsInput {
    /** Reference instant (injectable for tests). */
    readonly now?: Date;
    /** Rows per statement (injectable for tests). */
    readonly batchSize?: number;
}

/** Output of {@link purgeExpiredChatQuestions}. */
export interface PurgeExpiredChatQuestionsOutput {
    readonly deletedMessages: number;
    readonly deletedConversations: number;
    readonly cutoff: Date;
}

/** Rows a `DELETE` without `RETURNING` affected (node-postgres `rowCount`). */
function affected(result: unknown): number {
    return (result as { rowCount?: number | null }).rowCount ?? 0;
}

/**
 * Repeats a batched `DELETE` until a batch comes back short.
 *
 * @param input - The statement to run once per batch, and the batch size.
 * @returns The total number of rows deleted.
 */
async function deleteInBatches(input: {
    readonly runBatch: () => Promise<unknown>;
    readonly batchSize: number;
}): Promise<number> {
    let total = 0;
    for (;;) {
        const deleted = affected(await input.runBatch());
        total += deleted;
        if (deleted < input.batchSize) return total;
    }
}

/**
 * Deletes chat messages and emptied chat conversations older than the
 * retention horizon, {@link RETENTION_BATCH_SIZE} rows per statement. No id is
 * loaded into memory: each statement selects its own batch by key.
 *
 * @param input - Optional reference instant and batch size.
 * @returns Deleted counts and the cutoff used.
 */
export async function purgeExpiredChatQuestions(
    input: PurgeExpiredChatQuestionsInput = {}
): Promise<PurgeExpiredChatQuestionsOutput> {
    const { cutoff } = retentionCutoff({ now: input.now ?? new Date() });
    const batchSize = input.batchSize ?? RETENTION_BATCH_SIZE;
    const db = getDb();
    const isChat = sql`(${aiConversations.feature} = 'chat' or ${aiConversations.listingEntityId} is not null)`;

    const deletedMessages = await deleteInBatches({
        batchSize,
        runBatch: () =>
            db.execute(sql`
                delete from ${aiMessages}
                where ${aiMessages.id} in (
                    select m.id from ${aiMessages} m
                    join ${aiConversations} on ${aiConversations.id} = m.conversation_id
                    where m.created_at < ${cutoff} and ${isChat}
                    limit ${batchSize}
                )`)
    });

    const deletedConversations = await deleteInBatches({
        batchSize,
        runBatch: () =>
            db.execute(sql`
                delete from ${aiConversations}
                where ${aiConversations.id} in (
                    select ${aiConversations.id} from ${aiConversations}
                    where ${isChat}
                      and ${aiConversations.createdAt} < ${cutoff}
                      and not exists (
                          select 1 from ${aiMessages}
                          where ${aiMessages.conversationId} = ${aiConversations.id}
                      )
                    limit ${batchSize}
                )`)
    });

    return { deletedMessages, deletedConversations, cutoff };
}
