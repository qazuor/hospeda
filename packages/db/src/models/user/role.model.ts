import type {
    NewRoleInputType,
    PermissionType,
    RoleType,
    UpdateRoleInputType,
    UserType
} from '@repo/types';
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { rRolePermission } from '../../dbschemas/user/r_role_permission.dbschema.ts';
import { roles } from '../../dbschemas/user/role.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for RoleModel
 *
 * This pattern provides a robust, type-safe way to define which columns of a model
 * can be used for ordering (sorting) in list queries, and ensures that both the
 * allowed values and the Drizzle column references are always in sync.
 *
 * Example:
 *   const roleOrderable = createOrderableColumnsAndMapping([
 *     'name', 'isBuiltIn', 'isDefault', 'createdAt', 'updatedAt'
 *   ] as const, roles);
 *   export const ROLE_ORDERABLE_COLUMNS = roleOrderable.columns;
 *   export type RoleOrderByColumn = typeof roleOrderable.type;
 *   const roleOrderableColumns = roleOrderable.mapping;
 *
 *   // In your model method:
 *   const col = getOrderableColumn(roleOrderableColumns, orderBy, roles.createdAt);
 *   const orderExpr = order === 'desc' ? desc(col) : asc(col);
 */
const roleOrderable = createOrderableColumnsAndMapping(
    ['name', 'isBuiltIn', 'isDefault', 'createdAt', 'updatedAt'] as const,
    roles
);

export const ROLE_ORDERABLE_COLUMNS = roleOrderable.columns;
export type RoleOrderByColumn = typeof roleOrderable.type;
const roleOrderableColumns = roleOrderable.mapping;

export type RolePaginationParams = {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: RoleOrderByColumn;
};

export type RoleSearchParams = RolePaginationParams & {
    q?: string;
    name?: string;
    isBuiltIn?: boolean;
    isDefault?: boolean;
};

/**
 * Possible relations for RoleModel.withRelations.
 *
 * @example
 * // To fetch a role with its permissions and users:
 * const role = await RoleModel.getWithRelations('role-uuid', { permissions: true, users: true });
 */
export type RoleRelations = {
    permissions?: true;
    users?: true;
};

/**
 * Maps the 'with' object to the actual relation results.
 *
 * @template T - RoleRelations
 * @example
 * // Usage in getWithRelations:
 * type Result = RoleType & RoleRelationResult<{ permissions: true, users: true }>;
 */
export type RoleRelationResult<T extends RoleRelations> = {
    permissions: T['permissions'] extends true ? PermissionType[] : never;
    users: T['users'] extends true ? UserType[] : never;
};

export type RoleWithRelationsType = RoleType & {
    permissions?: PermissionType[];
    users?: UserType[];
};

