import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../client.js';
import { userPermissions } from '../schema/r_user_permission.dbschema.js';
import type { BaseSelectFilter } from '../types/db-types.js';
import { assertExists, castReturning, rawSelect } from '../utils/db-utils.js';

/**
 * Full user-permission relation record as returned by the database.
 */
export type UserPermissionRecord = InferSelectModel<typeof userPermissions>;

/**
 * Data required to create a new user-permission relation.
 */
export type CreateUserPermissionData = InferInsertModel<typeof userPermissions>;

/**
 * UserPermissionModel provides CRUD operations for the r_user_permission table.
 */
export const UserPermissionModel = {
    /**
     * Create a new user-permission relation.
     *
     * @param data - Fields required to create the relation
     * @returns The created relation record
     */
    async createRelation(data: CreateUserPermissionData): Promise<UserPermissionRecord> {
        try {
            dbLogger.info(data, 'creating user-permission relation');
            const db = getDb();
            const rows = castReturning<UserPermissionRecord>(
                await db.insert(userPermissions).values(data).returning()
            );
            const relation = assertExists(rows[0], 'createRelation: no record returned');
            dbLogger.query({
                table: 'r_user_permission',
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
     * List relations by user ID.
     *
     * @param userId - UUID of the user
     * @param filter - Pagination options
     * @returns Array of relation records
     */
    async listByUser(userId: string, filter?: BaseSelectFilter): Promise<UserPermissionRecord[]> {
        try {
            dbLogger.info(
                {
                    userId,
                    filter
                },
                'listing user-permission relations by user'
            );
            const db = getDb();
            let query = rawSelect(
                db.select().from(userPermissions).where(eq(userPermissions.userId, userId))
            );

            if (filter) {
                query = query
                    .limit(filter.limit ?? 20)
                    .offset(filter.offset ?? 0)
                    .orderBy(userPermissions.permissionId, 'asc');
            }

            const rows = (await query) as UserPermissionRecord[];
            dbLogger.query({
                table: 'r_user_permission',
                action: 'select',
                params: { userId, filter },
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listByUser failed');
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
    ): Promise<UserPermissionRecord[]> {
        try {
            dbLogger.info(
                {
                    permissionId,
                    filter
                },
                'listing user-permission relations by permission'
            );
            const db = getDb();
            let query = rawSelect(
                db
                    .select()
                    .from(userPermissions)
                    .where(eq(userPermissions.permissionId, permissionId))
            );

            if (filter) {
                query = query
                    .limit(filter.limit ?? 20)
                    .offset(filter.offset ?? 0)
                    .orderBy(userPermissions.userId, 'asc');
            }

            const rows = (await query) as UserPermissionRecord[];
            dbLogger.query({
                table: 'r_user_permission',
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
     * Delete a user-permission relation.
     *
     * @param userId - UUID of the user
     * @param permissionId - UUID of the permission
     */
    async deleteRelation(userId: string, permissionId: string): Promise<void> {
        try {
            dbLogger.info({ userId, permissionId }, 'deleting user-permission relation');
            const db = getDb();
            await db
                .delete(userPermissions)
                .where(
                    and(
                        eq(userPermissions.userId, userId),
                        eq(userPermissions.permissionId, permissionId)
                    )
                );
            dbLogger.query({
                table: 'r_user_permission',
                action: 'delete',
                params: { userId, permissionId },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'deleteRelation failed');
            throw error;
        }
    },

    /**
     * Get a user-permission relation by user ID and permission ID.
     * This checks for the existence of a specific relation.
     * @param userId - The ID of the user.
     * @param permissionId - The ID of the permission.
     * @returns The relation record if found, undefined otherwise.
     * @throws Error if the database query fails.
     */
    async getByUserIdAndPermissionId(
        userId: string,
        permissionId: string
    ): Promise<UserPermissionRecord | undefined> {
        dbLogger.debug(
            {
                userId,
                permissionId
            },
            'checking user-permission relation existence'
        );
        try {
            const db = getDb();
            const [relation] = await db
                .select()
                .from(userPermissions)
                .where(
                    and(
                        eq(userPermissions.userId, userId),
                        eq(userPermissions.permissionId, permissionId)
                    )
                )
                .limit(1); // Limit to 1 as we only need to know if it exists

            dbLogger.debug(
                {
                    userId,
                    permissionId,
                    exists: !!relation
                },
                'user-permission relation check result'
            );
            return relation;
        } catch (error) {
            dbLogger.error(error, 'failed to check user-permission relation existence');
            throw error;
        }
    },

    /**
     * Delete all user-permission relations for a given user ID.
     * @param userId - The ID of the user.
     * @throws Error if deletion fails.
     */
    async deleteAllByUserId(userId: string): Promise<void> {
        dbLogger.info({ userId }, 'deleting all user-permission relations for user');
        try {
            const db = getDb();
            await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
            dbLogger.info(
                { userId },
                'all user-permission relations for user deleted successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to delete all user-permission relations for user');
            throw error;
        }
    }
};
