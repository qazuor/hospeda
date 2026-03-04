import type { User } from '@repo/schemas';
import { type SQL, and, count, ilike, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model.ts';
import type { schema } from '../../client.ts';
import { accommodations } from '../../schemas/accommodation/accommodation.dbschema.ts';
import { events } from '../../schemas/event/event.dbschema.ts';
import { posts } from '../../schemas/post/post.dbschema.ts';
import { users } from '../../schemas/user/user.dbschema.ts';
import { buildWhereClause } from '../../utils/drizzle-helpers.ts';

export type UserWithCounts = User & {
    accommodationsCount: number;
    eventsCount: number;
    postsCount: number;
};

export class UserModel extends BaseModel<User> {
    protected table = users;
    protected entityName = 'users';

    protected getTableName(): string {
        return 'users';
    }

    /**
     * Override findAll to handle text search with 'q' parameter
     */
    async findAll(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ items: User[]; total: number }> {
        const db = this.getClient(tx);
        const { q, ...otherFilters } = where;
        const page = options?.page;
        const pageSize = options?.pageSize;
        const isPaginated = page !== undefined && pageSize !== undefined;

        // Build base where clause for non-search filters
        const baseWhereClause = buildWhereClause(otherFilters, this.table as unknown);

        // Build search clause for 'q' parameter
        let searchClause: SQL | undefined;
        if (q && typeof q === 'string' && q.trim()) {
            const searchTerm = `%${q.trim()}%`;
            searchClause = or(
                ilike(users.displayName, searchTerm),
                ilike(users.firstName, searchTerm),
                ilike(users.lastName, searchTerm)
            );
        }

        // Combine base and search clauses
        let finalWhereClause: SQL | undefined;
        if (baseWhereClause && searchClause) {
            finalWhereClause = and(baseWhereClause, searchClause);
        } else if (baseWhereClause) {
            finalWhereClause = baseWhereClause;
        } else if (searchClause) {
            finalWhereClause = searchClause;
        }

        if (isPaginated) {
            const offset = (page - 1) * pageSize;
            const [items, totalResult] = await Promise.all([
                db.select().from(this.table).where(finalWhereClause).limit(pageSize).offset(offset),
                db.select({ count: count() }).from(this.table).where(finalWhereClause)
            ]);

            const total = totalResult[0]?.count || 0;

            return { items: items as unknown as User[], total };
        }

        const items = (await db.select().from(this.table).where(finalWhereClause)) || [];
        return { items: items as unknown as User[], total: items.length };
    }

    /**
     * Override count to handle text search with 'q' parameter
     */
    async count(
        where: Record<string, unknown>,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<number> {
        // If no 'q' parameter, use parent implementation
        if (!where.q) {
            return super.count(where, tx);
        }

        const db = this.getClient(tx);
        const { q, ...otherFilters } = where;

        // Build base where clause for non-search filters
        const baseWhereClause = buildWhereClause(otherFilters, this.table as unknown);

        // Build search clause for 'q' parameter
        let searchClause: SQL | undefined;
        if (q && typeof q === 'string' && q.trim()) {
            const searchTerm = `%${q.trim()}%`;
            searchClause = or(
                ilike(users.displayName, searchTerm),
                ilike(users.firstName, searchTerm),
                ilike(users.lastName, searchTerm)
            );
        }

        // Combine base and search clauses
        let finalWhereClause: SQL | undefined;
        if (baseWhereClause && searchClause) {
            finalWhereClause = and(baseWhereClause, searchClause);
        } else if (baseWhereClause) {
            finalWhereClause = baseWhereClause;
        } else if (searchClause) {
            finalWhereClause = searchClause;
        }

        const result = await db.select({ count: count() }).from(this.table).where(finalWhereClause);
        return result[0]?.count || 0;
    }

    /**
     * Find all users with relationship counts
     */
    async findAllWithCounts(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ items: UserWithCounts[]; total: number }> {
        const db = this.getClient(tx);
        const { q, ...otherFilters } = where;
        const page = options?.page;
        const pageSize = options?.pageSize;
        const isPaginated = page !== undefined && pageSize !== undefined;

        // Build base where clause for non-search filters
        const baseWhereClause = buildWhereClause(otherFilters, this.table as unknown);

        // Build search clause for text search
        let searchClause: SQL | undefined;
        if (q && typeof q === 'string' && q.trim() !== '') {
            const searchTerm = `%${q.trim()}%`;
            searchClause = or(
                ilike(users.displayName, searchTerm),
                ilike(users.firstName, searchTerm),
                ilike(users.lastName, searchTerm)
            );
        }

        // Combine base and search clauses
        let finalWhereClause: SQL | undefined;
        if (baseWhereClause && searchClause) {
            finalWhereClause = and(baseWhereClause, searchClause);
        } else if (baseWhereClause) {
            finalWhereClause = baseWhereClause;
        } else if (searchClause) {
            finalWhereClause = searchClause;
        }

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

        if (isPaginated) {
            const offset = (page - 1) * pageSize;
            rows = await baseQuery.limit(pageSize).offset(offset);
        } else {
            rows = await baseQuery;
        }

        const itemsWithCounts: UserWithCounts[] = rows.map((row) => ({
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

            total = countResult[0]?.count || 0;
        }

        return { items: itemsWithCounts, total };
    }
}
