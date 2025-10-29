import { type SQL, and, eq, ilike, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import type * as schema from '../../schemas/index.js';
import { campaigns } from '../../schemas/marketing/campaign.dbschema';
import { buildWhereClause } from '../../utils/drizzle-helpers';

// Use inferred type from database schema instead of @repo/schemas
type Campaign = typeof campaigns.$inferSelect;

export class CampaignModel extends BaseModel<Campaign> {
    protected table = campaigns;
    protected entityName = 'campaign';

    protected getTableName(): string {
        return 'campaigns';
    }

    /**
     * Override findAll to handle text search with 'q' parameter
     */
    async findAll(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ items: Campaign[]; total: number }> {
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
            searchClause = or(ilike(campaigns.name, searchTerm));
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

        if (isPaginated && page && pageSize) {
            const offset = (page - 1) * pageSize;
            const [items, total] = await Promise.all([
                db.select().from(this.table).where(finalWhereClause).limit(pageSize).offset(offset),
                this.count(where, tx)
            ]);

            return { items, total };
        }

        const items = (await db.select().from(this.table).where(finalWhereClause)) || [];
        return { items, total: items.length };
    }

    /**
     * Find campaign by client ID
     */
    async findByClient(clientId: string, tx?: NodePgDatabase<typeof schema>): Promise<Campaign[]> {
        const db = this.getClient(tx);

        const result = await db.select().from(this.table).where(eq(campaigns.clientId, clientId));

        return result;
    }

    /**
     * Find active campaigns
     */
    async findActive(tx?: NodePgDatabase<typeof schema>): Promise<Campaign[]> {
        const db = this.getClient(tx);

        const result = await db.select().from(this.table).where(eq(campaigns.status, 'ACTIVE'));

        return result;
    }
}
