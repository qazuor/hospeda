import type { Post, PostMonthlyTrendItem } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { and, desc, eq, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { posts } from '../../schemas/post/post.dbschema.ts';
import { userBookmarks } from '../../schemas/user/user_bookmark.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { buildWhereClause } from '../../utils/drizzle-helpers.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Synthetic sort field name that orders posts by the number of active
 * (non-deleted) bookmarks pointing at them. Implemented as a correlated
 * subquery against `user_bookmarks` filtered by `entity_type = 'POST'` and
 * `deleted_at IS NULL`. SPEC-098 T-052b (mirrors the accommodation
 * implementation in T-052 and the events implementation in T-052a).
 *
 * Performance depends on the compound index `idx_user_bookmarks_entity_active`
 * on `(entity_id, entity_type, deleted_at)` (see SPEC-098 T-008 and the
 * `0019_user_bookmarks_entity_active_index.sql` manual migration).
 */
const MOST_SAVED_SORT_FIELD = 'mostSaved';

/**
 * Build the correlated subquery used as the ORDER BY expression for the
 * `mostSaved` synthetic sort. NULL counts (i.e. no active bookmarks) are
 * folded to zero by `COUNT(*)`, so no `NULLS LAST` clause is required.
 */
function buildMostSavedOrderExpr(order: 'asc' | 'desc'): SQL {
    const direction = order === 'desc' ? sql`DESC` : sql`ASC`;
    return sql`(
        SELECT COUNT(*) FROM ${userBookmarks}
        WHERE ${userBookmarks.entityId} = ${posts.id}
          AND ${userBookmarks.entityType} = 'POST'
          AND ${userBookmarks.deletedAt} IS NULL
    ) ${direction}`;
}

export class PostModel extends BaseModelImpl<Post> {
    protected table = posts;
    public entityName = 'posts';

    protected override readonly validRelationKeys = [
        'author',
        'createdBy',
        'updatedBy',
        'deletedBy',
        'relatedAccommodation',
        'relatedDestination',
        'relatedEvent',
        'sponsorship',
        'tags',
        'postTags'
    ] as const;

    /**
     * The `media` column stores structured image metadata as JSONB.
     * Opting in here ensures that a partial media patch does not overwrite
     * sibling keys written by a concurrent request (GAP-078-186, GAP-078-198).
     */
    protected override readonly mergeableJsonbColumns = ['media'] as const;

    protected getTableName(): string {
        return 'posts';
    }

    /**
     * Overrides {@link BaseModelImpl.findAll} to add support for the synthetic
     * `mostSaved` sort field. When `options.sortBy === 'mostSaved'`, the query
     * orders rows by the count of active bookmarks via a correlated subquery on
     * `user_bookmarks` (entity_type='POST' AND deleted_at IS NULL), with a
     * stable `id DESC` tiebreaker so pagination stays deterministic. All other
     * sort fields delegate to the base implementation unchanged.
     *
     * SPEC-098 T-052b — mirrors the accommodation `mostSaved` mechanism on
     * the posts listing.
     */
    override async findAll(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
        additionalConditions?: SQL[],
        tx?: DrizzleClient
    ): Promise<{ items: Post[]; total: number }> {
        if (options?.sortBy !== MOST_SAVED_SORT_FIELD) {
            return super.findAll(where, options, additionalConditions, tx);
        }

        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        const page = options.page ?? 1;
        const pageSize = options.pageSize ?? 10;
        const sortOrder: 'asc' | 'desc' = options.sortOrder ?? 'desc';
        const offset = (page - 1) * pageSize;

        const logContext = { where: safeWhere, page, pageSize, sortBy: MOST_SAVED_SORT_FIELD };

        try {
            const baseWhereClause = buildWhereClause(safeWhere, this.table);

            const allConditions: SQL[] = [];
            if (baseWhereClause) allConditions.push(baseWhereClause);
            if (additionalConditions && additionalConditions.length > 0) {
                allConditions.push(...additionalConditions);
            }

            const finalWhereClause =
                allConditions.length === 0
                    ? undefined
                    : allConditions.length === 1
                      ? allConditions[0]
                      : and(...allConditions);

            const orderExpr = buildMostSavedOrderExpr(sortOrder);
            const tieBreaker = desc(posts.id);

            const itemsQuery = db
                .select()
                .from(this.table)
                .where(finalWhereClause)
                .orderBy(orderExpr, tieBreaker)
                .limit(pageSize)
                .offset(offset);

            const [items, total] = await Promise.all([
                itemsQuery,
                this.count(safeWhere, {
                    additionalConditions,
                    tx
                })
            ]);

            // DRIZZLE-LIMITATION: relational query result widens nullable JSONB columns vs the entity type; the projection above already returns the canonical shape.
            const result = { items: items as unknown as Post[], total };
            try {
                logQuery(this.entityName, 'findAll', logContext, result);
            } catch {}
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findAll', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findAll', logContext, err.message);
        }
    }

    /** Atomically increment the likes counter by 1 */
    async incrementLikes({ id }: { id: string }, tx?: DrizzleClient): Promise<void> {
        const db = this.getClient(tx);
        await db
            .update(posts)
            .set({ likes: sql`COALESCE(${posts.likes}, 0) + 1` })
            .where(eq(posts.id, id));
    }

    /** Atomically decrement the likes counter by 1 (minimum 0) */
    async decrementLikes({ id }: { id: string }, tx?: DrizzleClient): Promise<void> {
        const db = this.getClient(tx);
        await db
            .update(posts)
            .set({ likes: sql`GREATEST(COALESCE(${posts.likes}, 0) - 1, 0)` })
            .where(eq(posts.id, id));
    }

    /**
     * Atomically adjusts the `comments` counter by `delta` (clamped at 0).
     *
     * Used by the comment service to keep `posts.comments` in sync as comments
     * are created (+1), soft-deleted/hard-deleted (-1), moderated APPROVED↔REJECTED
     * (±1), and restored (+1). The existing value is treated as a baseline, so
     * legacy counts that predate the comments table are preserved (SPEC-165 RD-7 /
     * AC-24 / AC-25). `GREATEST(..., 0)` guards against the counter going negative.
     *
     * @param params.id - The post id.
     * @param params.delta - The amount to add (use a negative value to subtract).
     * @param tx - Optional transaction client.
     */
    async adjustCommentCount(
        { id, delta }: { id: string; delta: number },
        tx?: DrizzleClient
    ): Promise<void> {
        const db = this.getClient(tx);
        await db
            .update(posts)
            .set({ comments: sql`GREATEST(COALESCE(${posts.comments}, 0) + ${delta}, 0)` })
            .where(eq(posts.id, id));
    }

    /**
     * Returns a 12-month posts-per-month trend series, zero-filled.
     *
     * Uses a PostgreSQL CTE with `generate_series` to materialise the
     * 12-month window (current month included, oldest first) and a LEFT JOIN
     * against `posts` so months with no creations appear as explicit zeros.
     * Soft-deleted posts (deleted_at IS NOT NULL) are excluded.
     *
     * @param tx - Optional Drizzle transaction client (for test isolation).
     * @returns Array of 12 `{ month: YYYY-MM, count: number }` items, ASC.
     */
    async getMonthlyTrend(tx?: DrizzleClient): Promise<PostMonthlyTrendItem[]> {
        const db = this.getClient(tx);

        const rows = await db.execute<{ month: string; count: string }>(sql`
            WITH months AS (
                SELECT to_char(
                    date_trunc('month', now()) - (gs.n * interval '1 month'),
                    'YYYY-MM'
                ) AS month
                FROM generate_series(11, 0, -1) AS gs(n)
            )
            SELECT
                m.month,
                COALESCE(COUNT(p.id), 0)::int AS count
            FROM months m
            LEFT JOIN posts p
                ON to_char(date_trunc('month', p.created_at), 'YYYY-MM') = m.month
                AND p.deleted_at IS NULL
            GROUP BY m.month
            ORDER BY m.month ASC
        `);

        return rows.rows.map((row) => ({
            month: row.month,
            count: Number(row.count)
        }));
    }
}

/** Singleton instance of PostModel for use across the application. */
export const postModel = new PostModel();
