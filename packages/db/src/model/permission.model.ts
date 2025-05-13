import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, ilike, isNull, or } from 'drizzle-orm';
import type { BaseSelectFilter, UpdateData } from 'src/types/db.types';
import { db } from '../client';
import { permissions } from '../schema/permission.dbschema';
import { assertExists, castReturning, rawSelect, sanitizePartialUpdate } from '../utils/db-utils';

/**
 * Scoped logger for permission model operations.
 */
const log = logger.createLogger('PermissionModel');

/**
 * Full permission record as returned by the database.
 */
export type PermissionRecord = InferSelectModel<typeof permissions>;

/**
 * Data required to create a new permission.
 */
export type CreatePermissionData = InferInsertModel<typeof permissions>;

/**
 * Fields allowed for updating a permission.
 */
export type UpdatePermissionData = UpdateData<CreatePermissionData>;

/**
 * Filter options for listing permissions.
 */
export interface SelectPermissionFilter extends BaseSelectFilter {
    /** Filter by deprecated state */
    isDeprecated?: boolean;
}

/**
 * PermissionModel provides low-level CRUD operations for the permissions table.
 */
export const PermissionModel = {
    /**
     * Create a new permission record.
     *
     * @param data - Fields required to create the permission
     * @returns The created permission record
     */
    async createPermission(data: CreatePermissionData): Promise<PermissionRecord> {
        try {
            log.info('creating a new permission', 'createPermission', data);
            const rows = castReturning<PermissionRecord>(
                await db.insert(permissions).values(data).returning()
            );
            const perm = assertExists(rows[0], 'createPermission: no permission returned');
            log.query('insert', 'permissions', data, perm);
            return perm;
        } catch (error) {
            log.error('createPermission failed', 'createPermission', error);
            throw error;
        }
    },

    /**
     * Fetch a single permission by ID.
     *
     * @param id - UUID of the permission
     * @returns The permission record or undefined if not found
     */
    async getPermissionById(id: string): Promise<PermissionRecord | undefined> {
        try {
            log.info('fetching permission by id', 'getPermissionById', { id });
            const [perm] = (await db
                .select()
                .from(permissions)
                .where(eq(permissions.id, id))
                .limit(1)) as PermissionRecord[];
            log.query('select', 'permissions', { id }, perm);
            return perm;
        } catch (error) {
            log.error('getPermissionById failed', 'getPermissionById', error);
            throw error;
        }
    },

    /**
     * List permissions with optional pagination and search.
     *
     * @param filter - Pagination and filtering options
     * @returns Array of permission records
     */
    async listPermissions(filter: SelectPermissionFilter): Promise<PermissionRecord[]> {
        try {
            log.info('listing permissions', 'listPermissions', filter);
            let query = rawSelect(db.select().from(permissions));

            if (filter.query) {
                const term = `%${filter.query}%`;
                query = query.where(
                    or(ilike(permissions.name, term), ilike(permissions.description, term))
                );
            }

            if (typeof filter.isDeprecated === 'boolean') {
                query = query.where(eq(permissions.isDeprecated, filter.isDeprecated));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(permissions.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(permissions.createdAt, 'desc')) as PermissionRecord[];

            log.query('select', 'permissions', filter, rows);
            return rows;
        } catch (error) {
            log.error('listPermissions failed', 'listPermissions', error);
            throw error;
        }
    },

    /**
     * Update fields on an existing permission.
     *
     * @param id - UUID of the permission to update
     * @param changes - Partial fields to update
     * @returns The updated permission record
     */
    async updatePermission(id: string, changes: UpdatePermissionData): Promise<PermissionRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating permission', 'updatePermission', { id, dataToUpdate });
            const rows = castReturning<PermissionRecord>(
                await db
                    .update(permissions)
                    .set(dataToUpdate)
                    .where(eq(permissions.id, id))
                    .returning()
            );
            const updated = assertExists(
                rows[0],
                `updatePermission: no permission found for id ${id}`
            );
            log.query('update', 'permissions', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updatePermission failed', 'updatePermission', error);
            throw error;
        }
    },

    /**
     * Soft-delete a permission by setting the deletedAt timestamp.
     *
     * @param id - UUID of the permission
     */
    async softDeletePermission(id: string): Promise<void> {
        try {
            log.info('soft deleting permission', 'softDeletePermission', { id });
            await db
                .update(permissions)
                .set({ deletedAt: new Date() })
                .where(eq(permissions.id, id));
            log.query('update', 'permissions', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeletePermission failed', 'softDeletePermission', error);
            throw error;
        }
    },

    /**
     * Restore a soft-deleted permission by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the permission
     */
    async restorePermission(id: string): Promise<void> {
        try {
            log.info('restoring permission', 'restorePermission', { id });
            await db.update(permissions).set({ deletedAt: null }).where(eq(permissions.id, id));
            log.query('update', 'permissions', { id }, { restored: true });
        } catch (error) {
            log.error('restorePermission failed', 'restorePermission', error);
            throw error;
        }
    },

    /**
     * Permanently delete a permission record from the database.
     *
     * @param id - UUID of the permission
     */
    async hardDeletePermission(id: string): Promise<void> {
        try {
            log.info('hard deleting permission', 'hardDeletePermission', { id });
            await db.delete(permissions).where(eq(permissions.id, id));
            log.query('delete', 'permissions', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeletePermission failed', 'hardDeletePermission', error);
            throw error;
        }
    }
};
