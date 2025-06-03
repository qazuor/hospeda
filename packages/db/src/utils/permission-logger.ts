import { type PermissionEnum, type PublicUserType, RoleEnum, type UserType } from '@repo/types';

/**
 * Logger type with a permission method for logging access denials.
 * Used for structured permission logging in all services.
 */
export type LoggerWithPermission = { permission: (args: unknown) => void };

/**
 * Logs denied access to a resource, including the reason and permission checked.
 * Use in any service to standardize permission denial logging.
 */
export const logDenied = (
    dbLogger: LoggerWithPermission,
    actor: UserType | PublicUserType,
    input: unknown,
    resource: { visibility: string },
    reason: string,
    checkedPermission?: PermissionEnum | string
) => {
    dbLogger.permission({
        permission: checkedPermission ?? 'UNKNOWN_PERMISSION',
        userId: 'id' in actor ? actor.id : 'public',
        role: 'role' in actor ? actor.role : RoleEnum.GUEST,
        extraData: { input, visibility: resource.visibility, error: reason }
    });
};

/**
 * Logs granted access to a resource (e.g., private/draft/created), including the reason and permission.
 * Use in any service to standardize permission grant logging.
 */
export const logGrant = (
    dbLogger: LoggerWithPermission,
    actor: UserType | PublicUserType,
    input: unknown,
    resource: { visibility: string },
    permission: PermissionEnum | string,
    reason: string
) => {
    dbLogger.permission({
        permission,
        userId: 'id' in actor ? actor.id : 'public',
        role: 'role' in actor ? actor.role : RoleEnum.GUEST,
        extraData: {
            input,
            visibility: resource.visibility,
            access: 'granted',
            reason,
            actor: { id: actor.id, role: actor.role }
        }
    });
};

/**
 * Logs denied access due to a user being disabled.
 * Use in any service to standardize logging for disabled user access attempts.
 */
export const logUserDisabled = (
    dbLogger: LoggerWithPermission,
    actor: UserType | PublicUserType,
    input: unknown,
    resource: { visibility: string },
    permission: PermissionEnum | string
) => {
    dbLogger.permission({
        permission,
        userId: actor.id,
        role: actor.role,
        extraData: {
            input,
            visibility: resource.visibility,
            access: 'denied',
            reason: 'user disabled',
            actor: { id: actor.id, role: actor.role }
        }
    });
};

/**
 * Logs override situations (e.g., forced visibility for public user).
 * Use in any service to standardize logging for permission overrides.
 */
export const logOverride = (
    dbLogger: LoggerWithPermission,
    input: unknown,
    permission: PermissionEnum | string,
    override: string
) => {
    dbLogger.permission({
        permission,
        userId: 'public',
        role: RoleEnum.GUEST,
        extraData: { input, override }
    });
};
