import type { RolePermissionAssignment } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { rolePermission } from '../../schemas/user/r_role_permission.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { warnUnknownRelationKeys } from '../../utils/relations-validator.ts';

export class RRolePermissionModel extends BaseModelImpl<RolePermissionAssignment> {
    protected table = rolePermission;
    public entityName = 'rolePermission';

    protected override readonly validRelationKeys = ['role', 'permission'] as const;

    protected getTableName(): string {
        return 'rolePermission';
    }

    /**
     * Finds a RRolePermission with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { role: true })
     * @param tx - Optional transaction client
     * @returns Promise resolving to the entity with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<RolePermissionAssignment | null> {
        warnUnknownRelationKeys(relations, this.validRelationKeys, this.entityName);
        try {
            const withObj: Record<string, true> = {};
            for (const key of ['role', 'permission']) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const db = this.getClient(tx);
                const result = await db.query.rolePermission.findFirst({
                    where: (fields, { eq }) => eq(fields.role, where.role as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as RolePermissionAssignment | null;
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

/** Singleton instance of RRolePermissionModel for use across the application. */
export const rRolePermissionModel = new RRolePermissionModel();
