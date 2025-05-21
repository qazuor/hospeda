import { dbLogger } from '@repo/db/utils/logger.js';
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
            dbLogger.info(data, 'creating a new permission');
            const db = getDb();
            const rows = castReturning<PermissionRecord>(
                await db.insert(permissions).values(data).returning()
            );
            const perm = assertExists(rows[0], 'createPermission: no permission returned');
            dbLogger.query({
                table: 'permissions',
                action: 'insert',
                params: data,
                result: perm
            });
            return perm;
        } catch (error) {
            dbLogger.error(error, 'createPermission failed');
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
            dbLogger.info({ id }, 'fetching permission by id');
            const db = getDb();
            const [perm] = await db
                .select()
                .from(permissions)
                .where(eq(permissions.id, id))
                .limit(1);
            dbLogger.query({
                table: 'permissions',
                action: 'select',
                params: { id },
                result: perm
            });
            return perm ? (perm as PermissionRecord) : undefined;
        } catch (error) {
            dbLogger.error(error, 'getPermissionById failed');
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
            dbLogger.info(filter, 'listing permissions');
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

            dbLogger.query({
                table: 'permissions',
                action: 'select',
                params: filter,
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listPermissions failed');
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
            dbLogger.info({ id, dataToUpdate }, 'updating permission');
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
            dbLogger.query({
                table: 'permissions',
                action: 'update',
                params: { id, changes: dataToUpdate },
                result: updated
            });
            return updated;
        } catch (error) {
            dbLogger.error(error, 'updatePermission failed');
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
            dbLogger.info({ id }, 'soft deleting permission');
            const db = getDb();
            await db
                .update(permissions)
                .set({ deletedAt: new Date() })
                .where(eq(permissions.id, id));
            dbLogger.query({
                table: 'permissions',
                action: 'update',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeletePermission failed');
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
            dbLogger.info({ id }, 'restoring permission');
            const db = getDb();
            await db.update(permissions).set({ deletedAt: null }).where(eq(permissions.id, id));
            dbLogger.query({
                table: 'permissions',
                action: 'update',
                params: { id },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restorePermission failed');
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
            dbLogger.info({ id }, 'hard deleting permission');
            const db = getDb();
            await db.delete(permissions).where(eq(permissions.id, id));
            dbLogger.query({
                table: 'permissions',
                action: 'delete',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeletePermission failed');
            throw error;
        }
    }
};
