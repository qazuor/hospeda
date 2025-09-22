import type { User } from '@repo/schemas';
import { type SQL, and, count, ilike, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import type * as schema from '../../schemas/index.js';
import { users } from '../../schemas/user/user.dbschema';
import { buildWhereClause } from '../../utils/drizzle-helpers';

export class UserModel extends BaseModel<User> {
    protected table = users;
    protected entityName = 'users';

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
}
