import type { BenefitListing } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if an actor has permission to create benefit listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create benefit listings'
        );
    }
}

/**
 * Checks if an actor has permission to update benefit listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdate(actor: Actor, _entity: BenefitListing): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update benefit listings'
        );
    }
}

/**
 * Checks if an actor has permission to patch benefit listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanPatch(actor: Actor, _entity: BenefitListing, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to patch benefit listings'
        );
    }
}

/**
 * Checks if an actor has permission to delete benefit listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanDelete(actor: Actor, _entity: BenefitListing): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to delete benefit listings'
        );
    }
}

/**
 * Checks if an actor has permission to hard delete benefit listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDelete(actor: Actor, _entity: BenefitListing): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_HARD_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete benefit listings'
        );
    }
}

/**
 * Checks if an actor has permission to restore benefit listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestore(actor: Actor, _entity: BenefitListing): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_RESTORE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to restore benefit listings'
        );
    }
}

/**
 * Checks if an actor has permission to view benefit listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor, _entity: BenefitListing): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view benefit listings'
        );
    }
}

/**
 * Checks if an actor has permission to list benefit listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanList(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list benefit listings'
        );
    }
}

/**
 * Checks if an actor has permission to soft delete benefit listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSoftDelete(actor: Actor, _entity: BenefitListing): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to soft delete benefit listings'
        );
    }
}

/**
 * Checks if an actor has permission to search benefit listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSearch(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to search benefit listings'
        );
    }
}

/**
 * Checks if an actor has permission to count benefit listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCount(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to count benefit listings'
        );
    }
}

/**
 * Checks if an actor has permission to update visibility of benefit listings.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateVisibility(actor: Actor, _entity: BenefitListing): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update benefit listing visibility'
        );
    }
}
