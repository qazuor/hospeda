import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { getDb } from '../client.js';
import { roles } from '../schema/role.dbschema.js';
import type { InsertRole, SelectRoleFilter, UpdateRoleData } from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

/**
 * Full role record as returned by the database.
 */
export type RoleRecord = InferSelectModel<typeof roles>;

/**
 * RoleModel provides low-level CRUD operations for the roles table.
 */
export const RoleModel = {
    /**
     * Create a new role.
     *
     * @param data - Fields required to create the role (InsertRole type from db-types)
     * @returns The created role record
     */
    async createRole(data: InsertRole): Promise<RoleRecord> {
        try {
            dbLogger.info(data, 'creating a new role');
            const db = getDb();
            const rows = castReturning<RoleRecord>(await db.insert(roles).values(data).returning());
            const role = assertExists(rows[0], 'createRole: no role returned');
            dbLogger.query({ table: 'roles', action: 'insert', params: data, result: role });
            return role;
        } catch (error) {
            dbLogger.error(error, 'createRole failed');
            throw error;
        }
    },

    /**
     * Fetch a single role by ID.
     *
     * @param id - UUID of the role
     * @returns The role record or undefined if not found
     */
    async getRoleById(id: string): Promise<RoleRecord | undefined> {
        try {
            dbLogger.info({ id }, 'fetching role by id');
            const db = getDb();
            const [role] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
            dbLogger.query({ table: 'roles', action: 'select', params: { id }, result: role });
            return role ? (role as RoleRecord) : undefined;
        } catch (error) {
            dbLogger.error(error, 'getRoleById failed');
            throw error;
        }
    },

    /**
     * Fetch a single role by name.
     *
     * @param name - The name of the role (internal identifier).
     * @returns The role record or undefined if not found.
     */
    async getRoleByName(name: string): Promise<RoleRecord | undefined> {
        try {
            dbLogger.info({ name }, 'fetching role by name');
            const db = getDb();
            const [role] = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
            dbLogger.query({ table: 'roles', action: 'select', params: { name }, result: role });
            return role ? (role as RoleRecord) : undefined;
        } catch (error) {
            dbLogger.error(error, 'getRoleByName failed');
            throw error;
        }
    },

    /**
     * List roles with optional filters, pagination and search.
     *
     * @param filter - Pagination and filtering options (SelectRoleFilter type from db-types)
     * @returns Array of role records
     */
    async listRoles(filter: SelectRoleFilter): Promise<RoleRecord[]> {
        try {
            dbLogger.info(filter, 'listing roles');
            const db = getDb();
            let query = db.select().from(roles).$dynamic();

            if (filter.query) {
                const term = prepareLikeQuery(filter.query);
                query = query.where(or(ilike(roles.name, term), ilike(roles.displayName, term)));
            }

            if (filter.state) {
                // Using inherited 'state' filter
                query = query.where(eq(roles.state, filter.state));
            }

            if (typeof filter.isBuiltIn === 'boolean') {
                query = query.where(eq(roles.isBuiltIn, filter.isBuiltIn));
            }

            if (typeof filter.isDeprecated === 'boolean') {
                query = query.where(eq(roles.isDeprecated, filter.isDeprecated));
            }

            if (typeof filter.isDefault === 'boolean') {
                query = query.where(eq(roles.isDefault, filter.isDefault));
            }

            if (filter.createdById) {
                // Added createdById filter
                query = query.where(eq(roles.createdById, filter.createdById));
            }
            if (filter.updatedById) {
                // Added updatedById filter
                query = query.where(eq(roles.updatedById, filter.updatedById));
            }
            if (filter.deletedById) {
                // Added deletedById filter
                query = query.where(eq(roles.deletedById, filter.deletedById));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(roles.deletedAt));
            }

            // Use the getOrderByColumn utility
            const orderByColumn = getOrderByColumn(roles, filter.orderBy, roles.createdAt);
            query = query.orderBy(
                filter.order === 'asc' ? asc(orderByColumn) : desc(orderByColumn)
            );

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as RoleRecord[];

            dbLogger.query({ table: 'roles', action: 'select', params: filter, result: rows });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listRoles failed');
            throw error;
        }
    },

    /**
     * Update fields on an existing role.
     *
     * @param id - UUID of the role to update
     * @param changes - Partial fields to update (UpdateRoleData type from db-types)
     * @returns The updated role record
     */
    async updateRole(id: string, changes: UpdateRoleData): Promise<RoleRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            dbLogger.info({ id, dataToUpdate }, 'updating role');
            const db = getDb();
            const rows = castReturning<RoleRecord>(
                await db.update(roles).set(dataToUpdate).where(eq(roles.id, id)).returning()
            );
            const updated = assertExists(rows[0], `updateRole: no role found for id ${id}`);
            dbLogger.query({
                table: 'roles',
                action: 'update',
                params: { id, changes: dataToUpdate },
                result: updated
            });
            return updated;
        } catch (error) {
            dbLogger.error(error, 'updateRole failed');
            throw error;
        }
    },

    /**
     * Soft-delete a role by setting the deletedAt timestamp.
     *
     * @param id - UUID of the role
     */
    async softDeleteRole(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'soft deleting role');
            const db = getDb();
            await db.update(roles).set({ deletedAt: new Date() }).where(eq(roles.id, id));
            dbLogger.query({
                table: 'roles',
                action: 'update',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeleteRole failed');
            throw error;
        }
    },

    /**
     * Restore a soft-deleted role by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the role
     */
    async restoreRole(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'restoring role');
            const db = getDb();
            await db.update(roles).set({ deletedAt: null }).where(eq(roles.id, id));
            dbLogger.query({
                table: 'roles',
                action: 'update',
                params: { id },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restoreRole failed');
            throw error;
        }
    },

    /**
     * Permanently delete a role record from the database.
     *
     * @param id - UUID of the role
     */
    async hardDeleteRole(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'hard deleting role');
            const db = getDb();
            await db.delete(roles).where(eq(roles.id, id));
            dbLogger.query({
                table: 'roles',
                action: 'delete',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteRole failed');
            throw error;
        }
    }
};
