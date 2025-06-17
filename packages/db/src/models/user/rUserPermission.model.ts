import type { UserPermissionAssignmentType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { getDb } from '../../client';
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
     * @returns Promise resolving to the entity with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<UserPermissionAssignmentType | null> {
        const db = getDb();
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
