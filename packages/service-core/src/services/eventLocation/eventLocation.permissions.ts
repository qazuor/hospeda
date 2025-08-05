/**
 * @fileoverview Permission checking functions for EventLocation operations.
 * Contains authorization logic to determine if actors can perform specific actions on event locations.
 */

import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if the actor has permission to create an event location.
 * Validates that the actor exists and has the required CREATE permission.
 *
 * @param actor - The actor attempting to create an event location
 * @throws {ServiceError} When actor is missing or lacks the required permission
 *
 * @example
 * ```typescript
 * try {
 *   checkCanCreateEventLocation(currentUser);
 *   // Proceed with creation
 * } catch (error) {
 *   // Handle permission denied
 * }
 * ```
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
 * Checks if the actor has permission to update an event location.
 * Validates that the actor exists and has the required UPDATE permission.
 *
 * @param actor - The actor attempting to update an event location
 * @throws {ServiceError} When actor is missing or lacks the required permission
 *
 * @example
 * ```typescript
 * checkCanUpdateEventLocation(currentUser);
 * ```
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
