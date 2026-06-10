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
 * Public — any actor can view accommodation reviews. Visibility filtering
 * (lifecycleState, deletedAt) happens at the service/route layer.
 */
export function checkCanViewAccommodationReview(_actor: Actor): void {
    return;
}

/**
 * Throws if the actor cannot moderate (approve / reject) an accommodation review.
 * Requires {@link PermissionEnum.ACCOMMODATION_REVIEW_MODERATE}.
 */
export function checkCanModerateAccommodationReview(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_REVIEW_MODERATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: ACCOMMODATION_REVIEW_MODERATE required'
        );
    }
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
