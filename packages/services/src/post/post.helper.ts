import {
    PermissionEnum,
    type PublicUserType,
    RoleEnum,
    type UserType,
    VisibilityEnum
} from '@repo/types';
import { CanViewReasonEnum } from '../utils/service-helper';

/**
 * Determines if the actor can view the post based on visibility, authorship, and permissions.
 * Returns an object with the result and the reason (for logging).
 * @param actor - The user or public actor.
 * @param post - The post object (must have visibility and optionally authorId).
 * @returns Object with canView, reason, and checkedPermission (if permission check is required).
 * @example
 * canViewPost(user, { visibility: 'PRIVATE', authorId: user.id })
 */
export const canViewPost = (
    actor: UserType | PublicUserType,
    post: { visibility: string; authorId?: string }
): { canView: boolean; reason: CanViewReasonEnum; checkedPermission?: PermissionEnum } => {
    // Validate visibility
    if (!Object.values(VisibilityEnum).includes(post.visibility as VisibilityEnum)) {
        return {
            canView: false,
            reason: CanViewReasonEnum.UNKNOWN_VISIBILITY,
            checkedPermission: undefined
        };
    }
    if (post.visibility === VisibilityEnum.PUBLIC) {
        return { canView: true, reason: CanViewReasonEnum.PUBLIC };
    }
    if ('id' in actor && post.authorId && post.authorId === actor.id) {
        return { canView: true, reason: CanViewReasonEnum.OWNER };
    }
    if ('role' in actor && (actor.role === RoleEnum.ADMIN || actor.role === RoleEnum.SUPER_ADMIN)) {
        return { canView: true, reason: CanViewReasonEnum.ADMIN_BYPASS };
    }
    const visibilityToPermission: Record<string, PermissionEnum> = {
        [VisibilityEnum.PRIVATE]: PermissionEnum.POST_VIEW_PRIVATE,
        [VisibilityEnum.DRAFT]: PermissionEnum.POST_VIEW_DRAFT
    };
    const perm = visibilityToPermission[post.visibility];
    if (perm) {
        // hasPermission must be checked by the service
        return {
            canView: false,
            reason: CanViewReasonEnum.PERMISSION_CHECK_REQUIRED,
            checkedPermission: perm
        };
    }
    // fallback (should not reach here)
    return {
        canView: false,
        reason: CanViewReasonEnum.UNKNOWN_VISIBILITY,
        checkedPermission: undefined
    };
};
