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
 * Type guard to check if an actor is a UserType (not a PublicUserType).
 * @param actor - The actor to check.
 * @returns True if the actor is a UserType.
 * @example
 * isUserType({ id: 'user-1', role: RoleEnum.ADMIN }) // true
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
 * @param actor - The actor to check.
 * @returns UserType or PublicUserType.
 * @example
 * getSafeActor(undefined) // PublicUserType
 */
export const getSafeActor = (actor: unknown): UserType | PublicUserType => {
    return isUserType(actor) ? actor : createPublicUser();
};

/**
 * Checks if the actor is a public (anonymous) user.
 * @param actor - The actor to check.
 * @returns True if the actor is a public user.
 * @example
 * isPublicUser(getSafeActor(undefined)) // true
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
 * Checks if a user is disabled (either via 'enabled' property or settings.notifications.enabled === false).
 * @param actor - The actor to check.
 * @returns True if the user is disabled.
 * @example
 * isUserDisabled(getMockUser({ enabled: false })) // true
 */
export const isUserDisabled = (actor: UserType | PublicUserType): boolean => {
    if ('enabled' in actor) return actor.enabled === false;
    if ('settings' in actor && actor.settings?.notifications?.enabled === false) return true;
    return false;
};

/**
 * Determines if the actor can view the accommodation based on visibility, ownership, and permissions.
 * Returns an object with the result and the reason (for logging).
 * @param actor - The user or public actor.
 * @param accommodation - The accommodation object (must have visibility and optionally ownerId).
 * @returns Object with canView, reason, and checkedPermission (if permission check is required).
 * @example
 * canViewAccommodation(user, { visibility: 'PRIVATE', ownerId: user.id })
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
