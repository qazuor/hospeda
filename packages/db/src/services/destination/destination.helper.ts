// Helpers for DestinationService (pattern: accommodation.helper.ts)

import {
    LifecycleStatusEnum,
    PermissionEnum,
    type PublicUserType,
    RoleEnum,
    type UserType,
    VisibilityEnum
} from '@repo/types';
import { castBrandedIds, castDateFields } from '../../utils/cast-helper';
import { CanViewReasonEnum } from '../../utils/service-helper';

// --- Permissions & Visibility Helpers (copied/adapted from accommodation.helper.ts) ---

/**
 * Determines if the actor can view the destination based on visibility and permissions.
 * Returns an object with the result and the reason (for logging).
 */
export const canViewDestination = (
    actor: UserType | PublicUserType,
    destination: { visibility: string }
): { canView: boolean; reason: CanViewReasonEnum; checkedPermission?: PermissionEnum } => {
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

/**
 * Normalizes the create input: casts branded IDs y fechas.
 * @param input - El input de creación
 * @returns El input normalizado
 */
export const normalizeCreateInput = (input: Record<string, unknown>) => {
    const inputWithBrandedIds = castBrandedIds(input, (id: unknown) => id as string);
    const inputWithDates = castDateFields(inputWithBrandedIds);
    return inputWithDates;
};

/**
 * Builds the update object for soft-deleting (archiving) a destination.
 * @param actor - The user or public actor performing the delete.
 * @returns Partial<UpdateDestinationInputType> with archive fields set.
 * @example
 * const update = buildSoftDeleteUpdate(user);
 */
export const buildSoftDeleteUpdate = (actor: UserType | PublicUserType) => {
    const now = new Date();
    const deletedById = 'id' in actor ? actor.id : undefined;
    return {
        lifecycleState: LifecycleStatusEnum.ARCHIVED,
        deletedAt: now,
        deletedById,
        updatedAt: now,
        updatedById: deletedById
    };
};

/**
 * Throws if the destination is archived or deleted.
 * @param destination - The destination object.
 * @throws Error if already archived or deleted.
 * @example
 * assertNotArchived(destination);
 */
export const assertNotArchived = (destination: {
    lifecycleState?: string;
    deletedAt?: Date | null;
}) => {
    if (destination.lifecycleState === 'ARCHIVED' || destination.deletedAt) {
        throw new Error('Destination is already archived or deleted');
    }
};

/**
 * Builds the update object for restoring (un-archiving) a destination.
 * @param actor - The user o public actor performing the restore.
 * @returns Partial<UpdateDestinationInputType> with restore fields set.
 * @example
 * const update = buildRestoreUpdate(user);
 */
export const buildRestoreUpdate = (actor: UserType | PublicUserType) => {
    const now = new Date();
    const updatedById = 'id' in actor ? actor.id : undefined;
    return {
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        deletedAt: undefined,
        deletedById: undefined,
        updatedAt: now,
        updatedById
    };
};

/**
 * Throws if the destination is not archived (already active).
 * @param destination - The destination object.
 * @throws Error if not archived.
 * @example
 * assertNotActive(destination);
 */
export const assertNotActive = (destination: {
    lifecycleState?: string;
    deletedAt?: Date | null;
}) => {
    if (destination.lifecycleState !== 'ARCHIVED' || !destination.deletedAt) {
        throw new Error('Destination is not archived');
    }
};
