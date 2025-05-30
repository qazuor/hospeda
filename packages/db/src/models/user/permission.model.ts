import type {
    NewPermissionInputType,
    PermissionType,
    RoleType,
    UpdatePermissionInputType,
    UserType
} from '@repo/types';
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { permissions } from '../../dbschemas/user/permission.dbschema.ts';
import { rRolePermission } from '../../dbschemas/user/r_role_permission.dbschema.ts';
import { rUserPermission } from '../../dbschemas/user/r_user_permission.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for PermissionModel
 * Columns: name, isBuiltIn, isDeprecated, createdAt, updatedAt
 */
const permissionOrderable = createOrderableColumnsAndMapping(
    ['name', 'isBuiltIn', 'isDeprecated', 'createdAt', 'updatedAt'] as const,
    permissions
);

export const PERMISSION_ORDERABLE_COLUMNS = permissionOrderable.columns;
export type PermissionOrderByColumn = typeof permissionOrderable.type;
const permissionOrderableColumns = permissionOrderable.mapping;

export type PermissionPaginationParams = {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: PermissionOrderByColumn;
};

export type PermissionSearchParams = PermissionPaginationParams & {
    q?: string;
    name?: string;
    isBuiltIn?: boolean;
    isDeprecated?: boolean;
};

export type PermissionRelations = {
    roles?: true;
    users?: true;
};

export type PermissionRelationResult<T extends PermissionRelations> = {
    roles: T['roles'] extends true ? RoleType[] : never;
    users: T['users'] extends true ? UserType[] : never;
};

export type PermissionWithRelationsType = PermissionType & {
    roles?: RoleType[];
    users?: UserType[];
};

