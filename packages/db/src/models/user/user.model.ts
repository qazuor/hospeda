import type {
    NewUserInputType,
    PermissionType,
    RoleType,
    UpdateUserInputType,
    UserBookmarkType,
    UserType,
    UserWithRelationsType
} from '@repo/types';
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { rUserPermission } from '../../dbschemas/user/r_user_permission.dbschema.ts';
import { users } from '../../dbschemas/user/user.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for UserModel
 *
 * This pattern provides a robust, type-safe way to define which columns of a model
 * can be used for ordering (sorting) in list queries, and ensures that both the
 * allowed values and the Drizzle column references are always in sync.
 *
 * Example:
 *   const userOrderable = createOrderableColumnsAndMapping([
 *     'birthDate', 'firstName', 'lastName', 'roleId'
 *   ] as const, users);
 *   export const USER_ORDERABLE_COLUMNS = userOrderable.columns;
 *   export type UserOrderByColumn = typeof userOrderable.type;
 *   const userOrderableColumns = userOrderable.mapping;
 *
 *   // In your model method:
 *   const col = getOrderableColumn(userOrderableColumns, orderBy, users.createdAt);
 *   const orderExpr = order === 'desc' ? desc(col) : asc(col);
 */
const userOrderable = createOrderableColumnsAndMapping(
    ['birthDate', 'firstName', 'lastName', 'roleId'] as const,
    users
);

export const USER_ORDERABLE_COLUMNS = userOrderable.columns;
export type UserOrderByColumn = typeof userOrderable.type;
const userOrderableColumns = userOrderable.mapping;

export type UserPaginationParams = {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: UserOrderByColumn;
};

export type UserSearchParams = UserPaginationParams & {
    q?: string;
    firstName?: string;
    lastName?: string;
    roleId?: string;
};

/**
 * Possible relations for UserModel.withRelations.
 *
 * @example
 * // To fetch a user with their role and permissions:
 * const user = await UserModel.getWithRelations('user-uuid', { role: true, permissions: true });
 */
export type UserRelations = {
    role?: true;
    permissions?: true;
    bookmarks?: true;
};

/**
 * Maps the 'with' object to the actual relation results.
 *
 * @template T - UserRelations
 * @example
 * // Usage in getWithRelations:
 * type Result = UserType & UserRelationResult<{ role: true, permissions: true }>;
 */
export type UserRelationResult<T extends UserRelations> = {
    role: T['role'] extends true ? RoleType : never;
    permissions: T['permissions'] extends true ? PermissionType[] : never;
    bookmarks: T['bookmarks'] extends true ? UserBookmarkType[] : never;
};

