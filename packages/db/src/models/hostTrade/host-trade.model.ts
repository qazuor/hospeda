import type { HostTrade, HostTradeCategoryRef } from '@repo/schemas';
import { and, asc, eq, inArray, isNull, notInArray, type SQL, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { hostTrades } from '../../schemas/host-trade/host_trade.dbschema.ts';
import { hostTradeCategories } from '../../schemas/host-trade/host-trade-category.dbschema.ts';
import { hostTradeCategoryGroups } from '../../schemas/host-trade/host-trade-category-group.dbschema.ts';
import { rHostTradeCategory } from '../../schemas/host-trade/r_host_trade_category.dbschema.ts';
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
     * Rows are ordered by `name ASC` only (HOS-919): a provider now holds
     * several categories, so the directory no longer orders by category.
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
                .orderBy(asc(hostTrades.name));

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

    /**
     * Builds the any-of category filter as a SQL condition for the
     * `additionalConditions` of `findAll` / `count` (HOS-919). The key-value
     * `where` map cannot express it.
     *
     * The condition is
     * `EXISTS (SELECT 1 FROM r_host_trade_category r JOIN host_trade_categories c
     * ON c.id = r.category_id WHERE r.host_trade_id = host_trades.id AND c.slug IN (...))`.
     * Being an `EXISTS` (not a join) a provider holding several of the
     * requested categories matches ONCE. Unknown slugs simply match nothing,
     * so a list of only unknown slugs yields an empty result.
     *
     * An EMPTY `categorySlugs` list matches NOTHING (fail closed): "no filter"
     * is the caller's decision and must be expressed by not adding the
     * condition at all.
     *
     * The condition correlates against the outer `host_trades` table, so it
     * only works in a query that selects from `host_trades` without an alias.
     * It does not filter on the category's lifecycle state or soft-delete: a
     * provider keeps matching a category that was deactivated after linking.
     *
     * @param input.categorySlugs - Category slugs; a provider matches if it has ANY of them.
     * @returns A SQL condition to AND into the provider query.
     */
    buildCategoriesFilterCondition(input: { readonly categorySlugs: readonly string[] }): SQL {
        const { categorySlugs } = input;
        if (categorySlugs.length === 0) return sql`false`;

        return sql`exists (
            select 1
            from ${rHostTradeCategory}
            inner join ${hostTradeCategories}
                on ${hostTradeCategories.id} = ${rHostTradeCategory.categoryId}
            where ${rHostTradeCategory.hostTradeId} = ${hostTrades.id}
                and ${inArray(hostTradeCategories.slug, [...categorySlugs])}
        )`;
    }

    /**
     * Loads the categories of many providers with ONE query (no N+1).
     *
     * Every requested id appears in the returned map; a provider without
     * categories maps to `[]`. Each list is in catalog order: group
     * `displayWeight`, category `displayWeight`, then slug.
     *
     * Soft-deleted categories are skipped. INACTIVE categories are kept on
     * purpose: a provider that has one still shows it on its card (AC-3.3).
     *
     * An empty `hostTradeIds` returns an empty map without querying.
     *
     * @param input.hostTradeIds - Host-trade UUIDs to hydrate.
     * @param input.tx - Optional transaction client.
     * @returns Map from host-trade id to its ordered category refs.
     * @throws DbError if the database query fails.
     */
    async hydrateCategories(input: {
        readonly hostTradeIds: readonly string[];
        readonly tx?: DrizzleClient;
    }): Promise<Map<string, HostTradeCategoryRef[]>> {
        const { hostTradeIds, tx } = input;
        const result = new Map<string, HostTradeCategoryRef[]>();
        if (hostTradeIds.length === 0) return result;

        const db = this.getClient(tx);
        const logContext = { count: hostTradeIds.length };

        try {
            const rows = await db
                .select({
                    hostTradeId: rHostTradeCategory.hostTradeId,
                    id: hostTradeCategories.id,
                    slug: hostTradeCategories.slug,
                    nameI18n: hostTradeCategories.nameI18n,
                    groupSlug: hostTradeCategoryGroups.slug
                })
                .from(rHostTradeCategory)
                .innerJoin(
                    hostTradeCategories,
                    eq(hostTradeCategories.id, rHostTradeCategory.categoryId)
                )
                .innerJoin(
                    hostTradeCategoryGroups,
                    eq(hostTradeCategoryGroups.id, hostTradeCategories.groupId)
                )
                .where(
                    and(
                        inArray(rHostTradeCategory.hostTradeId, [...hostTradeIds]),
                        isNull(hostTradeCategories.deletedAt)
                    )
                )
                .orderBy(
                    asc(hostTradeCategoryGroups.displayWeight),
                    asc(hostTradeCategories.displayWeight),
                    asc(hostTradeCategories.slug)
                );

            for (const id of hostTradeIds) result.set(id, []);
            for (const { hostTradeId, ...ref } of rows) {
                result.get(hostTradeId)?.push(ref);
            }

            try {
                logQuery(this.entityName, 'hydrateCategories', logContext, rows);
            } catch {}

            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'hydrateCategories', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'hydrateCategories', logContext, err.message, err);
        }
    }

    /**
     * Makes the provider's category links equal `categoryIds`: deletes the
     * links not in the set and inserts the missing ones (HOS-919 AC-4.2).
     *
     * Both statements run on the CALLER's transaction, so the replacement is
     * atomic with whatever else the caller writes there (typically the
     * provider row). `tx` is required on purpose: without it the delete and
     * the insert would not be atomic. Duplicate ids are collapsed; an unchanged
     * set deletes and inserts nothing. An empty set removes every link (the
     * 1..10 bound is the service's rule, not the model's).
     *
     * Existence, lifecycle and size of `categoryIds` are NOT validated here: an
     * unknown id fails the foreign key and throws, which rolls the caller's
     * transaction back.
     *
     * @param input.hostTradeId - Host-trade UUID.
     * @param input.categoryIds - The complete desired category set.
     * @param input.tx - The caller's transaction client.
     * @returns The ids that were added and removed.
     * @throws DbError if a statement fails (including an FK violation).
     */
    async replaceCategories(input: {
        readonly hostTradeId: string;
        readonly categoryIds: readonly string[];
        readonly tx: DrizzleClient;
    }): Promise<{ added: string[]; removed: string[] }> {
        const { hostTradeId, tx } = input;
        const categoryIds = [...new Set(input.categoryIds)];
        const logContext = { hostTradeId, categoryIds };

        try {
            const deleteWhere =
                categoryIds.length === 0
                    ? eq(rHostTradeCategory.hostTradeId, hostTradeId)
                    : and(
                          eq(rHostTradeCategory.hostTradeId, hostTradeId),
                          notInArray(rHostTradeCategory.categoryId, categoryIds)
                      );
            const removedRows = await tx
                .delete(rHostTradeCategory)
                .where(deleteWhere)
                .returning({ categoryId: rHostTradeCategory.categoryId });

            const addedRows =
                categoryIds.length === 0
                    ? []
                    : await tx
                          .insert(rHostTradeCategory)
                          .values(categoryIds.map((categoryId) => ({ hostTradeId, categoryId })))
                          .onConflictDoNothing()
                          .returning({ categoryId: rHostTradeCategory.categoryId });

            const outcome = {
                added: addedRows.map((r) => r.categoryId),
                removed: removedRows.map((r) => r.categoryId)
            };

            try {
                logQuery(this.entityName, 'replaceCategories', logContext, outcome);
            } catch {}

            return outcome;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'replaceCategories', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'replaceCategories', logContext, err.message, err);
        }
    }
}

/** Singleton instance of HostTradeModel for use across the application. */
export const hostTradeModel = new HostTradeModel();
