import type { ServiceListingPlan } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_PLAN_CREATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create service listing plans'
        );
    }
}

export function checkCanUpdate(actor: Actor, _entity: ServiceListingPlan): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_PLAN_UPDATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update service listing plans'
        );
    }
}

export function checkCanPatch(actor: Actor, _entity: ServiceListingPlan, _data: unknown): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_PLAN_UPDATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to patch service listing plans'
        );
    }
}

export function checkCanDelete(actor: Actor, _entity: ServiceListingPlan): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_PLAN_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to delete service listing plans'
        );
    }
}

export function checkCanHardDelete(actor: Actor, _entity: ServiceListingPlan): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_PLAN_HARD_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete service listing plans'
        );
    }
}

export function checkCanRestore(actor: Actor, _entity: ServiceListingPlan): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_PLAN_RESTORE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to restore service listing plans'
        );
    }
}

export function checkCanView(actor: Actor, _entity: ServiceListingPlan): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_PLAN_VIEW)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view service listing plans'
        );
    }
}

export function checkCanList(actor: Actor): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_PLAN_VIEW)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list service listing plans'
        );
    }
}

export function checkCanSoftDelete(actor: Actor, _entity: ServiceListingPlan): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_PLAN_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to soft delete service listing plans'
        );
    }
}

export function checkCanSearch(actor: Actor): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_PLAN_VIEW)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to search service listing plans'
        );
    }
}

export function checkCanCount(actor: Actor): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_PLAN_VIEW)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to count service listing plans'
        );
    }
}

/**
 * Checks if an actor has permission to update visibility of service listing plans.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateVisibility(actor: Actor, _entity: ServiceListingPlan): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_PLAN_UPDATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update service listing plan visibility'
        );
    }
}