export const UserModel = {
    /**
     * Retrieve a user by its unique ID.
     *
     * @param {string} id - User ID
     * @returns {Promise<UserType | undefined>} UserType if found, otherwise undefined
     * @throws {Error} If the query fails
     *
     * @example
     * const user = await UserModel.getById('user-uuid');
     * if (user) {
     *   console.log(user.userName);
     * }
     */
    async getById(id: string): Promise<UserType | undefined> {
        const db = getDb();
        try {
            const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
            dbLogger.query({ table: 'users', action: 'getById', params: { id }, result });
            return result[0] as UserType | undefined;
        } catch (error) {
            dbLogger.error(error, 'UserModel.getById');
            throw new Error(`Failed to get user by id: ${(error as Error).message}`);
        }
    },

    /**
     * Retrieve a user by its unique userName.
     *
     * @param {string} userName - UserName
     * @returns {Promise<UserType | undefined>} UserType if found, otherwise undefined
     * @throws {Error} If the query fails
     *
     * @example
     * const user = await UserModel.getByUserName('john_doe');
     * if (user) {
     *   console.log(user.id);
     * }
     */
    async getByUserName(userName: string): Promise<UserType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(users)
                .where(eq(users.userName, userName))
                .limit(1);
            dbLogger.query({
                table: 'users',
                action: 'getByUserName',
                params: { userName },
                result
            });
            return result[0] as UserType | undefined;
        } catch (error) {
            dbLogger.error(error, 'UserModel.getByUserName');
            throw new Error(`Failed to get user by userName: ${(error as Error).message}`);
        }
    },

    /**
     * Retrieve users by first and/or last name (case-insensitive, any order).
     *
     * @param {string} name - Name string (first, last, or both)
     * @returns {Promise<UserType[]>} Array of users
     * @throws {Error} If the query fails
     *
     * @example
     * const users = await UserModel.getByName('John Doe');
     * users.forEach(u => console.log(u.userName));
     */
    async getByName(name: string): Promise<UserType[]> {
        const db = getDb();
        try {
            const like = prepareLikeQuery(name);
            const result = await db
                .select()
                .from(users)
                .where(or(ilike(users.firstName, like), ilike(users.lastName, like)));
            dbLogger.query({ table: 'users', action: 'getByName', params: { name }, result });
            return result as UserType[];
        } catch (error) {
            dbLogger.error(error, 'UserModel.getByName');
            throw new Error(`Failed to get users by name: ${(error as Error).message}`);
        }
    },

    /**
     * Create a new user.
     *
     * @param {NewUserInputType} input - The user creation input
     * @returns {Promise<UserType>} The created user
     * @throws {Error} If the insert fails
     *
     * @example
     * const newUser = await UserModel.create({
     *   userName: 'john_doe',
     *   password: 'securePassword',
     *   roleId: 'role-uuid'
     * });
     * console.log(newUser.id);
     */
    async create(input: NewUserInputType): Promise<UserType> {
        const db = getDb();
        try {
            const result = await db.insert(users).values(input).returning();
            const created = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'users',
                action: 'create',
                params: { input },
                result: created
            });
            if (!created) throw new Error('Insert failed');
            return created as UserType;
        } catch (error) {
            dbLogger.error(error, 'UserModel.create');
            throw new Error(`Failed to create user: ${(error as Error).message}`);
        }
    },

    /**
     * Update a user by ID.
     *
     * @param {string} id - User ID
     * @param {UpdateUserInputType} input - Fields to update
     * @returns {Promise<UserType | undefined>} The updated user or undefined if not found
     * @throws {Error} If the update fails
     *
     * @example
     * const updated = await UserModel.update('user-uuid', { firstName: 'Jane' });
     * if (updated) {
     *   console.log(updated.firstName);
     * }
     */
    async update(id: string, input: UpdateUserInputType): Promise<UserType | undefined> {
        const db = getDb();
        try {
            const result = await db.update(users).set(input).where(eq(users.id, id)).returning();
            const updated = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'users',
                action: 'update',
                params: { id, input },
                result: updated
            });
            return updated as UserType | undefined;
        } catch (error) {
            dbLogger.error(error, 'UserModel.update');
            throw new Error(`Failed to update user: ${(error as Error).message}`);
        }
    },

    /**
     * Soft delete a user by ID (sets deletedAt and deletedById).
     *
     * @param {string} id - User ID
     * @param {string} deletedById - User ID performing the deletion
     * @returns {Promise<{ id: string } | undefined>} The deleted user's ID or undefined if not found
     * @throws {Error} If the operation fails
     *
     * @example
     * const deleted = await UserModel.delete('user-uuid', 'admin-uuid');
     * if (deleted) {
     *   console.log('Deleted user:', deleted.id);
     * }
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const now = new Date();
            const result = await db
                .update(users)
                .set({ deletedAt: now, deletedById })
                .where(eq(users.id, id))
                .returning({ id: users.id });
            const deleted = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'users',
                action: 'delete',
                params: { id, deletedById },
                result: deleted
            });
            return deleted as { id: string } | undefined;
        } catch (error) {
            dbLogger.error(error, 'UserModel.delete');
            throw new Error(`Failed to delete user: ${(error as Error).message}`);
        }
    },

    /**
     * Hard delete a user by ID (permanently removes from DB).
     *
     * @param {string} id - User ID
     * @returns {Promise<boolean>} True if deleted, false if not found
     * @throws {Error} If the operation fails
     *
     * @example
     * const wasDeleted = await UserModel.hardDelete('user-uuid');
     * if (wasDeleted) {
     *   console.log('User permanently deleted');
     * }
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = await db.delete(users).where(eq(users.id, id)).returning();
            const deleted = Array.isArray(result) ? result.length > 0 : false;
            dbLogger.query({
                table: 'users',
                action: 'hardDelete',
                params: { id },
                result: deleted
            });
            return deleted;
        } catch (error) {
            dbLogger.error(error, 'UserModel.hardDelete');
            throw new Error(`Failed to hard delete user: ${(error as Error).message}`);
        }
    },

    /**
     * List users with pagination and optional ordering.
     *
     * @param {UserPaginationParams} params - Pagination and ordering params
     * @returns {Promise<UserType[]>} Array of users
     * @throws {Error} If the query fails
     *
     * @example
     * const users = await UserModel.list({ limit: 20, offset: 0, orderBy: 'lastName', order: 'asc' });
     * users.forEach(user => console.log(user.userName));
     */
    async list(params: UserPaginationParams): Promise<UserType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(userOrderableColumns, orderBy, users.createdAt);
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(users)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'users', action: 'list', params, result });
            return result as UserType[];
        } catch (error) {
            dbLogger.error(error, 'UserModel.list');
            throw new Error(`Failed to list users: ${(error as Error).message}`);
        }
    },

    /**
     * Search users by name, role, or general query, with pagination and ordering.
     *
     * @param {UserSearchParams} params - Search and pagination params
     * @returns {Promise<UserType[]>} Array of users matching the search
     * @throws {Error} If the query fails
     *
     * @example
     * const users = await UserModel.search({ q: 'Jane', limit: 10, offset: 0 });
     * users.forEach(user => console.log(user.userName));
     */
    async search(params: UserSearchParams): Promise<UserType[]> {
        const db = getDb();
        const { q, firstName, lastName, roleId, limit, offset, order, orderBy } = params;
        try {
            const whereClauses = [];
            if (q) {
                whereClauses.push(
                    or(
                        ilike(users.firstName, prepareLikeQuery(q)),
                        ilike(users.lastName, prepareLikeQuery(q)),
                        ilike(users.userName, prepareLikeQuery(q))
                    )
                );
            }
            if (firstName) {
                whereClauses.push(ilike(users.firstName, prepareLikeQuery(firstName)));
            }
            if (lastName) {
                whereClauses.push(ilike(users.lastName, prepareLikeQuery(lastName)));
            }
            if (roleId) {
                whereClauses.push(eq(users.roleId, roleId));
            }
            const col = getOrderableColumn(userOrderableColumns, orderBy, users.createdAt);
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const queryBuilder = db.select().from(users);
            const queryWithWhere =
                whereClauses.length > 0 ? queryBuilder.where(and(...whereClauses)) : queryBuilder;
            const finalQuery = queryWithWhere.orderBy(orderExpr).limit(limit).offset(offset);
            const result = await finalQuery;
            dbLogger.query({ table: 'users', action: 'search', params, result });
            return result as UserType[];
        } catch (error) {
            dbLogger.error(error, 'UserModel.search');
            throw new Error(`Failed to search users: ${(error as Error).message}`);
        }
    },

    /**
     * Count users with optional filters (name, role, etc).
     *
     * @param {UserSearchParams} [params] - Search filters
     * @returns {Promise<number>} Number of users matching the filters
     * @throws {Error} If the query fails
     *
     * @example
     * const count = await UserModel.count({ roleId: 'role-uuid' });
     * console.log('Users with role:', count);
     */
    async count(params?: UserSearchParams): Promise<number> {
        const db = getDb();
        try {
            const { firstName, lastName, roleId, q } = params || {};
            const whereClauses = [];
            if (q) {
                whereClauses.push(
                    or(
                        ilike(users.firstName, prepareLikeQuery(q)),
                        ilike(users.lastName, prepareLikeQuery(q)),
                        ilike(users.userName, prepareLikeQuery(q))
                    )
                );
            }
            if (firstName) {
                whereClauses.push(ilike(users.firstName, prepareLikeQuery(firstName)));
            }
            if (lastName) {
                whereClauses.push(ilike(users.lastName, prepareLikeQuery(lastName)));
            }
            if (roleId) {
                whereClauses.push(eq(users.roleId, roleId));
            }
            const query = db.select({ count: count().as('count') }).from(users);
            const finalQuery = whereClauses.length > 0 ? query.where(and(...whereClauses)) : query;
            const result = await finalQuery;
            dbLogger.query({ table: 'users', action: 'count', params, result });
            return Number(result[0]?.count ?? 0);
        } catch (error) {
            dbLogger.error(error, 'UserModel.count');
            throw new Error(`Failed to count users: ${(error as Error).message}`);
        }
    },

    /**
     * Retrieve a user by ID, including specified relations.
     *
     * @template T
     * @param {string} id - User ID
     * @param {T} withRelations - Relations to populate (e.g., { role: true, permissions: true })
     * @returns {Promise<(UserWithRelationsType & UserRelationResult<T>) | undefined>} User with requested relations or undefined
     * @throws {Error} If the query fails
     *
     * @example
     * const user = await UserModel.getWithRelations('user-uuid', { role: true, permissions: true });
     * if (user?.role) {
     *   console.log(user.role.name);
     * }
     */
    async getWithRelations<T extends UserRelations>(
        id: string,
        withRelations: T
    ): Promise<(UserWithRelationsType & UserRelationResult<T>) | undefined> {
        const db = getDb();
        try {
            const result = await db.query.users.findFirst({
                where: (u, { eq }) => eq(u.id, id),
                with: withRelations as Record<string, true>
            });
            dbLogger.query({
                table: 'users',
                action: 'getWithRelations',
                params: { id, with: withRelations },
                result
            });
            return result as (UserWithRelationsType & UserRelationResult<T>) | undefined;
        } catch (error) {
            dbLogger.error(error, 'UserModel.getWithRelations');
            throw new Error(`Failed to get user with relations: ${(error as Error).message}`);
        }
    },

    /**
     * Get all users with a given role.
     *
     * @param {string} roleId - Role ID
     * @returns {Promise<UserType[]>} Array of users with the given role
     * @throws {Error} If the query fails
     *
     * @example
     * const users = await UserModel.getByRole('role-uuid');
     * users.forEach(user => console.log(user.userName));
     */
    async getByRole(roleId: string): Promise<UserType[]> {
        const db = getDb();
        try {
            const result = await db.select().from(users).where(eq(users.roleId, roleId));
            dbLogger.query({ table: 'users', action: 'getByRole', params: { roleId }, result });
            return result as UserType[];
        } catch (error) {
            dbLogger.error(error, 'UserModel.getByRole');
            throw new Error(`Failed to get users by role: ${(error as Error).message}`);
        }
    },

    /**
     * Get all users with a given permission.
     *
     * @param {string} permissionId - Permission ID
     * @returns {Promise<UserType[]>} Array of users with the given permission
     * @throws {Error} If the query fails
     *
     * @example
     * const users = await UserModel.getByPermission('permission-uuid');
     * users.forEach(user => console.log(user.userName));
     */
    async getByPermission(permissionId: string): Promise<UserType[]> {
        const db = getDb();
        try {
            // Join rUserPermission to get users with the given permission
            const result = await db
                .select()
                .from(users)
                .innerJoin(rUserPermission, eq(users.id, rUserPermission.userId))
                .where(eq(rUserPermission.permissionId, permissionId));
            dbLogger.query({
                table: 'users',
                action: 'getByPermission',
                params: { permissionId },
                result
            });
            // result is array of { users: UserType, rUserPermission: ... }
            const typedResult = result as Array<{ users: UserType; rUserPermission: unknown }>;
            return typedResult.map((row) => row.users);
        } catch (error) {
            dbLogger.error(error, 'UserModel.getByPermission');
            throw new Error(`Failed to get users by permission: ${(error as Error).message}`);
        }
    }
};
