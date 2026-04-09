import type { UserPermissionAssignment } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { userPermission } from '../../schemas/user/r_user_permission.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

export class RUserPermissionModel extends BaseModelImpl<UserPermissionAssignment> {
    protected table = userPermission;
    public entityName = 'userPermission';

    protected getTableName(): string {
        return 'rUserPermissions';
    }

    /**
     * Finds a RUserPermission with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { user: true })
     * @param tx - Optional transaction client
     * @returns Promise resolving to the entity with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<UserPermissionAssignment | null> {
        const db = this.getClient(tx);
        try {
            const withObj: Record<string, true> = {};
            for (const key of ['user', 'permission']) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const result = await db.query.userPermission.findFirst({
                    where: (fields, { eq }) => eq(fields.userId, where.userId as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as unknown as UserPermissionAssignment | null;
            }
            const result = await this.findOne(where, tx);
            logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'findWithRelations', { where, relations }, error as Error);
            throw new DbError(
                this.entityName,
                'findWithRelations',
                { where, relations },
                (error as Error).message
            );
        }
    }
}

/** Singleton instance of RUserPermissionModel for use across the application. */
export const rUserPermissionModel = new RUserPermissionModel();
