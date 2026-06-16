import type { HostTrade } from '@repo/schemas';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { hostTrades } from '../../schemas/host-trade/host_trade.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Model for the `host_trades` table.
 *
 * Provides standard CRUD (inherited from BaseModelImpl) plus a
 * domain-specific `findForHost` query that returns active, non-deleted
 * trade entries for a given set of destination IDs, ordered for display
 * in the host directory.
 */
export class HostTradeModel extends BaseModelImpl<HostTrade> {
    protected table = hostTrades;
    public entityName = 'hostTrade';

    protected getTableName(): string {
        return 'hostTrades';
    }

    /**
     * Returns all active, non-deleted host-trade entries whose
     * `destinationId` is in the provided list.
     *
     * Rows are ordered by `category ASC, name ASC` so callers can
     * render a grouped directory without a secondary sort step.
     *
     * An empty `destinationIds` array returns `[]` immediately without
     * issuing a `WHERE IN ()` query to the database (which is invalid SQL
     * in PostgreSQL).
     *
     * @param destinationIds - Array of destination UUIDs to filter by.
     * @param tx - Optional transaction client. When supplied, the query
     *   executes within the caller's transaction.
     * @returns Promise resolving to an array of matching HostTrade rows.
     * @throws DbError if the database query fails.
     */
    async findForHost(destinationIds: string[], tx?: DrizzleClient): Promise<HostTrade[]> {
        if (destinationIds.length === 0) return [];

        const db = this.getClient(tx);
        const logContext = { destinationIds, count: destinationIds.length };

        try {
            const results = await db
                .select()
                .from(hostTrades)
                .where(
                    and(
                        inArray(hostTrades.destinationId, destinationIds),
                        eq(hostTrades.isActive, true),
                        isNull(hostTrades.deletedAt)
                    )
                )
                .orderBy(asc(hostTrades.category), asc(hostTrades.name));

            try {
                logQuery(this.entityName, 'findForHost', logContext, results);
            } catch {}

            return results as HostTrade[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findForHost', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findForHost', logContext, err.message);
        }
    }
}

/** Singleton instance of HostTradeModel for use across the application. */
export const hostTradeModel = new HostTradeModel();
