import type { HostConversationResponseRate } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { conversations } from '../../schemas/conversation/conversations.dbschema.ts';
import type {
    InsertConversation,
    SelectConversation
} from '../../schemas/conversation/conversations.dbschema.ts';
import { users } from '../../schemas/user/user.dbschema.ts';
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
                // Match anonymous guests by name OR registered guests by their
                // user display name / first name / last name (via left join).
                conditions.push(
                    or(
                        safeIlike(conversations.anonymousName, search),
                        safeIlike(users.displayName, search),
                        safeIlike(users.firstName, search),
                        safeIlike(users.lastName, search)
                    ) as SQL<unknown>
                );
            }

            const where = and(...conditions);
            const offset = (page - 1) * pageSize;

            // Left-join users so registered-guest name search works. The join
            // is cheap: conversations.user_id is indexed and the result set is
            // already scoped to a small number of accommodation IDs.
            const [items, [countRow]] = await Promise.all([
                db
                    .select({ conversation: conversations })
                    .from(conversations)
                    .leftJoin(users, eq(users.id, conversations.userId))
                    .where(where)
                    .orderBy(desc(conversations.lastActivityAt))
                    .limit(pageSize)
                    .offset(offset),
                db
                    .select({ total: count() })
                    .from(conversations)
                    .leftJoin(users, eq(users.id, conversations.userId))
                    .where(where)
            ]);

            // Unwrap the nested conversation object produced by the left-join
            // select shape so callers receive plain SelectConversation rows.
            const unwrapped = items.map((row) => row.conversation);
            const total = Number(countRow?.total ?? 0);
            logQuery(this.entityName, 'listByAccommodationIds', ctx, {
                count: unwrapped.length,
                total
            });
            return { items: unwrapped, total };
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

    /**
     * Returns conversation response-rate KPIs for a specific accommodation owner.
     *
     * Scoped strictly to conversations whose `accommodationId` is in
     * `ownerAccommodationIds`.  When the owner has no accommodation IDs the
     * method short-circuits and returns zeroes without hitting the DB.
     *
     * Two aggregations are computed in a single round-trip:
     *  1. `responseRatePct` — percentage of non-deleted conversations that have
     *     at least one owner reply (`ownerMessageCount > 0`), rounded to one
     *     decimal place.
     *  2. `avgResponseTimeMinutes` — average of
     *     `(firstOwnerReplyAt - firstGuestMessageAt)` in minutes, across all
     *     non-deleted conversations that have both timestamps. Null when no
     *     conversations have been replied to.
     *
     * @param ownerAccommodationIds - Accommodation IDs belonging to the host.
     * @param tx - Optional Drizzle transaction client.
     * @returns Aggregated KPIs shaped as {@link HostConversationResponseRate}.
     */
    async getResponseRateByOwnerId(
        ownerAccommodationIds: readonly string[],
        tx?: DrizzleClient
    ): Promise<HostConversationResponseRate> {
        if (ownerAccommodationIds.length === 0) {
            return { responseRatePct: 0, avgResponseTimeMinutes: null };
        }

        const db = this.getClient(tx);
        const ctx = { ownerAccommodationIds };

        try {
            const baseWhere = and(
                inArray(conversations.accommodationId, ownerAccommodationIds as string[]),
                isNull(conversations.deletedAt)
            );

            // Run both aggregations in a single Promise.all to minimise
            // round-trips.
            const [countRows, avgRows] = await Promise.all([
                // ---- responseRatePct aggregation --------------------------------
                // Count total conversations vs conversations with at least one
                // owner reply (ownerMessageCount > 0).
                db
                    .select({
                        total: count(conversations.id),
                        replied: sql<number>`
                            COUNT(CASE WHEN ${conversations.ownerMessageCount} > 0 THEN 1 END)
                        `.mapWith(Number)
                    })
                    .from(conversations)
                    .where(baseWhere),

                // ---- avgResponseTimeMinutes aggregation ----------------------
                // Average minutes between first guest message and first owner
                // reply, only for conversations that have both timestamps.
                db
                    .select({
                        avgMinutes: sql<string | null>`
                            AVG(
                                EXTRACT(EPOCH FROM (
                                    ${conversations.firstOwnerReplyAt} - ${conversations.firstGuestMessageAt}
                                )) / 60.0
                            )
                        `
                    })
                    .from(conversations)
                    .where(
                        and(
                            baseWhere,
                            isNotNull(conversations.firstGuestMessageAt),
                            isNotNull(conversations.firstOwnerReplyAt)
                        )
                    )
            ]);

            const row = countRows[0];
            const total = row ? Number(row.total) : 0;
            const replied = row ? Number(row.replied) : 0;

            const responseRatePct = total === 0 ? 0 : Math.round((replied / total) * 1000) / 10;

            const rawAvg = avgRows[0]?.avgMinutes;
            const avgResponseTimeMinutes =
                rawAvg !== null && rawAvg !== undefined ? Math.round(Number(rawAvg)) : null;

            logQuery(this.entityName, 'getResponseRateByOwnerId', ctx, {
                total,
                replied,
                responseRatePct,
                avgResponseTimeMinutes
            });

            return { responseRatePct, avgResponseTimeMinutes };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'getResponseRateByOwnerId', ctx, err);
            throw new DbError(this.entityName, 'getResponseRateByOwnerId', ctx, err.message);
        }
    }

    /**
     * Monthly inquiry counts for the host's own accommodations.
     *
     * Buckets conversations by their `createdAt` truncated to month and
     * returns `{ month, count }` rows for the requested window. Months
     * with zero conversations are NOT emitted by the SQL — the caller
     * fills the gaps so the chart always has a continuous series.
     *
     * Returns an empty array immediately when the host has no own
     * accommodations.
     *
     * @param ownerAccommodationIds - Accommodation IDs belonging to the host.
     * @param months - How many months back to include (inclusive, defaults to 6).
     * @param tx - Optional Drizzle transaction client.
     */
    async getMonthlyInquiriesByOwnerId(
        ownerAccommodationIds: readonly string[],
        months: number,
        tx?: DrizzleClient
    ): Promise<ReadonlyArray<{ readonly month: string; readonly count: number }>> {
        if (ownerAccommodationIds.length === 0) {
            return [];
        }

        const db = this.getClient(tx);
        const ctx = { ownerAccommodationIds, months };

        try {
            const since = new Date();
            since.setUTCDate(1);
            since.setUTCHours(0, 0, 0, 0);
            since.setUTCMonth(since.getUTCMonth() - (months - 1));

            const rows = await db
                .select({
                    month: sql<string>`to_char(date_trunc('month', ${conversations.createdAt}), 'YYYY-MM')`,
                    count: count(conversations.id)
                })
                .from(conversations)
                .where(
                    and(
                        inArray(conversations.accommodationId, ownerAccommodationIds as string[]),
                        isNull(conversations.deletedAt),
                        gte(conversations.createdAt, since)
                    )
                )
                .groupBy(sql`date_trunc('month', ${conversations.createdAt})`)
                .orderBy(sql`date_trunc('month', ${conversations.createdAt}) ASC`);

            logQuery(this.entityName, 'getMonthlyInquiriesByOwnerId', ctx, { rows: rows.length });

            return rows.map((r) => ({ month: r.month, count: Number(r.count) }));
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'getMonthlyInquiriesByOwnerId', ctx, err);
            throw new DbError(this.entityName, 'getMonthlyInquiriesByOwnerId', ctx, err.message);
        }
    }
}

/** Singleton instance of ConversationModel for use across the application. */
export const conversationModel = new ConversationModel();

export type { InsertConversation, SelectConversation };
