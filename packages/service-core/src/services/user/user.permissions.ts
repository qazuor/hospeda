import type { UserType } from '@repo/types';
import { ServiceErrorCode } from '@repo/types';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if the actor can view the target user.
 * Only the user themselves or a super admin can view.
 * @param actor - The acting user (may be undefined)
 * @param target - The user being viewed
 * @throws ServiceError (FORBIDDEN) if not allowed
 */
export const canViewUser = (actor: Actor | undefined, target: UserType): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (actor.id !== target.id && actor.role !== 'SUPER_ADMIN') {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Only self or super admin can view user'
        );
    }
};

/**
 * Checks if the actor can update the target user.
 * Only the user themselves or a super admin can update.
 * @param actor - The acting user (may be undefined)
 * @param target - The user being updated
 * @throws ServiceError (FORBIDDEN) if not allowed
 */
export const canUpdateUser = (actor: Actor | undefined, target: UserType): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (actor.id !== target.id && actor.role !== 'SUPER_ADMIN') {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Only self or super admin can update user'
        );
    }
};

/**
 * Checks if the actor can assign a role to a user.
 * Only super admin can assign roles.
 * @param actor - The acting user (may be undefined)
 * @throws ServiceError (FORBIDDEN) if not allowed
 */
export const canAssignRole = (actor: Actor | undefined): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (actor.role !== 'SUPER_ADMIN') {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Only super admin can assign roles'
        );
    }
};

/**
 * Checks if the actor can add a permission to a user.
 * Only super admin can add permissions.
 * @param actor - The acting user (may be undefined)
 * @throws ServiceError (FORBIDDEN) if not allowed
 */
export const canAddPermission = (actor: Actor | undefined): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (actor.role !== 'SUPER_ADMIN') {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Only super admin can add permissions'
        );
    }
};

/**
 * Checks if the actor can set permissions for a user.
 * Only super admin can set permissions.
 * @param actor - The acting user (may be undefined)
 * @throws ServiceError (FORBIDDEN) if not allowed
 */
export const canSetPermissions = (actor: Actor | undefined): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (actor.role !== 'SUPER_ADMIN') {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Only super admin can set permissions'
        );
    }
};

/**
 * Checks if the actor can remove a permission from a user.
 * Only super admin can remove permissions.
 * @param actor - The acting user (may be undefined)
 * @throws ServiceError (FORBIDDEN) if not allowed
 */
export const canRemovePermission = (actor: Actor | undefined): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    if (actor.role !== 'SUPER_ADMIN') {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Only super admin can remove permissions'
        );
    }
};
