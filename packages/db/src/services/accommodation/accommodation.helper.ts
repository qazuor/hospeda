import {
    PermissionEnum,
    type PublicUserType,
    RoleEnum,
    type UserType,
    VisibilityEnum,
    createPublicUser
} from '@repo/types';

/**
 * Enum representing the reason why an actor can or cannot view an accommodation.
 * Used for logging and access control explanations.
 * @example
 * CanViewReasonEnum.PUBLIC // 'public visibility'
 */
export enum CanViewReasonEnum {
    PUBLIC = 'public visibility',
    OWNER = 'owner access',
    ADMIN_BYPASS = 'admin/superadmin bypass',
    HAS_PERMISSION = 'has permission',
    MISSING_PERMISSION = 'missing permission',
    PERMISSION_CHECK_REQUIRED = 'permission check required',
    UNKNOWN_VISIBILITY = 'unknown visibility'
}

/**
 * Returns true if the given actor is a UserType (not a PublicUserType).
 * Use to distinguish between authenticated and public users.
 */
export const isUserType = (actor: unknown): actor is UserType => {
    return (
        typeof actor === 'object' &&
        actor !== null &&
        'id' in actor &&
        'role' in actor &&
        typeof (actor as { id?: unknown }).id === 'string' &&
        typeof (actor as { role?: unknown }).role === 'string'
    );
};

/**
 * Returns a safe actor (UserType or PublicUserType). If the input is not a UserType, returns a PublicUserType.
 * Use to ensure all logic operates on a valid actor object.
 */
export const getSafeActor = (actor: unknown): UserType | PublicUserType => {
    return isUserType(actor) ? actor : createPublicUser();
};

/**
 * Returns true if the actor is a public (anonymous) user.
 * Use to check for guest access.
 */
export const isPublicUser = (actor: UserType | PublicUserType): boolean => {
    return 'role' in actor && actor.role === RoleEnum.GUEST;
};

/**
 * Logger type with a permission method for logging access denials.
 * Used for structured permission logging.
 */
export type LoggerWithPermission = { permission: (args: unknown) => void };

/**
 * Returns true if the user is disabled (either via 'enabled' property or settings.notifications.enabled === false).
 * Use to block access for disabled users.
 */
export const isUserDisabled = (actor: UserType | PublicUserType): boolean => {
    if ('enabled' in actor) return actor.enabled === false;
    if ('settings' in actor && actor.settings?.notifications?.enabled === false) return true;
    return false;
};

/**
 * Determines if the actor can view the accommodation based on visibility, ownership, and permissions.
 * Returns an object with the result and the reason (for logging).
 * Use in access control logic for accommodations.
 */
export const canViewAccommodation = (
    actor: UserType | PublicUserType,
    accommodation: { visibility: string; ownerId?: string }
): { canView: boolean; reason: CanViewReasonEnum; checkedPermission?: PermissionEnum } => {
    // FIRST: validate visibility
    if (!Object.values(VisibilityEnum).includes(accommodation.visibility as VisibilityEnum)) {
        return {
            canView: false,
            reason: CanViewReasonEnum.UNKNOWN_VISIBILITY,
            checkedPermission: undefined
        };
    }
    if (accommodation.visibility === 'PUBLIC') {
        return { canView: true, reason: CanViewReasonEnum.PUBLIC };
    }
    if ('id' in actor && accommodation.ownerId && accommodation.ownerId === actor.id) {
        return { canView: true, reason: CanViewReasonEnum.OWNER };
    }
    if ('role' in actor && (actor.role === RoleEnum.ADMIN || actor.role === RoleEnum.SUPER_ADMIN)) {
        return { canView: true, reason: CanViewReasonEnum.ADMIN_BYPASS };
    }
    const visibilityToPermission: Record<string, PermissionEnum> = {
        PRIVATE: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
        DRAFT: PermissionEnum.ACCOMMODATION_VIEW_DRAFT
    };
    const perm = visibilityToPermission[accommodation.visibility];
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
