import { PermissionEnum, type PublicUserType, RoleEnum, type UserType } from '@repo/types';
import { CanViewReasonEnum } from '../../utils/service-helper';

/**
 * Determines if the given actor can view the specified user, following robust permission logic.
 * - Admins can view any user (ADMIN_BYPASS).
 * - A user can view themselves (OWNER).
 * - All others require explicit permission (USER_READ_ALL).
 *
 * @param actor - The user or public actor attempting to view the user.
 * @param user - The user entity to be viewed.
 * @returns An object with:
 *   - canView: Whether the actor can view the user.
 *   - reason: The reason for the access decision (enum).
 *   - checkedPermission: The permission required, if any.
 */
export const canViewUser = (
    actor: UserType | PublicUserType,
    user: UserType
): {
    canView: boolean;
    reason: CanViewReasonEnum;
    checkedPermission?: PermissionEnum;
} => {
    // Explicitly deny public actors
    if (!('role' in actor) || actor.role === RoleEnum.GUEST) {
        return { canView: false, reason: CanViewReasonEnum.PUBLIC_ACTOR_DENIED };
    }
    if (actor.role === RoleEnum.ADMIN) {
        return { canView: true, reason: CanViewReasonEnum.ADMIN_BYPASS };
    }
    if ('id' in actor && actor.id === user.id) {
        return { canView: true, reason: CanViewReasonEnum.OWNER };
    }
    return {
        canView: false,
        reason: CanViewReasonEnum.PERMISSION_CHECK_REQUIRED,
        checkedPermission: PermissionEnum.USER_READ_ALL
    };
};
