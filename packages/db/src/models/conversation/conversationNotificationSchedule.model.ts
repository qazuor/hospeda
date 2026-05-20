import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { conversationNotificationSchedules } from '../../schemas/conversation/conversation_notification_schedules.dbschema.ts';
import type {
    InsertConversationNotificationSchedule,
    SelectConversationNotificationSchedule
} from '../../schemas/conversation/conversation_notification_schedules.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * NotificationScheduleModel provides data-access methods for the
 * `conversation_notification_schedules` table.
 *
 * The table enforces at most one active (non-cancelled) schedule per
 * `(conversation_id, recipient_side)` pair via a partial unique index defined
 * in `0015_conversation_partial_indexes.sql`. The `upsertSchedule` method
 * respects that constraint by issuing an `INSERT … ON CONFLICT DO UPDATE`.
 *
 * @example
 * ```ts
 * const due = await notificationScheduleModel.findDue(new Date());
 * await notificationScheduleModel.cancelForConversation('conv-uuid', tx);
 * ```
 */
export class NotificationScheduleModel extends BaseModelImpl<SelectConversationNotificationSchedule> {
    protected table = conversationNotificationSchedules;
    public entityName = 'conversationNotificationSchedules';

    protected getTableName(): string {
        return 'conversationNotificationSchedules';
    }

    /**
     * Find all notification schedules that are due for dispatch.
     *
     * A schedule is due when:
     * - `pending_notification_at <= now`
     * - `cancelled_at IS NULL` (not yet cancelled)
     * - `sent_at IS NULL` (cron has not yet dispatched it)
     *
     * Note: the `conversation_notification_schedules` table has no `sent_at`
     * column — the cron job deletes or cancels rows after dispatch. The filter
     * here covers rows that are active and past their scheduled time.
     *
     * @param now - Reference timestamp (typically `new Date()`)
     * @param tx - Optional transaction client
     * @returns Schedules ready for email dispatch
     */
    async findDue(
        now: Date,
        tx?: DrizzleClient
    ): Promise<SelectConversationNotificationSchedule[]> {
        const db = this.getClient(tx);
        const ctx = { now };
        try {
            const rows = await db
                .select()
                .from(conversationNotificationSchedules)
                .where(
                    and(
                        lte(conversationNotificationSchedules.pendingNotificationAt, now),
                        isNull(conversationNotificationSchedules.cancelledAt)
                    )
                );

            logQuery(this.entityName, 'findDue', ctx, { count: rows.length });
            return rows;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findDue', ctx, err);
            throw new DbError(this.entityName, 'findDue', ctx, err.message);
        }
    }

    /**
     * Find the active (non-cancelled) schedule for a specific conversation and
     * recipient side. At most one row is returned due to the partial unique index.
     *
     * @param conversationId - UUID of the conversation
     * @param recipientSide - `'GUEST'` or `'OWNER'`
     * @param tx - Optional transaction client
     * @returns Active schedule or null if none exists
     */
    async findActive(
        conversationId: string,
        recipientSide: typeof conversationNotificationSchedules.recipientSide._.data,
        tx?: DrizzleClient
    ): Promise<SelectConversationNotificationSchedule | null> {
        const db = this.getClient(tx);
        const ctx = { conversationId, recipientSide };
        try {
            const [row] = await db
                .select()
                .from(conversationNotificationSchedules)
                .where(
                    and(
                        eq(conversationNotificationSchedules.conversationId, conversationId),
                        eq(conversationNotificationSchedules.recipientSide, recipientSide),
                        isNull(conversationNotificationSchedules.cancelledAt)
                    )
                )
                .limit(1);

            logQuery(this.entityName, 'findActive', ctx, row ?? null);
            return row ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findActive', ctx, err);
            throw new DbError(this.entityName, 'findActive', ctx, err.message);
        }
    }

