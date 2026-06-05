import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';

export function checkCanCreateDestinationReview(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (
        !actor.permissions ||
        !actor.permissions.includes(PermissionEnum.DESTINATION_REVIEW_CREATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Actor lacks permission to create destination reviews'
        );
    }
}

export function checkCanUpdateDestinationReview(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (
        !actor.permissions ||
        !actor.permissions.includes(PermissionEnum.DESTINATION_REVIEW_UPDATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Actor lacks permission to update destination reviews'
        );
    }
}

export function checkCanDeleteDestinationReview(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (
        !actor.permissions ||
        !actor.permissions.includes(PermissionEnum.DESTINATION_REVIEW_MODERATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Actor lacks permission to delete destination reviews'
        );
    }
}

/**
 * Public — any actor can view destination reviews. Visibility filtering
 * (lifecycleState, deletedAt) happens at the service/route layer.
 */
export function checkCanViewDestinationReview(_actor: Actor): void {
    return;
}

/**
 * Throws if the actor cannot moderate (approve / reject) a destination review.
 * Requires {@link PermissionEnum.DESTINATION_REVIEW_MODERATE}.
 */
export function checkCanModerateDestinationReview(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!hasPermission(actor, PermissionEnum.DESTINATION_REVIEW_MODERATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: DESTINATION_REVIEW_MODERATE required'
        );
    }
}

/**
 * Checks if an actor has permission to admin-list this entity type.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanAdminList(actor: Actor): void {
    if (!actor || !actor.id || !hasPermission(actor, PermissionEnum.DESTINATION_REVIEW_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: DESTINATION_REVIEW_VIEW required for admin list'
        );
    }
}
