import type { Post, PostMonthlyTrendItem } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
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

/**
 * Extracts the `categories` (array, OR union) / `category` (singular) post
 * filter from a generic `where` record and converts it into a manual
 * `inArray`/`eq` SQL condition, mirroring `AccommodationModel`'s `types`/`type`
 * precedence: the array wins when both are present, and an empty array is
 * treated as "no filter" (never `inArray([])`).
 *
 * This is REQUIRED because `categories` is not a real column on the `posts`
 * table (only the singular `category` is) — the generic `buildWhereClause`
 * helper has no way to turn it into `inArray()`, so passing it straight
 * through would silently skip it as an unknown key, dropping the filter
 * entirely instead of applying it (HOS-96 US-2/US-9 — the shipped latent bug:
 * the sidebar already serializes `?category=A,B`/`?categories=A,B` but the
 * backend never filtered by it).
 *
 * @param where - The raw filter record as received from the service layer.
 * @returns The `where` record with `category`/`categories` stripped (so the
 *   generic `buildWhereClause` never sees them), plus the manual SQL
 *   condition to push into `additionalConditions` (if any).
 */
function extractPostCategoryCondition(where: Record<string, unknown>): {
    where: Record<string, unknown>;
    condition?: SQL<unknown>;
} {
    const { category, categories, ...rest } = where;
    if (Array.isArray(categories) && categories.length > 0) {
        return {
            where: rest,
            condition: inArray(posts.category, categories as (typeof posts.category._.data)[])
        };
    }
    if (category !== undefined) {
        return {
            where: rest,
            condition: eq(posts.category, category as typeof posts.category._.data)
        };
    }
    return { where: rest, condition: undefined };
}

/**
 * Options accepted by {@link PostModel.findAll}, {@link PostModel.findAllWithRelations},
 * and {@link PostModel.count} that this model's soft-delete default cares about.
 */
