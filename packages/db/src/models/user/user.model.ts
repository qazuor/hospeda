import type { User } from '@repo/schemas';
import { type SQL, and, count, eq, ilike, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import { accommodations } from '../../schemas/accommodation/accommodation.dbschema';
import { events } from '../../schemas/event/event.dbschema';
import type * as schema from '../../schemas/index.js';
import { posts } from '../../schemas/post/post.dbschema';
import { users } from '../../schemas/user/user.dbschema';
import { buildWhereClause } from '../../utils/drizzle-helpers';

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

            return { items: items as User[], total };
        }

        const items = (await db.select().from(this.table).where(finalWhereClause)) || [];
        return { items: items as User[], total: items.length };
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

        // Get users with pagination if needed
        let usersData: User[];
        if (isPaginated) {
            const offset = (page - 1) * pageSize;
            if (finalWhereClause) {
                usersData = (await db
                    .select()
                    .from(users)
                    .where(finalWhereClause)
                    .limit(pageSize)
                    .offset(offset)) as User[];
            } else {
                usersData = (await db
                    .select()
                    .from(users)
                    .limit(pageSize)
                    .offset(offset)) as User[];
            }
        } else {
            if (finalWhereClause) {
                usersData = (await db.select().from(users).where(finalWhereClause)) as User[];
            } else {
                usersData = (await db.select().from(users)) as User[];
            }
        }

        // Calculate counts for each user individually
        const itemsWithCounts = await Promise.all(
            usersData.map(async (user) => {
                const [accommodationsCountResult, eventsCountResult, postsCountResult] =
                    await Promise.all([
                        db
                            .select({ count: count() })
                            .from(accommodations)
                            .where(eq(accommodations.createdById, user.id)),
                        db
                            .select({ count: count() })
                            .from(events)
                            .where(eq(events.authorId, user.id)),
                        db.select({ count: count() }).from(posts).where(eq(posts.authorId, user.id))
                    ]);

                return {
                    ...user,
                    accommodationsCount: accommodationsCountResult[0]?.count || 0,
                    eventsCount: eventsCountResult[0]?.count || 0,
                    postsCount: postsCountResult[0]?.count || 0
                };
            })
        );

        // Get total count for pagination
        let total = itemsWithCounts.length;
        if (isPaginated) {
            const countQuery = db
                .select({ count: count(users.id) })
                .from(users)
                .where(finalWhereClause);

            const countResult = await countQuery;
            total = countResult[0]?.count || 0;
        }

        return { items: itemsWithCounts as UserWithCounts[], total };
    }
}
