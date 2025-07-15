import { ServiceError } from '@repo/service-core';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import type { Actor } from '../../types';

/**
 * Checks if the actor can create an event location.
 * Throws ServiceError if not permitted.
 */
export function checkCanCreateEventLocation(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.EVENT_LOCATION_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to create event location'
        );
    }
}

/**
 * Checks if the actor can update an event location.
 * Throws ServiceError if not permitted.
 */
export function checkCanUpdateEventLocation(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.EVENT_LOCATION_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to update event location'
        );
    }
}

/**
 * Checks if the actor can delete an event location.
 * Throws ServiceError if not permitted.
 */
export function checkCanDeleteEventLocation(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.EVENT_LOCATION_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to delete event location'
        );
    }
}
