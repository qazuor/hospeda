import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import type { BaseSelectFilter } from 'src/types/db.types';
import { db } from '../client';
import { rolePermissions } from '../schema/r_role_permission.dbschema';
import { assertExists, castReturning, rawSelect } from '../utils/db-utils';

/**
 * Scoped logger for role-permission relation model operations.
 */
const log = logger.createLogger('RolePermissionModel');

/**
 * Full role-permission relation record as returned by the database.
 */
export type RolePermissionRecord = InferSelectModel<typeof rolePermissions>;

/**
 * Data required to create a new role-permission relation.
 */
export type CreateRolePermissionData = InferInsertModel<typeof rolePermissions>;

/**
 * RolePermissionModel provides CRUD operations for the r_role_permission table.
 */
export const RolePermissionModel = {
    /**
     * Create a new role-permission relation.
     *
     * @param data - Fields required to create the relation
     * @returns The created relation record
     */
    async createRelation(data: CreateRolePermissionData): Promise<RolePermissionRecord> {
        try {
            log.info('creating role-permission relation', 'createRelation', data);
            const rows = castReturning<RolePermissionRecord>(
                await db.insert(rolePermissions).values(data).returning()
            );
            const relation = assertExists(rows[0], 'createRelation: no record returned');
            log.query('insert', 'r_role_permission', data, relation);
            return relation;
        } catch (error) {
            log.error('createRelation failed', 'createRelation', error);
            throw error;
        }
    },

    /**
     * List relations by role ID.
     *
     * @param roleId - UUID of the role
     * @param filter - Pagination options
     * @returns Array of relation records
     */
    async listByRole(roleId: string, filter?: BaseSelectFilter): Promise<RolePermissionRecord[]> {
        try {
            log.info('listing role-permission relations by role', 'listByRole', { roleId, filter });

            let query = rawSelect(
                db.select().from(rolePermissions).where(eq(rolePermissions.roleId, roleId))
            );

            if (filter) {
                query = query
                    .limit(filter.limit ?? 20)
                    .offset(filter.offset ?? 0)
                    .orderBy(rolePermissions.permissionId, 'asc');
            }

            const rows = (await query) as RolePermissionRecord[];
            log.query('select', 'r_role_permission', { roleId, filter }, rows);
            return rows;
        } catch (error) {
            log.error('listByRole failed', 'listByRole', error);
            throw error;
        }
    },

    /**
     * List relations by permission ID.
     *
     * @param permissionId - UUID of the permission
     * @param filter - Pagination options
     * @returns Array of relation records
     */
    async listByPermission(
        permissionId: string,
        filter?: BaseSelectFilter
    ): Promise<RolePermissionRecord[]> {
        try {
            log.info('listing role-permission relations by permission', 'listByPermission', {
                permissionId,
                filter
            });

            let query = rawSelect(
                db
                    .select()
                    .from(rolePermissions)
                    .where(eq(rolePermissions.permissionId, permissionId))
            );

            if (filter) {
                query = query
                    .limit(filter.limit ?? 20)
                    .offset(filter.offset ?? 0)
                    .orderBy(rolePermissions.roleId, 'asc');
            }

            const rows = (await query) as RolePermissionRecord[];
            log.query('select', 'r_role_permission', { permissionId, filter }, rows);
            return rows;
        } catch (error) {
            log.error('listByPermission failed', 'listByPermission', error);
            throw error;
        }
    },

    /**
     * Delete a role-permission relation.
     *
     * @param roleId - UUID of the role
     * @param permissionId - UUID of the permission
     */
    async deleteRelation(roleId: string, permissionId: string): Promise<void> {
        try {
            log.info('deleting role-permission relation', 'deleteRelation', {
                roleId,
                permissionId
            });
            await db
                .delete(rolePermissions)
                .where(
                    and(
                        eq(rolePermissions.roleId, roleId),
                        eq(rolePermissions.permissionId, permissionId)
                    )
                );
            log.query('delete', 'r_role_permission', { roleId, permissionId }, { deleted: true });
        } catch (error) {
            log.error('deleteRelation failed', 'deleteRelation', error);
            throw error;
        }
    }
};