    /**
     * Insert or update the active notification schedule for a
     * `(conversation_id, recipient_side)` pair.
     *
     * Uses `INSERT … ON CONFLICT (conversation_id, recipient_side) WHERE
     * cancelled_at IS NULL DO UPDATE SET pending_notification_at = EXCLUDED.pending_notification_at`
     * to honour the partial unique index defined in
     * `0015_conversation_partial_indexes.sql`.
     *
     * When there is no existing active row, a new one is inserted with
     * `streak_count = 1` and `streak_started_at = now`. When an active row
     * exists, only `pending_notification_at` is updated — streak tracking is
     * handled by the cron job after dispatch.
     *
     * @param conversationId - UUID of the conversation
     * @param recipientSide - `'GUEST'` or `'OWNER'`
     * @param scheduledAt - When the notification email should be dispatched
     * @param tx - Required transaction client — upsert should be atomic with the
     *   message insert that triggers it
     * @returns The upserted row
     */
    async upsertSchedule(
        conversationId: string,
        recipientSide: typeof conversationNotificationSchedules.recipientSide._.data,
        scheduledAt: Date,
        tx: DrizzleClient
    ): Promise<SelectConversationNotificationSchedule> {
        const ctx = { conversationId, recipientSide, scheduledAt };
        const db = this.getClient(tx);
        try {
            const now = new Date();
            // The unique index on (conversation_id, recipient_side) is PARTIAL
            // (`WHERE cancelled_at IS NULL`), and Drizzle's onConflictDoUpdate
            // emits an `ON CONFLICT (cols) DO UPDATE` without the matching
            // WHERE predicate, which Postgres rejects with:
            //   "there is no unique or exclusion constraint matching the
            //    ON CONFLICT specification".
            // Fall back to a raw upsert that includes the partial-index
            // predicate so the upsert resolves to the right index.
            const rows = await db.execute<SelectConversationNotificationSchedule>(sql`
                INSERT INTO conversation_notification_schedules
                    (conversation_id, recipient_side, pending_notification_at,
                     streak_count, streak_started_at, created_at, updated_at)
                VALUES
                    (${conversationId}, ${recipientSide}, ${scheduledAt},
                     1, ${now}, ${now}, ${now})
                ON CONFLICT (conversation_id, recipient_side)
                    WHERE cancelled_at IS NULL
                    DO UPDATE SET
                        pending_notification_at = EXCLUDED.pending_notification_at,
                        updated_at = ${now}
                RETURNING
                    id,
                    conversation_id AS "conversationId",
                    recipient_side AS "recipientSide",
                    pending_notification_at AS "pendingNotificationAt",
                    streak_count AS "streakCount",
                    streak_started_at AS "streakStartedAt",
                    cancelled_at AS "cancelledAt",
                    created_at AS "createdAt",
                    updated_at AS "updatedAt"
            `);

            const row =
                (rows as unknown as { rows?: SelectConversationNotificationSchedule[] })
                    .rows?.[0] ?? (rows as unknown as SelectConversationNotificationSchedule[])[0];

            if (!row) {
                throw new Error('upsertSchedule returned no row');
            }

            logQuery(this.entityName, 'upsertSchedule', ctx, row);
            return row;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'upsertSchedule', ctx, err);
            throw new DbError(this.entityName, 'upsertSchedule', ctx, err.message);
        }
    }

    /**
     * Cancel all active notification schedules for a conversation. Used when the
     * conversation is soft-deleted, blocked, or otherwise becomes inactive.
     *
     * @param conversationId - UUID of the conversation
     * @param tx - Required transaction client
     * @returns Number of rows cancelled
     */
    async cancelForConversation(conversationId: string, tx: DrizzleClient): Promise<number> {
        const ctx = { conversationId };
        const db = this.getClient(tx);
        try {
            const now = new Date();
            const result = await db
                .update(conversationNotificationSchedules)
                .set({ cancelledAt: now, updatedAt: now })
                .where(
                    and(
                        eq(conversationNotificationSchedules.conversationId, conversationId),
                        isNull(conversationNotificationSchedules.cancelledAt)
                    )
                )
                .returning({ id: conversationNotificationSchedules.id });

            logQuery(this.entityName, 'cancelForConversation', ctx, { updated: result.length });
            return result.length;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'cancelForConversation', ctx, err);
            throw new DbError(this.entityName, 'cancelForConversation', ctx, err.message);
        }
    }

    /**
     * Cancel the active notification schedule for a specific recipient side of a
     * conversation. Used when that side reads or replies (clearing their unread
     * streak) while the other side's schedule should remain active.
     *
     * @param conversationId - UUID of the conversation
     * @param recipientSide - `'GUEST'` or `'OWNER'` — only this side's schedule is cancelled
     * @param tx - Required transaction client
     * @returns Number of rows cancelled (0 or 1)
     */
    async cancelForSide(
        conversationId: string,
        recipientSide: typeof conversationNotificationSchedules.recipientSide._.data,
        tx: DrizzleClient
    ): Promise<number> {
        const ctx = { conversationId, recipientSide };
        const db = this.getClient(tx);
        try {
            const now = new Date();
            const result = await db
                .update(conversationNotificationSchedules)
                .set({ cancelledAt: now, updatedAt: now })
                .where(
                    and(
                        eq(conversationNotificationSchedules.conversationId, conversationId),
                        eq(conversationNotificationSchedules.recipientSide, recipientSide),
                        isNull(conversationNotificationSchedules.cancelledAt)
                    )
                )
                .returning({ id: conversationNotificationSchedules.id });

            logQuery(this.entityName, 'cancelForSide', ctx, { updated: result.length });
            return result.length;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'cancelForSide', ctx, err);
            throw new DbError(this.entityName, 'cancelForSide', ctx, err.message);
        }
    }
}

/** Singleton instance of NotificationScheduleModel for use across the application. */
export const notificationScheduleModel = new NotificationScheduleModel();

export type { InsertConversationNotificationSchedule, SelectConversationNotificationSchedule };
