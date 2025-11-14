import type { BenefitListingPlan } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_PLAN_CREATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create benefit listing plans'
        );
    }
}

export function checkCanUpdate(actor: Actor, _entity: BenefitListingPlan): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_PLAN_UPDATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update benefit listing plans'
        );
    }
}

export function checkCanPatch(actor: Actor, _entity: BenefitListingPlan, _data: unknown): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_PLAN_UPDATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to patch benefit listing plans'
        );
    }
}

export function checkCanDelete(actor: Actor, _entity: BenefitListingPlan): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_PLAN_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to delete benefit listing plans'
        );
    }
}

export function checkCanHardDelete(actor: Actor, _entity: BenefitListingPlan): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_PLAN_HARD_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete benefit listing plans'
        );
    }
}

export function checkCanRestore(actor: Actor, _entity: BenefitListingPlan): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_PLAN_RESTORE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to restore benefit listing plans'
        );
    }
}

export function checkCanView(actor: Actor, _entity: BenefitListingPlan): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_PLAN_VIEW)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view benefit listing plans'
        );
    }
}

export function checkCanList(actor: Actor): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_PLAN_VIEW)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list benefit listing plans'
        );
    }
}

export function checkCanSoftDelete(actor: Actor, _entity: BenefitListingPlan): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_PLAN_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to soft delete benefit listing plans'
        );
    }
}

export function checkCanSearch(actor: Actor): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_PLAN_VIEW)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to search benefit listing plans'
        );
    }
}

export function checkCanCount(actor: Actor): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_PLAN_VIEW)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to count benefit listing plans'
        );
    }
}

/**
 * Checks if an actor has permission to update visibility of benefit listing plans.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateVisibility(actor: Actor, _entity: BenefitListingPlan): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.BENEFIT_LISTING_PLAN_UPDATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update benefit listing plan visibility'
        );
    }
}
