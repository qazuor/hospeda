import type { Notification } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if an actor has permission to create notifications.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.NOTIFICATION_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create notifications'
        );
    }
}

/**
 * Checks if an actor has permission to update notifications.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdate(actor: Actor, _entity: Notification): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.NOTIFICATION_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update notifications'
        );
    }
}

/**
 * Checks if an actor has permission to patch notifications.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanPatch(actor: Actor, _entity: Notification, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.NOTIFICATION_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to patch notifications'
        );
    }
}

/**
 * Checks if an actor has permission to delete notifications.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanDelete(actor: Actor, _entity: Notification): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.NOTIFICATION_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to delete notifications'
        );
    }
}

/**
 * Checks if an actor has permission to hard delete notifications.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDelete(actor: Actor, _entity: Notification): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.NOTIFICATION_HARD_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete notifications'
        );
    }
}

/**
 * Checks if an actor has permission to restore notifications.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestore(actor: Actor, _entity: Notification): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.NOTIFICATION_RESTORE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to restore notifications'
        );
    }
}

/**
 * Checks if an actor has permission to view notifications.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor, _entity: Notification): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.NOTIFICATION_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view notifications'
        );
    }
}

/**
 * Checks if an actor has permission to list notifications.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanList(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.NOTIFICATION_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list notifications'
        );
    }
}

/**
 * Checks if an actor has permission to soft delete notifications.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSoftDelete(actor: Actor, _entity: Notification): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.NOTIFICATION_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to soft delete notifications'
        );
    }
}

/**
 * Checks if an actor has permission to search notifications.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSearch(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.NOTIFICATION_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to search notifications'
        );
    }
}

/**
 * Checks if an actor has permission to count notifications.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCount(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.NOTIFICATION_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to count notifications'
        );
    }
}

/**
 * Checks if an actor has permission to update visibility of notifications.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateVisibility(actor: Actor, _entity: Notification): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.NOTIFICATION_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update notification visibility'
        );
    }
}
