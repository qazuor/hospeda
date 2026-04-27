import type { SQL } from 'drizzle-orm';
import { and, count, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { messages } from '../../schemas/conversation/messages.dbschema.ts';
import type { InsertMessage, SelectMessage } from '../../schemas/conversation/messages.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Maximum number of messages returned per cursor-based page.
 * Hard-capped to prevent oversized payloads on infinite-scroll lists.
 */
const MAX_MESSAGE_LIMIT = 100;

/**
 * Default message fetch limit when the caller does not specify one.
 */
const DEFAULT_MESSAGE_LIMIT = 50;

/**
 * MessageModel provides data-access methods for the `messages` table.
 *
 * Messages are fetched with cursor-based pagination (keyed on `created_at`)
 * to support infinite-scroll UIs. Unread aggregates are provided for badge
 * counts on owner and guest inboxes.
 *
 * @example
 * ```ts
 * const page = await messageModel.findByConversationId('conv-uuid', { limit: 50 });
 * const unread = await messageModel.sumUnreadForOwner(['acc-uuid-1', 'acc-uuid-2']);
 * ```
 */
export class MessageModel extends BaseModelImpl<SelectMessage> {
    protected table = messages;
    public entityName = 'messages';

    protected getTableName(): string {
        return 'messages';
    }

    /**
     * Fetch messages for a conversation thread using cursor-based pagination.
     *
     * Results are sorted by `created_at ASC` so the oldest message appears first
     * (standard chat layout). When `cursor` is provided only messages created
     * **before** that timestamp are returned, enabling backward scroll.
     *
     * @param conversationId - UUID of the parent conversation
     * @param options.cursor - ISO timestamp cursor; fetch messages older than this
     * @param options.limit - Maximum rows to return (default 50, max 100)
     * @param tx - Optional transaction client
     * @returns Array of message rows
     */
    async findByConversationId(
        conversationId: string,
        options: { cursor?: Date; limit?: number } = {},
        tx?: DrizzleClient
    ): Promise<SelectMessage[]> {
        const db = this.getClient(tx);
        const safeLimit = Math.min(options.limit ?? DEFAULT_MESSAGE_LIMIT, MAX_MESSAGE_LIMIT);
        const ctx = { conversationId, cursor: options.cursor, limit: safeLimit };

        try {
            const conditions: SQL<unknown>[] = [
                eq(messages.conversationId, conversationId),
                isNull(messages.deletedAt)
            ];
            if (options.cursor) {
                conditions.push(lt(messages.createdAt, options.cursor));
            }

            const rows = await db
                .select()
                .from(messages)
                .where(and(...conditions))
                .orderBy(messages.createdAt)
                .limit(safeLimit);

            logQuery(this.entityName, 'findByConversationId', ctx, { count: rows.length });
            return rows;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findByConversationId', ctx, err);
            throw new DbError(this.entityName, 'findByConversationId', ctx, err.message);
        }
    }

    /**
     * Count unread messages for a given conversation and sender type since a
     * specific timestamp. Used to populate read-receipt badges.
     *
     * A message is considered unread when its `created_at` is after
     * `sinceTimestamp` and it was sent by the specified `senderType`.
     *
     * @param conversationId - UUID of the conversation
     * @param senderType - The side whose messages should be counted (GUEST | OWNER | SYSTEM)
     * @param sinceTimestamp - Count messages created after this time
     * @param tx - Optional transaction client
     * @returns Number of unread messages
     */
    async countUnread(
        conversationId: string,
        senderType: typeof messages.senderType._.data,
        sinceTimestamp: Date,
        tx?: DrizzleClient
    ): Promise<number> {
        const db = this.getClient(tx);
        const ctx = { conversationId, senderType, sinceTimestamp };

        try {
            const [row] = await db
                .select({ total: count() })
                .from(messages)
                .where(
                    and(
                        eq(messages.conversationId, conversationId),
                        eq(messages.senderType, senderType),
                        gt(messages.createdAt, sinceTimestamp),
                        isNull(messages.deletedAt)
                    )
                );

            const total = Number(row?.total ?? 0);
            logQuery(this.entityName, 'countUnread', ctx, total);
            return total;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'countUnread', ctx, err);
            throw new DbError(this.entityName, 'countUnread', ctx, err.message);
        }
    }

    /**
     * Aggregate unread GUEST messages across all conversations that belong to
     * a set of accommodation IDs. Used to drive the owner sidebar badge showing
     * total pending replies.
     *
     * A GUEST message is unread when it was created after the conversation's
     * `last_read_at_by_owner` timestamp (or `last_read_at_by_owner IS NULL`,
     * meaning the owner never read the thread).
     *
     * @param accommodationIds - UUIDs of accommodations owned by the actor
     * @param tx - Optional transaction client
     * @returns Aggregate unread count across all accommodation conversations
     */
    async sumUnreadForOwner(accommodationIds: string[], tx?: DrizzleClient): Promise<number> {
        if (accommodationIds.length === 0) return 0;

        const db = this.getClient(tx);
        const ctx = { accommodationIds };

        try {
            const [row] = await db
                .select({ total: count() })
                .from(messages)
                .innerJoin(
                    sql`conversations c`,
                    sql`c.id = ${messages.conversationId}
                        AND c.accommodation_id = ANY(ARRAY[${sql.join(
                            accommodationIds.map((id) => sql`${id}::uuid`),
                            sql`, `
                        )}])
                        AND c.deleted_at IS NULL`
                )
                .where(
                    and(
                        eq(messages.senderType, 'GUEST'),
                        isNull(messages.deletedAt),
                        sql`(c.last_read_at_by_owner IS NULL OR ${messages.createdAt} > c.last_read_at_by_owner)`
                    )
                );

            const total = Number(row?.total ?? 0);
            logQuery(this.entityName, 'sumUnreadForOwner', ctx, total);
            return total;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'sumUnreadForOwner', ctx, err);
            throw new DbError(this.entityName, 'sumUnreadForOwner', ctx, err.message);
        }
    }
}

/** Singleton instance of MessageModel for use across the application. */
export const messageModel = new MessageModel();

export type { InsertMessage, SelectMessage };
