import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';

/**
 * Throws if the actor cannot create an accommodation review.
 */
export function checkCanCreateAccommodationReview(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.ACCOMMODATION_REVIEW_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to create accommodation review'
        );
    }
}

/**
 * Throws if the actor cannot update an accommodation review.
 */
export function checkCanUpdateAccommodationReview(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.ACCOMMODATION_REVIEW_MODERATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to update accommodation review'
        );
    }
}

/**
 * Throws if the actor cannot delete an accommodation review.
 */
export function checkCanDeleteAccommodationReview(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.ACCOMMODATION_REVIEW_MODERATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to delete accommodation review'
        );
    }
}

/**
 * Throws if the actor cannot view an accommodation review.
 * Allows public access to reviews for any authenticated actor.
 */
export function checkCanViewAccommodationReview(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    // Allow any actor to view accommodation reviews; visibility filtering happens elsewhere
    return;
}

/**
 * Checks if an actor has permission to admin-list this entity type.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanAdminList(actor: Actor): void {
    if (!actor || !actor.id || !hasPermission(actor, PermissionEnum.ACCOMMODATION_REVIEW_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: ACCOMMODATION_REVIEW_VIEW required for admin list'
        );
    }
}
