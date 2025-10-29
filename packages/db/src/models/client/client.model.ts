import type { Client } from '@repo/schemas';
import { type SQL, and, eq, ilike, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import { clients } from '../../schemas/client/client.dbschema';
import type * as schema from '../../schemas/index.js';
import { buildWhereClause } from '../../utils/drizzle-helpers';

export class ClientModel extends BaseModel<Client> {
    protected table = clients;
    protected entityName = 'client';

    protected getTableName(): string {
        return 'clients';
    }

    /**
     * Override findAll to handle text search with 'q' parameter
     */
    async findAll(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ items: Client[]; total: number }> {
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
                ilike(clients.name, searchTerm),
                ilike(clients.billingEmail, searchTerm)
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
            const [items, total] = await Promise.all([
                db.select().from(this.table).where(finalWhereClause).limit(pageSize).offset(offset),
                this.count(where, tx)
            ]);

            return { items: items as Client[], total };
        }

        const items = (await db.select().from(this.table).where(finalWhereClause)) || [];
        return { items: items as Client[], total: items.length };
    }

    /**
     * Find client by user ID
     */
    async findByUser(userId: string, tx?: NodePgDatabase<typeof schema>): Promise<Client | null> {
        const db = this.getClient(tx);

        const result = await db.select().from(this.table).where(eq(clients.userId, userId));

        return result.length > 0 ? (result[0] as Client) : null;
    }

    /**
     * Find clients with active subscriptions
     */
    async findWithActiveSubscriptions(tx?: NodePgDatabase<typeof schema>): Promise<Client[]> {
        const db = this.getClient(tx);

        // For now, return all clients (subscription table doesn't exist yet)
        const result = await db.select().from(this.table);
        return result as Client[];
    }

    /**
     * Get billing statistics for a client
     */
    async getBillingStats(
        clientId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{
        totalInvoices: number;
        totalPaid: number;
        totalOverdue: number;
        totalAmount: number;
        paidAmount: number;
        overdueAmount: number;
    }> {
        // For now, return mock data (invoice table doesn't exist yet)
        // TODO [952d6d53-87a5-47ed-a51d-b01b2fa4dd35]: Implement when invoice tables are available
        void clientId;
        void tx;

        return {
            totalInvoices: 0,
            totalPaid: 0,
            totalOverdue: 0,
            totalAmount: 0,
            paidAmount: 0,
            overdueAmount: 0
        };
    }

    /**
     * Check if client has active subscriptions
     */
    async hasActiveSubscriptions(
        clientId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<boolean> {
        // For now, return false (subscription table doesn't exist yet)
        // TODO [744fa45c-f98f-443c-a271-9541ed649d17]: Implement when subscription tables are available
        void clientId;
        void tx;

        return false;
    }

    /**
     * Query builders for complex queries
     */

    /**
     * Add user join to query
     */
    withUser(query: unknown): unknown {
        // TODO [63beffc9-f88e-46f5-a04d-57ae3c350fff]: Implement when subscription tables are available
        return query;
    }

    /**
     * Add subscriptions join to query
     */
    withSubscriptions(query: unknown): unknown {
        // TODO [33cc3a1b-a7d5-4d1d-9016-f52c527f57f2]: Implement when subscription tables are available
        return query;
    }

    /**
     * Add access rights join to query
     */
    withAccessRights(query: unknown): unknown {
        // TODO [0d518782-8da2-4dd7-87c2-28b7a17b34ea]: Implement when subscription tables are available
        return query;
    }
}
