import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, ilike, isNull, or } from 'drizzle-orm';
import type { BaseSelectFilter, UpdateData } from 'src/types/db-types';
import { db } from '../client';
import { roles } from '../schema/role.dbschema';
import { assertExists, castReturning, rawSelect, sanitizePartialUpdate } from '../utils/db-utils';

/**
 * Scoped logger for role model operations.
 */
const log = logger.createLogger('RoleModel');

/**
 * Full role record as returned by the database.
 */
export type RoleRecord = InferSelectModel<typeof roles>;

/**
 * Data required to create a new role.
 */
export type CreateRoleData = InferInsertModel<typeof roles>;

/**
 * Fields allowed for updating a role.
 */
export type UpdateRoleData = UpdateData<CreateRoleData>;

/**
 * Filter options for listing roles.
 */
export interface SelectRoleFilter extends BaseSelectFilter {
    /** Filter by role state */
    state?: string;
}

/**
 * RoleModel provides low-level CRUD operations for the roles table.
 */
export const RoleModel = {
    /**
     * Create a new role.
     *
     * @param data - Fields required to create the role
     * @returns The created role record
     */
    async createRole(data: CreateRoleData): Promise<RoleRecord> {
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
            const [role] = (await db
                .select()
                .from(roles)
                .where(eq(roles.id, id))
                .limit(1)) as RoleRecord[];
            log.query('select', 'roles', { id }, role);
            return role;
        } catch (error) {
            log.error('getRoleById failed', 'getRoleById', error);
            throw error;
        }
    },

    /**
     * List roles with optional pagination and search.
     *
     * @param filter - Pagination and filtering options
     * @returns Array of role records
     */
    async listRoles(filter: SelectRoleFilter): Promise<RoleRecord[]> {
        try {
            log.info('listing roles', 'listRoles', filter);
            let query = rawSelect(db.select().from(roles));

            if (filter.query) {
                const term = `%${filter.query}%`;
                query = query.where(or(ilike(roles.name, term), ilike(roles.displayName, term)));
            }

            if (filter.state) {
                query = query.where(eq(roles.state, filter.state));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(roles.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(roles.createdAt, 'desc')) as RoleRecord[];

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
     * @param changes - Partial fields to update
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
