import type { SQL } from 'drizzle-orm';
import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { conversations } from '../../schemas/conversation/conversations.dbschema.ts';
import type {
    InsertConversation,
    SelectConversation
} from '../../schemas/conversation/conversations.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { safeIlike } from '../../utils/drizzle-helpers.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * ConversationModel provides data-access methods for the `conversations` table.
 *
 * Conversations represent a 1:1 messaging thread between a guest and an
 * accommodation owner. This model encapsulates all query logic and ensures
 * soft-delete semantics are applied consistently.
 *
 * @example
 * ```ts
 * const conv = await conversationModel.findById('uuid');
 * const inbox = await conversationModel.listByUserId('user-uuid', { page: 1, pageSize: 20 });
 * ```
 */
export class ConversationModel extends BaseModelImpl<SelectConversation> {
    protected table = conversations;
    public entityName = 'conversations';

    protected getTableName(): string {
        return 'conversations';
    }

    /**
     * Find a conversation by its primary key, excluding soft-deleted rows.
     *
     * @param id - UUID of the conversation
     * @param tx - Optional transaction client
     * @returns The conversation row or null if not found / soft-deleted
     */
    async findById(id: string, tx?: DrizzleClient): Promise<SelectConversation | null> {
        const db = this.getClient(tx);
        try {
            const [row] = await db
                .select()
                .from(conversations)
                .where(and(eq(conversations.id, id), isNull(conversations.deletedAt)))
                .limit(1);
            logQuery(this.entityName, 'findById', { id }, row ?? null);
            return row ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findById', { id }, err);
            throw new DbError(this.entityName, 'findById', { id }, err.message);
        }
    }

    /**
     * Find the active (non-soft-deleted) conversation between an authenticated
     * user and a specific accommodation. Used by the deduplication logic to
     * prevent a second conversation being opened when one already exists
     * (AC-002-02).
     *
     * @param userId - UUID of the authenticated user
     * @param accommodationId - UUID of the accommodation
     * @param tx - Optional transaction client
     * @returns Matching conversation or null
     */
    async findByUserIdAndAccommodationId(
        userId: string,
        accommodationId: string,
        tx?: DrizzleClient
    ): Promise<SelectConversation | null> {
        const db = this.getClient(tx);
        const ctx = { userId, accommodationId };
        try {
            const [row] = await db
                .select()
                .from(conversations)
                .where(
                    and(
                        eq(conversations.userId, userId),
                        eq(conversations.accommodationId, accommodationId),
                        isNull(conversations.deletedAt)
                    )
                )
                .limit(1);
            logQuery(this.entityName, 'findByUserIdAndAccommodationId', ctx, row ?? null);
            return row ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findByUserIdAndAccommodationId', ctx, err);
            throw new DbError(this.entityName, 'findByUserIdAndAccommodationId', ctx, err.message);
        }
    }

    /**
     * Find the active conversation initiated by a verified anonymous email for a
     * specific accommodation. Only rows where `anonymous_email_verified = true`
     * are considered, matching the partial unique index defined in
     * `0015_conversation_partial_indexes.sql` (AC-001-03).
     *
     * @param email - Normalised (lowercase) anonymous email address
     * @param accommodationId - UUID of the accommodation
     * @param tx - Optional transaction client
     * @returns Matching conversation or null
     */
    async findByAnonymousEmailAndAccommodationId(
        email: string,
        accommodationId: string,
        tx?: DrizzleClient
    ): Promise<SelectConversation | null> {
        const db = this.getClient(tx);
        const ctx = { email, accommodationId };
        try {
            const [row] = await db
                .select()
                .from(conversations)
                .where(
                    and(
                        eq(conversations.anonymousEmail, email),
                        eq(conversations.accommodationId, accommodationId),
                        eq(conversations.anonymousEmailVerified, true),
                        isNull(conversations.deletedAt)
                    )
                )
                .limit(1);
            logQuery(this.entityName, 'findByAnonymousEmailAndAccommodationId', ctx, row ?? null);
            return row ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findByAnonymousEmailAndAccommodationId', ctx, err);
            throw new DbError(
                this.entityName,
                'findByAnonymousEmailAndAccommodationId',
                ctx,
                err.message
            );
        }
    }

