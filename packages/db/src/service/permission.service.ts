import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    PermissionModel,
    type PermissionRecord,
    RoleModel,
    RolePermissionModel, // Will call methods on this model
    type RolePermissionRecord,
    type RoleRecord,
    UserModel,
    UserPermissionModel, // Will call methods on this model
    type UserPermissionRecord
} from '../model';
import type {
    InsertPermission,
    InsertRolePermission,
    InsertUserPermission,
    PaginationParams,
    SelectPermissionFilter,
    UpdatePermissionData
} from '../types/db-types';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils';
// Removed direct db, eq, and, schema imports as they are no longer used here

const log = logger.createLogger('PermissionService');

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
            log.warn('Admin access required', 'assertAdmin', { actorId: actor.id });
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
        log.info('creating permission', 'create', { actor: actor.id });

        PermissionService.assertAdmin(actor);

        try {
            const dataWithAudit: InsertPermission = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdPermission = await PermissionModel.createPermission(dataWithAudit);
            log.info('permission created successfully', 'create', {
                permissionId: createdPermission.id
            });
            return createdPermission;
        } catch (error) {
            log.error('failed to create permission', 'create', error, { actor: actor.id });
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
        log.info('fetching permission by id', 'getById', { permissionId: id, actor: actor.id });

        PermissionService.assertAdmin(actor);

        const permission = await PermissionModel.getPermissionById(id);
        const existingPermission = assertExists(permission, `Permission ${id} not found`);

        log.info('permission fetched successfully', 'getById', {
            permissionId: existingPermission.id
        });
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
        log.info('listing permissions', 'list', { filter, actor: actor.id });

        PermissionService.assertAdmin(actor);

        try {
            const permissions = await PermissionModel.listPermissions(filter);
            log.info('permissions listed successfully', 'list', {
                count: permissions.length,
                filter
            });
            return permissions;
        } catch (error) {
            log.error('failed to list permissions', 'list', error, { filter, actor: actor.id });
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
        log.info('updating permission', 'update', { permissionId: id, actor: actor.id });

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
            log.info('permission updated successfully', 'update', {
                permissionId: updatedPermission.id
            });
            return updatedPermission;
        } catch (error) {
            log.error('failed to update permission', 'update', error, {
                permissionId: id,
                actor: actor.id
            });
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
        log.info('soft deleting permission', 'delete', { permissionId: id, actor: actor.id });

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
            log.info('permission soft deleted successfully', 'delete', { permissionId: id });
        } catch (error) {
            log.error('failed to soft delete permission', 'delete', error, {
                permissionId: id,
                actor: actor.id
            });
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
        log.info('restoring permission', 'restore', { permissionId: id, actor: actor.id });

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
            log.info('permission restored successfully', 'restore', { permissionId: id });
        } catch (error) {
            log.error('failed to restore permission', 'restore', error, {
                permissionId: id,
                actor: actor.id
            });
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
        log.info('hard deleting permission', 'hardDelete', { permissionId: id, actor: actor.id });

        PermissionService.assertAdmin(actor);

        assertExists(
            await PermissionModel.getPermissionById(id),
            `Permission ${id} not found for hard delete`
        );

        try {
            await PermissionModel.hardDeletePermission(id);
            log.info('permission hard deleted successfully', 'hardDelete', { permissionId: id });
        } catch (error) {
            log.error('failed to hard delete permission', 'hardDelete', error, {
                permissionId: id,
                actor: actor.id
            });
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
        log.info('listing deprecated permissions', 'getDeprecated', { actor: actor.id, filter });

        PermissionService.assertAdmin(actor);

        const permissionFilter: SelectPermissionFilter = {
            isDeprecated: true,
            ...filter,
            includeDeleted: false
        };

        try {
            const permissions = await PermissionModel.listPermissions(permissionFilter);
            log.info('deprecated permissions listed successfully', 'getDeprecated', {
                count: permissions.length
            });
            return permissions;
        } catch (error) {
            log.error('failed to list deprecated permissions', 'getDeprecated', error, {
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
    async addToRole(
        roleId: string,
        permissionId: string,
        actor: UserType
    ): Promise<RolePermissionRecord> {
        log.info('adding permission to role', 'addToRole', {
            roleId,
            permissionId,
            actor: actor.id
        });

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
            log.info('permission added to role successfully', 'addToRole', {
                roleId,
                permissionId
            });
            return relation;
        } catch (error) {
            log.error('failed to add permission to role', 'addToRole', error, {
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
    async removeFromRole(roleId: string, permissionId: string, actor: UserType): Promise<void> {
        log.info('removing permission from role', 'removeFromRole', {
            roleId,
            permissionId,
            actor: actor.id
        });

        PermissionService.assertAdmin(actor);

        try {
            await RolePermissionModel.deleteRelation(roleId, permissionId);
            log.info('permission removed from role successfully', 'removeFromRole', {
                roleId,
                permissionId
            });
        } catch (error) {
            log.error('failed to remove permission from role', 'removeFromRole', error, {
                roleId,
                permissionId,
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
    async listForRole(
        roleId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<RolePermissionRecord[]> {
        log.info('listing permissions for role', 'listForRole', {
            roleId,
            actor: actor.id,
            filter
        });

        PermissionService.assertAdmin(actor);

        const existingRole = assertExists(
            await RoleModel.getRoleById(roleId),
            `Role ${roleId} not found`
        );

        try {
            // Use the existing model method listByRole which returns relation records
            const permissions = await RolePermissionModel.listByRole(existingRole.id, filter);
            log.info('permissions listed for role successfully', 'listForRole', {
                roleId: existingRole.id,
                count: permissions.length
            });
            return permissions;
        } catch (error) {
            log.error('failed to list permissions for role', 'listForRole', error, {
                roleId,
                actor: actor.id
            });
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
        log.info('adding permission to user', 'addToUser', {
            userId,
            permissionId,
            actor: actor.id
        });

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
            log.info('permission added to user successfully', 'addToUser', {
                userId,
                permissionId
            });
            return relation;
        } catch (error) {
            log.error('failed to add permission to user', 'addToUser', error, {
                userId,
                permissionId,
                actor: actor.id
            });
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
        log.info('removing permission from user', 'removeFromUser', {
            userId,
            permissionId,
            actor: actor.id
        });

        PermissionService.assertAdmin(actor);

        try {
            await UserPermissionModel.deleteRelation(userId, permissionId);
            log.info('permission removed from user successfully', 'removeFromUser', {
                userId,
                permissionId
            });
        } catch (error) {
            log.error('failed to remove permission from user', 'removeFromUser', error, {
                userId,
                permissionId,
                actor: actor.id
            });
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
        log.info('listing permissions for user', 'listForUser', {
            userId,
            actor: actor.id,
            filter
        });

        PermissionService.assertAdmin(actor);

        const existingUser = assertExists(
            await UserModel.getUserById(userId),
            `User ${userId} not found`
        );

        try {
            // Use the existing model method listByUser which returns relation records
            const permissions = await UserPermissionModel.listByUser(existingUser.id, filter);
            log.info('permissions listed for user successfully', 'listForUser', {
                userId: existingUser.id,
                count: permissions.length
            });
            return permissions;
        } catch (error) {
            log.error('failed to list permissions for user', 'listForUser', error, {
                userId,
                actor: actor.id
            });
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
        log.info('listing roles for permission', 'getRoles', {
            permissionId: id,
            actor: actor.id,
            filter
        });

        PermissionService.assertAdmin(actor);

        const existingPermission = assertExists(
            await PermissionModel.getPermissionById(id),
            `Permission ${id} not found`
        );

        try {
            // Use the existing model method listByPermission which returns relation records
            const roleRelations = await RolePermissionModel.listByPermission(
                existingPermission.id,
                filter
            );

            // Fetch the details for each Role based on the relation records
            // This approach adheres to 'service calls model' but might be less efficient
            const roles: RoleRecord[] = [];
            for (const relation of roleRelations) {
                // Call the RoleModel to get each role's details
                const role = await RoleModel.getRoleById(relation.roleId);
                if (role) {
                    roles.push(role);
                }
            }

            log.info('roles listed for permission successfully', 'getRoles', {
                permissionId: existingPermission.id,
                count: roles.length
            });
            return roles;
        } catch (error) {
            log.error('failed to list roles for permission', 'getRoles', error, {
                permissionId: id,
                actor: actor.id
            });
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
        // Assuming UserPermissionModel has a method to check existence by user and permission IDs
        const hasDirectPermission = await UserPermissionModel.getByUserIdAndPermissionId(
            existingUser.id,
            permissionId
        ); // Assume this method exists

        if (hasDirectPermission) {
            return true;
        }

        // 2. Check role-permission relation if user has a role
        if (existingUser.roleId) {
            // Assuming RolePermissionModel has a method to check existence by role and permission IDs
            const hasRolePermission = await RolePermissionModel.getByRoleIdAndPermissionId(
                existingUser.roleId,
                permissionId
            ); // Assume this method exists

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
        // Assuming RolePermissionModel has a method to check existence by role and permission IDs
        const hasPermission = await RolePermissionModel.getByRoleIdAndPermissionId(
            roleId,
            permissionId
        ); // Assume this method exists

        return !!hasPermission; // Return true if the model method indicates existence
    }

    /**
     * Remove all permissions from a role.
     * @param roleId - The ID of the role.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if role is not found, actor is not authorized, or deletion fails.
     */
    async clearAllFromRole(roleId: string, actor: UserType): Promise<void> {
        log.info('clearing all permissions from role', 'clearAllFromRole', {
            roleId,
            actor: actor.id
        });

        PermissionService.assertAdmin(actor);

        assertExists(await RoleModel.getRoleById(roleId), `Role ${roleId} not found`);

        try {
            // Call the model method to delete all by role ID
            // Assuming RolePermissionModel.deleteAllByRoleId exists
            await RolePermissionModel.deleteAllByRoleId(roleId);
            log.info('all permissions cleared from role successfully', 'clearAllFromRole', {
                roleId
            });
        } catch (error) {
            log.error('failed to clear all permissions from role', 'clearAllFromRole', error, {
                roleId,
                actor: actor.id
            });
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
        log.info('clearing all direct permissions from user', 'clearAllFromUser', {
            userId,
            actor: actor.id
        });

        PermissionService.assertAdmin(actor);

        assertExists(await UserModel.getUserById(userId), `User ${userId} not found`);

        try {
            // Call the model method to delete all by user ID
            // Assuming UserPermissionModel.deleteAllByUserId exists
            await UserPermissionModel.deleteAllByUserId(userId);
            log.info('all direct permissions cleared from user successfully', 'clearAllFromUser', {
                userId
            });
        } catch (error) {
            log.error(
                'failed to clear all direct permissions from user',
                'clearAllFromUser',
                error,
                { userId, actor: actor.id }
            );
            throw error;
        }
    }
}
