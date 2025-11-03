import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * Checks if an actor has permission to view an attraction.
 * Public attractions are always viewable. Private/Restricted require specific permissions.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanViewAttraction(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    // TODO: Add visibility logic if attractions have visibility, else use permissions only
    if (
        hasPermission(actor, PermissionEnum.DESTINATION_VIEW_PRIVATE) ||
        hasPermission(actor, PermissionEnum.DESTINATION_VIEW_DRAFT)
    ) {
        return;
    }
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'FORBIDDEN: Permission denied to view attraction'
    );
}

/**
 * Checks if an actor has permission to list/search/count attractions.
 * Currently, any actor can attempt to list attractions; results are filtered elsewhere.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanListAttractions(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    // Listing is allowed for any actor; results are filtered elsewhere.
    return;
}

/**
 * Checks if an actor has permission to create an attraction.
 * Requires the DESTINATION_CREATE permission.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreateAttraction(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.DESTINATION_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to create attraction'
        );
    }
}

/**
 * Checks if an actor has permission to update an attraction.
 * Requires DESTINATION_UPDATE permission.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateAttraction(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.DESTINATION_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to update attraction'
        );
    }
}

/**
 * Checks if an actor has permission to delete an attraction.
 * Requires DESTINATION_DELETE permission.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanDeleteAttraction(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.DESTINATION_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to delete attraction'
        );
    }
}
