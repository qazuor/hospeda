import type { TouristService } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.TOURIST_SERVICE_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create tourist services'
        );
    }
}

export function checkCanUpdate(actor: Actor, _entity: TouristService): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.TOURIST_SERVICE_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update tourist services'
        );
    }
}

export function checkCanPatch(actor: Actor, _entity: TouristService, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.TOURIST_SERVICE_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to patch tourist services'
        );
    }
}

export function checkCanDelete(actor: Actor, _entity: TouristService): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.TOURIST_SERVICE_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to delete tourist services'
        );
    }
}

export function checkCanHardDelete(actor: Actor, _entity: TouristService): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.TOURIST_SERVICE_HARD_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete tourist services'
        );
    }
}

export function checkCanRestore(actor: Actor, _entity: TouristService): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.TOURIST_SERVICE_RESTORE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to restore tourist services'
        );
    }
}

export function checkCanView(actor: Actor, _entity: TouristService): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.TOURIST_SERVICE_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view tourist services'
        );
    }
}

export function checkCanList(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.TOURIST_SERVICE_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list tourist services'
        );
    }
}

export function checkCanSoftDelete(actor: Actor, _entity: TouristService): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.TOURIST_SERVICE_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to soft delete tourist services'
        );
    }
}

export function checkCanSearch(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.TOURIST_SERVICE_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to search tourist services'
        );
    }
}

export function checkCanCount(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.TOURIST_SERVICE_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to count tourist services'
        );
    }
}

/**
 * Checks if an actor has permission to update visibility of tourist services.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateVisibility(actor: Actor, _entity: TouristService): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.TOURIST_SERVICE_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update tourist service visibility'
        );
    }
}