    /**
     * List conversations for an authenticated guest's inbox, sorted by most
     * recent activity first. Supports optional filtering by archived state.
     *
     * @param userId - UUID of the guest user
     * @param options.page - 1-based page number
     * @param options.pageSize - Items per page
     * @param options.archivedByGuest - When provided, filters by the `archived_by_guest` flag
     * @param tx - Optional transaction client
     * @returns Paginated list and total count
     */
    async listByUserId(
        userId: string,
        options: {
            page: number;
            pageSize: number;
            archivedByGuest?: boolean;
            /** Optional accommodation filter — narrows the result set to a single property. */
            accommodationId?: string;
        },
        tx?: DrizzleClient
    ): Promise<{ items: SelectConversation[]; total: number }> {
        const db = this.getClient(tx);
        const { page, pageSize, archivedByGuest, accommodationId } = options;
        const ctx = { userId, ...options };

        try {
            const conditions: SQL<unknown>[] = [
                eq(conversations.userId, userId),
                isNull(conversations.deletedAt)
            ];
            if (archivedByGuest !== undefined) {
                conditions.push(eq(conversations.archivedByGuest, archivedByGuest));
            }
            if (accommodationId) {
                conditions.push(eq(conversations.accommodationId, accommodationId));
            }
            const where = and(...conditions);
            const offset = (page - 1) * pageSize;

            const [items, [countRow]] = await Promise.all([
                db
                    .select()
                    .from(conversations)
                    .where(where)
                    .orderBy(desc(conversations.lastActivityAt))
                    .limit(pageSize)
                    .offset(offset),
                db.select({ total: count() }).from(conversations).where(where)
            ]);

            const total = Number(countRow?.total ?? 0);
            logQuery(this.entityName, 'listByUserId', ctx, { count: items.length, total });
            return { items, total };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'listByUserId', ctx, err);
            throw new DbError(this.entityName, 'listByUserId', ctx, err.message);
        }
    }

    /**
     * List conversations for an owner's inbox by providing one or more
     * accommodation IDs. Supports filtering by conversation status and
     * full-text search on the anonymous guest name / email. Sorted by most
     * recent activity first.
     *
     * @param accommodationIds - List of accommodation UUIDs owned by the actor
     * @param options.page - 1-based page number
     * @param options.pageSize - Items per page
     * @param options.status - Optional conversation status filter
     * @param options.search - Optional search term matched against `anonymous_name` and `anonymous_email`
     * @param tx - Optional transaction client
     * @returns Paginated list and total count
     */
    async listByAccommodationIds(
        accommodationIds: string[],
        options: { page: number; pageSize: number; status?: string; search?: string },
        tx?: DrizzleClient
    ): Promise<{ items: SelectConversation[]; total: number }> {
        const db = this.getClient(tx);
        const { page, pageSize, status, search } = options;
        const ctx = { accommodationIds, ...options };

        try {
            const conditions: SQL<unknown>[] = [
                inArray(conversations.accommodationId, accommodationIds),
                isNull(conversations.deletedAt)
            ];
            if (status) {
                conditions.push(
                    eq(conversations.status, status as typeof conversations.status._.data)
                );
            }
            if (search?.trim()) {
                conditions.push(safeIlike(conversations.anonymousName, search) as SQL<unknown>);
            }

            const where = and(...conditions);
            const offset = (page - 1) * pageSize;

            const [items, [countRow]] = await Promise.all([
                db
                    .select()
                    .from(conversations)
                    .where(where)
                    .orderBy(desc(conversations.lastActivityAt))
                    .limit(pageSize)
                    .offset(offset),
                db.select({ total: count() }).from(conversations).where(where)
            ]);

            const total = Number(countRow?.total ?? 0);
            logQuery(this.entityName, 'listByAccommodationIds', ctx, {
                count: items.length,
                total
            });
            return { items, total };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'listByAccommodationIds', ctx, err);
            throw new DbError(this.entityName, 'listByAccommodationIds', ctx, err.message);
        }
    }

    /**
     * Soft-close all non-deleted conversations for a given accommodation. Used as
     * the cascade trigger point when an accommodation is soft-deleted, preventing
     * orphaned open conversations.
     *
     * Sets `status = 'CLOSED'` and `closed_at = now()` for every active row.
     *
     * @param accommodationId - UUID of the accommodation being removed
     * @param tx - Required transaction client — this operation should always run
     *   inside the accommodation soft-delete transaction
     * @returns Number of rows updated
     */
    async closeAllForAccommodation(accommodationId: string, tx: DrizzleClient): Promise<number> {
        const ctx = { accommodationId };
        const db = this.getClient(tx);
        try {
            const now = new Date();
            const result = await db
                .update(conversations)
                .set({
                    status: 'CLOSED',
                    closedAt: now,
                    updatedAt: now
                })
                .where(
                    and(
                        eq(conversations.accommodationId, accommodationId),
                        isNull(conversations.deletedAt)
                    )
                )
                .returning({ id: conversations.id });

            logQuery(this.entityName, 'closeAllForAccommodation', ctx, { updated: result.length });
            return result.length;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'closeAllForAccommodation', ctx, err);
            throw new DbError(this.entityName, 'closeAllForAccommodation', ctx, err.message);
        }
    }
}

/** Singleton instance of ConversationModel for use across the application. */
export const conversationModel = new ConversationModel();

export type { InsertConversation, SelectConversation };
