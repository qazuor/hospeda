import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import type { PermissionEnum } from '@repo/types/enums/permission.enum';
import { RoleEnum } from '@repo/types/enums/role.enum';
import { ModerationStatusEnum } from '@repo/types/enums/state.enum';
import { VisibilityEnum } from '@repo/types/enums/visibility.enum';
import { EntityPermissionReasonEnum } from '../types';

/**
 * Action types supported by the generic permission function.
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
 * Minimal required types for the main entity.
 */
export interface EntityPermissionInput {
    lifecycleState: LifecycleStatusEnum;
    moderationState: ModerationStatusEnum;
    visibility: VisibilityEnum;
    ownerId: string;
    deletedAt?: Date | null;
}

/**
 * Minimal required actor for the permission function.
 */
export interface EntityPermissionActor {
    id: string;
    role: RoleEnum;
    permissions: PermissionEnum[];
}

/**
 * Result of the permission evaluation.
 */
export interface EntityPermissionResult {
    allowed: boolean;
    reason: EntityPermissionReasonEnum;
}

/**
 * Checks if the actor has the required permission (direct or by role).
 * @param actor - Actor with a list of permissions
 * @param required - Permission to check
 * @returns boolean
 */
export const hasPermission = (actor: EntityPermissionActor, required: PermissionEnum): boolean => {
    return actor.permissions.includes(required);
};

/**
 * Generic permission logic for main entities.
 * @param actor - The user performing the action
 * @param entity - The entity being acted upon
 * @param action - The action to evaluate
 * @returns EntityPermissionResult
 */
export function getEntityPermission(
    actor: EntityPermissionActor,
    entity: EntityPermissionInput,
    action: EntityAction,
    options?: { hasAny?: boolean; hasOwn?: boolean }
): EntityPermissionResult {
    // Super admin can do everything
    if (actor.role === RoleEnum.SUPER_ADMIN) {
        return { allowed: true, reason: EntityPermissionReasonEnum.SUPER_ADMIN };
    }

    // Hard delete: only super admin
    if (action === 'hardDelete') {
        return { allowed: false, reason: EntityPermissionReasonEnum.NOT_SUPER_ADMIN };
    }

    // If deleted, no action allowed except hardDelete (already covered above)
    if (entity.deletedAt) {
        return { allowed: false, reason: EntityPermissionReasonEnum.DELETED };
    }

    // Restore on archived: only admin or owner
    if (entity.lifecycleState === LifecycleStatusEnum.ARCHIVED && action === 'restore') {
        if (options?.hasAny) {
            return { allowed: true, reason: EntityPermissionReasonEnum.ADMIN };
        }
        if (options?.hasOwn) {
            return { allowed: true, reason: EntityPermissionReasonEnum.OWNER };
        }
        return { allowed: false, reason: EntityPermissionReasonEnum.ARCHIVED };
    }

    // Actions approve/reject/feature/publish: only admin
    if (['approve', 'reject', 'feature', 'publish'].includes(action)) {
        if (actor.role === RoleEnum.ADMIN) {
            return { allowed: true, reason: EntityPermissionReasonEnum.ADMIN };
        }
        return { allowed: false, reason: EntityPermissionReasonEnum.NOT_ADMIN };
    }

    // update/delete/restore: owner only on their own entity, admin on any entity
    if (['update', 'delete', 'restore'].includes(action)) {
        if (options?.hasAny) {
            return { allowed: true, reason: EntityPermissionReasonEnum.ADMIN };
        }
        if (options?.hasOwn) {
            return { allowed: true, reason: EntityPermissionReasonEnum.OWNER };
        }
        return { allowed: false, reason: EntityPermissionReasonEnum.DENIED };
    }

    // View logic
    if (action === 'view') {
        // ARCHIVED/DRAFT/REJECTED: solo admin/owner
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
        // ACTIVE + APPROVED + PUBLIC: cualquiera
        if (
            entity.lifecycleState === LifecycleStatusEnum.ACTIVE &&
            entity.moderationState === ModerationStatusEnum.APPROVED &&
            entity.visibility === VisibilityEnum.PUBLIC
        ) {
            return { allowed: true, reason: EntityPermissionReasonEnum.PUBLIC_ACCESS };
        }
        // ACTIVE + APPROVED + PRIVATE/RESTRICTED: admin/owner
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
        // ACTIVE + PENDING: admin/owner
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

    // Deny by default
    return { allowed: false, reason: EntityPermissionReasonEnum.DENIED };
}
