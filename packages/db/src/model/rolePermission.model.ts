import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../client.js';
import { rolePermissions } from '../schema/r_role_permission.dbschema.js';
import type { BaseSelectFilter } from '../types/db-types.js';
import { assertExists, castReturning, rawSelect } from '../utils/db-utils.js';

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
            dbLogger.info(data, 'creating role-permission relation');
            const db = getDb();
            const rows = castReturning<RolePermissionRecord>(
                await db.insert(rolePermissions).values(data).returning()
            );
            const relation = assertExists(rows[0], 'createRelation: no record returned');
            dbLogger.query({
                table: 'r_role_permission',
                action: 'insert',
                params: data,
                result: relation
            });
            return relation;
        } catch (error) {
            dbLogger.error(error, 'createRelation failed');
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
            dbLogger.info(
                {
                    roleId,
                    filter
                },
                'listing role-permission relations by role'
            );
            const db = getDb();
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
            dbLogger.query({
                table: 'r_role_permission',
                action: 'select',
                params: { roleId, filter },
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listByRole failed');
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
            dbLogger.info(
                {
                    permissionId,
                    filter
                },
                'listing role-permission relations by permission'
            );
            const db = getDb();
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
            dbLogger.query({
                table: 'r_role_permission',
                action: 'select',
                params: { permissionId, filter },
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listByPermission failed');
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
            dbLogger.info({ roleId, permissionId }, 'deleting role-permission relation');
            const db = getDb();
            await db
                .delete(rolePermissions)
                .where(
                    and(
                        eq(rolePermissions.roleId, roleId),
                        eq(rolePermissions.permissionId, permissionId)
                    )
                );
            dbLogger.query({
                table: 'r_role_permission',
                action: 'delete',
                params: { roleId, permissionId },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'deleteRelation failed');
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
        dbLogger.debug(
            {
                roleId,
                permissionId
            },
            'checking role-permission relation existence'
        );
        try {
            const db = getDb();
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

            dbLogger.debug(
                {
                    roleId,
                    permissionId,
                    exists: !!relation
                },
                'role-permission relation check result'
            );
            return relation;
        } catch (error) {
            dbLogger.error(error, 'failed to check role-permission relation existence');
            throw error;
        }
    },

    /**
     * Delete all role-permission relations for a given role ID.
     * @param roleId - The ID of the role.
     * @throws Error if deletion fails.
     */
    async deleteAllByRoleId(roleId: string): Promise<void> {
        dbLogger.info({ roleId }, 'deleting all role-permission relations for role');
        try {
            const db = getDb();
            await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
            dbLogger.info(
                { roleId },
                'all role-permission relations for role deleted successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to delete all role-permission relations for role');
            throw error;
        }
    }
};
