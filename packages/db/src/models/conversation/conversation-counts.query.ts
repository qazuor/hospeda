import { and, count, gte, inArray, isNull, ne } from 'drizzle-orm';
import { conversations } from '../../schemas/conversation/conversations.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/** Entity name used in logs and errors, the same as `ConversationModel.entityName`. */
const ENTITY_NAME = 'conversations';

/**
 * Counts the conversations (inquiries) started on any of the given
 * accommodations at or after `since`. Soft-deleted conversations are excluded,
 * as in `getMonthlyInquiriesByOwnerId`, and so are unverified anonymous
 * inquiries (`PENDING_VERIFICATION`, HOS-2615). Backs `ConversationModel.countCreatedSince`.
 *
 * @param input - `{ db, ids, since }`: client, accommodation
 *   ids (may be empty) and the inclusive lower bound on `createdAt`.
 * @returns The number of conversations (0 when `ids` is empty).
 * @throws DbError when the query fails.
 */
export async function countCreatedSinceQuery(input: {
    readonly db: DrizzleClient;
    readonly ids: readonly string[];
    readonly since: Date;
}): Promise<number> {
    const { db, ids, since } = input;
    if (ids.length === 0) {
        return 0;
    }

    const ctx = { ownerAccommodationIds: ids, since };

    try {
        const [row] = await db
            .select({ total: count(conversations.id) })
            .from(conversations)
            .where(
                and(
                    inArray(conversations.accommodationId, ids as string[]),
                    isNull(conversations.deletedAt),
                    ne(conversations.status, 'PENDING_VERIFICATION' as const),
                    gte(conversations.createdAt, since)
                )
            );

        logQuery(ENTITY_NAME, 'countCreatedSince', ctx, { total: row?.total ?? 0 });

        return Number(row?.total ?? 0);
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logError(ENTITY_NAME, 'countCreatedSince', ctx, err);
        throw new DbError(ENTITY_NAME, 'countCreatedSince', ctx, err.message);
    }
}