export const RoleModel = {
    /**
     * Retrieve a role by its unique ID.
     *
     * @param {string} id - Role ID
     * @returns {Promise<RoleType | undefined>} RoleType if found, otherwise undefined
     * @throws {Error} If the query fails
     *
     * @example
     * const role = await RoleModel.getById('role-uuid');
     * if (role) {
     *   console.log(role.name);
     * }
     */
    async getById(id: string): Promise<RoleType | undefined> {
        const db = getDb();
        try {
            const result = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
            dbLogger.query({ table: 'roles', action: 'getById', params: { id }, result });
            return result[0] as RoleType | undefined;
        } catch (error) {
            dbLogger.error(error, 'RoleModel.getById');
            throw new Error(`Failed to get role by id: ${(error as Error).message}`);
        }
    },

    /**
     * Retrieve a role by its unique name.
     *
     * @param {string} name - Role name
     * @returns {Promise<RoleType | undefined>} RoleType if found, otherwise undefined
     * @throws {Error} If the query fails
     *
     * @example
     * const role = await RoleModel.getByName('admin');
     * if (role) {
     *   console.log(role.id);
     * }
     */
    async getByName(name: string): Promise<RoleType | undefined> {
        const db = getDb();
        try {
            const result = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
            dbLogger.query({ table: 'roles', action: 'getByName', params: { name }, result });
            return result[0] as RoleType | undefined;
        } catch (error) {
            dbLogger.error(error, 'RoleModel.getByName');
            throw new Error(`Failed to get role by name: ${(error as Error).message}`);
        }
    },

    /**
     * Create a new role.
     *
     * @param {NewRoleInputType} input - The role creation input
     * @returns {Promise<RoleType>} The created role
     * @throws {Error} If the insert fails
     *
     * @example
     * const newRole = await RoleModel.create({
     *   name: 'editor',
     *   isBuiltIn: false,
     *   isDefault: false
     * });
     * console.log(newRole.id);
     */
    async create(input: NewRoleInputType): Promise<RoleType> {
        const db = getDb();
        try {
            const result = await db.insert(roles).values(input).returning();
            const created = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'roles',
                action: 'create',
                params: { input },
                result: created
            });
            if (!created) throw new Error('Insert failed');
            return created as RoleType;
        } catch (error) {
            dbLogger.error(error, 'RoleModel.create');
            throw new Error(`Failed to create role: ${(error as Error).message}`);
        }
    },

    /**
     * Update a role by ID.
     *
     * @param {string} id - Role ID
     * @param {UpdateRoleInputType} input - Fields to update
     * @returns {Promise<RoleType | undefined>} The updated role or undefined if not found
     * @throws {Error} If the update fails
     *
     * @example
     * const updated = await RoleModel.update('role-uuid', { name: 'manager' });
     * if (updated) {
     *   console.log(updated.name);
     * }
     */
    async update(id: string, input: UpdateRoleInputType): Promise<RoleType | undefined> {
        const db = getDb();
        try {
            const result = await db.update(roles).set(input).where(eq(roles.id, id)).returning();
            const updated = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'roles',
                action: 'update',
                params: { id, input },
                result: updated
            });
            return updated as RoleType | undefined;
        } catch (error) {
            dbLogger.error(error, 'RoleModel.update');
            throw new Error(`Failed to update role: ${(error as Error).message}`);
        }
    },

    /**
     * Soft delete a role by ID (sets deletedAt and deletedById).
     *
     * @param {string} id - Role ID
     * @param {string} deletedById - User ID performing the deletion
     * @returns {Promise<{ id: string } | undefined>} The deleted role's ID or undefined if not found
     * @throws {Error} If the operation fails
     *
     * @example
     * const deleted = await RoleModel.delete('role-uuid', 'admin-uuid');
     * if (deleted) {
     *   console.log('Deleted role:', deleted.id);
     * }
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const now = new Date();
            const result = await db
                .update(roles)
                .set({ deletedAt: now, deletedById })
                .where(eq(roles.id, id))
                .returning({ id: roles.id });
            const deleted = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'roles',
                action: 'delete',
                params: { id, deletedById },
                result: deleted
            });
            return deleted as { id: string } | undefined;
        } catch (error) {
            dbLogger.error(error, 'RoleModel.delete');
            throw new Error(`Failed to delete role: ${(error as Error).message}`);
        }
    },

    /**
     * Hard delete a role by ID (permanently removes from DB).
     *
     * @param {string} id - Role ID
     * @returns {Promise<boolean>} True if deleted, false if not found
     * @throws {Error} If the operation fails
     *
     * @example
     * const wasDeleted = await RoleModel.hardDelete('role-uuid');
     * if (wasDeleted) {
     *   console.log('Role permanently deleted');
     * }
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = await db.delete(roles).where(eq(roles.id, id)).returning();
            const deleted = Array.isArray(result) ? result.length > 0 : false;
            dbLogger.query({
                table: 'roles',
                action: 'hardDelete',
                params: { id },
                result: deleted
            });
            return deleted;
        } catch (error) {
            dbLogger.error(error, 'RoleModel.hardDelete');
            throw new Error(`Failed to hard delete role: ${(error as Error).message}`);
        }
    },

    /**
     * List roles with pagination and optional ordering.
     *
     * @param {RolePaginationParams} params - Pagination and ordering params
     * @returns {Promise<RoleType[]>} Array of roles
     * @throws {Error} If the query fails
     *
     * @example
     * const roles = await RoleModel.list({ limit: 20, offset: 0, orderBy: 'name', order: 'asc' });
     * roles.forEach(role => console.log(role.name));
     */
    async list(params: RolePaginationParams): Promise<RoleType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(roleOrderableColumns, orderBy, roles.createdAt);
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(roles)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'roles', action: 'list', params, result });
            return result as RoleType[];
        } catch (error) {
            dbLogger.error(error, 'RoleModel.list');
            throw new Error(`Failed to list roles: ${(error as Error).message}`);
        }
    },

    /**
     * Search roles by name, built-in, or default, with pagination and ordering.
     *
     * @param {RoleSearchParams} params - Search and pagination params
     * @returns {Promise<RoleType[]>} Array of roles matching the search
     * @throws {Error} If the query fails
     *
     * @example
     * const roles = await RoleModel.search({ name: 'admin', limit: 10, offset: 0 });
     * roles.forEach(role => console.log(role.name));
     */
    async search(params: RoleSearchParams): Promise<RoleType[]> {
        const db = getDb();
        const { q, name, isBuiltIn, isDefault, limit, offset, order, orderBy } = params;
        try {
            const whereClauses = [];
            if (q) {
                whereClauses.push(
                    or(
                        ilike(roles.name, prepareLikeQuery(q)),
                        ilike(roles.description, prepareLikeQuery(q))
                    )
                );
            }
            if (name) {
                whereClauses.push(ilike(roles.name, prepareLikeQuery(name)));
            }
            if (typeof isBuiltIn === 'boolean') {
                whereClauses.push(eq(roles.isBuiltIn, isBuiltIn));
            }
            if (typeof isDefault === 'boolean') {
                whereClauses.push(eq(roles.isDefault, isDefault));
            }
            const col = getOrderableColumn(roleOrderableColumns, orderBy, roles.createdAt);
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const queryBuilder = db.select().from(roles);
            const queryWithWhere =
                whereClauses.length > 0 ? queryBuilder.where(and(...whereClauses)) : queryBuilder;
            const finalQuery = queryWithWhere.orderBy(orderExpr).limit(limit).offset(offset);
            const result = await finalQuery;
            dbLogger.query({ table: 'roles', action: 'search', params, result });
            return result as RoleType[];
        } catch (error) {
            dbLogger.error(error, 'RoleModel.search');
            throw new Error(`Failed to search roles: ${(error as Error).message}`);
        }
    },

    /**
     * Count roles with optional filters (name, built-in, default).
     *
     * @param {RoleSearchParams} [params] - Search filters
     * @returns {Promise<number>} Number of roles matching the filters
     * @throws {Error} If the query fails
     *
     * @example
     * const count = await RoleModel.count({ isBuiltIn: true });
     * console.log('Built-in roles:', count);
     */
    async count(params?: RoleSearchParams): Promise<number> {
        const db = getDb();
        try {
            const { name, isBuiltIn, isDefault, q } = params || {};
            const whereClauses = [];
            if (q) {
                whereClauses.push(
                    or(
                        ilike(roles.name, prepareLikeQuery(q)),
                        ilike(roles.description, prepareLikeQuery(q))
                    )
                );
            }
            if (name) {
                whereClauses.push(ilike(roles.name, prepareLikeQuery(name)));
            }
            if (typeof isBuiltIn === 'boolean') {
                whereClauses.push(eq(roles.isBuiltIn, isBuiltIn));
            }
            if (typeof isDefault === 'boolean') {
                whereClauses.push(eq(roles.isDefault, isDefault));
            }
            const query = db.select({ count: count().as('count') }).from(roles);
            const finalQuery = whereClauses.length > 0 ? query.where(and(...whereClauses)) : query;
            const result = await finalQuery;
            dbLogger.query({ table: 'roles', action: 'count', params, result });
            return Number(result[0]?.count ?? 0);
        } catch (error) {
            dbLogger.error(error, 'RoleModel.count');
            throw new Error(`Failed to count roles: ${(error as Error).message}`);
        }
    },

    /**
     * Retrieve a role by ID, including specified relations.
     *
     * @template T
     * @param {string} id - Role ID
     * @param {T} withRelations - Relations to populate (e.g., { permissions: true, users: true })
     * @returns {Promise<(RoleWithRelationsType & RoleRelationResult<T>) | undefined>} Role with requested relations or undefined
     * @throws {Error} If the query fails
     *
     * @example
     * const role = await RoleModel.getWithRelations('role-uuid', { permissions: true });
     * if (role?.permissions) {
     *   console.log(role.permissions.length);
     * }
     */
    async getWithRelations<T extends RoleRelations>(
        id: string,
        withRelations: T
    ): Promise<(RoleWithRelationsType & RoleRelationResult<T>) | undefined> {
        const db = getDb();
        try {
            const result = await db.query.roles.findFirst({
                where: (r, { eq }) => eq(r.id, id),
                with: withRelations as Record<string, true>
            });
            dbLogger.query({
                table: 'roles',
                action: 'getWithRelations',
                params: { id, with: withRelations },
                result
            });
            return result as (RoleWithRelationsType & RoleRelationResult<T>) | undefined;
        } catch (error) {
            dbLogger.error(error, 'RoleModel.getWithRelations');
            throw new Error(`Failed to get role with relations: ${(error as Error).message}`);
        }
    },

    /**
     * Get all roles with a given permission.
     *
     * @param {string} permissionId - Permission ID
     * @returns {Promise<RoleType[]>} Array of roles with the given permission
     * @throws {Error} If the query fails
     *
     * @example
     * const roles = await RoleModel.getByPermission('perm-uuid');
     * roles.forEach(role => console.log(role.name));
     */
    async getByPermission(permissionId: string): Promise<RoleType[]> {
        const db = getDb();
        try {
            // Join rRolePermission to get roles with the given permission
            const result = await db
                .select()
                .from(roles)
                .innerJoin(rRolePermission, eq(roles.id, rRolePermission.roleId))
                .where(eq(rRolePermission.permissionId, permissionId));
            dbLogger.query({
                table: 'roles',
                action: 'getByPermission',
                params: { permissionId },
                result
            });
            // result is array of { roles: RoleType, rRolePermission: ... }
            const typedResult = result as Array<{ roles: RoleType; rRolePermission: unknown }>;
            return typedResult.map((row) => row.roles);
        } catch (error) {
            dbLogger.error(error, 'RoleModel.getByPermission');
            throw new Error(`Failed to get roles by permission: ${(error as Error).message}`);
        }
    }
};
