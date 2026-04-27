import { and, eq, gte, isNull, lte } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { conversationAccessTokens } from '../../schemas/conversation/conversation_access_tokens.dbschema.ts';
import type {
    InsertConversationAccessToken,
    SelectConversationAccessToken
} from '../../schemas/conversation/conversation_access_tokens.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * AccessTokenModel provides data-access methods for the
 * `conversation_access_tokens` table.
 *
 * This table is APPEND-ONLY: rows are inserted at token creation and then only
 * nullable columns (`revoked_at`, `day15_reminder_sent_at`,
 * `day25_reminder_sent_at`) are updated post-insert. There is no `updated_at`
 * column on this table by design.
 *
 * The raw token is never stored — only its SHA-256 hex hash (`token_hash`).
 *
 * @example
 * ```ts
 * const token = await accessTokenModel.findByTokenHash('sha256hexhash');
 * await accessTokenModel.revokeAll('conv-uuid', tx);
 * ```
 */
export class AccessTokenModel extends BaseModelImpl<SelectConversationAccessToken> {
    protected table = conversationAccessTokens;
    public entityName = 'conversationAccessTokens';

    protected getTableName(): string {
        return 'conversationAccessTokens';
    }

    /**
     * Look up an access token by its SHA-256 hex hash. This is the primary
     * lookup path for guest authentication.
     *
     * Returns only non-revoked, non-expired tokens. The caller is responsible
     * for additional business-rule checks (e.g. matching conversation ID).
     *
     * @param tokenHash - SHA-256 hex string (64 characters) of the raw token
     * @param tx - Optional transaction client
     * @returns Token row or null if not found / revoked / expired
     */
    async findByTokenHash(
        tokenHash: string,
        tx?: DrizzleClient
    ): Promise<SelectConversationAccessToken | null> {
        const db = this.getClient(tx);
        const ctx = { tokenHash };
        try {
            const now = new Date();
            const [row] = await db
                .select()
                .from(conversationAccessTokens)
                .where(
                    and(
                        eq(conversationAccessTokens.tokenHash, tokenHash),
                        isNull(conversationAccessTokens.revokedAt),
                        gte(conversationAccessTokens.expiresAt, now)
                    )
                )
                .limit(1);

            logQuery(this.entityName, 'findByTokenHash', ctx, row ?? null);
            return row ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findByTokenHash', ctx, err);
            throw new DbError(this.entityName, 'findByTokenHash', ctx, err.message);
        }
    }

    /**
     * Fetch all tokens (active and revoked) for a given conversation. Used by
     * the admin panel to audit token history.
     *
     * @param conversationId - UUID of the conversation
     * @param tx - Optional transaction client
     * @returns All token rows associated with the conversation
     */
    async findByConversationId(
        conversationId: string,
        tx?: DrizzleClient
    ): Promise<SelectConversationAccessToken[]> {
        const db = this.getClient(tx);
        const ctx = { conversationId };
        try {
            const rows = await db
                .select()
                .from(conversationAccessTokens)
                .where(eq(conversationAccessTokens.conversationId, conversationId));

            logQuery(this.entityName, 'findByConversationId', ctx, { count: rows.length });
            return rows;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findByConversationId', ctx, err);
            throw new DbError(this.entityName, 'findByConversationId', ctx, err.message);
        }
    }

    /**
     * Revoke all currently active (non-revoked) tokens for a conversation by
     * setting `revoked_at = now()`. Called when a conversation is soft-deleted
     * or explicitly closed by the admin.
     *
     * @param conversationId - UUID of the conversation whose tokens should be revoked
     * @param tx - Required transaction client — revocation must be atomic with the
     *   parent operation
     * @returns Number of rows updated
     */
    async revokeAll(conversationId: string, tx: DrizzleClient): Promise<number> {
        const ctx = { conversationId };
        const db = this.getClient(tx);
        try {
            const now = new Date();
            const result = await db
                .update(conversationAccessTokens)
                .set({ revokedAt: now })
                .where(
                    and(
                        eq(conversationAccessTokens.conversationId, conversationId),
                        isNull(conversationAccessTokens.revokedAt)
                    )
                )
                .returning({ id: conversationAccessTokens.id });

            logQuery(this.entityName, 'revokeAll', ctx, { updated: result.length });
            return result.length;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'revokeAll', ctx, err);
            throw new DbError(this.entityName, 'revokeAll', ctx, err.message);
        }
    }

    /**
     * Find tokens whose `expires_at` falls within a given time window AND whose
     * reminder flag has not yet been set. Used by the cron job to dispatch
     * expiry reminder emails at day-15 and day-25 marks.
     *
     * @param windowStart - Lower bound of the expiry window (inclusive)
     * @param windowEnd - Upper bound of the expiry window (inclusive)
     * @param reminderType - `'day15'` or `'day25'` — selects the corresponding
     *   `*_reminder_sent_at IS NULL` filter
     * @param tx - Optional transaction client
     * @returns Token rows due for a reminder dispatch
     */
    async findDueReminders(
        windowStart: Date,
        windowEnd: Date,
        reminderType: 'day15' | 'day25',
        tx?: DrizzleClient
    ): Promise<SelectConversationAccessToken[]> {
        const db = this.getClient(tx);
        const ctx = { windowStart, windowEnd, reminderType };
        try {
            const reminderFilter =
                reminderType === 'day15'
                    ? isNull(conversationAccessTokens.day15ReminderSentAt)
                    : isNull(conversationAccessTokens.day25ReminderSentAt);

            const rows = await db
                .select()
                .from(conversationAccessTokens)
                .where(
                    and(
                        gte(conversationAccessTokens.expiresAt, windowStart),
                        lte(conversationAccessTokens.expiresAt, windowEnd),
                        isNull(conversationAccessTokens.revokedAt),
                        reminderFilter
                    )
                );

            logQuery(this.entityName, 'findDueReminders', ctx, { count: rows.length });
            return rows;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findDueReminders', ctx, err);
            throw new DbError(this.entityName, 'findDueReminders', ctx, err.message);
        }
    }
}

/** Singleton instance of AccessTokenModel for use across the application. */
export const accessTokenModel = new AccessTokenModel();

export type { InsertConversationAccessToken, SelectConversationAccessToken };
