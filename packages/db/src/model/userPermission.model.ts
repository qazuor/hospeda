import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import type { BaseSelectFilter } from 'src/types/db-types';
import { db } from '../client';
import { userPermissions } from '../schema/r_user_permission.dbschema';
import { assertExists, castReturning, rawSelect } from '../utils/db-utils';

/**
 * Scoped logger for user-permission relation model operations.
 */
const log = logger.createLogger('UserPermissionModel');

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
            log.info('creating user-permission relation', 'createRelation', data);
            const rows = castReturning<UserPermissionRecord>(
                await db.insert(userPermissions).values(data).returning()
            );
            const relation = assertExists(rows[0], 'createRelation: no record returned');
            log.query('insert', 'r_user_permission', data, relation);
            return relation;
        } catch (error) {
            log.error('createRelation failed', 'createRelation', error);
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
            log.info('listing user-permission relations by user', 'listByUser', { userId, filter });

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
            log.query('select', 'r_user_permission', { userId, filter }, rows);
            return rows;
        } catch (error) {
            log.error('listByUser failed', 'listByUser', error);
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
            log.info('listing user-permission relations by permission', 'listByPermission', {
                permissionId,
                filter
            });

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
            log.query('select', 'r_user_permission', { permissionId, filter }, rows);
            return rows;
        } catch (error) {
            log.error('listByPermission failed', 'listByPermission', error);
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
            log.info('deleting user-permission relation', 'deleteRelation', {
                userId,
                permissionId
            });
            await db
                .delete(userPermissions)
                .where(
                    and(
                        eq(userPermissions.userId, userId),
                        eq(userPermissions.permissionId, permissionId)
                    )
                );
            log.query('delete', 'r_user_permission', { userId, permissionId }, { deleted: true });
        } catch (error) {
            log.error('deleteRelation failed', 'deleteRelation', error);
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
        log.debug('checking user-permission relation existence', 'getByUserIdAndPermissionId', {
            userId,
            permissionId
        });
        try {
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

            log.debug('user-permission relation check result', 'getByUserIdAndPermissionId', {
                userId,
                permissionId,
                exists: !!relation
            });
            return relation;
        } catch (error) {
            log.error(
                'failed to check user-permission relation existence',
                'getByUserIdAndPermissionId',
                error,
                { userId, permissionId }
            );
            throw error;
        }
    },

    /**
     * Delete all user-permission relations for a given user ID.
     * @param userId - The ID of the user.
     * @throws Error if deletion fails.
     */
    async deleteAllByUserId(userId: string): Promise<void> {
        log.info('deleting all user-permission relations for user', 'deleteAllByUserId', {
            userId
        });
        try {
            await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
            log.info(
                'all user-permission relations for user deleted successfully',
                'deleteAllByUserId',
                { userId }
            );
        } catch (error) {
            log.error(
                'failed to delete all user-permission relations for user',
                'deleteAllByUserId',
                error,
                { userId }
            );
            throw error;
        }
    }
};
