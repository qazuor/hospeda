import type { Destination } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if an actor has permission to create destinations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.DESTINATION_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create destinations'
        );
    }
}

/**
 * Checks if an actor has permission to update destinations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdate(actor: Actor, _entity: Destination): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.DESTINATION_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update destinations'
        );
    }
}

/**
 * Checks if an actor has permission to soft delete destinations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSoftDelete(actor: Actor, _entity: Destination): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.DESTINATION_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to soft delete destinations'
        );
    }
}

/**
 * Checks if an actor has permission to hard delete destinations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDelete(actor: Actor, _entity: Destination): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.DESTINATION_HARD_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete destinations'
        );
    }
}

/**
 * Checks if an actor has permission to restore destinations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestore(actor: Actor, _entity: Destination): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.DESTINATION_RESTORE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to restore destinations'
        );
    }
}

/**
 * Checks if an actor has permission to view destinations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor, _entity: Destination): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.DESTINATION_VIEW_ALL)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view destinations'
        );
    }
}

/**
 * Checks if an actor has permission to list destinations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanList(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.DESTINATION_VIEW_ALL)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list destinations'
        );
    }
}

/**
 * Checks if an actor has permission to search destinations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSearch(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.DESTINATION_VIEW_ALL)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to search destinations'
        );
    }
}

/**
 * Checks if an actor has permission to count destinations.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCount(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.DESTINATION_VIEW_ALL)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to count destinations'
        );
    }
}
