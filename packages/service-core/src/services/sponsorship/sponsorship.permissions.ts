import type { Sponsorship } from '@repo/schemas';
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
            !actor.permissions.includes(PermissionEnum.SPONSORSHIP_CREATE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can create sponsorships'
        );
    }
}

/**
 * Checks if an actor has permission to update.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdate(actor: Actor, _entity: Sponsorship): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.SPONSORSHIP_UPDATE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can update sponsorships'
        );
    }
}

/**
 * Checks if an actor has permission to softdelete.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSoftDelete(actor: Actor, _entity: Sponsorship): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.SPONSORSHIP_DELETE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can delete sponsorships'
        );
    }
}

/**
 * Checks if an actor has permission to view.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor, _entity: Sponsorship): void {
    const isAdmin = actor.role === RoleEnum.ADMIN;
    const hasPermission = actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW);

    if (!isAdmin && !hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can view sponsorships'
        );
    }
}

/**
 * Checks if an actor has permission to harddelete.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDelete(actor: Actor, _entity: Sponsorship): void {
    if (actor.role !== RoleEnum.ADMIN) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins can permanently delete sponsorships'
        );
    }
}

/**
 * Checks if an actor has permission to restore.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestore(actor: Actor, _entity: Sponsorship): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.SPONSORSHIP_RESTORE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can restore sponsorships'
        );
    }
}

/**
 * Checks if an actor has permission to list.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanList(actor: Actor): void {
    const isAdmin = actor.role === RoleEnum.ADMIN;
    const hasPermission = actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW);

    if (!isAdmin && !hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can list sponsorships'
        );
    }
}

/**
 * Checks if an actor has permission to search.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSearch(actor: Actor): void {
    const isAdmin = actor.role === RoleEnum.ADMIN;
    const hasPermission = actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW);

    if (!isAdmin && !hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can search sponsorships'
        );
    }
}

/**
 * Checks if an actor has permission to count.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCount(actor: Actor): void {
    const isAdmin = actor.role === RoleEnum.ADMIN;
    const hasPermission = actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW);

    if (!isAdmin && !hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can count sponsorships'
        );
    }
}

/**
 * Checks if an actor has permission to updatevisibility.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateVisibility(actor: Actor, _entity: Sponsorship): void {
    const isAdmin = actor.role === RoleEnum.ADMIN;
    const hasPermission = actor.permissions.includes(PermissionEnum.SPONSORSHIP_UPDATE);

    if (!isAdmin && !hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can update sponsorship visibility'
        );
    }
}

/**
 * Checks if an actor has permission to managestatus.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanManageStatus(actor: Actor, _entity: Sponsorship): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.SPONSORSHIP_STATUS_MANAGE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can manage sponsorship status'
        );
    }
}
