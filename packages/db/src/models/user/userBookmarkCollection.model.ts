import type { UserBookmarkCollection } from '@repo/schemas';
import { and, count, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { userBookmarks } from '../../schemas/user/user_bookmark.dbschema.ts';
import { userBookmarkCollections } from '../../schemas/user/user_bookmark_collection.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { safeIlike } from '../../utils/drizzle-helpers.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Pagination options for list queries.
 */
export interface PaginationOptions {
    /** 1-based page number. Defaults to 1. */
    page?: number;
    /** Number of items per page. Defaults to 20, capped at 200. */
    pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;

/**
 * Model for the `user_bookmark_collections` table.
 *
 * Provides standard CRUD operations (via {@link BaseModelImpl}) for named
 * bookmark collections (wishlists) that belong to authenticated users.
 *
 * Soft-delete is handled automatically by `BaseModelImpl` because the
 * underlying table declares a `deletedAt` column.
 *
 * Valid relations (usable with `findWithRelations` / `findOneWithRelations` /
 * `findAllWithRelations`):
 *  - `user`      — the owning {@link users} record
 *  - `bookmarks` — the {@link userBookmarks} rows linked to this collection
 */
export class UserBookmarkCollectionModel extends BaseModelImpl<UserBookmarkCollection> {
    protected table = userBookmarkCollections;
    public entityName = 'userBookmarkCollections';

    protected override readonly validRelationKeys = ['user', 'bookmarks'] as const;

    protected getTableName(): string {
        return 'userBookmarkCollections';
    }

    /**
     * Returns all active (non-deleted) collections owned by the given user,
     * ordered by creation date descending (newest first).
     *
     * @param userId - The owner's user ID.
     * @param options - Optional pagination parameters.
     * @param tx - Optional transaction client.
     * @returns Paginated list of active collections with total count.
     */
    async findActiveByUserId(
        userId: string,
        options?: PaginationOptions,
        tx?: DrizzleClient
    ): Promise<{ items: UserBookmarkCollection[]; total: number }> {
        const db = this.getClient(tx);
        const page = options?.page ?? 1;
        const pageSize = Math.min(options?.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
        const offset = (page - 1) * pageSize;

        const logContext = { userId, page, pageSize };

        try {
            const whereClause = and(
                eq(userBookmarkCollections.userId, userId),
                isNull(userBookmarkCollections.deletedAt)
            );

            const [items, [countResult]] = await Promise.all([
                db
                    .select()
                    .from(userBookmarkCollections)
                    .where(whereClause)
                    .orderBy(desc(userBookmarkCollections.createdAt))
                    .limit(pageSize)
                    .offset(offset),
                db.select({ value: count() }).from(userBookmarkCollections).where(whereClause)
            ]);

            const result = {
                items: items as UserBookmarkCollection[],
                total: Number(countResult?.value ?? 0)
            };

            try {
                logQuery(this.entityName, 'findActiveByUserId', logContext, result);
            } catch {}

            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findActiveByUserId', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findActiveByUserId', logContext, err.message);
        }
    }

    /**
     * Counts the active (non-deleted) collections that belong to the given user.
     *
     * Used by the service-layer limit guard in `_canCreate` to enforce per-user
     * collection quotas before inserting a new row.
     *
     * @param userId - The owner's user ID.
     * @param tx - Optional transaction client.
     * @returns Total number of active collections for the user.
     */
    async countActiveByUserId(userId: string, tx?: DrizzleClient): Promise<number> {
        const db = this.getClient(tx);
        const logContext = { userId };

        try {
            const [result] = await db
                .select({ value: count() })
                .from(userBookmarkCollections)
                .where(
                    and(
                        eq(userBookmarkCollections.userId, userId),
                        isNull(userBookmarkCollections.deletedAt)
                    )
                );

            const total = Number(result?.value ?? 0);

            try {
                logQuery(this.entityName, 'countActiveByUserId', logContext, { total });
            } catch {}

            return total;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'countActiveByUserId', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'countActiveByUserId', logContext, err.message);
        }
    }

    /**
     * Returns a single active collection only if it belongs to the given user.
     *
     * Used to enforce ownership during update and soft-delete operations: a
     * caller cannot mutate a collection they do not own, even if they know its ID.
     *
     * @param id - The collection ID.
     * @param userId - The expected owner's user ID.
     * @param tx - Optional transaction client.
     * @returns The matching active collection, or `null` if not found or not owned by the user.
     */
    async findActiveByIdAndUserId(
        id: string,
        userId: string,
        tx?: DrizzleClient
    ): Promise<UserBookmarkCollection | null> {
        const db = this.getClient(tx);
        const logContext = { id, userId };

        try {
            const [row] = await db
                .select()
                .from(userBookmarkCollections)
                .where(
                    and(
                        eq(userBookmarkCollections.id, id),
                        eq(userBookmarkCollections.userId, userId),
                        isNull(userBookmarkCollections.deletedAt)
                    )
                )
                .limit(1);

            const result = (row as UserBookmarkCollection) ?? null;

            try {
                logQuery(this.entityName, 'findActiveByIdAndUserId', logContext, {
                    found: result !== null
                });
            } catch {}

            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findActiveByIdAndUserId', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findActiveByIdAndUserId', logContext, err.message);
        }
    }

    /**
     * Checks whether the user already has an active collection with the given name.
     *
     * Used to surface a clean "name already taken" error before the DB unique
     * constraint fires. The `excludeId` parameter lets rename operations skip
     * the current row so a user can save without changing the name.
     *
     * Note: name comparison delegates to PostgreSQL's `ILIKE` (case-insensitive)
     * via {@link safeIlike}, matching the behaviour of the partial-unique index
     * applied by T-008. LIKE wildcards in the name are escaped automatically.
     *
     * @param userId - The owner's user ID.
     * @param name - The collection name to check.
     * @param excludeId - Optional collection ID to exclude from the check (for renames).
     * @param tx - Optional transaction client.
     * @returns `true` if a conflicting active collection already exists; `false` otherwise.
     */
    async existsActiveNameForUser(
        userId: string,
        name: string,
        excludeId?: string,
        tx?: DrizzleClient
    ): Promise<boolean> {
        const db = this.getClient(tx);
        const logContext = { userId, name, excludeId };

        try {
            const conditions = [
                eq(userBookmarkCollections.userId, userId),
                safeIlike(userBookmarkCollections.name, name),
                isNull(userBookmarkCollections.deletedAt)
            ];

            if (excludeId) {
                conditions.push(ne(userBookmarkCollections.id, excludeId));
            }

            const [result] = await db
                .select({ value: count() })
                .from(userBookmarkCollections)
                .where(and(...conditions));

            const exists = Number(result?.value ?? 0) > 0;

            try {
                logQuery(this.entityName, 'existsActiveNameForUser', logContext, { exists });
            } catch {}

            return exists;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'existsActiveNameForUser', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'existsActiveNameForUser', logContext, err.message);
        }
    }

    /**
     * Returns paginated active collections for the given user, each annotated with
     * the number of active (non-deleted) bookmarks it contains.
     *
     * ## SQL shape produced (includeBookmarkCount = true)
     *
     * ```sql
     * SELECT ubc.*, COUNT(ub.id) AS bookmark_count
     * FROM user_bookmark_collections ubc
     * LEFT JOIN user_bookmarks ub
     *   ON ub.collection_id = ubc.id AND ub.deleted_at IS NULL
     * WHERE ubc.user_id = $userId
     *   AND ubc.deleted_at IS NULL
     * GROUP BY ubc.id
     * ORDER BY ubc.created_at DESC
     * LIMIT $pageSize OFFSET $offset
     * ```
     *
     * ## Pagination + GROUP BY gotcha
     *
     * When `GROUP BY` is present, `COUNT(*)` in the same SELECT counts the
     * number of joined bookmark rows per group, NOT the total number of
     * collection rows. A separate `SELECT COUNT(DISTINCT ubc.id)` query is
     * therefore required to determine the total number of collections for
     * the pagination response. Both queries run in parallel via `Promise.all`.
     *
     * ## includeBookmarkCount = false
     *
     * When the caller explicitly opts out, the LEFT JOIN and GROUP BY are
     * skipped entirely. Every row receives `bookmarkCount: 0`. Use the
     * lighter {@link findActiveByUserId} instead when count is never needed.
     *
     * @param userId - The owner's user ID.
     * @param options - Optional pagination and count toggle.
     * @param tx - Optional transaction client.
     * @returns Paginated rows with `bookmarkCount` on every item, plus `total`
     *   count of matching collections (not of bookmarks).
     */
    async listActiveByUserWithBookmarkCount(
        userId: string,
        options?: PaginationOptions & { includeBookmarkCount?: boolean },
        tx?: DrizzleClient
    ): Promise<{ rows: Array<UserBookmarkCollection & { bookmarkCount: number }>; total: number }> {
        const db = this.getClient(tx);
        const page = options?.page ?? 1;
        const pageSize = Math.min(options?.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
        const offset = (page - 1) * pageSize;
        // Default to true — this method's raison d'être is the counted variant.
        const includeBookmarkCount = options?.includeBookmarkCount !== false;

        const logContext = { userId, page, pageSize, includeBookmarkCount };

        try {
            const whereClause = and(
                eq(userBookmarkCollections.userId, userId),
                isNull(userBookmarkCollections.deletedAt)
            );

            // Count query: always a plain COUNT on collections (no GROUP BY interference).
            const countQuery = db
                .select({ value: count() })
                .from(userBookmarkCollections)
                .where(whereClause);

            if (!includeBookmarkCount) {
                // Fast path: skip the JOIN entirely, return 0 for every row.
                const [items, [countResult]] = await Promise.all([
                    db
                        .select()
                        .from(userBookmarkCollections)
                        .where(whereClause)
                        .orderBy(desc(userBookmarkCollections.createdAt))
                        .limit(pageSize)
                        .offset(offset),
                    countQuery
                ]);

                const rows = (items as UserBookmarkCollection[]).map((item) => ({
                    ...item,
                    bookmarkCount: 0
                }));

                const result = { rows, total: Number(countResult?.value ?? 0) };

                try {
                    logQuery(
                        this.entityName,
                        'listActiveByUserWithBookmarkCount',
                        logContext,
                        result
                    );
                } catch {}

                return result;
            }

            // Counted path: LEFT JOIN + GROUP BY + COUNT(ub.id).
            // The data query uses sql<number> to correctly type the aggregated column.
            const [items, [countResult]] = await Promise.all([
                db
                    .select({
                        id: userBookmarkCollections.id,
                        userId: userBookmarkCollections.userId,
                        name: userBookmarkCollections.name,
                        description: userBookmarkCollections.description,
                        color: userBookmarkCollections.color,
                        icon: userBookmarkCollections.icon,
                        lifecycleState: userBookmarkCollections.lifecycleState,
                        adminInfo: userBookmarkCollections.adminInfo,
                        createdAt: userBookmarkCollections.createdAt,
                        updatedAt: userBookmarkCollections.updatedAt,
                        createdById: userBookmarkCollections.createdById,
                        updatedById: userBookmarkCollections.updatedById,
                        deletedAt: userBookmarkCollections.deletedAt,
                        deletedById: userBookmarkCollections.deletedById,
                        bookmarkCount: sql<number>`COUNT(${userBookmarks.id})`
                    })
                    .from(userBookmarkCollections)
                    .leftJoin(
                        userBookmarks,
                        and(
                            eq(userBookmarks.collectionId, userBookmarkCollections.id),
                            isNull(userBookmarks.deletedAt)
                        )
                    )
                    .where(whereClause)
                    .groupBy(userBookmarkCollections.id)
                    .orderBy(desc(userBookmarkCollections.createdAt))
                    .limit(pageSize)
                    .offset(offset),
                countQuery
            ]);

            const rows = items.map((item) => ({
                // DRIZZLE-LIMITATION: groupBy aggregate query returns rows whose
                // type Drizzle widens to include the SQL aggregate column; the
                // selected base columns still match UserBookmarkCollection.
                ...(item as unknown as UserBookmarkCollection),
                bookmarkCount: Number(item.bookmarkCount)
            }));

            const result = { rows, total: Number(countResult?.value ?? 0) };

            try {
                logQuery(this.entityName, 'listActiveByUserWithBookmarkCount', logContext, result);
            } catch {}

            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'listActiveByUserWithBookmarkCount', logContext, err);
            } catch {}
            throw new DbError(
                this.entityName,
                'listActiveByUserWithBookmarkCount',
                logContext,
                err.message
            );
        }
    }

    /**
     * Sets `collectionId = NULL` on every bookmark that references the given collection.
     *
     * This MUST be called inside the same transaction as the collection soft-delete so
     * that bookmarks are never left pointing at a deleted collection. When `tx` is
     * provided, the update participates in the caller's transaction. When omitted, the
     * update runs on the global connection (no transaction safety — callers should always
     * pass `tx` when soft-deleting a collection).
     *
     * The DB schema already declares `collectionId` with `ON DELETE SET NULL`, which
     * covers hard-deletes. This method handles soft-deletes, where the FK row is still
     * present and the cascade does not fire.
     *
     * @param collectionId - The ID of the collection being soft-deleted.
     * @param tx - Optional (but strongly recommended) transaction client.
     * @returns The number of bookmark rows updated (i.e. unlinked).
     */
    async nullifyCollectionIdOnBookmarks(
        collectionId: string,
        tx?: DrizzleClient
    ): Promise<number> {
        const db = this.getClient(tx);
        const logContext = { collectionId };

        try {
            const result = await db
                .update(userBookmarks)
                .set({ collectionId: null, updatedAt: new Date() })
                .where(eq(userBookmarks.collectionId, collectionId))
                .returning({ id: userBookmarks.id });

            const affected = result.length;

            try {
                logQuery(this.entityName, 'nullifyCollectionIdOnBookmarks', logContext, {
                    affected
                });
            } catch {}

            return affected;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'nullifyCollectionIdOnBookmarks', logContext, err);
            } catch {}
            throw new DbError(
                this.entityName,
                'nullifyCollectionIdOnBookmarks',
                logContext,
                err.message
            );
        }
    }
}

/** Singleton instance of UserBookmarkCollectionModel for use across the application. */
export const userBookmarkCollectionModel = new UserBookmarkCollectionModel();
