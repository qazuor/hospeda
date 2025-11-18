import type { AdSlotReservation } from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if an actor has permission to create ad slot reservations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_CREATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create ad slot reservations'
        );
    }
}

/**
 * Checks if an actor has permission to update ad slot reservations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdate(actor: Actor, _entity: AdSlotReservation): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_UPDATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update ad slot reservations'
        );
    }
}

/**
 * Checks if an actor has permission to patch ad slot reservations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanPatch(actor: Actor, _entity: AdSlotReservation, _data: unknown): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_UPDATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to patch ad slot reservations'
        );
    }
}

/**
 * Checks if an actor has permission to update visibility of ad slot reservations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateVisibility(actor: Actor, _entity: AdSlotReservation): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_UPDATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update ad slot reservation visibility'
        );
    }
}

/**
 * Checks if an actor has permission to delete ad slot reservations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanDelete(actor: Actor, _entity: AdSlotReservation): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to delete ad slot reservations'
        );
    }
}

/**
 * Checks if an actor has permission to hard delete ad slot reservations.
 * Hard delete is restricted to administrators only for security reasons.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDelete(actor: Actor, _entity: AdSlotReservation): void {
    // Hard delete is restricted to administrators only, regardless of permissions
    if (!actor || !actor.id || actor.role !== RoleEnum.ADMIN) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only administrators can permanently delete ad slot reservations'
        );
    }
}

/**
 * Checks if an actor has permission to restore ad slot reservations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestore(actor: Actor, _entity: AdSlotReservation): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_RESTORE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to restore ad slot reservations'
        );
    }
}

/**
 * Checks if an actor has permission to view ad slot reservations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor, _entity: AdSlotReservation): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_VIEW)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view ad slot reservations'
        );
    }
}

/**
 * Checks if an actor has permission to list ad slot reservations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanList(actor: Actor): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_VIEW)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list ad slot reservations'
        );
    }
}

/**
 * Checks if an actor has permission to soft delete ad slot reservations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSoftDelete(actor: Actor, _entity: AdSlotReservation): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to soft delete ad slot reservations'
        );
    }
}

/**
 * Checks if an actor has permission to search ad slot reservations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSearch(actor: Actor): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_VIEW)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to search ad slot reservations'
        );
    }
}

/**
 * Checks if an actor has permission to count ad slot reservations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCount(actor: Actor): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_VIEW)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to count ad slot reservations'
        );
    }
}

/**
 * Checks if an actor has permission to manage status of ad slot reservations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanManageStatus(actor: Actor, _entity: AdSlotReservation): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_STATUS_MANAGE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to manage ad slot reservation status'
        );
    }
}
