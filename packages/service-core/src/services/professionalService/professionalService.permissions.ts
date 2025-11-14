import type { ProfessionalService } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if an actor has permission to create professional services.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create professional services'
        );
    }
}

/**
 * Checks if an actor has permission to update professional services.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdate(actor: Actor, _entity: ProfessionalService): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update professional services'
        );
    }
}

/**
 * Checks if an actor has permission to patch professional services.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanPatch(actor: Actor, _entity: ProfessionalService, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to patch professional services'
        );
    }
}

/**
 * Checks if an actor has permission to delete professional services.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanDelete(actor: Actor, _entity: ProfessionalService): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to delete professional services'
        );
    }
}

/**
 * Checks if an actor has permission to hard delete professional services.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDelete(actor: Actor, _entity: ProfessionalService): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_HARD_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete professional services'
        );
    }
}

/**
 * Checks if an actor has permission to restore professional services.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestore(actor: Actor, _entity: ProfessionalService): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_RESTORE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to restore professional services'
        );
    }
}

/**
 * Checks if an actor has permission to view professional services.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor, _entity: ProfessionalService): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view professional services'
        );
    }
}

/**
 * Checks if an actor has permission to list professional services.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanList(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list professional services'
        );
    }
}

/**
 * Checks if an actor has permission to soft delete professional services.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSoftDelete(actor: Actor, _entity: ProfessionalService): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to soft delete professional services'
        );
    }
}

/**
 * Checks if an actor has permission to search professional services.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSearch(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to search professional services'
        );
    }
}

/**
 * Checks if an actor has permission to count professional services.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCount(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to count professional services'
        );
    }
}

/**
 * Checks if an actor has permission to update visibility of professional services.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateVisibility(actor: Actor, _entity: ProfessionalService): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update professional service visibility'
        );
    }
}