interface PostIncludeDeletedOption {
    includeDeleted?: boolean;
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
     * Computes the soft-delete exclusion condition injected by default into every
     * {@link findAll}, {@link findAllWithRelations}, and {@link count} query on this
     * model (HOS-274). Public list/count/getByX endpoints (e.g. `getByCategory`,
     * `getByRelatedAccommodation`, `_executeSearch`) never explicitly filtered
     * `deletedAt` themselves, so soft-deleted posts leaked into public responses.
     * Centralizing the rule here — rather than fixing each call site — closes the
     * gap for every current and future caller of these three methods.
     *
     * Returns `undefined` (no condition injected, i.e. soft-deleted rows are
     * included) when EITHER escape hatch applies, mirroring the existing
     * convention in `BaseCrudRead.list()` (`packages/service-core/src/base/base.crud.read.ts`):
     *   (a) `options.includeDeleted === true` — explicit opt-in, e.g. the admin
     *       trash/restore view via `adminList({ includeDeleted: true })`, or
     *   (b) the caller's `where` record already specifies a `deletedAt` key —
     *       explicit caller intent always wins over the default.
     *
     * @param where - The raw filter record as received by the caller, BEFORE
     *   {@link extractPostCategoryCondition} strips `category`/`categories` (that
     *   extraction never touches `deletedAt`, so checking the raw or sanitized
     *   record is equivalent here — the raw record is used for clarity).
     * @param options - Optional read options; only `includeDeleted` is read.
     * @returns `isNull(posts.deletedAt)`, or `undefined` when either escape hatch applies.
     */
    #softDeleteCondition(
        where: Record<string, unknown>,
        options?: PostIncludeDeletedOption
    ): SQL<unknown> | undefined {
        if (options?.includeDeleted) return undefined;
        if ('deletedAt' in where) return undefined;
        return isNull(posts.deletedAt);
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
        options?: {
            page?: number;
            pageSize?: number;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
            includeDeleted?: boolean;
        },
        additionalConditions?: SQL[],
        tx?: DrizzleClient
    ): Promise<{ items: Post[]; total: number }> {
        // HOS-96: strip category/categories from the generic where record and
        // convert them into a manual inArray/eq condition BEFORE either branch
        // below builds its query — see extractPostCategoryCondition() JSDoc.
        const { where: sanitizedWhere, condition: categoryCondition } =
            extractPostCategoryCondition(where ?? {});
        // HOS-274: default-exclude soft-deleted rows — see #softDeleteCondition() JSDoc.
        const softDeleteCondition = this.#softDeleteCondition(where ?? {}, options);
        const mergedConditions: SQL[] = [
            ...(additionalConditions ?? []),
            ...(categoryCondition ? [categoryCondition] : []),
            ...(softDeleteCondition ? [softDeleteCondition] : [])
        ];

        if (options?.sortBy !== MOST_SAVED_SORT_FIELD) {
            return super.findAll(
                sanitizedWhere,
                options,
                mergedConditions.length > 0 ? mergedConditions : undefined,
                tx
            );
        }

        const db = this.getClient(tx);
        const safeWhere = sanitizedWhere;
        const page = options.page ?? 1;
        const pageSize = options.pageSize ?? 10;
        const sortOrder: 'asc' | 'desc' = options.sortOrder ?? 'desc';
        const offset = (page - 1) * pageSize;

        const logContext = { where: safeWhere, page, pageSize, sortBy: MOST_SAVED_SORT_FIELD };

        try {
            const baseWhereClause = buildWhereClause(safeWhere, this.table);

            const allConditions: SQL[] = [];
            if (baseWhereClause) allConditions.push(baseWhereClause);
            if (mergedConditions.length > 0) {
                allConditions.push(...mergedConditions);
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
                // includeDeleted is forwarded so `total` makes the same soft-delete
                // include/exclude decision as `items` above (HOS-274 — see
                // #softDeleteCondition() JSDoc).
                this.count(safeWhere, {
                    additionalConditions: mergedConditions,
                    tx,
                    includeDeleted: options?.includeDeleted
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

    /**
     * Overrides {@link BaseModelImpl.findAllWithRelations} to apply the same
     * manual `categories`/`category` branch as {@link findAll} (HOS-96
     * US-2/US-9), so the public search endpoint — which loads relations (e.g.
     * `author`) — reflects the same OR-union filter as the plain item query.
     * Also applies the same default soft-delete exclusion (HOS-274) — see
     * {@link #softDeleteCondition} JSDoc. The internal `this.count()` call that
     * `BaseModelImpl.findAllWithRelations` makes for `total` receives `options`
     * (including `includeDeleted`) unchanged, so it independently makes the same
     * include/exclude decision as the `items` query built here.
     */
    override async findAllWithRelations(
        relations: Record<string, boolean | Record<string, unknown>>,
        where: Record<string, unknown> = {},
        options: {
            page?: number;
            pageSize?: number;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
            includeDeleted?: boolean;
        } = {},
        additionalConditions?: SQL[],
        tx?: DrizzleClient
    ): Promise<{ items: Post[]; total: number }> {
        const { where: sanitizedWhere, condition: categoryCondition } =
            extractPostCategoryCondition(where ?? {});
        // HOS-274: default-exclude soft-deleted rows — see #softDeleteCondition() JSDoc.
        const softDeleteCondition = this.#softDeleteCondition(where ?? {}, options);
        const mergedConditions: SQL[] = [
            ...(additionalConditions ?? []),
            ...(categoryCondition ? [categoryCondition] : []),
            ...(softDeleteCondition ? [softDeleteCondition] : [])
        ];

        return super.findAllWithRelations(
            relations,
            sanitizedWhere,
            options,
            mergedConditions.length > 0 ? mergedConditions : undefined,
            tx
        );
    }

    /**
     * Overrides {@link BaseModelImpl.count} to apply the same manual
     * `categories`/`category` branch as {@link findAll} and
     * {@link findAllWithRelations} (HOS-96 US-2/US-9), so the public count
     * endpoint (which drives pagination totals) reflects the exact same
     * OR-union filter as the items query. Also applies the same default
     * soft-delete exclusion (HOS-274) — see {@link #softDeleteCondition} JSDoc.
     */
    override async count(
        where: Record<string, unknown>,
        options?: { additionalConditions?: SQL[]; tx?: DrizzleClient; includeDeleted?: boolean }
    ): Promise<number> {
        const { where: sanitizedWhere, condition: categoryCondition } =
            extractPostCategoryCondition(where ?? {});
        const softDeleteCondition = this.#softDeleteCondition(where ?? {}, options);
        const mergedConditions: SQL[] = [
            ...(options?.additionalConditions ?? []),
            ...(categoryCondition ? [categoryCondition] : []),
            ...(softDeleteCondition ? [softDeleteCondition] : [])
        ];
        return super.count(sanitizedWhere, { ...options, additionalConditions: mergedConditions });
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
