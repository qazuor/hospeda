import type { RolePermissionAssignment } from '@repo/schemas';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import type * as schema from '../../schemas/index.js';
import { rolePermission } from '../../schemas/user/r_role_permission.dbschema';
import { DbError } from '../../utils/error';
import { logError, logQuery } from '../../utils/logger';

export class RRolePermissionModel extends BaseModel<RolePermissionAssignment> {
    protected table = rolePermission;
    protected entityName = 'rolePermission';

    /**
     * Finds a RRolePermission with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { role: true })
     * @param tx - Optional transaction client
     * @returns Promise resolving to the entity with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<RolePermissionAssignment | null> {
        const db = this.getClient(tx);
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
