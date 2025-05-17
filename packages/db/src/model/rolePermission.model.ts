import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import { db } from '../client.js';
import { rolePermissions } from '../schema/r_role_permission.dbschema.js';
import type { BaseSelectFilter } from '../types/db-types.js';
import { assertExists, castReturning, rawSelect } from '../utils/db-utils.js';

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
    },

    /**
     * Get a role-permission relation by role ID and permission ID.
     * This checks for the existence of a specific relation.
     * @param roleId - The ID of the role.
     * @param permissionId - The ID of the permission.
     * @returns The relation record if found, undefined otherwise.
     * @throws Error if the database query fails.
     */
    async getByRoleIdAndPermissionId(
        roleId: string,
        permissionId: string
    ): Promise<RolePermissionRecord | undefined> {
        log.debug('checking role-permission relation existence', 'getByRoleIdAndPermissionId', {
            roleId,
            permissionId
        });
        try {
            const [relation] = await db
                .select()
                .from(rolePermissions)
                .where(
                    and(
                        eq(rolePermissions.roleId, roleId),
                        eq(rolePermissions.permissionId, permissionId)
                    )
                )
                .limit(1); // Limit to 1 as we only need to know if it exists

            log.debug('role-permission relation check result', 'getByRoleIdAndPermissionId', {
                roleId,
                permissionId,
                exists: !!relation
            });
            return relation;
        } catch (error) {
            log.error(
                'failed to check role-permission relation existence',
                'getByRoleIdAndPermissionId',
                error,
                { roleId, permissionId }
            );
            throw error;
        }
    },

    /**
     * Delete all role-permission relations for a given role ID.
     * @param roleId - The ID of the role.
     * @throws Error if deletion fails.
     */
    async deleteAllByRoleId(roleId: string): Promise<void> {
        log.info('deleting all role-permission relations for role', 'deleteAllByRoleId', {
            roleId
        });
        try {
            await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
            log.info(
                'all role-permission relations for role deleted successfully',
                'deleteAllByRoleId',
                { roleId }
            );
        } catch (error) {
            log.error(
                'failed to delete all role-permission relations for role',
                'deleteAllByRoleId',
                error,
                { roleId }
            );
            throw error;
        }
    }
};
