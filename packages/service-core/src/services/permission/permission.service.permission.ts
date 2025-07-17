import { PermissionEnum } from '@repo/types';
import type { Actor } from '../../types';

/**
 * Checks if the actor can manage permissions (assign/remove) for roles or users.
 * @param actor The actor performing the action
 * @returns boolean
 */
export const canManagePermissions = (actor: Actor): boolean => {
    return actor.permissions.includes(PermissionEnum.USER_UPDATE_ROLES);
};
