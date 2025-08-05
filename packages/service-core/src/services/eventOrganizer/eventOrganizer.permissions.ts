import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if the actor can create an event organizer.
 * Throws ServiceError if not permitted.
 */
export function checkCanCreateEventOrganizer(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.EVENT_ORGANIZER_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to create event organizer'
        );
    }
}

/**
 * Checks if the actor can update an event organizer.
 * Throws ServiceError if not permitted.
 */
export function checkCanUpdateEventOrganizer(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.EVENT_ORGANIZER_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to update event organizer'
        );
    }
}

/**
 * Checks if the actor can delete an event organizer.
 * Throws ServiceError if not permitted.
 */
export function checkCanDeleteEventOrganizer(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.EVENT_ORGANIZER_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to delete event organizer'
        );
    }
}
