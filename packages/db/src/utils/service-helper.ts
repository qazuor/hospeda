import {
    LifecycleStatusEnum,
    type PublicUserType,
    RoleEnum,
    type UserType,
    createPublicUser
} from '@repo/types';
import { hasPermission } from '../utils';
import type { serviceLogger } from './service-logger';

/**
 * Enum representing the reason why an actor can or cannot view an entity (accommodation, destination, etc).
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
    UNKNOWN_VISIBILITY = 'unknown visibility',
    PUBLIC_ACTOR_DENIED = 'public actor denied'
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
 * Checks if a user is disabled (by lifecycleState).
 * @param actor - The actor to check.
 * @returns True if the user is disabled.
 * @example
 * isUserDisabled(getMockUser({ lifecycleState: LifecycleStatusEnum.INACTIVE })) // true
 */
export const isUserDisabled = (actor: UserType | PublicUserType): boolean => {
    return 'lifecycleState' in actor && actor.lifecycleState !== LifecycleStatusEnum.ACTIVE;
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
 * Logs the start of a service method.
 * @param logger - Logger instance.
 * @param method - Method name.
 * @param input - Input object.
 * @param actor - Actor object.
 * @example
 * logMethodStart(logger, 'getById', { id: 'x' }, user)
 */
export const logMethodStart = (
    logger: typeof serviceLogger,
    method: string,
    input: object,
    actor: object
) => {
    logger.info({ input, actor }, `${method}:start`);
};

/**
 * Logs the end of a service method.
 * @param logger - Logger instance.
 * @param method - Method name.
 * @param result - Result object.
 * @example
 * logMethodEnd(logger, 'getById', { result })
 */
export const logMethodEnd = (logger: typeof serviceLogger, method: string, result: object) => {
    logger.info({ result }, `${method}:end`);
};

/**
 * Checks permission and logs if denied, throwing an error if not allowed.
 * @param actor - The user or public actor.
 * @param permission - The permission to check.
 * @param dbLoggerInstance - Logger instance for permission logging.
 * @param context - Context object for logging.
 * @param errorMessage - Custom error message to throw if permission is denied.
 * @example
 * checkAndLogPermission(user, PermissionEnum.ACCOMMODATION_UPDATE_OWN, dbLogger, { input }, 'Forbidden')
 */
export const checkAndLogPermission = (
    actor: UserType | PublicUserType,
    permission: import('@repo/types').PermissionEnum | import('@repo/types').PermissionEnum[],
    dbLoggerInstance: { permission: (args: unknown) => void },
    context: object,
    errorMessage: string
) => {
    try {
        hasPermission(actor, permission);
    } catch (err) {
        dbLoggerInstance.permission({
            permission,
            userId: 'id' in actor ? actor.id : 'public',
            role: 'role' in actor ? actor.role : RoleEnum.GUEST,
            extraData: { ...context, error: (err as Error).message }
        });
        throw new Error(errorMessage);
    }
};
