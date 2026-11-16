import { and, eq, inArray, isNull } from 'drizzle-orm';
import { accommodations } from '../../schemas/accommodation/accommodation.dbschema.ts';
import type { SelectConversation } from '../../schemas/conversation/conversations.dbschema.ts';
import { conversations } from '../../schemas/conversation/conversations.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/**
 * Looks up one conversation that belongs to an accommodation owned by `ownerId`.
 * Soft-deleted conversations and conversations of soft-deleted accommodations are
 * excluded, as in the other conversation reads.
 *
 * @param input - `{ db, conversationId, ownerId }`.
 * @returns The conversation row, or `null` when it does not exist or is not the owner's.
 */
export async function findOwnedConversationById(input: {
    readonly db: DrizzleClient;
    readonly conversationId: string;
    readonly ownerId: string;
}): Promise<SelectConversation | null> {
    const { db, conversationId, ownerId } = input;
    const rows = await db
        .select()
        .from(conversations)
        .where(
            and(
                eq(conversations.id, conversationId),
                isNull(conversations.deletedAt),
                inArray(
                    conversations.accommodationId,
                    db
                        .select({ id: accommodations.id })
                        .from(accommodations)
                        .where(
                            and(
                                eq(accommodations.ownerId, ownerId),
                                isNull(accommodations.deletedAt)
                            )
                        )
                )
            )
        )
        .limit(1);
    return rows[0] ?? null;
}
