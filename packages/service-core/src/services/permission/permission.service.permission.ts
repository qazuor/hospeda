import { PermissionEnum } from '@repo/schemas';
import type { Actor } from '../../types';

/**
 * Checks if the actor has permission to assign permissions to roles or users.
 * @param actor - The actor requesting the operation
 * @returns true if the actor can assign permissions
 */
export const canAssignPermissions = (actor: Actor): boolean => {
    return actor.permissions.includes(PermissionEnum.PERMISSION_ASSIGN);
};

/**
 * Checks if the actor has permission to revoke permissions from roles or users.
 * @param actor - The actor requesting the operation
 * @returns true if the actor can revoke permissions
 */
export const canRevokePermissions = (actor: Actor): boolean => {
    return actor.permissions.includes(PermissionEnum.PERMISSION_REVOKE);
};

/**
 * Checks if the actor has permission to view permission assignments.
 * @param actor - The actor requesting the operation
 * @returns true if the actor can view permissions
 */
export const canViewPermissions = (actor: Actor): boolean => {
    return actor.permissions.includes(PermissionEnum.PERMISSION_VIEW);
};
