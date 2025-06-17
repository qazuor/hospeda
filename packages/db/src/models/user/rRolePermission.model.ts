import type { RolePermissionAssignmentType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { getDb } from '../../client';
import { rolePermission } from '../../schemas/user/r_role_permission.dbschema';
import { DbError } from '../../utils/error';
import { logError, logQuery } from '../../utils/logger';

export class RRolePermissionModel extends BaseModel<RolePermissionAssignmentType> {
    protected table = rolePermission;
    protected entityName = 'rolePermission';

    /**
     * Finds a RRolePermission with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { role: true })
     * @returns Promise resolving to the entity with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<RolePermissionAssignmentType | null> {
        const db = getDb();
        try {
            const withObj: Record<string, true> = {};
            for (const key of ['role', 'permission']) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const result = await db.query.rolePermission.findFirst({
                    where: (fields, { eq }) => eq(fields.role, where.role as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as RolePermissionAssignmentType | null;
            }
            const result = await this.findOne(where);
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
