import type { UserAdminStats } from '@repo/schemas';
import type { User } from '@repo/schemas';
import { type SQL, and, count, isNull, or, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { accommodations } from '../../schemas/accommodation/accommodation.dbschema.ts';
import { events } from '../../schemas/event/event.dbschema.ts';
import { posts } from '../../schemas/post/post.dbschema.ts';
import { users } from '../../schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { buildWhereClause, safeIlike } from '../../utils/drizzle-helpers.ts';

export type UserWithCounts = User & {
    accommodationsCount: number;
    eventsCount: number;
    postsCount: number;
};

export class UserModel extends BaseModelImpl<User> {
    protected table = users;
    public entityName = 'users';

    protected getTableName(): string {
        return 'users';
    }

    /**
     * Override findAll to handle text search with 'q' parameter.
     * Merges additionalConditions (e.g. from adminList search filters) into the WHERE clause
     * for both the main query and the count query to keep pagination consistent.
     *
     * @param where - Filter object, may include a 'q' key for text search
     * @param options - Optional pagination and sorting parameters
     * @param additionalConditions - Optional extra SQL conditions to combine with the where clause
     * @param tx - Optional transaction client
     * @returns Paginated result with items and total count
     */
    async findAll(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
        additionalConditions?: SQL[],
        tx?: DrizzleClient
    ): Promise<{ items: User[]; total: number }> {
        const db = this.getClient(tx);
        const { q, ...otherFilters } = where;
        const page = options?.page;
        const pageSize = options?.pageSize;
        const isPaginated = page !== undefined && pageSize !== undefined;

        // Build base where clause for non-search filters
        const baseWhereClause = buildWhereClause(otherFilters, this.table);

        // Build search clause for 'q' parameter
        let searchClause: SQL | undefined;
        if (q && typeof q === 'string' && q.trim()) {
            const trimmed = q.trim();
            searchClause = or(
                safeIlike(users.displayName, trimmed),
                safeIlike(users.firstName, trimmed),
                safeIlike(users.lastName, trimmed)
            );
        }

        // Combine base where, search clause, and additionalConditions
        const allConditions: SQL[] = [];
        if (baseWhereClause) allConditions.push(baseWhereClause);
        if (searchClause) allConditions.push(searchClause);
        if (additionalConditions) allConditions.push(...additionalConditions);

        const finalWhereClause =
            allConditions.length === 0
                ? undefined
                : allConditions.length === 1
                  ? allConditions[0]
                  : and(...allConditions);

        if (isPaginated) {
            const offset = (page - 1) * pageSize;
            const [items, totalResult] = await Promise.all([
                db.select().from(this.table).where(finalWhereClause).limit(pageSize).offset(offset),
                db.select({ count: count() }).from(this.table).where(finalWhereClause)
            ]);

            const total = totalResult[0]?.count ?? 0;

            // DRIZZLE-LIMITATION: Drizzle's select() row type uses branded pgEnum (role, status) and JSONB columns; User entity uses domain enum unions and Zod-validated JSON shapes.
            return { items: items as unknown as User[], total };
        }

        // Safety cap: even when pagination is not explicitly requested, limit results
        // to prevent unbounded queries returning all users
        const SAFETY_LIMIT = 100;
        const items =
            (await db.select().from(this.table).where(finalWhereClause).limit(SAFETY_LIMIT)) || [];
        // DRIZZLE-LIMITATION: Drizzle's select() row type uses branded pgEnum (role, status) and JSONB columns; User entity uses domain enum unions identical at runtime.
        return { items: items as unknown as User[], total: items.length };
    }

    /**
     * Override count to handle text search with 'q' parameter.
     * Merges additionalConditions into the WHERE clause so that counts remain
     * consistent with findAll results when admin search filters are applied.
     *
     * @param where - Filter object, may include a 'q' key for text search
     * @param options - Optional config: additionalConditions for extra SQL, tx for transaction
     * @returns Promise resolving to the count
     */
    async count(
        where: Record<string, unknown>,
        options?: { additionalConditions?: SQL[]; tx?: DrizzleClient }
    ): Promise<number> {
        // If no 'q' parameter, use parent implementation (which already handles additionalConditions)
        if (!where.q) {
            return super.count(where, options);
        }

        const { additionalConditions = [], tx } = options ?? {};
        const db = this.getClient(tx);
        const { q, ...otherFilters } = where;

        // Build base where clause for non-search filters
        const baseWhereClause = buildWhereClause(otherFilters, this.table);

        // Build search clause for 'q' parameter
        let searchClause: SQL | undefined;
        if (q && typeof q === 'string' && q.trim()) {
            const trimmed = q.trim();
            searchClause = or(
                safeIlike(users.displayName, trimmed),
                safeIlike(users.firstName, trimmed),
                safeIlike(users.lastName, trimmed)
            );
        }

        // Combine base where, search clause, and additionalConditions
        const allConditions: SQL[] = [];
        if (baseWhereClause) allConditions.push(baseWhereClause);
        if (searchClause) allConditions.push(searchClause);
        if (additionalConditions.length > 0) allConditions.push(...additionalConditions);

        const finalWhereClause =
            allConditions.length === 0
                ? undefined
                : allConditions.length === 1
                  ? allConditions[0]
                  : and(...allConditions);

        const result = await db.select({ count: count() }).from(this.table).where(finalWhereClause);
        return result[0]?.count ?? 0;
    }

    /**
     * Find all users with relationship counts (accommodations, events, posts).
     * Merges additionalConditions into the WHERE clause for both the main query
     * and the count query to keep pagination consistent with admin search filters.
     *
     * @param where - Filter object, may include a 'q' key for text search
     * @param options - Optional pagination parameters
     * @param additionalConditions - Optional extra SQL conditions to combine with the where clause
     * @param tx - Optional transaction client
     * @returns Paginated result with items (including relationship counts) and total count
     */
    async findAllWithCounts(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number },
        additionalConditions?: SQL[],
        tx?: DrizzleClient
    ): Promise<{ items: UserWithCounts[]; total: number }> {
        const db = this.getClient(tx);
        const { q, ...otherFilters } = where;
        const page = options?.page;
        const pageSize = options?.pageSize;
        const isPaginated = page !== undefined && pageSize !== undefined;

        // Build base where clause for non-search filters
        const baseWhereClause = buildWhereClause(otherFilters, this.table);

        // Build search clause for text search
        let searchClause: SQL | undefined;
        if (q && typeof q === 'string' && q.trim() !== '') {
            const trimmed = q.trim();
            searchClause = or(
                safeIlike(users.displayName, trimmed),
                safeIlike(users.firstName, trimmed),
                safeIlike(users.lastName, trimmed)
            );
        }

        // Combine base where, search clause, and additionalConditions
        const allConditions: SQL[] = [];
        if (baseWhereClause) allConditions.push(baseWhereClause);
        if (searchClause) allConditions.push(searchClause);
        if (additionalConditions) allConditions.push(...additionalConditions);

        const finalWhereClause =
            allConditions.length === 0
                ? undefined
                : allConditions.length === 1
                  ? allConditions[0]
                  : and(...allConditions);

        // Use correlated subqueries to get counts in a single query instead of N+1
        const accommodationsCountSq = sql<number>`(
            SELECT count(*)::int FROM ${accommodations}
            WHERE ${accommodations.createdById} = ${users.id}
        )`.as('accommodations_count');

        const eventsCountSq = sql<number>`(
            SELECT count(*)::int FROM ${events}
            WHERE ${events.authorId} = ${users.id}
        )`.as('events_count');

        const postsCountSq = sql<number>`(
            SELECT count(*)::int FROM ${posts}
            WHERE ${posts.authorId} = ${users.id}
        )`.as('posts_count');

        const baseQuery = db
            .select({
                user: users,
                accommodationsCount: accommodationsCountSq,
                eventsCount: eventsCountSq,
                postsCount: postsCountSq
            })
            .from(users)
            .where(finalWhereClause)
            .$dynamic();

        let rows: Array<{
            user: typeof users.$inferSelect;
            accommodationsCount: number;
            eventsCount: number;
            postsCount: number;
        }>;

        // Safety cap for non-paginated path to prevent unbounded queries
        const SAFETY_LIMIT = 100;
        if (isPaginated) {
            const safePageSize = Math.min(pageSize, SAFETY_LIMIT);
            const offset = (page - 1) * safePageSize;
            rows = await baseQuery.limit(safePageSize).offset(offset);
        } else {
            rows = await baseQuery.limit(SAFETY_LIMIT);
        }

        const itemsWithCounts: UserWithCounts[] = rows.map((row) => ({
            // DRIZZLE-LIMITATION: select with leftJoin projects row.user as Drizzle's full users-table row type with branded enums; User domain entity uses unbranded enum unions.
            ...(row.user as unknown as User),
            accommodationsCount: row.accommodationsCount ?? 0,
            eventsCount: row.eventsCount ?? 0,
            postsCount: row.postsCount ?? 0
        }));

        // Get total count for pagination
        let total = itemsWithCounts.length;
        if (isPaginated) {
            const countResult = await db
                .select({ count: count(users.id) })
                .from(users)
                .where(finalWhereClause);

            total = countResult[0]?.count ?? 0;
        }

        return { items: itemsWithCounts, total };
    }

    /**
     * Returns admin-level aggregated user statistics.
     *
     * Runs two independent queries in parallel:
     *  1. COUNT(*) GROUP BY role — excludes soft-deleted rows.
     *  2. Monthly new-user trend for the last 12 complete months (current
     *     calendar month included), derived from `created_at`. Months with
     *     zero registrations are included as explicit zero buckets so the
     *     caller always receives a fixed-length series.
     *
     * @param tx - Optional Drizzle transaction client (for test isolation).
     * @returns Aggregated stats shaped as `UserAdminStats`.
     */
    async getAdminStats(tx?: DrizzleClient): Promise<UserAdminStats> {
        const db = this.getClient(tx);

        // ---- byRole aggregation ------------------------------------------
        // Only count non-deleted users (deletedAt IS NULL).
        const roleCountsQuery = db
            .select({
                role: users.role,
                total: count(users.id)
            })
            .from(users)
            .where(isNull(users.deletedAt))
            .groupBy(users.role);

        // ---- newUsersTrend aggregation ------------------------------------
        // Extract YYYY-MM from created_at using to_char for deterministic
        // formatting, covering the last 12 months (oldest first).
        // The CTE `months` materialises the 12-month window; the LEFT JOIN
        // ensures months with no registrations appear as 0.
        const trendQuery = db.execute<{ month: string; count: string }>(sql`
            WITH months AS (
                SELECT to_char(
                    date_trunc('month', now()) - (gs.n * interval '1 month'),
                    'YYYY-MM'
                ) AS month
                FROM generate_series(11, 0, -1) AS gs(n)
            )
            SELECT
                m.month,
                COALESCE(COUNT(u.id), 0)::int AS count
            FROM months m
            LEFT JOIN users u
                ON to_char(date_trunc('month', u.created_at), 'YYYY-MM') = m.month
                AND u.deleted_at IS NULL
            GROUP BY m.month
            ORDER BY m.month ASC
        `);

        const [roleCounts, trendRows] = await Promise.all([roleCountsQuery, trendQuery]);

        const byRole: Record<string, number> = {};
        for (const row of roleCounts) {
            if (row.role) {
                byRole[row.role] = row.total;
            }
        }

        const newUsersTrend = trendRows.rows.map((row) => ({
            month: row.month,
            count: Number(row.count)
        }));

        return { byRole, newUsersTrend };
    }
}

/** Singleton instance of UserModel for use across the application. */
export const userModel = new UserModel();
