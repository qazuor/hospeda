import type { AccommodationListing } from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if an actor has permission to create accommodation listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_CREATE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create accommodation listings'
        );
    }
}

/**
 * Checks if an actor has permission to update accommodation listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdate(actor: Actor, _entity: AccommodationListing): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_UPDATE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update accommodation listings'
        );
    }
}

/**
 * Checks if an actor has permission to patch accommodation listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanPatch(actor: Actor, _entity: AccommodationListing, _data: unknown): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_UPDATE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to patch accommodation listings'
        );
    }
}

/**
 * Checks if an actor has permission to delete accommodation listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanDelete(actor: Actor, _entity: AccommodationListing): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_DELETE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to delete accommodation listings'
        );
    }
}

/**
 * Checks if an actor has permission to hard delete accommodation listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDelete(actor: Actor, _entity: AccommodationListing): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_HARD_DELETE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete accommodation listings'
        );
    }
}

/**
 * Checks if an actor has permission to restore accommodation listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestore(actor: Actor, _entity: AccommodationListing): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_RESTORE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to restore accommodation listings'
        );
    }
}

/**
 * Checks if an actor has permission to view accommodation listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor, _entity: AccommodationListing): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_VIEW))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view accommodation listings'
        );
    }
}

/**
 * Checks if an actor has permission to list accommodation listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanList(actor: Actor): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_VIEW))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list accommodation listings'
        );
    }
}

/**
 * Checks if an actor has permission to activate accommodation listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanActivate(actor: Actor, _entity: AccommodationListing): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_STATUS_MANAGE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to activate accommodation listings'
        );
    }
}

/**
 * Checks if an actor has permission to pause accommodation listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanPause(actor: Actor, _entity: AccommodationListing): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_STATUS_MANAGE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to pause accommodation listings'
        );
    }
}

/**
 * Checks if an actor has permission to archive accommodation listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanArchive(actor: Actor, _entity: AccommodationListing): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_STATUS_MANAGE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to archive accommodation listings'
        );
    }
}

/**
 * Checks if an actor has permission to soft delete accommodation listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSoftDelete(actor: Actor, _entity: AccommodationListing): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_DELETE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to soft delete accommodation listings'
        );
    }
}

/**
 * Checks if an actor has permission to search accommodation listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSearch(actor: Actor): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_VIEW))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to search accommodation listings'
        );
    }
}

/**
 * Checks if an actor has permission to count accommodation listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCount(actor: Actor): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_VIEW))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to count accommodation listings'
        );
    }
}

/**
 * Checks if an actor has permission to update visibility of accommodation listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateVisibility(actor: Actor, _entity: AccommodationListing): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_UPDATE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update accommodation listing visibility'
        );
    }
}
