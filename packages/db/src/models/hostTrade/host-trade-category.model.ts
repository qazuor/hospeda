import type {
    HostTradeCategory,
    PublicHostTradeCatalog,
    PublicHostTradeCategoryGroup
} from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { and, asc, count, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { hostTrades } from '../../schemas/host-trade/host_trade.dbschema.ts';
import { hostTradeCategories } from '../../schemas/host-trade/host-trade-category.dbschema.ts';
import { hostTradeCategoryGroups } from '../../schemas/host-trade/host-trade-category-group.dbschema.ts';
import { rHostTradeCategory } from '../../schemas/host-trade/r_host_trade_category.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { buildWhereClause } from '../../utils/drizzle-helpers.ts';
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
    /** Admin catalog: restore keeps an admin-set INACTIVE state (HOS-2366). */
    protected override readonly restoreKeepsLifecycleState = true;
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
     * Admin list page with the catalog's default order (HOS-2340 D3): group
     * `display_weight`, group Spanish name and id (so groups sharing a weight do not
     * interleave), category `display_weight`, Spanish name and `id` as the final
     * tie-break, which keeps pagination stable. Names are compared as
     * `lower(unaccent(...))`: that removes accents and case, but the comparison itself
     * still uses the database collation.
     *
     * The join to the group exists only to order; it carries no `deleted_at`
     * filter, so a category under a soft-deleted group is still listed when the
     * caller asks for it. Only category columns are selected, so the output has
     * the same shape as `findAll`.
     *
     * @param input.where - Column equality map, translated like `findAll` does.
     * @param input.additionalConditions - Extra SQL conditions (admin text search).
     * @param input.page - 1-based page.
     * @param input.pageSize - Page size (capped at 200, like `findAll`).
     * @param input.tx - Optional transaction client.
     * @returns The page of categories and the total of the filtered rows.
     * @throws DbError if the database query fails.
     */
    async findAdminPage(input: {
        readonly where: Record<string, unknown>;
        readonly additionalConditions?: readonly SQL[];
        readonly page: number;
        readonly pageSize: number;
        readonly tx?: DrizzleClient;
    }): Promise<{ items: HostTradeCategory[]; total: number }> {
        const db = this.getClient(input.tx);
        const pageSize = Math.min(input.pageSize, 200);
        const offset = (input.page - 1) * pageSize;
        const logContext = { where: input.where, page: input.page, pageSize };

        try {
            const conditions = [
                buildWhereClause(input.where, hostTradeCategories),
                ...(input.additionalConditions ?? [])
            ].filter((condition): condition is SQL => condition !== undefined);
            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

            const [rows, totals] = await Promise.all([
                db
                    .select({ category: hostTradeCategories })
                    .from(hostTradeCategories)
                    .innerJoin(
                        hostTradeCategoryGroups,
                        eq(hostTradeCategories.groupId, hostTradeCategoryGroups.id)
                    )
                    .where(whereClause)
                    .orderBy(
                        asc(hostTradeCategoryGroups.displayWeight),
                        // Groups sharing a weight must not interleave their categories.
                        asc(sql`lower(unaccent(${hostTradeCategoryGroups.nameI18n} ->> 'es'))`),
                        asc(hostTradeCategoryGroups.id),
                        asc(hostTradeCategories.displayWeight),
                        asc(sql`lower(unaccent(${hostTradeCategories.nameI18n} ->> 'es'))`),
                        asc(hostTradeCategories.id)
                    )
                    .limit(pageSize)
                    .offset(offset),
                db.select({ total: count() }).from(hostTradeCategories).where(whereClause)
            ]);

            const result = {
                items: rows.map((row) => row.category) as HostTradeCategory[],
                total: totals[0]?.total ?? 0
            };
            try {
                logQuery(this.entityName, 'findAdminPage', logContext, result);
            } catch {}
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findAdminPage', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findAdminPage', logContext, err.message, err);
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
     * Returns the ids, out of `categoryIds`, whose GROUP is soft-deleted. Such a
     * category is unreachable in the catalog (the public catalog and the admin
     * tree hide it with its group), so it can be neither assigned to a provider
     * nor restored (HOS-919 review).
     *
     * @param categoryIds - Category UUIDs to check.
     * @param tx - Optional transaction client.
     * @returns The subset of ids whose group has `deleted_at` set.
     * @throws DbError if the database query fails.
     */
    async findIdsInDeletedGroups(
        categoryIds: readonly string[],
        tx?: DrizzleClient
    ): Promise<string[]> {
        if (categoryIds.length === 0) return [];
        const db = this.getClient(tx);
        const logContext = { categoryIds };
        try {
            const rows = await db
                .select({ id: hostTradeCategories.id })
                .from(hostTradeCategories)
                .innerJoin(
                    hostTradeCategoryGroups,
                    eq(hostTradeCategoryGroups.id, hostTradeCategories.groupId)
                )
                .where(
                    and(
                        inArray(hostTradeCategories.id, [...categoryIds]),
                        isNotNull(hostTradeCategoryGroups.deletedAt)
                    )
                );
            return rows.map((row) => row.id);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findIdsInDeletedGroups', logContext, err);
            } catch {}
            throw new DbError(
                this.entityName,
                'findIdsInDeletedGroups',
                logContext,
                err.message,
                err
            );
        }
    }

    /**
     * Loads categories by id with `SELECT ... FOR SHARE`, holding a row lock until
     * the transaction ends. A provider write calls this to validate the ids it is
     * about to link: the lock conflicts with the `FOR UPDATE` that
     * {@link lockForUpdate} takes in the category delete, so the two serialize and
     * the later one sees the earlier one's committed result (a link written before
     * the delete makes the delete answer CATEGORY_IN_USE; a delete committed first
     * makes this read return `deletedAt`, so the link is refused).
     *
     * The foreign key on the join table does NOT protect against this: a soft
     * delete only sets `deleted_at` and leaves the row in place, so the foreign
     * key is still satisfied. Soft-deleted and inactive rows are returned, the
     * caller validates them.
     *
     * Must run on a transaction client to be meaningful.
     *
     * @param categoryIds - Category UUIDs to load and lock.
     * @param tx - Transaction client holding the lock.
     * @returns The matching rows.
     * @throws DbError if the database query fails.
     */
    async findByIdsForShare(
        categoryIds: readonly string[],
        tx?: DrizzleClient
    ): Promise<HostTradeCategory[]> {
        if (categoryIds.length === 0) return [];
        const db = this.getClient(tx);
        const logContext = { categoryIds };
        try {
            const rows = await db
                .select()
                .from(hostTradeCategories)
                .where(inArray(hostTradeCategories.id, [...categoryIds]))
                .for('share');
            return rows as HostTradeCategory[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findByIdsForShare', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findByIdsForShare', logContext, err.message, err);
        }
    }

    /**
     * Locks the category row (`SELECT ... FOR UPDATE`) for the rest of the
     * transaction. It serializes the category delete with every provider write
     * that validates its ids through {@link findByIdsForShare} (`FOR UPDATE`
     * conflicts with `FOR SHARE`): whichever transaction comes second waits and
     * then sees the first one's committed result. The foreign key on the join
     * table is NOT what protects this, because a soft delete leaves the row in
     * place and the key stays satisfied.
     *
     * Must run on a transaction client to be meaningful.
     *
     * @param categoryId - Category UUID.
     * @param tx - Transaction client holding the lock.
     * @returns `true` when the row exists (and is now locked).
     * @throws DbError if the database query fails.
     */
    async lockForUpdate(categoryId: string, tx?: DrizzleClient): Promise<boolean> {
        const db = this.getClient(tx);
        const logContext = { categoryId };
        try {
            const rows = await db
                .select({ id: hostTradeCategories.id })
                .from(hostTradeCategories)
                .where(eq(hostTradeCategories.id, categoryId))
                .for('update');
            return rows.length > 0;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'lockForUpdate', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'lockForUpdate', logContext, err.message, err);
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
