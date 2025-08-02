import {
    EntityPermissionReasonEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/types';
import type { Actor } from '../types';
import { ServiceError } from '../types';

/**
 * Defines the set of actions that can be performed on an entity,
 * used by the generic permission evaluation logic.
 */
export type EntityAction =
    | 'view'
    | 'update'
    | 'delete'
    | 'restore'
    | 'hardDelete'
    | 'approve'
    | 'reject'
    | 'feature'
    | 'publish';

/**
 * Represents the minimal required properties of an entity for permission evaluation.
 */
export interface EntityPermissionInput {
    /** The current lifecycle status of the entity (e.g., DRAFT, ACTIVE, ARCHIVED). */
    lifecycleState: LifecycleStatusEnum;
    /** The current moderation status of the entity (e.g., PENDING, APPROVED, REJECTED). */
    moderationState: ModerationStatusEnum;
    /** The visibility level of the entity (e.g., PUBLIC, PRIVATE). */
    visibility: VisibilityEnum;
    /** The ID of the user who owns the entity. */
    ownerId: string;
    /** The timestamp when the entity was soft-deleted, if applicable. */
    deletedAt?: Date | null;
}

/**
 * Represents the minimal required properties of an actor for permission evaluation.
 */
export interface EntityPermissionActor {
    /** The unique identifier of the actor. */
    id: string;
    /** The role of the actor (e.g., USER, ADMIN, SUPER_ADMIN). */
    role: RoleEnum;
    /** A list of specific permissions assigned to the actor. */
    permissions: PermissionEnum[];
}

/**
 * Represents the result of a permission evaluation, indicating whether the
 * action is allowed and providing a reason code.
 */
export interface EntityPermissionResult {
    /** `true` if the action is allowed, `false` otherwise. */
    allowed: boolean;
    /** A code explaining why the permission was granted or denied. */
    reason: EntityPermissionReasonEnum;
}

/**
 * A map of permission enums to human-readable descriptions.
 * Used for generating user-friendly error messages.
 */
const permissionDescriptions: Partial<Record<PermissionEnum, string>> = {
    [PermissionEnum.ACCOMMODATION_CREATE]: 'create accommodations',
    [PermissionEnum.ACCOMMODATION_VIEW_ALL]: 'view all accommodations',
    [PermissionEnum.ACCOMMODATION_UPDATE_ANY]: 'update any accommodation',
    [PermissionEnum.ACCOMMODATION_DELETE_ANY]: 'delete any accommodation'
};

/**
 * Checks if an actor has a specific permission.
 * This is a direct check on the actor's `permissions` array.
 * @param actor - The actor object, containing their permissions.
 * @param permission - The permission to check for.
 * @returns `true` if the actor has the permission, `false` otherwise.
 */
export const hasPermission = (actor: Actor, permission: PermissionEnum): boolean => {
    return actor.permissions.includes(permission);
};

/**
 * Provides a generic permission evaluation logic for entities based on their state,
 * the actor's role, and the action being performed.
 * This function implements a complex set of rules to determine access rights.
 * @param actor - The user performing the action.
 * @param entity - The entity being acted upon.
 * @param action - The action to evaluate (e.g., 'view', 'update').
 * @param options - Optional flags to indicate if the actor has 'any' or 'own' permissions.
 * @returns An `EntityPermissionResult` object with the outcome of the evaluation.
 */
export function getEntityPermission(
    actor: EntityPermissionActor,
    entity: EntityPermissionInput,
    action: EntityAction,
    options?: { hasAny?: boolean; hasOwn?: boolean }
): EntityPermissionResult {
    // Deny access if actor is not provided or malformed.
    if (
        !actor ||
        typeof actor.id === 'undefined' ||
        typeof actor.role === 'undefined' ||
        !Array.isArray(actor.permissions)
    ) {
        return { allowed: false, reason: EntityPermissionReasonEnum.DENIED };
    }

    // Super admin can do everything.
    if (actor.role === RoleEnum.SUPER_ADMIN) {
        return { allowed: true, reason: EntityPermissionReasonEnum.SUPER_ADMIN };
    }

    // Hard delete: only super admin can perform this action.
    if (action === 'hardDelete') {
        return { allowed: false, reason: EntityPermissionReasonEnum.NOT_SUPER_ADMIN };
    }

    // If the entity is soft-deleted, no action is allowed except for hardDelete (covered above).
    if (entity.deletedAt) {
        return { allowed: false, reason: EntityPermissionReasonEnum.DELETED };
    }

    // Restore on archived entity: only admin or owner can perform this.
    if (entity.lifecycleState === LifecycleStatusEnum.ARCHIVED && action === 'restore') {
        if (options?.hasAny) {
            return { allowed: true, reason: EntityPermissionReasonEnum.ADMIN };
        }
        if (options?.hasOwn) {
            return { allowed: true, reason: EntityPermissionReasonEnum.OWNER };
        }
        return { allowed: false, reason: EntityPermissionReasonEnum.ARCHIVED };
    }

    // Actions like approve/reject/feature/publish: only admins.
    if (['approve', 'reject', 'feature', 'publish'].includes(action)) {
        if (actor.role === RoleEnum.ADMIN) {
            return { allowed: true, reason: EntityPermissionReasonEnum.ADMIN };
        }
        return { allowed: false, reason: EntityPermissionReasonEnum.NOT_ADMIN };
    }

    // For update/delete/restore actions: owner on their own entity, admin on any entity.
    if (['update', 'delete', 'restore'].includes(action)) {
        if (options?.hasAny) {
            return { allowed: true, reason: EntityPermissionReasonEnum.ADMIN };
        }
        if (options?.hasOwn) {
            return { allowed: true, reason: EntityPermissionReasonEnum.OWNER };
        }
        return { allowed: false, reason: EntityPermissionReasonEnum.DENIED };
    }

    // --- View Logic ---
    if (action === 'view') {
        // ARCHIVED/DRAFT/REJECTED states: only admin or the owner can view.
        if (
            [LifecycleStatusEnum.ARCHIVED, LifecycleStatusEnum.DRAFT].includes(
                entity.lifecycleState
            ) ||
            entity.moderationState === ModerationStatusEnum.REJECTED
        ) {
            if (actor.role === RoleEnum.ADMIN) {
                return { allowed: true, reason: EntityPermissionReasonEnum.ADMIN };
            }
            if (actor.role === RoleEnum.HOST && entity.ownerId === actor.id) {
                return { allowed: true, reason: EntityPermissionReasonEnum.OWNER };
            }
            return {
                allowed: false,
                reason:
                    entity.lifecycleState === LifecycleStatusEnum.ARCHIVED
                        ? EntityPermissionReasonEnum.ARCHIVED
                        : entity.lifecycleState === LifecycleStatusEnum.DRAFT
                          ? EntityPermissionReasonEnum.DRAFT
                          : EntityPermissionReasonEnum.REJECTED
            };
        }
        // ACTIVE + APPROVED + PUBLIC: accessible to anyone.
        if (
            entity.lifecycleState === LifecycleStatusEnum.ACTIVE &&
            entity.moderationState === ModerationStatusEnum.APPROVED &&
            entity.visibility === VisibilityEnum.PUBLIC
        ) {
            return { allowed: true, reason: EntityPermissionReasonEnum.PUBLIC_ACCESS };
        }
        // ACTIVE + APPROVED + PRIVATE/RESTRICTED: only admin or the owner can view.
        if (
            entity.lifecycleState === LifecycleStatusEnum.ACTIVE &&
            entity.moderationState === ModerationStatusEnum.APPROVED &&
            [VisibilityEnum.PRIVATE, VisibilityEnum.RESTRICTED].includes(entity.visibility)
        ) {
            if (actor.role === RoleEnum.ADMIN) {
                return { allowed: true, reason: EntityPermissionReasonEnum.ADMIN };
            }
            if (actor.role === RoleEnum.HOST && entity.ownerId === actor.id) {
                return { allowed: true, reason: EntityPermissionReasonEnum.OWNER };
            }
            return {
                allowed: false,
                reason:
                    entity.visibility === VisibilityEnum.PRIVATE
                        ? EntityPermissionReasonEnum.PRIVATE
                        : EntityPermissionReasonEnum.RESTRICTED
            };
        }
        // ACTIVE + PENDING: only admin or the owner can view.
        if (
            entity.lifecycleState === LifecycleStatusEnum.ACTIVE &&
            entity.moderationState === ModerationStatusEnum.PENDING
        ) {
            if (actor.role === RoleEnum.ADMIN) {
                return { allowed: true, reason: EntityPermissionReasonEnum.ADMIN };
            }
            if (actor.role === RoleEnum.HOST && entity.ownerId === actor.id) {
                return { allowed: true, reason: EntityPermissionReasonEnum.OWNER };
            }
            return { allowed: false, reason: EntityPermissionReasonEnum.PENDING };
        }
    }

    // Deny by default if no other rule has matched.
    return { allowed: false, reason: EntityPermissionReasonEnum.DENIED };
}

/**
 * Asynchronously checks if an actor has a specific permission.
 * This is a lightweight wrapper around `hasPermission` that returns a promise.
 * @param actor The actor to check.
 * @param permission The permission to check for.
 * @returns A promise that resolves to `true` if the permission is held, `false` otherwise.
 */
export function checkPermission(actor: Actor, permission: PermissionEnum): Promise<boolean> {
    return Promise.resolve(hasPermission(actor, permission));
}

/**
 * Generates a user-friendly description for a permission denial.
 * @param permission The permission that was denied.
 * @returns A string explaining that the user does not have the required permission.
 */
export function getPermissionDescription(permission: PermissionEnum): string {
    return `You do not have permission to ${permissionDescriptions[permission] ?? 'perform this action'}.`;
}

/**
 * A generic permission checker that throws a ServiceError if the check fails.
 * It verifies if the actor has the `_ANY` permission, or if they have the `_OWN`
 * permission and the `isEntityOwner` condition is met.
 *
 * @param actor The actor performing the action.
 * @param anyPermission The permission for performing the action on any entity.
 * @param ownPermission The permission for performing the action on an owned entity.
 * @param isEntityOwner A boolean indicating if the actor is the owner of the entity.
 * @param errorMessage The error message to throw if permission is denied.
 */
export function checkGenericPermission(
    actor: Actor,
    anyPermission: PermissionEnum,
    ownPermission: PermissionEnum,
    isEntityOwner: boolean,
    errorMessage: string
) {
    const can =
        hasPermission(actor, anyPermission) ||
        (hasPermission(actor, ownPermission) && isEntityOwner);
    if (!can) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, errorMessage);
    }
}
