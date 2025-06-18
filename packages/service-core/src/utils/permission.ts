import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import type { PermissionEnum } from '@repo/types/enums/permission.enum';
import { RoleEnum } from '@repo/types/enums/role.enum';
import { ModerationStatusEnum } from '@repo/types/enums/state.enum';
import { VisibilityEnum } from '@repo/types/enums/visibility.enum';
import { EntityPermissionReasonEnum } from '../types';

/**
 * Tipos de acción soportados por la función de permisos genérica.
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
 * Tipos mínimos requeridos para la entidad principal.
 */
export interface EntityPermissionInput {
    lifecycleState: LifecycleStatusEnum;
    moderationState: ModerationStatusEnum;
    visibility: VisibilityEnum;
    ownerId: string;
    deletedAt?: Date | null;
}

/**
 * Actor mínimo requerido para la función de permisos.
 */
export interface EntityPermissionActor {
    id: string;
    role: RoleEnum;
    permissions: PermissionEnum[];
}

/**
 * Resultado de la evaluación de permisos.
 */
export interface EntityPermissionResult {
    allowed: boolean;
    reason: EntityPermissionReasonEnum;
}

/**
 * Chequea si el actor tiene el permiso requerido (directo o por rol).
 * @param actor - Actor con lista de permisos
 * @param required - Permiso a chequear
 * @returns boolean
 */
export const hasPermission = (actor: EntityPermissionActor, required: PermissionEnum): boolean => {
    return actor.permissions.includes(required);
};

/**
 * Lógica genérica de permisos para entidades principales.
 * @param actor - El usuario que realiza la acción
 * @param entity - La entidad sobre la que se actúa
 * @param action - La acción a evaluar
 * @returns EntityPermissionResult
 */
export function getEntityPermission(
    actor: EntityPermissionActor,
    entity: EntityPermissionInput,
    action: EntityAction,
    options?: { hasAny?: boolean; hasOwn?: boolean }
): EntityPermissionResult {
    // Super admin puede todo
    if (actor.role === RoleEnum.SUPER_ADMIN) {
        return { allowed: true, reason: EntityPermissionReasonEnum.SUPER_ADMIN };
    }

    // Hard delete: solo super admin
    if (action === 'hardDelete') {
        return { allowed: false, reason: EntityPermissionReasonEnum.NOT_SUPER_ADMIN };
    }

    // Si está eliminado, ninguna acción permitida excepto hardDelete (ya cubierto arriba)
    if (entity.deletedAt) {
        return { allowed: false, reason: EntityPermissionReasonEnum.DELETED };
    }

    // Restore sobre archived: solo admin u owner
    if (entity.lifecycleState === LifecycleStatusEnum.ARCHIVED && action === 'restore') {
        if (options?.hasAny) {
            return { allowed: true, reason: EntityPermissionReasonEnum.ADMIN };
        }
        if (options?.hasOwn) {
            return { allowed: true, reason: EntityPermissionReasonEnum.OWNER };
        }
        return { allowed: false, reason: EntityPermissionReasonEnum.ARCHIVED };
    }

    // Acciones de aprobar/rechazar/feature/publish: solo admin
    if (['approve', 'reject', 'feature', 'publish'].includes(action)) {
        if (actor.role === RoleEnum.ADMIN) {
            return { allowed: true, reason: EntityPermissionReasonEnum.ADMIN };
        }
        return { allowed: false, reason: EntityPermissionReasonEnum.NOT_ADMIN };
    }

    // update/delete/restore: owner solo sobre su entidad, admin sobre cualquiera
    if (['update', 'delete', 'restore'].includes(action)) {
        if (options?.hasAny) {
            return { allowed: true, reason: EntityPermissionReasonEnum.ADMIN };
        }
        if (options?.hasOwn) {
            return { allowed: true, reason: EntityPermissionReasonEnum.OWNER };
        }
        return { allowed: false, reason: EntityPermissionReasonEnum.DENIED };
    }

    // Lógica de visualización (view)
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

    // Por defecto, denegar
    return { allowed: false, reason: EntityPermissionReasonEnum.DENIED };
}
