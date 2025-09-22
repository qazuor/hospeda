import type { Destination } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode, VisibilityEnum } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';

/**
 * Checks if an actor has permission to view a destination.
 * Public destinations are always viewable. Private/Restricted require specific permissions.
 * @param actor The actor performing the action.
 * @param entity The destination entity to be viewed.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanViewDestination(actor: Actor, entity: Destination): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (
        entity.visibility === VisibilityEnum.PUBLIC ||
        hasPermission(actor, PermissionEnum.DESTINATION_VIEW_PRIVATE) ||
        hasPermission(actor, PermissionEnum.DESTINATION_VIEW_DRAFT)
    ) {
        return;
    }
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'FORBIDDEN: Permission denied to view destination'
    );
}

/**
 * Checks if an actor has permission to list destinations.
 * Currently, any actor can attempt to list destinations.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanListDestinations(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    // Listing is allowed for any actor; results are filtered elsewhere.
    return;
}

/**
 * Checks if an actor has permission to search destinations.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSearchDestinations(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    // Searching is allowed for any actor; results are filtered elsewhere.
    return;
}

/**
 * Checks if an actor has permission to count destinations.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCountDestinations(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    // Counting is allowed for any actor; results are filtered elsewhere.
    return;
}

/**
 * Checks if an actor has permission to create a destination.
 * Requires the DESTINATION_CREATE permission.
 * @param actor The actor performing the action.
 * @param _data The data for the destination to be created (unused in this check).
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreateDestination(actor: Actor, _data: unknown): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.DESTINATION_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to create destination'
        );
    }
}

/**
 * Checks if an actor has permission to update a destination.
 * Requires DESTINATION_UPDATE permission.
 * @param actor The actor performing the action.
 * @param entity The destination entity to be updated.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateDestination(actor: Actor, _entity: Destination): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.DESTINATION_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to update destination'
        );
    }
}

/**
 * Checks if an actor has permission to soft-delete a destination.
 * Requires DESTINATION_DELETE permission.
 * @param actor The actor performing the action.
 * @param entity The destination entity to be soft-deleted.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSoftDeleteDestination(actor: Actor, _entity: Destination): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.DESTINATION_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to delete destination'
        );
    }
}

/**
 * Checks if an actor has permission to permanently delete a destination.
 * Requires DESTINATION_HARD_DELETE permission.
 * @param actor The actor performing the action.
 * @param entity The destination entity to be deleted.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDeleteDestination(actor: Actor, _entity: Destination): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.DESTINATION_HARD_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to permanently delete destination'
        );
    }
}

/**
 * Checks if an actor has permission to restore a soft-deleted destination.
 * Requires DESTINATION_RESTORE permission.
 * @param actor The actor performing the action.
 * @param entity The destination entity to be restored.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestoreDestination(actor: Actor, _entity: Destination): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.DESTINATION_RESTORE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to restore destination'
        );
    }
}

/**
 * Checks if an actor has permission to update the visibility of a destination.
 * Requires DESTINATION_VISIBILITY_TOGGLE permission.
 * @param actor The actor performing the action.
 * @param entity The destination entity whose visibility is being updated.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateDestinationVisibility(actor: Actor, _entity: Destination): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.DESTINATION_VISIBILITY_TOGGLE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to update destination visibility'
        );
    }
}
