import { type DrizzleClient, emailOutbox, eq, getDb, users } from '@repo/db';
import { z } from 'zod';

const inputSchema = z.strictObject({
    tx: z.custom<DrizzleClient>((value) => value !== undefined && value !== null).optional(),
    dedupKey: z.string().min(1)
});

/** State of the third migration notice as seen by `S37` (DEC-MAIL-001). */
export type PlanMigrationS37NoticeState = 'SENT' | 'PENDING' | 'UNDELIVERABLE' | 'ABSENT';

/**
 * Reads the third migration email's state by its stable outbox key.
 *
 * It is the model of `beforeCancelNoticeStatus`, with the migration's own key
 * (`planMigrationNoticeDedupKey`): `sent` means the mail left; `failed` is a
 * definitive failure; a transient state still blocks. A recipient that no
 * longer exists — `users.deleted_at` set, or the reference already `NULL` after
 * a hard delete — is undeliverable too (DEC-MAIL-001 📌1, `B/03` §1.1).
 *
 * @param input.tx - Optional transaction; the shared pool is used otherwise
 * @param input.dedupKey - The outbox key of the third notice
 * @returns The notice state, never the mail body
 */
export async function readS37NoticeState(input: {
    readonly tx?: DrizzleClient;
    readonly dedupKey: string;
}): Promise<PlanMigrationS37NoticeState> {
    const parsed = inputSchema.parse(input);
    const db = parsed.tx ?? getDb();
    const [row] = await db
        .select({
            status: emailOutbox.status,
            recipientUserId: emailOutbox.recipientUserId,
            deletedAt: users.deletedAt
        })
        .from(emailOutbox)
        .leftJoin(users, eq(users.id, emailOutbox.recipientUserId))
        .where(eq(emailOutbox.dedupKey, parsed.dedupKey))
        .limit(1);
    if (!row) return 'ABSENT';
    if (row.status === 'failed') return 'UNDELIVERABLE';
    if (row.recipientUserId === null || row.deletedAt !== null) return 'UNDELIVERABLE';
    if (row.status === 'sent') return 'SENT';
    return 'PENDING';
}
