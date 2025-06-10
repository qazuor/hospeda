import { UserModel } from '../../models/user/user.model';
import {
    getSafeActor,
    isUserDisabled,
    logMethodEnd,
    logMethodStart
} from '../../utils/service-helper';
import { serviceLogger } from '../../utils/serviceLogger';
import {
    type AddPermissionToUserInput,
    type AddPermissionToUserOutput,
    addPermissionToUserInputSchema
} from './permission.schemas';

export const PermissionService = {
    /**
     * Adds a permission to a user. Only admin can perform this action.
     * Applies validation, logging, and permission checks.
     *
     * @param input - User ID and permission to add.
     * @param actor - The admin actor adding the permission.
     * @returns Object with the updated user (without password), or null if not found.
     * @throws Error if not allowed, user not found, self-action, or duplicate permission.
     */
    async addPermissionToUser(
        input: AddPermissionToUserInput,
        actor: unknown
    ): Promise<AddPermissionToUserOutput> {
        logMethodStart(serviceLogger, 'addPermissionToUser', input, actor as object);
        const parsedInput = addPermissionToUserInputSchema.parse(input);
        const safeActor = getSafeActor(actor);

        // Do not allow if the actor is disabled
        if (isUserDisabled(safeActor)) {
            logMethodEnd(serviceLogger, 'addPermissionToUser', { user: null });
            throw new Error('Disabled users cannot add permissions');
        }
        // Only admin can add permissions
        if (!('role' in safeActor) || safeActor.role !== 'ADMIN') {
            logMethodEnd(serviceLogger, 'addPermissionToUser', { user: null });
            throw new Error('Only admin can add permissions');
        }
        // Find user to update
        const user = await UserModel.getById(parsedInput.id);
        if (!user) {
            logMethodEnd(serviceLogger, 'addPermissionToUser', { user: null });
            throw new Error('User not found');
        }
        // Prevent admin from adding permission to themselves
        if ('id' in safeActor && safeActor.id === user.id) {
            logMethodEnd(serviceLogger, 'addPermissionToUser', { user: null });
            throw new Error('Admin cannot add permission to themselves');
        }
        // Check for duplicate permission
        if (user.permissions?.includes(parsedInput.permission)) {
            logMethodEnd(serviceLogger, 'addPermissionToUser', { user: null });
            throw new Error('User already has this permission');
        }
        // Add permission
        const userOut = await UserModel.addPermission(user.id, parsedInput.permission);
        if (!userOut) {
            logMethodEnd(serviceLogger, 'addPermissionToUser', { user: null });
            throw new Error('Failed to add permission');
        }
        logMethodEnd(serviceLogger, 'addPermissionToUser', { user: userOut });
        return { user: userOut };
    },
    /**
     * Adds a permission to a role. Only admin can perform this action.
     * @throws Error (not implemented).
     */
    async addPermissionToRole(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Removes a permission from a role. Only admin can perform this action.
     * @throws Error (not implemented).
     */
    async removePermissionFromRole(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Gets the permissions assigned to a role.
     * @throws Error (not implemented).
     */
    async getRolePermissions(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Lists all roles that have a specific permission.
     * @throws Error (not implemented).
     */
    async listRolesWithPermission(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Removes a permission from a user. Only admin can perform this action.
     * @throws Error (not implemented).
     */
    async removePermissionFromUser(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Gets the effective permissions of a user.
     * @throws Error (not implemented).
     */
    async getUserPermissions(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Lists all users that have a specific permission.
     * @throws Error (not implemented).
     */
    async listUsersWithPermission(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Checks if a user has a specific permission.
     * @throws Error (not implemented).
     */
    async hasPermission(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Adds multiple permissions to a user in bulk. Only admin can perform this action.
     * @throws Error (not implemented).
     */
    async bulkAddPermissionsToUser(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Removes multiple permissions from a user in bulk. Only admin can perform this action.
     * @throws Error (not implemented).
     */
    async bulkRemovePermissionsFromUser(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Gets the list of all available permissions in the system.
     * @throws Error (not implemented).
     */
    async getAllPermissions(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    }
};
