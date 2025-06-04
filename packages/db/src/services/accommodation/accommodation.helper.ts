import type { AccommodationType, NewAccommodationInputType } from '@repo/types';
import {
    AccommodationTypeEnum,
    PermissionEnum,
    type PublicUserType,
    RoleEnum,
    type UserType,
    VisibilityEnum,
    createPublicUser
} from '@repo/types';
import type { AccommodationOrderByColumn } from '../../models/accommodation/accommodation.model';
import { type dbLogger, hasPermission } from '../../utils';
import { castBrandedIds, castDateFields } from '../../utils/cast-helper';
import type { ListInput, UpdateInput } from './accommodation.schemas';

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

/**
 * Normalizes the update input: casts branded IDs, dates, and protects ownerId from being overwritten.
 * @param accommodation - The original accommodation object.
 * @param input - The update input object.
 * @returns The normalized update input with protected ownerId.
 */
export const normalizeUpdateInput = (
    accommodation: AccommodationType,
    input: UpdateInput
): UpdateInput => {
    const inputWithBrandedIds = castBrandedIds(input, (id) => id as typeof accommodation.id);
    const inputWithDates = castDateFields(inputWithBrandedIds);
    return {
        ...inputWithDates,
        ownerId: accommodation.ownerId // Always keep the original ownerId
    };
};

/**
 * Checks if the actor is the owner of the accommodation.
 */
export const isOwner = (
    actor: UserType | PublicUserType,
    accommodation: AccommodationType
): boolean => {
    return 'id' in actor && accommodation.ownerId === actor.id;
};

/**
 * Builds the update object for soft-deleting (archiving) an accommodation.
 */
export const buildSoftDeleteUpdate = (actor: UserType | PublicUserType) => {
    const now = new Date();
    const deletedById = 'id' in actor ? actor.id : undefined;
    return {
        lifecycleState: 'ARCHIVED',
        deletedAt: now,
        deletedById,
        updatedAt: now,
        updatedById: deletedById
    };
};

/**
 * Builds the update object for restoring (un-archiving) an accommodation.
 */
export const buildRestoreUpdate = (actor: UserType | PublicUserType) => {
    const now = new Date();
    const updatedById = 'id' in actor ? actor.id : undefined;
    return {
        lifecycleState: 'ACTIVE',
        deletedAt: undefined,
        deletedById: undefined,
        updatedAt: now,
        updatedById
    };
};

/**
 * Checks permission and logs if denied, throwing an error if not allowed.
 * @param actor - The user or public actor.
 * @param permission - The permission to check.
 * @param dbLoggerInstance - Logger instance for permission logging.
 * @param context - Context object for logging.
 * @param errorMessage - Custom error message to throw if permission is denied.
 */
export const checkAndLogPermission = (
    actor: UserType | PublicUserType,
    permission: PermissionEnum,
    dbLoggerInstance: typeof dbLogger,
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

/**
 * Normalizes the create input: casts branded IDs and dates.
 * @param input - The create input object.
 * @returns The normalized create input.
 */
export const normalizeCreateInput = (input: Record<string, unknown>): NewAccommodationInputType => {
    const inputWithBrandedIds = castBrandedIds(input, (id) => id as string);
    const inputWithDates = castDateFields(inputWithBrandedIds);
    // Validate 'type' is AccommodationTypeEnum
    if (
        !Object.values(AccommodationTypeEnum).includes(inputWithDates.type as AccommodationTypeEnum)
    ) {
        throw new Error(`Invalid accommodation type: ${inputWithDates.type}`);
    }
    return {
        ...inputWithDates,
        type: inputWithDates.type as AccommodationTypeEnum
    } as NewAccommodationInputType;
};

/**
 * Builds and cleans search params for the list method, handling public/private user logic.
 * @param input - The list input object.
 * @param actor - The user or public actor.
 * @returns Cleaned search params for AccommodationModel.search.
 */
export const buildSearchParams = (
    input: ListInput,
    actor: UserType | PublicUserType
): Record<string, unknown> => {
    const isPublic = isPublicUser(actor);
    const searchParams: Record<string, unknown> = isPublic
        ? { visibility: 'PUBLIC', limit: input.limit, offset: input.offset }
        : {
              q: input.q,
              type: input.type,
              limit: input.limit,
              offset: input.offset,
              order: input.order,
              orderBy: input.orderBy as AccommodationOrderByColumn | undefined,
              ...(input.visibility ? { visibility: input.visibility } : {})
          };
    return Object.fromEntries(Object.entries(searchParams).filter(([_, v]) => v !== undefined));
};

/**
 * Throws if the accommodation is archived or deleted.
 */
export const assertNotArchived = (accommodation: AccommodationType) => {
    if (accommodation.lifecycleState === 'ARCHIVED' || accommodation.deletedAt) {
        throw new Error('Accommodation is already archived or deleted');
    }
};

/**
 * Throws if the accommodation is already active (not archived).
 */
export const assertNotActive = (accommodation: AccommodationType) => {
    if (accommodation.lifecycleState !== 'ARCHIVED' || !accommodation.deletedAt) {
        throw new Error('Accommodation is not archived');
    }
};

/**
 * Logs the start of a service method.
 */
export const logMethodStart = (
    logger: typeof dbLogger,
    method: string,
    input: object,
    actor: object
) => {
    logger.info({ input, actor }, `${method}:start`);
};

/**
 * Logs the end of a service method.
 */
export const logMethodEnd = (logger: typeof dbLogger, method: string, result: object) => {
    logger.info({ result }, `${method}:end`);
};
