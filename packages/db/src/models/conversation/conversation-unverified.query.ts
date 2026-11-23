import { and, eq, lt } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { conversations } from '../../schemas/conversation/conversations.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/** Entity name used in logs and errors, the same as `ConversationModel.entityName`. */
const ENTITY_NAME = 'conversations';

/**
 * Hard-deletes the anonymous conversations still in `PENDING_VERIFICATION` that
 * were created before `cutoff` (HOS-2571).
 *
 * These rows hold unverified personal data (name, email, phone and the held
 * `pending_message`), so the delete is physical. Only `PENDING_VERIFICATION`
 * rows match: verified conversations (`PENDING_OWNER` onward) are never touched.
 * Soft-deleted rows are included on purpose, since a soft delete keeps the data.
 * Dependent rows (`messages`, `conversation_access_tokens`,
 * `conversation_notification_schedules`) go with the conversation through their
 * `ON DELETE CASCADE` foreign keys.
 *
 * @param input - `{ cutoff, tx? }`: rows with `createdAt < cutoff` are deleted.
 * @returns The number of conversations deleted.
 * @throws DbError when the statement fails.
 */
export async function hardDeleteUnverifiedBeforeQuery(input: {
    readonly cutoff: Date;
    readonly tx?: DrizzleClient;
}): Promise<{ readonly deleted: number }> {
    const db = input.tx ?? getDb();
    const ctx = { cutoff: input.cutoff };

    try {
        const rows = await db
            .delete(conversations)
            .where(
                and(
                    eq(conversations.status, 'PENDING_VERIFICATION' as const),
                    lt(conversations.createdAt, input.cutoff)
                )
            )
            .returning({ id: conversations.id });

        logQuery(ENTITY_NAME, 'hardDeleteUnverifiedBefore', ctx, { deleted: rows.length });
        return { deleted: rows.length };
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logError(ENTITY_NAME, 'hardDeleteUnverifiedBefore', ctx, err);
        throw new DbError(ENTITY_NAME, 'hardDeleteUnverifiedBefore', ctx, err.message);
    }
}
