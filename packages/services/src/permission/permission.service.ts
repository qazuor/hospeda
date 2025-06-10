import { UserModel } from '@repo/db';
import {
    getSafeActor,
    isUserDisabled,
    logMethodEnd,
    logMethodStart,
    serviceLogger
} from '../utils';
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
    async addPermissionToRole(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    async removePermissionFromRole(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    async getRolePermissions(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    async listRolesWithPermission(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    async removePermissionFromUser(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    async getUserPermissions(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    async listUsersWithPermission(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    async hasPermission(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    async bulkAddPermissionsToUser(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    async bulkRemovePermissionsFromUser(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    async getAllPermissions(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    }
};
