import {
    LifecycleStatusEnum,
    PermissionEnum,
    type PublicUserType,
    RoleEnum,
    type UserType,
    VisibilityEnum
} from '@repo/types';
import { CanViewReasonEnum } from '../../utils/service-helper';

/**
 * Determines if the actor can view the event based on visibility and permissions.
 * Returns an object with the result and the reason (for logging).
 *
 * @param actor - The user or public actor requesting the event.
 * @param event - The event object (must include visibility, authorId, and lifecycleState).
 * @returns An object with canView (boolean), reason (CanViewReasonEnum), and checkedPermission (if permission check is required).
 */
export const canViewEvent = (
    actor: UserType | PublicUserType,
    event: { visibility: VisibilityEnum; authorId: string; lifecycleState: LifecycleStatusEnum }
): { canView: boolean; reason: CanViewReasonEnum; checkedPermission?: PermissionEnum } => {
    if (!Object.values(VisibilityEnum).includes(event.visibility as VisibilityEnum)) {
        return {
            canView: false,
            reason: CanViewReasonEnum.UNKNOWN_VISIBILITY,
            checkedPermission: undefined
        };
    }
    if (event.lifecycleState !== LifecycleStatusEnum.ACTIVE) {
        // Only admins can view non-active events
        if (
            'role' in actor &&
            (actor.role === RoleEnum.ADMIN || actor.role === RoleEnum.SUPER_ADMIN)
        ) {
            return { canView: true, reason: CanViewReasonEnum.ADMIN_BYPASS };
        }
        return {
            canView: false,
            reason: CanViewReasonEnum.PUBLIC_ACTOR_DENIED,
            checkedPermission: undefined
        };
    }
    if (event.visibility === VisibilityEnum.PUBLIC) {
        return { canView: true, reason: CanViewReasonEnum.PUBLIC };
    }
    if ('role' in actor && (actor.role === RoleEnum.ADMIN || actor.role === RoleEnum.SUPER_ADMIN)) {
        return { canView: true, reason: CanViewReasonEnum.ADMIN_BYPASS };
    }
    // The author can view their own event even if it is private/draft
    if ('id' in actor && actor.id === event.authorId) {
        return { canView: true, reason: CanViewReasonEnum.OWNER };
    }
    if (event.visibility === VisibilityEnum.PRIVATE) {
        return {
            canView: false,
            reason: CanViewReasonEnum.PERMISSION_CHECK_REQUIRED,
            checkedPermission: PermissionEnum.EVENT_VIEW_PRIVATE
        };
    }
    if (event.visibility === VisibilityEnum.DRAFT) {
        return {
            canView: false,
            reason: CanViewReasonEnum.PERMISSION_CHECK_REQUIRED,
            checkedPermission: PermissionEnum.EVENT_VIEW_DRAFT
        };
    }
    return {
        canView: false,
        reason: CanViewReasonEnum.UNKNOWN_VISIBILITY,
        checkedPermission: undefined
    };
};
