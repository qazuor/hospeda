// Helpers for DestinationService (pattern: accommodation.helper.ts)

import {
    PermissionEnum,
    type PublicUserType,
    RoleEnum,
    type UserType,
    VisibilityEnum
} from '@repo/types';
import { CanViewReasonEnum } from '../../utils/service-helper';

// --- Permissions & Visibility Helpers (copied/adapted from accommodation.helper.ts) ---

/**
 * Determines if the actor can view the destination based on visibility and permissions.
 * Returns an object with the result and the reason (for logging).
 */
export const canViewDestination = (
    actor: UserType | PublicUserType,
    destination: { visibility: string; ownerId?: string }
): { canView: boolean; reason: CanViewReasonEnum; checkedPermission?: PermissionEnum } => {
    // if (process.env.NODE_ENV === 'test') {
    //     // eslint-disable-next-line no-console
    //     console.log('[canViewDestination DEBUG]', { visibility: destination.visibility, ownerId: destination.ownerId, actorId: 'id' in actor ? actor.id : undefined });
    // }
    if (!Object.values(VisibilityEnum).includes(destination.visibility as VisibilityEnum)) {
        return {
            canView: false,
            reason: CanViewReasonEnum.UNKNOWN_VISIBILITY,
            checkedPermission: undefined
        };
    }
    if (destination.visibility === 'PUBLIC') {
        return { canView: true, reason: CanViewReasonEnum.PUBLIC };
    }
    if ('role' in actor && (actor.role === RoleEnum.ADMIN || actor.role === RoleEnum.SUPER_ADMIN)) {
        return { canView: true, reason: CanViewReasonEnum.ADMIN_BYPASS };
    }
    if ('id' in actor && destination.ownerId && actor.id === destination.ownerId) {
        return { canView: true, reason: CanViewReasonEnum.OWNER };
    }
    const visibilityToPermission: Record<string, PermissionEnum> = {
        PRIVATE: PermissionEnum.DESTINATION_VIEW_PRIVATE,
        DRAFT: PermissionEnum.DESTINATION_VIEW_DRAFT
    };
    const perm = visibilityToPermission[destination.visibility];
    if (perm) {
        return {
            canView: false,
            reason: CanViewReasonEnum.PERMISSION_CHECK_REQUIRED,
            checkedPermission: perm
        };
    }
    return {
        canView: false,
        reason: CanViewReasonEnum.UNKNOWN_VISIBILITY,
        checkedPermission: undefined
    };
};
