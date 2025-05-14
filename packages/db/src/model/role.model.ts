import { logger } from '@repo/logger';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { db } from '../client';
import { roles } from '../schema/role.dbschema';
import type { InsertRole, SelectRoleFilter, UpdateRoleData } from '../types/db-types';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils';

/**
 * Scoped logger for role model operations.
 */
const log = logger.createLogger('RoleModel');

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
            log.info('creating a new role', 'createRole', data);
            const rows = castReturning<RoleRecord>(await db.insert(roles).values(data).returning());
            const role = assertExists(rows[0], 'createRole: no role returned');
            log.query('insert', 'roles', data, role);
            return role;
        } catch (error) {
            log.error('createRole failed', 'createRole', error);
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
            log.info('fetching role by id', 'getRoleById', { id });
            const [role] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
            log.query('select', 'roles', { id }, role);
            return role ? (role as RoleRecord) : undefined;
        } catch (error) {
            log.error('getRoleById failed', 'getRoleById', error);
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
            log.info('fetching role by name', 'getRoleByName', { name });
            const [role] = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
            log.query('select', 'roles', { name }, role);
            return role ? (role as RoleRecord) : undefined;
        } catch (error) {
            log.error('getRoleByName failed', 'getRoleByName', error);
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
            log.info('listing roles', 'listRoles', filter);
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

            log.query('select', 'roles', filter, rows);
            return rows;
        } catch (error) {
            log.error('listRoles failed', 'listRoles', error);
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
            log.info('updating role', 'updateRole', { id, dataToUpdate });
            const rows = castReturning<RoleRecord>(
                await db.update(roles).set(dataToUpdate).where(eq(roles.id, id)).returning()
            );
            const updated = assertExists(rows[0], `updateRole: no role found for id ${id}`);
            log.query('update', 'roles', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateRole failed', 'updateRole', error);
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
            log.info('soft deleting role', 'softDeleteRole', { id });
            await db.update(roles).set({ deletedAt: new Date() }).where(eq(roles.id, id));
            log.query('update', 'roles', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteRole failed', 'softDeleteRole', error);
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
            log.info('restoring role', 'restoreRole', { id });
            await db.update(roles).set({ deletedAt: null }).where(eq(roles.id, id));
            log.query('update', 'roles', { id }, { restored: true });
        } catch (error) {
            log.error('restoreRole failed', 'restoreRole', error);
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
            log.info('hard deleting role', 'hardDeleteRole', { id });
            await db.delete(roles).where(eq(roles.id, id));
            log.query('delete', 'roles', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteRole failed', 'hardDeleteRole', error);
            throw error;
        }
    }
};
