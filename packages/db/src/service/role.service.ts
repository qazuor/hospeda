import { dbLogger } from '@repo/db/utils/logger.js';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    PermissionModel,
    RoleModel,
    RolePermissionModel,
    type RolePermissionRecord,
    type RoleRecord,
    UserModel,
    type UserRecord
} from '../model/index.js';
import type {
    InsertRole,
    InsertRolePermission,
    PaginationParams,
    SelectRoleFilter,
    UpdateRoleData,
    UpdateUserData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

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
            dbLogger.warn({ actorId: actor.id }, 'Admin access required');
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
        dbLogger.info({ actor: actor.id }, 'creating role');

        RoleService.assertAdmin(actor);

        try {
            const dataWithAudit: InsertRole = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdRole = await RoleModel.createRole(dataWithAudit);
            dbLogger.info({ roleId: createdRole.id }, 'role created successfully');
            return createdRole;
        } catch (error) {
            dbLogger.error(error, 'failed to create role');
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
        dbLogger.info({ roleId: id, actor: actor.id }, 'fetching role by id');

        RoleService.assertAdmin(actor);

        const role = await RoleModel.getRoleById(id);
        const existingRole = assertExists(role, `Role ${id} not found`);

        dbLogger.info({ roleId: existingRole.id }, 'role fetched successfully');
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
        dbLogger.info({ filter, actor: actor.id }, 'listing roles');

        RoleService.assertAdmin(actor);

        try {
            const roles = await RoleModel.listRoles(filter);
            dbLogger.info({ count: roles.length, filter }, 'roles listed successfully');
            return roles;
        } catch (error) {
            dbLogger.error(error, 'failed to list roles');
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
        dbLogger.info({ roleId: id, actor: actor.id }, 'updating role');

        RoleService.assertAdmin(actor);

        const existingRole = assertExists(await RoleModel.getRoleById(id), `Role ${id} not found`);

        const dataToUpdate = sanitizePartialUpdate(changes);

        if ('isBuiltIn' in dataToUpdate) {
            dbLogger.warn(
                { roleId: id, actor: actor.id },
                'Attempted to change isBuiltIn status on role update'
            );
            // Use assignment to undefined instead of delete to satisfy lint rule
            dataToUpdate.isBuiltIn = undefined;
        }

        try {
            const dataWithAudit: UpdateRoleData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedRole = await RoleModel.updateRole(existingRole.id, dataWithAudit);
            dbLogger.info({ roleId: updatedRole.id }, 'role updated successfully');
            return updatedRole;
        } catch (error) {
            dbLogger.error(error, 'failed to update role');
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
        dbLogger.info({ roleId: id, actor: actor.id }, 'soft deleting role');

        RoleService.assertAdmin(actor);

        const existingRole = assertExists(
            await RoleModel.getRoleById(id),
            `Role ${id} not found for soft delete`
        );

        if (existingRole.isBuiltIn) {
            dbLogger.warn(
                { roleId: id, actor: actor.id },
                'Attempted to soft delete a built-in role'
            );
            throw new Error('Cannot delete built-in roles');
        }

        try {
            const changes: UpdateRoleData = {
                deletedAt: new Date(),
                deletedById: actor.id
            };
            await RoleModel.updateRole(existingRole.id, changes);
            dbLogger.info({ roleId: existingRole.id }, 'role soft deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete role');
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
        dbLogger.info({ roleId: id, actor: actor.id }, 'restoring role');

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
            dbLogger.info({ roleId: id }, 'role restored successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to restore role');
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
        dbLogger.info({ roleId: id, actor: actor.id }, 'hard deleting role');

        RoleService.assertAdmin(actor);

        const existingRole = assertExists(
            await RoleModel.getRoleById(id),
            `Role ${id} not found for hard delete`
        );

        if (existingRole.isBuiltIn) {
            dbLogger.warn(
                { roleId: id, actor: actor.id },
                'Attempted to hard delete a built-in role'
            );
            throw new Error('Cannot delete built-in roles');
        }

        try {
            await RoleModel.hardDeleteRole(id);
            dbLogger.info({ roleId: id }, 'role hard deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete role');
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
        dbLogger.info({ roleId, userId, actor: actor.id }, 'assigning role to user');

        RoleService.assertAdmin(actor);

        assertExists(await RoleModel.getRoleById(roleId), `Role ${roleId} not found`);
        const existingUser = assertExists(
            await UserModel.getUserById(userId),
            `User ${userId} not found`
        );

        if (actor.id === userId && !RoleService.isAdmin(actor)) {
            dbLogger.warn(
                { actorId: actor.id, userId },
                'Attempted to change own role without sufficient permissions'
            );
            throw new Error('Forbidden: Cannot change your own role');
        }

        try {
            const changes: UpdateUserData = {
                roleId: roleId,
                updatedById: actor.id
            };
            const updatedUser = await UserModel.updateUser(existingUser.id, changes);
            dbLogger.info({ roleId, userId }, 'role assigned to user successfully');
            return updatedUser;
        } catch (error) {
            dbLogger.error(error, 'failed to assign role to user');
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
        dbLogger.info({ roleId, userId, actor: actor.id }, 'removing role from user');

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
            dbLogger.warn(
                { roleId, userId },
                'Attempted to remove the default role from a user who already has it'
            );
            throw new Error('Cannot remove the default role if the user already has it');
        }
        if (existingUser.roleId !== roleId) {
            dbLogger.warn(
                {
                    roleId,
                    userId
                },
                'Attempted to remove a role that the user does not have'
            );
            return existingUser;
        }

        if (actor.id === userId && !RoleService.isAdmin(actor)) {
            dbLogger.warn(
                { actorId: actor.id, userId },
                'Attempted to change own role without sufficient permissions'
            );
            throw new Error('Forbidden: Cannot change your own role');
        }

        try {
            const changes: UpdateUserData = {
                roleId: defaultUserRole.id,
                updatedById: actor.id
            };
            const updatedUser = await UserModel.updateUser(existingUser.id, changes);
            dbLogger.info(
                { roleId, userId, defaultRoleId: defaultUserRole.id },
                'role removed from user, default role assigned'
            );
            return updatedUser;
        } catch (error) {
            dbLogger.error(error, 'failed to remove role from user');
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
        dbLogger.info({ roleId, actor: actor.id, filter }, 'listing users by role');

        RoleService.assertAdmin(actor);

        assertExists(await RoleModel.getRoleById(roleId), `Role ${roleId} not found`);

        try {
            const users = await UserModel.listUsers({ roleId, ...filter, includeDeleted: false });
            dbLogger.info({ roleId, count: users.length }, 'users listed by role successfully');
            return users;
        } catch (error) {
            dbLogger.error(error, 'failed to list users by role');
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
        dbLogger.info({ roleId, actor: actor.id, filter }, 'listing permissions for role');

        RoleService.assertAdmin(actor);

        const existingRole = assertExists(
            await RoleModel.getRoleById(roleId),
            `Role ${roleId} not found`
        );

        try {
            const permissions = await RolePermissionModel.listByRole(existingRole.id, filter);
            dbLogger.info(
                { roleId: existingRole.id, count: permissions.length },
                'permissions listed for role successfully'
            );
            return permissions;
        } catch (error) {
            dbLogger.error(error, 'failed to list permissions for role');
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
        dbLogger.info({ roleId, permissionId, actor: actor.id }, 'assigning permission to role');

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
            dbLogger.info({ roleId, permissionId }, 'permission assigned to role successfully');
            return relation;
        } catch (error) {
            dbLogger.error(error, 'failed to assign permission to role');
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
        dbLogger.info({ roleId, permissionId, actor: actor.id }, 'removing permission from role');

        RoleService.assertAdmin(actor);

        try {
            await RolePermissionModel.deleteRelation(roleId, permissionId);
            dbLogger.info({ roleId, permissionId }, 'permission removed from role successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to remove permission from role');
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
        dbLogger.info({ actor: actor.id, filter }, 'listing built-in roles');

        RoleService.assertAdmin(actor);

        const roleFilter: SelectRoleFilter = {
            isBuiltIn: true,
            ...filter,
            includeDeleted: false
        };

        try {
            const roles = await RoleModel.listRoles(roleFilter);
            dbLogger.info({ count: roles.length }, 'built-in roles listed successfully');
            return roles;
        } catch (error) {
            dbLogger.error(error, 'failed to list built-in roles');
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
        dbLogger.info({ actor: actor.id, filter }, 'listing custom roles');

        RoleService.assertAdmin(actor);

        const roleFilter: SelectRoleFilter = {
            isBuiltIn: false,
            ...filter,
            includeDeleted: false
        };

        try {
            const roles = await RoleModel.listRoles(roleFilter);
            dbLogger.info({ count: roles.length }, 'custom roles listed successfully');
            return roles;
        } catch (error) {
            dbLogger.error(error, 'failed to list custom roles');
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
        dbLogger.info({ roleId, actor: actor.id }, 'counting users by role');

        RoleService.assertAdmin(actor);

        assertExists(await RoleModel.getRoleById(roleId), `Role ${roleId} not found`);

        try {
            // Use UserModel.listUsers and count the results instead of direct DB query
            const users = await UserModel.listUsers({
                roleId,
                includeDeleted: false,
                // We're only interested in the count, so we can fetch all users
                // You could optimize this by adding a count method to the UserModel if needed
                limit: 1000000
            });

            const userCount = users.length;
            dbLogger.info({ roleId, count: userCount }, 'user count by role successful');
            return userCount;
        } catch (error) {
            dbLogger.error(error, 'failed to count users by role');
            throw error;
        }
    }
}
