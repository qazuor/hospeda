import type { UserPermissionAssignmentType } from '@repo/types';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import type * as schema from '../../schemas/index.js';
import { userPermission } from '../../schemas/user/r_user_permission.dbschema';
import { DbError } from '../../utils/error';
import { logError, logQuery } from '../../utils/logger';

export class RUserPermissionModel extends BaseModel<UserPermissionAssignmentType> {
    protected table = userPermission;
    protected entityName = 'userPermission';

    /**
     * Finds a RUserPermission with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { user: true })
     * @param tx - Optional transaction client
     * @returns Promise resolving to the entity with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<UserPermissionAssignmentType | null> {
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
                return result as unknown as UserPermissionAssignmentType | null;
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
