import type { ClientAccessRight } from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if an actor has permission to create.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or users with ACCESS_PERMISSIONS_MANAGE can create access rights'
        );
    }
}

/**
 * Checks if an actor has permission to update.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdate(actor: Actor, _entity: ClientAccessRight): void {
    const isAdmin = actor.role === RoleEnum.ADMIN;
    const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

    if (!isAdmin && !hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can update access rights'
        );
    }
}

/**
 * Checks if an actor has permission to softdelete.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSoftDelete(actor: Actor, _entity: ClientAccessRight): void {
    const isAdmin = actor.role === RoleEnum.ADMIN;
    const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

    if (!isAdmin && !hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can delete access rights'
        );
    }
}

/**
 * Checks if an actor has permission to harddelete.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDelete(actor: Actor, _entity: ClientAccessRight): void {
    if (actor.role !== RoleEnum.ADMIN) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins can permanently delete access rights'
        );
    }
}

/**
 * Checks if an actor has permission to view.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor, _entity: ClientAccessRight): void {
    const isAdmin = actor.role === RoleEnum.ADMIN;
    const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

    if (!isAdmin && !hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can view access rights'
        );
    }
}

/**
 * Checks if an actor has permission to list.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanList(actor: Actor): void {
    const isAdmin = actor.role === RoleEnum.ADMIN;
    const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

    if (!isAdmin && !hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can list access rights'
        );
    }
}

/**
 * Checks if an actor has permission to restore.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestore(actor: Actor, _entity: ClientAccessRight): void {
    const isAdmin = actor.role === RoleEnum.ADMIN;
    const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

    if (!isAdmin && !hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can restore access rights'
        );
    }
}

/**
 * Checks if an actor has permission to search.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSearch(actor: Actor): void {
    const isAdmin = actor.role === RoleEnum.ADMIN;
    const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

    if (!isAdmin && !hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can search access rights'
        );
    }
}

/**
 * Checks if an actor has permission to count.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCount(actor: Actor): void {
    const isAdmin = actor.role === RoleEnum.ADMIN;
    const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

    if (!isAdmin && !hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can count access rights'
        );
    }
}

/**
 * Checks if an actor has permission to updatevisibility.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateVisibility(actor: Actor, _entity: ClientAccessRight): void {
    const isAdmin = actor.role === RoleEnum.ADMIN;
    const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

    if (!isAdmin && !hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can update visibility of access rights'
        );
    }
}

/**
 * Checks if an actor has permission to updatelifecyclestate.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateLifecycleState(actor: Actor, _entity: ClientAccessRight): void {
    const isAdmin = actor.role === RoleEnum.ADMIN;
    const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

    if (!isAdmin && !hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can update lifecycle state of access rights'
        );
    }
}
