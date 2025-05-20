import { logger } from '@repo/logger';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { getDb } from '../client.js';
import { permissions } from '../schema/permission.dbschema.js';
import type {
    InsertPermission,
    SelectPermissionFilter,
    UpdatePermissionData
} from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

/**
 * Scoped logger for permission model operations.
 */
const log = logger.createLogger('PermissionModel');

/**
 * Full permission record as returned by the database.
 */
export type PermissionRecord = InferSelectModel<typeof permissions>;

/**
 * PermissionModel provides low-level CRUD operations for the permissions table.
 */
export const PermissionModel = {
    /**
     * Create a new permission record.
     *
     * @param data - Fields required to create the permission (InsertPermission type from db-types)
     * @returns The created permission record
     */
    async createPermission(data: InsertPermission): Promise<PermissionRecord> {
        try {
            log.info('creating a new permission', 'createPermission', data);
            const db = getDb();
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
            const db = getDb();
            const [perm] = await db
                .select()
                .from(permissions)
                .where(eq(permissions.id, id))
                .limit(1);
            log.query('select', 'permissions', { id }, perm);
            return perm ? (perm as PermissionRecord) : undefined;
        } catch (error) {
            log.error('getPermissionById failed', 'getPermissionById', error);
            throw error;
        }
    },

    /**
     * List permissions with optional filters, pagination and search.
     *
     * @param filter - Pagination and filtering options (SelectPermissionFilter type from db-types)
     * @returns Array of permission records
     */
    async listPermissions(filter: SelectPermissionFilter): Promise<PermissionRecord[]> {
        try {
            log.info('listing permissions', 'listPermissions', filter);
            const db = getDb();
            let query = db.select().from(permissions).$dynamic();

            if (filter.query) {
                const term = prepareLikeQuery(filter.query);
                query = query.where(
                    or(ilike(permissions.name, term), ilike(permissions.description, term))
                );
            }

            if (typeof filter.isDeprecated === 'boolean') {
                query = query.where(eq(permissions.isDeprecated, filter.isDeprecated));
            }

            if (filter.state) {
                // Using inherited 'state' filter
                query = query.where(eq(permissions.state, filter.state));
            }

            if (filter.createdById) {
                // Added createdById filter
                query = query.where(eq(permissions.createdById, filter.createdById));
            }
            if (filter.updatedById) {
                // Added updatedById filter
                query = query.where(eq(permissions.updatedById, filter.updatedById));
            }
            if (filter.deletedById) {
                // Added deletedById filter
                query = query.where(eq(permissions.deletedById, filter.deletedById));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(permissions.deletedAt));
            }

            // Use the getOrderByColumn utility
            const orderByColumn = getOrderByColumn(
                permissions,
                filter.orderBy,
                permissions.createdAt
            );
            query = query.orderBy(
                filter.order === 'asc' ? asc(orderByColumn) : desc(orderByColumn)
            );

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as PermissionRecord[];

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
     * @param changes - Partial fields to update (UpdatePermissionData type from db-types)
     * @returns The updated permission record
     */
    async updatePermission(id: string, changes: UpdatePermissionData): Promise<PermissionRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating permission', 'updatePermission', { id, dataToUpdate });
            const db = getDb();
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
            const db = getDb();
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
            const db = getDb();
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
            const db = getDb();
            await db.delete(permissions).where(eq(permissions.id, id));
            log.query('delete', 'permissions', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeletePermission failed', 'hardDeletePermission', error);
            throw error;
        }
    }
};
