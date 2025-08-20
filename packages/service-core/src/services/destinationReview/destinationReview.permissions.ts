import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

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

export function checkCanViewDestinationReview(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    // Allow any actor to view destination reviews; visibility filtering happens elsewhere
    return;
}
