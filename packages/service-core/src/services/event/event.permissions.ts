/**
 * Permission helpers for EventService.
 * Each function throws ServiceError(FORBIDDEN) if the actor lacks permission.
 * Follows the pattern of other service permission helpers.
 */
// TODO: Implement permission checks for create, update, delete, restore, view, etc.

import type { EventType } from '@repo/types';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { type Actor, ServiceError } from '../../types';

/**
 * Checks if the actor can create an event.
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkCanCreateEvent(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.EVENT_CREATE)) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied to create event');
    }
}

/**
 * Checks if the actor can update the given event.
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkCanUpdateEvent(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.EVENT_UPDATE)) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied to update event');
    }
}

/**
 * Checks if the actor can delete the given event.
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkCanDeleteEvent(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.EVENT_DELETE)) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied to delete event');
    }
}

/**
 * Checks if the actor can restore the given event.
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkCanRestoreEvent(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.EVENT_RESTORE)) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied to restore event');
    }
}

/**
 * Checks if the actor can view the given event.
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkCanViewEvent(actor: Actor, event: EventType): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    // Public events: anyone can view
    if (event.visibility === 'PUBLIC') return;
    // Private/draft: only with permission
    if (
        actor.permissions?.includes(PermissionEnum.EVENT_VIEW_PRIVATE) ||
        actor.permissions?.includes(PermissionEnum.EVENT_VIEW_DRAFT)
    ) {
        return;
    }
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied to view event');
}

/**
 * Checks if the actor can list/search events.
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkCanListEvents(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.EVENT_SOFT_DELETE_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to list/search events'
        );
    }
}

/**
 * Checks if the actor can hard delete the given event.
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkCanHardDeleteEvent(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.EVENT_HARD_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to hard delete event'
        );
    }
}
