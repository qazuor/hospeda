import type { User } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';

/**
 * Checks if the actor can view the target user.
 * Allowed if: self-check OR actor has USER_READ_ALL permission.
 * SUPER_ADMIN always passes because they have all permissions assigned.
 * @param actor - The acting user (may be undefined)
 * @param target - The user being viewed
 * @throws ServiceError (FORBIDDEN) if not allowed
 */
export const canViewUser = (actor: Actor | undefined, target: User): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (actor.id !== target.id && !hasPermission(actor, PermissionEnum.USER_READ_ALL)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Only self or users with USER_READ_ALL can view user'
        );
    }
};

/**
 * Checks if the actor can update the target user.
 * Allowed if: self-check OR actor has USER_UPDATE_ANY permission.
 * @param actor - The acting user (may be undefined)
 * @param target - The user being updated
 * @throws ServiceError (FORBIDDEN) if not allowed
 */
export const canUpdateUser = (actor: Actor | undefined, target: User): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (actor.id !== target.id && !hasPermission(actor, PermissionEnum.USER_UPDATE_ANY)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Only self or users with USER_UPDATE_ANY can update user'
        );
    }
};

/**
 * Checks if the actor can assign a role to a user.
 * Requires USER_UPDATE_ROLES permission.
 * @param actor - The acting user (may be undefined)
 * @throws ServiceError (FORBIDDEN) if not allowed
 */
export const canAssignRole = (actor: Actor | undefined): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (!hasPermission(actor, PermissionEnum.USER_UPDATE_ROLES)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Requires USER_UPDATE_ROLES permission to assign roles'
        );
    }
};

/**
 * Checks if the actor can add a permission to a user.
 * Requires USER_UPDATE_ROLES permission.
 * @param actor - The acting user (may be undefined)
 * @throws ServiceError (FORBIDDEN) if not allowed
 */
export const canAddPermission = (actor: Actor | undefined): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (!hasPermission(actor, PermissionEnum.USER_UPDATE_ROLES)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Requires USER_UPDATE_ROLES permission to add permissions'
        );
    }
};

/**
 * Checks if the actor can set permissions for a user.
 * Requires USER_UPDATE_ROLES permission.
 * @param actor - The acting user (may be undefined)
 * @throws ServiceError (FORBIDDEN) if not allowed
 */
export const canSetPermissions = (actor: Actor | undefined): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (!hasPermission(actor, PermissionEnum.USER_UPDATE_ROLES)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Requires USER_UPDATE_ROLES permission to set permissions'
        );
    }
};

/**
 * Checks if the actor can remove a permission from a user.
 * Requires USER_UPDATE_ROLES permission.
 * @param actor - The acting user (may be undefined)
 * @throws ServiceError (FORBIDDEN) if not allowed
 */
export const canRemovePermission = (actor: Actor | undefined): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (!hasPermission(actor, PermissionEnum.USER_UPDATE_ROLES)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Requires USER_UPDATE_ROLES permission to remove permissions'
        );
    }
};

/**
 * Checks if the actor has permission to use admin list for users.
 * Requires USER_READ_ALL permission in addition to admin access
 * (admin access is verified by the base class default).
 *
 * @param actor - The user or system performing the action.
 * @throws {ServiceError} If the actor lacks USER_READ_ALL permission.
 */
export function checkCanAdminList(actor: Actor): void {
    if (!hasPermission(actor, PermissionEnum.USER_READ_ALL)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: USER_READ_ALL required for admin list'
        );
    }
}
