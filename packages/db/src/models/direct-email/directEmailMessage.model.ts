import type { DirectEmailMessage, DirectEmailMessageListItem } from '@repo/schemas';
import { count, desc, eq, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { directEmailMessages } from '../../schemas/direct-email/direct_email_message.dbschema.ts';
import { directEmailRecipients } from '../../schemas/direct-email/direct_email_recipient.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { safeIlike } from '../../utils/drizzle-helpers.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/** Input of {@link DirectEmailMessageModel.findPageWithRecipientCount}. */
export interface DirectEmailMessagePageInput {
    readonly page: number;
    readonly pageSize: number;
    /** Case-insensitive text matched against the subject. */
    readonly search?: string;
}

/**
 * Model for `direct_email_message` (HOS-2685). Messages are an append-only
 * history: nothing soft-deletes them.
 */
export class DirectEmailMessageModel extends BaseModelImpl<DirectEmailMessage> {
    protected table = directEmailMessages;
    public entityName = 'directEmailMessages';

    protected getTableName(): string {
        return 'directEmailMessages';
    }

    /**
     * One page of the history, newest first, each row with its recipient count.
     *
     * @param input - Page, page size and optional subject search
     * @param tx - Optional transaction client
     * @returns The page and the total of matching messages
     */
    async findPageWithRecipientCount(
        input: DirectEmailMessagePageInput,
        tx?: DrizzleClient
    ): Promise<{ items: DirectEmailMessageListItem[]; total: number }> {
        const db = this.getClient(tx);
        const logContext = { ...input };
        try {
            const where = input.search
                ? safeIlike(directEmailMessages.subject, input.search)
                : undefined;
            const [rows, totals] = await Promise.all([
                db
                    .select({
                        message: directEmailMessages,
                        recipientCount: sql<number>`(
                            select count(*)::int from ${directEmailRecipients}
                            where ${directEmailRecipients.messageId} = ${directEmailMessages.id}
                        )`
                    })
                    .from(directEmailMessages)
                    .where(where)
                    .orderBy(desc(directEmailMessages.createdAt))
                    .limit(input.pageSize)
                    .offset((input.page - 1) * input.pageSize),
                db.select({ total: count() }).from(directEmailMessages).where(where)
            ]);
            const items = rows.map((row) => ({
                ...row.message,
                recipientCount: row.recipientCount
                // DRIZZLE-LIMITATION: select() rows carry the unknown-typed jsonb / branded pgEnum columns; cast to the canonical schema type.
            })) as unknown as DirectEmailMessageListItem[];
            const total = totals[0]?.total ?? 0;
            logQuery(this.entityName, 'findPageWithRecipientCount', logContext, { total });
            return { items, total };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findPageWithRecipientCount', logContext, err);
            throw new DbError(
                this.entityName,
                'findPageWithRecipientCount',
                logContext,
                err.message
            );
        }
    }

    /**
     * Reads one message by id.
     *
     * @param id - Message id
     * @param tx - Optional transaction client
     * @returns The message, or `null`
     */
    async findMessageById(id: string, tx?: DrizzleClient): Promise<DirectEmailMessage | null> {
        const db = this.getClient(tx);
        const rows = await db
            .select()
            .from(directEmailMessages)
            .where(eq(directEmailMessages.id, id))
            .limit(1);
        // DRIZZLE-LIMITATION: jsonb column is `unknown`; cast back to the canonical schema type.
        return (rows[0] as unknown as DirectEmailMessage) ?? null;
    }

    /**
     * Reads the message a compose session already sent.
     *
     * @param idempotencyKey - Client UUID of the compose session
     * @param tx - Optional transaction client
     * @returns The message, or `null` when that key was never used
     */
    async findByIdempotencyKey(
        idempotencyKey: string,
        tx?: DrizzleClient
    ): Promise<DirectEmailMessage | null> {
        const db = this.getClient(tx);
        const rows = await db
            .select()
            .from(directEmailMessages)
            .where(eq(directEmailMessages.idempotencyKey, idempotencyKey))
            .limit(1);
        // DRIZZLE-LIMITATION: jsonb column is `unknown`; cast back to the canonical schema type.
        return (rows[0] as unknown as DirectEmailMessage) ?? null;
    }
}
