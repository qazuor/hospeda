import type {
    HostTradeCategory,
    PublicHostTradeCatalog,
    PublicHostTradeCategoryGroup
} from '@repo/schemas';
import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { hostTrades } from '../../schemas/host-trade/host_trade.dbschema.ts';
import { hostTradeCategories } from '../../schemas/host-trade/host-trade-category.dbschema.ts';
import { hostTradeCategoryGroups } from '../../schemas/host-trade/host-trade-category-group.dbschema.ts';
import { rHostTradeCategory } from '../../schemas/host-trade/r_host_trade_category.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Model for the `host_trade_categories` table (HOS-919): the editable second
 * level of the provider-trade catalog. Besides standard `BaseModelImpl` CRUD
 * (including the inherited `findByIds`, which does NOT filter soft-deleted or
 * inactive rows, so callers validate those states themselves) it owns the
 * catalog reads the services and the public endpoint need.
 */
export class HostTradeCategoryModel extends BaseModelImpl<HostTradeCategory> {
    protected table = hostTradeCategories;
    public entityName = 'hostTradeCategory';

    protected getTableName(): string {
        return 'hostTradeCategories';
    }

    /**
     * Returns the public catalog: active groups, each with its active
     * categories, in ONE joined query.
     *
     * A row is included only when BOTH the category and its group are
     * `ACTIVE` and not soft-deleted, so a group whose categories are all
     * hidden does not appear as an empty header. Ordering is group
     * `displayWeight`, group name (`es`), then category `displayWeight`, name
     * (`es`) and slug. The `es` name is the DB-side tie-break; the client may
     * re-sort ties by the viewer's locale.
     *
     * @param tx - Optional transaction client.
     * @returns The nested catalog, already ordered.
     * @throws DbError if the database query fails.
     */
    async findPublicCatalog(tx?: DrizzleClient): Promise<PublicHostTradeCatalog> {
        const db = this.getClient(tx);
        const logContext = {};

        try {
            const rows = await db
                .select({
                    groupId: hostTradeCategoryGroups.id,
                    groupSlug: hostTradeCategoryGroups.slug,
                    groupNameI18n: hostTradeCategoryGroups.nameI18n,
                    groupDisplayWeight: hostTradeCategoryGroups.displayWeight,
                    id: hostTradeCategories.id,
                    slug: hostTradeCategories.slug,
                    nameI18n: hostTradeCategories.nameI18n,
                    keywordsI18n: hostTradeCategories.keywordsI18n,
                    displayWeight: hostTradeCategories.displayWeight
                })
                .from(hostTradeCategories)
                .innerJoin(
                    hostTradeCategoryGroups,
                    eq(hostTradeCategories.groupId, hostTradeCategoryGroups.id)
                )
                .where(
                    and(
                        eq(hostTradeCategories.lifecycleState, 'ACTIVE'),
                        isNull(hostTradeCategories.deletedAt),
                        eq(hostTradeCategoryGroups.lifecycleState, 'ACTIVE'),
                        isNull(hostTradeCategoryGroups.deletedAt)
                    )
                )
                .orderBy(
                    asc(hostTradeCategoryGroups.displayWeight),
                    asc(sql`${hostTradeCategoryGroups.nameI18n} ->> 'es'`),
                    asc(hostTradeCategoryGroups.slug),
                    asc(hostTradeCategories.displayWeight),
                    asc(sql`${hostTradeCategories.nameI18n} ->> 'es'`),
                    asc(hostTradeCategories.slug)
                );

            const groups = new Map<string, PublicHostTradeCategoryGroup>();
            for (const row of rows) {
                let group = groups.get(row.groupId);
                if (!group) {
                    group = {
                        slug: row.groupSlug,
                        nameI18n: row.groupNameI18n,
                        displayWeight: row.groupDisplayWeight,
                        categories: []
                    };
                    groups.set(row.groupId, group);
                }
                group.categories.push({
                    id: row.id,
                    slug: row.slug,
                    nameI18n: row.nameI18n,
                    displayWeight: row.displayWeight,
                    keywordsI18n: row.keywordsI18n ?? {}
                });
            }

            const catalog: PublicHostTradeCatalog = { groups: [...groups.values()] };

            try {
                logQuery(this.entityName, 'findPublicCatalog', logContext, catalog);
            } catch {}

            return catalog;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findPublicCatalog', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findPublicCatalog', logContext, err.message, err);
        }
    }

    /**
     * Returns the categories whose slug is in `slugs`, restricted to rows that
     * are `ACTIVE` and not soft-deleted. Unknown, inactive and deleted slugs
     * are silently absent, so callers compare lengths to detect them.
     *
     * An empty `slugs` array returns `[]` without querying.
     *
     * @param slugs - Category slugs to resolve.
     * @param tx - Optional transaction client.
     * @returns The matching active categories (no particular order).
     * @throws DbError if the database query fails.
     */
    async findActiveBySlugs(
        slugs: readonly string[],
        tx?: DrizzleClient
    ): Promise<HostTradeCategory[]> {
        if (slugs.length === 0) return [];

        const db = this.getClient(tx);
        const logContext = { slugs, count: slugs.length };

        try {
            const results = await db
                .select()
                .from(hostTradeCategories)
                .where(
                    and(
                        inArray(hostTradeCategories.slug, [...slugs]),
                        eq(hostTradeCategories.lifecycleState, 'ACTIVE'),
                        isNull(hostTradeCategories.deletedAt)
                    )
                );

            try {
                logQuery(this.entityName, 'findActiveBySlugs', logContext, results);
            } catch {}

            return results as HostTradeCategory[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findActiveBySlugs', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findActiveBySlugs', logContext, err.message, err);
        }
    }

    /**
     * Counts the NON-DELETED host trades linked to a category. Soft-deleted
     * providers do not block deleting or deactivating a category (AC-3.4),
     * even though their join rows still exist (the FK restrict is the
     * hard-delete backstop).
     *
     * @param categoryId - Category UUID.
     * @param tx - Optional transaction client.
     * @returns Number of live host trades using the category.
     * @throws DbError if the database query fails.
     */
    async countLinkedHostTrades(categoryId: string, tx?: DrizzleClient): Promise<number> {
        const db = this.getClient(tx);
        const logContext = { categoryId };

        try {
            const [row] = await db
                .select({ total: count() })
                .from(rHostTradeCategory)
                .innerJoin(hostTrades, eq(hostTrades.id, rHostTradeCategory.hostTradeId))
                .where(
                    and(eq(rHostTradeCategory.categoryId, categoryId), isNull(hostTrades.deletedAt))
                );
            const total = row?.total ?? 0;

            try {
                logQuery(this.entityName, 'countLinkedHostTrades', logContext, total);
            } catch {}

            return total;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'countLinkedHostTrades', logContext, err);
            } catch {}
            throw new DbError(
                this.entityName,
                'countLinkedHostTrades',
                logContext,
                err.message,
                err
            );
        }
    }
}

/** Singleton instance of HostTradeCategoryModel for use across the application. */
export const hostTradeCategoryModel = new HostTradeCategoryModel();
