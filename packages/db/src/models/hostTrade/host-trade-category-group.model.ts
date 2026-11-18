import type { HostTradeCategoryGroup } from '@repo/schemas';
import { and, count, eq, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { hostTradeCategories } from '../../schemas/host-trade/host-trade-category.dbschema.ts';
import { hostTradeCategoryGroups } from '../../schemas/host-trade/host-trade-category-group.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Model for the `host_trade_category_groups` table (HOS-919): the top level of
 * the editable provider-trade catalog. Standard `BaseModelImpl` CRUD plus the
 * child count the service needs to refuse deleting a group that still has
 * categories.
 */
export class HostTradeCategoryGroupModel extends BaseModelImpl<HostTradeCategoryGroup> {
    protected table = hostTradeCategoryGroups;
    public entityName = 'hostTradeCategoryGroup';

    protected getTableName(): string {
        return 'hostTradeCategoryGroups';
    }

    /**
     * Counts the categories of a group that are not soft-deleted, whatever
     * their lifecycle state. A group with such a category cannot be deleted
     * (AC-3.4): an inactive category still belongs to the group and can be
     * reactivated.
     *
     * @param groupId - Group UUID.
     * @param tx - Optional transaction client.
     * @returns Number of non-deleted categories in the group.
     * @throws DbError if the database query fails.
     */
    async countActiveChildren(groupId: string, tx?: DrizzleClient): Promise<number> {
        const db = this.getClient(tx);
        const logContext = { groupId };

        try {
            const [row] = await db
                .select({ total: count() })
                .from(hostTradeCategories)
                .where(
                    and(
                        eq(hostTradeCategories.groupId, groupId),
                        isNull(hostTradeCategories.deletedAt)
                    )
                );
            const total = row?.total ?? 0;

            try {
                logQuery(this.entityName, 'countActiveChildren', logContext, total);
            } catch {}

            return total;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'countActiveChildren', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'countActiveChildren', logContext, err.message, err);
        }
    }

    /**
     * Loads a group with `SELECT ... FOR SHARE`, holding a row lock until the
     * transaction ends. A category create, move or restore calls this to check
     * the group is usable: the lock conflicts with the `FOR UPDATE` of
     * {@link lockForUpdate} (the group delete), so a group cannot be deleted
     * between the check and the write that depends on it. The later transaction
     * sees the earlier one's committed result.
     *
     * Must run on a transaction client to be meaningful.
     *
     * @param groupId - Group UUID.
     * @param tx - Transaction client holding the lock.
     * @returns The group (possibly soft-deleted, the caller checks), or `null`.
     * @throws DbError if the database query fails.
     */
    async findByIdForShare(
        groupId: string,
        tx?: DrizzleClient
    ): Promise<HostTradeCategoryGroup | null> {
        const db = this.getClient(tx);
        const logContext = { groupId };
        try {
            const rows = await db
                .select()
                .from(hostTradeCategoryGroups)
                .where(eq(hostTradeCategoryGroups.id, groupId))
                .for('share');
            return (rows[0] as HostTradeCategoryGroup | undefined) ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findByIdForShare', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findByIdForShare', logContext, err.message, err);
        }
    }

    /**
     * Locks the group row (`SELECT ... FOR UPDATE`) for the rest of the
     * transaction, so the child count that follows and the soft delete cannot
     * be overtaken by a category write that validated the group with
     * {@link findByIdForShare}.
     *
     * Must run on a transaction client to be meaningful.
     *
     * @param groupId - Group UUID.
     * @param tx - Transaction client holding the lock.
     * @returns `true` when the row exists (and is now locked).
     * @throws DbError if the database query fails.
     */
    async lockForUpdate(groupId: string, tx?: DrizzleClient): Promise<boolean> {
        const db = this.getClient(tx);
        const logContext = { groupId };
        try {
            const rows = await db
                .select({ id: hostTradeCategoryGroups.id })
                .from(hostTradeCategoryGroups)
                .where(eq(hostTradeCategoryGroups.id, groupId))
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
}

/** Singleton instance of HostTradeCategoryGroupModel for use across the application. */
export const hostTradeCategoryGroupModel = new HostTradeCategoryGroupModel();