export const PermissionModel = {
    /**
     * Get a permission by its unique ID.
     * @param id Permission ID
     * @returns PermissionType or undefined if not found
     * @throws Error if the query fails
     */
    async getById(id: string): Promise<PermissionType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(permissions)
                .where(eq(permissions.id, id))
                .limit(1);
            dbLogger.query({ table: 'permissions', action: 'getById', params: { id }, result });
            return result[0] as PermissionType | undefined;
        } catch (error) {
            dbLogger.error(error, 'PermissionModel.getById');
            throw new Error(`Failed to get permission by id: ${(error as Error).message}`);
        }
    },

    /**
     * Get a permission by its unique name.
     * @param name Permission name
     * @returns PermissionType or undefined if not found
     * @throws Error if the query fails
     */
    async getByName(name: string): Promise<PermissionType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(permissions)
                .where(eq(permissions.name, name))
                .limit(1);
            dbLogger.query({ table: 'permissions', action: 'getByName', params: { name }, result });
            return result[0] as PermissionType | undefined;
        } catch (error) {
            dbLogger.error(error, 'PermissionModel.getByName');
            throw new Error(`Failed to get permission by name: ${(error as Error).message}`);
        }
    },

    /**
     * Create a new permission.
     * @param input NewPermissionInputType
     * @returns The created PermissionType
     * @throws Error if the insert fails
     */
    async create(input: NewPermissionInputType): Promise<PermissionType> {
        const db = getDb();
        try {
            const result = await db.insert(permissions).values(input).returning();
            const created = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'permissions',
                action: 'create',
                params: { input },
                result: created
            });
            if (!created) throw new Error('Insert failed');
            return created as PermissionType;
        } catch (error) {
            dbLogger.error(error, 'PermissionModel.create');
            throw new Error(`Failed to create permission: ${(error as Error).message}`);
        }
    },

    /**
     * Update a permission by ID.
     * @param id Permission ID
     * @param input UpdatePermissionInputType
     * @returns The updated PermissionType or undefined if not found
     * @throws Error if the update fails
     */
    async update(
        id: string,
        input: UpdatePermissionInputType
    ): Promise<PermissionType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .update(permissions)
                .set(input)
                .where(eq(permissions.id, id))
                .returning();
            const updated = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'permissions',
                action: 'update',
                params: { id, input },
                result: updated
            });
            return updated as PermissionType | undefined;
        } catch (error) {
            dbLogger.error(error, 'PermissionModel.update');
            throw new Error(`Failed to update permission: ${(error as Error).message}`);
        }
    },

    /**
     * Soft delete a permission by ID (sets deletedAt and deletedById).
     * @param id Permission ID
     * @param deletedById User ID performing the deletion
     * @returns { id: string } if deleted, undefined if not found
     * @throws Error if the operation fails
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const now = new Date();
            const result = await db
                .update(permissions)
                .set({ deletedAt: now, deletedById })
                .where(eq(permissions.id, id))
                .returning({ id: permissions.id });
            const deleted = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'permissions',
                action: 'delete',
                params: { id, deletedById },
                result: deleted
            });
            return deleted as { id: string } | undefined;
        } catch (error) {
            dbLogger.error(error, 'PermissionModel.delete');
            throw new Error(`Failed to delete permission: ${(error as Error).message}`);
        }
    },

    /**
     * Hard delete a permission by ID (permanently removes from DB).
     * @param id Permission ID
     * @returns true if deleted, false if not found
     * @throws Error if the operation fails
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = await db.delete(permissions).where(eq(permissions.id, id)).returning();
            const deleted = Array.isArray(result) ? result.length > 0 : false;
            dbLogger.query({
                table: 'permissions',
                action: 'hardDelete',
                params: { id },
                result: deleted
            });
            return deleted;
        } catch (error) {
            dbLogger.error(error, 'PermissionModel.hardDelete');
            throw new Error(`Failed to hard delete permission: ${(error as Error).message}`);
        }
    },

    /**
     * List permissions with pagination and optional ordering.
     * @param params PermissionPaginationParams (limit, offset, order, orderBy)
     * @returns Array<PermissionType>
     * @throws Error if the query fails
     */
    async list(params: PermissionPaginationParams): Promise<PermissionType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(
                permissionOrderableColumns,
                orderBy,
                permissions.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(permissions)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'permissions', action: 'list', params, result });
            return result as PermissionType[];
        } catch (error) {
            dbLogger.error(error, 'PermissionModel.list');
            throw new Error(`Failed to list permissions: ${(error as Error).message}`);
        }
    },

    /**
     * Search permissions by name, description, built-in, or deprecated, with pagination and ordering.
     * @param params PermissionSearchParams (q, name, isBuiltIn, isDeprecated, limit, offset, order, orderBy)
     * @returns Array<PermissionType>
     * @throws Error if the query fails
     */
    async search(params: PermissionSearchParams): Promise<PermissionType[]> {
        const db = getDb();
        const { q, name, isBuiltIn, isDeprecated, limit, offset, order, orderBy } = params;
        try {
            const whereClauses = [];
            if (q) {
                whereClauses.push(
                    or(
                        ilike(permissions.name, prepareLikeQuery(q)),
                        ilike(permissions.description, prepareLikeQuery(q))
                    )
                );
            }
            if (name) {
                whereClauses.push(ilike(permissions.name, prepareLikeQuery(name)));
            }
            if (typeof isBuiltIn === 'boolean') {
                whereClauses.push(eq(permissions.isBuiltIn, isBuiltIn));
            }
            if (typeof isDeprecated === 'boolean') {
                whereClauses.push(eq(permissions.isDeprecated, isDeprecated));
            }
            const col = getOrderableColumn(
                permissionOrderableColumns,
                orderBy,
                permissions.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const queryBuilder = db.select().from(permissions);
            const queryWithWhere =
                whereClauses.length > 0 ? queryBuilder.where(and(...whereClauses)) : queryBuilder;
            const finalQuery = queryWithWhere.orderBy(orderExpr).limit(limit).offset(offset);
            const result = await finalQuery;
            dbLogger.query({ table: 'permissions', action: 'search', params, result });
            return result as PermissionType[];
        } catch (error) {
            dbLogger.error(error, 'PermissionModel.search');
            throw new Error(`Failed to search permissions: ${(error as Error).message}`);
        }
    },

    /**
     * Count permissions with optional filters (name, built-in, deprecated).
     * @param params PermissionSearchParams
     * @returns number of permissions matching the filters
     * @throws Error if the query fails
     */
    async count(params?: PermissionSearchParams): Promise<number> {
        const db = getDb();
        try {
            const { name, isBuiltIn, isDeprecated, q } = params || {};
            const whereClauses = [];
            if (q) {
                whereClauses.push(
                    or(
                        ilike(permissions.name, prepareLikeQuery(q)),
                        ilike(permissions.description, prepareLikeQuery(q))
                    )
                );
            }
            if (name) {
                whereClauses.push(ilike(permissions.name, prepareLikeQuery(name)));
            }
            if (typeof isBuiltIn === 'boolean') {
                whereClauses.push(eq(permissions.isBuiltIn, isBuiltIn));
            }
            if (typeof isDeprecated === 'boolean') {
                whereClauses.push(eq(permissions.isDeprecated, isDeprecated));
            }
            const query = db.select({ count: count().as('count') }).from(permissions);
            const finalQuery = whereClauses.length > 0 ? query.where(and(...whereClauses)) : query;
            const result = await finalQuery;
            dbLogger.query({ table: 'permissions', action: 'count', params, result });
            return Number(result[0]?.count ?? 0);
        } catch (error) {
            dbLogger.error(error, 'PermissionModel.count');
            throw new Error(`Failed to count permissions: ${(error as Error).message}`);
        }
    },

    /**
     * Get a permission by ID, including specified relations.
     * @param id Permission ID
     * @param withRelations Relations to populate (e.g., { roles: true, users: true })
     * @returns PermissionType with requested relations or undefined if not found
     * @throws Error if the query fails
     */
    async getWithRelations<T extends PermissionRelations>(
        id: string,
        withRelations: T
    ): Promise<(PermissionWithRelationsType & PermissionRelationResult<T>) | undefined> {
        const db = getDb();
        try {
            const result = await db.query.permissions.findFirst({
                where: (p, { eq }) => eq(p.id, id),
                with: withRelations as Record<string, true>
            });
            dbLogger.query({
                table: 'permissions',
                action: 'getWithRelations',
                params: { id, with: withRelations },
                result
            });
            return result as
                | (PermissionWithRelationsType & PermissionRelationResult<T>)
                | undefined;
        } catch (error) {
            dbLogger.error(error, 'PermissionModel.getWithRelations');
            throw new Error(`Failed to get permission with relations: ${(error as Error).message}`);
        }
    },

    /**
     * Get all permissions for a given role.
     * @param roleId Role ID
     * @returns Array<PermissionType>
     * @throws Error if the query fails
     */
    async getByRole(roleId: string): Promise<PermissionType[]> {
        const db = getDb();
        try {
            const result = await db
                .select({ permissions, rRolePermission })
                .from(permissions)
                .innerJoin(rRolePermission, eq(permissions.id, rRolePermission.permissionId))
                .where(eq(rRolePermission.roleId, roleId));
            dbLogger.query({
                table: 'permissions',
                action: 'getByRole',
                params: { roleId },
                result
            });
            return result.map((row) => row.permissions as PermissionType);
        } catch (error) {
            dbLogger.error(error, 'PermissionModel.getByRole');
            throw new Error(`Failed to get permissions by role: ${(error as Error).message}`);
        }
    },

    /**
     * Get all permissions for a given user (direct and via roles).
     * @param userId User ID
     * @returns Array<PermissionType>
     * @throws Error if the query fails
     */
    async getByUser(userId: string): Promise<PermissionType[]> {
        const db = getDb();
        try {
            // Direct permissions
            const direct = await db
                .select({ permissions, rUserPermission })
                .from(permissions)
                .innerJoin(rUserPermission, eq(permissions.id, rUserPermission.permissionId))
                .where(eq(rUserPermission.userId, userId));
            // Permissions via roles
            const viaRoles = await db
                .select({ permissions, rRolePermission })
                .from(permissions)
                .innerJoin(rRolePermission, eq(permissions.id, rRolePermission.permissionId))
                .innerJoin(
                    rUserPermission,
                    eq(rRolePermission.roleId, rUserPermission.userId) // This join may need to be adjusted if you have a rUserRole table
                )
                .where(eq(rUserPermission.userId, userId));
            // Merge and deduplicate
            const all = [
                ...direct.map((row) => row.permissions as PermissionType),
                ...viaRoles.map((row) => row.permissions as PermissionType)
            ];
            const unique = Array.from(new Map(all.map((p) => [p.id, p])).values());
            dbLogger.query({
                table: 'permissions',
                action: 'getByUser',
                params: { userId },
                result: unique
            });
            return unique;
        } catch (error) {
            dbLogger.error(error, 'PermissionModel.getByUser');
            throw new Error(`Failed to get permissions by user: ${(error as Error).message}`);
        }
    }
};
