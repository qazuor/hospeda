import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import { count, eq } from 'drizzle-orm';
import { db } from '../client';
import {
    PermissionModel,
    RoleModel,
    RolePermissionModel,
    type RolePermissionRecord,
    type RoleRecord,
    UserModel,
    type UserRecord
} from '../model';
import { users } from '../schema/user.dbschema';
import type {
    InsertRole,
    InsertRolePermission,
    PaginationParams,
    SelectRoleFilter,
    UpdateRoleData,
    UpdateUserData
} from '../types/db-types';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils';

const log = logger.createLogger('RoleService');

/**
 * Service layer for managing role operations.
 * Handles business logic, authorization, and interacts with Role, User, and RolePermission models.
 */
export class RoleService {
    private static isAdmin(actor: UserType): boolean {
        return actor.roleId === BuiltinRoleTypeEnum.ADMIN;
    }

    private static assertAdmin(actor: UserType): void {
        if (!RoleService.isAdmin(actor)) {
            log.warn('Admin access required', 'assertAdmin', { actorId: actor.id });
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new role.
     * @param data - The data for the new role (InsertRole type from db-types).
     * @param actor - The user creating the role (must be an admin).
     * @returns The created role record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(data: InsertRole, actor: UserType): Promise<RoleRecord> {
        log.info('creating role', 'create', { actor: actor.id });

        RoleService.assertAdmin(actor);

        try {
            const dataWithAudit: InsertRole = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdRole = await RoleModel.createRole(dataWithAudit);
            log.info('role created successfully', 'create', { roleId: createdRole.id });
            return createdRole;
        } catch (error) {
            log.error('failed to create role', 'create', error, { actor: actor.id });
            throw error;
        }
    }

    /**
     * Get a single role by ID.
     * @param id - The ID of the role to fetch.
     * @param actor - The user performing the action (must be an admin).
     * @returns The role record.
     * @throws Error if role is not found or actor is not authorized.
     */
    async getById(id: string, actor: UserType): Promise<RoleRecord> {
        log.info('fetching role by id', 'getById', { roleId: id, actor: actor.id });

        RoleService.assertAdmin(actor);

        const role = await RoleModel.getRoleById(id);
        const existingRole = assertExists(role, `Role ${id} not found`);

        log.info('role fetched successfully', 'getById', { roleId: existingRole.id });
        return existingRole;
    }

    /**
     * List roles with optional filtering and pagination.
     * @param filter - Filtering and pagination options (SelectRoleFilter type from db-types).
     * @param actor - The user performing the action (must be an admin).
     * @returns An array of role records.
     * @throws Error if actor is not authorized or listing fails.
     */
    async list(filter: SelectRoleFilter, actor: UserType): Promise<RoleRecord[]> {
        log.info('listing roles', 'list', { filter, actor: actor.id });

        RoleService.assertAdmin(actor);

        try {
            const roles = await RoleModel.listRoles(filter);
            log.info('roles listed successfully', 'list', { count: roles.length, filter });
            return roles;
        } catch (error) {
            log.error('failed to list roles', 'list', error, { filter, actor: actor.id });
            throw error;
        }
    }

    /**
     * Update fields on an existing role.
     * @param id - The ID of the role to update.
     * @param changes - The partial fields to update (UpdateRoleData type from db-types).
     * @param actor - The user performing the action (must be an admin).
     * @returns The updated role record.
     * @throws Error if role is not found, actor is not authorized, or update fails.
     */
    async update(id: string, changes: UpdateRoleData, actor: UserType): Promise<RoleRecord> {
        log.info('updating role', 'update', { roleId: id, actor: actor.id });

        RoleService.assertAdmin(actor);

        const existingRole = assertExists(await RoleModel.getRoleById(id), `Role ${id} not found`);

        const dataToUpdate = sanitizePartialUpdate(changes);

        if ('isBuiltIn' in dataToUpdate) {
            log.warn('Attempted to change isBuiltIn status on role update', 'update', {
                roleId: id,
                actor: actor.id
            });
            // Use assignment to undefined instead of delete to satisfy lint rule
            dataToUpdate.isBuiltIn = undefined;
        }

        try {
            const dataWithAudit: UpdateRoleData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedRole = await RoleModel.updateRole(existingRole.id, dataWithAudit);
            log.info('role updated successfully', 'update', { roleId: updatedRole.id });
            return updatedRole;
        } catch (error) {
            log.error('failed to update role', 'update', error, { roleId: id, actor: actor.id });
            throw error;
        }
    }

    /**
     * Soft-delete a role by setting the deletedAt timestamp.
     * @param id - The ID of the role to soft-delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if role is not found, is built-in, actor is not authorized, or soft-delete fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        log.info('soft deleting role', 'delete', { roleId: id, actor: actor.id });

        RoleService.assertAdmin(actor);

        const existingRole = assertExists(
            await RoleModel.getRoleById(id),
            `Role ${id} not found for soft delete`
        );

        if (existingRole.isBuiltIn) {
            log.warn('Attempted to soft delete a built-in role', 'delete', {
                roleId: id,
                actor: actor.id
            });
            throw new Error('Cannot delete built-in roles');
        }

        try {
            const changes: UpdateRoleData = {
                deletedAt: new Date(),
                deletedById: actor.id
            };
            await RoleModel.updateRole(existingRole.id, changes);
            log.info('role soft deleted successfully', 'delete', { roleId: existingRole.id });
        } catch (error) {
            log.error('failed to soft delete role', 'delete', error, {
                roleId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Restore a soft-deleted role by clearing the deletedAt timestamp.
     * @param id - The ID of the role to restore.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if role is not found, actor is not authorized, or restore fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        log.info('restoring role', 'restore', { roleId: id, actor: actor.id });

        RoleService.assertAdmin(actor);

        // Fetch existing role to ensure it exists (RoleModel.getRoleById fetches regardless of deletedAt status)
        // Using _ prefix to satisfy linter rule 'noUnusedVariables' as suggested
        const _existingRole = assertExists(
            await RoleModel.getRoleById(id),
            `Role ${id} not found or not soft-deleted for restore`
        );

        try {
            const changes: UpdateRoleData = {
                deletedAt: null,
                deletedById: null
            };
            // Use the original ID, assertExists ensures it exists
            await RoleModel.updateRole(id, changes);
            log.info('role restored successfully', 'restore', { roleId: id });
        } catch (error) {
            log.error('failed to restore role', 'restore', error, { roleId: id, actor: actor.id });
            throw error;
        }
    }

    /**
     * Permanently delete a role record from the database.
     * @param id - The ID of the role to hard-delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if role is not found, is built-in, actor is not authorized, or hard-delete fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        log.info('hard deleting role', 'hardDelete', { roleId: id, actor: actor.id });

        RoleService.assertAdmin(actor);

        const existingRole = assertExists(
            await RoleModel.getRoleById(id),
            `Role ${id} not found for hard delete`
        );

        if (existingRole.isBuiltIn) {
            log.warn('Attempted to hard delete a built-in role', 'hardDelete', {
                roleId: id,
                actor: actor.id
            });
            throw new Error('Cannot delete built-in roles');
        }

        try {
            await RoleModel.hardDeleteRole(id);
            log.info('role hard deleted successfully', 'hardDelete', { roleId: id });
        } catch (error) {
            log.error('failed to hard delete role', 'hardDelete', error, {
                roleId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Assign a role to a user.
     * @param roleId - The ID of the role to assign.
     * @param userId - The ID of the user to assign the role to.
     * @param actor - The user performing the action (must be an admin).
     * @returns The updated user record.
     * @throws Error if role or user is not found, actor is not authorized, or update fails.
     */
    async assignToUser(roleId: string, userId: string, actor: UserType): Promise<UserRecord> {
        log.info('assigning role to user', 'assignToUser', { roleId, userId, actor: actor.id });

        RoleService.assertAdmin(actor);

        assertExists(await RoleModel.getRoleById(roleId), `Role ${roleId} not found`);
        const existingUser = assertExists(
            await UserModel.getUserById(userId),
            `User ${userId} not found`
        );

        if (actor.id === userId && !RoleService.isAdmin(actor)) {
            log.warn(
                'Attempted to change own role without sufficient permissions',
                'assignToUser',
                { actorId: actor.id, userId }
            );
            throw new Error('Forbidden: Cannot change your own role');
        }

        try {
            const changes: UpdateUserData = {
                roleId: roleId,
                updatedById: actor.id
            };
            const updatedUser = await UserModel.updateUser(existingUser.id, changes);
            log.info('role assigned to user successfully', 'assignToUser', { roleId, userId });
            return updatedUser;
        } catch (error) {
            log.error('failed to assign role to user', 'assignToUser', error, {
                roleId,
                userId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Remove a role from a user. This typically means assigning a default role.
     * @param roleId - The ID of the role to remove.
     * @param userId - The ID of the user to remove the role from.
     * @param actor - The user performing the action (must be an admin).
     * @returns The updated user record (with the default role).
     * @throws Error if role or user is not found, role is a default role, actor is not authorized, or update fails.
     */
    async removeFromUser(roleId: string, userId: string, actor: UserType): Promise<UserRecord> {
        log.info('removing role from user', 'removeFromUser', { roleId, userId, actor: actor.id });

        RoleService.assertAdmin(actor);

        const existingUser = assertExists(
            await UserModel.getUserById(userId),
            `User ${userId} not found`
        );

        const defaultUserRole = assertExists(
            await RoleModel.getRoleByName(BuiltinRoleTypeEnum.USER),
            'Default user role not found'
        );
        if (existingUser.roleId === roleId && roleId === defaultUserRole.id) {
            log.warn(
                'Attempted to remove the default role from a user who already has it',
                'removeFromUser',
                { roleId, userId }
            );
            throw new Error('Cannot remove the default role if the user already has it');
        }
        if (existingUser.roleId !== roleId) {
            log.warn('Attempted to remove a role that the user does not have', 'removeFromUser', {
                roleId,
                userId
            });
            return existingUser;
        }

        if (actor.id === userId && !RoleService.isAdmin(actor)) {
            log.warn(
                'Attempted to change own role without sufficient permissions',
                'removeFromUser',
                { actorId: actor.id, userId }
            );
            throw new Error('Forbidden: Cannot change your own role');
        }

        try {
            const changes: UpdateUserData = {
                roleId: defaultUserRole.id,
                updatedById: actor.id
            };
            const updatedUser = await UserModel.updateUser(existingUser.id, changes);
            log.info('role removed from user, default role assigned', 'removeFromUser', {
                roleId,
                userId,
                defaultRoleId: defaultUserRole.id
            });
            return updatedUser;
        } catch (error) {
            log.error('failed to remove role from user', 'removeFromUser', error, {
                roleId,
                userId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List users who have a specific role.
     * @param roleId - The ID of the role to filter by.
     * @param actor - The user performing the action (must be an admin).
     * @param filter - Pagination options (PaginationParams type from db-types).
     * @returns An array of user records with the specified role.
     * @throws Error if role is not found, actor is not authorized, or listing fails.
     */
    async listUsers(
        roleId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<UserRecord[]> {
        log.info('listing users by role', 'listUsers', { roleId, actor: actor.id, filter });

        RoleService.assertAdmin(actor);

        assertExists(await RoleModel.getRoleById(roleId), `Role ${roleId} not found`);

        try {
            const users = await UserModel.listUsers({ roleId, ...filter, includeDeleted: false });
            log.info('users listed by role successfully', 'listUsers', {
                roleId,
                count: users.length
            });
            return users;
        } catch (error) {
            log.error('failed to list users by role', 'listUsers', error, {
                roleId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List permissions associated with a role.
     * @param roleId - The ID of the role.
     * @param actor - The user performing the action (must be an admin).
     * @param filter - Pagination options (PaginationParams type from db-types).
     * @returns An array of role-permission relation records.
     * @throws Error if role is not found, actor is not authorized, or listing fails.
     */
    async listPermissions(
        roleId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<RolePermissionRecord[]> {
        log.info('listing permissions for role', 'listPermissions', {
            roleId,
            actor: actor.id,
            filter
        });

        RoleService.assertAdmin(actor);

        const existingRole = assertExists(
            await RoleModel.getRoleById(roleId),
            `Role ${roleId} not found`
        );

        try {
            const permissions = await RolePermissionModel.listByRole(existingRole.id, filter);
            log.info('permissions listed for role successfully', 'listPermissions', {
                roleId: existingRole.id,
                count: permissions.length
            });
            return permissions;
        } catch (error) {
            log.error('failed to list permissions for role', 'listPermissions', error, {
                roleId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Assign a permission to a role.
     * @param roleId - The ID of the role.
     * @param permissionId - The ID of the permission to assign.
     * @param actor - The user performing the action (must be an admin).
     * @returns The created role-permission relation record.
     * @throws Error if role or permission is not found, actor is not authorized, or creation fails.
     */
    async assignPermission(
        roleId: string,
        permissionId: string,
        actor: UserType
    ): Promise<RolePermissionRecord> {
        log.info('assigning permission to role', 'assignPermission', {
            roleId,
            permissionId,
            actor: actor.id
        });

        RoleService.assertAdmin(actor);

        assertExists(await RoleModel.getRoleById(roleId), `Role ${roleId} not found`);
        assertExists(
            await PermissionModel.getPermissionById(permissionId),
            `Permission ${permissionId} not found`
        );

        const data: InsertRolePermission = {
            roleId,
            permissionId
        };

        try {
            const relation = await RolePermissionModel.createRelation(data);
            log.info('permission assigned to role successfully', 'assignPermission', {
                roleId,
                permissionId
            });
            return relation;
        } catch (error) {
            log.error('failed to assign permission to role', 'assignPermission', error, {
                roleId,
                permissionId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Remove a permission from a role.
     * @param roleId - The ID of the role.
     * @param permissionId - The ID of the permission to remove.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if actor is not authorized or deletion fails.
     */
    async removePermission(roleId: string, permissionId: string, actor: UserType): Promise<void> {
        log.info('removing permission from role', 'removePermission', {
            roleId,
            permissionId,
            actor: actor.id
        });

        RoleService.assertAdmin(actor);

        try {
            await RolePermissionModel.deleteRelation(roleId, permissionId);
            log.info('permission removed from role successfully', 'removePermission', {
                roleId,
                permissionId
            });
        } catch (error) {
            log.error('failed to remove permission from role', 'removePermission', error, {
                roleId,
                permissionId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List roles marked as built-in.
     * @param actor - The user performing the action (must be an admin).
     * @param filter - Pagination options (PaginationParams type from db-types).
     * @returns An array of built-in role records.
     * @throws Error if actor is not authorized or listing fails.
     */
    async listBuiltIn(actor: UserType, filter: PaginationParams = {}): Promise<RoleRecord[]> {
        log.info('listing built-in roles', 'listBuiltIn', { actor: actor.id, filter });

        RoleService.assertAdmin(actor);

        const roleFilter: SelectRoleFilter = {
            isBuiltIn: true,
            ...filter,
            includeDeleted: false
        };

        try {
            const roles = await RoleModel.listRoles(roleFilter);
            log.info('built-in roles listed successfully', 'listBuiltIn', { count: roles.length });
            return roles;
        } catch (error) {
            log.error('failed to list built-in roles', 'listBuiltIn', error, { actor: actor.id });
            throw error;
        }
    }

    /**
     * List roles not marked as built-in (custom roles).
     * @param actor - The user performing the action (must be an admin).
     * @param filter - Pagination options (PaginationParams type from db-types).
     * @returns An array of custom role records.
     * @throws Error if actor is not authorized or listing fails.
     */
    async listCustom(actor: UserType, filter: PaginationParams = {}): Promise<RoleRecord[]> {
        log.info('listing custom roles', 'listCustom', { actor: actor.id, filter });

        RoleService.assertAdmin(actor);

        const roleFilter: SelectRoleFilter = {
            isBuiltIn: false,
            ...filter,
            includeDeleted: false
        };

        try {
            const roles = await RoleModel.listRoles(roleFilter);
            log.info('custom roles listed successfully', 'listCustom', { count: roles.length });
            return roles;
        } catch (error) {
            log.error('failed to list custom roles', 'listCustom', error, { actor: actor.id });
            throw error;
        }
    }

    /**
     * Count users associated with a specific role.
     * @param roleId - The ID of the role to count users for.
     * @param actor - The user performing the action (must be an admin).
     * @returns The number of users with the specified role.
     * @throws Error if role is not found, actor is not authorized, or count fails.
     */
    async countUsers(roleId: string, actor: UserType): Promise<number> {
        log.info('counting users by role', 'countUsers', { roleId, actor: actor.id });

        RoleService.assertAdmin(actor);

        assertExists(await RoleModel.getRoleById(roleId), `Role ${roleId} not found`);

        try {
            // Count users filtered by roleId directly using Drizzle, alias the count
            // Provide default result for type safety, although count without group by always returns one row
            const [result = { count: '0' }] = await db
                .select({
                    count: count() // Alias the count result
                })
                .from(users)
                .where(eq(users.roleId, roleId));

            // Parse the count from the result. Drizzle count is a string.
            const userCount = Number.parseInt(result.count as string, 10);

            log.info('user count by role successful', 'countUsers', { roleId, count: userCount });
            return userCount;
        } catch (error) {
            log.error('failed to count users by role', 'countUsers', error, {
                roleId,
                actor: actor.id
            });
            throw error;
        }
    }
}
