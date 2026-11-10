/**
 * Who receives the weekly AI questions digest, and with what (HOS-2101).
 *
 * The two reads of the digest: unanswered rows in the window and the
 * recipient accounts. The pure decisions live in
 * `ai-questions-digest.helpers.ts`.
 *
 * @module apps/api/services/ai-questions-digest.selection
 */

import {
    accommodations,
    aiConversations,
    aiMessages,
    experiences,
    getDb,
    users,
    venues
} from '@repo/db';
import type { AiChatEntityType } from '@repo/schemas';
import { and, desc, eq, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { DigestRow } from './ai-questions-digest.helpers.js';

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

/**
 * Reads every unanswered question of the window whose listing still exists,
 * for one vertical. The question text is the latest user turn of the same
 * conversation at or before the answer.
 */
async function readVerticalRows(input: {
    readonly entityType: AiChatEntityType;
    readonly windowStart: Date;
    readonly windowEnd: Date;
}): Promise<DigestRow[]> {
    const db = getDb();
    const table = listingTableFor(input.entityType);
    const answer = alias(aiMessages, 'answer');

    const question = db
        .select({ content: aiMessages.content })
        .from(aiMessages)
        .where(
            and(
                eq(aiMessages.conversationId, answer.conversationId),
                eq(aiMessages.role, 'user'),
                isNull(aiMessages.deletedAt),
                lte(aiMessages.createdAt, answer.createdAt)
            )
        )
        .orderBy(desc(aiMessages.createdAt))
        .limit(1)
        .as('question');

    const rows = await db
        .select({
            ownerId: table.ownerId,
            entityId: table.id,
            listingName: table.name,
            question: question.content,
            askedAt: answer.createdAt
        })
        .from(answer)
        .innerJoin(aiConversations, eq(aiConversations.id, answer.conversationId))
        .innerJoin(table, eq(table.id, aiConversations.listingEntityId))
        .innerJoinLateral(question, sql`true`)
        .where(
            and(
                eq(answer.role, 'assistant'),
                eq(answer.answerStatus, 'unanswered'),
                isNull(answer.deletedAt),
                gte(answer.createdAt, input.windowStart),
                lt(answer.createdAt, input.windowEnd),
                eq(aiConversations.listingEntityType, input.entityType),
                isNull(aiConversations.deletedAt),
                isNull(table.deletedAt)
            )
        );

    return rows.map((row) => ({ ...row, entityType: input.entityType }));
}

/**
 * Reads the unanswered questions of the window across the three verticals.
 *
 * @param input - Window bounds, `[windowStart, windowEnd)`.
 * @returns `{ rows }`.
 */
export async function readDigestRows(input: {
    readonly windowStart: Date;
    readonly windowEnd: Date;
}): Promise<{ readonly rows: readonly DigestRow[] }> {
    const entityTypes: readonly AiChatEntityType[] = ['accommodation', 'venue', 'experience'];
    const perVertical = await Promise.all(
        entityTypes.map((entityType) => readVerticalRows({ ...input, entityType }))
    );
    return { rows: perVertical.flat() };
}

/** A recipient account, as the digest needs it. */
export interface DigestRecipient {
    readonly id: string;
    readonly email: string;
    readonly name: string;
    readonly settings: unknown;
}

/**
 * Loads the active accounts of the given owners.
 *
 * @param input - Owner ids.
 * @returns `{ recipients }`, deleted accounts excluded.
 */
export async function readDigestRecipients(input: {
    readonly ownerIds: readonly string[];
}): Promise<{ readonly recipients: readonly DigestRecipient[] }> {
    if (input.ownerIds.length === 0) {
        return { recipients: [] };
    }
    const rows = await getDb()
        .select({
            id: users.id,
            email: users.email,
            displayName: users.displayName,
            firstName: users.firstName,
            settings: users.settings
        })
        .from(users)
        .where(and(inArray(users.id, [...input.ownerIds]), isNull(users.deletedAt)));
    return {
        recipients: rows.map((row) => ({
            id: row.id,
            email: row.email,
            name: row.firstName ?? row.displayName ?? '',
            settings: row.settings
        }))
    };
}
