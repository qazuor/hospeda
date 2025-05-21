import { dbLogger } from '@repo/db/utils/logger.js';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    PermissionModel,
    type PermissionRecord,
    RoleModel,
    RolePermissionModel,
    type RolePermissionRecord,
    type RoleRecord,
    UserModel,
    UserPermissionModel,
    type UserPermissionRecord
} from '../model/index.js';
import type {
    InsertPermission,
    InsertRolePermission,
    InsertUserPermission,
    PaginationParams,
    SelectPermissionFilter,
    UpdatePermissionData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

/**
 * Service layer for managing permission operations.
 * Handles business logic, authorization, and interacts with Permission, Role, and User models,
 * as well as RolePermission and UserPermission relation models.
 */
export class PermissionService {
    private static isAdmin(actor: UserType): boolean {
        return actor.roleId === BuiltinRoleTypeEnum.ADMIN;
    }

    private static assertAdmin(actor: UserType): void {
        if (!PermissionService.isAdmin(actor)) {
            dbLogger.warn({ actorId: actor.id }, 'Admin access required');
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new permission.
     * @param data - The data for the new permission (InsertPermission type from db-types).
     * @param actor - The user creating the permission (must be an admin).
     * @returns The created permission record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(data: InsertPermission, actor: UserType): Promise<PermissionRecord> {
        dbLogger.info({ actor: actor.id }, 'creating permission');

        PermissionService.assertAdmin(actor);

        try {
            const dataWithAudit: InsertPermission = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdPermission = await PermissionModel.createPermission(dataWithAudit);
            dbLogger.info(
                {
                    permissionId: createdPermission.id
                },
                'permission created successfully'
            );
            return createdPermission;
        } catch (error) {
            dbLogger.error(error, 'failed to create permission');
            throw error;
        }
    }

    /**
     * Get a single permission by ID.
     * @param id - The ID of the permission to fetch.
     * @param actor - The user performing the action (must be an admin).
     * @returns The permission record.
     * @throws Error if permission is not found or actor is not authorized.
     */
    async getById(id: string, actor: UserType): Promise<PermissionRecord> {
        dbLogger.info(
            {
                permissionId: id,
                actor: actor.id
            },
            'fetching permission by id'
        );

        PermissionService.assertAdmin(actor);

        const permission = await PermissionModel.getPermissionById(id);
        const existingPermission = assertExists(permission, `Permission ${id} not found`);

        dbLogger.info(
            {
                permissionId: existingPermission.id
            },
            'permission fetched successfully'
        );
        return existingPermission;
    }

    /**
     * List permissions with optional filtering and pagination.
     * @param filter - Filtering and pagination options (SelectPermissionFilter type from db-types).
     * @param actor - The user performing the action (must be an admin).
     * @returns An array of permission records.
     * @throws Error if actor is not authorized or listing fails.
     */
    async list(filter: SelectPermissionFilter, actor: UserType): Promise<PermissionRecord[]> {
        dbLogger.info({ filter, actor: actor.id }, 'listing permissions');

        PermissionService.assertAdmin(actor);

        try {
            const permissions = await PermissionModel.listPermissions(filter);
            dbLogger.info(
                {
                    count: permissions.length,
                    filter
                },
                'permissions listed successfully'
            );
            return permissions;
        } catch (error) {
            dbLogger.error(error, 'failed to list permissions');
            throw error;
        }
    }

    /**
     * Update fields on an existing permission.
     * @param id - The ID of the permission to update.
     * @param changes - The partial fields to update (UpdatePermissionData type from db-types).
     * @param actor - The user performing the action (must be an admin).
     * @returns The updated permission record.
     * @throws Error if permission is not found, actor is not authorized, or update fails.
     */
    async update(
        id: string,
        changes: UpdatePermissionData,
        actor: UserType
    ): Promise<PermissionRecord> {
        dbLogger.info({ permissionId: id, actor: actor.id }, 'updating permission');

        PermissionService.assertAdmin(actor);

        const existingPermission = assertExists(
            await PermissionModel.getPermissionById(id),
            `Permission ${id} not found`
        );

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdatePermissionData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedPermission = await PermissionModel.updatePermission(
                existingPermission.id,
                dataWithAudit
            );
            dbLogger.info(
                {
                    permissionId: updatedPermission.id
                },
                'permission updated successfully'
            );
            return updatedPermission;
        } catch (error) {
            dbLogger.error(error, 'failed to update permission');
            throw error;
        }
    }

    /**
     * Soft-delete a permission by setting the deletedAt timestamp.
     * @param id - The ID of the permission to soft-delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if permission is not found, actor is not authorized, or soft-delete fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ permissionId: id, actor: actor.id }, 'soft deleting permission');

        PermissionService.assertAdmin(actor);

        assertExists(
            await PermissionModel.getPermissionById(id),
            `Permission ${id} not found for soft delete`
        );

        try {
            const changes: UpdatePermissionData = {
                deletedAt: new Date(),
                deletedById: actor.id
            };
            await PermissionModel.updatePermission(id, changes);
            dbLogger.info({ permissionId: id }, 'permission soft deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete permission');
            throw error;
        }
    }

    /**
     * Restore a soft-deleted permission by clearing the deletedAt timestamp.
     * @param id - The ID of the permission to restore.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if permission is not found, actor is not authorized, or restore fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ permissionId: id, actor: actor.id }, 'restoring permission');

        PermissionService.assertAdmin(actor);

        assertExists(
            await PermissionModel.getPermissionById(id),
            `Permission ${id} not found or not soft-deleted for restore`
        );

        try {
            const changes: UpdatePermissionData = {
                deletedAt: null,
                deletedById: null
            };
            await PermissionModel.updatePermission(id, changes);
            dbLogger.info({ permissionId: id }, 'permission restored successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to restore permission');
            throw error;
        }
    }

    /**
     * Permanently delete a permission record from the database.
     * @param id - The ID of the permission to hard-delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if permission is not found, actor is not authorized, or hard-delete fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        dbLogger.info(
            {
                permissionId: id,
                actor: actor.id
            },
            'hard deleting permission'
        );

        PermissionService.assertAdmin(actor);

        assertExists(
            await PermissionModel.getPermissionById(id),
            `Permission ${id} not found for hard delete`
        );

        try {
            await PermissionModel.hardDeletePermission(id);
            dbLogger.info({ permissionId: id }, 'permission hard deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete permission');
            throw error;
        }
    }

    /**
     * List permissions marked as deprecated.
     * @param actor - The user performing the action (must be an admin).
     * @param filter - Pagination options (PaginationParams type from db-types).
     * @returns An array of deprecated permission records.
     * @throws Error if actor is not authorized or listing fails.
     */
    async getDeprecated(
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<PermissionRecord[]> {
        dbLogger.info(
            {
                actor: actor.id,
                filter
            },
            'listing deprecated permissions'
        );

        PermissionService.assertAdmin(actor);

        const permissionFilter: SelectPermissionFilter = {
            isDeprecated: true,
            ...filter,
            includeDeleted: false
        };

        try {
            const permissions = await PermissionModel.listPermissions(permissionFilter);
            dbLogger.info(
                {
                    count: permissions.length
                },
                'deprecated permissions listed successfully'
            );
            return permissions;
        } catch (error) {
            dbLogger.error(error, 'failed to list deprecated permissions');
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
    async addToRole(
        roleId: string,
        permissionId: string,
        actor: UserType
    ): Promise<RolePermissionRecord> {
        dbLogger.info(
            {
                roleId,
                permissionId,
                actor: actor.id
            },
            'adding permission to role'
        );

        PermissionService.assertAdmin(actor);

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
            dbLogger.info(
                {
                    roleId,
                    permissionId
                },
                'permission added to role successfully'
            );
            return relation;
        } catch (error) {
            dbLogger.error(error, 'failed to add permission to role');
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
    async removeFromRole(roleId: string, permissionId: string, actor: UserType): Promise<void> {
        dbLogger.info(
            {
                roleId,
                permissionId,
                actor: actor.id
            },
            'removing permission from role'
        );

        PermissionService.assertAdmin(actor);

        try {
            await RolePermissionModel.deleteRelation(roleId, permissionId);
            dbLogger.info(
                {
                    roleId,
                    permissionId
                },
                'permission removed from role successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to remove permission from role');
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
    async listForRole(
        roleId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<RolePermissionRecord[]> {
        dbLogger.info(
            {
                roleId,
                actor: actor.id,
                filter
            },
            'listing permissions for role'
        );

        PermissionService.assertAdmin(actor);

        const existingRole = assertExists(
            await RoleModel.getRoleById(roleId),
            `Role ${roleId} not found`
        );

        try {
            const permissions = await RolePermissionModel.listByRole(existingRole.id, filter);
            dbLogger.info(
                {
                    roleId: existingRole.id,
                    count: permissions.length
                },
                'permissions listed for role successfully'
            );
            return permissions;
        } catch (error) {
            dbLogger.error(error, 'failed to list permissions for role');
            throw error;
        }
    }

    /**
     * Assign a permission directly to a user.
     * @param userId - The ID of the user.
     * @param permissionId - The ID of the permission to assign.
     * @param actor - The user performing the action (must be an admin).
     * @returns The created user-permission relation record.
     * @throws Error if user or permission is not found, actor is not authorized, or creation fails.
     */
    async addToUser(
        userId: string,
        permissionId: string,
        actor: UserType
    ): Promise<UserPermissionRecord> {
        dbLogger.info(
            {
                userId,
                permissionId,
                actor: actor.id
            },
            'adding permission to user'
        );

        PermissionService.assertAdmin(actor);

        assertExists(await UserModel.getUserById(userId), `User ${userId} not found`);
        assertExists(
            await PermissionModel.getPermissionById(permissionId),
            `Permission ${permissionId} not found`
        );

        const data: InsertUserPermission = {
            userId,
            permissionId
        };

        try {
            const relation = await UserPermissionModel.createRelation(data);
            dbLogger.info(
                {
                    userId,
                    permissionId
                },
                'permission added to user successfully'
            );
            return relation;
        } catch (error) {
            dbLogger.error(error, 'failed to add permission to user');
            throw error;
        }
    }

    /**
     * Remove a direct permission from a user.
     * @param userId - The ID of the user.
     * @param permissionId - The ID of the permission to remove.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if actor is not authorized or deletion fails.
     */
    async removeFromUser(userId: string, permissionId: string, actor: UserType): Promise<void> {
        dbLogger.info(
            {
                userId,
                permissionId,
                actor: actor.id
            },
            'removing permission from user'
        );

        PermissionService.assertAdmin(actor);

        try {
            await UserPermissionModel.deleteRelation(userId, permissionId);
            dbLogger.info(
                {
                    userId,
                    permissionId
                },
                'permission removed from user successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to remove permission from user');
            throw error;
        }
    }

    /**
     * List direct permissions for a user.
     * @param userId - The ID of the user.
     * @param actor - The user performing the action (must be an admin).
     * @param filter - Pagination options (PaginationParams type from db-types).
     * @returns An array of user-permission relation records.
     * @throws Error if user is not found, actor is not authorized, or listing fails.
     */
    async listForUser(
        userId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<UserPermissionRecord[]> {
        dbLogger.info(
            {
                userId,
                actor: actor.id,
                filter
            },
            'listing permissions for user'
        );

        PermissionService.assertAdmin(actor);

        const existingUser = assertExists(
            await UserModel.getUserById(userId),
            `User ${userId} not found`
        );

        try {
            const permissions = await UserPermissionModel.listByUser(existingUser.id, filter);
            dbLogger.info(
                {
                    userId: existingUser.id,
                    count: permissions.length
                },
                'permissions listed for user successfully'
            );
            return permissions;
        } catch (error) {
            dbLogger.error(error, 'failed to list permissions for user');
            throw error;
        }
    }

    /**
     * Get roles that a specific permission is assigned to.
     * @param id - The ID of the permission.
     * @param actor - The user performing the action (must be an admin).
     * @param filter - Pagination options (PaginationParams type from db-types).
     * @returns An array of role records.
     * @throws Error if permission is not found, actor is not authorized, or listing fails.
     */
    async getRoles(
        id: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<RoleRecord[]> {
        dbLogger.info(
            {
                permissionId: id,
                actor: actor.id,
                filter
            },
            'listing roles for permission'
        );

        PermissionService.assertAdmin(actor);

        const existingPermission = assertExists(
            await PermissionModel.getPermissionById(id),
            `Permission ${id} not found`
        );

        try {
            const roleRelations = await RolePermissionModel.listByPermission(
                existingPermission.id,
                filter
            );

            const roles: RoleRecord[] = [];
            for (const relation of roleRelations) {
                const role = await RoleModel.getRoleById(relation.roleId);
                if (role) {
                    roles.push(role);
                }
            }

            dbLogger.info(
                {
                    permissionId: existingPermission.id,
                    count: roles.length
                },
                'roles listed for permission successfully'
            );
            return roles;
        } catch (error) {
            dbLogger.error(error, 'failed to list roles for permission');
            throw error;
        }
    }

    /**
     * Check if a user has a specific permission (either directly or via their role).
     * This method is designed for authorization checks and does NOT require an 'actor' for authorization within itself.
     * @param userId - The ID of the user to check.
     * @param permissionId - The ID of the permission to check for.
     * @returns True if the user has the permission, false otherwise.
     * @throws Error if user or permission is not found.
     */
    async userHas(userId: string, permissionId: string): Promise<boolean> {
        // Note: No authorization check based on 'actor' here, as this IS an authorization check.
        // Ensure user and permission exist - handled by `assertExists` below.

        const existingUser = assertExists(
            await UserModel.getUserById(userId),
            `User ${userId} not found`
        );
        assertExists(
            await PermissionModel.getPermissionById(permissionId),
            `Permission ${permissionId} not found`
        );

        // Call model methods to check for existence, assuming they exist and return boolean or relation record
        // If the model methods return relation records, check if the result is non-null.
        // If they return boolean, use the boolean directly.

        // 1. Check direct user-permission relation
        const hasDirectPermission = await UserPermissionModel.getByUserIdAndPermissionId(
            existingUser.id,
            permissionId
        );

        if (hasDirectPermission) {
            return true;
        }

        // 2. Check role-permission relation if user has a role
        if (existingUser.roleId) {
            const hasRolePermission = await RolePermissionModel.getByRoleIdAndPermissionId(
                existingUser.roleId,
                permissionId
            );

            if (hasRolePermission) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a role has a specific permission.
     * This method is likely a helper for userHas and potentially used by admins.
     * Does NOT require an 'actor' for authorization within itself.
     * @param roleId - The ID of the role to check.
     * @param permissionId - The ID of the permission to check for.
     * @returns True if the role has the permission, false otherwise.
     * @throws Error if role or permission is not found.
     */
    async roleHas(roleId: string, permissionId: string): Promise<boolean> {
        // Note: No authorization check based on 'actor' here.
        // Ensure role and permission exist - handled by `assertExists` below.

        assertExists(await RoleModel.getRoleById(roleId), `Role ${roleId} not found`);
        assertExists(
            await PermissionModel.getPermissionById(permissionId),
            `Permission ${permissionId} not found`
        );

        // Call model method to check for existence, assuming it exists and returns boolean or relation record
        const hasPermission = await RolePermissionModel.getByRoleIdAndPermissionId(
            roleId,
            permissionId
        );

        return !!hasPermission;
    }

    /**
     * Remove all permissions from a role.
     * @param roleId - The ID of the role.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if role is not found, actor is not authorized, or deletion fails.
     */
    async clearAllFromRole(roleId: string, actor: UserType): Promise<void> {
        dbLogger.info({ roleId, actor: actor.id }, 'clearing all permissions from role');

        PermissionService.assertAdmin(actor);

        assertExists(await RoleModel.getRoleById(roleId), `Role ${roleId} not found`);

        try {
            await RolePermissionModel.deleteAllByRoleId(roleId);
            dbLogger.info({ roleId }, 'all permissions cleared from role successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to clear all permissions from role');
            throw error;
        }
    }

    /**
     * Remove all direct permissions from a user.
     * @param userId - The ID of the user.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if user is not found, actor is not authorized, or deletion fails.
     */
    async clearAllFromUser(userId: string, actor: UserType): Promise<void> {
        dbLogger.info({ userId, actor: actor.id }, 'clearing all direct permissions from user');

        PermissionService.assertAdmin(actor);

        assertExists(await UserModel.getUserById(userId), `User ${userId} not found`);

        try {
            await UserPermissionModel.deleteAllByUserId(userId);
            dbLogger.info(
                {
                    userId
                },
                'all direct permissions cleared from user successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to clear all direct permissions from user');
            throw error;
        }
    }
}
